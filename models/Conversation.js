// models/Conversation.js - Add quote and booking fields
const mongoose = require('mongoose');

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
    sender: { type: mongoose.Schema.Types.ObjectId, required: true },
    senderModel: { type: String, enum: ['User', 'ServiceProvider'], required: true },
    text: { type: String, default: '' },
    messageType: {
      type: String,
      enum: ['text', 'quote', 'quote_accepted', 'quote_rejected', 'payment_requested', 'payment_confirmed', 'job_started', 'job_completed'],
      default: 'text'
    },
    quote: {
      serviceDescription: String,
      materials: String,
      workmanshipCost: Number,
      materialCost: Number,
      otherCosts: Number,
      totalAmount: Number,
      currency: { type: String, default: 'NGN' },
      validUntil: { type: Date, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      deadline: Date, // provider's proposed completion date, copied onto conversation.job once the job goes active
      status: { type: String, enum: ['pending', 'accepted', 'rejected', 'paid', 'expired', 'cancelled'], default: 'pending' },
      acceptedAt: Date,
      rejectedAt: Date,
      rejectionReason: String
    },
    payment: {
      status: { type: String, enum: ['unpaid', 'paid', 'refunded'], default: 'unpaid' },
      amount: Number,
      reference: String,
      method: String,
      paidAt: Date
    },
    booking: {
      status: { type: String, enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'], default: 'pending' },
      scheduledDate: Date,
      completedAt: Date,
      notes: String
    },
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }],
  lastMessageAt: { type: Date, default: Date.now },
  customerUnread: { type: Boolean, default: false },
  providerUnread: { type: Boolean, default: false },
  bookingStatus: {
    type: String,
    enum: ['none', 'quote_sent', 'quote_accepted', 'pending_payment', 'active', 'in_progress', 'completed', 'cancelled', 'disputed'],
    default: 'none'
  },
  // Flips to true only inside the server-side payment fulfillment step
  // (paymentController) once a Paystack payment on this conversation is
  // confirmed. Contact info is never released before that.
  contactUnlocked: { type: Boolean, default: false },
  // Job lifecycle, set once the job goes active (payment confirmed).
  job: {
    deadline: Date,
    startedAt: Date,
    completedAt: Date
  }
}, { timestamps: true });

module.exports = mongoose.model('Conversation', conversationSchema);