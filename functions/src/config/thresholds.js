/**
 * Fraud Detection Thresholds Configuration
 * These values determine how the system categorizes payment submissions
 */

const THRESHOLDS = {
  // ===========================================
  // FRAUD SCORE THRESHOLDS
  // ===========================================

  // Score <= AUTO_APPROVE_THRESHOLD: Auto-approve payment
  AUTO_APPROVE_THRESHOLD: 10,

  // Score >= MANUAL_REVIEW_THRESHOLD: Flag for admin review
  MANUAL_REVIEW_THRESHOLD: 30,

  // Score >= AUTO_REJECT_THRESHOLD: Auto-reject payment
  AUTO_REJECT_THRESHOLD: 70,

  // ===========================================
  // OCR THRESHOLDS
  // ===========================================

  // Minimum OCR confidence to accept extracted data (0-100)
  MIN_OCR_CONFIDENCE: 60,

  // Required fields for a valid extraction
  REQUIRED_OCR_FIELDS: ['referenceNumber', 'amount'],

  // ===========================================
  // AMOUNT VALIDATION
  // ===========================================

  // Amount tolerance percentage (0 = exact match required)
  AMOUNT_TOLERANCE_PERCENT: 0,

  // Maximum amount for auto-approval (PHP)
  MAX_AUTO_APPROVE_AMOUNT: 10000,

  // ===========================================
  // TIME THRESHOLDS
  // ===========================================

  // Maximum age of receipt timestamp (minutes)
  MAX_RECEIPT_AGE_MINUTES: 30,

  // Order expiry time (minutes)
  ORDER_EXPIRY_MINUTES: 30,

  // ===========================================
  // TRANSACTION LIMITS
  // ===========================================

  // High value transaction threshold (PHP) - triggers extra scrutiny
  HIGH_VALUE_THRESHOLD: 5000,

  // Maximum daily top-up limit (PHP)
  MAX_DAILY_TOPUP: 50000,

  // Maximum submission attempts per day per user
  MAX_DAILY_SUBMISSIONS: 5,

  // Maximum submissions per hour per user (velocity check)
  MAX_HOURLY_SUBMISSIONS: 3,

  // ===========================================
  // ACCOUNT AGE THRESHOLDS
  // ===========================================

  // Account considered "new" if younger than this (days)
  NEW_ACCOUNT_DAYS: 7,

  // ===========================================
  // IMAGE ANALYSIS
  // ===========================================

  // Minimum image dimensions for valid screenshots
  MIN_IMAGE_WIDTH: 300,
  MIN_IMAGE_HEIGHT: 400,

  // Maximum image dimensions (unusually large = suspicious)
  MAX_IMAGE_WIDTH: 4000,
  MAX_IMAGE_HEIGHT: 6000,

  // Perceptual hash similarity threshold (0-1, higher = more similar)
  // Images with similarity >= this are considered duplicates
  SIMILAR_HASH_THRESHOLD: 0.9,

  // Hamming distance threshold for image hashes
  // Distance <= this is considered a duplicate
  HASH_DISTANCE_THRESHOLD: 10
};

// ===========================================
// FRAUD RULE SCORES
// Each rule adds to the total fraud score when triggered
// ===========================================

const FRAUD_SCORES = {
  // Critical flags (high scores)
  AMOUNT_MISMATCH: 40,
  DUPLICATE_REFERENCE: 50,
  DUPLICATE_IMAGE: 50,

  // High-risk flags
  SIMILAR_IMAGE: 30,
  RECEIVER_MISMATCH: 25,
  NEW_ACCOUNT_HIGH_VALUE: 25,

  // Medium-risk flags
  TIMESTAMP_EXPIRED: 20,
  VELOCITY_EXCEEDED: 20,

  // Low-risk flags
  LOW_OCR_CONFIDENCE: 15,
  MISSING_REQUIRED_FIELDS: 15,
  SUSPICIOUS_DIMENSIONS: 10,
  MISSING_EXIF: 5
};

module.exports = {
  THRESHOLDS,
  FRAUD_SCORES
};
