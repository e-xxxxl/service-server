// // config/jwt.js
// const jwt = require('jsonwebtoken');

// class JWTService {
//   static generateToken(user) {
//     return jwt.sign(
//       { id: user._id, email: user.email, accountType: user.accountType },
//       process.env.JWT_SECRET,
//       { expiresIn: '7d' }
//     );
//   }

//   static verifyToken(token) {
//     return jwt.verify(token, process.env.JWT_SECRET);
//   }
// }

// module.exports = JWTService;


// config/jwt.js
const jwt = require('jsonwebtoken');

class JWTService {
  static generateToken(user) {
    return jwt.sign(
      { 
        id: user._id,  // Make sure this matches what you decode
        email: user.email,
        accountType: user.accountType 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );
  }

  static verifyToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
  }

  static generateRefreshToken(user) {
    return jwt.sign(
      { id: user._id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d' }
    );
  }
}

module.exports = JWTService;