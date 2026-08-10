// config/jwt.js
const jwt = require('jsonwebtoken');

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required but not set');
}

class JWTService {
  static generateToken(user) {
    const payload = {
      id: user._id || user.id,
      userId: user._id || user.id,
      email: user.email,
      accountType: user.accountType || 'customer', // Include accountType
      role: user.role
    };

    return jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );
  }

  static verifyToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
  }
}

module.exports = JWTService;