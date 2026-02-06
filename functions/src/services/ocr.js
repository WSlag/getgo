/**
 * OCR Service - Google Cloud Vision API Integration
 *
 * Processes GCash payment receipt screenshots using Google Cloud Vision
 * and extracts structured payment data.
 */

const vision = require('@google-cloud/vision');
const { extractAllData } = require('../utils/gcashPatterns');
const { THRESHOLDS } = require('../config/thresholds');

// Initialize Vision client (uses Application Default Credentials)
const visionClient = new vision.ImageAnnotatorClient();

/**
 * Process a payment screenshot using OCR
 * @param {string} imageUrl - Firebase Storage URL or GCS URL of the image
 * @returns {Promise<Object>} - Extracted payment data with confidence score
 */
async function processScreenshot(imageUrl) {
  try {
    // Use DOCUMENT_TEXT_DETECTION for better accuracy on receipts
    const [result] = await visionClient.documentTextDetection(imageUrl);

    if (!result.fullTextAnnotation) {
      // Fallback to basic text detection
      const [basicResult] = await visionClient.textDetection(imageUrl);

      if (!basicResult.textAnnotations || basicResult.textAnnotations.length === 0) {
        return {
          success: false,
          error: 'No text detected in image',
          confidence: 0,
          rawText: '',
          extractedData: null
        };
      }

      return processOCRResult(basicResult.textAnnotations);
    }

    return processDocumentResult(result.fullTextAnnotation);

  } catch (error) {
    console.error('OCR processing error:', error);
    return {
      success: false,
      error: error.message || 'OCR processing failed',
      confidence: 0,
      rawText: '',
      extractedData: null
    };
  }
}

/**
 * Process document text detection result (preferred)
 * @param {Object} fullTextAnnotation - Vision API fullTextAnnotation
 * @returns {Object} - Processed result with extracted data
 */
function processDocumentResult(fullTextAnnotation) {
  const fullText = fullTextAnnotation.text || '';

  // Calculate overall confidence from page/block confidence
  let totalConfidence = 0;
  let confidenceCount = 0;

  if (fullTextAnnotation.pages) {
    for (const page of fullTextAnnotation.pages) {
      if (page.confidence) {
        totalConfidence += page.confidence;
        confidenceCount++;
      }

      if (page.blocks) {
        for (const block of page.blocks) {
          if (block.confidence) {
            totalConfidence += block.confidence;
            confidenceCount++;
          }
        }
      }
    }
  }

  const avgConfidence = confidenceCount > 0
    ? Math.round((totalConfidence / confidenceCount) * 100)
    : 70; // Default confidence if not provided

  // Extract structured data using patterns
  const extractedData = extractAllData(fullText);

  // Calculate extraction quality score
  const extractionScore = calculateExtractionScore(extractedData);

  // Final confidence is average of OCR confidence and extraction quality
  const finalConfidence = Math.round((avgConfidence + extractionScore) / 2);

  return {
    success: true,
    confidence: finalConfidence,
    ocrConfidence: avgConfidence,
    extractionScore: extractionScore,
    rawText: fullText,
    extractedData: {
      referenceNumber: extractedData.referenceNumber,
      amount: extractedData.amount,
      amountRaw: extractedData.amountRaw,
      senderName: extractedData.senderName,
      receiverName: extractedData.receiverName,
      timestamp: extractedData.timestamp,
      transactionDate: extractedData.transactionDate,
      hasSuccessIndicators: extractedData.hasSuccessIndicators,
      isGCashReceipt: extractedData.isGCashReceipt
    }
  };
}

/**
 * Process basic text detection result (fallback)
 * @param {Array} textAnnotations - Vision API textAnnotations
 * @returns {Object} - Processed result with extracted data
 */
function processOCRResult(textAnnotations) {
  // First annotation contains the full detected text
  const fullText = textAnnotations[0]?.description || '';

  // Calculate confidence from individual word detections
  let totalConfidence = 0;
  let confidenceCount = 0;

  for (let i = 1; i < textAnnotations.length; i++) {
    const annotation = textAnnotations[i];
    if (annotation.confidence) {
      totalConfidence += annotation.confidence;
      confidenceCount++;
    }
  }

  const avgConfidence = confidenceCount > 0
    ? Math.round((totalConfidence / confidenceCount) * 100)
    : 60; // Lower default for basic detection

  // Extract structured data using patterns
  const extractedData = extractAllData(fullText);

  // Calculate extraction quality score
  const extractionScore = calculateExtractionScore(extractedData);

  // Final confidence is average of OCR confidence and extraction quality
  const finalConfidence = Math.round((avgConfidence + extractionScore) / 2);

  return {
    success: true,
    confidence: finalConfidence,
    ocrConfidence: avgConfidence,
    extractionScore: extractionScore,
    rawText: fullText,
    extractedData: {
      referenceNumber: extractedData.referenceNumber,
      amount: extractedData.amount,
      amountRaw: extractedData.amountRaw,
      senderName: extractedData.senderName,
      receiverName: extractedData.receiverName,
      timestamp: extractedData.timestamp,
      transactionDate: extractedData.transactionDate,
      hasSuccessIndicators: extractedData.hasSuccessIndicators,
      isGCashReceipt: extractedData.isGCashReceipt
    }
  };
}

/**
 * Calculate extraction quality score based on what was successfully extracted
 * @param {Object} extractedData - Data extracted from OCR text
 * @returns {number} - Score from 0-100
 */
function calculateExtractionScore(extractedData) {
  let score = 0;
  const weights = {
    referenceNumber: 30,    // Most important
    amount: 30,             // Critical for validation
    receiverName: 15,       // Important for verification
    timestamp: 10,          // Useful for freshness check
    senderName: 5,          // Nice to have
    hasSuccessIndicators: 5, // Confirms successful transaction
    isGCashReceipt: 5       // Confirms receipt source
  };

  if (extractedData.referenceNumber) score += weights.referenceNumber;
  if (extractedData.amount !== null && extractedData.amount > 0) score += weights.amount;
  if (extractedData.receiverName) score += weights.receiverName;
  if (extractedData.timestamp) score += weights.timestamp;
  if (extractedData.senderName) score += weights.senderName;
  if (extractedData.hasSuccessIndicators) score += weights.hasSuccessIndicators;
  if (extractedData.isGCashReceipt) score += weights.isGCashReceipt;

  return score;
}

/**
 * Validate extracted data against order requirements
 * @param {Object} extractedData - Data from OCR
 * @param {Object} order - Order document from Firestore
 * @returns {Object} - Validation results
 */
function validateExtractedData(extractedData, order) {
  const errors = [];
  const results = {
    amountMatch: false,
    receiverMatch: false,
    timestampValid: false,
    referencePresent: false,
    hasRequiredFields: false
  };

  // Check reference number
  if (extractedData.referenceNumber) {
    results.referencePresent = true;
  } else {
    errors.push('Reference number not found in screenshot');
  }

  // Check amount match
  if (extractedData.amount !== null) {
    const tolerance = order.amount * (THRESHOLDS.AMOUNT_TOLERANCE_PERCENT / 100);
    const diff = Math.abs(extractedData.amount - order.amount);

    if (diff <= tolerance) {
      results.amountMatch = true;
    } else {
      errors.push(`Amount mismatch: Expected ₱${order.amount}, found ₱${extractedData.amount}`);
    }
  } else {
    errors.push('Amount not found in screenshot');
  }

  // Check receiver name
  if (extractedData.receiverName) {
    const expectedName = (order.expectedReceiverName || order.gcashAccountName || '').toUpperCase();
    const foundName = extractedData.receiverName.toUpperCase();

    // Fuzzy match: check if names contain each other or share significant words
    if (
      foundName.includes(expectedName) ||
      expectedName.includes(foundName) ||
      compareNames(foundName, expectedName)
    ) {
      results.receiverMatch = true;
    } else {
      errors.push(`Receiver name mismatch: Expected "${order.expectedReceiverName}", found "${extractedData.receiverName}"`);
    }
  } else {
    errors.push('Receiver name not found in screenshot');
  }

  // Check timestamp freshness
  if (extractedData.transactionDate) {
    const receiptTime = new Date(extractedData.transactionDate).getTime();
    const orderTime = order.createdAt?.toDate?.()?.getTime() || Date.now();
    const now = Date.now();

    // Receipt should be after order creation and within MAX_RECEIPT_AGE_MINUTES
    const maxAge = THRESHOLDS.MAX_RECEIPT_AGE_MINUTES * 60 * 1000;

    if (receiptTime >= orderTime - (5 * 60 * 1000) && // 5 min tolerance before order
        now - receiptTime <= maxAge) {
      results.timestampValid = true;
    } else {
      errors.push(`Receipt timestamp is outside valid window (must be within ${THRESHOLDS.MAX_RECEIPT_AGE_MINUTES} minutes)`);
    }
  } else {
    // Timestamp not found, but don't fail completely
    errors.push('Transaction timestamp not clearly detected');
  }

  // Check if we have minimum required fields
  results.hasRequiredFields = results.referencePresent && results.amountMatch;

  // Overall status
  results.allPassed = results.amountMatch && results.receiverMatch && results.referencePresent;
  results.errors = errors;

  return results;
}

/**
 * Compare two names for similarity
 * @param {string} name1 - First name
 * @param {string} name2 - Second name
 * @returns {boolean} - True if names are similar enough
 */
function compareNames(name1, name2) {
  // Normalize names: uppercase, remove extra spaces, common words
  const normalize = (name) => {
    return name
      .toUpperCase()
      .replace(/[^A-Z\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(word => !['THE', 'AND', 'OF', 'INC', 'LLC', 'CORP'].includes(word));
  };

  const words1 = normalize(name1);
  const words2 = normalize(name2);

  // Check if significant words match
  const matchCount = words1.filter(w => words2.includes(w)).length;
  const minWords = Math.min(words1.length, words2.length);

  // At least 50% of words should match
  return minWords > 0 && matchCount >= minWords * 0.5;
}

module.exports = {
  processScreenshot,
  validateExtractedData,
  calculateExtractionScore
};
