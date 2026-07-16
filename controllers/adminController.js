// controllers/adminController.js
const Admin = require('../models/Admin');
const User = require('../models/User');
const ServiceProvider = require('../models/ServiceProvider');
const Conversation = require('../models/Conversation');
const JWTService = require('../config/jwt');
// controllers/adminController.js - Add at the top
const Notification = require('../models/Notification'); // ✅ Add this

class AdminController {
  
 // controllers/adminController.js - Update login
static async login(req, res) {
    try {
      const { email, password } = req.body;
      const admin = await Admin.findOne({ email: email.toLowerCase() }).select('+password');
      
      if (!admin || !(await admin.comparePassword(password))) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      if (!admin.isActive) {
        return res.status(403).json({ success: false, message: 'Account deactivated' });
      }

      // Update last login
      admin.lastLogin = new Date();
      await admin.save();

      // Generate token WITH accountType: 'admin'
      const token = JWTService.generateToken({
        _id: admin._id,
        id: admin._id,
        email: admin.email,
        accountType: 'admin',  // This is important!
        fullName: admin.fullName,
        role: admin.role
      });

      res.json({
        success: true,
        token,
        admin: {
          id: admin._id,
          fullName: admin.fullName,
          email: admin.email,
          role: admin.role
        }
      });
    } catch (error) {
      console.error('Admin login error:', error);
      res.status(500).json({ success: false, message: 'Login failed' });
    }
  }

  // GET /api/admin/dashboard
// controllers/adminController.js - Fix getDashboard
static async getDashboard(req, res) {
    try {
      const [totalUsers, totalProviders, totalCustomers, totalConversations, recentProviders, recentUsers] = await Promise.all([
        User.countDocuments({ accountType: { $ne: 'admin' } }),
        ServiceProvider.countDocuments(),
        User.countDocuments({ accountType: 'customer' }),
        Conversation.countDocuments(),
        ServiceProvider.find().sort({ createdAt: -1 }).limit(5).populate('user', 'fullName email'),
        User.find({ accountType: { $ne: 'admin' } }).sort({ createdAt: -1 }).limit(5)
      ]);

      // Use verificationStatus instead of isVerified
      const pendingVerifications = await ServiceProvider.countDocuments({ 
        verificationStatus: 'submitted' 
      });

      res.json({
        success: true,
        data: {
          stats: {
            totalUsers,
            totalProviders,
            totalCustomers,
            totalConversations,
            pendingVerifications,
            verifiedProviders: totalProviders - pendingVerifications
          },
          recentProviders: recentProviders.map(p => ({
            id: p._id,
            companyName: p.companyName,
            fullName: p.user?.fullName,
            email: p.user?.email,
            serviceType: p.serviceType,
            verificationStatus: p.verificationStatus, // ✅ Use this instead of isVerified
            isVisible: p.isVisible,
            city: p.city,
            state: p.state,
            createdAt: p.createdAt
          })),
          recentUsers: recentUsers.map(u => ({
            id: u._id,
            fullName: u.fullName,
            email: u.email,
            accountType: u.accountType,
            isEmailVerified: u.isEmailVerified,
            createdAt: u.createdAt
          }))
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
  // GET /api/admin/users
  static async getUsers(req, res) {
    try {
      const { page = 1, limit = 20, search, accountType } = req.query;
      const filter = {};
      if (search) filter.$or = [{ fullName: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }];
      if (accountType) filter.accountType = accountType;

      const [users, total] = await Promise.all([
        User.find(filter).sort({ createdAt: -1 }).skip((page-1)*limit).limit(parseInt(limit)),
        User.countDocuments(filter)
      ]);

      res.json({ success: true, data: users, pagination: { total, page: parseInt(page), pages: Math.ceil(total/limit) } });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // GET /api/admin/providers
// controllers/adminController.js - Fix getProviders
static async getProviders(req, res) {
    try {
      const { page = 1, limit = 20, search, verificationStatus } = req.query;
      const filter = {};
      
      if (search) {
        filter.$or = [
          { companyName: { $regex: search, $options: 'i' } }, 
          { serviceType: { $regex: search, $options: 'i' } }
        ];
      }
      
      if (verificationStatus && verificationStatus !== 'all') {
        filter.verificationStatus = verificationStatus;
      }

      console.log('Provider filter:', filter);

      const [providers, total] = await Promise.all([
        ServiceProvider.find(filter)
          .sort({ createdAt: -1 })
          .skip((parseInt(page)-1) * parseInt(limit))
          .limit(parseInt(limit))
          .populate('user', 'fullName email phone'),
        ServiceProvider.countDocuments(filter)
      ]);

      res.json({ 
        success: true, 
        data: providers, 
        pagination: { 
          total, 
          page: parseInt(page), 
          pages: Math.ceil(total / parseInt(limit)) 
        } 
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // PATCH /api/admin/providers/:id/verify
  static async verifyProvider(req, res) {
    try {
      const provider = await ServiceProvider.findByIdAndUpdate(req.params.id, { isVerified: true }, { new: true });
      if (!provider) return res.status(404).json({ success: false, message: 'Provider not found' });
      res.json({ success: true, message: 'Provider verified', data: provider });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // PATCH /api/admin/users/:id/toggle-status
  static async toggleUserStatus(req, res) {
    try {
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      user.isActive = !user.isActive;
      await user.save();
      res.json({ success: true, message: `User ${user.isActive ? 'activated' : 'deactivated'}`, data: user });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // DELETE /api/admin/users/:id
  static async deleteUser(req, res) {
    try {
      await User.findByIdAndDelete(req.params.id);
      await ServiceProvider.findOneAndDelete({ user: req.params.id });
      res.json({ success: true, message: 'User deleted' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // controllers/adminController.js - Add these methods

// PATCH /api/admin/providers/:id/approve
// controllers/adminController.js - Update approveProvider
static async approveProvider(req, res) {
    try {
      const provider = await ServiceProvider.findByIdAndUpdate(
        req.params.id,
        { 
          $set: { 
            verificationStatus: 'approved', 
            isVisible: true,
            verifiedAt: new Date()
          } 
        },
        { new: true }
      ).populate('user', 'email fullName');

      if (!provider) {
        return res.status(404).json({ success: false, message: 'Provider not found' });
      }

      // Create notification
      await Notification.create({
        user: provider.user._id,
        text: '🎉 Congratulations! Your profile has been approved and is now visible to customers.',
        kind: 'success'
      });

      // Send approval email
      try {
        const emailService = require('../services/emailService');
        await emailService.sendApprovalEmail(provider.user, provider);
        console.log('Approval email sent to:', provider.user.email);
      } catch (emailError) {
        console.error('Failed to send approval email:', emailError);
        // Don't fail the request if email fails
      }

      res.json({ success: true, message: 'Provider approved and notified', data: provider });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // PATCH /api/admin/providers/:id/reject
  static async rejectProvider(req, res) {
    try {
      const { reason } = req.body;
      
      if (!reason?.trim()) {
        return res.status(400).json({ success: false, message: 'Rejection reason is required' });
      }

      const provider = await ServiceProvider.findByIdAndUpdate(
        req.params.id,
        { 
          $set: { 
            verificationStatus: 'rejected',
            rejectionReason: reason.trim(),
            rejectionDate: new Date(),
            isVisible: false
          } 
        },
        { new: true }
      ).populate('user', 'email fullName');

      if (!provider) {
        return res.status(404).json({ success: false, message: 'Provider not found' });
      }

      // Create notification
      await Notification.create({
        user: provider.user._id,
        text: `❌ Your profile was not approved. Reason: ${reason}. You can update and resubmit.`,
        kind: 'action'
      });

      // Send rejection email
      try {
        const emailService = require('../services/emailService');
        await emailService.sendRejectionEmail(provider.user, provider, reason);
        console.log('Rejection email sent to:', provider.user.email);
      } catch (emailError) {
        console.error('Failed to send rejection email:', emailError);
        // Don't fail the request if email fails
      }

      res.json({ success: true, message: 'Provider rejected and notified', data: provider });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = AdminController;