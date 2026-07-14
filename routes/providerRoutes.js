// routes/providerRoutes.js - Updated
const express = require('express');
const router = express.Router();
const ProviderController = require('../controllers/providerController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('provider'));

// Dashboard
router.get('/dashboard', ProviderController.getDashboard);

// Profile
router.put('/profile', ProviderController.updateProfile);
router.put('/profile/basic', ProviderController.updateBasicInfo);
router.put('/profile/business', ProviderController.updateBusinessInfo);
router.put('/profile/social', ProviderController.updateSocialLinks);

// Availability
router.patch('/availability', ProviderController.updateAvailability);

// Messages
router.get('/messages', ProviderController.getMessages);
// router.get('/messages/:conversationId', ProviderController.getConversation);
router.post('/messages/:customerId', ProviderController.sendMessage);

// Jobs
router.get('/jobs', ProviderController.getJobs);
router.post('/jobs/:jobId/respond', ProviderController.respondToJob);

// Notifications
router.get('/notifications', ProviderController.getNotifications);
router.patch('/notifications/:id/read', ProviderController.markNotificationRead);

module.exports = router;