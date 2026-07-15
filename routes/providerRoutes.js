// routes/providerRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const ProviderController = require('../controllers/providerController');
const { protect, authorize } = require('../middleware/auth');
const { ninStorage, selfieStorage, generalStorage } = require('../config/cloudinary');

// Separate multer instances for different uploads
const uploadNinDoc = multer({ storage: ninStorage });
const uploadSelfie = multer({ storage: selfieStorage });
const uploadGeneral = multer({ storage: generalStorage });

// Combined upload for profile setup
const uploadProfileSetup = multer({
  storage: multer.diskStorage({}), // Temporary, we'll handle per-field
  limits: { fileSize: 5 * 1024 * 1024 }
});

router.use(protect);
router.use(authorize('provider'));

// Dashboard
router.get('/dashboard', ProviderController.getDashboard);

// Profile
router.put('/profile', ProviderController.updateProfile);
router.put('/profile/basic', ProviderController.updateBasicInfo);
router.put('/profile/business', ProviderController.updateBusinessInfo);
router.put('/profile/social', ProviderController.updateSocialLinks);

// Profile Setup with Cloudinary uploads
router.post('/setup-profile',
  uploadProfileSetup.fields([
    { name: 'ninDocument', maxCount: 1 },
    { name: 'selfiePhoto', maxCount: 1 }
  ]),
  ProviderController.setupProfile
);

// Resubmit after rejection
router.post('/resubmit-verification',
  uploadProfileSetup.fields([
    { name: 'ninDocument', maxCount: 1 },
    { name: 'selfiePhoto', maxCount: 1 }
  ]),
  ProviderController.resubmitVerification
);

// Upload profile photo
router.post('/upload-photo', uploadSelfie.single('photo'), ProviderController.uploadPhoto);

// Availability
router.patch('/availability', ProviderController.updateAvailability);

// Messages
router.get('/messages', ProviderController.getMessages);
router.post('/messages/:customerId', ProviderController.sendMessage);

// Jobs
router.get('/jobs', ProviderController.getJobs);
router.post('/jobs/:jobId/respond', ProviderController.respondToJob);

// Notifications
router.get('/notifications', ProviderController.getNotifications);
router.patch('/notifications/:id/read', ProviderController.markNotificationRead);

module.exports = router;