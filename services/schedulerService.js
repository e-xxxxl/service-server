// services/schedulerService.js
const cron = require('node-cron');
const ServiceProvider = require('../models/ServiceProvider');
const User = require('../models/User');
const emailService = require('./emailService');

// Admin emails to notify
const ADMIN_EMAILS = [
  'admin@9jatradiespages.com',
  'adm@9jatradiespages.com'
];

// Guards against overlapping ticks within this process - a full pass
// awaits an external email API call per pending provider, which can easily
// take longer than the tick interval once there are more than a couple of
// providers due for a reminder.
let reminderRunInProgress = false;

// Schedule: check every 5 minutes for unverified providers due a reminder.
// (A 1-hour-wide eligibility window doesn't need minute-level polling -
// checking every 5 minutes still catches everyone comfortably inside it,
// with far less overlap risk and Resend API load.)
const scheduleReminderEmails = () => {
  cron.schedule('*/5 * * * *', async () => {
    if (reminderRunInProgress) {
      console.log('⏭️  Skipping reminder check - previous run still in progress');
      return;
    }
    reminderRunInProgress = true;
    try {
      console.log('🔔 Checking for providers needing reminder emails...');

      const now = new Date();

      // Find providers with 'pending' or 'submitted' status who signed up within last 24 hours
      const providers = await ServiceProvider.find({
        verificationStatus: { $in: ['pending', 'submitted'] },
        user: { $exists: true }
      }).populate('user', 'email fullName createdAt');

      for (const provider of providers) {
        if (!provider.user) continue;

        const signupTime = provider.user.createdAt;
        const hoursSinceSignup = (now - signupTime) / (1000 * 60 * 60);

        // Check if 1 hour reminder should be sent. The flag flip happens
        // atomically and *before* the email send, filtered on the flag
        // still being false - this is the same claim-before-act pattern
        // used for payment fulfillment (see paymentController.js). It's
        // what actually prevents duplicate sends under overlapping ticks
        // or multiple server processes hitting the same DB; checking the
        // in-memory flag on `provider` first is not enough on its own.
        if (hoursSinceSignup >= 1 && hoursSinceSignup < 2 && !provider.reminderSent1hr) {
          const claimed = await ServiceProvider.findOneAndUpdate(
            { _id: provider._id, reminderSent1hr: false },
            { reminderSent1hr: true }
          );
          if (claimed) {
            console.log(`📧 Sending 1hr reminder to ${provider.user.email}`);
            await sendReminderEmail(provider, '1hour');
          }
        }

        // Check if 24 hour reminder should be sent (same atomic claim)
        if (hoursSinceSignup >= 24 && hoursSinceSignup < 25 && !provider.reminderSent24hr) {
          const claimed = await ServiceProvider.findOneAndUpdate(
            { _id: provider._id, reminderSent24hr: false },
            { reminderSent24hr: true }
          );
          if (claimed) {
            console.log(`📧 Sending 24hr reminder to ${provider.user.email}`);
            await sendReminderEmail(provider, '24hours');
          }
        }
      }
    } catch (error) {
      console.error('Reminder email error:', error);
    } finally {
      reminderRunInProgress = false;
    }
  });

  console.log('✅ Reminder email scheduler started');
};

// Send reminder email
const sendReminderEmail = async (provider, type) => {
  const timeText = type === '1hour' ? '1 hour ago' : '24 hours ago';
  const urgencyText = type === '1hour' ? 'We noticed you haven\'t completed your verification yet.' : 'Your profile is still not verified. Don\'t miss out on potential customers!';
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1E7A34;">Complete Your Provider Verification</h2>
      <p>Hi ${provider.user?.fullName || 'there'},</p>
      <p>You signed up on 9jaTradiesPages ${timeText}. ${urgencyText}</p>
      <p><strong>Complete your verification to:</strong></p>
      <ul>
        <li>Get listed on our platform</li>
        <li>Receive job requests from customers</li>
        <li>Build your reputation</li>
      </ul>
      <p>
        <a href="${process.env.CLIENT_URL}/provider-dashboard" 
           style="background-color: #F0821E; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Complete Verification Now
        </a>
      </p>
      <p style="color: #666; font-size: 14px;">If you need help, reply to this email.</p>
    </div>
  `;
  
  return emailService.sendEmail({
    to: provider.user.email,
    subject: type === '1hour' ? 'Complete Your Provider Verification' : 'Reminder: Verify Your Provider Profile',
    html
  });
};

// Guards against overlapping ticks, same reasoning as reminderRunInProgress above.
let subscriptionRunInProgress = false;
const SUBSCRIPTION_FEE = 10000;
const EXPIRING_SOON_WINDOW_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
const NAG_THROTTLE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Three independent, atomically-claimed buckets - each provider can only
// ever be claimed once per email per cycle (see the dedupe fields on
// ServiceProvider.subscription), so overlapping ticks or duplicate
// processes can't double-send, the same fix already applied above for
// verification reminders. Exported standalone (not just wrapped in the cron
// callback below) so it can also be triggered on demand - e.g. running it
// once right after this feature ships, instead of waiting for the next
// scheduled 08:00 tick to notify existing providers.
const runSubscriptionReminderTick = async () => {
    if (subscriptionRunInProgress) {
      console.log('⏭️  Skipping subscription check - previous run still in progress');
      return;
    }
    subscriptionRunInProgress = true;
    try {
      console.log('💳 Checking provider subscriptions...');
      const now = new Date();

      // Bucket A: expiring within 3 days, not yet reminded for this expiry cycle.
      const expiringSoon = await ServiceProvider.find({
        verificationStatus: 'approved',
        'subscription.isActive': true,
        'subscription.expiresAt': { $gt: now, $lte: new Date(now.getTime() + EXPIRING_SOON_WINDOW_MS) }
      }).populate('user', 'email fullName');

      for (const provider of expiringSoon) {
        if (!provider.user) continue;
        const expiresAt = provider.subscription.expiresAt;
        if (provider.subscription.expiringReminderSentFor?.getTime() === expiresAt.getTime()) continue;

        const claimed = await ServiceProvider.findOneAndUpdate(
          { _id: provider._id, 'subscription.expiresAt': expiresAt, 'subscription.expiringReminderSentFor': { $ne: expiresAt } },
          { 'subscription.expiringReminderSentFor': expiresAt }
        );
        if (claimed) {
          console.log(`📧 Sending subscription-expiring reminder to ${provider.user.email}`);
          await emailService.sendSubscriptionExpiringEmail(provider.user, { expiresAt, fee: SUBSCRIPTION_FEE });
        }
      }

      // Bucket B: just crossed the expiry line - one-time "expired" notice,
      // and the moment isActive gets synced false to match reality.
      const justExpired = await ServiceProvider.find({
        verificationStatus: 'approved',
        'subscription.isActive': true,
        'subscription.expiresAt': { $lte: now }
      }).populate('user', 'email fullName');

      for (const provider of justExpired) {
        if (!provider.user) continue;
        const expiresAt = provider.subscription.expiresAt;

        const claimed = await ServiceProvider.findOneAndUpdate(
          { _id: provider._id, 'subscription.isActive': true, 'subscription.expiresAt': expiresAt },
          { 'subscription.isActive': false, 'subscription.expiredReminderSentFor': expiresAt, 'subscription.lastSubscriptionNagAt': now }
        );
        if (claimed) {
          console.log(`📧 Sending subscription-expired notice to ${provider.user.email}`);
          await emailService.sendSubscriptionExpiredEmail(provider.user, { fee: SUBSCRIPTION_FEE });
        }
      }

      // Bucket C: approved, currently unsubscribed (never subscribed or
      // lapsed a while ago), periodic weekly re-nag so it's not a one-shot.
      const staleNagCutoff = new Date(now.getTime() - NAG_THROTTLE_MS);
      const needsNag = await ServiceProvider.find({
        verificationStatus: 'approved',
        $or: [
          { 'subscription.expiresAt': { $exists: false } },
          { 'subscription.expiresAt': null },
          { 'subscription.expiresAt': { $lte: now } }
        ],
        $and: [
          { $or: [
            { 'subscription.lastSubscriptionNagAt': { $exists: false } },
            { 'subscription.lastSubscriptionNagAt': null },
            { 'subscription.lastSubscriptionNagAt': { $lte: staleNagCutoff } }
          ] }
        ]
      }).populate('user', 'email fullName');

      for (const provider of needsNag) {
        if (!provider.user) continue;

        const claimed = await ServiceProvider.findOneAndUpdate(
          {
            _id: provider._id,
            $or: [
              { 'subscription.lastSubscriptionNagAt': { $exists: false } },
              { 'subscription.lastSubscriptionNagAt': null },
              { 'subscription.lastSubscriptionNagAt': { $lte: staleNagCutoff } }
            ]
          },
          { 'subscription.lastSubscriptionNagAt': now }
        );
        if (claimed) {
          console.log(`📧 Sending subscription-required nag to ${provider.user.email}`);
          await emailService.sendSubscriptionRequiredEmail(provider.user, { fee: SUBSCRIPTION_FEE });
        }
      }
    } catch (error) {
      console.error('Subscription scheduler error:', error);
    } finally {
      subscriptionRunInProgress = false;
    }
};

const scheduleSubscriptionReminders = () => {
  cron.schedule('0 8 * * *', runSubscriptionReminderTick); // once daily, 08:00 server time
  console.log('✅ Subscription reminder scheduler started');
};

// Send admin notification on new signup
const notifyAdminsOnSignup = async (user, accountType) => {
  try {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1E7A34;">New User Signup on 9jaTradiesPages</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px; font-weight: bold;">Name:</td><td style="padding: 8px;">${user.fullName || 'N/A'}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Email:</td><td style="padding: 8px;">${user.email}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Account Type:</td><td style="padding: 8px;">${accountType}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Date:</td><td style="padding: 8px;">${new Date().toLocaleString()}</td></tr>
        </table>
        <p>
          <a href="${process.env.CLIENT_URL}/admin/dashboard" 
             style="background-color: #F0821E; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View in Admin Dashboard
          </a>
        </p>
      </div>
    `;
    
    // Send to all admin emails
    for (const adminEmail of ADMIN_EMAILS) {
      await emailService.sendEmail({
        to: adminEmail,
        subject: `New ${accountType} Signup: ${user.fullName || user.email}`,
        html
      });
    }
    
    console.log(`✅ Admin notifications sent for new ${accountType}: ${user.email}`);
  } catch (error) {
    console.error('Admin notification error:', error);
  }
};

module.exports = { scheduleReminderEmails, scheduleSubscriptionReminders, runSubscriptionReminderTick, notifyAdminsOnSignup, ADMIN_EMAILS };