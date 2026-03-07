const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

/**
 * Seed server-managed trucker compliance state for newly created trucker profiles.
 * Existing trucker profiles created before rollout are intentionally not backfilled.
 */
exports.onTruckerProfileCreated = onDocumentCreated(
  {
    region: 'asia-southeast1',
    document: 'users/{userId}/truckerProfile/{docId}',
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return null;

    const { userId, docId } = event.params;
    if (docId !== 'profile') return null;

    const db = admin.firestore();
    const complianceRef = db.collection('users').doc(userId).collection('truckerCompliance').doc('profile');
    const existing = await complianceRef.get();
    if (existing.exists) return null;

    await complianceRef.set({
      docsRequiredOnSigning: true,
      cancellationBlockUntil: null,
      cancellationBlockedAt: null,
      cancellationBlockReason: null,
      cancellationResetAt: null,
      cancellationResetBy: null,
      cancellationResetReason: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return null;
  }
);
