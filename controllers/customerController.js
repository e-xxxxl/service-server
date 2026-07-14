// controllers/customerController.js - UPDATED
const ServiceProvider = require('../models/ServiceProvider');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Notification = require('../models/Notification');
const Favorite = require('../models/Favorite');

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
              select: 'fullName email phone'
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
const recentPros = recentConvos
  .filter(c => c.professional)
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
      isVerified: pro.isVerified || false,
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
static async searchProfessionals(req, res) {
    try {
      const { category, state, city, page = 1, limit = 20 } = req.query;
      
      console.log('Search request:', { category, state, city });
      
      const filter = { isAvailable: true };
      
      if (category && category.trim()) {
        filter.serviceType = { $regex: category.trim(), $options: 'i' };
      }
      
      if (state && state.trim()) {
        // Search in both top-level state and serviceArea.state
        filter.$or = [
          { state: { $regex: state.trim(), $options: 'i' } },
          { 'serviceArea.state': { $regex: state.trim(), $options: 'i' } }
        ];
      }
      
      if (city && city.trim()) {
        // If we already have $or from state, we need to handle this differently
        const cityFilter = {
          $or: [
            { city: { $regex: city.trim(), $options: 'i' } },
            { 'serviceArea.city': { $regex: city.trim(), $options: 'i' } }
          ]
        };
        
        if (filter.$or) {
          // Combine state and city filters
          filter.$and = [
            { $or: filter.$or },
            cityFilter
          ];
          delete filter.$or;
        } else {
          filter.$or = cityFilter.$or;
        }
      }
      
      console.log('Search filter:', JSON.stringify(filter, null, 2));
      
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      const [providers, total] = await Promise.all([
        ServiceProvider.find(filter)
          .populate('user', 'fullName email phone')
          .sort({ rating: -1, completedJobs: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        ServiceProvider.countDocuments(filter)
      ]);
      
      console.log(`Found ${providers.length} providers out of ${total} total`);
      
      // Format results
      const results = providers.map(provider => ({
        id: provider._id.toString(),
        fullName: provider.user?.fullName || provider.companyName || 'Unknown',
        name: provider.user?.fullName || provider.companyName || 'Unknown Pro',
        companyName: provider.companyName || '',
        trade: provider.serviceType || 'General',
        serviceType: provider.serviceType || '',
        // Get location from top-level fields first, fallback to serviceArea
        city: provider.city || provider.serviceArea?.[0]?.city || '',
        state: provider.state || provider.serviceArea?.[0]?.state || '',
        location: [
          provider.city || provider.serviceArea?.[0]?.city,
          provider.state || provider.serviceArea?.[0]?.state
        ].filter(Boolean).join(', ') || 'Location not specified',
        rating: provider.rating || 0,
        jobs: provider.completedJobs || 0,
        years: provider.yearsOfExperience || 0,
        status: provider.isAvailable ? 'Available now' : 'Currently Unavailable',
        isVerified: provider.isVerified || false,
        tagline: provider.tagline || '',
        isFavorited: false // Will be updated below
      }));
      
      // Mark favorites
      if (req.user) {
        const userFavorites = await Favorite.find({ 
          customer: req.user.id,
          professional: { $in: providers.map(p => p._id) }
        }).select('professional');
        
        const favoriteIds = new Set(userFavorites.map(f => f.professional.toString()));
        
        results.forEach(result => {
          result.isFavorited = favoriteIds.has(result.id);
        });
      }
      
      res.json({
        success: true,
        data: results,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          limit: parseInt(limit)
        }
      });
      
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Search failed',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
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
      const professional = await ServiceProvider.findById(professionalId);
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

      res.json({
        success: true,
        message: 'Message sent successfully',
        data: {
          conversationId: conversation._id,
          messageId: conversation.messages[conversation.messages.length - 1]._id,
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

// GET /api/customer/messages
static async getMessages(req, res) {
    try {
      const userId = req.user.id;
      
      const conversations = await Conversation.find({
        customer: userId
      })
      .sort({ lastMessageAt: -1 })
      .populate({
        path: 'professional',
        model: 'ServiceProvider',
        populate: {
          path: 'user',
          model: 'User',
          select: 'fullName'
        }
      });

      const formattedConversations = conversations.map(conv => ({
        id: conv._id.toString(),
        professionalId: conv.professional?._id.toString(),
        name: conv.professional?.user?.fullName || conv.professional?.companyName || 'Unknown',
        companyName: conv.professional?.companyName,
        trade: conv.professional?.serviceType,
        lastMessage: conv.messages[conv.messages.length - 1]?.text || '',
        lastMessageTime: conv.lastMessageAt,
        unread: conv.customerUnread || false,
        messageCount: conv.messages.length
      }));

      res.json({
        success: true,
        data: formattedConversations
      });
    } catch (error) {
      console.error('Get messages error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch messages' });
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

  // GET /api/customer/messages/:conversationId
  static async getConversation(req, res) {
    try {
      const { conversationId } = req.params;
      
      const conversation = await Conversation.findOne({
        _id: conversationId,
        customer: req.user.id
      }).populate({
        path: 'professional',
        model: 'ServiceProvider',
        populate: {
          path: 'user',
          model: 'User',
          select: 'fullName'
        }
      });

      if (!conversation) {
        return res.status(404).json({ success: false, message: 'Conversation not found' });
      }

      // Mark as read
      conversation.customerUnread = false;
      await conversation.save();

      res.json({
        success: true,
        data: {
          id: conversation._id.toString(),
          professionalId: conversation.professional?._id.toString(),
          name: conversation.professional?.user?.fullName || conversation.professional?.companyName,
          companyName: conversation.professional?.companyName,
          messages: conversation.messages.map(msg => ({
            id: msg._id.toString(),
            text: msg.text,
            sender: msg.sender.toString(),
            senderModel: msg.senderModel,
            time: msg.createdAt,
            read: msg.read
          }))
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch conversation' });
    }
  }

  // POST /api/customer/messages/:professionalId
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

      // If violations found, reject the message
      if (!filterResult.isClean) {
        return res.status(400).json({
          success: false,
          message: 'Contact information detected',
          warning: filterResult.warning,
          violations: filterResult.violations
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

      res.json({
        success: true,
        message: 'Message sent successfully',
        data: {
          messageId: conversation.messages[conversation.messages.length - 1]._id,
          text: text.trim(),
          time: new Date()
        }
      });

    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({ success: false, message: 'Failed to send message' });
    }
  }

}

module.exports = CustomerController;