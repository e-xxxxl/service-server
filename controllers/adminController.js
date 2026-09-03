// controllers/adminController.js - COMPLETE FIXED VERSION
const Admin = require('../models/Admin');
const User = require('../models/User');
const ServiceProvider = require('../models/ServiceProvider');
const Conversation = require('../models/Conversation');
const Notification = require('../models/Notification');
const Transaction = require('../models/Transaction');
const Withdrawal = require('../models/Withdrawal');
const JobPosting = require('../models/JobPosting');
const JWTService = require('../config/jwt');
const emailService = require('../services/emailService');
const ProviderController = require('./providerController');
const { notifyUser } = require('../services/notificationService');

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
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const [
        totalVerifiedUsers,
        totalCustomers,
        totalProviders,
        totalProviderDocs,
        totalConversations,
        pendingVerifications,
        approvedProviders,
        recentProviders,
        recentUsers,
        todayRevenueAgg,
        ongoingJobsCount,
        allTimeRevenueAgg,
        totalProviderBalanceAgg,
        pendingWithdrawalsCount,
        subscriptionRevenueAgg,
        activeSubscriptionsCount
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
          .sort({ createdAt: -1 }).limit(5),
        // type: {$ne: 'subscription'} rather than type: 'job_payment' - some
        // older transactions predate the `type` field entirely, so they have
        // no `type` stored at all. Matching on "not subscription" correctly
        // includes those (their absent field isn't equal to 'subscription'),
        // where matching on the literal 'job_payment' string would silently
        // miss them even though the schema default makes them display as
        // job_payment once loaded.
        Transaction.aggregate([
          { $match: { status: 'success', paidAt: { $gte: startOfToday }, type: { $ne: 'subscription' } } },
          { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
        ]),
        Conversation.countDocuments({ bookingStatus: { $in: ['active', 'in_progress'] } }),
        // All-time gross job-payment volume - not scoped to today, unlike
        // todayRevenueAgg above, and excludes subscription revenue (that's
        // its own separate stat below).
        Transaction.aggregate([
          { $match: { status: 'success', type: { $ne: 'subscription' } } },
          { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
        ]),
        // Total net balance the platform currently owes across every
        // provider's wallet - available (withdrawable now) plus pending
        // (held workmanship not yet released).
        ServiceProvider.aggregate([
          { $group: { _id: null, available: { $sum: '$wallet.balance' }, pending: { $sum: '$wallet.pendingEarnings' } } }
        ]),
        Withdrawal.countDocuments({ status: 'pending' }),
        // All-time revenue from provider subscriptions specifically, separate
        // from job-payment gross volume above.
        Transaction.aggregate([
          { $match: { status: 'success', type: 'subscription' } },
          { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
        ]),
        ServiceProvider.countDocuments({ 'subscription.expiresAt': { $gt: new Date() } })
      ]);

      const todayRevenue = todayRevenueAgg[0]?.total || 0;
      const todayPaymentsCount = todayRevenueAgg[0]?.count || 0;
      const allTimeRevenue = allTimeRevenueAgg[0]?.total || 0;
      const allTimePaymentsCount = allTimeRevenueAgg[0]?.count || 0;
      const totalProviderBalanceAvailable = totalProviderBalanceAgg[0]?.available || 0;
      const totalProviderBalanceHeld = totalProviderBalanceAgg[0]?.pending || 0;
      const totalProviderBalanceNet = totalProviderBalanceAvailable + totalProviderBalanceHeld;
      const subscriptionRevenueTotal = subscriptionRevenueAgg[0]?.total || 0;
      const subscriptionPaymentsCount = subscriptionRevenueAgg[0]?.count || 0;

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
            verifiedProviders: approvedProviders,
            todayRevenue,
            todayPaymentsCount,
            allTimeRevenue,
            allTimePaymentsCount,
            totalProviderBalanceAvailable,
            totalProviderBalanceHeld,
            totalProviderBalanceNet,
            pendingWithdrawalsCount,
            ongoingJobsCount,
            subscriptionRevenueTotal,
            subscriptionPaymentsCount,
            activeSubscriptionsCount
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

  // GET /api/admin/jobs/ongoing
  static async getOngoingJobs(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const filter = { bookingStatus: { $in: ['active', 'in_progress'] } };

      const [jobs, total] = await Promise.all([
        Conversation.find(filter)
          .sort({ lastMessageAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .populate('customer', 'fullName email')
          .populate({ path: 'professional', populate: { path: 'user', select: 'fullName email' } }),
        Conversation.countDocuments(filter)
      ]);

      res.json({
        success: true,
        data: jobs.map(j => {
          const paidMessage = [...j.messages].reverse().find(m => m.quote?.status === 'paid');
          return {
            id: j._id,
            customerName: j.customer?.fullName || 'Customer',
            providerName: j.professional?.user?.fullName || j.professional?.companyName || 'Provider',
            serviceType: j.professional?.serviceType,
            amount: paidMessage?.quote?.totalAmount || 0,
            status: j.bookingStatus,
            deadline: j.job?.deadline,
            startedAt: j.job?.startedAt,
            lastMessageAt: j.lastMessageAt
          };
        }),
        pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)), limit: parseInt(limit) }
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
      await notifyUser(provider.user._id, {
        text: '🎉 Congratulations! Your profile has been approved and is now visible to customers.',
        kind: 'success'
      });

      // Try sending emails - approval, then (since approval alone doesn't
      // make them visible - an active subscription is also required) a
      // nudge to subscribe right away rather than waiting for the next
      // daily scheduler pass.
      try {
        const emailService = require('../services/emailService');
        await emailService.sendApprovalEmail(provider.user, provider);
        if (!provider.subscription?.expiresAt || provider.subscription.expiresAt <= new Date()) {
          await emailService.sendSubscriptionRequiredEmail(provider.user, { fee: 10000 });
        }
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
// controllers/adminController.js - FIXED rejectProvider

static async rejectProvider(req, res) {
    try {
      const { reason } = req.body;
      const { id } = req.params;
      
      // ✅ Validate ID format
      if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid provider ID format' 
        });
      }
      
      if (!reason?.trim()) {
        return res.status(400).json({ 
          success: false, 
          message: 'Rejection reason is required' 
        });
      }

      const provider = await ServiceProvider.findByIdAndUpdate(
        id,
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
        return res.status(404).json({ 
          success: false, 
          message: 'Provider not found' 
        });
      }

      // Create notification
      await notifyUser(provider.user._id, {
        text: `❌ Your profile was not approved. Reason: ${reason}. You can update and resubmit.`,
        kind: 'action'
      });

      // Try sending email (non-blocking)
      try {
        const emailService = require('../services/emailService');
        await emailService.sendRejectionEmail(provider.user, provider, reason);
      } catch (e) { 
        console.error('Rejection email failed:', e.message); 
      }

      res.json({ 
        success: true, 
        message: 'Provider rejected', 
        data: provider 
      });
    } catch (error) {
      console.error('Reject provider error:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
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

  // POST /api/admin/users/:id/message - sends a one-off email to a specific
  // user, from admin@9jatradiespages.com rather than whatever EMAIL_FROM
  // the rest of the app's automated emails use.
  static async sendUserMessage(req, res) {
    try {
      const { subject, message } = req.body;
      if (!subject?.trim() || !message?.trim()) {
        return res.status(400).json({ success: false, message: 'Subject and message are both required' });
      }

      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      const result = await emailService.sendAdminDirectMessageEmail(user, {
        subject: subject.trim().slice(0, 200),
        message: message.trim().slice(0, 5000)
      });

      if (!result.success) {
        console.error('Admin direct message email failed:', result.error);
        return res.status(500).json({ success: false, message: 'Failed to send message' });
      }

      res.json({ success: true, message: 'Message sent' });
    } catch (error) {
      console.error('Send user message error:', error);
      res.status(500).json({ success: false, message: 'Failed to send message' });
    }
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
      // Customers only - providers have their own export endpoint, and this
      // one is gated to super_admin in routes/adminRoutes.js.
      const users = await User.find({ isEmailVerified: true, accountType: 'customer' })
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

  // GET /api/admin/withdrawals
  static async getWithdrawals(req, res) {
    try {
      const { status } = req.query;
      const filter = {};
      if (status && status !== 'all') filter.status = status;

      const withdrawals = await Withdrawal.find(filter)
        .sort({ createdAt: -1 })
        .limit(200)
        .populate({
          path: 'provider',
          select: 'companyName',
          populate: { path: 'user', select: 'fullName email' }
        })
        .populate('resolvedBy', 'fullName');

      res.json({
        success: true,
        data: withdrawals.map(w => ({
          id: w._id,
          providerId: w.provider?._id,
          providerName: w.provider?.user?.fullName || w.provider?.companyName || 'Provider',
          companyName: w.provider?.companyName,
          providerEmail: w.provider?.user?.email,
          amount: w.amount,
          bankSnapshot: w.bankSnapshot,
          status: w.status,
          rejectionReason: w.rejectionReason || null,
          receiptUrl: w.receiptUrl || null,
          resolvedBy: w.resolvedBy?.fullName || null,
          resolvedAt: w.resolvedAt || null,
          requestedAt: w.createdAt
        }))
      });
    } catch (error) {
      console.error('Get withdrawals error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // PATCH /api/admin/withdrawals/:id/approve (multipart, field name "receipt")
  static async approveWithdrawal(req, res) {
    try {
      const withdrawal = await Withdrawal.findOne({ _id: req.params.id, status: 'pending' });
      if (!withdrawal) return res.status(404).json({ success: false, message: 'Pending withdrawal not found' });
      if (!req.file) return res.status(400).json({ success: false, message: 'A receipt file is required to approve a withdrawal' });

      const upload = await ProviderController.uploadToCloudinary(req.file, 'withdrawal-receipts');

      withdrawal.status = 'approved';
      withdrawal.receiptUrl = upload.secure_url;
      withdrawal.resolvedBy = req.user.id;
      withdrawal.resolvedAt = new Date();
      await withdrawal.save();

      const provider = await ServiceProvider.findById(withdrawal.provider).populate('user', 'fullName email');
      if (provider?.user) {
        await notifyUser(provider.user._id, {
          text: `✅ Your withdrawal of ₦${withdrawal.amount.toLocaleString()} has been approved and sent.`,
          kind: 'success'
        });
        try {
          await emailService.sendWithdrawalApprovedEmail(provider.user, {
            amount: withdrawal.amount,
            receiptUrl: withdrawal.receiptUrl
          });
        } catch (emailError) {
          console.error('Withdrawal approved email error:', emailError);
        }
      }

      res.json({ success: true, message: 'Withdrawal approved', data: { id: withdrawal._id, status: withdrawal.status, receiptUrl: withdrawal.receiptUrl } });
    } catch (error) {
      console.error('Approve withdrawal error:', error);
      res.status(500).json({ success: false, message: 'Failed to approve withdrawal' });
    }
  }

  // PATCH /api/admin/withdrawals/:id/reject
  static async rejectWithdrawal(req, res) {
    try {
      const { reason } = req.body;
      if (!reason?.trim()) {
        return res.status(400).json({ success: false, message: 'A rejection reason is required' });
      }

      const withdrawal = await Withdrawal.findOne({ _id: req.params.id, status: 'pending' });
      if (!withdrawal) return res.status(404).json({ success: false, message: 'Pending withdrawal not found' });

      withdrawal.status = 'rejected';
      withdrawal.rejectionReason = reason.trim();
      withdrawal.resolvedBy = req.user.id;
      withdrawal.resolvedAt = new Date();
      await withdrawal.save();

      // Refund the reserved amount back to the provider's withdrawable balance.
      const provider = await ServiceProvider.findByIdAndUpdate(
        withdrawal.provider,
        { $inc: { 'wallet.balance': withdrawal.amount } },
        { new: true }
      ).populate('user', 'fullName email');

      if (provider?.user) {
        await notifyUser(provider.user._id, {
          text: `❌ Your withdrawal of ₦${withdrawal.amount.toLocaleString()} was rejected. Reason: ${withdrawal.rejectionReason}. The amount is back in your available balance.`,
          kind: 'action'
        });
        try {
          await emailService.sendWithdrawalRejectedEmail(provider.user, {
            amount: withdrawal.amount,
            reason: withdrawal.rejectionReason
          });
        } catch (emailError) {
          console.error('Withdrawal rejected email error:', emailError);
        }
      }

      res.json({ success: true, message: 'Withdrawal rejected', data: { id: withdrawal._id, status: withdrawal.status } });
    } catch (error) {
      console.error('Reject withdrawal error:', error);
      res.status(500).json({ success: false, message: 'Failed to reject withdrawal' });
    }
  }

  // DELETE /api/admin/jobs/:id - removes a job (Conversation). Payment
  // records (Transaction) are never deleted here - they stay as the
  // financial audit trail even if the conversation they originated from
  // is gone, matching how deleteUser above doesn't cascade either.
  static async deleteJob(req, res) {
    try {
      const conversation = await Conversation.findByIdAndDelete(req.params.id);
      if (!conversation) return res.status(404).json({ success: false, message: 'Job not found' });
      res.json({ success: true, message: 'Job deleted' });
    } catch (error) {
      console.error('Delete job error:', error);
      res.status(500).json({ success: false, message: 'Failed to delete job' });
    }
  }

  // GET /api/admin/job-postings - every job a customer has posted to the
  // job board, and who posted it. Separate from the paid-conversation
  // "jobs" above - these are open listings providers apply to.
  static async getJobPostings(req, res) {
    try {
      const { page = 1, limit = 20, status } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const filter = {};
      if (status && status !== 'all') filter.status = status;

      const [postings, total] = await Promise.all([
        JobPosting.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip).limit(parseInt(limit))
          .populate('customer', 'fullName email'),
        JobPosting.countDocuments(filter)
      ]);

      res.json({
        success: true,
        data: postings.map(p => ({
          id: p._id,
          title: p.title,
          description: p.description,
          category: p.category,
          state: p.state,
          city: p.city,
          budget: p.budget || null,
          status: p.status,
          postedByName: p.customer?.fullName || 'Unknown',
          postedByEmail: p.customer?.email || null,
          applicantCount: p.applicants.length,
          createdAt: p.createdAt
        })),
        pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) }
      });
    } catch (error) {
      console.error('Get job postings error:', error);
      res.status(500).json({ success: false, message: 'Failed to load job postings' });
    }
  }

  // DELETE /api/admin/job-postings/:id
  static async deleteJobPosting(req, res) {
    try {
      const posting = await JobPosting.findByIdAndDelete(req.params.id);
      if (!posting) return res.status(404).json({ success: false, message: 'Job posting not found' });
      res.json({ success: true, message: 'Job posting deleted' });
    } catch (error) {
      console.error('Delete job posting error:', error);
      res.status(500).json({ success: false, message: 'Failed to delete job posting' });
    }
  }

  // GET /api/admin/subscriptions - every approved provider with their
  // subscription state, optionally filtered by status.
  static async getSubscriptions(req, res) {
    try {
      const { page = 1, limit = 20, status } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const now = new Date();

      const filter = { verificationStatus: 'approved' };
      if (status === 'active') filter['subscription.expiresAt'] = { $gt: now };
      if (status === 'inactive') {
        filter.$or = [
          { 'subscription.expiresAt': { $exists: false } },
          { 'subscription.expiresAt': null },
          { 'subscription.expiresAt': { $lte: now } }
        ];
      }

      const [providers, total] = await Promise.all([
        ServiceProvider.find(filter)
          .sort({ 'subscription.expiresAt': -1 })
          .skip(skip).limit(parseInt(limit))
          .populate('user', 'fullName email'),
        ServiceProvider.countDocuments(filter)
      ]);

      res.json({
        success: true,
        data: providers.map(p => ({
          id: p._id,
          companyName: p.companyName,
          fullName: p.user?.fullName,
          email: p.user?.email,
          isActive: !!(p.subscription?.expiresAt && p.subscription.expiresAt > now),
          expiresAt: p.subscription?.expiresAt || null,
          lastPaidAt: p.subscription?.lastPaidAt || null
        })),
        pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) }
      });
    } catch (error) {
      console.error('Get subscriptions error:', error);
      res.status(500).json({ success: false, message: 'Failed to load subscriptions' });
    }
  }

  // GET /api/admin/subscriptions/transactions - subscription-payment
  // history across every provider, separate from job-payment transactions.
  static async getSubscriptionTransactions(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const filter = { type: 'subscription', status: 'success' };

      const [transactions, total] = await Promise.all([
        Transaction.find(filter)
          .sort({ paidAt: -1 })
          .skip(skip).limit(parseInt(limit))
          .populate({ path: 'provider', select: 'companyName user', populate: { path: 'user', select: 'fullName email' } }),
        Transaction.countDocuments(filter)
      ]);

      res.json({
        success: true,
        data: transactions.map(t => ({
          id: t._id,
          reference: t.reference,
          amount: t.amount,
          companyName: t.provider?.companyName,
          fullName: t.provider?.user?.fullName,
          email: t.provider?.user?.email,
          paidAt: t.paidAt
        })),
        pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) }
      });
    } catch (error) {
      console.error('Get subscription transactions error:', error);
      res.status(500).json({ success: false, message: 'Failed to load subscription transactions' });
    }
  }

  // PATCH /api/admin/providers/:id/subscription - manual override: either
  // grant `extendDays` more from their current expiry (or now, whichever is
  // later), or set an explicit `expiresAt`, or deactivate immediately.
  static async updateProviderSubscription(req, res) {
    try {
      const { extendDays, expiresAt, deactivate } = req.body;
      const provider = await ServiceProvider.findById(req.params.id).populate('user', 'fullName email');
      if (!provider) return res.status(404).json({ success: false, message: 'Provider not found' });

      const now = new Date();
      let newExpiresAt;

      if (deactivate) {
        newExpiresAt = now;
      } else if (expiresAt) {
        newExpiresAt = new Date(expiresAt);
        if (Number.isNaN(newExpiresAt.getTime())) {
          return res.status(400).json({ success: false, message: 'Invalid expiresAt date' });
        }
      } else if (extendDays) {
        const base = provider.subscription?.expiresAt && provider.subscription.expiresAt > now ? provider.subscription.expiresAt : now;
        newExpiresAt = new Date(base.getTime() + Number(extendDays) * 24 * 60 * 60 * 1000);
      } else {
        return res.status(400).json({ success: false, message: 'Provide extendDays, expiresAt, or deactivate' });
      }

      provider.subscription = {
        ...provider.subscription,
        isActive: newExpiresAt > now,
        expiresAt: newExpiresAt,
        // Clear dedupe keys so reminder emails behave correctly for this new state.
        expiringReminderSentFor: undefined,
        expiredReminderSentFor: undefined
      };
      await provider.save();

      if (provider.user) {
        await notifyUser(provider.user._id, {
          text: deactivate
            ? '⚠️ An admin has deactivated your subscription.'
            : `✅ An admin updated your subscription. Active until ${newExpiresAt.toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
          kind: deactivate ? 'action' : 'success'
        });
      }

      res.json({
        success: true,
        message: 'Subscription updated',
        data: { isActive: newExpiresAt > now, expiresAt: newExpiresAt }
      });
    } catch (error) {
      console.error('Update provider subscription error:', error);
      res.status(500).json({ success: false, message: 'Failed to update subscription' });
    }
  }
}

module.exports = AdminController; 