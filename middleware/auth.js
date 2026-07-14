// middleware/auth.js
const JWTService = require('../config/jwt');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    let token;

    // Get token from Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route - No token provided'
      });
    }

    try {
      // Verify token
      const decoded = JWTService.verifyToken(token);
      
      // Get user from database
      const userId = decoded.id || decoded.userId || decoded._id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token structure - no user ID found'
        });
      }
      
      const user = await User.findById(userId).select('+password');
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      // Attach user to request object
      req.user = {
        id: user._id,
        email: user.email,
        accountType: user.accountType,
        fullName: user.fullName,
        phone: user.phone,
        isEmailVerified: user.isEmailVerified,
        providerProfile: user.providerProfile
      };

      console.log('User authenticated:', {
        id: req.user.id,
        email: req.user.email,
        accountType: req.user.accountType
      });

      next();
    } catch (error) {
      console.error('Token verification failed:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

// Role-based authorization
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    
    if (!roles.includes(req.user.accountType)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}`
      });
    }
    
    next();
  };
};

module.exports = { protect, authorize };