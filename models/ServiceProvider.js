// models/ServiceProvider.js - Enhanced version
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
    trim: true
  },
  serviceType: {
    type: String,
    required: [true, 'Service type is required'],
    lowercase: true,
    trim: true
  },
  // New enhanced fields
  businessDescription: {
    type: String,
    maxlength: 1000
  },
  tagline: {
    type: String,
    maxlength: 200
  },
  servicesOffered: [{
    name: String,
    description: String,
    priceRange: {
      min: Number,
      max: Number,
      unit: String // per hour, per job, etc.
    }
  }],
  yearsOfExperience: {
    type: Number,
    default: 0
  },
  teamSize: {
    type: Number,
    default: 1
  },
  // Business Details
  businessAddress: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  serviceArea: [{
    city: String,
    state: String,
    radius: Number // in kilometers
  }],
  // License & Insurance
  license: {
    number: String,
    issuingAuthority: String,
    issueDate: Date,
    expiryDate: Date,
    documentUrl: String
  },
  insurance: {
    provider: String,
    policyNumber: String,
    coverage: String,
    expiryDate: Date,
    documentUrl: String
  },
  // Portfolio & Media
  profileImage: String,
  coverImage: String,
  portfolioImages: [{
    url: String,
    caption: String,
    category: String
  }],
  // Business Hours
  businessHours: {
    monday: { open: String, close: String, isOpen: Boolean },
    tuesday: { open: String, close: String, isOpen: Boolean },
    wednesday: { open: String, close: String, isOpen: Boolean },
    thursday: { open: String, close: String, isOpen: Boolean },
    friday: { open: String, close: String, isOpen: Boolean },
    saturday: { open: String, close: String, isOpen: Boolean },
    sunday: { open: String, close: String, isOpen: Boolean }
  },
  // Payment & Pricing
  paymentMethods: [{
    type: String,
    enum: ['cash', 'bank_transfer', 'card', 'mobile_money'],
    default: ['cash']
  }],
  pricingModel: {
    type: String,
    enum: ['fixed', 'hourly', 'project_based', 'estimate'],
    default: 'estimate'
  },
  // Social Links
  socialLinks: {
    website: String,
    facebook: String,
    instagram: String,
    twitter: String,
    linkedin: String,
    whatsapp: String
  },
  // Verification & Trust
  verificationDocuments: [{
    type: {
      type: String,
      enum: ['id_card', 'business_registration', 'trade_certificate', 'utility_bill']
    },
    url: String,
    verified: Boolean,
    verifiedAt: Date
  }],
  isVerified: {
    type: Boolean,
    default: false
  },
  backgroundCheck: {
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'failed'],
      default: 'pending'
    },
    completedAt: Date,
    referenceId: String
  },
  // Metrics
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  completedJobs: {
    type: Number,
    default: 0
  },
  responseRate: {
    type: Number,
    default: 0
  },
  averageResponseTime: {
    type: String, // e.g., "within 2 hours"
    default: 'N/A'
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  // Profile Completion
  profileCompletionScore: {
    type: Number,
    default: 0
  },
  profileCompletedSteps: [{
    step: String,
    completed: Boolean,
    completedAt: Date
  }]
}, {
  timestamps: true
});

// Calculate profile completion before save
serviceProviderSchema.pre('save', function(next) {
  const steps = [
    { step: 'basic_info', check: () => this.companyName && this.serviceType && this.businessDescription },
    { step: 'contact_info', check: () => this.businessAddress?.city && this.businessAddress?.state },
    { step: 'services', check: () => this.servicesOffered && this.servicesOffered.length > 0 },
    { step: 'experience', check: () => this.yearsOfExperience > 0 },
    { step: 'license', check: () => this.license?.number },
    { step: 'insurance', check: () => this.insurance?.provider },
    { step: 'portfolio', check: () => this.portfolioImages && this.portfolioImages.length > 0 },
    { step: 'business_hours', check: () => this.businessHours?.monday?.isOpen },
    { step: 'payment', check: () => this.paymentMethods && this.paymentMethods.length > 0 },
    { step: 'verification', check: () => this.isVerified }
  ];

  this.profileCompletedSteps = steps.map(s => ({
    step: s.step,
    completed: s.check(),
    completedAt: s.check() ? new Date() : null
  }));

  const completedCount = this.profileCompletedSteps.filter(s => s.completed).length;
  this.profileCompletionScore = Math.round((completedCount / steps.length) * 100);

  next();
});

// Indexes
serviceProviderSchema.index({ serviceType: 1, rating: -1 });
serviceProviderSchema.index({ 'serviceArea.city': 1, 'serviceArea.state': 1 });
serviceProviderSchema.index({ isAvailable: 1, isVerified: 1 });
serviceProviderSchema.index({ profileCompletionScore: -1 });

const ServiceProvider = mongoose.model('ServiceProvider', serviceProviderSchema);
module.exports = ServiceProvider;