// src/models/ServiceProvider.js
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
    required: [true, 'Company name is required'],
    trim: true,
    maxlength: [200, 'Company name cannot exceed 200 characters']
  },
  serviceType: {
    type: String,
    required: [true, 'Service type is required'],
    enum: [
      'plumbing', 'electrical', 'hvac', 'roofing',
      'landscaping', 'cleaning', 'painting', 'other'
    ]
  },
  description: {
    type: String,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  yearsOfExperience: Number,
  licenseNumber: {
    type: String,
    trim: true
  },
  insuranceVerified: {
    type: Boolean,
    default: false
  },
  serviceAreas: [{
    city: String,
    state: String,
    zipCode: String,
    radius: Number // in miles
  }],
  rating: {
    average: { type: Number, default: 0 },
    count: { type: Number, default: 0 }
  },
  availability: {
    monday: { start: String, end: String },
    tuesday: { start: String, end: String },
    wednesday: { start: String, end: String },
    thursday: { start: String, end: String },
    friday: { start: String, end: String },
    saturday: { start: String, end: String },
    sunday: { start: String, end: String }
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationDocuments: [{
    type: { type: String },
    url: String,
    verified: Boolean,
    uploadedAt: Date
  }],
  status: {
    type: String,
    enum: ['pending', 'active', 'suspended', 'inactive'],
    default: 'pending'
  }
}, {
  timestamps: true
});

// Indexes
serviceProviderSchema.index({ serviceType: 1 });
serviceProviderSchema.index({ 'serviceAreas.zipCode': 1 });
serviceProviderSchema.index({ status: 1 });

const ServiceProvider = mongoose.model('ServiceProvider', serviceProviderSchema);

module.exports = ServiceProvider;