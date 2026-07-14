// routes/customerRoutes.js
const express = require('express');
const router = express.Router();
const CustomerController = require('../controllers/customerController');
const { protect } = require('../middleware/auth');

// Protect all routes
router.use(protect);

// Dashboard
router.get('/dashboard', CustomerController.getDashboard);

// Search
router.get('/search', CustomerController.searchProfessionals);

// Favorites
router.post('/favorites/:professionalId', CustomerController.toggleFavorite);

// Messages - Only use methods that exist in the controller
router.get('/messages', CustomerController.getMessages);
router.get('/messages/:conversationId', CustomerController.getConversation);
router.post('/messages/:professionalId', CustomerController.sendMessage);

// Notifications
router.get('/notifications', CustomerController.getNotifications);
router.patch('/notifications/:id/read', CustomerController.markNotificationRead);

module.exports = router;