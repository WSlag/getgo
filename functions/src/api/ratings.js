/**
 * Ratings Management Cloud Functions
 * Handles rating submission and queries
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');

function toNormalizedId(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function buildDeterministicRatingId(contractId, raterId) {
  return `rating_${contractId}_${raterId}`;
}

function serverTimestamp() {
  if (admin?.firestore?.FieldValue?.serverTimestamp) {
    return admin.firestore.FieldValue.serverTimestamp();
  }
  return FieldValue.serverTimestamp();
}

/**
 * Submit Rating
 */
exports.submitRating = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { contractId, score, tags = [], comment } = data || {};
  const userId = context.auth.uid;
  const normalizedContractId = toNormalizedId(contractId);
  const normalizedScore = Number(score);

  functions.logger.info('submit_rating_attempt', {
    contractId: normalizedContractId || null,
    raterId: userId,
  });

  if (!normalizedContractId || !Number.isFinite(normalizedScore)) {
    functions.logger.warn('submit_rating_rejected_invalid_argument', {
      contractId: normalizedContractId || null,
      raterId: userId,
    });
    throw new functions.https.HttpsError('invalid-argument', 'Contract ID and score are required');
  }

  if (normalizedScore < 1 || normalizedScore > 5) {
    functions.logger.warn('submit_rating_rejected_invalid_score', {
      contractId: normalizedContractId,
      raterId: userId,
      score: normalizedScore,
    });
    throw new functions.https.HttpsError('invalid-argument', 'Score must be between 1 and 5');
  }

  const db = admin.firestore();

  // Get contract
  const contractDoc = await db.collection('contracts').doc(normalizedContractId).get();
  if (!contractDoc.exists) {
    functions.logger.warn('submit_rating_rejected_contract_not_found', {
      contractId: normalizedContractId,
      raterId: userId,
    });
    throw new functions.https.HttpsError('not-found', 'Contract not found');
  }

  const contract = contractDoc.data();

  if (contract.status !== 'completed') {
    functions.logger.warn('submit_rating_rejected_contract_not_completed', {
      contractId: normalizedContractId,
      raterId: userId,
      contractStatus: contract.status || null,
    });
    throw new functions.https.HttpsError('failed-precondition', 'Can only rate completed contracts');
  }

  // Check user is a participant
  if (!contract.participantIds || !contract.participantIds.includes(userId)) {
    functions.logger.warn('submit_rating_rejected_not_participant', {
      contractId: normalizedContractId,
      raterId: userId,
    });
    throw new functions.https.HttpsError('permission-denied', 'Not authorized to rate this contract');
  }

  // Determine who is being rated
  const ratedUserId = contract.listingOwnerId === userId ? contract.bidderId : contract.listingOwnerId;
  if (!ratedUserId) {
    functions.logger.error('submit_rating_failed_missing_counterparty', {
      contractId: normalizedContractId,
      raterId: userId,
    });
    throw new functions.https.HttpsError('failed-precondition', 'Unable to resolve rating counterparty');
  }

  // Compatibility check for legacy random-doc-id rows.
  const existingRatingSnap = await db.collection('ratings')
    .where('contractId', '==', normalizedContractId)
    .where('raterId', '==', userId)
    .limit(1)
    .get();

  if (!existingRatingSnap.empty) {
    functions.logger.info('submit_rating_duplicate_rejected', {
      contractId: normalizedContractId,
      raterId: userId,
      reason: 'legacy_or_existing_rating_found',
    });
    throw new functions.https.HttpsError('already-exists', 'You have already rated this contract');
  }

  // Get user names
  const raterDoc = await db.collection('users').doc(userId).get();
  const raterName = raterDoc.exists ? raterDoc.data().name : 'Unknown';

  const ratedUserDoc = await db.collection('users').doc(ratedUserId).get();
  const ratedUserName = ratedUserDoc.exists ? ratedUserDoc.data().name : 'Unknown';

  // Race-safe idempotency key: one rating per contract+rater.
  const ratingId = buildDeterministicRatingId(normalizedContractId, userId);
  const ratingRef = db.collection('ratings').doc(ratingId);

  try {
    await db.runTransaction(async (tx) => {
      const ratingDoc = await tx.get(ratingRef);
      if (ratingDoc.exists) {
        throw new functions.https.HttpsError('already-exists', 'You have already rated this contract');
      }

      tx.set(ratingRef, {
        contractId: normalizedContractId,
        raterId: userId,
        raterName,
        rateeId: ratedUserId,
        ratedUserId, // legacy compatibility field during migration window
        rateeName: ratedUserName,
        score: normalizedScore,
        tags: Array.isArray(tags) ? tags : [],
        comment: comment || '',
        createdAt: serverTimestamp(),
      });
    });
  } catch (error) {
    if (error instanceof functions.https.HttpsError) {
      functions.logger.info('submit_rating_duplicate_rejected', {
        contractId: normalizedContractId,
        raterId: userId,
        reason: 'deterministic_id_conflict',
      });
      throw error;
    }

    functions.logger.error('submit_rating_failed_unexpected', {
      contractId: normalizedContractId,
      raterId: userId,
      error: error?.message || String(error),
    });
    throw error;
  }

  functions.logger.info('submit_rating_success', {
    contractId: normalizedContractId,
    raterId: userId,
    rateeId: ratedUserId,
    ratingId,
  });

  return {
    message: 'Rating submitted successfully',
    rating: {
      id: ratingId,
      contractId: normalizedContractId,
      score: normalizedScore,
      tags: Array.isArray(tags) ? tags : [],
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
        route: `${contract.pickupAddress} -> ${contract.deliveryAddress}`,
        completedAt: contract.updatedAt,
      });
    }
  }

  return { pendingRatings };
});
