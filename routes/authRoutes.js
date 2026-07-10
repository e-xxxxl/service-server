// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');

// No rate limiters, no complex validation middleware for now
router.post('/signup', AuthController.signup);
router.post('/login', AuthController.login);
router.post('/verify-email/:token', AuthController.verifyEmail);
router.post('/resend-verification', AuthController.resendVerification);

// Optional: Keep these only if you really need them
router.get('/verify', AuthController.verifyToken);

module.exports = router;