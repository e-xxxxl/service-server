// models/Review.js
// One rating per completed job. `conversation` is unique so a customer can
// only rate a given job once - re-rating is rejected at the controller
// level by checking for an existing document first.
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    unique: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceProvider',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    trim: true,
    maxlength: 500,
    default: ''
  }
}, { timestamps: true });

reviewSchema.index({ provider: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
