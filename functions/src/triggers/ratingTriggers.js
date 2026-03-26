/**
 * Rating Triggers
 * Updates user average ratings and badge tiers when ratings are submitted
 */

const { onDocumentCreated, onDocumentDeleted } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const {
  resolveRatedUserId,
  recomputeUserRatingAggregate,
} = require('../services/ratingAggregation');

/**
 * Update user's average rating and badge when a new rating is submitted
 */
exports.onRatingCreated = onDocumentCreated(
  {
    region: 'asia-southeast1',
    document: 'ratings/{ratingId}',
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return null;
    const rating = snap.data() || {};
    const ratedUserId = resolveRatedUserId(rating);

    if (!ratedUserId) return null;

    const db = admin.firestore();

    // Backfill canonical target field when older rows still use legacy key.
    if (!rating.rateeId && rating.ratedUserId) {
      await snap.ref.set({ rateeId: rating.ratedUserId }, { merge: true });
    }

    await recomputeUserRatingAggregate({
      db,
      rateeId: ratedUserId,
      notifyBadgeUpgrade: true,
    });

    // Notify user of new rating
    let raterName = 'Someone';
    if (rating.raterId) {
      const raterDoc = await db.collection('users').doc(rating.raterId).get();
      if (raterDoc.exists) {
        raterName = raterDoc.data()?.name || 'Someone';
      }
    }

    await db.collection(`users/${ratedUserId}/notifications`).doc().set({
      type: 'NEW_RATING',
      title: 'New Rating Received',
      message: `${raterName} rated you ${rating.score} stars`,
      data: {
        ratingId: event.params.ratingId,
        raterId: rating.raterId,
        score: rating.score,
        comment: rating.comment || '',
      },
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return null;
  }
);

/**
 * Recompute target user rating aggregates when a rating is deleted.
 */
exports.onRatingDeleted = onDocumentDeleted(
  {
    region: 'asia-southeast1',
    document: 'ratings/{ratingId}',
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return null;
    const rating = snap.data() || {};
    const ratedUserId = resolveRatedUserId(rating);
    if (!ratedUserId) return null;

    await recomputeUserRatingAggregate({
      db: admin.firestore(),
      rateeId: ratedUserId,
      notifyBadgeUpgrade: false,
    });

    return null;
  }
);
