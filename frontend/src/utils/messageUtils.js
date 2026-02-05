/**
 * Message sanitization utility
 * Auto-hides contact information (phone numbers, social media links)
 * to prevent direct contact outside the platform
 */

// Philippine phone number patterns
const PHONE_PATTERNS = [
  // PH mobile: +63 912 345 6789, 09123456789, +639123456789
  /(\+?63[\s.-]?)?0?9\d{2}[\s.-]?\d{3}[\s.-]?\d{4}/g,
  // Landline with area code: (02) 1234 5678, 02-1234-5678
  /\(?0\d{1,2}\)?[\s.-]?\d{3,4}[\s.-]?\d{4}/g,
  // Generic formats that look like phone numbers (7+ consecutive digits)
  /\b\d{4}[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
  /\b\d{3}[\s.-]?\d{4}[\s.-]?\d{4}\b/g,
  /\b\d{3}[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
  // Numbers written with spaces between each digit
  /\b(?:\d\s*){10,12}\b/g,
];

// Social media and contact link patterns
const SOCIAL_PATTERNS = [
  // Facebook URLs
  /(?:https?:\/\/)?(?:www\.)?facebook\.com\/[^\s<>]+/gi,
  /(?:https?:\/\/)?(?:www\.)?fb\.com\/[^\s<>]+/gi,
  /(?:https?:\/\/)?(?:www\.)?m\.facebook\.com\/[^\s<>]+/gi,
  /(?:https?:\/\/)?fb\.me\/[^\s<>]+/gi,
  // Messenger
  /(?:https?:\/\/)?(?:www\.)?messenger\.com\/[^\s<>]+/gi,
  /(?:https?:\/\/)?m\.me\/[^\s<>]+/gi,
  // Instagram
  /(?:https?:\/\/)?(?:www\.)?instagram\.com\/[^\s<>]+/gi,
  /(?:https?:\/\/)?(?:www\.)?instagr\.am\/[^\s<>]+/gi,
  // WhatsApp
  /(?:https?:\/\/)?(?:www\.)?wa\.me\/[^\s<>]+/gi,
  /(?:https?:\/\/)?(?:www\.)?whatsapp\.com\/[^\s<>]+/gi,
  // Viber
  /(?:https?:\/\/)?(?:www\.)?viber\.com\/[^\s<>]+/gi,
  // Telegram
  /(?:https?:\/\/)?(?:www\.)?t\.me\/[^\s<>]+/gi,
  /(?:https?:\/\/)?(?:www\.)?telegram\.me\/[^\s<>]+/gi,
  // Generic social handles (but be careful not to match emails)
  // Only match @handles that are not part of an email
  /(?<![a-zA-Z0-9._%+-])@[a-zA-Z][a-zA-Z0-9._]{2,}/g,
];

// Email patterns
const EMAIL_PATTERNS = [
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
];

/**
 * Sanitizes a message by hiding contact information
 * @param {string} message - The message to sanitize
 * @returns {string} - The sanitized message
 */
export function sanitizeMessage(message) {
  if (!message || typeof message !== 'string') return message;

  let sanitized = message;

  // Replace phone numbers
  PHONE_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[Contact Hidden]');
  });

  // Replace social media links
  SOCIAL_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[Link Hidden]');
  });

  // Replace email addresses
  EMAIL_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[Email Hidden]');
  });

  // Clean up multiple consecutive "[Contact Hidden]" or "[Link Hidden]"
  sanitized = sanitized.replace(/(\[Contact Hidden\]\s*)+/g, '[Contact Hidden] ');
  sanitized = sanitized.replace(/(\[Link Hidden\]\s*)+/g, '[Link Hidden] ');
  sanitized = sanitized.replace(/(\[Email Hidden\]\s*)+/g, '[Email Hidden] ');

  return sanitized.trim();
}

/**
 * Checks if a message contains contact information
 * @param {string} message - The message to check
 * @returns {boolean} - True if contact info is detected
 */
export function hasContactInfo(message) {
  if (!message || typeof message !== 'string') return false;

  const allPatterns = [...PHONE_PATTERNS, ...SOCIAL_PATTERNS, ...EMAIL_PATTERNS];

  return allPatterns.some(pattern => {
    pattern.lastIndex = 0; // Reset regex state
    return pattern.test(message);
  });
}

export default sanitizeMessage;
