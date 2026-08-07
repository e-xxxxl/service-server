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

// Schedule: Run every minute to check for unverified providers
const scheduleReminderEmails = () => {
  // Check every minute
  cron.schedule('* * * * *', async () => {
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
        
        // Check if 1 hour reminder should be sent
        if (hoursSinceSignup >= 1 && hoursSinceSignup < 2 && !provider.reminderSent1hr) {
          console.log(`📧 Sending 1hr reminder to ${provider.user.email}`);
          await sendReminderEmail(provider, '1hour');
          provider.reminderSent1hr = true;
          await provider.save();
        }
        
        // Check if 24 hour reminder should be sent
        if (hoursSinceSignup >= 24 && hoursSinceSignup < 25 && !provider.reminderSent24hr) {
          console.log(`📧 Sending 24hr reminder to ${provider.user.email}`);
          await sendReminderEmail(provider, '24hours');
          provider.reminderSent24hr = true;
          await provider.save();
        }
      }
    } catch (error) {
      console.error('Reminder email error:', error);
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

module.exports = { scheduleReminderEmails, notifyAdminsOnSignup };