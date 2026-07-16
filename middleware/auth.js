// middleware/auth.js - FIXED
const JWTService = require('../config/jwt');
const User = require('../models/User');
const Admin = require('../models/Admin');
const ServiceProvider = require('../models/ServiceProvider'); // ✅ ADD THIS IMPORT

// middleware/auth.js - Updated protect function
const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    try {
      const decoded = JWTService.verifyToken(token);
      const userId = decoded.id || decoded.userId;

      console.log('Protect middleware - decoded:', {
        id: decoded.id,
        accountType: decoded.accountType,
        email: decoded.email
      });

      // Check if it's an admin token
      if (decoded.accountType === 'admin') {
        const admin = await Admin.findById(userId);
        console.log('Admin lookup result:', admin ? 'Found' : 'Not found');
        
        if (!admin) {
          return res.status(401).json({ success: false, message: 'Admin not found' });
        }
        
        req.user = {
          id: admin._id,
          email: admin.email,
          accountType: 'admin', // Make sure this is set!
          fullName: admin.fullName,
          role: admin.role
        };
        
        console.log('Admin user set on request:', req.user);
        return next();
      }

      // Regular user
      const user = await User.findById(userId);
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not found' });
      }

      req.user = {
        id: user._id,
        email: user.email,
        accountType: user.accountType,
        fullName: user.fullName,
        phone: user.phone,
        isEmailVerified: user.isEmailVerified
      };

      // Update last active
      user.lastLogin = new Date();
      await user.save();

      if (user.accountType === 'provider') {
        await ServiceProvider.findOneAndUpdate(
          { user: user._id },
          { lastActive: new Date() }
        );
      }

      next();
    } catch (error) {
      console.error('Token verification error:', error);
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
  } catch (error) {
    console.error('Protect middleware error:', error);
    return res.status(500).json({ success: false, message: 'Authentication error' });
  }
};

// middleware/auth.js - Updated authorize function
const authorize = (...roles) => {
  return (req, res, next) => {
    console.log('Authorize check:', {
      user: req.user ? {
        id: req.user.id,
        accountType: req.user.accountType,
        email: req.user.email
      } : 'NO USER',
      requiredRoles: roles
    });

    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not authenticated - no user in request' 
      });
    }
    
    // Allow admin to access any route
    if (req.user.accountType === 'admin') {
      console.log('Admin access granted');
      return next();
    }
    
    if (!roles.includes(req.user.accountType)) {
      console.log('Access denied - wrong role:', req.user.accountType);
      return res.status(403).json({ 
        success: false, 
        message: `Access denied. Required role: ${roles.join(' or ')}. Your role: ${req.user.accountType}` 
      });
    }
    
    console.log('Access granted for role:', req.user.accountType);
    next();
  };
};

module.exports = { protect, authorize };