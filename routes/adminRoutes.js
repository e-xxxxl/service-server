// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

// Admin login (public - no middleware)
router.post('/login', AdminController.login);

// Protected admin routes
router.use(protect);
router.use(authorize('admin')); // This will now work with the fixed middleware

router.get('/dashboard', AdminController.getDashboard);
router.get('/users', AdminController.getUsers);
router.get('/providers', AdminController.getProviders);
router.patch('/providers/:id/verify', AdminController.verifyProvider);
router.patch('/users/:id/toggle-status', AdminController.toggleUserStatus);
router.delete('/users/:id', AdminController.deleteUser);

router.patch('/providers/:id/approve', AdminController.approveProvider);
router.patch('/providers/:id/reject', AdminController.rejectProvider);

module.exports = router;