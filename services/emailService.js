// src/services/emailService.js
const { Resend } = require('resend');

// Initialize Resend with your API key
const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async ({ to, subject, html, replyTo }) => {
  try {
    console.log('Attempting to send email...');
    console.log('   From:', process.env.EMAIL_FROM);
    console.log('   To:', to);
    console.log('   Subject:', subject);

    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || '9jaTradiesPages <onboarding@resend.dev>',
      to: Array.isArray(to) ? to : [to],
      subject: subject,
      html: html,
      ...(replyTo ? { reply_to: replyTo } : {})
    });

    if (error) {
      console.error('Resend API Error:', error);
      return {
        success: false,
        error: error.message || 'Failed to send email'
      };
    }

    if (data?.id) {
      console.log('Email sent successfully. Message ID:', data.id);
      return { success: true, data };
    }

    console.log('Unexpected Resend response:', data);
    return { success: false, error: 'Unknown response from Resend' };

  } catch (error) {
    console.error('Email exception:', error.message);

    if (error.statusCode === 403) {
      console.error('   -> Sandbox mode: You can only send to verified emails');
      console.error('   -> Add this email to your Resend dashboard or verify your domain');
    }

    return { success: false, error: error.message };
  }
};

// -----------------------------------------------------------------------
// Brand tokens
// -----------------------------------------------------------------------
// Drop your hosted logo URL into EMAIL_LOGO_URL (env var) once you have it.
// Use a PNG on a transparent background, ~240px wide, roughly 2x for retina.

const LOGO_URL = process.env.EMAIL_LOGO_URL || 'https://res.cloudinary.com/dhkzg2gfk/image/upload/v1784025651/IMG-20260711-WA0220_kwrxzu.jpg';
const BRAND_NAME = '9jaTradiesPages';

const INK = '#1c1f26';
const INK_SOFT = '#4b5261';
const MUTED = '#8a90a0';
const BORDER = '#e8e9ee';
const BG = '#eef0f4';
const CARD_BG = '#ffffff';
const ACCENT = '#f06d00';
const ACCENT_DARK = '#c95a00';

// -----------------------------------------------------------------------
// Shared layout pieces
// -----------------------------------------------------------------------

const emailShell = (preheader, bodyContent) => `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${BRAND_NAME}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: ${BG}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <!-- Preheader, hidden from view but shown in inbox preview -->
    <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">
      ${preheader}
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BG};">
      <tr>
        <td align="center" style="padding: 32px 16px;">

          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width: 560px; max-width: 100%;">

            <!-- Logo -->
            <tr>
              <td style="padding: 8px 4px 20px 4px;">
                <img src="${LOGO_URL}" alt="${BRAND_NAME}" height="40" style="height: 40px; width: auto; max-width: 160px; display: block; border: 0; border-radius: 6px;" />
              </td>
            </tr>

            <!-- Card -->
            <tr>
              <td style="background-color: ${CARD_BG}; border: 1px solid ${BORDER}; border-radius: 10px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding: 40px 40px 32px 40px;">
                      ${bodyContent}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding: 24px 8px 0 8px;">
                <p style="margin: 0 0 6px 0; font-size: 12.5px; line-height: 1.6; color: ${MUTED};">
                  ${BRAND_NAME} &middot; Connecting Nigerians with trusted local tradespeople
                </p>
                <p style="margin: 0; font-size: 12.5px; line-height: 1.6; color: ${MUTED};">
                  &copy; ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
`;

const button = (url, label) => `
  <a href="${url}" style="display: inline-block; padding: 12px 24px; background-color: ${ACCENT}; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; line-height: 1;">
    ${label}
  </a>
`;

// A quiet, left-bordered note instead of a heavy colored panel — reads calmer and more like a real product email.
const note = (content, tone = 'neutral') => {
  const tones = {
    neutral: { border: BORDER, text: INK_SOFT },
    warning: { border: '#e0a336', text: '#7a5210' },
  };
  const c = tones[tone] || tones.neutral;

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0 0 0;">
      <tr>
        <td style="border-left: 3px solid ${c.border}; padding: 4px 0 4px 16px; font-size: 13.5px; line-height: 1.6; color: ${c.text};">
          ${content}
        </td>
      </tr>
    </table>
  `;
};

const fallbackLink = (url) => `
  <p style="margin: 20px 0 0 0; font-size: 13px; line-height: 1.6; color: ${MUTED};">
    If the button above doesn't work, copy and paste this link into your browser:<br />
    <a href="${url}" style="color: ${ACCENT_DARK}; text-decoration: underline; word-break: break-all;">${url}</a>
  </p>
`;

const eyebrow = (text) => `
  <p style="margin: 0 0 10px 0; font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: ${ACCENT_DARK};">
    ${text}
  </p>
`;

// -----------------------------------------------------------------------
// Verification Email
// -----------------------------------------------------------------------

const getVerificationEmailTemplate = (user, verificationUrl) => {
  const firstName = user.fullName?.split(' ')[0] || 'there';

  const body = `
    ${eyebrow('Verify your email')}
    <h1 style="margin: 0 0 14px 0; font-size: 21px; line-height: 1.35; color: ${INK}; font-weight: 700;">
      Confirm your email address
    </h1>
    <p style="margin: 0 0 28px 0; font-size: 15px; line-height: 1.7; color: ${INK_SOFT};">
      Hi ${firstName}, thanks for signing up with ${BRAND_NAME}. Please confirm this is your email address to activate your account.
    </p>

    ${button(verificationUrl, 'Verify email address')}
    ${fallbackLink(verificationUrl)}

    ${note('This link expires in <strong>24 hours</strong> and can only be used once. If you didn\'t create an account with us, you can safely ignore this email.')}

    <p style="margin: 28px 0 0 0; font-size: 13.5px; line-height: 1.6; color: ${MUTED};">
      Questions? Reach us any time at <a href="mailto:support@9jatradiespages.com" style="color: ${ACCENT_DARK}; text-decoration: none;">support@9jatradiespages.com</a>.
    </p>
  `; 

  return emailShell('Confirm your email to activate your account.', body);
};

// -----------------------------------------------------------------------
// Welcome Email
// -----------------------------------------------------------------------

const getWelcomeEmailTemplate = (user, dashboardUrl) => {
  const firstName = user.fullName?.split(' ')[0] || 'there';
  const isProvider = user.accountType === 'provider';

  const nextSteps = isProvider ? `
    <li style="margin-bottom: 6px;">Complete your provider profile</li>
    <li style="margin-bottom: 6px;">Set your service areas and availability</li>
    <li style="margin-bottom: 6px;">Upload verification documents</li>
    <li>Start receiving job requests</li>
  ` : `
    <li style="margin-bottom: 6px;">Browse verified tradespeople near you</li>
    <li style="margin-bottom: 6px;">Compare reviews and ratings</li>
    <li style="margin-bottom: 6px;">Request free quotes</li>
    <li>Message providers directly to book</li>
  `;

  const body = `
    ${eyebrow('Account verified')}
    <h1 style="margin: 0 0 14px 0; font-size: 21px; line-height: 1.35; color: ${INK}; font-weight: 700;">
      Welcome, ${firstName}
    </h1>
    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.7; color: ${INK_SOFT};">
      Your email is verified and your account is ready to go${isProvider ? ' as a service provider' : ''}.
    </p>

    <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: ${INK};">
      A few things to do next
    </p>
    <ul style="margin: 0 0 28px 0; padding-left: 20px; font-size: 14.5px; line-height: 1.6; color: ${INK_SOFT};">
      ${nextSteps}
    </ul>

    ${button(dashboardUrl, 'Go to your dashboard')}

    <p style="margin: 28px 0 0 0; font-size: 13.5px; line-height: 1.6; color: ${MUTED};">
      Need a hand getting started? Visit our <a href="${process.env.CLIENT_URL}/help" style="color: ${ACCENT_DARK}; text-decoration: none;">Help Center</a> or just reply to this email.
    </p>
  `;

  return emailShell('Your account is verified and ready to go.', body);
};

// -----------------------------------------------------------------------
// Password Reset Email
// -----------------------------------------------------------------------

const getResetPasswordEmailTemplate = (user, resetUrl) => {
  const firstName = user.fullName?.split(' ')[0] || 'there';

  const body = `
    ${eyebrow('Password reset')}
    <h1 style="margin: 0 0 14px 0; font-size: 21px; line-height: 1.35; color: ${INK}; font-weight: 700;">
      Reset your password
    </h1>
    <p style="margin: 0 0 28px 0; font-size: 15px; line-height: 1.7; color: ${INK_SOFT};">
      Hi ${firstName}, we received a request to reset the password on your ${BRAND_NAME} account. Click below to choose a new one.
    </p>

    ${button(resetUrl, 'Reset password')}
    ${fallbackLink(resetUrl)}

    ${note('This link expires in <strong>1 hour</strong>. If you didn\'t request a password reset, please ignore this email or contact support immediately.', 'warning')}
  `;

  return emailShell('Reset your password — this link expires in 1 hour.', body);
};

// -----------------------------------------------------------------------
// Convenience functions
// -----------------------------------------------------------------------

const sendVerificationEmail = async (user, token) => {
  const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${token}`;
  const html = getVerificationEmailTemplate(user, verificationUrl);

  return sendEmail({
    to: user.email,
    subject: 'Verify your email address',
    html
  });
};

const sendWelcomeEmail = async (user) => {
  const dashboardUrl = `${process.env.CLIENT_URL}/dashboard`;
  const html = getWelcomeEmailTemplate(user, dashboardUrl);

  return sendEmail({
    to: user.email,
    subject: `Welcome to ${BRAND_NAME}`,
    html
  });
};

const sendPasswordResetEmail = async (user, token) => {
  // Must match the route in App.jsx, which is a path param
  // (/reset-password/:token, read via useParams in ResetPassword.jsx) -
  // not a query string. Mismatching these sends users to the app's 404.
  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${token}`;
  const html = getResetPasswordEmailTemplate(user, resetUrl);

  return sendEmail({
    to: user.email,
    subject: 'Reset your password',
    html
  });
};


// src/services/emailService.js - Add these templates

// -----------------------------------------------------------------------
// Provider Approval Email
// -----------------------------------------------------------------------

const getProviderApprovalEmailTemplate = (user, provider) => {
  const firstName = user.fullName?.split(' ')[0] || 'there';
  const dashboardUrl = `${process.env.CLIENT_URL}/provider-dashboard`;

  const body = `
    ${eyebrow('Profile Approved 🎉')}
    <h1 style="margin: 0 0 14px 0; font-size: 21px; line-height: 1.35; color: ${INK}; font-weight: 700;">
      Congratulations, ${firstName}!
    </h1>
    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.7; color: ${INK_SOFT};">
      Great news! Your provider profile for <strong>${provider.companyName || 'your business'}</strong> has been verified and approved. Your profile is now visible to customers searching for <strong>${provider.serviceType || 'your services'}</strong> in ${provider.city}, ${provider.state}.
    </p>

    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 0 0 28px 0;">
      <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #166534;">
        ✅ What happens next:
      </p>
      <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6; color: #15803d;">
        <li style="margin-bottom: 4px;">Customers can now find you in search results</li>
        <li style="margin-bottom: 4px;">You'll receive job requests and messages</li>
        <li style="margin-bottom: 4px;">Keep your availability updated</li>
        <li>Respond promptly to increase your rating</li>
      </ul>
    </div>

    ${button(dashboardUrl, 'Go to Your Dashboard')}

    <p style="margin: 28px 0 0 0; font-size: 13.5px; line-height: 1.6; color: ${MUTED};">
      Need help getting started? Reply to this email or visit our <a href="${process.env.CLIENT_URL}/help" style="color: ${ACCENT_DARK}; text-decoration: none;">Help Center</a>.
    </p>
  `;

  return emailShell('Your provider profile has been approved!', body);
};

// -----------------------------------------------------------------------
// Provider Rejection Email
// -----------------------------------------------------------------------

const getProviderRejectionEmailTemplate = (user, provider, reason) => {
  const firstName = user.fullName?.split(' ')[0] || 'there';
  const resubmitUrl = `${process.env.CLIENT_URL}/provider-dashboard`;

  const body = `
    ${eyebrow('Profile Needs Updates')}
    <h1 style="margin: 0 0 14px 0; font-size: 21px; line-height: 1.35; color: ${INK}; font-weight: 700;">
      Action Required, ${firstName}
    </h1>
    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.7; color: ${INK_SOFT};">
      Thank you for submitting your provider profile for <strong>${provider.companyName || 'your business'}</strong>. After reviewing your documents, we need some updates before we can approve your profile.
    </p>

    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 0 0 28px 0;">
      <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #991b1b;">
        ❌ Reason for rejection:
      </p>
      <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #dc2626;">
        ${reason}
      </p>
    </div>

    <div style="background-color: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 16px; margin: 0 0 28px 0;">
      <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #9a3412;">
        📋 Common fixes:
      </p>
      <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6; color: #c2410c;">
        <li style="margin-bottom: 4px;">Upload a clearer NIN document or photo</li>
        <li style="margin-bottom: 4px;">Provide a clear, well-lit selfie showing your face</li>
        <li style="margin-bottom: 4px;">Enter your correct NIN number</li>
        <li>Update your business address and contact information</li>
      </ul>
    </div>

    ${button(resubmitUrl, 'Update & Resubmit')}

    <p style="margin: 28px 0 0 0; font-size: 13.5px; line-height: 1.6; color: ${MUTED};">
      You can resubmit your verification documents anytime from your dashboard. If you have questions, reply to this email and our support team will help.
    </p>
  `;

  return emailShell('Update required for your provider profile', body);
};

// -----------------------------------------------------------------------
// New Provider Submitted (Admin Notification)
// -----------------------------------------------------------------------

const getNewProviderSubmissionEmailTemplate = (provider) => {
  const adminUrl = `${process.env.CLIENT_URL}/admin/dashboard`;

  const body = `
    ${eyebrow('New Verification Request')}
    <h1 style="margin: 0 0 14px 0; font-size: 21px; line-height: 1.35; color: ${INK}; font-weight: 700;">
      New Provider Submitted
    </h1>
    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.7; color: ${INK_SOFT};">
      <strong>${provider.companyName || 'A new provider'}</strong> has submitted their profile for verification.
    </p>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 0 0 28px 0;">
      <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: ${INK};">Provider Details:</p>
      <table style="font-size: 13px; line-height: 1.6; color: ${INK_SOFT};">
        <tr><td style="padding: 2px 8px 2px 0; font-weight: 500;">Company:</td><td>${provider.companyName || 'N/A'}</td></tr>
        <tr><td style="padding: 2px 8px 2px 0; font-weight: 500;">Service:</td><td>${provider.serviceType || 'N/A'}</td></tr>
        <tr><td style="padding: 2px 8px 2px 0; font-weight: 500;">Location:</td><td>${provider.city || ''}, ${provider.state || ''}</td></tr>
        <tr><td style="padding: 2px 8px 2px 0; font-weight: 500;">NIN:</td><td>${provider.nin?.number || 'N/A'}</td></tr>
      </table>
    </div>

    ${button(adminUrl, 'Review Provider')}

    <p style="margin: 28px 0 0 0; font-size: 13.5px; line-height: 1.6; color: ${MUTED};">
      This provider is waiting for review. Please verify their documents at your earliest convenience.
    </p>
  `;

  return emailShell('New provider submitted for verification', body);
};

// -----------------------------------------------------------------------
// Payment Confirmation Email (customer + provider)
// -----------------------------------------------------------------------

const getPaymentConfirmationEmailTemplate = ({ recipientName, isProvider, otherPartyName, amount, reference }) => {
  const firstName = recipientName?.split(' ')[0] || 'there';
  const formattedAmount = `₦${Number(amount || 0).toLocaleString()}`;
  const dashboardUrl = `${process.env.CLIENT_URL}/${isProvider ? 'provider-dashboard' : 'dashboard'}`;

  const body = `
    ${eyebrow('Payment confirmed')}
    <h1 style="margin: 0 0 14px 0; font-size: 21px; line-height: 1.35; color: ${INK}; font-weight: 700;">
      ${isProvider ? 'You just got paid' : 'Payment successful'}
    </h1>
    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.7; color: ${INK_SOFT};">
      ${isProvider
        ? `Hi ${firstName}, ${otherPartyName || 'your customer'} just paid <strong>${formattedAmount}</strong> for the job you quoted. It's been added to your wallet and the job is now active.`
        : `Hi ${firstName}, your payment of <strong>${formattedAmount}</strong> to ${otherPartyName || 'your provider'} was successful. The job is now active and you can reach them directly in your conversation.`}
    </p>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 0 0 28px 0;">
      <table style="font-size: 13px; line-height: 1.6; color: ${INK_SOFT};">
        <tr><td style="padding: 2px 8px 2px 0; font-weight: 500;">Amount:</td><td>${formattedAmount}</td></tr>
        <tr><td style="padding: 2px 8px 2px 0; font-weight: 500;">Reference:</td><td>${reference}</td></tr>
      </table>
    </div>

    ${button(dashboardUrl, isProvider ? 'View your wallet' : 'View your job')}
  `;

  return emailShell(isProvider ? 'A customer just paid you.' : 'Your payment was successful.', body);
};

// -----------------------------------------------------------------------
// Convenience Functions
// -----------------------------------------------------------------------

const sendPaymentConfirmationEmail = async (user, { isProvider, otherPartyName, amount, reference }) => {
  const html = getPaymentConfirmationEmailTemplate({ recipientName: user.fullName, isProvider, otherPartyName, amount, reference });
  return sendEmail({
    to: user.email,
    subject: isProvider ? 'Payment received — job is now active' : 'Payment successful',
    html
  });
};

const sendApprovalEmail = async (user, provider) => {
  const html = getProviderApprovalEmailTemplate(user, provider);
  return sendEmail({
    to: user.email,
    subject: '🎉 Your Provider Profile Has Been Approved!',
    html
  });
};

const sendRejectionEmail = async (user, provider, reason) => {
  const html = getProviderRejectionEmailTemplate(user, provider, reason);
  return sendEmail({
    to: user.email,
    subject: 'Action Required: Update Your Provider Profile',
    html
  });
};

const sendNewProviderSubmissionEmail = async (adminEmail, provider) => {
  const html = getNewProviderSubmissionEmailTemplate(provider);
  return sendEmail({
    to: adminEmail,
    subject: `New Verification: ${provider.companyName || 'Provider'} - ${provider.serviceType || 'Service'}`,
    html
  });
};

// -----------------------------------------------------------------------
// Withdrawal Requested Email (to admin)
// -----------------------------------------------------------------------

const getWithdrawalRequestedEmailTemplate = ({ providerName, companyName, amount, bankDetails }) => {
  const adminUrl = `${process.env.CLIENT_URL}/admin/dashboard`;

  const body = `
    ${eyebrow('Withdrawal Requested')}
    <h1 style="margin: 0 0 14px 0; font-size: 21px; line-height: 1.35; color: ${INK}; font-weight: 700;">
      ₦${amount.toLocaleString()} withdrawal requested
    </h1>
    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.7; color: ${INK_SOFT};">
      <strong>${companyName || providerName}</strong> (${providerName}) has requested a withdrawal. Review and approve or reject it from the admin dashboard.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f7f8fa; border: 1px solid ${BORDER}; border-radius: 8px; margin: 0 0 28px 0;">
      <tr><td style="padding: 16px 18px; font-size: 14px; line-height: 1.9; color: ${INK_SOFT};">
        <strong style="color: ${INK};">Amount:</strong> ₦${amount.toLocaleString()}<br />
        <strong style="color: ${INK};">Bank:</strong> ${bankDetails?.bankName || 'N/A'}<br />
        <strong style="color: ${INK};">Account number:</strong> ${bankDetails?.accountNumber || 'N/A'}<br />
        <strong style="color: ${INK};">Account name:</strong> ${bankDetails?.accountName || 'N/A'}<br />
        <strong style="color: ${INK};">WhatsApp:</strong> ${bankDetails?.whatsappNumber || 'N/A'}
      </td></tr>
    </table>

    ${button(adminUrl, 'Review withdrawal')}
  `;

  return emailShell(`${companyName || providerName} requested a ₦${amount.toLocaleString()} withdrawal.`, body);
};

const sendWithdrawalRequestedEmail = async (adminEmail, data) => {
  const html = getWithdrawalRequestedEmailTemplate(data);
  return sendEmail({
    to: adminEmail,
    subject: `Withdrawal Requested: ₦${data.amount.toLocaleString()} - ${data.companyName || data.providerName}`,
    html
  });
};

// -----------------------------------------------------------------------
// Withdrawal Approved Email (to provider)
// -----------------------------------------------------------------------

const getWithdrawalApprovedEmailTemplate = (user, { amount, receiptUrl }) => {
  const firstName = user.fullName?.split(' ')[0] || 'there';
  const walletUrl = `${process.env.CLIENT_URL}/provider-dashboard`;

  const body = `
    ${eyebrow('Withdrawal Approved')}
    <h1 style="margin: 0 0 14px 0; font-size: 21px; line-height: 1.35; color: ${INK}; font-weight: 700;">
      Your withdrawal is on its way, ${firstName}
    </h1>
    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.7; color: ${INK_SOFT};">
      Your withdrawal request for <strong>₦${amount.toLocaleString()}</strong> has been approved and sent to your bank account.
    </p>

    ${receiptUrl ? button(receiptUrl, 'View receipt') : ''}
    ${button(walletUrl, 'View your wallet')}

    ${note('It can take a little while to reflect depending on your bank. If it hasn\'t arrived after a day or two, reply to this email.')}
  `;

  return emailShell(`Your ₦${amount.toLocaleString()} withdrawal has been approved.`, body);
};

const sendWithdrawalApprovedEmail = async (user, data) => {
  const html = getWithdrawalApprovedEmailTemplate(user, data);
  return sendEmail({
    to: user.email,
    subject: `Withdrawal Approved: ₦${data.amount.toLocaleString()}`,
    html
  });
};

// -----------------------------------------------------------------------
// Withdrawal Rejected Email (to provider)
// -----------------------------------------------------------------------

const getWithdrawalRejectedEmailTemplate = (user, { amount, reason }) => {
  const firstName = user.fullName?.split(' ')[0] || 'there';
  const walletUrl = `${process.env.CLIENT_URL}/provider-dashboard`;

  const body = `
    ${eyebrow('Withdrawal Rejected')}
    <h1 style="margin: 0 0 14px 0; font-size: 21px; line-height: 1.35; color: ${INK}; font-weight: 700;">
      Your withdrawal request needs attention
    </h1>
    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.7; color: ${INK_SOFT};">
      Hi ${firstName}, your withdrawal request for <strong>₦${amount.toLocaleString()}</strong> was not approved. The amount has been returned to your available balance.
    </p>

    ${note(`<strong>Reason:</strong> ${reason || 'Not specified'}`, 'warning')}

    ${button(walletUrl, 'Go to your wallet')}
  `;

  return emailShell(`Your ₦${amount.toLocaleString()} withdrawal was not approved.`, body);
};

const sendWithdrawalRejectedEmail = async (user, data) => {
  const html = getWithdrawalRejectedEmailTemplate(user, data);
  return sendEmail({
    to: user.email,
    subject: `Withdrawal Rejected: ₦${data.amount.toLocaleString()}`,
    html
  });
};

// -----------------------------------------------------------------------
// Subscription Emails (to provider)
// -----------------------------------------------------------------------

const getSubscriptionRequiredEmailTemplate = (user, { fee = 10000 } = {}) => {
  const firstName = user.fullName?.split(' ')[0] || 'there';
  const walletUrl = `${process.env.CLIENT_URL}/provider-dashboard`;

  const body = `
    ${eyebrow('Subscription Required')}
    <h1 style="margin: 0 0 14px 0; font-size: 21px; line-height: 1.35; color: ${INK}; font-weight: 700;">
      Subscribe to stay visible to customers, ${firstName}
    </h1>
    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.7; color: ${INK_SOFT};">
      9jaTradiesPages now runs on a ₦${fee.toLocaleString()}/month provider subscription. Your account currently
      doesn't have an active subscription, so you won't show up in customer search, can't be contacted, and can't
      view or apply to jobs until you subscribe.
    </p>

    ${button(walletUrl, `Subscribe for ₦${fee.toLocaleString()}/month`)}

    ${note('Subscribing takes a minute and keeps you visible for 30 days from payment.')}
  `;

  return emailShell(`Subscribe for ₦${fee.toLocaleString()}/month to stay visible to customers.`, body);
};

const sendSubscriptionRequiredEmail = async (user, data) => {
  const html = getSubscriptionRequiredEmailTemplate(user, data);
  return sendEmail({
    to: user.email,
    subject: 'Action needed: subscribe to stay visible on 9jaTradiesPages',
    html
  });
};

const getSubscriptionExpiringEmailTemplate = (user, { expiresAt, fee = 10000 }) => {
  const firstName = user.fullName?.split(' ')[0] || 'there';
  const walletUrl = `${process.env.CLIENT_URL}/provider-dashboard`;
  const dateStr = new Date(expiresAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });

  const body = `
    ${eyebrow('Subscription Expiring Soon')}
    <h1 style="margin: 0 0 14px 0; font-size: 21px; line-height: 1.35; color: ${INK}; font-weight: 700;">
      Your subscription expires ${dateStr}
    </h1>
    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.7; color: ${INK_SOFT};">
      Hi ${firstName}, your ₦${fee.toLocaleString()}/month subscription is about to end. Renew before then so you
      stay visible to customers, contactable, and able to view and apply to jobs without interruption.
    </p>

    ${button(walletUrl, `Renew for ₦${fee.toLocaleString()}`)}
  `;

  return emailShell(`Your subscription expires ${dateStr} - renew to stay visible.`, body);
};

const sendSubscriptionExpiringEmail = async (user, data) => {
  const html = getSubscriptionExpiringEmailTemplate(user, data);
  return sendEmail({
    to: user.email,
    subject: 'Your 9jaTradiesPages subscription expires soon',
    html
  });
};

const getSubscriptionExpiredEmailTemplate = (user, { fee = 10000 } = {}) => {
  const firstName = user.fullName?.split(' ')[0] || 'there';
  const walletUrl = `${process.env.CLIENT_URL}/provider-dashboard`;

  const body = `
    ${eyebrow('Subscription Expired')}
    <h1 style="margin: 0 0 14px 0; font-size: 21px; line-height: 1.35; color: ${INK}; font-weight: 700;">
      Your subscription has expired, ${firstName}
    </h1>
    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.7; color: ${INK_SOFT};">
      You're no longer visible in customer search, can't be contacted by new customers, and can't view or apply
      to jobs. Renew any time to come straight back online.
    </p>

    ${button(walletUrl, `Renew for ₦${fee.toLocaleString()}`)}

    ${note('Any job you already have in progress is unaffected - this only blocks new customer contact.')}
  `;

  return emailShell('Your subscription has expired - renew to become visible again.', body);
};

const sendSubscriptionExpiredEmail = async (user, data) => {
  const html = getSubscriptionExpiredEmailTemplate(user, data);
  return sendEmail({
    to: user.email,
    subject: 'Your 9jaTradiesPages subscription has expired',
    html
  });
};

const getSubscriptionConfirmedEmailTemplate = (user, { expiresAt, amount }) => {
  const firstName = user.fullName?.split(' ')[0] || 'there';
  const walletUrl = `${process.env.CLIENT_URL}/provider-dashboard`;
  const dateStr = new Date(expiresAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });

  const body = `
    ${eyebrow('Subscription Active')}
    <h1 style="margin: 0 0 14px 0; font-size: 21px; line-height: 1.35; color: ${INK}; font-weight: 700;">
      You're all set, ${firstName}
    </h1>
    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.7; color: ${INK_SOFT};">
      Your payment of <strong>₦${amount.toLocaleString()}</strong> was confirmed. You're visible to customers,
      contactable, and able to view and apply to jobs until <strong>${dateStr}</strong>.
    </p>

    ${button(walletUrl, 'Go to your dashboard')}
  `;

  return emailShell(`Subscription active until ${dateStr}.`, body);
};

const sendSubscriptionConfirmedEmail = async (user, data) => {
  const html = getSubscriptionConfirmedEmailTemplate(user, data);
  return sendEmail({
    to: user.email,
    subject: 'Subscription confirmed - you\'re visible to customers',
    html
  });
};

// -----------------------------------------------------------------------
// Admin Notifications: Subscription Received, Job Placed, New Job Posting
// -----------------------------------------------------------------------

const getAdminSubscriptionReceivedEmailTemplate = ({ providerName, companyName, amount, expiresAt }) => {
  const adminUrl = `${process.env.CLIENT_URL}/admin/dashboard`;
  const dateStr = new Date(expiresAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });

  const body = `
    ${eyebrow('Subscription Payment')}
    <h1 style="margin: 0 0 14px 0; font-size: 21px; line-height: 1.35; color: ${INK}; font-weight: 700;">
      ₦${amount.toLocaleString()} subscription payment received
    </h1>
    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.7; color: ${INK_SOFT};">
      <strong>${companyName || providerName}</strong> (${providerName}) paid ₦${amount.toLocaleString()} and is now active until ${dateStr}.
    </p>
    ${button(adminUrl, 'View subscriptions')}
  `;

  return emailShell(`${companyName || providerName} paid ₦${amount.toLocaleString()} for their subscription.`, body);
};

const sendAdminSubscriptionReceivedEmail = async (adminEmail, data) => {
  const html = getAdminSubscriptionReceivedEmailTemplate(data);
  return sendEmail({
    to: adminEmail,
    subject: `Subscription Payment: ₦${data.amount.toLocaleString()} - ${data.companyName || data.providerName}`,
    html
  });
};

const getAdminJobPlacedEmailTemplate = ({ customerName, providerName, companyName, amount, serviceType }) => {
  const adminUrl = `${process.env.CLIENT_URL}/admin/dashboard`;

  const body = `
    ${eyebrow('Job Placed')}
    <h1 style="margin: 0 0 14px 0; font-size: 21px; line-height: 1.35; color: ${INK}; font-weight: 700;">
      A ₦${amount.toLocaleString()} job just went active
    </h1>
    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.7; color: ${INK_SOFT};">
      <strong>${customerName}</strong> paid <strong>${companyName || providerName}</strong> ₦${amount.toLocaleString()}
      for ${serviceType || 'a job'}. Payment is confirmed and the job is now active.
    </p>
    ${button(adminUrl, 'View in admin dashboard')}
  `;

  return emailShell(`${customerName} paid ${companyName || providerName} ₦${amount.toLocaleString()}.`, body);
};

const sendAdminJobPlacedEmail = async (adminEmail, data) => {
  const html = getAdminJobPlacedEmailTemplate(data);
  return sendEmail({
    to: adminEmail,
    subject: `Job Placed: ₦${data.amount.toLocaleString()} - ${data.customerName} → ${data.companyName || data.providerName}`,
    html
  });
};

const getAdminNewJobPostingEmailTemplate = ({ customerName, title, category, budget }) => {
  const adminUrl = `${process.env.CLIENT_URL}/admin/dashboard`;

  const body = `
    ${eyebrow('New Job Posted')}
    <h1 style="margin: 0 0 14px 0; font-size: 21px; line-height: 1.35; color: ${INK}; font-weight: 700;">
      ${title}
    </h1>
    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.7; color: ${INK_SOFT};">
      <strong>${customerName}</strong> posted a new job${category ? ` in <strong>${category}</strong>` : ''}${budget ? ` with a budget of ₦${budget.toLocaleString()}` : ''}.
    </p>
    ${button(adminUrl, 'View in admin dashboard')}
  `;

  return emailShell(`${customerName} posted a new job: ${title}`, body);
};

const sendAdminNewJobPostingEmail = async (adminEmail, data) => {
  const html = getAdminNewJobPostingEmailTemplate(data);
  return sendEmail({
    to: adminEmail,
    subject: `New Job Posted: ${data.title}`,
    html
  });
};

// -----------------------------------------------------------------------
// Contact Form Submission (to the contact inbox)
// -----------------------------------------------------------------------

const getContactFormEmailTemplate = ({ name, email, subject, message }) => {
  const body = `
    ${eyebrow('Contact Form')}
    <h1 style="margin: 0 0 14px 0; font-size: 21px; line-height: 1.35; color: ${INK}; font-weight: 700;">
      New message from the contact page
    </h1>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f7f8fa; border: 1px solid ${BORDER}; border-radius: 8px; margin: 0 0 20px 0;">
      <tr><td style="padding: 16px 18px; font-size: 14px; line-height: 1.9; color: ${INK_SOFT};">
        <strong style="color: ${INK};">From:</strong> ${name} (${email})<br />
        <strong style="color: ${INK};">Subject:</strong> ${subject}
      </td></tr>
    </table>
    <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 600; color: ${INK};">Message</p>
    <p style="margin: 0; font-size: 15px; line-height: 1.7; color: ${INK_SOFT}; white-space: pre-wrap;">${message}</p>
    ${note('Reply directly to this email to respond, it goes straight to the sender.')}
  `;

  return emailShell(`${name} sent a message: ${subject}`, body);
};

const sendContactFormEmail = async (adminEmail, data) => {
  const html = getContactFormEmailTemplate(data);
  return sendEmail({
    to: adminEmail,
    subject: `Contact form: ${data.subject}`,
    html,
    replyTo: data.email
  });
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendApprovalEmail,         // ✅ NEW
  sendRejectionEmail,        // ✅ NEW
  sendNewProviderSubmissionEmail, // ✅ NEW
  sendPaymentConfirmationEmail,
  sendWithdrawalRequestedEmail,
  sendWithdrawalApprovedEmail,
  sendWithdrawalRejectedEmail,
  sendSubscriptionRequiredEmail,
  sendSubscriptionExpiringEmail,
  sendSubscriptionExpiredEmail,
  sendSubscriptionConfirmedEmail,
  sendAdminSubscriptionReceivedEmail,
  sendAdminJobPlacedEmail,
  sendAdminNewJobPostingEmail,
  sendContactFormEmail,
  getVerificationEmailTemplate,
  getWelcomeEmailTemplate,
  getResetPasswordEmailTemplate,
  getProviderApprovalEmailTemplate,
  getProviderRejectionEmailTemplate,
  getNewProviderSubmissionEmailTemplate,
  getPaymentConfirmationEmailTemplate,
  getWithdrawalRequestedEmailTemplate,
  getWithdrawalApprovedEmailTemplate,
  getWithdrawalRejectedEmailTemplate,
  getSubscriptionRequiredEmailTemplate,
  getSubscriptionExpiringEmailTemplate,
  getSubscriptionExpiredEmailTemplate,
  getSubscriptionConfirmedEmailTemplate,
  getAdminSubscriptionReceivedEmailTemplate,
  getAdminJobPlacedEmailTemplate,
  getAdminNewJobPostingEmailTemplate,
  getContactFormEmailTemplate
};

// module.exports = {
//   sendEmail,
//   sendVerificationEmail,
//   sendWelcomeEmail,
//   sendPasswordResetEmail,
//   getVerificationEmailTemplate,
//   getWelcomeEmailTemplate,
//   getResetPasswordEmailTemplate
// };