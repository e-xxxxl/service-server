// // routes/adminRoutes.js
// const express = require('express');
// const router = express.Router();
// const AdminController = require('../controllers/adminController');
// const { protect, authorize } = require('../middleware/auth');

// // Admin login (public - no middleware)
// router.post('/login', AdminController.login);

// // Protected admin routes
// router.use(protect);
// router.use(authorize('admin')); // This will now work with the fixed middleware

// router.get('/dashboard', AdminController.getDashboard);
// router.get('/users', AdminController.getUsers);
// router.get('/providers', AdminController.getProviders);
// router.patch('/providers/:id/verify', AdminController.verifyProvider);
// router.patch('/users/:id/toggle-status', AdminController.toggleUserStatus);
// router.delete('/users/:id', AdminController.deleteUser);

// router.patch('/providers/:id/approve', AdminController.approveProvider);
// router.patch('/providers/:id/reject', AdminController.rejectProvider);

// module.exports = router;



// routes/adminRoutes.js - Add new routes
const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

router.post('/login', AdminController.login);

router.use(protect);
router.use(authorize('admin'));

router.get('/verify', (req, res) => {
  res.json({ success: true, admin: { id: req.user.id, fullName: req.user.fullName, email: req.user.email, role: req.user.role } });
});

router.get('/dashboard', AdminController.getDashboard);
router.get('/users', AdminController.getUsers);
router.get('/providers', AdminController.getProviders);
router.patch('/providers/:id/approve', AdminController.approveProvider);
router.patch('/providers/:id/reject', AdminController.rejectProvider);
router.patch('/users/:id/toggle-status', AdminController.toggleUserStatus);
router.delete('/users/:id', AdminController.deleteUser);

// NEW ROUTES
router.get('/customer-contacts', AdminController.getCustomerContacts);
router.get('/provider-activity', AdminController.getProviderActivity);
router.get('/reports', AdminController.getReports);
router.patch('/reports/:id/resolve', AdminController.resolveReport);
router.get('/settings', AdminController.getSettings);
router.put('/settings', AdminController.updateSettings);

// Super admin only routes
const superAdminOnly = (req, res, next) => {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ success: false, message: 'Super admin access required' });
  }
  next();
};

router.get('/admins', superAdminOnly, AdminController.getAdmins);
router.post('/admins', superAdminOnly, AdminController.createAdmin);
router.delete('/admins/:id', superAdminOnly, AdminController.deleteAdmin);

module.exports = router;