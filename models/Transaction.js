// models/Transaction.js
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  reference: { type: String, required: true, unique: true, index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  provider: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceProvider', required: true },
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  messageId: { type: mongoose.Schema.Types.ObjectId, required: true },
  amount: { type: Number, required: true }, // NGN, major unit (not kobo)
  currency: { type: String, default: 'NGN' },
  status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending', index: true },
  paystackData: {
    authorizationUrl: String,
    accessCode: String,
    channel: String,
    gatewayResponse: String
  },
  paidAt: Date
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
