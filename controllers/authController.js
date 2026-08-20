// controllers/authController.js
const User = require('../models/User');
const ServiceProvider = require('../models/ServiceProvider');
const VerificationToken = require('../models/VerificationToken');
const JWTService = require('../config/jwt');
const crypto = require('crypto');
const emailService = require('../services/emailService');
const passport = require('../config/passport');
const { notifyAdminsOnSignup } = require('../services/schedulerService');
const { isValidState, isValidLga } = require('../data/nigeriaLocations');

class AuthController {

// controllers/authController.js - Add email validation


static async signup(req, res) {
    try {
      const { fullName, email, password, accountType = 'customer', phone, companyName, serviceType, state, city } = req.body;

      // ✅ Validate email format strictly
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!email || !emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid email address (e.g., name@example.com)'
        });
      }

      // Phone is required for every account type, not just providers.
      if (!phone?.trim()) {
        return res.status(400).json({ success: false, message: 'Required fields: Phone number' });
      }

      // Validate provider-only fields
      if (accountType === 'provider') {
        const missingFields = [];
        if (!companyName?.trim()) missingFields.push('Company name');
        if (!serviceType?.trim()) missingFields.push('Service type');
        if (!state?.trim()) missingFields.push('State');
        if (!city?.trim()) missingFields.push('City');

        if (missingFields.length > 0) {
          return res.status(400).json({ success: false, message: `Required fields: ${missingFields.join(', ')}` });
        }
      }

      // Check if user exists
      const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
      if (existingUser) {
        return res.status(409).json({ success: false, message: 'An account with this email already exists' });
      }

      // Generate verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');

      // Create user
      const user = await User.create({
        fullName: fullName?.trim(),
        email: email.toLowerCase().trim(),
        password,
        accountType,
        phone: phone?.trim() || '',
        emailVerificationToken: verificationToken,
        isEmailVerified: false
      });

      // If provider, create provider profile
      if (accountType === 'provider') {
        const providerData = {
          user: user._id,
          companyName: companyName.trim(),
          serviceType: serviceType.toLowerCase().trim(),
          city: city?.trim() || '',
          state: state?.trim() || '',
          businessAddress: { city: city?.trim() || '', state: state?.trim() || '' },
          serviceArea: [{ city: city?.trim() || '', state: state?.trim() || '', radius: 50 }],
          verificationStatus: 'pending',
          isVisible: false,
          isAvailable: true
        };

        const providerProfile = await ServiceProvider.create(providerData);
        user.providerProfile = providerProfile._id;
        await user.save();
      }

      // Send verification email
      await emailService.sendVerificationEmail(user, verificationToken);

      // ✅ NOTIFY ADMINS ABOUT NEW SIGNUP (non-blocking)
      notifyAdminsOnSignup(user, accountType).catch(err => {
        console.error('Failed to send admin notification:', err.message);
      });

      res.status(201).json({
        success: true,
        message: 'Account created. Please check your email to verify.',
        data: { email: user.email, accountType: user.accountType, userId: user._id }
      });

    } catch (error) {
      console.error('Signup error:', error);
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({ success: false, message: messages.join('. ') });
      }
      res.status(500).json({ success: false, message: 'Failed to create account' });
    }
  }

  // controllers/authController.js
static async updateProfile(req, res) {
    try {
      const { fullName, phone, state, city } = req.body;

      if (state && !isValidState(state)) {
        return res.status(400).json({ success: false, message: 'Please select a valid Nigerian state' });
      }
      if (city && !isValidLga(state, city)) {
        return res.status(400).json({ success: false, message: 'Please select a valid LGA/city for the selected state' });
      }

      const update = {};
      if (fullName !== undefined) update.fullName = fullName;
      if (phone !== undefined) update.phone = phone;
      if (state !== undefined) update.state = state;
      if (city !== undefined) update.city = city;

      const user = await User.findByIdAndUpdate(
        req.user.id,
        { $set: update },
        { new: true, runValidators: true }
      );
      res.json({ success: true, message: 'Profile updated', data: user });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async login(req, res) {
    try {
      const { email, password } = req.body;

      const user = await User.findOne({ email: email.toLowerCase() })
        .select('+password')
        .populate('providerProfile');

      if (user && user.isLocked()) {
        return res.status(423).json({
          success: false,
          message: 'Account temporarily locked due to too many failed login attempts. Please try again in 30 minutes.'
        });
      }

      if (!user || !(await user.comparePassword(password))) {
        if (user) await user.incrementLoginAttempts();
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      if (user.loginAttempts > 0) {
        await user.resetLoginAttempts();
      }

      if (!user.isEmailVerified) {
        return res.status(403).json({
          success: false,
          message: 'Please verify your email before logging in',
          requiresVerification: true,
          email: user.email
        });
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      const token = JWTService.generateToken(user);

      // Build response with provider data if applicable
      const userResponse = {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        accountType: user.accountType,
        phone: user.phone,
      };

      // Include provider profile if exists
      if (user.providerProfile) {
        userResponse.providerProfile = {
          id: user.providerProfile._id,
          companyName: user.providerProfile.companyName,
          serviceType: user.providerProfile.serviceType,
          city: user.providerProfile.city,
          state: user.providerProfile.state,
          isAvailable: user.providerProfile.isAvailable,
          rating: user.providerProfile.rating,
          completedJobs: user.providerProfile.completedJobs
        };
      }

      res.status(200).json({
        success: true,
        message: 'Login successful',
        token,
        user: userResponse
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Login failed',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  
 // controllers/authController.js - Update verifyEmail
static async verifyEmail(req, res) {
    try {
      const { token } = req.params;
      
      const user = await User.findOne({ 
        emailVerificationToken: token 
      }).populate('providerProfile');

      if (!user) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid or expired verification token' 
        });
      }

      if (user.isEmailVerified) {
        const authToken = JWTService.generateToken(user);
        const userData = user.toJSON();
        
        return res.status(200).json({
          success: true,
          message: 'Email already verified',
          token: authToken,
          user: {
            ...userData,
            accountType: user.accountType // Ensure accountType is included
          }
        });
      }

      // Verify the user
      user.isEmailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerifiedAt = new Date();
      await user.save();

      const authToken = JWTService.generateToken(user);
      const userData = user.toJSON();

      res.status(200).json({
        success: true,
        message: 'Email verified successfully',
        token: authToken,
        user: {
          ...userData,
          accountType: user.accountType, // Include account type
          providerProfile: user.providerProfile || null
        }
      });

    } catch (error) {
      console.error('Verification error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Verification failed' 
      });
    }
  }
  static async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      const user = await User.findOne({ email: email?.toLowerCase().trim() });

      // Always respond the same way whether or not the account exists,
      // so this endpoint can't be used to enumerate registered emails.
      if (!user) {
        return res.status(200).json({
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent.'
        });
      }

      // Invalidate any previous outstanding reset tokens for this user.
      await VerificationToken.deleteMany({ user: user._id, type: 'password_reset' });

      const token = crypto.randomBytes(32).toString('hex');
      await VerificationToken.create({
        user: user._id,
        token,
        type: 'password_reset',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
      });

      await emailService.sendPasswordResetEmail(user, token);

      res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ success: false, message: 'Failed to process password reset request' });
    }
  }

  static async resetPassword(req, res) {
    try {
      const { token } = req.params;
      const { password } = req.body;

      if (!password || password.length < 8) {
        return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
      }

      const verificationToken = await VerificationToken.findOne({ token, type: 'password_reset' });
      if (!verificationToken || !verificationToken.isValid()) {
        return res.status(400).json({ success: false, message: 'Invalid or expired reset link' });
      }

      const user = await User.findById(verificationToken.user);
      if (!user) {
        return res.status(400).json({ success: false, message: 'Invalid or expired reset link' });
      }

      user.password = password; // hashed by the pre-save hook
      await user.save();

      verificationToken.isUsed = true;
      await verificationToken.save();

      // Any other outstanding reset tokens for this user are now stale.
      await VerificationToken.deleteMany({ user: user._id, type: 'password_reset', _id: { $ne: verificationToken._id } });

      res.status(200).json({ success: true, message: 'Password reset successfully. Please sign in with your new password.' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ success: false, message: 'Failed to reset password' });
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

 // controllers/authController.js - Update verifyToken method
  // controllers/authController.js - Update verifyToken
static async verifyToken(req, res) {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }

      // If admin, return admin data
      if (req.user.accountType === 'admin') {
        return res.json({
          success: true,
          user: {
            _id: req.user.id,
            fullName: req.user.fullName,
            email: req.user.email,
            accountType: 'admin',
            role: req.user.role
          }
        });
      }

      // Regular user
      const user = await User.findById(req.user.id).populate('providerProfile');
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const userData = user.toJSON();
      if (user.providerProfile) {
        userData.providerProfile = user.providerProfile;
      }

      res.json({ success: true, user: userData });
    } catch (error) {
      console.error('Token verification error:', error.message);
      res.status(401).json({ success: false, message: 'Invalid token' });
    }
  }
  
  // Google OAuth Callback
  static async googleCallback(req, res) {
    try {
      const user = req.user;
      
      if (!user) {
        return res.redirect(`${process.env.CLIENT_URL}/login?error=google_failed`);
      }

      // Generate JWT token
      const token = JWTService.generateToken(user);

      // Populate provider profile if exists
      let needsProfileSetup = false;
      if (user.accountType === 'provider') {
        const provider = await ServiceProvider.findOne({ user: user._id });
        needsProfileSetup = !provider?.city || !provider?.state || provider?.serviceType === 'general';
      }

      // Redirect to frontend with token
      const params = new URLSearchParams({
        token,
        accountType: user.accountType,
        email: user.email,
        fullName: user.fullName,
        needsProfileSetup: needsProfileSetup ? 'true' : 'false'
      });

      res.redirect(`${process.env.CLIENT_URL}/auth/callback?${params.toString()}`);
    } catch (error) {
      console.error('Google callback error:', error);
      res.redirect(`${process.env.CLIENT_URL}/login?error=server_error`);
    }
  }
  // controllers/authController.js - Add this method
static async getCurrentUser(req, res) {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: 'Not authenticated'
        });
      }

      const user = await User.findById(req.user.id)
        .populate('providerProfile');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        user: user.toJSON()
      });
    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user data'
      });
    }
  }
}

module.exports = AuthController;