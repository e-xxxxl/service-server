// controllers/adminController.js - COMPLETE FIXED VERSION
const Admin = require('../models/Admin');
const User = require('../models/User');
const ServiceProvider = require('../models/ServiceProvider');
const Conversation = require('../models/Conversation');
const Notification = require('../models/Notification');
const JWTService = require('../config/jwt');

class AdminController {

  static async login(req, res) {
    try {
      const { email, password } = req.body;
      const admin = await Admin.findOne({ email: email.toLowerCase() }).select('+password');
      if (!admin || !(await admin.comparePassword(password))) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }
      if (!admin.isActive) return res.status(403).json({ success: false, message: 'Account deactivated' });
      admin.lastLogin = new Date();
      await admin.save();
      const token = JWTService.generateToken({ _id: admin._id, id: admin._id, email: admin.email, accountType: 'admin', fullName: admin.fullName, role: admin.role });
      res.json({ success: true, token, admin: { id: admin._id, fullName: admin.fullName, email: admin.email, role: admin.role } });
    } catch (error) { res.status(500).json({ success: false, message: 'Login failed' }); }
  }

  // ✅ FIXED: Accurate dashboard stats
// controllers/adminController.js - FIXED getDashboard
// controllers/adminController.js - FIXED getDashboard with correct stats
static async getDashboard(req, res) {
    try {
      const [
        totalVerifiedUsers,
        totalCustomers,
        totalProviders,
        totalProviderDocs,
        totalConversations,
        pendingVerifications,
        approvedProviders,
        recentProviders,
        recentUsers
      ] = await Promise.all([
        // ✅ Only verified users (email confirmed)
        User.countDocuments({ isEmailVerified: true, accountType: { $ne: 'admin' } }),
        // ✅ Verified customers only
        User.countDocuments({ accountType: 'customer', isEmailVerified: true }),
        // ✅ Verified providers (User model)
        User.countDocuments({ accountType: 'provider', isEmailVerified: true }),
        // ✅ All ServiceProvider documents
        ServiceProvider.countDocuments(),
        Conversation.countDocuments(),
        // ✅ Pending verification
        ServiceProvider.countDocuments({ verificationStatus: 'submitted' }),
        // ✅ Approved
        ServiceProvider.countDocuments({ verificationStatus: 'approved' }),
        // Recent
        ServiceProvider.find({ verificationStatus: { $in: ['submitted', 'approved', 'rejected'] } })
          .sort({ createdAt: -1 }).limit(5).populate('user', 'fullName email'),
        User.find({ isEmailVerified: true, accountType: { $ne: 'admin' } })
          .sort({ createdAt: -1 }).limit(5)
      ]);

      res.json({
        success: true,
        data: {
          stats: {
            totalUsers: totalVerifiedUsers,
            totalCustomers: totalCustomers,
            totalProviders: totalProviders,
            totalProviderDocs: totalProviderDocs,
            totalConversations,
            pendingVerifications,
            verifiedProviders: approvedProviders
          },
          recentProviders: recentProviders.map(p => ({
            id: p._id, companyName: p.companyName, fullName: p.user?.fullName,
            email: p.user?.email, serviceType: p.serviceType,
            verificationStatus: p.verificationStatus, isVisible: p.isVisible,
            city: p.city, state: p.state, createdAt: p.createdAt
          })),
          recentUsers: recentUsers.map(u => ({
            id: u._id, fullName: u.fullName, email: u.email,
            accountType: u.accountType, isEmailVerified: u.isEmailVerified, createdAt: u.createdAt
          }))
        }
      });
    } catch (error) { 
      res.status(500).json({ success: false, message: error.message }); 
    }
  }

  // ✅ FIXED: Users list with proper filters
// controllers/adminController.js - FIXED getUsers
static async getUsers(req, res) {
    try {
      const { page = 1, limit = 20, search, accountType } = req.query;
      
      // ✅ Only verified users with proper account types
      const filter = { 
        isEmailVerified: true,
        accountType: { $in: ['customer', 'provider'] } // Only customers and providers
      };
      
      if (search) {
        filter.$or = [
          { fullName: { $regex: search, $options: 'i' } }, 
          { email: { $regex: search, $options: 'i' } }
        ];
      }
      
      if (accountType && accountType !== 'all') {
        filter.accountType = accountType;
      }

      const [users, total] = await Promise.all([
        User.find(filter)
          .select('fullName email phone accountType isActive isEmailVerified createdAt lastLogin')
          .sort({ createdAt: -1 })
          .skip((parseInt(page) - 1) * parseInt(limit))
          .limit(parseInt(limit)),
        User.countDocuments(filter)
      ]);

      res.json({ 
        success: true, 
        data: users,
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

  // ✅ FIXED: Providers list with proper filters
// controllers/adminController.js - FIXED getProviders
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

      const [providers, total] = await Promise.all([
        ServiceProvider.find(filter)
          .sort({ createdAt: -1 })
          .skip((parseInt(page) - 1) * parseInt(limit))
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

  // ✅ FIXED: Approve with instant UI update and alert
 // controllers/adminController.js - approveProvider with instant update
static async approveProvider(req, res) {
    try {
      const provider = await ServiceProvider.findByIdAndUpdate(
        req.params.id,
        { $set: { verificationStatus: 'approved', isVisible: true, verifiedAt: new Date() } },
        { new: true }
      ).populate('user', 'email fullName');

      if (!provider) return res.status(404).json({ success: false, message: 'Provider not found' });

      // Create notification
      await Notification.create({
        user: provider.user._id,
        text: '🎉 Congratulations! Your profile has been approved and is now visible to customers.',
        kind: 'success'
      });

      // Try sending email
      try {
        const emailService = require('../services/emailService');
        await emailService.sendApprovalEmail(provider.user, provider);
      } catch (e) { console.error('Approval email failed:', e.message); }

      res.json({ 
        success: true, 
        message: 'Provider approved successfully!',
        data: {
          _id: provider._id,
          verificationStatus: 'approved',
          isVisible: true
        }
      });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  // ✅ Reject provider
  static async rejectProvider(req, res) {
    try {
      const { reason } = req.body;
      if (!reason?.trim()) return res.status(400).json({ success: false, message: 'Rejection reason is required' });

      const provider = await ServiceProvider.findByIdAndUpdate(
        req.params.id,
        { $set: { verificationStatus: 'rejected', rejectionReason: reason.trim(), rejectionDate: new Date(), isVisible: false } },
        { new: true }
      ).populate('user', 'email fullName');

      if (!provider) return res.status(404).json({ success: false, message: 'Provider not found' });

      await Notification.create({
        user: provider.user._id,
        text: `❌ Your profile was not approved. Reason: ${reason}. You can update and resubmit.`,
        kind: 'action'
      });

      try {
        const emailService = require('../services/emailService');
        await emailService.sendRejectionEmail(provider.user, provider, reason);
      } catch (e) { console.error('Email failed:', e.message); }

      res.json({ success: true, message: 'Provider rejected', data: provider });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  // ✅ Toggle user status
  static async toggleUserStatus(req, res) {
    try {
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      user.isActive = !user.isActive;
      await user.save();
      res.json({ success: true, message: `User ${user.isActive ? 'activated' : 'deactivated'}`, data: user });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  // ✅ Delete user
  static async deleteUser(req, res) {
    try {
      await User.findByIdAndDelete(req.params.id);
      await ServiceProvider.findOneAndDelete({ user: req.params.id });
      res.json({ success: true, message: 'User deleted' });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  // controllers/adminController.js - getAllQuotes
static async getAllQuotes(req, res) {
    try {
      const { status } = req.query;
      const filter = { 'messages.messageType': 'quote' };
      
      if (status === 'pending') filter.bookingStatus = 'quote_sent';
      if (status === 'accepted') filter.bookingStatus = 'payment_pending';
      if (status === 'confirmed') filter.bookingStatus = 'confirmed';
      if (status === 'completed') filter.bookingStatus = 'completed';

      const conversations = await Conversation.find(filter)
        .sort({ lastMessageAt: -1 })
        .limit(100)
        .populate('customer', 'fullName email phone')
        .populate({ path: 'professional', populate: { path: 'user', select: 'fullName email phone' } });

      const quotes = [];
      conversations.forEach(conv => {
        conv.messages.forEach(msg => {
          if (msg.messageType === 'quote' || msg.messageType === 'payment_requested' || msg.messageType === 'payment_confirmed') {
            quotes.push({
              conversationId: conv._id,
              messageId: msg._id,
              customer: { name: conv.customer?.fullName, email: conv.customer?.email },
              provider: { name: conv.professional?.companyName, service: conv.professional?.serviceType },
              quote: msg.quote,
              payment: msg.payment,
              booking: msg.booking,
              status: msg.quote?.status || 'pending',
              bookingStatus: conv.bookingStatus,
              amount: msg.quote?.totalAmount || msg.payment?.amount,
              createdAt: msg.createdAt,
              updatedAt: conv.lastMessageAt
            });
          }
        });
      });

      res.json({ success: true, data: quotes.reverse() });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // controllers/adminController.js - ADD THESE NEW METHODS

// ✅ Update User (Super Admin Only)
static async updateUser(req, res) {
    try {
      // Only super admin can edit users
      if (req.user.role !== 'super_admin') {
        return res.status(403).json({ success: false, message: 'Super admin only' });
      }
      
      const { fullName, email, phone, accountType, isActive } = req.body;
      
      // Check if email already exists (but not for this user)
      if (email) {
        const existingUser = await User.findOne({ 
          email: email.toLowerCase(), 
          _id: { $ne: req.params.id } 
        });
        if (existingUser) {
          return res.status(409).json({ success: false, message: 'Email already in use' });
        }
      }
      
      const updateData = {};
      if (fullName !== undefined) updateData.fullName = fullName;
      if (email !== undefined) updateData.email = email.toLowerCase();
      if (phone !== undefined) updateData.phone = phone;
      if (accountType !== undefined) updateData.accountType = accountType;
      if (isActive !== undefined) updateData.isActive = isActive;
      
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { $set: updateData },
        { new: true, runValidators: true }
      );
      
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      
      res.json({ success: true, message: 'User updated successfully', data: user });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ✅ Update Provider (Super Admin Only)
  static async updateProvider(req, res) {
    try {
      // Only super admin can edit providers fully
      if (req.user.role !== 'super_admin') {
        return res.status(403).json({ success: false, message: 'Super admin only' });
      }
      
      const { 
        companyName, serviceType, city, state, businessDescription,
        verificationStatus, isVisible, isAvailable,
        phone, email, fullName, yearsOfExperience, teamSize, completedJobs, rating
      } = req.body;
      
      const provider = await ServiceProvider.findById(req.params.id);
      if (!provider) {
        return res.status(404).json({ success: false, message: 'Provider not found' });
      }
      
      // Update provider fields
      if (companyName !== undefined) provider.companyName = companyName;
      if (serviceType !== undefined) provider.serviceType = serviceType;
      if (city !== undefined) provider.city = city;
      if (state !== undefined) provider.state = state;
      if (businessDescription !== undefined) provider.businessDescription = businessDescription;
      if (verificationStatus !== undefined) {
        provider.verificationStatus = verificationStatus;
        if (verificationStatus === 'approved') {
          provider.isVisible = true;
          provider.verifiedAt = new Date();
        }
      }
      if (isVisible !== undefined) provider.isVisible = isVisible;
      if (isAvailable !== undefined) provider.isAvailable = isAvailable;
      if (yearsOfExperience !== undefined) provider.yearsOfExperience = yearsOfExperience;
      if (teamSize !== undefined) provider.teamSize = teamSize;
      if (completedJobs !== undefined) provider.completedJobs = completedJobs;
      if (rating !== undefined) provider.rating = rating;
      
      await provider.save();
      
      // Also update user info if provided
      if (phone || email || fullName) {
        const user = await User.findById(provider.user);
        if (user) {
          if (fullName) user.fullName = fullName;
          if (email) user.email = email.toLowerCase();
          if (phone) user.phone = phone;
          await user.save();
        }
      }
      
      const updatedProvider = await ServiceProvider.findById(req.params.id)
        .populate('user', 'fullName email phone');
      
      res.json({ success: true, message: 'Provider updated successfully', data: updatedProvider });
    } catch (error) {
      console.error('Update provider error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ✅ Export users as CSV
// controllers/adminController.js - Add these methods
// controllers/adminController.js - Export methods
// controllers/adminController.js - Fix export methods
static async exportUsers(req, res) {
    try {
      const users = await User.find({ isEmailVerified: true, accountType: { $in: ['customer', 'provider'] } })
        .select('fullName email phone accountType isActive createdAt lastLogin').lean();
      
      const csv = [
        'Full Name,Email,Phone,Account Type,Status,Joined,Last Login',
        ...users.map(u => `"${u.fullName || ''}","${u.email || ''}","${u.phone || 'N/A'}","${u.accountType}","${u.isActive ? 'Active' : 'Disabled'}","${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : ''}","${u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'}"`)
      ].join('\n');
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=users-export-${Date.now()}.csv`);
      res.send('\uFEFF' + csv);
    } catch (error) { 
      console.error('Export users error:', error);
      res.status(500).json({ success: false, message: error.message }); 
    }
  }

  static async exportProviders(req, res) {
    try {
      const providers = await ServiceProvider.find().populate('user', 'fullName email phone').lean();
      
      const csv = [
        'Company Name,Full Name,Email,Phone,Service Type,Status,City,State,Rating,Jobs,NIN,Joined,Last Active,Available',
        ...providers.map(p => `"${p.companyName || ''}","${p.user?.fullName || ''}","${p.user?.email || ''}","${p.user?.phone || 'N/A'}","${p.serviceType || ''}","${p.verificationStatus || 'pending'}","${p.city || ''}","${p.state || ''}","${p.rating || 0}","${p.completedJobs || 0}","${p.nin?.number || 'N/A'}","${p.createdAt ? new Date(p.createdAt).toLocaleDateString() : ''}","${p.lastActive ? new Date(p.lastActive).toLocaleDateString() : 'Never'}","${p.isAvailable ? 'Yes' : 'No'}"`)
      ].join('\n');
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=providers-export-${Date.now()}.csv`);
      res.send('\uFEFF' + csv);
    } catch (error) { 
      console.error('Export providers error:', error);
      res.status(500).json({ success: false, message: error.message }); 
    }
  }
  // ✅ Reports
  static async getReports(req, res) {
    try {
      const reports = await Notification.find({ kind: 'report' }).sort({ createdAt: -1 }).limit(50).populate('user', 'fullName email');
      res.json({ success: true, data: reports });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  static async resolveReport(req, res) {
    try {
      const report = await Notification.findByIdAndUpdate(req.params.id, { read: true, kind: 'info' }, { new: true });
      if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
      res.json({ success: true, message: 'Report resolved', data: report });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  // ✅ Contacts
  static async getCustomerContacts(req, res) {
    try {
      const conversations = await Conversation.find().sort({ lastMessageAt: -1 }).limit(50)
        .populate('customer', 'fullName email').populate('professional', 'companyName serviceType');
      const data = conversations.map(c => ({
        id: c._id, customerName: c.customer?.fullName, customerEmail: c.customer?.email,
        providerName: c.professional?.companyName, serviceType: c.professional?.serviceType,
        lastContact: c.lastMessageAt, messageCount: c.messages.length
      }));
      res.json({ success: true, data });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  // ✅ Provider Activity
  static async getProviderActivity(req, res) {
    try {
      const providers = await ServiceProvider.find().sort({ lastActive: -1 }).limit(50).populate('user', 'fullName email');
      const data = providers.map(p => ({
        id: p._id, companyName: p.companyName, fullName: p.user?.fullName, email: p.user?.email,
        serviceType: p.serviceType, verificationStatus: p.verificationStatus,
        lastActive: p.lastActive, isAvailable: p.isAvailable, completedJobs: p.completedJobs, rating: p.rating
      }));
      res.json({ success: true, data });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  // ✅ Admin management (super admin)
  static async getAdmins(req, res) {
    try { const admins = await Admin.find().select('-password'); res.json({ success: true, data: admins }); }
    catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }
  static async createAdmin(req, res) {
    try { const { email, password, fullName, role } = req.body; const admin = await Admin.create({ email, password, fullName, role: role || 'admin' }); res.json({ success: true, data: { id: admin._id, email: admin.email, fullName: admin.fullName, role: admin.role } }); }
    catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }
  static async deleteAdmin(req, res) {
    try { await Admin.findByIdAndDelete(req.params.id); res.json({ success: true, message: 'Admin deleted' }); }
    catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }
}

module.exports = AdminController; 