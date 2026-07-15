// middleware/auth.js - Updated
const JWTService = require('../config/jwt');
const User = require('../models/User');
const Admin = require('../models/Admin'); // Import Admin model

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

      // Check if it's an admin token
      if (decoded.accountType === 'admin') {
        const admin = await Admin.findById(userId);
        if (!admin) {
          return res.status(401).json({ success: false, message: 'Admin not found' });
        }
        req.user = {
          id: admin._id,
          email: admin.email,
          accountType: 'admin',
          fullName: admin.fullName,
          role: admin.role
        };
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

      next();
    } catch (error) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Authentication error' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }
    
    // Allow admin to access any route
    if (req.user.accountType === 'admin') {
      return next();
    }
    
    if (!roles.includes(req.user.accountType)) {
      return res.status(403).json({ success: false, message: `Access denied. Required role: ${roles.join(' or ')}` });
    }
    
    next();
  };
};

module.exports = { protect, authorize };