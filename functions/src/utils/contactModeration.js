const PHONE_PATTERNS = [
  /(?:\+?63[\s.-]?|0)9\d{2}[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
  /\(0\d{1,2}\)[\s.-]?\d{3,4}[\s.-]?\d{4}\b/g,
  /\b0\d{1,2}[\s.-]\d{3,4}[\s.-]\d{4}\b/g,
];

const SOCIAL_LINK_PATTERNS = [
  /(?:https?:\/\/)?(?:www\.)?facebook\.com\/[^\s<>]+/gi,
  /(?:https?:\/\/)?(?:www\.)?fb\.com\/[^\s<>]+/gi,
  /(?:https?:\/\/)?(?:www\.)?m\.facebook\.com\/[^\s<>]+/gi,
  /(?:https?:\/\/)?fb\.me\/[^\s<>]+/gi,
  /(?:https?:\/\/)?(?:www\.)?messenger\.com\/[^\s<>]+/gi,
  /(?:https?:\/\/)?m\.me\/[^\s<>]+/gi,
  /(?:https?:\/\/)?(?:www\.)?instagram\.com\/[^\s<>]+/gi,
  /(?:https?:\/\/)?(?:www\.)?instagr\.am\/[^\s<>]+/gi,
  /(?:https?:\/\/)?(?:www\.)?wa\.me\/[^\s<>]+/gi,
  /(?:https?:\/\/)?(?:www\.)?whatsapp\.com\/[^\s<>]+/gi,
  /(?:https?:\/\/)?(?:www\.)?viber\.com\/[^\s<>]+/gi,
  /(?:https?:\/\/)?(?:www\.)?t\.me\/[^\s<>]+/gi,
  /(?:https?:\/\/)?(?:www\.)?telegram\.me\/[^\s<>]+/gi,
];

const CHANNEL_CUED_HANDLE_PATTERNS = [
  /\b(?:fb|facebook|messenger|ig|instagram|telegram|tg|viber|whatsapp|wa)\b[\s:=\-]{0,5}@?[a-zA-Z][a-zA-Z0-9._]{2,}\b/gi,
  /@[a-zA-Z][a-zA-Z0-9._]{2,}\b[\s,;:()\-]{0,5}(?:on|via|sa)?[\s,;:()\-]{0,5}\b(?:fb|facebook|messenger|ig|instagram|telegram|tg|viber|whatsapp|wa)\b/gi,
];

const EMAIL_PATTERNS = [
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
];

const CONTACT_TOKEN_RE = /\[(Contact|Link|Handle|Email) Hidden\]/g;

function sanitizeContactText(message) {
  if (!message || typeof message !== 'string') return '';

  let sanitized = message;

  PHONE_PATTERNS.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, '[Contact Hidden]');
  });

  SOCIAL_LINK_PATTERNS.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, '[Link Hidden]');
  });

  CHANNEL_CUED_HANDLE_PATTERNS.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, '[Handle Hidden]');
  });

  EMAIL_PATTERNS.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, '[Email Hidden]');
  });

  sanitized = sanitized.replace(/(\[Contact Hidden\]\s*)+/g, '[Contact Hidden] ');
  sanitized = sanitized.replace(/(\[Link Hidden\]\s*)+/g, '[Link Hidden] ');
  sanitized = sanitized.replace(/(\[Handle Hidden\]\s*)+/g, '[Handle Hidden] ');
  sanitized = sanitized.replace(/(\[Email Hidden\]\s*)+/g, '[Email Hidden] ');

  return sanitized.trim();
}

function containsContactInfo(message) {
  if (!message || typeof message !== 'string') return false;

  const allPatterns = [
    ...PHONE_PATTERNS,
    ...SOCIAL_LINK_PATTERNS,
    ...CHANNEL_CUED_HANDLE_PATTERNS,
    ...EMAIL_PATTERNS,
  ];

  return allPatterns.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(message);
  });
}

function sanitizePublicName(name, fallback = 'User') {
  const raw = typeof name === 'string' ? name.trim() : '';
  if (!raw) return fallback;

  const sanitized = sanitizeContactText(raw)
    .replace(CONTACT_TOKEN_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return sanitized || fallback;
}

module.exports = {
  containsContactInfo,
  sanitizeContactText,
  sanitizePublicName,
};
