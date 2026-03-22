/**
 * Philippine Document Identifier Patterns
 *
 * Regex patterns for extracting identifiers from Philippine government documents
 * processed via OCR (Google Cloud Vision documentTextDetection).
 *
 * Documents supported:
 *   - LTO Driver's License
 *   - LTO Certificate of Registration (COR)
 */

/**
 * LTO Driver's License number format: A01-23-456789
 * - One uppercase letter prefix
 * - Two digits, hyphen, two digits, hyphen, six to nine digits
 */
const LICENSE_NUMBER_REGEX = /\b([A-Z]\d{2}-\d{2}-\d{6,9})\b/g;

/**
 * Philippine plate number formats:
 *   Old format:  ABC 1234  (3 letters + 4 digits)
 *   New format:  RAA 1234  (3 letters + 4 digits, same pattern)
 *   Motorcycle:  AB 1234   (2 letters + 4 digits)
 * Allows optional space or hyphen separator.
 */
const PLATE_NUMBER_REGEX = /\b([A-Z]{2,3}[\s-]?\d{3,4})\b/g;

/**
 * MV File Number from COR: 14-digit numeric string.
 * Used as a secondary vehicle identifier when plate is unclear.
 */
const MV_FILE_NUMBER_REGEX = /\b(\d{14})\b/g;

/**
 * License expiry date patterns common on PH driver's licenses.
 * Matches: "08/15/2026", "2026-08-15", "Aug 15, 2026"
 */
const EXPIRY_DATE_REGEX = /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})\b/gi;

/**
 * Normalize a string value for consistent comparison.
 * Uppercase, collapse whitespace, remove hyphens.
 */
function normalizeIdentifier(value) {
  if (typeof value !== 'string') return null;
  return value.toUpperCase().replace(/[\s\-]+/g, '').trim() || null;
}

/**
 * Normalize a plate number specifically — keep only alphanumeric chars, uppercase.
 */
function normalizePlate(value) {
  if (typeof value !== 'string') return null;
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').trim() || null;
}

/**
 * Extract all matches of a regex from text.
 * Resets regex lastIndex each call.
 */
function extractAll(text, regex) {
  regex.lastIndex = 0;
  const results = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    results.push(match[1]);
  }
  return results;
}

/**
 * Score extraction confidence: how many key fields were found.
 */
function scoreConfidence(fields) {
  const filled = Object.values(fields).filter(v => v !== null && v !== undefined).length;
  const total = Object.keys(fields).length;
  return total > 0 ? Math.round((filled / total) * 100) : 0;
}

/**
 * Parse identifiers from a driver's license OCR text.
 *
 * @param {string} rawText - Full OCR text from Cloud Vision
 * @returns {{ licenseNumber: string|null, licenseExpiry: string|null, confidence: number }}
 */
function parseLicenseIdentifiers(rawText) {
  if (typeof rawText !== 'string') {
    return { licenseNumber: null, licenseExpiry: null, confidence: 0 };
  }

  const upperText = rawText.toUpperCase();

  const licenseMatches = extractAll(upperText, LICENSE_NUMBER_REGEX);
  const licenseNumber = licenseMatches.length > 0
    ? normalizeIdentifier(licenseMatches[0])
    : null;

  const expiryMatches = extractAll(rawText, EXPIRY_DATE_REGEX);
  // On PH licenses the expiry date is typically the last date shown
  const licenseExpiry = expiryMatches.length > 0
    ? expiryMatches[expiryMatches.length - 1].trim()
    : null;

  const confidence = scoreConfidence({ licenseNumber, licenseExpiry });

  return { licenseNumber, licenseExpiry, confidence };
}

/**
 * Parse identifiers from a Certificate of Registration (COR) OCR text.
 *
 * @param {string} rawText - Full OCR text from Cloud Vision
 * @returns {{ plateNumber: string|null, mvFileNumber: string|null, confidence: number }}
 */
function parseCORIdentifiers(rawText) {
  if (typeof rawText !== 'string') {
    return { plateNumber: null, mvFileNumber: null, confidence: 0 };
  }

  const upperText = rawText.toUpperCase();

  const plateMatches = extractAll(upperText, PLATE_NUMBER_REGEX);
  // Filter out false positives: plates must have at least 2 letters + 3 digits
  const validPlates = plateMatches.filter(p => /[A-Z]{2,3}/.test(p) && /\d{3,4}/.test(p));
  const plateNumber = validPlates.length > 0
    ? normalizePlate(validPlates[0])
    : null;

  const mvMatches = extractAll(upperText, MV_FILE_NUMBER_REGEX);
  const mvFileNumber = mvMatches.length > 0 ? mvMatches[0] : null;

  const confidence = scoreConfidence({ plateNumber, mvFileNumber });

  return { plateNumber, mvFileNumber, confidence };
}

/**
 * Main entry point. Dispatches to the appropriate parser based on docType.
 *
 * @param {string} rawText - Full OCR text from Cloud Vision
 * @param {'driver_license'|'lto_registration'} docType
 * @returns {{
 *   licenseNumber?: string|null,
 *   licenseExpiry?: string|null,
 *   plateNumber?: string|null,
 *   mvFileNumber?: string|null,
 *   confidence: number
 * }}
 */
function parsePhilippineDocIdentifiers(rawText, docType) {
  if (docType === 'driver_license') {
    return parseLicenseIdentifiers(rawText);
  }
  if (docType === 'lto_registration') {
    return parseCORIdentifiers(rawText);
  }
  return { confidence: 0 };
}

module.exports = {
  parsePhilippineDocIdentifiers,
  parseLicenseIdentifiers,
  parseCORIdentifiers,
  normalizeIdentifier,
  normalizePlate,
};
