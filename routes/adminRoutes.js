// routes/adminRoutes.js - COMPLETE
const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

router.post('/login', AdminController.login);
router.use(protect);
router.use(authorize('admin'));

router.get('/verify', (req, res) => res.json({ success: true, admin: { id: req.user.id, fullName: req.user.fullName, email: req.user.email, role: req.user.role } }));
router.get('/dashboard', AdminController.getDashboard);
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
router.get('/reports', AdminController.getReports);
router.patch('/reports/:id/resolve', AdminController.resolveReport);



const superAdminOnly = (req, res, next) => {
  if (req.user.role !== 'super_admin') return res.status(403).json({ success: false, message: 'Super admin only' });
  next();
};
router.get('/admins', superAdminOnly, AdminController.getAdmins);
router.post('/admins', superAdminOnly, AdminController.createAdmin);
router.delete('/admins/:id', superAdminOnly, AdminController.deleteAdmin);

module.exports = router;