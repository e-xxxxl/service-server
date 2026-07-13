// models/Notification.js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  kind: { type: String, enum: ['success', 'action', 'message'], default: 'message' },
  read: { type: Boolean, default: false },
  relatedConversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' },
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);