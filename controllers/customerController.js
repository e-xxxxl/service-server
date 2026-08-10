// controllers/customerController.js - UPDATED
const ServiceProvider = require('../models/ServiceProvider');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Notification = require('../models/Notification');
const Favorite = require('../models/Favorite');
const { notifyUser } = require('../services/notificationService');
const { emitNewMessage } = require('../socket');

class CustomerController {
  // GET /api/customer/dashboard
  static async getDashboard(req, res) {
    try {
      const userId = req.user.id;

      const [user, recentConvos, notifications, favorites] = await Promise.all([
        User.findById(userId),
        Conversation.find({ customer: userId })
          .sort({ lastMessageAt: -1 })
          .limit(10)
          .populate({
            path: 'professional',
            model: 'ServiceProvider',  // EXPLICITLY specify the model
            populate: {
              path: 'user',
              model: 'User',
              select: 'fullName' // never pull email/phone into a dashboard payload
            }
          }),
        Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(20),
        Favorite.find({ customer: userId }).populate({
          path: 'professional',
          model: 'ServiceProvider',  // EXPLICITLY specify the model
          populate: {
            path: 'user',
            model: 'User',
            select: 'fullName'
          }
        }),
      ]);

      const favoriteProIds = new Set(
        favorites
          .filter(f => f.professional)
          .map(f => f.professional._id.toString())
      );

        // controllers/customerController.js - Update getDashboard (the recentPros part)
   // controllers/customerController.js - Update recentPros in getDashboard
const recentPros = recentConvos
  .filter(c => c.professional && c.professional.isVisible && c.professional.verificationStatus === 'approved')
  .map(c => {
    const pro = c.professional;
    return {
      id: pro._id.toString(),
      fullName: pro.user?.fullName || pro.companyName,
      name: pro.user?.fullName || pro.companyName || 'Unknown Pro',
      companyName: pro.companyName,
      trade: pro.serviceType || 'General Service',
      serviceType: pro.serviceType,
      location: [pro.city, pro.state].filter(Boolean).join(', ') || 'Location not specified',
      city: pro.city || '',
      state: pro.state || '',
      rating: pro.rating || 0,
      jobs: pro.completedJobs || 0,
      years: pro.yearsOfExperience || 0,
      status: pro.isAvailable ? 'Available now' : 'Currently Unavailable',
      isVerified: pro.verificationStatus === 'approved',
      tagline: pro.tagline || '',
      lastContact: c.lastMessageAt,
      isFavorited: favoriteProIds.has(pro._id.toString()),
    };
  });

     const conversations = recentConvos
  .filter(c => c.professional)
  .map(c => {
    const pro = c.professional;
    return {
      id: c._id.toString(),
      professionalId: pro._id.toString(), // ✅ add this
      name: pro.user?.fullName || pro.companyName || 'Unknown',
      trade: pro.serviceType || 'General Service',
      preview: (c.messages && c.messages.length > 0) ? c.messages[c.messages.length - 1]?.text || '' : '',
      time: c.lastMessageAt,
      unread: c.customerUnread || false,
    };
  });

      const profileCompletion = CustomerController._computeProfileCompletion(user);

      res.json({
        success: true,
        data: {
          customerName: user.fullName?.split(' ')[0] || 'there',
          profileCompletion,
          recentPros,
          conversations,
          notifications: notifications.map(n => ({
            id: n._id.toString(),
            text: n.text || '',
            time: n.createdAt,
            kind: n.kind || 'info',
            read: n.read || false,
          })),
          favorites: favorites
            .filter(f => f.professional)
            .map(f => {
              const pro = f.professional;
              return {
                id: pro._id.toString(),
                name: pro.user?.fullName || pro.companyName || 'Unknown',
                trade: pro.serviceType || 'General Service',
                location: [pro.city, pro.state].filter(Boolean).join(', ') || 'Nigeria',
              };
            }),
        }
      });
    } catch (error) {
      console.error('Dashboard fetch error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to load dashboard',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // GET /api/customer/search
// controllers/customerController.js - Update searchProfessionals
// controllers/customerController.js - Update searchProfessionals
// controllers/customerController.js - Complete searchProfessionals
// controllers/customerController.js - Update searchProfessionals
static async searchProfessionals(req, res) {
    try {
      const { category, state, city, page = 1, limit = 20 } = req.query;

      const filter = {
        isAvailable: true,
        isVisible: true,
        verificationStatus: 'approved'
      };

      if (category && category.trim()) {
        filter.serviceType = { $regex: category.trim(), $options: 'i' };
      }

      // Exact match against the canonical state/LGA values (normalized at
      // write time), not a regex — "Lagos" vs "lagos state" style drift is
      // prevented by validating on save, not by fuzzy-matching on read.
      const locationConditions = [];
      if (state && state.trim()) {
        locationConditions.push(
          { state: state.trim() },
          { 'serviceArea.state': state.trim() },
          { 'businessAddress.state': state.trim() }
        );
      }
      if (city && city.trim()) {
        locationConditions.push(
          { city: city.trim() },
          { 'serviceArea.city': city.trim() },
          { 'businessAddress.city': city.trim() }
        );
      }
      if (locationConditions.length > 0) {
        if (filter.$and) filter.$and.push({ $or: locationConditions });
        else filter.$and = [{ $or: locationConditions }];
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [providers, total] = await Promise.all([
        ServiceProvider.find(filter)
          .populate('user', 'fullName') // never populate email/phone into public search results
          .sort({ rating: -1, completedJobs: -1, verifiedAt: -1 })
          .skip(skip).limit(parseInt(limit)),
        ServiceProvider.countDocuments(filter)
      ]);
      
      // Get favorites for current user
      let favoriteIds = new Set();
      if (req.user) {
        const userFavorites = await Favorite.find({ 
          customer: req.user.id,
          professional: { $in: providers.map(p => p._id) }
        }).select('professional');
        favoriteIds = new Set(userFavorites.map(f => f.professional.toString()));
      }
      
      // ✅ Enhanced results with more details
      const results = providers.map(provider => ({
        id: provider._id.toString(),
        fullName: provider.user?.fullName || provider.companyName || 'Unknown',
        name: provider.user?.fullName || provider.companyName || 'Unknown Pro',
        companyName: provider.companyName || '',
        trade: provider.serviceType || 'General',
        serviceType: provider.serviceType || '',
        city: provider.city || provider.businessAddress?.city || provider.serviceArea?.[0]?.city || '',
        state: provider.state || provider.businessAddress?.state || provider.serviceArea?.[0]?.state || '',
        location: [provider.city || provider.businessAddress?.city, provider.state || provider.businessAddress?.state].filter(Boolean).join(', ') || 'Location not specified',
        rating: provider.rating || 0,
        jobs: provider.completedJobs || 0,
        years: provider.yearsOfExperience || 0,
        status: provider.isAvailable ? 'Available now' : 'Currently Unavailable',
        isVerified: provider.verificationStatus === 'approved',
        verificationStatus: provider.verificationStatus,
        tagline: provider.tagline || '',
        // ✅ Profile photo from selfie
        profilePicture: provider.selfiePhoto || null,
        // ✅ Additional profile details
        businessDescription: provider.businessDescription || '',
        servicesOffered: provider.servicesOffered || [],
        teamSize: provider.teamSize || 1,
        completedJobs: provider.completedJobs || 0,
        isFavorited: favoriteIds.has(provider._id.toString()),
        // Contact info is intentionally never included here — it stays hidden
        // until a payment unlocks it on a specific conversation (see
        // GET /api/customer/messages/:conversationId/contact).
        lastActive: provider.lastActive || null
      }));
      
      res.json({
        success: true,
        data: results,
        pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)), limit: parseInt(limit) }
      });
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ success: false, message: 'Search failed' });
    }
  }

  // controllers/customerController.js - Add this method
static async getProviderProfile(req, res) {
    try {
      const provider = await ServiceProvider.findById(req.params.id)
        .populate('user', 'fullName'); // never populate email/phone into a public profile response

      if (!provider) {
        return res.status(404).json({ success: false, message: 'Provider not found' });
      }
      
      // Check if favorited by current user
      let isFavorited = false;
      if (req.user) {
        const fav = await Favorite.findOne({ 
          customer: req.user.id, 
          professional: provider._id 
        });
        isFavorited = !!fav;
      }
      
      res.json({
        success: true,
        data: {
          id: provider._id.toString(),
          fullName: provider.user?.fullName || provider.companyName,
          companyName: provider.companyName || '',
          trade: provider.serviceType || 'General',
          serviceType: provider.serviceType || '',
          tagline: provider.tagline || '',
          businessDescription: provider.businessDescription || '',
          city: provider.city || '',
          state: provider.state || '',
          location: [provider.city, provider.state].filter(Boolean).join(', '),
          rating: provider.rating || 0,
          totalReviews: provider.totalReviews || 0,
          completedJobs: provider.completedJobs || 0,
          yearsOfExperience: provider.yearsOfExperience || 0,
          teamSize: provider.teamSize || 1,
          status: provider.isAvailable ? 'Available now' : 'Currently Unavailable',
          isVerified: provider.verificationStatus === 'approved',
          profilePicture: provider.selfiePhoto || null,
          servicesOffered: provider.servicesOffered || [],
          businessAddress: provider.businessAddress || {},
          isAvailable: provider.isAvailable,
          lastActive: provider.lastActive || null,
          isFavorited
          // Contact info is intentionally omitted — see the contact-unlock
          // endpoint on the conversation once a payment has gone through.
        }
      });
    } catch (error) {
      console.error('Get provider profile error:', error);
      res.status(500).json({ success: false, message: 'Failed to load provider profile' });
    }
  }

  // controllers/customerController.js - Add acceptQuote method
// controllers/customerController.js - Fix acceptQuote
static async acceptQuote(req, res) {
    try {
      const { conversationId, messageId } = req.params;
      const userId = req.user.id;

      const conversation = await Conversation.findOne({
        _id: conversationId,
        customer: userId
      });

      if (!conversation) {
        return res.status(404).json({ success: false, message: 'Conversation not found' });
      }

      // Find the quote message by _id
      const message = conversation.messages.id(messageId);
      
      if (!message) {
        return res.status(404).json({ success: false, message: 'Quote message not found' });
      }

      if (message.messageType !== 'quote') {
        return res.status(400).json({ success: false, message: 'This message is not a quote' });
      }

      if (!message.quote) {
        return res.status(400).json({ success: false, message: 'Quote data is missing' });
      }

      if (message.quote.status !== 'pending') {
        return res.status(400).json({ success: false, message: 'This quote is no longer available' });
      }

      const amount = message.quote.totalAmount;

      // Accepting a quote does NOT mark it paid - that only happens once
      // Paystack confirms payment server-side (see paymentController).
      message.quote.status = 'accepted';
      message.quote.acceptedAt = new Date();

      conversation.messages.push({
        sender: userId,
        senderModel: 'User',
        text: `✅ Quote accepted. Proceed to payment to activate this job.`,
        messageType: 'quote_accepted',
        quote: message.quote,
        createdAt: new Date()
      });

      conversation.lastMessageAt = new Date();
      conversation.bookingStatus = 'pending_payment';
      conversation.customerUnread = false;
      conversation.providerUnread = true;

      await conversation.save();

      // Find the ServiceProvider's linked User to notify them.
      const provider = await ServiceProvider.findById(conversation.professional);
      if (provider) {
        await notifyUser(provider.user, {
          text: `🎉 A customer accepted your quote of ₦${amount.toLocaleString()}. Awaiting payment.`,
          kind: 'success',
          relatedConversation: conversation._id
        });
      }

      res.json({
        success: true,
        message: 'Quote accepted. Proceed to payment to activate this job.',
        data: {
          quote: message.quote,
          paymentRequired: true,
          amount,
          conversationId: conversation._id,
          messageId: message._id
        }
      });
    } catch (error) {
      console.error('Accept quote error:', error);
      res.status(500).json({ success: false, message: 'Failed to accept quote' });
    }
  }
  // controllers/customerController.js - Add submitReport
// controllers/customerController.js
// controllers/customerController.js - Fix submitReport
static async submitReport(req, res) {
    try {
      const { subject, message, type } = req.body;
      const userId = req.user.id;

      await notifyUser(userId, {
        text: `📝 ${subject || type === 'complaint' ? 'Complaint' : 'Support Request'}: ${message?.substring(0, 100) || 'No details provided'}`,
        kind: 'report'
      });

      res.json({ success: true, message: 'Report submitted successfully. Our team will review it shortly.' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to submit report' });
    }
  }

  // POST /api/customer/favorites/:professionalId
  static async toggleFavorite(req, res) {
    try {
      const { professionalId } = req.params;
      const userId = req.user.id;

      // Verify the professional exists
      const professional = await ServiceProvider.findById(professionalId);
      if (!professional) {
        return res.status(404).json({
          success: false,
          message: 'Professional not found'
        });
      }

      const existing = await Favorite.findOne({
        customer: userId,
        professional: professionalId
      });

      if (existing) {
        await Favorite.deleteOne({ _id: existing._id });
        return res.json({
          success: true,
          favorited: false,
          message: 'Removed from favorites'
        });
      }

      await Favorite.create({
        customer: userId,
        professional: professionalId
      });

      res.json({
        success: true,
        favorited: true,
        message: 'Added to favorites'
      });
    } catch (error) {
      console.error('Toggle favorite error:', error);
      res.status(500).json({
        success: false,
        message: 'Could not update favorite'
      });
    }
  }

  // PATCH /api/customer/notifications/:id/read
  static async markNotificationRead(req, res) {
    try {
      const notification = await Notification.findOneAndUpdate(
        { _id: req.params.id, user: req.user.id },
        { read: true },
        { new: true }
      );

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      res.json({
        success: true,
        data: notification
      });
    } catch (error) {
      console.error('Mark notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Could not update notification'
      });
    }
  }

  // POST /api/customer/conversations/:professionalId/messages
 // controllers/customerController.js - Update sendMessage
static async sendMessage(req, res) {
    try {
      const { professionalId } = req.params;
      const { text } = req.body;
      const userId = req.user.id;

      if (!text?.trim()) {
        return res.status(400).json({ success: false, message: 'Message cannot be empty' });
      }

      // Filter message for contact info
      const MessageFilter = require('../middleware/messageFilter');
      const filterResult = MessageFilter.filterMessage(text);

      if (!filterResult.isClean) {
        return res.status(400).json({
          success: false,
          message: 'Contact information detected',
          warning: filterResult.warning,
          violations: filterResult.violations
        });
      }

      // Verify the professional exists
      const professional = await ServiceProvider.findById(professionalId).select('user companyName');
      if (!professional) {
        return res.status(404).json({
          success: false,
          message: 'Professional not found'
        });
      }

      // Find or create conversation
      let conversation = await Conversation.findOne({
        customer: userId,
        professional: professionalId
      });

      if (!conversation) {
        conversation = await Conversation.create({
          customer: userId,
          professional: professionalId,
          messages: []
        });
      }

      // Add message
      conversation.messages.push({
        sender: userId,
        senderModel: 'User',
        text: text.trim()
      });

      conversation.lastMessageAt = new Date();
      conversation.customerUnread = false;
      conversation.providerUnread = true;

      await conversation.save();

      const savedMessage = conversation.messages[conversation.messages.length - 1].toObject();
      if (professional.user) {
        emitNewMessage({
          conversationId: conversation._id,
          recipientUserId: professional.user,
          message: { ...savedMessage, senderName: req.user.fullName },
          senderName: req.user.fullName
        });
      }

      res.json({
        success: true,
        message: 'Message sent successfully',
        data: {
          conversationId: conversation._id,
          messageId: savedMessage._id,
          text: text.trim(),
          time: new Date()
        }
      });

    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({ success: false, message: 'Failed to send message' });
    }
  }

  static _computeProfileCompletion(user) {
    const fields = ['fullName', 'email', 'phone', 'isEmailVerified'];
    const filled = fields.filter(f => Boolean(user[f])).length;
    return Math.round((filled / fields.length) * 100);
  }

  // Add these methods to customerController.js

// GET /api/customer/messages  – list of conversations
static async getMessages(req, res) {
  try {
    const userId = req.user.id;

    const conversations = await Conversation.find({ customer: userId })
      .sort({ lastMessageAt: -1 })
      .populate({
        path: 'professional',
        model: 'ServiceProvider',
        populate: { path: 'user', model: 'User', select: 'fullName' }
      })
      .lean();

    const formatted = conversations
      .filter(c => c.professional)
      .map(conv => {
        const last = conv.messages?.length
          ? conv.messages[conv.messages.length - 1]
          : null;

        return {
          id: conv._id.toString(),
          professionalId: conv.professional._id.toString(),
          name: conv.professional.user?.fullName || conv.professional.companyName || 'Unknown',
          trade: conv.professional.serviceType || 'General Service',
          lastMessage: last?.text || '',
          lastMessageTime: conv.lastMessageAt,
          preview: last?.text || '',
          time: conv.lastMessageAt,
          unread: conv.customerUnread || false,
          contactUnlocked: conv.contactUnlocked || false
        };
      });

    res.json({ success: true, data: formatted });
  } catch (error) {
    console.error('Customer getMessages error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch messages' });
  }
}

// GET /api/customer/messages/:conversationId  – full messages (quotes included)
static async getConversation(req, res) {
  try {
    const { conversationId } = req.params;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      customer: req.user.id
    })
      .populate({
        path: 'professional',
        model: 'ServiceProvider',
        populate: { path: 'user', model: 'User', select: 'fullName' }
      })
      .lean();   // plain objects – no Mongoose stripping

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    // mark read (needs a separate non-lean update)
    await Conversation.updateOne(
      { _id: conversationId, customer: req.user.id },
      { $set: { customerUnread: false } }
    );

    const messages = (conversation.messages || []).map(msg => ({
      _id: msg._id?.toString(),
      id: msg._id?.toString(),
      text: msg.text || '',
      sender: msg.sender?.toString?.() || String(msg.sender),
      senderModel: msg.senderModel,
      messageType: msg.messageType || 'text',   // ← must be present
      quote: msg.quote || null,                 // ← must be present
      payment: msg.payment || null,
      booking: msg.booking || null,
      read: msg.read || false,
      createdAt: msg.createdAt
    }));

    console.log('📨 CUSTOMER getConversation →', messages.map(m => ({
      type: m.messageType,
      hasQuote: !!m.quote,
      text: (m.text || '').substring(0, 40)
    })));

    res.json({
      success: true,
      data: {
        id: conversation._id.toString(),
        professionalId: conversation.professional?._id?.toString(),
        name: conversation.professional?.user?.fullName || conversation.professional?.companyName,
        companyName: conversation.professional?.companyName,
        trade: conversation.professional?.serviceType,
        contactUnlocked: conversation.contactUnlocked || false,
        messages
      }
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch conversation' });
  }
}
  // GET /api/customer/messages/:conversationId/contact
  // Only returns the provider's phone/email once a payment on this
  // conversation has unlocked contact info server-side (see paymentController).
  static async getConversationContact(req, res) {
    try {
      const { conversationId } = req.params;
      const conversation = await Conversation.findOne({
        _id: conversationId,
        customer: req.user.id
      }).populate({
        path: 'professional',
        model: 'ServiceProvider',
        populate: { path: 'user', model: 'User', select: 'fullName email phone' }
      });

      if (!conversation) {
        return res.status(404).json({ success: false, message: 'Conversation not found' });
      }

      if (!conversation.contactUnlocked) {
        return res.status(403).json({
          success: false,
          message: 'Contact information unlocks once a quote on this conversation has been paid for.'
        });
      }

      res.json({
        success: true,
        data: {
          name: conversation.professional?.user?.fullName || conversation.professional?.companyName,
          phone: conversation.professional?.user?.phone || '',
          email: conversation.professional?.user?.email || ''
        }
      });
    } catch (error) {
      console.error('Get conversation contact error:', error);
      res.status(500).json({ success: false, message: 'Failed to load contact information' });
    }
  }

  // GET /api/customer/notifications
  static async getNotifications(req, res) {
    try {
      const notifications = await Notification.find({ 
        user: req.user.id 
      }).sort({ createdAt: -1 }).limit(50);

      res.json({
        success: true,
        data: notifications.map(n => ({
          id: n._id.toString(),
          text: n.text || '',
          time: n.createdAt,
          kind: n.kind || 'info',
          read: n.read || false
        }))
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
    }
  }


  // controllers/customerController.js - rejectQuote
static async rejectQuote(req, res) {
    try {
      const { conversationId, messageId } = req.params;
      const { reason } = req.body;
      const userId = req.user.id;

      const conversation = await Conversation.findOne({ _id: conversationId, customer: userId });
      if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found' });

      const message = conversation.messages.id(messageId);
      if (!message || message.messageType !== 'quote') return res.status(404).json({ success: false, message: 'Quote not found' });

      message.quote.status = 'rejected';
      message.quote.rejectedAt = new Date();
      message.quote.rejectionReason = reason || 'No reason provided';

      conversation.messages.push({
        sender: userId,
        senderModel: 'User',
        text: `❌ Quote declined. Reason: ${reason || 'Not specified'}`,
        messageType: 'quote_rejected',
        quote: message.quote,
        createdAt: new Date()
      });

      conversation.lastMessageAt = new Date();
      conversation.bookingStatus = 'cancelled';
      conversation.providerUnread = true;
      await conversation.save();

      // conversation.professional is a ServiceProvider id, not a User id -
      // Notification.user references User, so resolve it first.
      const provider = await ServiceProvider.findById(conversation.professional);
      if (provider) {
        await notifyUser(provider.user, {
          text: `❌ A customer declined your quote of ₦${message.quote.totalAmount?.toLocaleString()}. Reason: ${reason || 'Not specified'}`,
          kind: 'action',
          relatedConversation: conversation._id
        });
      }

      res.json({ success: true, message: 'Quote declined.' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to reject quote' });
    }
  }

}

module.exports = CustomerController;