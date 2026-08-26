// controllers/contactController.js
const emailService = require('../services/emailService');

const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'contact@9jatradiespages.com';

class ContactController {
  // POST /api/contact - public, unauthenticated (the marketing site's contact form)
  static async submit(req, res) {
    try {
      const { name, email, subject, message } = req.body;

      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
        return res.status(400).json({ success: false, message: 'Name, email, subject, and message are all required' });
      }
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ success: false, message: 'Please provide a valid email address' });
      }

      const result = await emailService.sendContactFormEmail(CONTACT_EMAIL, {
        name: name.trim().slice(0, 200),
        email: email.trim(),
        subject: subject.trim().slice(0, 200),
        message: message.trim().slice(0, 5000)
      });

      if (!result.success) {
        console.error('Contact form email failed:', result.error);
        return res.status(500).json({ success: false, message: 'Failed to send your message. Please try again.' });
      }

      res.json({ success: true, message: 'Message sent successfully' });
    } catch (error) {
      console.error('Contact form error:', error);
      res.status(500).json({ success: false, message: 'Failed to send your message. Please try again.' });
    }
  }
}

module.exports = ContactController;
