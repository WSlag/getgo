const admin = require('firebase-admin');

const BADGE_RANK = {
  STARTER: 0,
  ACTIVE: 1,
  VERIFIED: 2,
  PRO: 3,
  ELITE: 4,
};

function normalizeUserId(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function resolveRatedUserId(rating = {}) {
  return normalizeUserId(rating.rateeId) || normalizeUserId(rating.ratedUserId);
}

function isValidRatingScore(score) {
  const parsed = Number(score);
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 5;
}

function mergeRatingDocs(...snapshots) {
  const merged = new Map();
  snapshots.forEach((snapshot) => {
    if (!snapshot?.docs?.length) return;
    snapshot.docs.forEach((docSnap) => {
      if (!merged.has(docSnap.id)) {
        merged.set(docSnap.id, docSnap);
      }
    });
  });
  return Array.from(merged.values());
}

async function getMergedRatingDocsForRatee(db, rateeId) {
  const normalizedRateeId = normalizeUserId(rateeId);
  if (!normalizedRateeId) return [];

  const [canonicalSnap, legacySnap] = await Promise.all([
    db.collection('ratings').where('rateeId', '==', normalizedRateeId).get(),
    db.collection('ratings').where('ratedUserId', '==', normalizedRateeId).get(),
  ]);

  return mergeRatingDocs(canonicalSnap, legacySnap);
}

function getDocData(value) {
  if (!value) return {};
  if (typeof value.data === 'function') return value.data() || {};
  return value;
}

function computeRatingAggregateFromDocs(ratingDocs = []) {
  let totalScore = 0;
  let totalRatings = 0;

  ratingDocs.forEach((docLike) => {
    const rating = getDocData(docLike);
    const score = Number(rating.score);
    if (!isValidRatingScore(score)) return;
    totalScore += score;
    totalRatings += 1;
  });

  const averageRating = totalRatings > 0 ? (totalScore / totalRatings) : 0;
  return {
    averageRating,
    totalRatings,
    totalScore,
  };
}

function getBadgeForTrucker(averageRating, totalTrips) {
  const rating = Number(averageRating || 0);
  const trips = Number(totalTrips || 0);

  if (rating >= 4.8 && trips >= 100) return 'ELITE';
  if (rating >= 4.5 && trips >= 50) return 'PRO';
  if (rating >= 4.0 && trips >= 20) return 'VERIFIED';
  if (trips >= 5) return 'ACTIVE';
  return 'STARTER';
}

function isBadgeUpgrade(oldBadge, newBadge) {
  const previous = BADGE_RANK[String(oldBadge || 'STARTER').toUpperCase()] || 0;
  const next = BADGE_RANK[String(newBadge || 'STARTER').toUpperCase()] || 0;
  return next > previous;
}

async function recomputeUserRatingAggregate({
  db,
  rateeId,
  notifyBadgeUpgrade = false,
}) {
  const normalizedRateeId = normalizeUserId(rateeId);
  if (!normalizedRateeId) {
    return {
      rateeId: null,
      skippedReason: 'missing_ratee_id',
      userChanged: false,
      truckerChanged: false,
    };
  }

  const userRef = db.collection('users').doc(normalizedRateeId);
  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    return {
      rateeId: normalizedRateeId,
      skippedReason: 'missing_user',
      userChanged: false,
      truckerChanged: false,
    };
  }

  const userData = userDoc.data() || {};
  const ratingDocs = await getMergedRatingDocsForRatee(db, normalizedRateeId);
  const aggregate = computeRatingAggregateFromDocs(ratingDocs);
  const currentAverage = Number(userData.averageRating || 0);
  const currentTotal = Number(userData.totalRatings || 0);

  const userChanged = (
    Math.abs(currentAverage - aggregate.averageRating) > 0.0001
    || currentTotal !== aggregate.totalRatings
  );

  if (userChanged) {
    await userRef.set({
      averageRating: aggregate.averageRating,
      totalRatings: aggregate.totalRatings,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  let truckerChanged = false;
  let previousBadge = null;
  let nextBadge = null;

  if (userData.role === 'trucker') {
    const truckerProfileRef = userRef.collection('truckerProfile').doc('profile');
    const truckerProfileDoc = await truckerProfileRef.get();

    if (truckerProfileDoc.exists) {
      const truckerData = truckerProfileDoc.data() || {};
      const totalTrips = Number(truckerData.totalTrips || 0);
      previousBadge = String(truckerData.badge || 'STARTER').toUpperCase();
      nextBadge = getBadgeForTrucker(aggregate.averageRating, totalTrips);

      const currentTruckerRating = Number(truckerData.rating || 0);
      truckerChanged = (
        Math.abs(currentTruckerRating - aggregate.averageRating) > 0.0001
        || previousBadge !== nextBadge
      );

      if (truckerChanged) {
        await truckerProfileRef.set({
          badge: nextBadge,
          rating: aggregate.averageRating,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      if (notifyBadgeUpgrade && isBadgeUpgrade(previousBadge, nextBadge)) {
        await db.collection(`users/${normalizedRateeId}/notifications`).doc().set({
          type: 'BADGE_UPGRADE',
          title: 'Badge Upgraded!',
          message: `Congratulations! You've earned the ${nextBadge} badge!`,
          data: {
            badge: nextBadge,
            oldBadge: previousBadge,
            rating: aggregate.averageRating,
            totalTrips,
          },
          isRead: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }
  }

  return {
    rateeId: normalizedRateeId,
    averageRating: aggregate.averageRating,
    totalRatings: aggregate.totalRatings,
    userChanged,
    truckerChanged,
    previousBadge,
    nextBadge,
  };
}

module.exports = {
  normalizeUserId,
  resolveRatedUserId,
  isValidRatingScore,
  mergeRatingDocs,
  getMergedRatingDocsForRatee,
  computeRatingAggregateFromDocs,
  getBadgeForTrucker,
  isBadgeUpgrade,
  recomputeUserRatingAggregate,
};
