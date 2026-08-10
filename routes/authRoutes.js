// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const passport = require('../config/passport');
const AuthController = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { authLimiter, loginLimiter, verificationLimiter } = require('../middleware/rateLimiter');
const { signupValidation, loginValidation, handleValidationErrors } = require('../middleware/validate');

// Regular auth
router.post('/signup', authLimiter, signupValidation, handleValidationErrors, AuthController.signup);
router.post('/login', loginLimiter, loginValidation, handleValidationErrors, AuthController.login);
router.post('/verify-email/:token', AuthController.verifyEmail);
router.post('/resend-verification', verificationLimiter, AuthController.resendVerification);
router.post('/forgot-password', verificationLimiter, AuthController.forgotPassword);
router.post('/reset-password/:token', authLimiter, AuthController.resetPassword);
router.get('/verify', protect, AuthController.verifyToken);
// routes/authRoutes.js
router.put('/update-profile', protect, AuthController.updateProfile);

// Google OAuth Routes
router.get('/google', (req, res, next) => {
  const { accountType } = req.query;
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state: accountType || 'customer'
  })(req, res, next);
});

router.get('/google/callback',
  passport.authenticate('google', { 
    session: false,
    failureRedirect: `${process.env.CLIENT_URL}/login?error=google_failed`
  }),
  AuthController.googleCallback
);

module.exports = router;