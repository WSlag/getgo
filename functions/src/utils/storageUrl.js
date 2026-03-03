/**
 * Trusted Firebase Storage payment screenshot URL validation.
 * Defends against SSRF by restricting hosts/protocols/paths.
 */

const TRUSTED_STORAGE_HOSTS = new Set([
  'firebasestorage.googleapis.com',
  'storage.googleapis.com'
]);
const MAX_URL_LENGTH = 2048;
const PAYMENT_PREFIX = 'payments/';

function parseEmulatorHost(rawHost) {
  if (typeof rawHost !== 'string' || !rawHost.trim()) return null;
  const trimmed = rawHost.trim();
  const withProtocol = trimmed.includes('://') ? trimmed : `http://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    return parsed.hostname.toLowerCase();
  } catch (error) {
    return null;
  }
}

function isTrustedStorageOrigin(parsedUrl) {
  if (parsedUrl.protocol === 'https:' && TRUSTED_STORAGE_HOSTS.has(parsedUrl.hostname)) {
    return true;
  }

  // Allow local storage emulator URLs only when explicitly configured.
  const emulatorHost = parseEmulatorHost(process.env.FIREBASE_STORAGE_EMULATOR_HOST);
  if (!emulatorHost) {
    return false;
  }

  return parsedUrl.protocol === 'http:' && parsedUrl.hostname.toLowerCase() === emulatorHost;
}

function normalizeUserId(userId) {
  return typeof userId === 'string' ? userId.trim() : '';
}

function decodeUrlComponentOnce(value) {
  if (typeof value !== 'string' || value.length === 0) return null;
  try {
    return decodeURIComponent(value);
  } catch (error) {
    return null;
  }
}

function normalizeObjectPath(rawPath) {
  const decoded = decodeUrlComponentOnce(rawPath);
  if (!decoded) return null;
  if (decoded.startsWith('/') || decoded.includes('\\')) return null;
  for (let i = 0; i < decoded.length; i++) {
    const charCode = decoded.charCodeAt(i);
    if (charCode < 32 || charCode === 127) {
      return null;
    }
  }

  const parts = decoded.split('/');
  if (!parts.length) return null;
  for (const part of parts) {
    if (!part || part === '.' || part === '..') {
      return null;
    }
  }

  return parts.join('/');
}

function parseFirebaseStoragePath(pathname) {
  const match = pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
  if (!match) return null;

  const bucket = decodeUrlComponentOnce(match[1]);
  const objectPath = normalizeObjectPath(match[2]);
  if (!bucket || !objectPath) return null;

  return { bucket, objectPath };
}

function parseGoogleStoragePath(pathname) {
  const downloadMatch = pathname.match(/^\/download\/storage\/v1\/b\/([^/]+)\/o\/(.+)$/);
  if (downloadMatch) {
    const bucket = decodeUrlComponentOnce(downloadMatch[1]);
    const objectPath = normalizeObjectPath(downloadMatch[2]);
    if (!bucket || !objectPath) return null;
    return { bucket, objectPath };
  }

  const directMatch = pathname.match(/^\/([^/]+)\/(.+)$/);
  if (!directMatch) return null;

  const bucket = decodeUrlComponentOnce(directMatch[1]);
  const objectPath = normalizeObjectPath(directMatch[2]);
  if (!bucket || !objectPath) return null;

  return { bucket, objectPath };
}

function extractStorageObject(parsedUrl) {
  const hostname = parsedUrl.hostname.toLowerCase();
  if (hostname === 'firebasestorage.googleapis.com') {
    return parseFirebaseStoragePath(parsedUrl.pathname);
  }
  if (hostname === 'storage.googleapis.com') {
    return parseGoogleStoragePath(parsedUrl.pathname);
  }

  const emulatorHost = parseEmulatorHost(process.env.FIREBASE_STORAGE_EMULATOR_HOST);
  if (emulatorHost && hostname === emulatorHost && parsedUrl.protocol === 'http:') {
    return parseFirebaseStoragePath(parsedUrl.pathname);
  }

  return null;
}

function parseTrustedPaymentScreenshotUrl(rawUrl, expectedUserId = null) {
  if (typeof rawUrl !== 'string' || rawUrl.length === 0 || rawUrl.length > MAX_URL_LENGTH) {
    return { valid: false, reason: 'invalid_url_length' };
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (error) {
    return { valid: false, reason: 'invalid_url_format' };
  }

  if (!isTrustedStorageOrigin(parsed)) {
    return { valid: false, reason: 'untrusted_origin' };
  }

  const storageObject = extractStorageObject(parsed);
  if (!storageObject) {
    return { valid: false, reason: 'invalid_storage_path' };
  }

  if (!storageObject.objectPath.startsWith(PAYMENT_PREFIX)) {
    return { valid: false, reason: 'outside_payments_prefix' };
  }

  const userId = normalizeUserId(expectedUserId);
  if (userId && !storageObject.objectPath.startsWith(`${PAYMENT_PREFIX}${userId}/`)) {
    return { valid: false, reason: 'owner_mismatch' };
  }

  return {
    valid: true,
    reason: null,
    parsedUrl: parsed,
    bucket: storageObject.bucket,
    objectPath: storageObject.objectPath
  };
}

function isTrustedPaymentScreenshotUrl(rawUrl, expectedUserId = null) {
  return parseTrustedPaymentScreenshotUrl(rawUrl, expectedUserId).valid;
}

module.exports = {
  isTrustedPaymentScreenshotUrl,
  parseTrustedPaymentScreenshotUrl
};
