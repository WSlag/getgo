/**
 * Auth Cloud Functions
 * Handles role switching and auth-related operations that require server authority.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');
const { assertAppCheckGen1 } = require('../utils/appCheck');

const REGION = 'asia-southeast1';
const ALLOWED_ROLES = ['shipper', 'trucker'];
const GENERIC_MAGIC_LINK_MESSAGE = 'If an eligible account exists, a sign-in link will be sent.';
const EMAIL_LINK_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const EMAIL_LINK_RATE_LIMIT_MAX_ATTEMPTS = 5;
const EMAIL_LINK_RATE_LIMIT_BLOCK_MS = 30 * 60 * 1000;

function checkAppToken(context) {
  assertAppCheckGen1(context, { allowAuthFallback: true });
}

function isEmailMagicLinkEnabled() {
  const configured = String(process.env.EMAIL_MAGIC_LINK_ENABLED || '').trim().toLowerCase();
  if (configured === 'true') return true;
  if (configured === 'false') return false;
  return String(process.env.FUNCTIONS_EMULATOR || '').toLowerCase() === 'true';
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!email || !email.includes('@')) return null;
  return email;
}

function hashValue(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function getClientIp(context) {
  return context?.rawRequest?.ip || 'unknown';
}

function rateLimitDocId(email, ipAddress) {
  return hashValue(`${email}|${ipAddress}`).slice(0, 40);
}

function normalizeFirebaseAuthErrorCode(error) {
  if (!error?.code) return '';
  return String(error.code).replace(/^auth\//, '');
}

async function consumeEmailPrepareRateLimit(rateLimitRef, nowMs) {
  return rateLimitRef.firestore.runTransaction(async (tx) => {
    const snap = await tx.get(rateLimitRef);
    const data = snap.exists ? (snap.data() || {}) : {};

    if (typeof data.blockedUntilMs === 'number' && data.blockedUntilMs > nowMs) {
      return {
        limited: true,
        retryAfterSeconds: Math.max(1, Math.ceil((data.blockedUntilMs - nowMs) / 1000)),
      };
    }

    const inWindow =
      typeof data.windowStartedAtMs === 'number'
      && nowMs - data.windowStartedAtMs <= EMAIL_LINK_RATE_LIMIT_WINDOW_MS;

    const attempts = inWindow ? (Number(data.attempts) || 0) + 1 : 1;
    const windowStartedAtMs = inWindow ? data.windowStartedAtMs : nowMs;
    const blockedUntilMs =
      attempts >= EMAIL_LINK_RATE_LIMIT_MAX_ATTEMPTS
        ? nowMs + EMAIL_LINK_RATE_LIMIT_BLOCK_MS
        : null;

    tx.set(rateLimitRef, {
      attempts: Math.min(attempts, EMAIL_LINK_RATE_LIMIT_MAX_ATTEMPTS),
      windowStartedAtMs,
      blockedUntilMs,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    if (blockedUntilMs) {
      return {
        limited: true,
        retryAfterSeconds: Math.max(1, Math.ceil((blockedUntilMs - nowMs) / 1000)),
      };
    }

    return {
      limited: false,
      retryAfterSeconds: 0,
    };
  });
}

async function resolveEligibleEmailSignInUser(db, normalizedEmail) {
  let authUser = null;

  try {
    authUser = await admin.auth().getUserByEmail(normalizedEmail);
  } catch (error) {
    const code = normalizeFirebaseAuthErrorCode(error);
    if (code === 'user-not-found') {
      return null;
    }
    throw error;
  }

  if (!authUser?.uid || !authUser.phoneNumber) {
    return null;
  }

  const userRef = db.collection('users').doc(authUser.uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) return null;

  const userData = userSnap.data() || {};
  if (userData.isActive === false) return null;
  if (String(userData.accountStatus || '').toLowerCase() === 'suspended') return null;
  if (userData.emailAuthEnabled !== true) return null;
  if (userData.emailAuthVerified !== true) return null;

  return {
    uid: authUser.uid,
    userData,
  };
}

exports.authPrepareEmailMagicLinkSignIn = functions.region(REGION).https.onCall(async (data, context) => {
  checkAppToken(context);

  const normalizedEmail = normalizeEmail(data?.email);
  if (!normalizedEmail) {
    throw new functions.https.HttpsError('invalid-argument', 'email is required');
  }

  if (!isEmailMagicLinkEnabled()) {
    return {
      accepted: true,
      shouldSend: false,
      message: GENERIC_MAGIC_LINK_MESSAGE,
    };
  }

  const db = admin.firestore();
  const ipAddress = getClientIp(context);
  const rateLimitRef = db.collection('authEmailLinkRateLimits').doc(rateLimitDocId(normalizedEmail, ipAddress));
  const nowMs = Date.now();

  const rateLimitState = await consumeEmailPrepareRateLimit(rateLimitRef, nowMs);
  if (rateLimitState.limited) {
    return {
      accepted: true,
      shouldSend: false,
      retryAfterSeconds: rateLimitState.retryAfterSeconds,
      message: GENERIC_MAGIC_LINK_MESSAGE,
    };
  }

  let shouldSend = false;

  try {
    const eligibleUser = await resolveEligibleEmailSignInUser(db, normalizedEmail);
    shouldSend = Boolean(eligibleUser);
  } catch (error) {
    console.error('authPrepareEmailMagicLinkSignIn eligibility check failed:', error);
    shouldSend = false;
  }

  return {
    accepted: true,
    shouldSend,
    message: GENERIC_MAGIC_LINK_MESSAGE,
  };
});

exports.authFinalizeEmailLinking = functions.region(REGION).https.onCall(async (data, context) => {
  checkAppToken(context);

  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  if (!isEmailMagicLinkEnabled()) {
    throw new functions.https.HttpsError('failed-precondition', 'Email magic link is disabled');
  }

  const normalizedEmail = normalizeEmail(data?.email);
  if (!normalizedEmail) {
    throw new functions.https.HttpsError('invalid-argument', 'email is required');
  }

  const uid = context.auth.uid;
  const [authUser, userSnap] = await Promise.all([
    admin.auth().getUser(uid),
    admin.firestore().collection('users').doc(uid).get(),
  ]);

  if (!userSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'User profile not found');
  }

  if (!authUser.phoneNumber) {
    throw new functions.https.HttpsError('failed-precondition', 'Phone auth is required');
  }

  const authEmail = normalizeEmail(authUser.email);
  if (!authEmail || authEmail !== normalizedEmail) {
    throw new functions.https.HttpsError('failed-precondition', 'Authenticated email does not match');
  }

  if (authUser.emailVerified !== true) {
    throw new functions.https.HttpsError('failed-precondition', 'Email must be verified before linking');
  }

  const userData = userSnap.data() || {};
  if (userData.isActive === false || String(userData.accountStatus || '').toLowerCase() === 'suspended') {
    throw new functions.https.HttpsError('permission-denied', 'Account is not eligible');
  }

  await userSnap.ref.set({
    email: normalizedEmail,
    emailAuthEnabled: true,
    emailAuthVerified: true,
    emailLinkedAt: admin.firestore.FieldValue.serverTimestamp(),
    emailAuthUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return {
    success: true,
    email: normalizedEmail,
    enabled: true,
    verified: true,
  };
});

exports.authDisableEmailMagicLink = functions.region(REGION).https.onCall(async (_data, context) => {
  checkAppToken(context);

  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const userRef = admin.firestore().collection('users').doc(context.auth.uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'User profile not found');
  }

  await userRef.set({
    emailAuthEnabled: false,
    emailAuthUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return { success: true };
});

/**
 * Switch the authenticated user's role.
 * Creates a role-specific profile subcollection if it doesn't exist yet.
 */
exports.switchUserRole = functions.region(REGION).https.onCall(async (data, context) => {
  checkAppToken(context);

  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { role } = data || {};
  if (!role || !ALLOWED_ROLES.includes(role)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `Role must be one of: ${ALLOWED_ROLES.join(', ')}`
    );
  }

  const uid = context.auth.uid;
  const db = admin.firestore();

  // Verify user exists
  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'User profile not found');
  }

  const userData = userDoc.data();

  // Prevent admins from accidentally losing admin role
  if (userData.role === 'admin' || userData.isAdmin === true) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Admin users cannot switch roles via this endpoint'
    );
  }

  // Update role
  await db.collection('users').doc(uid).update({
    role,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Create role-specific profile if it doesn't exist
  if (role === 'shipper') {
    const profileRef = db.collection('users').doc(uid).collection('shipperProfile').doc('profile');
    const profileSnap = await profileRef.get();
    if (!profileSnap.exists) {
      await profileRef.set({
        businessName: userData.name || null,
        businessAddress: null,
        businessType: null,
        totalTransactions: 0,
        membershipTier: 'NEW',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  } else if (role === 'trucker') {
    const profileRef = db.collection('users').doc(uid).collection('truckerProfile').doc('profile');
    const profileSnap = await profileRef.get();
    if (!profileSnap.exists) {
      await profileRef.set({
        businessName: userData.name || null,
        licenseNumber: null,
        licenseExpiry: null,
        rating: 0,
        totalTrips: 0,
        badge: 'STARTER',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }

  return { success: true, role };
});
