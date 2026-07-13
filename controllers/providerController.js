// controllers/providerController.js
const ServiceProvider = require('../models/ServiceProvider');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Notification = require('../models/Notification');

class ProviderController {
  // GET /api/provider/dashboard
  static async getDashboard(req, res) {
    try {
      const userId = req.user.id;

      // Get provider profile
      const provider = await ServiceProvider.findOne({ user: userId });
      
      if (!provider) {
        return res.status(404).json({
          success: false,
          message: 'Provider profile not found'
        });
      }

      const user = await User.findById(userId);

      // Get recent conversations
      const recentConversations = await Conversation.find({
        professional: userId
      })
      .sort({ lastMessageAt: -1 })
      .limit(5)
      .populate('customer', 'fullName');

      const recentMessages = recentConversations.map(conv => ({
        id: conv._id,
        customerName: conv.customer?.fullName || 'Unknown',
        preview: conv.messages[conv.messages.length - 1]?.text || '',
        time: conv.lastMessageAt,
        unread: conv.providerUnread || false
      }));

      // Get notifications
      const notifications = await Notification.find({
        user: userId
      }).sort({ createdAt: -1 }).limit(10);

      res.json({
        success: true,
        data: {
          providerName: user.fullName?.split(' ')[0] || 'Pro',
          companyName: provider.companyName,
          profileCompletion: provider.profileCompletionScore || 0,
          activeJobs: [],
          recentMessages,
          notifications: notifications.map(n => ({
            id: n._id,
            text: n.text,
            time: n.createdAt,
            kind: n.kind,
            read: n.read
          })),
          stats: {
            activeJobs: 0,
            completedJobs: provider.completedJobs || 0,
            rating: provider.rating || 0,
            responseRate: provider.responseRate || 0
          }
        }
      });

    } catch (error) {
      console.error('Provider dashboard error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to load provider dashboard'
      });
    }
  }

  // PUT /api/provider/profile
  static async updateProfile(req, res) {
    try {
      const userId = req.user.id;
      const updateData = req.body;

      const provider = await ServiceProvider.findOneAndUpdate(
        { user: userId },
        { $set: updateData },
        { new: true, runValidators: true }
      );

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: provider
      });
    } catch (error) {
      console.error('Profile update error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update profile'
      });
    }
  }

  // PUT /api/provider/profile/basic
  static async updateBasicInfo(req, res) {
    try {
      const userId = req.user.id;
      const { companyName, businessDescription, tagline, yearsOfExperience, teamSize } = req.body;

      const provider = await ServiceProvider.findOneAndUpdate(
        { user: userId },
        { 
          $set: {
            companyName,
            businessDescription,
            tagline,
            yearsOfExperience,
            teamSize
          }
        },
        { new: true, runValidators: true }
      );

      res.json({
        success: true,
        message: 'Basic info updated',
        data: provider
      });
    } catch (error) {
      console.error('Basic info update error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update basic info'
      });
    }
  }

  // PUT /api/provider/profile/business
  static async updateBusinessInfo(req, res) {
    try {
      const userId = req.user.id;
      const { businessAddress, phone } = req.body;

      const provider = await ServiceProvider.findOneAndUpdate(
        { user: userId },
        { 
          $set: { businessAddress }
        },
        { new: true, runValidators: true }
      );

      // Also update phone in User model
      if (phone) {
        await User.findByIdAndUpdate(userId, { phone });
      }

      res.json({
        success: true,
        message: 'Business info updated',
        data: provider
      });
    } catch (error) {
      console.error('Business info update error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update business info'
      });
    }
  }

  // PUT /api/provider/profile/services
  static async updateServices(req, res) {
    try {
      const userId = req.user.id;
      const { servicesOffered } = req.body;

      const provider = await ServiceProvider.findOneAndUpdate(
        { user: userId },
        { $set: { servicesOffered } },
        { new: true, runValidators: true }
      );

      res.json({
        success: true,
        message: 'Services updated',
        data: provider
      });
    } catch (error) {
      console.error('Services update error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update services'
      });
    }
  }

  // PUT /api/provider/profile/hours
  static async updateBusinessHours(req, res) {
    try {
      const userId = req.user.id;
      const { businessHours } = req.body;

      const provider = await ServiceProvider.findOneAndUpdate(
        { user: userId },
        { $set: { businessHours } },
        { new: true, runValidators: true }
      );

      res.json({
        success: true,
        message: 'Business hours updated',
        data: provider
      });
    } catch (error) {
      console.error('Business hours update error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update business hours'
      });
    }
  }

  // PUT /api/provider/profile/social
  static async updateSocialLinks(req, res) {
    try {
      const userId = req.user.id;
      const { socialLinks } = req.body;

      const provider = await ServiceProvider.findOneAndUpdate(
        { user: userId },
        { $set: { socialLinks } },
        { new: true, runValidators: true }
      );

      res.json({
        success: true,
        message: 'Social links updated',
        data: provider
      });
    } catch (error) {
      console.error('Social links update error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update social links'
      });
    }
  }

  // PATCH /api/provider/availability
  static async updateAvailability(req, res) {
    try {
      const userId = req.user.id;
      const { isAvailable } = req.body;

      await ServiceProvider.findOneAndUpdate(
        { user: userId },
        { isAvailable }
      );

      res.json({
        success: true,
        message: `You are now ${isAvailable ? 'available' : 'unavailable'} for jobs`
      });
    } catch (error) {
      console.error('Availability update error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update availability'
      });
    }
  }

  // GET /api/provider/jobs
  static async getJobs(req, res) {
    try {
      const userId = req.user.id;
      
      // For now, return empty array until Job model is implemented
      res.json({
        success: true,
        data: []
      });
    } catch (error) {
      console.error('Get jobs error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch jobs'
      });
    }
  }

  // POST /api/provider/jobs/:jobId/respond
  static async respondToJob(req, res) {
    try {
      const { jobId } = req.params;
      const { response } = req.body;
      const userId = req.user.id;

      // Implement job response logic when Job model is ready
      res.json({
        success: true,
        message: `Job ${response}ed successfully`
      });
    } catch (error) {
      console.error('Respond to job error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to respond to job'
      });
    }
  }

  // GET /api/provider/messages
  static async getMessages(req, res) {
    try {
      const userId = req.user.id;
      
      const conversations = await Conversation.find({
        professional: userId
      })
      .sort({ lastMessageAt: -1 })
      .populate('customer', 'fullName email')
      .limit(50);

      const messages = conversations.map(conv => ({
        id: conv._id,
        customerName: conv.customer?.fullName,
        customerId: conv.customer?._id,
        preview: conv.messages[conv.messages.length - 1]?.text || '',
        time: conv.lastMessageAt,
        unread: conv.providerUnread || false,
        messages: conv.messages
      }));

      res.json({
        success: true,
        data: messages
      });
    } catch (error) {
      console.error('Get messages error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch messages'
      });
    }
  }

  // POST /api/provider/messages/:customerId
  static async sendMessage(req, res) {
    try {
      const { customerId } = req.params;
      const { text } = req.body;
      const userId = req.user.id;

      let conversation = await Conversation.findOne({ 
        customer: customerId, 
        professional: userId 
      });

      if (!conversation) {
        conversation = await Conversation.create({ 
          customer: customerId, 
          professional: userId, 
          messages: [] 
        });
      }

      conversation.messages.push({ 
        sender: userId, 
        senderModel: 'User', 
        text 
      });
      conversation.lastMessageAt = new Date();
      conversation.providerUnread = false;
      conversation.customerUnread = true;
      
      await conversation.save();

      res.json({ 
        success: true, 
        data: conversation 
      });
    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({
        success: false,
        message: 'Could not send message'
      });
    }
  }

  // GET /api/provider/notifications
  static async getNotifications(req, res) {
    try {
      const userId = req.user.id;
      
      const notifications = await Notification.find({ 
        user: userId 
      })
      .sort({ createdAt: -1 })
      .limit(20);

      res.json({
        success: true,
        data: notifications.map(n => ({
          id: n._id,
          text: n.text,
          time: n.createdAt,
          kind: n.kind,
          read: n.read
        }))
      });
    } catch (error) {
      console.error('Get notifications error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch notifications'
      });
    }
  }

  // PATCH /api/provider/notifications/:id/read
  static async markNotificationRead(req, res) {
    try {
      const userId = req.user.id;
      
      await Notification.findOneAndUpdate(
        { _id: req.params.id, user: userId },
        { read: true }
      );

      res.json({ success: true });
    } catch (error) {
      console.error('Mark notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Could not update notification'
      });
    }
  }
}

module.exports = ProviderController;