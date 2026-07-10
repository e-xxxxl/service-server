// src/models/VerificationToken.js
const mongoose = require('mongoose');

const verificationTokenSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    enum: ['email_verification', 'password_reset'],
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  isUsed: {
    type: Boolean,
    default: false
  },
  attempts: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for automatic expiration
verificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
verificationTokenSchema.index({ token: 1, type: 1 });

// Check if token is valid
verificationTokenSchema.methods.isValid = function() {
  return !this.isUsed && this.expiresAt > Date.now() && this.attempts < 3;
};

const VerificationToken = mongoose.model('VerificationToken', verificationTokenSchema);

module.exports = VerificationToken;