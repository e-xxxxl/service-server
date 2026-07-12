// controllers/authController.js
const User = require('../models/User');
const JWTService = require('../config/jwt');
const crypto = require('crypto');
const emailService = require('../services/emailService');

class AuthController {

static async signup(req, res) {
    try {
      const { fullName, email, password, accountType = 'customer', phone, companyName, serviceType } = req.body;

      // Check if user exists
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'User with this email already exists'
        });
      }

      // Generate verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');

      // Create user WITH the verification token
      const user = await User.create({
        fullName,
        email: email.toLowerCase(),
        password,
        accountType,
        phone,
        emailVerificationToken: verificationToken, // SAVE THE TOKEN
        isEmailVerified: false
      });

      // Send verification email
      await emailService.sendVerificationEmail(user, verificationToken);

      res.status(201).json({
        success: true,
        message: 'Account created. Please check your email to verify.',
        data: { email: user.email }
      });

    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create account'
      });
    }
  }
  
static async login(req, res) {
    try {
      const { email, password } = req.body;

      const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

      if (!user || !(await user.comparePassword(password))) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      if (!user.isEmailVerified) {
        return res.status(403).json({
          success: false,
          message: 'Please verify your email before logging in',
          requiresVerification: true,
          email: user.email
        });
      }

      const token = JWTService.generateToken(user);

      res.status(200).json({
        success: true,
        message: 'Login successful',
        token,
        user: {
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
          accountType: user.accountType,
          phone: user.phone
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ success: false, message: 'Login failed' });
    }
  }

static async verifyEmail(req, res) {
    try {
      const { token } = req.params;
      
      // First, check if there's a user with this token
      const user = await User.findOne({ 
        emailVerificationToken: token
      });

      // If no user found with this token, check if maybe they're already verified
      if (!user) {
        // You could check if the token was recently used (optional, for better UX)
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid or expired verification token' 
        });
      }

      // If user is already verified, return success
      if (user.isEmailVerified) {
        const authToken = JWTService.generateToken(user);
        return res.status(200).json({
          success: true,
          message: 'Email already verified',
          token: authToken,
          user: user.toJSON()
        });
      }

      // Verify the user
      user.isEmailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerifiedAt = new Date(); // Set verification date
      await user.save();

      const authToken = JWTService.generateToken(user);

      res.status(200).json({
        success: true,
        message: 'Email verified successfully',
        token: authToken,
        user: user.toJSON()
      });

    } catch (error) {
      console.error('Verification error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Verification failed' 
      });
    }
  }
  static async resendVerification(req, res) {
    try {
      const { email } = req.body;
      const user = await User.findOne({ email: email.toLowerCase() });

      if (!user || user.isEmailVerified) {
        return res.status(200).json({
          success: true,
          message: 'If account exists, verification email has been sent.'
        });
      }

      const verificationToken = crypto.randomBytes(32).toString('hex');
      user.emailVerificationToken = verificationToken;
      await user.save();

      await emailService.sendVerificationEmail(user, verificationToken);

      res.status(200).json({
        success: true,
        message: 'Verification email sent'
      });

    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to resend email' });
    }
  }

  static async verifyToken(req, res) {
    try {
      const user = await User.findById(req.user.id);
      res.json({ success: true, user: user.toJSON() });
    } catch (error) {
      res.status(401).json({ success: false, message: 'Invalid token' });
    }
  }
}

module.exports = AuthController;