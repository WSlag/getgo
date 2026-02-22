/**
 * Trusted Firebase Storage payment screenshot URL validation.
 * Defends against SSRF by restricting hosts/protocols/paths.
 */

const TRUSTED_STORAGE_HOSTS = new Set([
  'firebasestorage.googleapis.com',
  'storage.googleapis.com'
]);

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

function isTrustedPaymentScreenshotUrl(rawUrl, expectedUserId = null) {
  if (typeof rawUrl !== 'string' || rawUrl.length === 0 || rawUrl.length > 2048) {
    return false;
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (error) {
    return false;
  }

  if (!isTrustedStorageOrigin(parsed)) {
    return false;
  }

  let decoded = `${parsed.pathname}${parsed.search}`;
  try {
    decoded = decodeURIComponent(decoded);
  } catch (error) {
    return false;
  }
  if (!decoded.includes('/payments/')) {
    return false;
  }

  const userId = normalizeUserId(expectedUserId);
  if (userId && !decoded.includes(`/payments/${userId}/`)) {
    return false;
  }

  return true;
}

module.exports = {
  isTrustedPaymentScreenshotUrl
};
