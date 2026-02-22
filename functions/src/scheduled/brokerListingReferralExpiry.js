const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const {
  LISTING_REFERRAL_COLLECTION,
  LISTING_REFERRAL_STATUSES,
  ACTIVE_LISTING_REFERRAL_STATUSES,
} = require('../services/brokerListingReferralService');

exports.expireBrokerListingReferrals = onSchedule(
  {
    region: 'asia-southeast1',
    schedule: 'every 15 minutes',
    timeZone: 'Asia/Manila',
  },
  async () => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    const snap = await db.collection(LISTING_REFERRAL_COLLECTION)
      .where('status', 'in', ACTIVE_LISTING_REFERRAL_STATUSES)
      .where('expiresAt', '<=', now)
      .limit(500)
      .get();

    if (snap.empty) {
      return null;
    }

    const batch = db.batch();
    snap.docs.forEach((doc) => {
      batch.update(doc.ref, {
        status: LISTING_REFERRAL_STATUSES.EXPIRED,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      batch.set(db.collection('brokerListingReferralAudit').doc(), {
        eventType: 'expire',
        actorId: 'system',
        referralDocId: doc.id,
        metadata: {},
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
    return null;
  }
);
