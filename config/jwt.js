// config/jwt.js
const jwt = require('jsonwebtoken');

// config/jwt.js
class JWTService {
  static generateToken(user) {
    const payload = {
      id: user._id || user.id,
      userId: user._id || user.id,
      email: user.email,
      accountType: user.accountType || 'customer', // Include accountType
      role: user.role
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    console.log('Token decoded successfully:', { 
      id: decoded.id, 
      email: decoded.email,
      accountType: decoded.accountType 
    });
    return decoded;
  }
}

module.exports = JWTService;