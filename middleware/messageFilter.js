// middleware/messageFilter.js
class MessageFilter {
  // Patterns to detect contact information
  static PHONE_PATTERNS = [
    /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, // 123-456-7890
    /\b\d{4}[-.]?\d{3}[-.]?\d{4}\b/, // 1234-567-8901
    /\b\d{11}\b/, // 11 digit number
    /\b\d{10}\b/, // 10 digit number
    /\+?\d{1,3}[-.]?\d{3}[-.]?\d{3}[-.]?\d{4}\b/, // International
    /\b0\d{10}\b/, // Nigerian format
    /\b0\d{2,3}[-.]?\d{3}[-.]?\d{4}\b/,
  ];

  static EMAIL_PATTERNS = [
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
    /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
  ];

  static SOCIAL_PATTERNS = [
    /@[\w.]+/, // @username
    /whatsapp[:\s]*\+?\d+/i,
    /telegram[:\s]*@?\w+/i,
    /instagram[:\s]*@?\w+/i,
    /facebook[:\s]*[\w.]+/i,
  ];

  static CONTACT_KEYWORDS = [
    'call me', 'text me', 'whatsapp me', 'dm me',
    'my number', 'my phone', 'my email', 'reach me',
    'contact me', 'hit me up', 'send me a message on',
    'find me on', 'add me on', 'follow me on',
    'my whatsapp', 'my telegram', 'my instagram',
    'message me on', 'reach out on', 'connect on'
  ];

  static filterMessage(text) {
    const violations = [];
    let filteredText = text;
    let hasViolation = false;

    // Check for phone numbers
    for (const pattern of MessageFilter.PHONE_PATTERNS) {
      const matches = text.match(pattern);
      if (matches) {
        violations.push({
          type: 'phone',
          matched: matches[0],
          message: 'Phone numbers are not allowed in messages'
        });
        filteredText = filteredText.replace(pattern, '[PHONE NUMBER REMOVED]');
        hasViolation = true;
      }
    }

    // Check for emails
    for (const pattern of MessageFilter.EMAIL_PATTERNS) {
      const matches = text.match(pattern);
      if (matches) {
        violations.push({
          type: 'email',
          matched: matches[0],
          message: 'Email addresses are not allowed in messages'
        });
        filteredText = filteredText.replace(pattern, '[EMAIL REMOVED]');
        hasViolation = true;
      }
    }

    // Check for social media handles
    for (const pattern of MessageFilter.SOCIAL_PATTERNS) {
      const matches = text.match(pattern);
      if (matches) {
        violations.push({
          type: 'social',
          matched: matches[0],
          message: 'Social media contacts are not allowed in messages'
        });
        filteredText = filteredText.replace(pattern, '[CONTACT REMOVED]');
        hasViolation = true;
      }
    }

    // Check for contact keywords
    for (const keyword of MessageFilter.CONTACT_KEYWORDS) {
      if (text.toLowerCase().includes(keyword)) {
        violations.push({
          type: 'keyword',
          matched: keyword,
          message: 'Sharing contact information is not allowed'
        });
        hasViolation = true;
      }
    }

    return {
      isClean: !hasViolation,
      filteredText: hasViolation ? filteredText : text,
      violations,
      warning: hasViolation ? 
        '⚠️ Sharing contact information is not allowed on 9jaTradiesPages. All communication should stay on the platform for your safety.' : 
        null
    };
  }
}

module.exports = MessageFilter;