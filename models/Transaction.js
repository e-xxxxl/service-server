// models/Transaction.js
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  reference: { type: String, required: true, unique: true, index: true },
  // 'job_payment' (default): customer pays provider for a job, conversation
  // and messageId are required and everything below the type field applies.
  // 'subscription': provider pays the platform for their monthly access fee
  // - `customer` holds the provider's own linked User id (the payer),
  // `conversation`/`messageId` are not applicable, and workmanship/escrow
  // fields stay at their defaults.
  type: { type: String, enum: ['job_payment', 'subscription'], default: 'job_payment', index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  provider: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceProvider', required: true },
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', index: true },
  messageId: { type: mongoose.Schema.Types.ObjectId },
  amount: { type: Number, required: true }, // NGN, major unit (not kobo) - full amount the customer pays
  currency: { type: String, default: 'NGN' },
  // Platform takes a commission out of the workmanship portion only, not
  // materials/other costs. Captured at /initialize time from the quote so
  // fulfillment can compute the payout without re-reading the message.
  workmanshipCost: { type: Number, default: 0 },
  platformCommission: { type: Number, default: 0 },
  providerPayout: { type: Number, default: 0 }, // amount actually credited to the provider's wallet
  // Escrow split: materials/other costs release to the wallet in full on
  // payment, workmanship releases 60% on payment and holds back 40% here
  // until the customer confirms the job completed (see
  // customerController.confirmJobCompletion, the only place that clears
  // workmanshipHeldReleasedAt).
  workmanshipHeld: { type: Number, default: 0 },
  workmanshipHeldReleasedAt: Date,
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
