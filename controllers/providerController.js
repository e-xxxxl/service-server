// controllers/providerController.js - FIXED (no duplicates)
const ServiceProvider = require('../models/ServiceProvider');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Notification = require('../models/Notification');
const MessageFilter = require('../middleware/messageFilter');
const { isValidState, isValidLga } = require('../data/nigeriaLocations');
const Transaction = require('../models/Transaction');
const { notifyUser } = require('../services/notificationService');
const { emitNewMessage } = require('../socket');

const cloudinary = require('../config/cloudinary'); // ✅ Now works
const fs = require('fs');

class ProviderController {

    
  // Helper: Upload file to Cloudinary
  static async uploadToCloudinary(file, folder) {
    return new Promise((resolve, reject) => {
      const uploadOptions = {
        folder: `9jatradies/${folder}`,
        resource_type: 'auto'
      };

      // Add specific transformations
      if (folder === 'selfies') {
        uploadOptions.transformation = [
          { width: 500, height: 500, crop: 'fill', gravity: 'face' },
          { quality: 'auto', fetch_format: 'auto' }
        ];
      }

      cloudinary.uploader.upload(file.path, uploadOptions, (error, result) => {
        // Delete temp file after upload
        if (file.path) fs.unlinkSync(file.path);
        
        if (error) reject(error);
        else resolve(result);
      });
    });
  }
  
   // POST /api/provider/setup-profile
// controllers/providerController.js - Updated setupProfile
static async setupProfile(req, res) {
    try {
      const userId = req.user.id;
      const { serviceType, tagline, ninNumber, street, city, state, phone } = req.body;

      // Validate required fields
      const missingFields = [];
      if (!serviceType?.trim()) missingFields.push('Service type');
      if (!tagline?.trim()) missingFields.push('Tagline');
      if (!ninNumber?.trim()) missingFields.push('NIN number');
      if (!city?.trim()) missingFields.push('City');
      if (!state?.trim()) missingFields.push('State');
      if (!req.files?.ninDocument?.[0]) missingFields.push('NIN document');
      if (!req.files?.selfiePhoto?.[0]) missingFields.push('Selfie photo');

      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Missing required fields: ${missingFields.join(', ')}`
        });
      }

      if (!isValidState(state.trim())) {
        return res.status(400).json({ success: false, message: 'Please select a valid Nigerian state' });
      }
      if (!isValidLga(state.trim(), city.trim())) {
        return res.status(400).json({ success: false, message: 'Please select a valid LGA/city for the selected state' });
      }

      // Upload NIN document to Cloudinary
      const ninUpload = await ProviderController.uploadToCloudinary(
        req.files.ninDocument[0], 
        'nin-documents'
      );

      // Upload selfie to Cloudinary
      const selfieUpload = await ProviderController.uploadToCloudinary(
        req.files.selfiePhoto[0], 
        'selfies'
      );

      console.log('Cloudinary uploads complete:', {
        nin: ninUpload.secure_url,
        selfie: selfieUpload.secure_url
      });

      const updateData = {
        serviceType: serviceType.toLowerCase().trim(),
        tagline: tagline.trim(),
        'nin.number': ninNumber.trim(),
        'nin.documentUrl': ninUpload.secure_url,
        'nin.documentPublicId': ninUpload.public_id,
        selfiePhoto: selfieUpload.secure_url,
        selfiePublicId: selfieUpload.public_id,
        city: city.trim(),
        state: state.trim(),
        'businessAddress.street': street?.trim() || '',
        'businessAddress.city': city.trim(),
        'businessAddress.state': state.trim(),
        verificationStatus: 'submitted',
        profileCompletionScore: 80,
        verificationDocuments: [
          { 
            type: 'nin', 
            url: ninUpload.secure_url,
            publicId: ninUpload.public_id,
            uploadedAt: new Date()
          },
          { 
            type: 'selfie', 
            url: selfieUpload.secure_url,
            publicId: selfieUpload.public_id,
            uploadedAt: new Date()
          }
        ]
      };

      // Populate user data for email
      const provider = await ServiceProvider.findOneAndUpdate(
        { user: userId },
        { $set: updateData },
        { new: true }
      ).populate('user', 'email fullName');

      // Update user phone
      if (phone?.trim()) {
        await User.findByIdAndUpdate(userId, { phone: phone.trim() });
      }

      // Create notification for provider
      await notifyUser(userId, {
        text: '✅ Your profile has been submitted for verification. Our team will review it within 24-48 hours.',
        kind: 'success'
      });

      // Send email notification to admin
      try {
        const emailService = require('../services/emailService');
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@9jatradiespages.com';
        
        await emailService.sendNewProviderSubmissionEmail(adminEmail, {
          companyName: provider.companyName || 'New Provider',
          serviceType: provider.serviceType || 'Not specified',
          city: provider.city || 'Not specified',
          state: provider.state || 'Not specified',
          nin: provider.nin,
          _id: provider._id
        });
        
        console.log('📧 Admin notification sent to:', adminEmail);
      } catch (emailError) {
        console.error('⚠️ Failed to send admin notification email:', emailError.message);
        // Don't fail the request if email fails - the provider already submitted successfully
      }

      res.json({
        success: true,
        message: 'Profile submitted for verification successfully!',
        data: {
          verificationStatus: provider.verificationStatus,
          serviceType: provider.serviceType,
          profileCompletion: provider.profileCompletionScore
        }
      });

    } catch (error) {
      console.error('Setup profile error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to setup profile. Please try again.' 
      });
    }
  }

  // POST /api/provider/resubmit-verification
// controllers/providerController.js - Updated resubmitVerification
static async resubmitVerification(req, res) {
    try {
      const userId = req.user.id;
      const provider = await ServiceProvider.findOne({ user: userId }).populate('user', 'email fullName');

      if (!provider) {
        return res.status(404).json({ success: false, message: 'Provider not found' });
      }

      if (provider.verificationStatus !== 'rejected') {
        return res.status(400).json({ 
          success: false, 
          message: 'Only rejected profiles can resubmit for verification' 
        });
      }

      const updateData = {
        verificationStatus: 'submitted',
        rejectionReason: null,
        $inc: { resubmissionCount: 1 }
      };

      // Delete old documents from Cloudinary if new ones are uploaded
      if (req.files?.ninDocument?.[0]) {
        if (provider.nin?.documentPublicId) {
          await cloudinary.uploader.destroy(provider.nin.documentPublicId);
        }
        
        const ninUpload = await ProviderController.uploadToCloudinary(
          req.files.ninDocument[0], 
          'nin-documents'
        );
        
        updateData['nin.documentUrl'] = ninUpload.secure_url;
        updateData['nin.documentPublicId'] = ninUpload.public_id;
      }

      if (req.files?.selfiePhoto?.[0]) {
        if (provider.selfiePublicId) {
          await cloudinary.uploader.destroy(provider.selfiePublicId);
        }
        
        const selfieUpload = await ProviderController.uploadToCloudinary(
          req.files.selfiePhoto[0], 
          'selfies'
        );
        
        updateData.selfiePhoto = selfieUpload.secure_url;
        updateData.selfiePublicId = selfieUpload.public_id;
      }

      await ServiceProvider.findOneAndUpdate(
        { user: userId },
        { $set: updateData }
      );

      await notifyUser(userId, {
        text: '📋 Your verification documents have been resubmitted for review.',
        kind: 'info'
      });

      // Send email notification to admin about resubmission
      try {
        const emailService = require('../services/emailService');
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@9jatradiespages.com';
        
        await emailService.sendNewProviderSubmissionEmail(adminEmail, {
          companyName: provider.companyName || 'Provider',
          serviceType: provider.serviceType || 'Not specified',
          city: provider.city || 'Not specified',
          state: provider.state || 'Not specified',
          nin: provider.nin,
          _id: provider._id
        });
        
        console.log('📧 Admin resubmission notification sent to:', adminEmail);
      } catch (emailError) {
        console.error('⚠️ Failed to send admin notification:', emailError.message);
      }

      res.json({ 
        success: true, 
        message: 'Documents resubmitted for verification successfully!' 
      });

    } catch (error) {
      console.error('Resubmit error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to resubmit documents. Please try again.' 
      });
    }
  }

  // POST /api/provider/upload-photo
  static async uploadPhoto(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
      }

      const provider = await ServiceProvider.findOne({ user: req.user.id });
      
      // Delete old photo if exists
      if (provider?.selfiePublicId) {
        await cloudinary.uploader.destroy(provider.selfiePublicId);
      }

      const result = await ProviderController.uploadToCloudinary(req.file, 'selfies');

      await ServiceProvider.findOneAndUpdate(
        { user: req.user.id },
        { 
          $set: { 
            selfiePhoto: result.secure_url,
            selfiePublicId: result.public_id
          } 
        }
      );

      res.json({
        success: true,
        url: result.secure_url
      });
    } catch (error) {
      console.error('Upload photo error:', error);
      res.status(500).json({ success: false, message: 'Upload failed' });
    }
  }

  // controllers/providerController.js - Add sendQuote method
// controllers/providerController.js - Fix sendQuote
// controllers/providerController.js - sendQuote
// controllers/providerController.js - FIXED sendQuote
// controllers/providerController.js - FIXED sendQuote
// controllers/providerController.js - sendQuote
static async sendQuote(req, res) {
    try {
      const { customerId } = req.params;
      const { serviceDescription, materials, workmanshipCost, materialCost, otherCosts, deadline } = req.body;
      const userId = req.user.id;

      const provider = await ServiceProvider.findOne({ user: userId });
      if (!provider) return res.status(404).json({ success: false, message: 'Provider not found' });

      const totalAmount = (Number(workmanshipCost) || 0) + (Number(materialCost) || 0) + (Number(otherCosts) || 0);
      if (totalAmount <= 0) return res.status(400).json({ success: false, message: 'Total amount must be greater than zero' });

      let conversation = await Conversation.findOne({ customer: customerId, professional: provider._id });
      if (!conversation) {
        conversation = new Conversation({ customer: customerId, professional: provider._id, messages: [] });
      }

      // ✅ Create the message object explicitly
      const newMsg = {
        sender: userId,
        senderModel: 'ServiceProvider',
        text: `📋 Quote from ${provider.companyName}: ${serviceDescription || 'Service'} - ₦${totalAmount.toLocaleString()}`,
        messageType: 'quote',
        quote: {
          serviceDescription: serviceDescription || '',
          materials: materials || '',
          workmanshipCost: Number(workmanshipCost) || 0,
          materialCost: Number(materialCost) || 0,
          otherCosts: Number(otherCosts) || 0,
          totalAmount: totalAmount,
          currency: 'NGN',
          validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          deadline: deadline ? new Date(deadline) : undefined,
          status: 'pending'
        },
        read: false,
        createdAt: new Date()
      };

      conversation.messages.push(newMsg);
      conversation.lastMessageAt = new Date();
      conversation.providerUnread = false;
      conversation.customerUnread = true;
      conversation.bookingStatus = 'quote_sent';

      const saved = await conversation.save();
      const rawMsg = saved.messages[saved.messages.length - 1].toObject();

      await notifyUser(customerId, {
        text: `💰 ${provider.companyName} sent you a quote of ₦${totalAmount.toLocaleString()}.`,
        kind: 'action',
        relatedConversation: saved._id
      });

      emitNewMessage({
        conversationId: saved._id,
        recipientUserId: customerId,
        message: { ...rawMsg, senderName: provider.companyName },
        senderName: provider.companyName
      });

      res.json({
        success: true,
        message: 'Quote sent successfully!',
        data: { messageId: rawMsg._id, conversationId: saved._id }
      });
    } catch (error) {
      console.error('Send quote error:', error);
      res.status(500).json({ success: false, message: 'Failed to send quote' });
    }
  }

  // GET /api/provider/dashboard
// GET /api/provider/dashboard
// controllers/providerController.js - Updated getDashboard
static async getDashboard(req, res) {
    try {
      const userId = req.user.id;
      const provider = await ServiceProvider.findOne({ user: userId });
      if (!provider) return res.status(404).json({ success: false, message: 'Provider profile not found' });

      const user = await User.findById(userId);
      const recentConversations = await Conversation.find({ professional: provider._id })
        .sort({ lastMessageAt: -1 }).limit(5).populate('customer', 'fullName');
      const notifications = await Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(10);

      res.json({
        success: true,
        data: {
          providerName: user.fullName?.split(' ')[0] || 'Pro',
          companyName: provider.companyName,
          profileCompletion: provider.profileCompletionScore || 0,
          verificationStatus: provider.verificationStatus,
          rejectionReason: provider.rejectionReason,
          isVisible: provider.isVisible,
          activeJobs: [],
          recentMessages: recentConversations.map(conv => ({
            id: conv._id,
            customerId: conv.customer?._id,
            customerName: conv.customer?.fullName || 'Unknown',
            preview: conv.messages[conv.messages.length - 1]?.text || '',
            time: conv.lastMessageAt,
            unread: conv.providerUnread || false
          })),
          notifications: notifications.map(n => ({ id: n._id, text: n.text, time: n.createdAt, kind: n.kind, read: n.read })),
          stats: { activeJobs: 0, completedJobs: provider.completedJobs || 0, rating: provider.rating || 0, responseRate: provider.responseRate || 0 }
        }
      });
    } catch (error) {
      console.error('Provider dashboard error:', error);
      res.status(500).json({ success: false, message: 'Failed to load provider dashboard' });
    }
  }

// GET /api/provider/messages
// controllers/providerController.js - getMessages
// controllers/providerController.js - getMessages
// controllers/providerController.js - FIXED getMessages
static async getMessages(req, res) {
    try {
      const userId = req.user.id;
      const provider = await ServiceProvider.findOne({ user: userId });
      if (!provider) return res.status(404).json({ success: false, message: 'Provider not found' });

      // ✅ Use lean() to get plain objects, then transform
      const conversations = await Conversation.find({ professional: provider._id })
        .sort({ lastMessageAt: -1 })
        .populate('customer', 'fullName email')
        .lean(); // ✅ Use lean() for plain JS objects

      const formattedConversations = conversations.map(conv => ({
        id: conv._id.toString(),
        customerId: conv.customer?._id?.toString(),
        customerName: conv.customer?.fullName || 'Customer',
        preview: conv.messages?.length ? conv.messages[conv.messages.length - 1]?.text || '' : '',
        time: conv.lastMessageAt,
        unread: conv.providerUnread || false,
        contactUnlocked: conv.contactUnlocked || false,
        bookingStatus: conv.bookingStatus || 'none',
        job: conv.job || null,
        // ✅ Map messages and ensure all fields are included
        messages: (conv.messages || []).map(m => ({
          _id: m._id?.toString(),
          id: m._id?.toString(),
          text: m.text || '',
          sender: m.sender?.toString(),
          senderModel: m.senderModel || 'User',
          messageType: m.messageType || 'text', // ✅ CRITICAL
          quote: m.quote || null,               // ✅ CRITICAL
          payment: m.payment || null,           // ✅ CRITICAL
          booking: m.booking || null,           // ✅ CRITICAL
          read: m.read || false,
          createdAt: m.createdAt || new Date()
        }))
      }));

      res.json({ success: true, data: formattedConversations });
    } catch (error) {
      console.error('Get messages error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch messages' });
    }
  }
// POST /api/provider/messages/:customerId
static async sendMessage(req, res) {
  try {
    const { customerId } = req.params;
    const { text } = req.body;
    const userId = req.user.id;

    const provider = await ServiceProvider.findOne({ user: userId }); // ✅ added
    if (!provider) return res.status(404).json({ success: false, message: 'Provider profile not found' });

    if (!text?.trim()) return res.status(400).json({ success: false, message: 'Message cannot be empty' });

    const filterResult = MessageFilter.filterMessage(text);
    if (!filterResult.isClean) {
      return res.status(400).json({ success: false, message: 'Contact info not allowed', warning: filterResult.warning });
    }

    let conversation = await Conversation.findOne({ customer: customerId, professional: provider._id }); // ✅ fixed
    if (!conversation) conversation = await Conversation.create({ customer: customerId, professional: provider._id, messages: [] }); // ✅ fixed

    conversation.messages.push({ sender: userId, senderModel: 'ServiceProvider', text: text.trim() });
    conversation.lastMessageAt = new Date();
    conversation.providerUnread = false;
    conversation.customerUnread = true;
    await conversation.save();

    const savedMessage = conversation.messages[conversation.messages.length - 1].toObject();
    emitNewMessage({
      conversationId: conversation._id,
      recipientUserId: customerId,
      message: { ...savedMessage, senderName: provider.companyName },
      senderName: provider.companyName
    });

    res.json({ success: true, message: 'Message sent', conversationId: conversation._id, messageId: savedMessage._id });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

  // PUT /api/provider/profile
  // Only a whitelist of self-editable fields — never mass-assign req.body
  // directly, since that would let a provider set fields like
  // verificationStatus, isVisible, rating, or wallet balance on themselves.
  static async updateProfile(req, res) {
    try {
      const editable = ['businessDescription', 'tagline', 'yearsOfExperience', 'teamSize', 'servicesOffered', 'isAvailable'];
      const updateData = {};
      for (const field of editable) {
        if (req.body[field] !== undefined) updateData[field] = req.body[field];
      }

      const provider = await ServiceProvider.findOneAndUpdate({ user: req.user.id }, { $set: updateData }, { new: true, runValidators: true });
      res.json({ success: true, message: 'Profile updated', data: provider });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  // PUT /api/provider/profile/basic
  static async updateBasicInfo(req, res) {
    try {
      const { companyName, businessDescription, tagline, yearsOfExperience, teamSize } = req.body;
      const provider = await ServiceProvider.findOneAndUpdate({ user: req.user.id }, { $set: { companyName, businessDescription, tagline, yearsOfExperience, teamSize } }, { new: true });
      res.json({ success: true, message: 'Basic info updated', data: provider });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  // PUT /api/provider/profile/business
  static async updateBusinessInfo(req, res) {
    try {
      const { businessAddress, phone } = req.body;

      if (businessAddress?.state && !isValidState(businessAddress.state)) {
        return res.status(400).json({ success: false, message: 'Please select a valid Nigerian state' });
      }
      if (businessAddress?.city && !isValidLga(businessAddress.state, businessAddress.city)) {
        return res.status(400).json({ success: false, message: 'Please select a valid LGA/city for the selected state' });
      }

      const provider = await ServiceProvider.findOneAndUpdate({ user: req.user.id }, { $set: { businessAddress } }, { new: true, runValidators: true });
      if (phone) await User.findByIdAndUpdate(req.user.id, { phone });
      res.json({ success: true, message: 'Business info updated', data: provider });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  // PUT /api/provider/profile/social
  static async updateSocialLinks(req, res) {
    try {
      const provider = await ServiceProvider.findOneAndUpdate({ user: req.user.id }, { $set: { socialLinks: req.body.socialLinks } }, { new: true });
      res.json({ success: true, message: 'Social links updated', data: provider });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  // PATCH /api/provider/availability
  static async updateAvailability(req, res) {
    try {
      await ServiceProvider.findOneAndUpdate({ user: req.user.id }, { isAvailable: req.body.isAvailable });
      res.json({ success: true, message: `You are now ${req.body.isAvailable ? 'available' : 'unavailable'}` });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  // GET /api/provider/jobs
  static async getJobs(req, res) { res.json({ success: true, data: [] }); }

  // POST /api/provider/jobs/:jobId/respond
  static async respondToJob(req, res) { res.json({ success: true, message: 'Response recorded' }); }

  // POST /api/provider/jobs/:conversationId/start
  static async startJob(req, res) {
    try {
      const { conversationId } = req.params;
      const provider = await ServiceProvider.findOne({ user: req.user.id });
      if (!provider) return res.status(404).json({ success: false, message: 'Provider not found' });

      const conversation = await Conversation.findOne({ _id: conversationId, professional: provider._id });
      if (!conversation) return res.status(404).json({ success: false, message: 'Job not found' });
      if (conversation.bookingStatus !== 'active') {
        return res.status(400).json({ success: false, message: 'This job cannot be started yet - payment must be confirmed first' });
      }

      conversation.bookingStatus = 'in_progress';
      conversation.job = { ...conversation.job, startedAt: new Date() };
      conversation.messages.push({
        sender: req.user.id,
        senderModel: 'ServiceProvider',
        text: `🔧 ${provider.companyName} started work on this job.`,
        messageType: 'job_started',
        createdAt: new Date()
      });
      conversation.lastMessageAt = new Date();
      conversation.customerUnread = true;
      const saved = await conversation.save();

      await notifyUser(conversation.customer, {
        text: `🔧 ${provider.companyName} has started work on your job.`,
        kind: 'success',
        relatedConversation: conversation._id
      });

      const savedMessage = saved.messages[saved.messages.length - 1].toObject();
      emitNewMessage({
        conversationId: conversation._id,
        recipientUserId: conversation.customer,
        message: { ...savedMessage, senderName: provider.companyName },
        senderName: provider.companyName
      });

      res.json({ success: true, message: 'Job marked as started', data: { startedAt: conversation.job.startedAt } });
    } catch (error) {
      console.error('Start job error:', error);
      res.status(500).json({ success: false, message: 'Failed to start job' });
    }
  }

  // POST /api/provider/jobs/:conversationId/complete
  static async completeJob(req, res) {
    try {
      const { conversationId } = req.params;
      const provider = await ServiceProvider.findOne({ user: req.user.id });
      if (!provider) return res.status(404).json({ success: false, message: 'Provider not found' });

      const conversation = await Conversation.findOne({ _id: conversationId, professional: provider._id });
      if (!conversation) return res.status(404).json({ success: false, message: 'Job not found' });
      if (!['active', 'in_progress'].includes(conversation.bookingStatus)) {
        return res.status(400).json({ success: false, message: 'This job cannot be marked complete from its current status' });
      }

      conversation.bookingStatus = 'completed';
      conversation.job = { ...conversation.job, completedAt: new Date() };
      conversation.messages.push({
        sender: req.user.id,
        senderModel: 'ServiceProvider',
        text: `✅ ${provider.companyName} marked this job as completed.`,
        messageType: 'job_completed',
        createdAt: new Date()
      });
      conversation.lastMessageAt = new Date();
      conversation.customerUnread = true;
      const saved = await conversation.save();

      await Promise.all([
        notifyUser(conversation.customer, {
          text: `✅ ${provider.companyName} marked your job as completed.`,
          kind: 'success',
          relatedConversation: conversation._id
        }),
        ServiceProvider.findByIdAndUpdate(provider._id, { $inc: { completedJobs: 1 } })
      ]);

      const savedMessage = saved.messages[saved.messages.length - 1].toObject();
      emitNewMessage({
        conversationId: conversation._id,
        recipientUserId: conversation.customer,
        message: { ...savedMessage, senderName: provider.companyName },
        senderName: provider.companyName
      });

      res.json({ success: true, message: 'Job marked as completed', data: { completedAt: conversation.job.completedAt } });
    } catch (error) {
      console.error('Complete job error:', error);
      res.status(500).json({ success: false, message: 'Failed to mark job as completed' });
    }
  }

  // GET /api/provider/messages - ONLY ONE VERSION
//   static async getMessages(req, res) {
//     try {
//       const userId = req.user.id;
//       const conversations = await Conversation.find({ professional: userId })
//         .sort({ lastMessageAt: -1 }).populate('customer', 'fullName email');

//       const formattedConversations = conversations.map(conv => ({
//         id: conv._id.toString(),
//         customerId: conv.customer?._id?.toString(), // IMPORTANT for frontend
//         customerName: conv.customer?.fullName || 'Customer',
//         preview: conv.messages[conv.messages.length - 1]?.text || '',
//         time: conv.lastMessageAt,
//         unread: conv.providerUnread || false,
//         messages: conv.messages // Include messages array
//       }));

//       res.json({ success: true, data: formattedConversations });
//     } catch (error) {
//       res.status(500).json({ success: false, message: 'Failed to fetch messages' });
//     }
//   }

  // POST /api/provider/messages/:customerId - ONLY ONE VERSION
  

  // GET /api/provider/messages/:conversationId/contact
  // Only returns the customer's phone/email once a payment on this
  // conversation has unlocked contact info server-side (see paymentController).
  static async getConversationContact(req, res) {
    try {
      const { conversationId } = req.params;
      const provider = await ServiceProvider.findOne({ user: req.user.id });
      if (!provider) return res.status(404).json({ success: false, message: 'Provider not found' });

      const conversation = await Conversation.findOne({
        _id: conversationId,
        professional: provider._id
      }).populate('customer', 'fullName email phone');

      if (!conversation) {
        return res.status(404).json({ success: false, message: 'Conversation not found' });
      }

      if (!conversation.contactUnlocked) {
        return res.status(403).json({
          success: false,
          message: 'Contact information unlocks once the customer has paid an accepted quote on this conversation.'
        });
      }

      res.json({
        success: true,
        data: {
          name: conversation.customer?.fullName,
          phone: conversation.customer?.phone || '',
          email: conversation.customer?.email || ''
        }
      });
    } catch (error) {
      console.error('Get conversation contact error:', error);
      res.status(500).json({ success: false, message: 'Failed to load contact information' });
    }
  }

  // GET /api/provider/wallet
  static async getWallet(req, res) {
    try {
      const provider = await ServiceProvider.findOne({ user: req.user.id }).select('wallet');
      if (!provider) return res.status(404).json({ success: false, message: 'Provider not found' });

      res.json({
        success: true,
        data: {
          balance: provider.wallet?.balance || 0,
          totalEarnings: provider.wallet?.totalEarnings || 0,
          pendingEarnings: provider.wallet?.pendingEarnings || 0
        }
      });
    } catch (error) {
      console.error('Get wallet error:', error);
      res.status(500).json({ success: false, message: 'Failed to load wallet' });
    }
  }

  // GET /api/provider/transactions
  static async getTransactions(req, res) {
    try {
      const provider = await ServiceProvider.findOne({ user: req.user.id });
      if (!provider) return res.status(404).json({ success: false, message: 'Provider not found' });

      const { page = 1, limit = 20 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [transactions, total] = await Promise.all([
        Transaction.find({ provider: provider._id, status: 'success' })
          .populate('customer', 'fullName')
          .sort({ paidAt: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        Transaction.countDocuments({ provider: provider._id, status: 'success' })
      ]);

      res.json({
        success: true,
        data: transactions.map(t => ({
          id: t._id.toString(),
          reference: t.reference,
          amount: t.providerPayout ?? t.amount, // what actually landed in the wallet, after platform commission
          grossAmount: t.amount, // what the customer paid, for transparency
          platformCommission: t.platformCommission || 0,
          currency: t.currency,
          customerName: t.customer?.fullName || 'Customer',
          conversationId: t.conversation,
          paidAt: t.paidAt
        })),
        pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)), limit: parseInt(limit) }
      });
    } catch (error) {
      console.error('Get transactions error:', error);
      res.status(500).json({ success: false, message: 'Failed to load transactions' });
    }
  }

  // GET /api/provider/notifications
  static async getNotifications(req, res) {
    try {
      const notifications = await Notification.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(20);
      res.json({ success: true, data: notifications.map(n => ({ id: n._id, text: n.text, time: n.createdAt, kind: n.kind, read: n.read })) });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  // PATCH /api/provider/notifications/:id/read
  static async markNotificationRead(req, res) {
    try {
      await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, { read: true });
      res.json({ success: true });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }


  
}



module.exports = ProviderController;