const express = require('express');
const router = express.Router();
const CustomerController = require('../controllers/customerController');
const { protect, authorize } = require('../middleware/auth');

// Protect all routes - only authenticated customers can access
router.use(protect);
router.use(authorize('customer'));

// Customer routes
router.get('/dashboard', CustomerController.getDashboard);
router.get('/search', CustomerController.searchProfessionals);
router.post('/favorites/:professionalId', CustomerController.toggleFavorite);
router.patch('/notifications/:id/read', CustomerController.markNotificationRead);
router.post('/conversations/:professionalId/messages', CustomerController.sendMessage);

module.exports = router;