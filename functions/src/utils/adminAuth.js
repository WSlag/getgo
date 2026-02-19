/**
 * Shared admin authentication utility.
 * Dual-checks custom claims AND Firestore to catch revoked admins.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

function checkAppToken(context) {
  if (process.env.APP_CHECK_ENFORCED !== 'true') return;
  if (context.app === undefined) {
    throw new functions.https.HttpsError('failed-precondition', 'App Check verification required');
  }
}

/**
 * Verify that the calling user is an authenticated admin.
 * Checks Firebase Auth custom claims first, then live Firestore document.
 * @param {Object} context - Cloud Function call context
 * @throws {functions.https.HttpsError} if not admin
 */
async function verifyAdmin(context) {
  checkAppToken(context);

  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  // Check custom claims
  if (!context.auth.token.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required');
  }

  // Authoritative Firestore check catches revoked admins before token refresh.
  const db = admin.firestore();
  const userDoc = await db.collection('users').doc(context.auth.uid).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'User record not found');
  }

  const userData = userDoc.data() || {};
  const isAdminInFirestore = userData.isAdmin === true || userData.role === 'admin';
  if (!isAdminInFirestore) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access revoked');
  }

  return true;
}

module.exports = { verifyAdmin, checkAppToken };
