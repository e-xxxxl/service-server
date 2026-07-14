// config/jwt.js
const jwt = require('jsonwebtoken');

class JWTService {
  static generateToken(user) {
    const payload = {
      id: user._id,        // Make sure this is the user's MongoDB _id
      userId: user._id,    // Add both for compatibility
      email: user.email,
      accountType: user.accountType
    };
    
    console.log('Generating token for:', {
      id: payload.id,
      email: payload.email,
      accountType: payload.accountType
    });
    
    return jwt.sign(
      payload,
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );
  }

  static verifyToken(token) {
    try {
      const decoded = jwt.verify(
        token, 
        process.env.JWT_SECRET || 'your-secret-key'
      );
      console.log('Token decoded successfully:', {
        id: decoded.id,
        email: decoded.email
      });
      return decoded;
    } catch (error) {
      console.error('Token verification failed:', error.message);
      throw error;
    }
  }
}

module.exports = JWTService;