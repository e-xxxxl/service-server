// src/services/emailService.js
const { Resend } = require('resend');

// Initialize Resend with your API key
const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async ({ to, subject, html }) => {
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
      Questions? Reach us any time at <a href="mailto:support@9jatradiespages.com" style="color: ${ACCENT_DARK}; text-decoration: none;">support@9jatradies.com</a>.
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
  const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
  const html = getResetPasswordEmailTemplate(user, resetUrl);

  return sendEmail({
    to: user.email,
    subject: 'Reset your password',
    html
  });
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  getVerificationEmailTemplate,
  getWelcomeEmailTemplate,
  getResetPasswordEmailTemplate
};