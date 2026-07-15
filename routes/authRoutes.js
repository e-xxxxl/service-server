// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const passport = require('../config/passport');
const AuthController = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Regular auth
router.post('/signup', AuthController.signup);
router.post('/login', AuthController.login);
router.post('/verify-email/:token', AuthController.verifyEmail);
router.post('/resend-verification', AuthController.resendVerification);
router.get('/verify', protect, AuthController.verifyToken);

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