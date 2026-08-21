// middleware/requireSubscription.js
//
// Gates provider actions that represent being active in the marketplace -
// browsing/applying to job postings. Requires an approved profile AND a
// subscription that hasn't expired (checked live against expiresAt, never
// a cached flag, so this is always correct regardless of scheduler timing).
const ServiceProvider = require('../models/ServiceProvider');

const requireActiveSubscription = async (req, res, next) => {
  try {
    const provider = await ServiceProvider.findOne({ user: req.user.id });
    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider profile not found' });
    }
    if (provider.verificationStatus !== 'approved') {
      return res.status(403).json({ success: false, message: 'Your profile must be approved first' });
    }

    const isSubscribed = provider.subscription?.expiresAt && provider.subscription.expiresAt > new Date();
    if (!isSubscribed) {
      return res.status(402).json({
        success: false,
        message: 'An active subscription is required for this action',
        code: 'SUBSCRIPTION_REQUIRED'
      });
    }

    req.provider = provider;
    next();
  } catch (error) {
    console.error('requireActiveSubscription error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify subscription status' });
  }
};

module.exports = { requireActiveSubscription };
