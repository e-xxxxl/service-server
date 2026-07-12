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
      from: process.env.EMAIL_FROM || 'Service Platform <onboarding@resend.dev>',
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
// Shared layout pieces
// -----------------------------------------------------------------------

const BRAND_COLOR = '#f06d00';
const BRAND_HOVER = '#d96200';
const INK = '#2d333f';
const MUTED = '#6b7280';
const BORDER = '#e5e7eb';
const BG = '#f9fafb';
const CARD_BG = '#ffffff';

const emailShell = (bodyContent) => `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light" />
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    </style>
  </head>
  <body style="margin: 0; padding: 0; background: ${BG}; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: ${BG}; padding: 40px 20px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background: ${CARD_BG}; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);">
            
            <!-- Header with Logo -->
            <tr>
              <td style="padding: 40px 40px 0 40px; text-align: center;">
                <div style="display: inline-flex; align-items: center; gap: 4px;">
                  <div style="background-color: ${BRAND_COLOR}; padding: 6px 8px; border-radius: 6px; color: #ffffff; font-weight: 900; font-style: italic; font-size: 20px; line-height: 1;">hi</div>
                  <span style="color: ${INK}; font-weight: 700; font-size: 20px; letter-spacing: -0.5px;">pages</span>
                </div>
              </td>
            </tr>

            <!-- Body Content -->
            <tr>
              <td style="padding: 36px 40px;">
                ${bodyContent}
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding: 24px 40px; border-top: 1px solid ${BORDER};">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-bottom: 8px;">
                      <p style="margin: 0; font-size: 12px; color: ${MUTED}; line-height: 1.6;">
                        Service Platform
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-bottom: 8px;">
                      <p style="margin: 0; font-size: 12px; color: ${MUTED}; line-height: 1.6;">
                        This message was sent to you because you have an account with Service Platform.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <p style="margin: 0; font-size: 12px; color: ${MUTED};">
                        &copy; ${new Date().getFullYear()} Service Platform. All rights reserved.
                      </p>
                    </td>
                  </tr>
                </table>
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
  <a href="${url}" style="display: inline-block; padding: 14px 32px; background: ${BRAND_COLOR}; color: #FFFFFF; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; text-align: center;">
    ${label}
  </a>
`;

const infoBox = (content, type = 'info') => {
  const colors = {
    info: { bg: '#f9fafb', border: '#f3f4f6', text: '#6b7280' },
    warning: { bg: '#fef3c7', border: '#fde68a', text: '#92400e' },
    error: { bg: '#fef2f2', border: '#fee2e2', text: '#991b1b' },
    success: { bg: '#f0fdf4', border: '#dcfce7', text: '#166534' }
  };
  
  const c = colors[type] || colors.info;
  
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: ${c.bg}; border: 1px solid ${c.border}; border-radius: 12px; margin: 24px 0;">
      <tr>
        <td style="padding: 16px 20px; font-size: 14px; color: ${c.text}; line-height: 1.6;">
          ${content}
        </td>
      </tr>
    </table>
  `;
};

// -----------------------------------------------------------------------
// Verification Email
// -----------------------------------------------------------------------

const getVerificationEmailTemplate = (user, verificationUrl) => {
  const firstName = user.fullName?.split(' ')[0] || 'there';
  
  const body = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="text-align: center; padding-bottom: 32px;">
          <div style="display: inline-flex; align-items: center; justify-content: center; width: 80px; height: 80px; background-color: #fff7ed; border-radius: 20px;">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="${BRAND_COLOR}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
          </div>
        </td>
      </tr>
      <tr>
        <td style="text-align: center;">
          <p style="margin: 0 0 4px 0; font-size: 13px; color: ${MUTED}; text-transform: uppercase; letter-spacing: 0.5px;">Verify your email</p>
          <h1 style="margin: 0 0 16px 0; font-size: 24px; color: ${INK}; font-weight: 700;">Confirm your email address</h1>
          
          <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.7; color: ${INK};">
            Hi ${firstName}, thanks for signing up! Please verify your email address to get started.
          </p>
        </td>
      </tr>
      <tr>
        <td style="text-align: center; padding-bottom: 24px;">
          ${button(verificationUrl, 'Verify Email Address')}
        </td>
      </tr>
      <tr>
        <td>
          <p style="margin: 0 0 8px 0; font-size: 13px; color: ${MUTED}; text-align: center;">
            Button not working? Copy and paste this link:
          </p>
          <p style="margin: 0 0 24px 0; font-size: 13px; color: ${BRAND_COLOR}; word-break: break-all; text-align: center;">
            ${verificationUrl}
          </p>
        </td>
      </tr>
      <tr>
        <td>
          ${infoBox('🔒 This link expires in <strong>24 hours</strong> and can only be used once. If you didn\'t create an account, you can safely ignore this email.', 'info')}
        </td>
      </tr>
      <tr>
        <td style="text-align: center; padding-top: 8px;">
          <p style="margin: 0; font-size: 13px; color: ${MUTED};">
            Need help? Contact us at <a href="mailto:support@9jatradies.com" style="color: ${BRAND_COLOR}; text-decoration: none;">support@9jatradies.com</a>
          </p>
        </td>
      </tr>
    </table>
  `;
  
  return emailShell(body);
};

// -----------------------------------------------------------------------
// Welcome Email
// -----------------------------------------------------------------------

const getWelcomeEmailTemplate = (user, dashboardUrl) => {
  const firstName = user.fullName?.split(' ')[0] || 'there';
  const isProvider = user.accountType === 'provider';
  
  const body = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="text-align: center; padding-bottom: 32px;">
          <div style="display: inline-flex; align-items: center; justify-content: center; width: 80px; height: 80px; background-color: #f0fdf4; border-radius: 20px;">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
        </td>
      </tr>
      <tr>
        <td style="text-align: center;">
          <p style="margin: 0 0 4px 0; font-size: 13px; color: ${MUTED}; text-transform: uppercase; letter-spacing: 0.5px;">Welcome aboard!</p>
          <h1 style="margin: 0 0 16px 0; font-size: 24px; color: ${INK}; font-weight: 700;">Your account is ready, ${firstName}</h1>
          
          <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.7; color: ${INK};">
            Your email has been verified and your account is now active. We're excited to have you on board!
          </p>
        </td>
      </tr>
      <tr>
        <td>
          ${isProvider ? infoBox(`
            <strong style="font-size: 15px;">🚀 Getting started as a Service Provider</strong><br>
            <ul style="margin: 8px 0 0 0; padding-left: 20px;">
              <li>Complete your service provider profile</li>
              <li>Set your service areas and availability</li>
              <li>Upload verification documents</li>
              <li>Start receiving job requests</li>
            </ul>
          `, 'info') : infoBox(`
            <strong style="font-size: 15px;">🏠 Find the perfect service provider</strong><br>
            <ul style="margin: 8px 0 0 0; padding-left: 20px;">
              <li>Browse verified service providers</li>
              <li>Compare reviews and ratings</li>
              <li>Get free quotes</li>
              <li>Book services with confidence</li>
            </ul>
          `, 'info')}
        </td>
      </tr>
      <tr>
        <td style="text-align: center; padding: 24px 0;">
          ${button(dashboardUrl, 'Go to Dashboard')}
        </td>
      </tr>
      <tr>
        <td style="text-align: center;">
          <p style="margin: 0; font-size: 13px; color: ${MUTED};">
            Need help getting started? Check out our 
            <a href="${process.env.CLIENT_URL}/help" style="color: ${BRAND_COLOR}; text-decoration: none;">Help Center</a> 
            or reply to this email.
          </p>
        </td>
      </tr>
    </table>
  `;
  
  return emailShell(body);
};

// -----------------------------------------------------------------------
// Password Reset Email
// -----------------------------------------------------------------------

const getResetPasswordEmailTemplate = (user, resetUrl) => {
  const firstName = user.fullName?.split(' ')[0] || 'there';
  
  const body = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="text-align: center; padding-bottom: 32px;">
          <div style="display: inline-flex; align-items: center; justify-content: center; width: 80px; height: 80px; background-color: #fef3c7; border-radius: 20px;">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="${BRAND_COLOR}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              <circle cx="12" cy="16" r="1"></circle>
            </svg>
          </div>
        </td>
      </tr>
      <tr>
        <td style="text-align: center;">
          <p style="margin: 0 0 4px 0; font-size: 13px; color: ${MUTED}; text-transform: uppercase; letter-spacing: 0.5px;">Password reset</p>
          <h1 style="margin: 0 0 16px 0; font-size: 24px; color: ${INK}; font-weight: 700;">Reset your password</h1>
          
          <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.7; color: ${INK};">
            Hi ${firstName}, we received a request to reset the password on your account. Click below to choose a new one.
          </p>
        </td>
      </tr>
      <tr>
        <td style="text-align: center; padding-bottom: 24px;">
          ${button(resetUrl, 'Reset Password')}
        </td>
      </tr>
      <tr>
        <td>
          <p style="margin: 0 0 8px 0; font-size: 13px; color: ${MUTED}; text-align: center;">
            Or copy and paste this link:
          </p>
          <p style="margin: 0 0 24px 0; font-size: 13px; color: ${BRAND_COLOR}; word-break: break-all; text-align: center;">
            ${resetUrl}
          </p>
        </td>
      </tr>
      <tr>
        <td>
          ${infoBox('⚠️ This link expires in <strong>1 hour</strong>. If you didn\'t request a password reset, please ignore this email or contact support immediately.', 'warning')}
        </td>
      </tr>
    </table>
  `;
  
  return emailShell(body);
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
    subject: 'Welcome to Service Platform! 🎉',
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