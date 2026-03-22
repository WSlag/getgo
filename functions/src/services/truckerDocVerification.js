/**
 * Trucker Document Verification Service
 *
 * Handles three capabilities for uploaded trucker documents
 * (driver's license and LTO Certificate of Registration):
 *
 *   1. computeDocumentHash   — perceptual hash for duplicate image detection
 *   2. extractDocumentIdentifiers — OCR via Cloud Vision to extract license/plate numbers
 *   3. checkAgainstSuspendedIdentifiers — cross-check extracted values against blocklist
 *
 * Design notes:
 *   - Trucker docs are private Firebase Storage files. Cloud Vision is called with a
 *     GCS URI (gs://bucket/path) which it can access natively without a signed URL.
 *   - The stored download URL is parsed with parseTrustedStorageUrl() to obtain
 *     the bucket name and object path.
 *   - Perceptual hashing uses admin.storage() to download the file as a buffer,
 *     then calls the existing generatePerceptualHash() from imageAnalysis.js.
 */

const admin = require('firebase-admin');
const vision = require('@google-cloud/vision');
const { generatePerceptualHash } = require('./imageAnalysis');
const { parseTrustedStorageUrl } = require('../utils/storageUrl');
const { parsePhilippineDocIdentifiers, normalizeIdentifier, normalizePlate } = require('../utils/philippineDocPatterns');

// Reuse the same Vision client initialized by ocr.js (Application Default Credentials)
const visionClient = new vision.ImageAnnotatorClient();

/**
 * Extract { bucket, objectPath } from a Firebase Storage download URL.
 * Returns null if the URL is not a trusted storage URL.
 *
 * @param {string|Object} storedDoc - URL string or { url, path } metadata object
 * @returns {{ bucket: string, objectPath: string }|null}
 */
function resolveStorageLocation(storedDoc) {
  const url = typeof storedDoc === 'string'
    ? storedDoc
    : (storedDoc && typeof storedDoc.url === 'string' ? storedDoc.url : null);

  if (!url) return null;

  const parsed = parseTrustedStorageUrl(url);
  if (!parsed.valid || !parsed.bucket || !parsed.objectPath) return null;

  return { bucket: parsed.bucket, objectPath: parsed.objectPath };
}

/**
 * Compute a perceptual hash of a trucker document image.
 *
 * @param {string|Object} storedDoc - Firebase Storage URL or { url } metadata object
 * @returns {Promise<string|null>} hex hash string, or null on failure
 */
async function computeDocumentHash(storedDoc) {
  try {
    const location = resolveStorageLocation(storedDoc);
    if (!location) {
      console.warn('truckerDocVerification.computeDocumentHash: could not resolve storage location');
      return null;
    }

    const { bucket, objectPath } = location;
    const [fileContents] = await admin.storage().bucket(bucket).file(objectPath).download();
    const hash = await generatePerceptualHash(fileContents);
    return hash || null;
  } catch (error) {
    console.error('truckerDocVerification.computeDocumentHash error:', error.message);
    return null;
  }
}

/**
 * Extract document identifiers (license number, plate number, etc.) from
 * a trucker document image using Google Cloud Vision OCR.
 *
 * @param {string|Object} storedDoc - Firebase Storage URL or { url } metadata object
 * @param {'driver_license'|'lto_registration'} docType
 * @returns {Promise<{
 *   licenseNumber?: string|null,
 *   licenseExpiry?: string|null,
 *   plateNumber?: string|null,
 *   mvFileNumber?: string|null,
 *   confidence: number,
 *   rawText?: string
 * }>}
 */
async function extractDocumentIdentifiers(storedDoc, docType) {
  try {
    const location = resolveStorageLocation(storedDoc);
    if (!location) {
      console.warn('truckerDocVerification.extractDocumentIdentifiers: could not resolve storage location');
      return { confidence: 0 };
    }

    const { bucket, objectPath } = location;
    // Use GCS URI — Cloud Vision can access private GCS files natively
    const gcsUri = `gs://${bucket}/${objectPath}`;

    const [result] = await visionClient.documentTextDetection(gcsUri);
    const rawText = result.fullTextAnnotation
      ? result.fullTextAnnotation.text
      : (result.textAnnotations && result.textAnnotations[0]
          ? result.textAnnotations[0].description
          : '');

    if (!rawText) {
      return { confidence: 0 };
    }

    const identifiers = parsePhilippineDocIdentifiers(rawText, docType);
    return { ...identifiers, rawText };
  } catch (error) {
    console.error('truckerDocVerification.extractDocumentIdentifiers error:', error.message);
    return { confidence: 0 };
  }
}

/**
 * Check a set of extracted identifiers against the suspendedIdentifiers blocklist.
 *
 * Text identifiers (licenseNumber, plateNumber) use exact Firestore equality queries.
 * Hash identifiers use exact match for v1; near-duplicate Hamming scan is future work.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {{
 *   licenseNumber?: string|null,
 *   plateNumber?: string|null,
 *   driverLicenseHash?: string|null,
 *   ltoRegistrationHash?: string|null,
 * }} identifiers
 * @returns {Promise<{ matched: boolean, matchType: string|null, matchedValue: string|null }>}
 */
async function checkAgainstSuspendedIdentifiers(db, identifiers) {
  const checks = [];

  const { licenseNumber, plateNumber, driverLicenseHash, ltoRegistrationHash } = identifiers || {};

  const normalizedLicense = normalizeIdentifier(licenseNumber);
  if (normalizedLicense) {
    checks.push(
      db.collection('suspendedIdentifiers')
        .where('type', '==', 'licenseNumber')
        .where('value', '==', normalizedLicense)
        .limit(1)
        .get()
        .then(snap => snap.empty ? null : { matchType: 'licenseNumber', matchedValue: normalizedLicense })
    );
  }

  const normalizedPlate = normalizePlate(plateNumber);
  if (normalizedPlate) {
    checks.push(
      db.collection('suspendedIdentifiers')
        .where('type', '==', 'plateNumber')
        .where('value', '==', normalizedPlate)
        .limit(1)
        .get()
        .then(snap => snap.empty ? null : { matchType: 'plateNumber', matchedValue: normalizedPlate })
    );
  }

  if (driverLicenseHash) {
    checks.push(
      db.collection('suspendedIdentifiers')
        .where('type', '==', 'docImageHash')
        .where('value', '==', driverLicenseHash)
        .limit(1)
        .get()
        .then(snap => snap.empty ? null : { matchType: 'driverLicenseHash', matchedValue: driverLicenseHash })
    );
  }

  if (ltoRegistrationHash) {
    checks.push(
      db.collection('suspendedIdentifiers')
        .where('type', '==', 'docImageHash')
        .where('value', '==', ltoRegistrationHash)
        .limit(1)
        .get()
        .then(snap => snap.empty ? null : { matchType: 'ltoRegistrationHash', matchedValue: ltoRegistrationHash })
    );
  }

  if (checks.length === 0) {
    return { matched: false, matchType: null, matchedValue: null };
  }

  const results = await Promise.all(checks);
  const hit = results.find(r => r !== null) || null;

  return {
    matched: hit !== null,
    matchType: hit ? hit.matchType : null,
    matchedValue: hit ? hit.matchedValue : null,
  };
}

module.exports = {
  computeDocumentHash,
  extractDocumentIdentifiers,
  checkAgainstSuspendedIdentifiers,
  resolveStorageLocation,
};
