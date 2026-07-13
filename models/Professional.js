// models/Professional.js
const mongoose = require('mongoose');

const professionalSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // if pros are also Users w/ accountType 'provider'
  name: { type: String, required: true },
  trade: { type: String, required: true },
  category: { type: String, required: true }, // matches search categories
  state: { type: String, required: true },
  city: { type: String, required: true },
  rating: { type: Number, default: 0 },
  jobsCompleted: { type: Number, default: 0 },
  yearsExperience: { type: Number, default: 0 },
  status: { type: String, enum: ['Available today', 'Busy', 'Replies in ~1hr'], default: 'Available today' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

professionalSchema.index({ category: 1, state: 1, city: 1 });

module.exports = mongoose.model('Professional', professionalSchema);