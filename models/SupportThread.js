// models/SupportThread.js
//
// A real two-way support/complaint channel between a user (customer or
// provider) and admin - replaces the old fake flow where "support" just
// created a one-off Notification and the frontend faked a canned reply.
const mongoose = require('mongoose');

const supportThreadSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  userRole: { type: String, enum: ['customer', 'provider'], required: true },
  subject: { type: String, default: 'Support request' },
  type: { type: String, enum: ['general', 'complaint', 'bug', 'suggestion', 'other'], default: 'general' },
  status: { type: String, enum: ['open', 'resolved'], default: 'open' },
  messages: [{
    sender: { type: String, enum: ['user', 'admin'], required: true },
    senderName: String,
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  unreadByAdmin: { type: Boolean, default: true },
  unreadByUser: { type: Boolean, default: false },
  lastMessageAt: { type: Date, default: Date.now }
}, { timestamps: true });

supportThreadSchema.index({ lastMessageAt: -1 });

module.exports = mongoose.model('SupportThread', supportThreadSchema);
