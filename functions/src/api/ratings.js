/**
 * Ratings Management Cloud Functions
 * Handles rating submission and queries
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

/**
 * Submit Rating
 */
exports.submitRating = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { contractId, score, tags = [], comment } = data;
  const userId = context.auth.uid;

  if (!contractId || !score) {
    throw new functions.https.HttpsError('invalid-argument', 'Contract ID and score are required');
  }

  if (score < 1 || score > 5) {
    throw new functions.https.HttpsError('invalid-argument', 'Score must be between 1 and 5');
  }

  const db = admin.firestore();

  // Get contract
  const contractDoc = await db.collection('contracts').doc(contractId).get();
  if (!contractDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Contract not found');
  }

  const contract = contractDoc.data();

  if (contract.status !== 'completed') {
    throw new functions.https.HttpsError('failed-precondition', 'Can only rate completed contracts');
  }

  // Check user is a participant
  if (!contract.participantIds || !contract.participantIds.includes(userId)) {
    throw new functions.https.HttpsError('permission-denied', 'Not authorized to rate this contract');
  }

  // Determine who is being rated
  const ratedUserId = contract.listingOwnerId === userId ? contract.bidderId : contract.listingOwnerId;

  // Check if user already rated this contract
  const existingRatingSnap = await db.collection('ratings')
    .where('contractId', '==', contractId)
    .where('raterId', '==', userId)
    .limit(1)
    .get();

  if (!existingRatingSnap.empty) {
    throw new functions.https.HttpsError('already-exists', 'You have already rated this contract');
  }

  // Get user names
  const raterDoc = await db.collection('users').doc(userId).get();
  const raterName = raterDoc.exists ? raterDoc.data().name : 'Unknown';

  const ratedUserDoc = await db.collection('users').doc(ratedUserId).get();
  const ratedUserName = ratedUserDoc.exists ? ratedUserDoc.data().name : 'Unknown';

  // Create rating
  const ratingRef = db.collection('ratings').doc();
  await ratingRef.set({
    contractId,
    raterId: userId,
    raterName,
    rateeId: ratedUserId,
    rateeName: ratedUserName,
    score,
    tags: tags || [],
    comment: comment || '',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Update user's average rating (will be handled by trigger in Phase 4)
  // For now, calculate and update immediately
  const ratingsSnap = await db.collection('ratings')
    .where('rateeId', '==', ratedUserId)
    .get();

  let totalScore = 0;
  ratingsSnap.docs.forEach(doc => {
    totalScore += doc.data().score;
  });

  const avgRating = totalScore / ratingsSnap.size;
  const totalRatings = ratingsSnap.size;

  // Update user profile
  await db.collection('users').doc(ratedUserId).update({
    averageRating: avgRating,
    totalRatings,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Update trucker/shipper profile if applicable
  const ratedUser = ratedUserDoc.data();
  if (ratedUser && ratedUser.role === 'trucker') {
    const truckerProfileDoc = await db.collection('truckerProfiles').doc(ratedUserId).get();
    if (truckerProfileDoc.exists) {
      const truckerData = truckerProfileDoc.data();
      const totalTrips = truckerData.totalTrips || 0;

      // Calculate badge
      let badge = 'STARTER';
      if (avgRating >= 4.8 && totalTrips >= 100) badge = 'ELITE';
      else if (avgRating >= 4.5 && totalTrips >= 50) badge = 'PRO';
      else if (avgRating >= 4.0 && totalTrips >= 20) badge = 'VERIFIED';
      else if (totalTrips >= 5) badge = 'ACTIVE';

      await db.collection('truckerProfiles').doc(ratedUserId).update({
        badge,
        rating: avgRating,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Notify of badge upgrade if changed
      if (badge !== truckerData.badge) {
        await db.collection(`users/${ratedUserId}/notifications`).doc().set({
          type: 'BADGE_UPGRADE',
          title: 'Badge Upgraded!',
          message: `Congratulations! You've earned the ${badge} badge!`,
          isRead: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }
  }

  return {
    message: 'Rating submitted successfully',
    rating: {
      id: ratingRef.id,
      contractId,
      score,
      tags,
      comment,
    },
  };
});

/**
 * Get Pending Ratings
 */
exports.getPendingRatings = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const userId = context.auth.uid;
  const db = admin.firestore();

  // Get completed contracts where user is a participant
  const contractsSnap = await db.collection('contracts')
    .where('participantIds', 'array-contains', userId)
    .where('status', '==', 'completed')
    .get();

  const pendingRatings = [];

  for (const contractDoc of contractsSnap.docs) {
    const contract = { id: contractDoc.id, ...contractDoc.data() };

    // Check if user has already rated this contract
    const ratingSnap = await db.collection('ratings')
      .where('contractId', '==', contractDoc.id)
      .where('raterId', '==', userId)
      .limit(1)
      .get();

    if (ratingSnap.empty) {
      // User hasn't rated this contract yet
      const otherUserId = contract.listingOwnerId === userId ? contract.bidderId : contract.listingOwnerId;
      const otherUserDoc = await db.collection('users').doc(otherUserId).get();
      const otherUserName = otherUserDoc.exists ? otherUserDoc.data().name : 'Unknown';

      pendingRatings.push({
        contractId: contractDoc.id,
        contractNumber: contract.contractNumber,
        otherUserId,
        otherUserName,
        route: `${contract.pickupAddress} → ${contract.deliveryAddress}`,
        completedAt: contract.updatedAt,
      });
    }
  }

  return { pendingRatings };
});
