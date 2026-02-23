/**
 * Rating Triggers
 * Updates user average ratings and badge tiers when ratings are submitted
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

function mergeRatingDocs(...snapshots) {
  const merged = new Map();
  snapshots.forEach((snapshot) => {
    snapshot.docs.forEach((doc) => {
      if (!merged.has(doc.id)) {
        merged.set(doc.id, doc);
      }
    });
  });
  return Array.from(merged.values());
}

function getRatedUserId(rating = {}) {
  return rating.rateeId || rating.ratedUserId || null;
}

async function getRatingsForRatee(db, rateeId) {
  const [canonicalSnap, legacySnap] = await Promise.all([
    db.collection('ratings').where('rateeId', '==', rateeId).get(),
    db.collection('ratings').where('ratedUserId', '==', rateeId).get(),
  ]);

  return mergeRatingDocs(canonicalSnap, legacySnap);
}

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
    const rating = snap.data();
    const ratedUserId = getRatedUserId(rating);

    if (!ratedUserId) return null;

    const db = admin.firestore();

    // Backfill canonical target field when older rows still use legacy key.
    if (!rating.rateeId && rating.ratedUserId) {
      await snap.ref.set({ rateeId: rating.ratedUserId }, { merge: true });
    }

    // Get all ratings for this user (canonical + legacy compatibility reads)
    const ratingDocs = await getRatingsForRatee(db, ratedUserId);

    let totalScore = 0;
    ratingDocs.forEach((doc) => {
      totalScore += doc.data().score;
    });

    const totalRatings = ratingDocs.length;
    const avgRating = totalRatings > 0 ? (totalScore / totalRatings) : 0;

    // Update user profile
    await db.collection('users').doc(ratedUserId).update({
      averageRating: avgRating,
      totalRatings,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update trucker profile if applicable
    const userDoc = await db.collection('users').doc(ratedUserId).get();
    const userData = userDoc.data();

    if (userData && userData.role === 'trucker') {
      const truckerProfileRef = db.collection('users')
        .doc(ratedUserId)
        .collection('truckerProfile')
        .doc('profile');
      const truckerProfileDoc = await truckerProfileRef.get();

      if (truckerProfileDoc.exists) {
        const truckerData = truckerProfileDoc.data();
        const totalTrips = truckerData.totalTrips || 0;
        const oldBadge = truckerData.badge;

        // Calculate badge based on rating and trips
        let badge = 'STARTER';
        if (avgRating >= 4.8 && totalTrips >= 100) badge = 'ELITE';
        else if (avgRating >= 4.5 && totalTrips >= 50) badge = 'PRO';
        else if (avgRating >= 4.0 && totalTrips >= 20) badge = 'VERIFIED';
        else if (totalTrips >= 5) badge = 'ACTIVE';

        await truckerProfileRef.update({
          badge,
          rating: avgRating,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Notify of badge upgrade if changed
        if (badge !== oldBadge) {
          await db.collection(`users/${ratedUserId}/notifications`).doc().set({
            type: 'BADGE_UPGRADE',
            title: 'Badge Upgraded!',
            message: `Congratulations! You've earned the ${badge} badge!`,
            data: {
              badge,
              oldBadge,
              rating: avgRating,
              totalTrips,
            },
            isRead: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }
    }

    // Notify user of new rating
    const raterDoc = await db.collection('users').doc(rating.raterId).get();
    const raterName = raterDoc.exists ? raterDoc.data().name : 'Someone';

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
