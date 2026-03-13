const functions = require('firebase-functions');
const admin = require('firebase-admin');

const RATE_LIMIT_COLLECTION = 'callableRateLimits';
const DEFAULT_WINDOW_MS = 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = 10;

function normalizePositiveInteger(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

function buildDocId(operation, userId) {
  return `${operation}:${userId}`;
}

async function enforceUserRateLimit({
  db,
  userId,
  operation,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  windowMs = DEFAULT_WINDOW_MS,
}) {
  if (!db) {
    throw new Error('Firestore db instance is required');
  }
  if (!userId) {
    throw new Error('userId is required for rate limiting');
  }
  if (!operation) {
    throw new Error('operation is required for rate limiting');
  }

  const normalizedAttempts = normalizePositiveInteger(maxAttempts, DEFAULT_MAX_ATTEMPTS);
  const normalizedWindowMs = normalizePositiveInteger(windowMs, DEFAULT_WINDOW_MS);
  const nowMs = Date.now();
  const rateRef = db.collection(RATE_LIMIT_COLLECTION).doc(buildDocId(operation, userId));

  let isLimited = false;
  let retryAfterSeconds = 1;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(rateRef);
    const data = snap.exists ? (snap.data() || {}) : {};

    let attempts = 1;
    let windowStartedAtMs = nowMs;
    const hasActiveWindow = (
      typeof data.windowStartedAtMs === 'number' &&
      nowMs - data.windowStartedAtMs < normalizedWindowMs
    );

    if (hasActiveWindow) {
      windowStartedAtMs = data.windowStartedAtMs;
      attempts = (typeof data.attempts === 'number' ? data.attempts : 0) + 1;
    }

    const windowEndsAtMs = windowStartedAtMs + normalizedWindowMs;
    const remainingMs = Math.max(0, windowEndsAtMs - nowMs);
    retryAfterSeconds = Math.max(1, Math.ceil(remainingMs / 1000));

    if (attempts > normalizedAttempts) {
      isLimited = true;
      attempts = normalizedAttempts;
    }

    tx.set(rateRef, {
      operation,
      userId,
      attempts,
      maxAttempts: normalizedAttempts,
      windowMs: normalizedWindowMs,
      windowStartedAtMs,
      // Use Date for broad compatibility across firebase-admin/runtime combinations.
      updatedAt: new Date(nowMs),
    }, { merge: true });
  });

  if (isLimited) {
    throw new functions.https.HttpsError(
      'resource-exhausted',
      `Too many ${operation} attempts. Try again in ${retryAfterSeconds} seconds.`
    );
  }
}

module.exports = {
  enforceUserRateLimit,
};
