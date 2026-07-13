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

      const recentPros = recentConvos
        .filter(c => c.professional)
        .map(c => {
          const pro = c.professional;
          return {
            id: pro._id.toString(),
            name: pro.user?.fullName || pro.companyName || 'Unknown Pro',
            trade: pro.serviceType || 'General Service',
            location: [pro.city, pro.state].filter(Boolean).join(', ') || 'Nigeria',
            city: pro.city || '',
            state: pro.state || '',
            rating: pro.rating || 0,
            jobs: pro.completedJobs || 0,
            years: pro.yearsOfExperience || 0,
            status: pro.isAvailable ? 'Available now' : 'Currently Unavailable',
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
  static async searchProfessionals(req, res) {
    try {
      const { category, state, city, page = 1, limit = 20 } = req.query;

      const filter = { isAvailable: true };

      if (category && category.trim()) {
        filter.serviceType = { $regex: category.trim(), $options: 'i' };
      }

      if (state && state.trim()) {
        filter.state = { $regex: state.trim(), $options: 'i' };
      }

      if (city && city.trim()) {
        filter.city = { $regex: city.trim(), $options: 'i' };
      }

      console.log('Search filters:', filter);

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [providers, total] = await Promise.all([
        ServiceProvider.find(filter)
          .populate('user', 'fullName email phone')
          .sort({ rating: -1, completedJobs: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        ServiceProvider.countDocuments(filter)
      ]);

      // Get user's favorites to mark them
      const userFavorites = req.user ? 
        await Favorite.find({ customer: req.user.id }).select('professional') : 
        [];
      
      const favoriteIds = new Set(
        userFavorites.map(f => f.professional.toString())
      );

      const results = providers.map(provider => ({
        id: provider._id.toString(),
        name: provider.user?.fullName || provider.companyName || 'Unknown Pro',
        companyName: provider.companyName || '',
        trade: provider.serviceType || 'General',
        location: [provider.city, provider.state].filter(Boolean).join(', ') || 'Nigeria',
        city: provider.city || '',
        state: provider.state || '',
        rating: provider.rating || 0,
        jobs: provider.completedJobs || 0,
        years: provider.yearsOfExperience || 0,
        status: provider.isAvailable ? 'Available now' : 'Currently Unavailable',
        isVerified: provider.isVerified || false,
        profileImage: provider.profileImage || null,
        tagline: provider.tagline || '',
        isFavorited: favoriteIds.has(provider._id.toString())
      }));

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
  static async sendMessage(req, res) {
    try {
      const { professionalId } = req.params;
      const { text } = req.body;
      const userId = req.user.id;

      if (!text?.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Message text is required'
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

      conversation.messages.push({
        sender: userId,
        senderModel: 'User',
        text: text.trim()
      });
      
      conversation.lastMessageAt = new Date();
      conversation.customerUnread = false;
      conversation.providerUnread = true;

      await conversation.save();

      // Populate the professional for the response
      await conversation.populate({
        path: 'professional',
        model: 'ServiceProvider',
        populate: {
          path: 'user',
          model: 'User',
          select: 'fullName'
        }
      });

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

  static _computeProfileCompletion(user) {
    const fields = ['fullName', 'email', 'phone', 'isEmailVerified'];
    const filled = fields.filter(f => Boolean(user[f])).length;
    return Math.round((filled / fields.length) * 100);
  }
}

module.exports = CustomerController;