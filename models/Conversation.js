// models/Conversation.js
const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  professional: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceProvider',  // Changed from 'Professional' to 'ServiceProvider'
    required: true
  },
  messages: [{
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    senderModel: {
      type: String,
      enum: ['User', 'ServiceProvider'],
      required: true
    },
    text: {
      type: String,
      required: true
    },
    read: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  customerUnread: {
    type: Boolean,
    default: false
  },
  providerUnread: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes
conversationSchema.index({ customer: 1, professional: 1 }, { unique: true });
conversationSchema.index({ lastMessageAt: -1 });

const Conversation = mongoose.model('Conversation', conversationSchema);
module.exports = Conversation;