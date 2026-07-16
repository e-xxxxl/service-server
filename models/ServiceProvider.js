// models/ServiceProvider.js - FIXED
const mongoose = require('mongoose');

const serviceProviderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  companyName: {
    type: String,
    trim: true,
    default: ''
  },
  serviceType: {
    type: String,
    lowercase: true,
    trim: true,
    default: ''
  },
  tagline: {
    type: String,
    maxlength: 200,
    default: ''
  },
  
  // Verification Status
  verificationStatus: {
    type: String,
    enum: ['pending', 'submitted', 'under_review', 'approved', 'rejected'],
    default: 'pending'
  },
  isVisible: {
    type: Boolean,
    default: false // Hidden until approved
  },
  verifiedAt: Date,
  
  // NIN Details
  nin: {
    number: { type: String, trim: true },
    documentUrl: { type: String },
    documentPublicId: { type: String },
    verified: { type: Boolean, default: false }
  },
  
  // Personal Photo
  selfiePhoto: { type: String },
  selfiePublicId: { type: String },
  
  // Verification Documents
  verificationDocuments: [{
    type: { 
      type: String, 
      enum: ['nin', 'selfie', 'business_registration', 'trade_certificate', 'utility_bill', 'other']
    },
    url: String,
    publicId: String,
    uploadedAt: { type: Date, default: Date.now },
    verified: { type: Boolean, default: false }
  }],
  
  // Rejection Info
  rejectionReason: String,
  rejectionDate: Date,
  resubmissionCount: { type: Number, default: 0 },
  
  // Address
  businessAddress: {
    street: String,
    city: String,
    state: String,
    zipCode: String
  },
  city: { type: String, trim: true, index: true },
  state: { type: String, trim: true, index: true },
  serviceArea: [{
    city: String,
    state: String,
    radius: Number
  }],
  
  // Other fields
  businessDescription: String,
  servicesOffered: [{ name: String, description: String }],
  yearsOfExperience: { type: Number, default: 0 },
  teamSize: { type: Number, default: 1 },
  rating: { type: Number, default: 0, min: 0, max: 5 },
  totalReviews: { type: Number, default: 0 },
  completedJobs: { type: Number, default: 0 },
  isAvailable: { type: Boolean, default: true },
  profileCompletionScore: { type: Number, default: 0 },
  
  // Last active
  lastActive: { type: Date, default: Date.now }
  
}, { timestamps: true });

// Calculate profile completion
serviceProviderSchema.pre('save', function(next) {
  const requiredFields = [
    { field: 'serviceType', weight: 20 },
    { field: 'tagline', weight: 10 },
    { field: 'nin.number', weight: 15 },
    { field: 'nin.documentUrl', weight: 15 },
    { field: 'selfiePhoto', weight: 15 },
    { field: 'city', weight: 10 },
    { field: 'state', weight: 10 },
    { field: 'companyName', weight: 5 }
  ];
  
  let score = 0;
  for (const { field, weight } of requiredFields) {
    const value = field.split('.').reduce((obj, key) => obj?.[key], this);
    if (value && value !== '') score += weight;
  }
  
  this.profileCompletionScore = Math.min(score, 100);
  // next(); // ✅ UNCOMMENTED - This is critical!
});

// Indexes for search
serviceProviderSchema.index({ verificationStatus: 1, isVisible: 1 });
serviceProviderSchema.index({ serviceType: 1, city: 1, state: 1 });
serviceProviderSchema.index({ lastActive: -1 });

module.exports = mongoose.model('ServiceProvider', serviceProviderSchema);