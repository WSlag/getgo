/**
 * Image Analysis Service
 *
 * Analyzes payment screenshots for:
 * - Perceptual hashing (duplicate detection)
 * - Image dimensions
 * - EXIF metadata extraction
 */

const sharp = require('sharp');
const axios = require('axios');
const { isTrustedPaymentScreenshotUrl } = require('../utils/storageUrl');

/**
 * Analyze an image from a URL
 * @param {string} imageUrl - URL of the image to analyze
 * @returns {Promise<Object>} - Analysis results
 */
async function analyzeImage(imageUrl, expectedUserId = null) {
  try {
    if (!isTrustedPaymentScreenshotUrl(imageUrl, expectedUserId)) {
      throw new Error('Untrusted screenshot URL');
    }

    // Download image
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000
    });

    const imageBuffer = Buffer.from(response.data);

    // Get image metadata using sharp
    const metadata = await sharp(imageBuffer).metadata();

    // Generate perceptual hash
    const hash = await generatePerceptualHash(imageBuffer);

    // Extract EXIF data
    const exif = extractExifData(metadata);

    return {
      success: true,
      hash: hash,
      dimensions: {
        width: metadata.width,
        height: metadata.height
      },
      format: metadata.format,
      size: imageBuffer.length,
      exif: exif,
      hasAlpha: metadata.hasAlpha || false,
      orientation: metadata.orientation || 1
    };

  } catch (error) {
    console.error('Image analysis error:', error);
    return {
      success: false,
      error: error.message,
      hash: null,
      dimensions: null,
      exif: null
    };
  }
}

/**
 * Generate a perceptual hash (pHash) for duplicate detection
 *
 * Algorithm:
 * 1. Resize image to 32x32
 * 2. Convert to grayscale
 * 3. Calculate DCT (simplified: use average)
 * 4. Generate hash from comparison to mean
 *
 * @param {Buffer} imageBuffer - Image buffer
 * @returns {Promise<string>} - Hex hash string
 */
async function generatePerceptualHash(imageBuffer) {
  try {
    // Resize to 8x8 and convert to grayscale
    const resized = await sharp(imageBuffer)
      .resize(8, 8, { fit: 'fill' })
      .greyscale()
      .raw()
      .toBuffer();

    // Calculate average pixel value
    let sum = 0;
    for (let i = 0; i < resized.length; i++) {
      sum += resized[i];
    }
    const avg = sum / resized.length;

    // Generate hash: 1 if pixel > average, 0 otherwise
    let hash = '';
    for (let i = 0; i < resized.length; i++) {
      hash += resized[i] > avg ? '1' : '0';
    }

    // Convert binary string to hex for storage efficiency
    const hexHash = binaryToHex(hash);

    return hexHash;

  } catch (error) {
    console.error('Hash generation error:', error);
    // Return a unique identifier if hashing fails
    return `ERR_${Date.now().toString(16)}`;
  }
}

/**
 * Convert binary string to hex
 * @param {string} binary - Binary string
 * @returns {string} - Hex string
 */
function binaryToHex(binary) {
  // Pad to multiple of 4
  while (binary.length % 4 !== 0) {
    binary = '0' + binary;
  }

  let hex = '';
  for (let i = 0; i < binary.length; i += 4) {
    hex += parseInt(binary.substr(i, 4), 2).toString(16);
  }

  return hex;
}

/**
 * Calculate Hamming distance between two hashes
 * @param {string} hash1 - First hex hash
 * @param {string} hash2 - Second hex hash
 * @returns {number} - Hamming distance (number of different bits)
 */
function hammingDistance(hash1, hash2) {
  if (!hash1 || !hash2) return 64; // Max distance

  // Convert hex to binary
  const bin1 = hexToBinary(hash1);
  const bin2 = hexToBinary(hash2);

  // Pad to same length
  const maxLen = Math.max(bin1.length, bin2.length);
  const padded1 = bin1.padStart(maxLen, '0');
  const padded2 = bin2.padStart(maxLen, '0');

  // Count differences
  let distance = 0;
  for (let i = 0; i < maxLen; i++) {
    if (padded1[i] !== padded2[i]) {
      distance++;
    }
  }

  return distance;
}

/**
 * Convert hex string to binary
 * @param {string} hex - Hex string
 * @returns {string} - Binary string
 */
function hexToBinary(hex) {
  let binary = '';
  for (let i = 0; i < hex.length; i++) {
    binary += parseInt(hex[i], 16).toString(2).padStart(4, '0');
  }
  return binary;
}

/**
 * Calculate similarity between two hashes (0-1, higher = more similar)
 * @param {string} hash1 - First hex hash
 * @param {string} hash2 - Second hex hash
 * @returns {number} - Similarity score (0-1)
 */
function hashSimilarity(hash1, hash2) {
  const distance = hammingDistance(hash1, hash2);
  const maxBits = 64; // 8x8 image = 64 bits
  return 1 - (distance / maxBits);
}

/**
 * Extract EXIF metadata from sharp metadata
 * @param {Object} metadata - Sharp metadata object
 * @returns {Object|null} - Extracted EXIF data or null
 */
function extractExifData(metadata) {
  const exif = {};

  // Extract common EXIF fields if available
  if (metadata.exif) {
    try {
      // Sharp returns exif as a buffer, we'd need exif-reader to parse it
      // For now, just note that EXIF exists
      exif.hasExif = true;
      exif.rawLength = metadata.exif.length;
    } catch (e) {
      exif.hasExif = false;
    }
  } else {
    exif.hasExif = false;
  }

  // Add other metadata that might indicate screenshot vs camera photo
  if (metadata.density) {
    exif.density = metadata.density;
  }

  if (metadata.chromaSubsampling) {
    exif.chromaSubsampling = metadata.chromaSubsampling;
  }

  // Screenshots often have specific characteristics
  exif.isLikelyScreenshot = detectScreenshotCharacteristics(metadata);

  return Object.keys(exif).length > 0 ? exif : null;
}

/**
 * Detect if image has characteristics of a screenshot
 * @param {Object} metadata - Sharp metadata object
 * @returns {boolean} - True if likely a screenshot
 */
function detectScreenshotCharacteristics(metadata) {
  // Common mobile screenshot dimensions
  const commonWidths = [720, 750, 828, 1080, 1125, 1170, 1242, 1284, 1440];
  const commonHeights = [1280, 1334, 1792, 1920, 2340, 2436, 2532, 2688, 2560];

  // Check if dimensions match common screenshot sizes
  const isCommonWidth = commonWidths.some(w => Math.abs(metadata.width - w) < 10);
  const isCommonHeight = commonHeights.some(h => Math.abs(metadata.height - h) < 10);

  // Screenshots are typically PNG
  const isPNG = metadata.format === 'png';

  // Screenshots usually don't have EXIF data
  const noExif = !metadata.exif;

  return (isCommonWidth || isCommonHeight) || (isPNG && noExif);
}

/**
 * Compare two images for similarity
 * @param {string} hash1 - First image hash
 * @param {string} hash2 - Second image hash
 * @param {number} threshold - Similarity threshold (0-1)
 * @returns {Object} - Comparison result
 */
function compareImages(hash1, hash2, threshold = 0.9) {
  const similarity = hashSimilarity(hash1, hash2);
  const distance = hammingDistance(hash1, hash2);

  return {
    similarity,
    distance,
    isDuplicate: similarity >= 0.99, // Nearly exact match
    isSimilar: similarity >= threshold && similarity < 0.99,
    isUnique: similarity < threshold
  };
}

module.exports = {
  analyzeImage,
  generatePerceptualHash,
  hammingDistance,
  hashSimilarity,
  compareImages,
  extractExifData
};
