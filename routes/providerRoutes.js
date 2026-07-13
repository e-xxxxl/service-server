// routes/providerRoutes.js
const express = require('express');
const router = express.Router();
const ProviderController = require('../controllers/providerController');
const { protect, authorize } = require('../middleware/auth');

// Protect all routes - only providers can access
router.use(protect);
router.use(authorize('provider'));

// Dashboard
router.get('/dashboard', ProviderController.getDashboard);

// Profile Management
router.put('/profile', ProviderController.updateProfile);
router.put('/profile/basic', ProviderController.updateBasicInfo);
router.put('/profile/business', ProviderController.updateBusinessInfo);
router.put('/profile/services', ProviderController.updateServices);
router.put('/profile/hours', ProviderController.updateBusinessHours);
router.put('/profile/social', ProviderController.updateSocialLinks);

// Availability
router.patch('/availability', ProviderController.updateAvailability);

// Jobs
router.get('/jobs', ProviderController.getJobs);
router.post('/jobs/:jobId/respond', ProviderController.respondToJob);

// Messages
router.get('/messages', ProviderController.getMessages);
router.post('/messages/:customerId', ProviderController.sendMessage);

// Notifications
router.get('/notifications', ProviderController.getNotifications);
router.patch('/notifications/:id/read', ProviderController.markNotificationRead);

module.exports = router;