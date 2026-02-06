/**
 * GCash Receipt OCR Pattern Matching
 *
 * These regex patterns are designed to extract key information from GCash
 * payment receipt screenshots. GCash has multiple receipt formats:
 * - Send Money receipts
 * - Pay QR receipts
 * - Bills Payment receipts
 *
 * The patterns are ordered by specificity/reliability.
 */

const GCASH_PATTERNS = {
  // ===========================================
  // REFERENCE NUMBER PATTERNS
  // ===========================================
  // GCash reference numbers typically follow these formats:
  // - "XXXX XXXXXXXXXX" (4 digits, space, 10 digits)
  // - "XXXX XXXX XXXX" (three groups of 4)
  // - Pure numeric: "1234567890123456"
  REFERENCE_NUMBER: [
    // Pattern: "Ref. No.: 1234 5678901234" or "Reference No: XXXX..."
    /Ref(?:erence)?\.?\s*(?:No\.?|Number|#)?:?\s*([A-Z0-9]{4}\s?[A-Z0-9]{8,12})/i,

    // Pattern: "GCash Ref: XXXXXXXXXXXX" or "Transaction Ref: XXX"
    /(?:GCash|Transaction)\s*Ref(?:erence)?:?\s*([A-Z0-9\s]{12,20})/i,

    // Pattern: Three groups of 4 digits "XXXX XXXX XXXX"
    /(\d{4}\s\d{4}\s\d{4})/,

    // Pattern: "Ref No" followed by number on next line
    /Ref(?:erence)?\s*(?:No\.?)?[\s:]*\n?\s*([A-Z0-9]{10,16})/i,

    // Pattern: 12-16 digit number that looks like a reference
    /\b(\d{12,16})\b/
  ],

  // ===========================================
  // AMOUNT PATTERNS
  // ===========================================
  // Philippine Peso amounts in various formats:
  // - "PHP 1,500.00"
  // - "₱1,500.00"
  // - "Amount: 1500"
  AMOUNT: [
    // Pattern: "PHP 1,500.00" or "₱1,500.00"
    /(?:PHP|₱)\s*([\d,]+\.?\d{0,2})/i,

    // Pattern: "Amount: PHP 1,500.00" or "Amount: ₱1500"
    /Amount:?\s*(?:PHP|₱)?\s*([\d,]+\.?\d{0,2})/i,

    // Pattern: "You sent PHP 1,500.00" or "You paid ₱1500"
    /You\s+(?:sent|paid)\s+(?:PHP|₱)?\s*([\d,]+\.?\d{0,2})/i,

    // Pattern: "Total: PHP 1,500.00"
    /Total:?\s*(?:PHP|₱)?\s*([\d,]+\.?\d{0,2})/i,

    // Pattern: "P 1,500.00" (sometimes GCash uses just P)
    /\bP\s*([\d,]+\.\d{2})\b/,

    // Pattern: Large peso amount (4+ digits with optional decimals)
    /(?:PHP|₱|P)\s*([\d]{1,3}(?:,\d{3})*(?:\.\d{2})?)/i
  ],

  // ===========================================
  // SENDER NAME PATTERNS
  // ===========================================
  SENDER: [
    // Pattern: "From: Juan Dela Cruz"
    /From:?\s*([A-Za-z\s\.]+?)(?:\n|$|Phone)/i,

    // Pattern: "Sent by: Juan Dela Cruz"
    /Sent\s+by:?\s*([A-Za-z\s\.]+?)(?:\n|$)/i,

    // Pattern: "Sender: Juan Dela Cruz"
    /Sender:?\s*([A-Za-z\s\.]+?)(?:\n|$)/i,

    // Pattern: "From" on one line, name on next
    /From[\s:]*\n\s*([A-Za-z\s\.]+)/i
  ],

  // ===========================================
  // RECEIVER NAME PATTERNS
  // ===========================================
  RECEIVER: [
    // Pattern: "To: Karga Connect"
    /To:?\s*([A-Za-z\s\.]+?)(?:\n|$|Phone)/i,

    // Pattern: "Received by: Karga Connect"
    /Received\s+by:?\s*([A-Za-z\s\.]+?)(?:\n|$)/i,

    // Pattern: "Recipient: Karga Connect"
    /Recipient:?\s*([A-Za-z\s\.]+?)(?:\n|$)/i,

    // Pattern: "Send Money to: Karga Connect"
    /Send\s+Money\s+to:?\s*([A-Za-z\s\.]+?)(?:\n|$)/i,

    // Pattern: "To" on one line, name on next
    /To[\s:]*\n\s*([A-Za-z\s\.]+)/i,

    // Pattern: Account name after phone number
    /09\d{9}\s*\n?\s*([A-Za-z\s\.]+)/
  ],

  // ===========================================
  // TIMESTAMP PATTERNS
  // ===========================================
  // Philippine date formats:
  // - "01/15/2026, 2:30 PM"
  // - "January 15, 2026 at 2:30 PM"
  // - "2026-01-15 14:30"
  TIMESTAMP: [
    // Pattern: "MM/DD/YYYY, HH:MM AM/PM"
    /(\d{1,2}\/\d{1,2}\/\d{2,4})\s*,?\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i,

    // Pattern: "Month DD, YYYY at HH:MM AM/PM"
    /(\w+\s+\d{1,2},?\s+\d{4})\s+(?:at\s+)?(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i,

    // Pattern: "Date: MM/DD/YYYY"
    /Date:?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,

    // Pattern: "YYYY-MM-DD HH:MM" (ISO format)
    /(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/,

    // Pattern: Just the date "Jan 15, 2026" or "January 15, 2026"
    /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})/i,

    // Pattern: "DD/MM/YYYY" (alternative format)
    /(\d{2}\/\d{2}\/\d{4})/
  ],

  // ===========================================
  // SUCCESS INDICATORS
  // ===========================================
  // Keywords that indicate a successful transaction
  SUCCESS_INDICATORS: [
    /success(?:ful(?:ly)?)?/i,
    /completed/i,
    /sent\s+to/i,
    /received/i,
    /transaction\s+complete/i,
    /payment\s+successful/i,
    /money\s+sent/i,
    /transfer\s+successful/i
  ],

  // ===========================================
  // GCASH BRANDING
  // ===========================================
  // Indicators that this is a genuine GCash receipt
  GCASH_INDICATORS: [
    /gcash/i,
    /g-?cash/i,
    /globe\s+fintech/i,
    /mynt/i
  ]
};

/**
 * Extract reference number from OCR text
 * @param {string} text - Full OCR text
 * @returns {string|null} - Extracted reference number or null
 */
function extractReferenceNumber(text) {
  for (const pattern of GCASH_PATTERNS.REFERENCE_NUMBER) {
    const match = text.match(pattern);
    if (match && match[1]) {
      // Clean up: remove spaces, ensure alphanumeric
      const cleaned = match[1].replace(/\s+/g, '').trim();
      if (cleaned.length >= 10) {
        return cleaned;
      }
    }
  }
  return null;
}

/**
 * Extract amount from OCR text
 * @param {string} text - Full OCR text
 * @returns {number|null} - Extracted amount as number or null
 */
function extractAmount(text) {
  for (const pattern of GCASH_PATTERNS.AMOUNT) {
    const match = text.match(pattern);
    if (match && match[1]) {
      // Remove commas and parse as float
      const cleaned = match[1].replace(/,/g, '');
      const amount = parseFloat(cleaned);
      if (!isNaN(amount) && amount > 0) {
        return amount;
      }
    }
  }
  return null;
}

/**
 * Extract raw amount string from OCR text (for debugging)
 * @param {string} text - Full OCR text
 * @returns {string|null} - Raw amount string or null
 */
function extractAmountRaw(text) {
  for (const pattern of GCASH_PATTERNS.AMOUNT) {
    const match = text.match(pattern);
    if (match && match[0]) {
      return match[0].trim();
    }
  }
  return null;
}

/**
 * Extract sender name from OCR text
 * @param {string} text - Full OCR text
 * @returns {string|null} - Extracted sender name or null
 */
function extractSenderName(text) {
  for (const pattern of GCASH_PATTERNS.SENDER) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const cleaned = match[1].trim();
      // Validate: should be at least 2 words or 5 characters
      if (cleaned.length >= 5 || cleaned.split(/\s+/).length >= 2) {
        return cleaned;
      }
    }
  }
  return null;
}

/**
 * Extract receiver name from OCR text
 * @param {string} text - Full OCR text
 * @returns {string|null} - Extracted receiver name or null
 */
function extractReceiverName(text) {
  for (const pattern of GCASH_PATTERNS.RECEIVER) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const cleaned = match[1].trim();
      // Validate: should be at least 2 words or 5 characters
      if (cleaned.length >= 5 || cleaned.split(/\s+/).length >= 2) {
        return cleaned;
      }
    }
  }
  return null;
}

/**
 * Extract timestamp from OCR text
 * @param {string} text - Full OCR text
 * @returns {string|null} - Extracted timestamp string or null
 */
function extractTimestamp(text) {
  for (const pattern of GCASH_PATTERNS.TIMESTAMP) {
    const match = text.match(pattern);
    if (match) {
      // Combine date and time if captured separately
      if (match[2]) {
        return `${match[1]} ${match[2]}`.trim();
      }
      return match[1].trim();
    }
  }
  return null;
}

/**
 * Parse timestamp string into Date object
 * @param {string} timestampStr - Timestamp string from extractTimestamp
 * @returns {Date|null} - Parsed Date or null
 */
function parseTransactionDate(timestampStr) {
  if (!timestampStr) return null;

  try {
    // Try various date parsing approaches

    // Handle "MM/DD/YYYY, HH:MM AM/PM"
    const mmddyyyy = timestampStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (mmddyyyy) {
      let year = parseInt(mmddyyyy[3]);
      if (year < 100) year += 2000;

      const timeMatch = timestampStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      let hours = 0, minutes = 0;

      if (timeMatch) {
        hours = parseInt(timeMatch[1]);
        minutes = parseInt(timeMatch[2]);
        if (timeMatch[3] && timeMatch[3].toUpperCase() === 'PM' && hours < 12) {
          hours += 12;
        }
        if (timeMatch[3] && timeMatch[3].toUpperCase() === 'AM' && hours === 12) {
          hours = 0;
        }
      }

      return new Date(year, parseInt(mmddyyyy[1]) - 1, parseInt(mmddyyyy[2]), hours, minutes);
    }

    // Try JavaScript's native Date parsing as fallback
    const parsed = new Date(timestampStr);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }

    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Check if text contains success indicators
 * @param {string} text - Full OCR text
 * @returns {boolean} - True if success indicators found
 */
function hasSuccessIndicators(text) {
  return GCASH_PATTERNS.SUCCESS_INDICATORS.some(pattern => pattern.test(text));
}

/**
 * Check if text appears to be from GCash
 * @param {string} text - Full OCR text
 * @returns {boolean} - True if GCash branding found
 */
function isGCashReceipt(text) {
  return GCASH_PATTERNS.GCASH_INDICATORS.some(pattern => pattern.test(text));
}

/**
 * Extract all data from OCR text
 * @param {string} text - Full OCR text
 * @returns {Object} - All extracted fields
 */
function extractAllData(text) {
  const timestamp = extractTimestamp(text);

  return {
    referenceNumber: extractReferenceNumber(text),
    amount: extractAmount(text),
    amountRaw: extractAmountRaw(text),
    senderName: extractSenderName(text),
    receiverName: extractReceiverName(text),
    timestamp: timestamp,
    transactionDate: parseTransactionDate(timestamp),
    hasSuccessIndicators: hasSuccessIndicators(text),
    isGCashReceipt: isGCashReceipt(text),
    rawText: text
  };
}

module.exports = {
  GCASH_PATTERNS,
  extractReferenceNumber,
  extractAmount,
  extractAmountRaw,
  extractSenderName,
  extractReceiverName,
  extractTimestamp,
  parseTransactionDate,
  hasSuccessIndicators,
  isGCashReceipt,
  extractAllData
};
