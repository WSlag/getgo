/**
 * Fraud Detection Service
 *
 * Multi-layered fraud detection for GCash payment verification.
 * Calculates a fraud score based on various risk indicators.
 */

const admin = require('firebase-admin');
const { FieldValue, Timestamp } = require('firebase-admin/firestore');
const { THRESHOLDS, FRAUD_SCORES } = require('../config/thresholds');

/**
 * Run all fraud detection checks
 * @param {Object} params - Detection parameters
 * @param {Object} params.submission - Payment submission document
 * @param {Object} params.order - Order document
 * @param {Object} params.ocrResults - OCR extraction results
 * @param {Object} params.validationResults - Validation results from OCR service
 * @param {Object} params.imageAnalysis - Image analysis results
 * @param {Object} params.duplicateHash - Duplicate hash check results
 * @param {Object} params.duplicateRef - Duplicate reference check results
 * @returns {Promise<Object>} - Fraud detection results
 */
async function detectFraud({
  submission,
  order,
  ocrResults,
  validationResults,
  imageAnalysis,
  duplicateHash,
  duplicateRef
}) {
  let score = 0;
  const flags = [];
  const details = [];

  // ===========================================
  // LAYER 1: DATA VALIDATION FLAGS
  // ===========================================

  // Rule 1: Amount mismatch
  if (!validationResults.amountMatch) {
    score += FRAUD_SCORES.AMOUNT_MISMATCH;
    flags.push('AMOUNT_MISMATCH');
    details.push({
      rule: 'AMOUNT_MISMATCH',
      expected: order.amount,
      found: ocrResults.extractedData?.amount,
      score: FRAUD_SCORES.AMOUNT_MISMATCH
    });
  }

  // Rule 2: Duplicate reference number (CRITICAL)
  if (duplicateRef.isDuplicate) {
    score += FRAUD_SCORES.DUPLICATE_REFERENCE;
    flags.push('DUPLICATE_REFERENCE');
    details.push({
      rule: 'DUPLICATE_REFERENCE',
      previousSubmissionId: duplicateRef.existingSubmissionId,
      previousUserId: duplicateRef.existingUserId,
      referenceNumber: ocrResults.extractedData?.referenceNumber,
      score: FRAUD_SCORES.DUPLICATE_REFERENCE
    });
  }

  // Rule 3: Receiver name mismatch
  if (!validationResults.receiverMatch && ocrResults.extractedData?.receiverName) {
    score += FRAUD_SCORES.RECEIVER_MISMATCH;
    flags.push('RECEIVER_MISMATCH');
    details.push({
      rule: 'RECEIVER_MISMATCH',
      expected: order.expectedReceiverName || order.gcashAccountName,
      found: ocrResults.extractedData?.receiverName,
      score: FRAUD_SCORES.RECEIVER_MISMATCH
    });
  }

  // Rule 4: Timestamp expired
  if (!validationResults.timestampValid && ocrResults.extractedData?.transactionDate) {
    score += FRAUD_SCORES.TIMESTAMP_EXPIRED;
    flags.push('TIMESTAMP_EXPIRED');
    details.push({
      rule: 'TIMESTAMP_EXPIRED',
      receiptTime: ocrResults.extractedData?.timestamp,
      maxAgeMinutes: THRESHOLDS.MAX_RECEIPT_AGE_MINUTES,
      score: FRAUD_SCORES.TIMESTAMP_EXPIRED
    });
  }

  // Rule 5: Low OCR confidence
  if (ocrResults.confidence < THRESHOLDS.MIN_OCR_CONFIDENCE) {
    score += FRAUD_SCORES.LOW_OCR_CONFIDENCE;
    flags.push('LOW_OCR_CONFIDENCE');
    details.push({
      rule: 'LOW_OCR_CONFIDENCE',
      confidence: ocrResults.confidence,
      threshold: THRESHOLDS.MIN_OCR_CONFIDENCE,
      score: FRAUD_SCORES.LOW_OCR_CONFIDENCE
    });
  }

  // Rule 6: Missing required OCR fields
  if (!validationResults.hasRequiredFields) {
    score += FRAUD_SCORES.MISSING_REQUIRED_FIELDS;
    flags.push('MISSING_REQUIRED_FIELDS');
    details.push({
      rule: 'MISSING_REQUIRED_FIELDS',
      missingFields: validationResults.errors,
      score: FRAUD_SCORES.MISSING_REQUIRED_FIELDS
    });
  }

  // ===========================================
  // LAYER 2: IMAGE FORENSICS FLAGS
  // ===========================================

  // Rule 7: Duplicate image hash (CRITICAL)
  if (duplicateHash.isDuplicate) {
    score += FRAUD_SCORES.DUPLICATE_IMAGE;
    flags.push('DUPLICATE_IMAGE');
    details.push({
      rule: 'DUPLICATE_IMAGE',
      previousSubmissionId: duplicateHash.existingSubmissionId,
      similarity: duplicateHash.similarity || 1.0,
      score: FRAUD_SCORES.DUPLICATE_IMAGE
    });
  } else if (duplicateHash.isSimilar) {
    score += FRAUD_SCORES.SIMILAR_IMAGE;
    flags.push('SIMILAR_IMAGE');
    details.push({
      rule: 'SIMILAR_IMAGE',
      similarSubmissionId: duplicateHash.existingSubmissionId,
      similarity: duplicateHash.similarity,
      score: FRAUD_SCORES.SIMILAR_IMAGE
    });
  }

  // Rule 8: Suspicious image dimensions
  if (imageAnalysis?.dimensions) {
    const { width, height } = imageAnalysis.dimensions;
    if (
      width < THRESHOLDS.MIN_IMAGE_WIDTH ||
      height < THRESHOLDS.MIN_IMAGE_HEIGHT ||
      width > THRESHOLDS.MAX_IMAGE_WIDTH ||
      height > THRESHOLDS.MAX_IMAGE_HEIGHT
    ) {
      score += FRAUD_SCORES.SUSPICIOUS_DIMENSIONS;
      flags.push('SUSPICIOUS_DIMENSIONS');
      details.push({
        rule: 'SUSPICIOUS_DIMENSIONS',
        dimensions: imageAnalysis.dimensions,
        validRange: {
          minWidth: THRESHOLDS.MIN_IMAGE_WIDTH,
          minHeight: THRESHOLDS.MIN_IMAGE_HEIGHT,
          maxWidth: THRESHOLDS.MAX_IMAGE_WIDTH,
          maxHeight: THRESHOLDS.MAX_IMAGE_HEIGHT
        },
        score: FRAUD_SCORES.SUSPICIOUS_DIMENSIONS
      });
    }
  }

  // Rule 9: Missing EXIF data (possible edited image)
  if (!imageAnalysis?.exif || Object.keys(imageAnalysis.exif).length === 0) {
    score += FRAUD_SCORES.MISSING_EXIF;
    flags.push('MISSING_EXIF');
    details.push({
      rule: 'MISSING_EXIF',
      reason: 'No EXIF metadata found - may indicate image manipulation',
      score: FRAUD_SCORES.MISSING_EXIF
    });
  }

  // ===========================================
  // LAYER 3: PATTERN DETECTION FLAGS
  // ===========================================

  // Rule 10: New account + high value transaction
  const accountAge = await getUserAccountAge(submission.userId);
  if (accountAge < THRESHOLDS.NEW_ACCOUNT_DAYS && order.amount > THRESHOLDS.HIGH_VALUE_THRESHOLD) {
    score += FRAUD_SCORES.NEW_ACCOUNT_HIGH_VALUE;
    flags.push('NEW_ACCOUNT_HIGH_VALUE');
    details.push({
      rule: 'NEW_ACCOUNT_HIGH_VALUE',
      accountAgeDays: accountAge,
      transactionAmount: order.amount,
      thresholds: {
        newAccountDays: THRESHOLDS.NEW_ACCOUNT_DAYS,
        highValueAmount: THRESHOLDS.HIGH_VALUE_THRESHOLD
      },
      score: FRAUD_SCORES.NEW_ACCOUNT_HIGH_VALUE
    });
  }

  // Rule 11: Velocity check (too many submissions)
  const recentSubmissions = await getRecentSubmissionCount(submission.userId, 24);
  if (recentSubmissions >= THRESHOLDS.MAX_DAILY_SUBMISSIONS) {
    score += FRAUD_SCORES.VELOCITY_EXCEEDED;
    flags.push('VELOCITY_EXCEEDED');
    details.push({
      rule: 'VELOCITY_EXCEEDED',
      submissionsIn24h: recentSubmissions,
      limit: THRESHOLDS.MAX_DAILY_SUBMISSIONS,
      score: FRAUD_SCORES.VELOCITY_EXCEEDED
    });
  }

  // ===========================================
  // DETERMINE FINAL STATUS
  // ===========================================

  // Cap score at 100
  score = Math.min(score, 100);

  // Determine if manual review is required
  const requiresReview = score >= THRESHOLDS.MANUAL_REVIEW_THRESHOLD &&
                         score < THRESHOLDS.AUTO_REJECT_THRESHOLD;

  // Determine recommended action
  let recommendedAction;
  if (score <= THRESHOLDS.AUTO_APPROVE_THRESHOLD) {
    recommendedAction = 'auto_approve';
  } else if (score >= THRESHOLDS.AUTO_REJECT_THRESHOLD) {
    recommendedAction = 'auto_reject';
  } else {
    recommendedAction = 'manual_review';
  }

  return {
    score,
    flags,
    details,
    requiresReview,
    recommendedAction,
    thresholds: {
      autoApprove: THRESHOLDS.AUTO_APPROVE_THRESHOLD,
      manualReview: THRESHOLDS.MANUAL_REVIEW_THRESHOLD,
      autoReject: THRESHOLDS.AUTO_REJECT_THRESHOLD
    }
  };
}

/**
 * Get user account age in days
 * @param {string} userId - Firebase Auth UID
 * @returns {Promise<number>} - Account age in days
 */
async function getUserAccountAge(userId) {
  try {
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return 0; // Account not found, treat as new
    }

    const userData = userDoc.data();
    const createdAt = userData.createdAt?.toDate?.() || new Date();
    const now = new Date();

    const ageDays = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
    return ageDays;
  } catch (error) {
    console.error('Error getting account age:', error);
    return 0; // Error, treat as new account
  }
}

/**
 * Get count of recent submissions by user
 * @param {string} userId - Firebase Auth UID
 * @param {number} hours - Time window in hours
 * @returns {Promise<number>} - Number of submissions
 */
async function getRecentSubmissionCount(userId, hours) {
  try {
    const db = admin.firestore();
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    const snapshot = await db
      .collection('paymentSubmissions')
      .where('userId', '==', userId)
      .where('createdAt', '>=', Timestamp.fromDate(cutoffTime))
      .get();

    return snapshot.size;
  } catch (error) {
    console.error('Error getting submission count:', error);
    return 0;
  }
}

/**
 * Check for duplicate reference number
 * @param {Object} db - Firestore database instance
 * @param {string} refNumber - Reference number to check
 * @param {string} currentSubmissionId - Current submission ID (to exclude)
 * @param {string} userId - Current user ID
 * @param {number} amount - Transaction amount
 * @returns {Promise<Object>} - Duplicate check results
 */
async function checkDuplicateReference(db, refNumber, currentSubmissionId, userId, amount) {
  if (!refNumber) {
    return { isDuplicate: false };
  }

  try {
    // Clean reference number for lookup
    const cleanedRef = refNumber.replace(/\s+/g, '').toUpperCase();

    // Check in dedicated referenceNumbers collection
    const refDoc = await db.collection('referenceNumbers').doc(cleanedRef).get();

    if (refDoc.exists) {
      const existingData = refDoc.data();

      // If it's from a different submission, it's a duplicate
      if (existingData.submissionId !== currentSubmissionId) {
        return {
          isDuplicate: true,
          existingSubmissionId: existingData.submissionId,
          existingUserId: existingData.userId,
          existingAmount: existingData.amount,
          firstSeenAt: existingData.firstSeenAt
        };
      }
    }

    // Not a duplicate - store this reference
    await db.collection('referenceNumbers').doc(cleanedRef).set({
      referenceNumber: cleanedRef,
      submissionId: currentSubmissionId,
      userId: userId,
      amount: amount,
      firstSeenAt: FieldValue.serverTimestamp()
    });

    return { isDuplicate: false };
  } catch (error) {
    console.error('Error checking duplicate reference:', error);
    return { isDuplicate: false, error: error.message };
  }
}

/**
 * Check for duplicate image hash
 * @param {Object} db - Firestore database instance
 * @param {string} imageHash - Perceptual hash of the image
 * @param {string} currentSubmissionId - Current submission ID
 * @returns {Promise<Object>} - Duplicate hash check results
 */
async function checkDuplicateHash(db, imageHash, currentSubmissionId) {
  if (!imageHash) {
    return { isDuplicate: false, isSimilar: false };
  }

  try {
    // Check for exact match first
    const exactMatch = await db
      .collection('imageHashes')
      .where('hash', '==', imageHash)
      .limit(1)
      .get();

    if (!exactMatch.empty) {
      const existing = exactMatch.docs[0].data();
      if (existing.submissionId !== currentSubmissionId) {
        return {
          isDuplicate: true,
          isSimilar: false,
          existingSubmissionId: existing.submissionId,
          similarity: 1.0
        };
      }
    }

    // TODO: For similar image detection, we would need to:
    // 1. Store perceptual hashes in a way that allows similarity search
    // 2. Use Hamming distance to find similar hashes
    // This is more complex and may require a different approach for scale

    // Store this hash
    await db.collection('imageHashes').add({
      hash: imageHash,
      submissionId: currentSubmissionId,
      firstSeenAt: FieldValue.serverTimestamp()
    });

    return { isDuplicate: false, isSimilar: false };
  } catch (error) {
    console.error('Error checking duplicate hash:', error);
    return { isDuplicate: false, isSimilar: false, error: error.message };
  }
}

/**
 * Determine final submission status based on validation and fraud results
 * @param {Object} validationResults - Validation results from OCR
 * @param {Object} fraudResults - Fraud detection results
 * @returns {string} - Final status: 'approved', 'rejected', or 'manual_review'
 */
function determineFinalStatus(validationResults, fraudResults) {
  // Auto-reject if critical fraud flags
  if (
    fraudResults.flags.includes('DUPLICATE_REFERENCE') ||
    fraudResults.flags.includes('DUPLICATE_IMAGE')
  ) {
    return 'rejected';
  }

  // Use recommended action from fraud detection
  if (fraudResults.recommendedAction === 'auto_approve') {
    return 'approved';
  }

  if (fraudResults.recommendedAction === 'auto_reject') {
    return 'rejected';
  }

  return 'manual_review';
}

/**
 * Create a fraud log entry for audit trail
 * @param {Object} db - Firestore database instance
 * @param {string} submissionId - Submission ID
 * @param {string} userId - User ID
 * @param {string} action - Action taken
 * @param {Object} fraudResults - Fraud detection results
 * @param {string|null} adminId - Admin ID if manual action
 * @param {string|null} notes - Optional notes
 */
async function createFraudLog(db, submissionId, userId, action, fraudResults, adminId = null, notes = null) {
  try {
    await db.collection('fraudLogs').add({
      submissionId,
      userId,
      action,
      fraudScore: fraudResults.score,
      triggeredRules: fraudResults.flags,
      ruleDetails: fraudResults.details,
      adminId,
      notes,
      createdAt: FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error('Error creating fraud log:', error);
  }
}

module.exports = {
  detectFraud,
  checkDuplicateReference,
  checkDuplicateHash,
  determineFinalStatus,
  createFraudLog,
  getUserAccountAge,
  getRecentSubmissionCount
};
