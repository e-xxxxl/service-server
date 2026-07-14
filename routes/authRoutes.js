// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const AuthController = require('../controllers/authController');

// Public routes (no middleware)
router.post('/signup', AuthController.signup);
router.post('/login', AuthController.login);
router.post('/verify-email/:token', AuthController.verifyEmail);
router.post('/resend-verification', AuthController.resendVerification);

// Protected routes (with middleware)
router.get('/verify', protect, AuthController.verifyToken);
router.get('/me', protect, AuthController.getCurrentUser); // Optional: get current user

module.exports = router;