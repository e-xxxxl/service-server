// routes/providerRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const ProviderController = require('../controllers/providerController');
const { protect, authorize } = require('../middleware/auth');

// Uploads go to local temp disk first; ProviderController.uploadToCloudinary()
// then streams the temp file to Cloudinary and deletes it. There is no
// direct-to-Cloudinary multer storage engine configured (would need the
// multer-storage-cloudinary package), so every upload route uses this
// same disk-then-forward pattern for consistency.
const uploadSelfie = multer({
  storage: multer.diskStorage({}),
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Combined upload for profile setup - any image format is accepted for
// both fields (jpg, png, gif, webp, heic, etc.), and the NIN document also
// accepts application/pdf since NIN slips are commonly scanned as PDFs.
// Video (e.g. mp4) is explicitly not an image/pdf mimetype so it's
// rejected by the same check without needing its own blocklist. Client-side
// <input accept> is a UX hint only, this fileFilter is what actually
// enforces it.
const uploadProfileSetup = multer({
  storage: multer.diskStorage({}), // Temporary, we'll handle per-field
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isImage = file.mimetype.startsWith('image/');
    const isPdf = file.mimetype === 'application/pdf';
    const allowed = file.fieldname === 'ninDocument' ? (isImage || isPdf) : isImage;
    if (!allowed) {
      const err = new Error(
        file.fieldname === 'ninDocument'
          ? 'NIN document must be an image or a PDF'
          : 'Selfie photo must be an image'
      );
      err.statusCode = 400;
      return cb(err);
    }
    cb(null, true);
  }
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

router.post('/send-quote/:customerId', ProviderController.sendQuote);
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

// Wallet
router.get('/wallet', ProviderController.getWallet);
router.get('/transactions', ProviderController.getTransactions);
router.get('/banks', ProviderController.getBanks);
router.post('/bank-details', ProviderController.saveBankDetails);
router.post('/withdrawals', ProviderController.requestWithdrawal);
router.get('/withdrawals', ProviderController.getMyWithdrawals);

// Messages
router.get('/messages', ProviderController.getMessages);
router.post('/messages/:customerId', ProviderController.sendMessage);
router.get('/messages/:conversationId/contact', ProviderController.getConversationContact);

// Jobs
router.get('/jobs', ProviderController.getJobs);
router.post('/jobs/:conversationId/start', ProviderController.startJob);
router.post('/jobs/:conversationId/complete', ProviderController.completeJob);

// Job postings (browse + apply)
router.get('/job-postings', ProviderController.browseJobPostings);
router.get('/job-postings/applied', ProviderController.getMyJobApplications);
router.post('/job-postings/:id/apply', ProviderController.applyToJobPosting);

// Notifications
router.get('/notifications', ProviderController.getNotifications);
router.patch('/notifications/:id/read', ProviderController.markNotificationRead);

module.exports = router;