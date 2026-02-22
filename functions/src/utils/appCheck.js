const { HttpsError } = require('firebase-functions/v2/https');
const functions = require('firebase-functions');

function isAppCheckEnforced() {
  return process.env.APP_CHECK_ENFORCED === 'true';
}

function isAuthFallbackEnabled() {
  return process.env.APP_CHECK_ALLOW_AUTH_FALLBACK === 'true';
}

function assertAppCheck(context, options = {}) {
  const { allowAuthFallback = false } = options;

  if (!isAppCheckEnforced()) return;
  if (context?.app !== undefined) return;

  if (allowAuthFallback && isAuthFallbackEnabled() && context?.auth) {
    return;
  }

  throw new HttpsError('failed-precondition', 'App Check verification required');
}

function assertAppCheckGen1(context, options = {}) {
  const { allowAuthFallback = false } = options;

  if (!isAppCheckEnforced()) return;
  if (context?.app !== undefined) return;

  if (allowAuthFallback && isAuthFallbackEnabled() && context?.auth) {
    return;
  }

  throw new functions.https.HttpsError('failed-precondition', 'App Check verification required');
}

module.exports = {
  assertAppCheck,
  assertAppCheckGen1,
  isAuthFallbackEnabled,
  isAppCheckEnforced,
};
