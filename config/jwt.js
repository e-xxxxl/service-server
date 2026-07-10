// config/jwt.js
const jwt = require('jsonwebtoken');

class JWTService {
  static generateToken(user) {
    return jwt.sign(
      { id: user._id, email: user.email, accountType: user.accountType },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
  }

  static verifyToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
  }
}

module.exports = JWTService;