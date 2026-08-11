// routes/adminRoutes.js - COMPLETE
const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/adminController');
const SupportController = require('../controllers/supportController');
const { protect, authorize } = require('../middleware/auth');

router.post('/login', AdminController.login);
router.use(protect);
router.use(authorize('admin'));

router.get('/verify', (req, res) => res.json({ success: true, admin: { id: req.user.id, fullName: req.user.fullName, email: req.user.email, role: req.user.role } }));
router.get('/dashboard', AdminController.getDashboard);
router.get('/jobs/ongoing', AdminController.getOngoingJobs);
router.get('/users', AdminController.getUsers);
router.get('/providers', AdminController.getProviders);
router.get('/export/users', AdminController.exportUsers);
router.get('/export/providers', AdminController.exportProviders);
router.patch('/providers/:id/approve', AdminController.approveProvider);
router.patch('/providers/:id/reject', AdminController.rejectProvider);
router.patch('/users/:id/toggle-status', AdminController.toggleUserStatus);
router.delete('/users/:id', AdminController.deleteUser);
router.get('/customer-contacts', AdminController.getCustomerContacts);
router.get('/provider-activity', AdminController.getProviderActivity);

// Support/complaints - a real two-way chat with the reporting user, not a
// one-off notification list.
router.get('/support/threads', SupportController.listThreads);
router.get('/support/threads/:id', SupportController.getThread);
router.post('/support/threads/:id/reply', SupportController.replyToThread);
router.patch('/support/threads/:id/resolve', SupportController.resolveThread);



const superAdminOnly = (req, res, next) => {
  if (req.user.role !== 'super_admin') return res.status(403).json({ success: false, message: 'Super admin only' });
  next();
};
router.get('/admins', superAdminOnly, AdminController.getAdmins);
// routes/adminRoutes.js
router.get('/quotes', AdminController.getAllQuotes);
router.post('/admins', superAdminOnly, AdminController.createAdmin);
router.delete('/admins/:id', superAdminOnly, AdminController.deleteAdmin);
// routes/adminRoutes.js - ADD THESE ROUTES

// Update user (super admin only)
router.put('/users/:id', superAdminOnly, AdminController.updateUser);

// Update provider (super admin only)
router.put('/providers/:id/update', superAdminOnly, AdminController.updateProvider);

module.exports = router;