// models/Withdrawal.js
//
// Requesting a withdrawal immediately reserves the amount out of the
// provider's wallet.balance (see providerController.requestWithdrawal) so
// the same funds can't be requested twice while a request is pending. The
// actual bank transfer happens manually, outside this app - approving a
// request here is the admin confirming they already sent the money and
// attaching proof; rejecting refunds the reserved amount back to the
// wallet.
const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceProvider',
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 1
  },
  // Snapshot of the bank details at the time of the request, so a later
  // change to the provider's saved bank details doesn't retroactively
  // alter the record of where this withdrawal was meant to go.
  bankSnapshot: {
    bankName: String,
    accountNumber: String,
    accountName: String,
    whatsappNumber: String
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },
  rejectionReason: String,
  receiptUrl: String,
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  resolvedAt: Date
}, { timestamps: true });

withdrawalSchema.index({ provider: 1, createdAt: -1 });

module.exports = mongoose.model('Withdrawal', withdrawalSchema);
