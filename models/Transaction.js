// models/Transaction.js
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  reference: { type: String, required: true, unique: true, index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  provider: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceProvider', required: true },
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  messageId: { type: mongoose.Schema.Types.ObjectId, required: true },
  amount: { type: Number, required: true }, // NGN, major unit (not kobo) - full amount the customer pays
  currency: { type: String, default: 'NGN' },
  // Platform takes a commission out of the workmanship portion only, not
  // materials/other costs. Captured at /initialize time from the quote so
  // fulfillment can compute the payout without re-reading the message.
  workmanshipCost: { type: Number, default: 0 },
  platformCommission: { type: Number, default: 0 },
  providerPayout: { type: Number, default: 0 }, // amount actually credited to the provider's wallet
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
