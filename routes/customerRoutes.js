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
router.get('/messages/:conversationId/contact', CustomerController.getConversationContact);
router.post('/messages/:professionalId', CustomerController.sendMessage);
// routes/customerRoutes.js - Add this route
router.get('/provider/:id', CustomerController.getProviderProfile);

// Notifications
router.get('/notifications', CustomerController.getNotifications);
router.patch('/notifications/:id/read', CustomerController.markNotificationRead);
// routes/customerRoutes.js - Add report route
router.post('/report', CustomerController.submitReport);

router.post('/accept-quote/:conversationId/:messageId', CustomerController.acceptQuote);
router.post('/reject-quote/:conversationId/:messageId', CustomerController.rejectQuote);

module.exports = router;