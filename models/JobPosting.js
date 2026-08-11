// models/JobPosting.js
// A customer-posted job that providers can browse and express interest in.
// This is a second path alongside messaging a provider directly - once a
// customer picks an applicant to talk to, everything from there (quote,
// accept, pay) runs through the existing Conversation pipeline unchanged.
const mongoose = require('mongoose');
const { isValidState, isValidLga } = require('../data/nigeriaLocations');

const jobPostingSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: 120
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: 2000
  },
  category: {
    type: String,
    trim: true,
    lowercase: true,
    default: ''
  },
  state: {
    type: String,
    trim: true,
    validate: {
      validator: (value) => !value || isValidState(value),
      message: (props) => `${props.value} is not a valid Nigerian state`
    }
  },
  city: {
    type: String,
    trim: true,
    validate: {
      validator: function (value) {
        if (!value) return true;
        return isValidLga(this.state, value);
      },
      message: (props) => `${props.value} is not a valid LGA/city for the selected state`
    }
  },
  budget: {
    type: Number,
    min: 0
  },
  status: {
    type: String,
    enum: ['open', 'closed', 'cancelled'],
    default: 'open'
  },
  applicants: [{
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ServiceProvider',
      required: true
    },
    message: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ''
    },
    appliedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, { timestamps: true });

jobPostingSchema.index({ status: 1, category: 1, state: 1 });
jobPostingSchema.index({ customer: 1, createdAt: -1 });

module.exports = mongoose.model('JobPosting', jobPostingSchema);
