/**
 * Trusted Firebase Storage payment screenshot URL validation.
 * Defends against SSRF by restricting hosts/protocols/paths.
 */

const TRUSTED_STORAGE_HOSTS = new Set([
  'firebasestorage.googleapis.com',
  'storage.googleapis.com'
]);

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

  if (parsed.protocol !== 'https:' || !TRUSTED_STORAGE_HOSTS.has(parsed.hostname)) {
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
