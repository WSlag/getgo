/**
 * Auth Cloud Functions
 * Handles role switching and auth-related operations that require server authority.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

const ALLOWED_ROLES = ['shipper', 'trucker', 'broker'];

function checkAppToken(context) {
  if (process.env.APP_CHECK_ENFORCED !== 'true') return;
  if (context.app === undefined) {
    throw new functions.https.HttpsError('failed-precondition', 'App Check verification required');
  }
}

/**
 * Switch the authenticated user's role.
 * Creates a role-specific profile subcollection if it doesn't exist yet.
 */
exports.switchUserRole = functions.region('asia-southeast1').https.onCall(async (data, context) => {
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
