const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');

const REGION = 'asia-southeast1';
const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_LENGTH = 12;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_BLOCK_MS = 30 * 60 * 1000;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const GENERIC_RECOVERY_ERROR = 'Invalid recovery credentials';

function normalizePhoneNumber(value) {
  const input = String(value || '').trim();
  if (!input) return null;

  if (input.startsWith('+')) {
    return input;
  }

  const digits = input.replace(/\D/g, '');
  if (!digits) return null;

  if (digits.startsWith('63')) return `+${digits}`;
  if (digits.startsWith('0')) return `+63${digits.slice(1)}`;
  return `+63${digits}`;
}

function normalizeRecoveryCode(value) {
  const raw = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return raw || null;
}

function hashValue(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hashRecoveryCode(uid, normalizedCode) {
  return hashValue(`${uid}:${normalizedCode}`);
}

function randomCodeRaw() {
  let output = '';
  for (let i = 0; i < RECOVERY_CODE_LENGTH; i += 1) {
    const index = crypto.randomInt(0, CODE_ALPHABET.length);
    output += CODE_ALPHABET[index];
  }
  return output;
}

function formatRecoveryCode(raw) {
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

function getClientIp(context) {
  return context?.rawRequest?.ip || 'unknown';
}

function rateLimitKey(phoneNumber, ipAddress) {
  return hashValue(`${phoneNumber}|${ipAddress}`).slice(0, 40);
}

function maskPhone(phoneNumber) {
  if (!phoneNumber) return null;
  const visible = phoneNumber.slice(-4);
  return `***${visible}`;
}

async function assertNotRateLimited(ref, nowMs) {
  const snap = await ref.get();
  if (!snap.exists) return;

  const data = snap.data() || {};
  if (typeof data.blockedUntilMs === 'number' && data.blockedUntilMs > nowMs) {
    throw new functions.https.HttpsError(
      'resource-exhausted',
      'Too many recovery attempts. Please try again later.'
    );
  }
}

async function recordFailedAttempt(ref, nowMs) {
  await ref.firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? (snap.data() || {}) : {};

    let attempts = 1;
    let windowStartedAtMs = nowMs;
    let blockedUntilMs = null;

    if (
      typeof data.windowStartedAtMs === 'number' &&
      nowMs - data.windowStartedAtMs <= RATE_LIMIT_WINDOW_MS
    ) {
      attempts = (typeof data.attempts === 'number' ? data.attempts : 0) + 1;
      windowStartedAtMs = data.windowStartedAtMs;
    }

    if (attempts >= RATE_LIMIT_MAX_ATTEMPTS) {
      blockedUntilMs = nowMs + RATE_LIMIT_BLOCK_MS;
      attempts = RATE_LIMIT_MAX_ATTEMPTS;
    }

    tx.set(ref, {
      attempts,
      windowStartedAtMs,
      blockedUntilMs,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

async function clearRateLimit(ref) {
  try {
    await ref.delete();
  } catch (error) {
    // Ignore cleanup failures.
  }
}

async function logRecoveryEvent(payload) {
  await admin.firestore().collection('authRecoveryEvents').add({
    ...payload,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

exports.authGetRecoveryStatus = functions.region(REGION).https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const db = admin.firestore();
  const uid = context.auth.uid;
  const recoverySnap = await db.collection('accountRecovery').doc(uid).get();

  if (!recoverySnap.exists) {
    return {
      enabled: false,
      activeCodes: 0,
      usedCodes: 0,
      lastGeneratedAt: null,
      lastUsedAt: null,
      updatedAt: null,
    };
  }

  const recovery = recoverySnap.data() || {};
  const codes = Array.isArray(recovery.codes) ? recovery.codes : [];
  const activeCodes = codes.filter((entry) => entry && !entry.usedAt).length;
  const usedCodes = codes.length - activeCodes;

  return {
    enabled: codes.length > 0,
    activeCodes,
    usedCodes,
    lastGeneratedAt: recovery.lastGeneratedAt || null,
    lastUsedAt: recovery.lastUsedAt || null,
    updatedAt: recovery.updatedAt || null,
  };
});

exports.authGenerateRecoveryCodes = functions.region(REGION).https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const db = admin.firestore();
  const uid = context.auth.uid;
  const userSnap = await db.collection('users').doc(uid).get();
  const userData = userSnap.exists ? (userSnap.data() || {}) : null;

  if (!userData) {
    throw new functions.https.HttpsError('failed-precondition', 'Complete your profile first');
  }

  const normalizedPhone = normalizePhoneNumber(userData.phone || context.auth.token.phone_number);
  if (!normalizedPhone) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Phone number is required before enabling recovery codes'
    );
  }

  const now = admin.firestore.Timestamp.now();
  const plainCodes = [];
  const storedCodes = [];

  for (let i = 0; i < RECOVERY_CODE_COUNT; i += 1) {
    const rawCode = randomCodeRaw();
    plainCodes.push(formatRecoveryCode(rawCode));
    storedCodes.push({
      hash: hashRecoveryCode(uid, rawCode),
      suffix: rawCode.slice(-4),
      createdAt: now,
      usedAt: null,
    });
  }

  const recoveryRef = db.collection('accountRecovery').doc(uid);
  const existingSnap = await recoveryRef.get();
  const existingCreatedAt = existingSnap.exists ? existingSnap.data()?.createdAt : null;

  await recoveryRef.set({
    uid,
    phone: normalizedPhone,
    codes: storedCodes,
    activeCodes: RECOVERY_CODE_COUNT,
    usedCodes: 0,
    createdAt: existingCreatedAt || now,
    lastGeneratedAt: now,
    lastUsedAt: null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await logRecoveryEvent({
    type: 'RECOVERY_CODES_GENERATED',
    uid,
    success: true,
    ipHash: hashValue(getClientIp(context)).slice(0, 20),
  });

  await db.collection(`users/${uid}/notifications`).add({
    type: 'SECURITY',
    title: 'Recovery Codes Updated',
    message: 'Your account recovery codes were generated. Store them in a safe place.',
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    codes: plainCodes,
    totalCodes: RECOVERY_CODE_COUNT,
    generatedAt: now,
  };
});

exports.authRecoverySignIn = functions.region(REGION).https.onCall(async (data, context) => {
  const db = admin.firestore();
  const phoneNumber = normalizePhoneNumber(data?.phoneNumber);
  const recoveryCode = normalizeRecoveryCode(data?.recoveryCode);

  if (!phoneNumber || !recoveryCode || recoveryCode.length !== RECOVERY_CODE_LENGTH) {
    throw new functions.https.HttpsError('invalid-argument', 'phoneNumber and recoveryCode are required');
  }

  const ipAddress = getClientIp(context);
  const limitRef = db.collection('authRecoveryRateLimits').doc(rateLimitKey(phoneNumber, ipAddress));
  const nowMs = Date.now();

  await assertNotRateLimited(limitRef, nowMs);

  const userSnap = await db.collection('users')
    .where('phone', '==', phoneNumber)
    .limit(1)
    .get();

  if (userSnap.empty) {
    await recordFailedAttempt(limitRef, nowMs);
    await logRecoveryEvent({
      type: 'RECOVERY_SIGNIN_FAILED',
      success: false,
      reason: 'NO_USER_OR_BAD_CODE',
      phoneMasked: maskPhone(phoneNumber),
      ipHash: hashValue(ipAddress).slice(0, 20),
    });
    throw new functions.https.HttpsError('permission-denied', GENERIC_RECOVERY_ERROR);
  }

  const userDoc = userSnap.docs[0];
  const uid = userDoc.id;
  const recoveryRef = db.collection('accountRecovery').doc(uid);
  const codeHash = hashRecoveryCode(uid, recoveryCode);
  const usedAt = admin.firestore.Timestamp.now();

  try {
    await db.runTransaction(async (tx) => {
      const recoverySnap = await tx.get(recoveryRef);
      if (!recoverySnap.exists) {
        throw new functions.https.HttpsError('permission-denied', GENERIC_RECOVERY_ERROR);
      }

      const recoveryData = recoverySnap.data() || {};
      const codes = Array.isArray(recoveryData.codes) ? recoveryData.codes : [];
      const matchedIndex = codes.findIndex((entry) => entry && entry.hash === codeHash && !entry.usedAt);

      if (matchedIndex < 0) {
        throw new functions.https.HttpsError('permission-denied', GENERIC_RECOVERY_ERROR);
      }

      const updatedCodes = [...codes];
      updatedCodes[matchedIndex] = {
        ...updatedCodes[matchedIndex],
        usedAt,
      };

      const activeCodes = updatedCodes.filter((entry) => entry && !entry.usedAt).length;
      const usedCodes = updatedCodes.length - activeCodes;

      tx.update(recoveryRef, {
        codes: updatedCodes,
        activeCodes,
        usedCodes,
        lastUsedAt: usedAt,
        lastUsedIpHash: hashValue(ipAddress).slice(0, 20),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
  } catch (error) {
    const isCredentialError = error instanceof functions.https.HttpsError && error.code === 'permission-denied';
    if (isCredentialError) {
      await recordFailedAttempt(limitRef, nowMs);

      await logRecoveryEvent({
        type: 'RECOVERY_SIGNIN_FAILED',
        uid,
        success: false,
        reason: 'NO_USER_OR_BAD_CODE',
        phoneMasked: maskPhone(phoneNumber),
        ipHash: hashValue(ipAddress).slice(0, 20),
      });
      throw error;
    }

    console.error('Recovery sign-in transaction error:', error);
    throw new functions.https.HttpsError('internal', 'Recovery sign-in failed');
  }

  const customToken = await admin.auth().createCustomToken(uid, { recoverySignIn: true });
  await clearRateLimit(limitRef);

  await logRecoveryEvent({
    type: 'RECOVERY_SIGNIN_SUCCESS',
    uid,
    success: true,
    phoneMasked: maskPhone(phoneNumber),
    ipHash: hashValue(ipAddress).slice(0, 20),
  });

  await db.collection(`users/${uid}/notifications`).add({
    type: 'SECURITY',
    title: 'Recovery Sign-In Successful',
    message: 'Your account was signed in using a recovery code.',
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { customToken };
});
