// controllers/providerController.js - FIXED (no duplicates)
const ServiceProvider = require('../models/ServiceProvider');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Notification = require('../models/Notification');
const MessageFilter = require('../middleware/messageFilter');

class ProviderController {
  
  // GET /api/provider/dashboard
// GET /api/provider/dashboard
static async getDashboard(req, res) {
  try {
    const userId = req.user.id;
    const provider = await ServiceProvider.findOne({ user: userId });
    if (!provider) return res.status(404).json({ success: false, message: 'Provider profile not found' });

    const user = await User.findById(userId);
    const recentConversations = await Conversation.find({ professional: provider._id }) // ✅ fixed
      .sort({ lastMessageAt: -1 }).limit(5).populate('customer', 'fullName');
    const notifications = await Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(10);

    res.json({
      success: true,
      data: {
        providerName: user.fullName?.split(' ')[0] || 'Pro',
        companyName: provider.companyName,
        profileCompletion: provider.profileCompletionScore || 0,
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
static async getMessages(req, res) {
  try {
    const userId = req.user.id;
    const provider = await ServiceProvider.findOne({ user: userId }); // ✅ added
    if (!provider) return res.status(404).json({ success: false, message: 'Provider profile not found' });

    const conversations = await Conversation.find({ professional: provider._id }) // ✅ fixed
      .sort({ lastMessageAt: -1 }).populate('customer', 'fullName email');

    const formattedConversations = conversations.map(conv => ({
      id: conv._id.toString(),
      customerId: conv.customer?._id?.toString(),
      customerName: conv.customer?.fullName || 'Customer',
      preview: conv.messages[conv.messages.length - 1]?.text || '',
      time: conv.lastMessageAt,
      unread: conv.providerUnread || false,
      messages: conv.messages
    }));

    res.json({ success: true, data: formattedConversations });
  } catch (error) {
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

    res.json({ success: true, message: 'Message sent', conversationId: conversation._id });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

  // PUT /api/provider/profile
  static async updateProfile(req, res) {
    try {
      const provider = await ServiceProvider.findOneAndUpdate({ user: req.user.id }, { $set: req.body }, { new: true });
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
      const provider = await ServiceProvider.findOneAndUpdate({ user: req.user.id }, { $set: { businessAddress } }, { new: true });
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