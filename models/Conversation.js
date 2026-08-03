// models/Conversation.js - Add quote field to messages
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const conversationSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  professional: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceProvider',
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
      default: ''
    },
    // ✅ Quote/Built-in message types
    messageType: {
      type: String,
      enum: ['text', 'quote', 'booking_confirmed', 'payment_requested', 'job_completed'],
      default: 'text'
    },
    // ✅ Quote data
    quote: {
      description: String,
      amount: Number,
      currency: { type: String, default: 'NGN' },
      items: [{
        name: String,
        description: String,
        quantity: { type: Number, default: 1 },
        unitPrice: Number,
        total: Number
      }],
      validUntil: Date,
      status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'expired'],
        default: 'pending'
      },
      acceptedAt: Date,
      rejectedAt: Date
    },
    // ✅ Booking/Payment data
    booking: {
      status: {
        type: String,
        enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'],
        default: 'pending'
      },
      amount: Number,
      paymentMethod: String,
      paymentStatus: {
        type: String,
        enum: ['unpaid', 'paid', 'refunded'],
        default: 'unpaid'
      },
      scheduledDate: Date,
      completedAt: Date
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
  customerUnread: { type: Boolean, default: false },
  providerUnread: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Conversation', conversationSchema);