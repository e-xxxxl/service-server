// controllers/authController.js
const User = require('../models/User');
const ServiceProvider = require('../models/ServiceProvider');
const JWTService = require('../config/jwt');
const crypto = require('crypto');
const emailService = require('../services/emailService');
const passport = require('../config/passport');

class AuthController {

  static async signup(req, res) {
    try {
      const { 
        fullName, 
        email, 
        password, 
        accountType = 'customer', 
        phone,
        // Provider-specific fields
        companyName,
        serviceType,
        state,
        city
      } = req.body;

      // Validate provider fields if account type is provider
      if (accountType === 'provider') {
        const missingFields = [];
        if (!companyName?.trim()) missingFields.push('Company name');
        if (!serviceType?.trim()) missingFields.push('Service type');
        if (!state?.trim()) missingFields.push('State');
        if (!city?.trim()) missingFields.push('City');
        if (!phone?.trim()) missingFields.push('Phone number');
        
        if (missingFields.length > 0) {
          return res.status(400).json({
            success: false,
            message: `Required fields missing: ${missingFields.join(', ')}`
          });
        }
      }

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

      // Create user
      const user = await User.create({
        fullName,
        email: email.toLowerCase(),
        password,
        accountType,
        phone: phone || '',
        emailVerificationToken: verificationToken,
        isEmailVerified: false
      });

      // If provider, create provider profile with location
      if (accountType === 'provider') {
        const providerData = {
          user: user._id,
          companyName: companyName.trim(),
          serviceType: serviceType.toLowerCase().trim(),
          city: city.trim(),
          state: state.trim(),
          businessAddress: {
            city: city.trim(),
            state: state.trim()
          },
          serviceArea: [{
            city: city.trim(),
            state: state.trim(),
            radius: 50
          }],
          isAvailable: true
        };

        const providerProfile = await ServiceProvider.create(providerData);

        // Link profile to user
        user.providerProfile = providerProfile._id;
        await user.save();

        console.log('Provider profile created:', {
          userId: user._id,
          profileId: providerProfile._id,
          companyName: providerProfile.companyName,
          location: `${providerProfile.city}, ${providerProfile.state}`
        });
      }

      // Send verification email
      await emailService.sendVerificationEmail(user, verificationToken);

      res.status(201).json({
        success: true,
        message: 'Account created. Please check your email to verify.',
        data: { 
          email: user.email,
          accountType: user.accountType,
          userId: user._id
        }
      });

    } catch (error) {
      console.error('Signup error:', error);
      
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({
          success: false,
          message: messages.join('. ')
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to create account'
      });
    }
  }

  static async login(req, res) {
    try {
      const { email, password } = req.body;

      const user = await User.findOne({ email: email.toLowerCase() })
        .select('+password')
        .populate('providerProfile');

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

      console.log('Login successful:', {
        email: user.email,
        accountType: user.accountType,
        hasProviderProfile: !!user.providerProfile
      });

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
static async verifyToken(req, res) {
    try {
      // Check if user is attached to request
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
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

      const userData = user.toJSON();
      
      // Include provider profile if exists
      if (user.providerProfile) {
        userData.providerProfile = user.providerProfile;
      }

      res.json({
        success: true,
        user: userData
      });
      
    } catch (error) {
      console.error('Token verification error:', error.message);
      res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
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