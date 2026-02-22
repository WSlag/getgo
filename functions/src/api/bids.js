/**
 * Bid management Cloud Functions
 * Server-authoritative bid acceptance to avoid client-side permission failures.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveOutstandingCap(userData = {}, nowMs) {
  const createdAtMs = typeof userData.createdAt?.toMillis === 'function'
    ? userData.createdAt.toMillis()
    : nowMs;
  const isNewAccount = nowMs < createdAtMs + THIRTY_DAYS_MS;
  const isVerified = userData.isVerified === true;
  if (!isVerified) return 7000;
  return isNewAccount ? 10000 : 20000;
}

function resolveListingRef(db, bidData = {}) {
  if (bidData.cargoListingId) {
    return {
      listingType: 'cargo',
      listingId: bidData.cargoListingId,
      ref: db.collection('cargoListings').doc(bidData.cargoListingId),
    };
  }
  if (bidData.truckListingId) {
    return {
      listingType: 'truck',
      listingId: bidData.truckListingId,
      ref: db.collection('truckListings').doc(bidData.truckListingId),
    };
  }
  return null;
}

/**
 * Accept bid
 * Validates ownership + fee-cap constraints and updates listing/bids atomically.
 */
exports.acceptBid = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const bidId = String(data?.bidId || '').trim();
  if (!bidId) {
    throw new functions.https.HttpsError('invalid-argument', 'Bid ID is required');
  }

  const userId = context.auth.uid;
  const db = admin.firestore();

  const result = await db.runTransaction(async (tx) => {
    const bidRef = db.collection('bids').doc(bidId);
    const bidDoc = await tx.get(bidRef);
    if (!bidDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Bid not found');
    }

    const bidData = bidDoc.data() || {};
    const listingMeta = resolveListingRef(db, bidData);
    if (!listingMeta) {
      throw new functions.https.HttpsError('failed-precondition', 'Bid is missing listing reference');
    }

    const listingDoc = await tx.get(listingMeta.ref);
    if (!listingDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Listing not found');
    }

    const listingData = listingDoc.data() || {};
    if (listingData.userId !== userId || (bidData.listingOwnerId && bidData.listingOwnerId !== userId)) {
      throw new functions.https.HttpsError('permission-denied', 'Only the listing owner can accept this bid');
    }

    const currentStatus = String(bidData.status || '');
    if (currentStatus === 'accepted') {
      return { alreadyAccepted: true, listingType: listingMeta.listingType, listingId: listingMeta.listingId };
    }
    if (currentStatus !== 'pending') {
      throw new functions.https.HttpsError('failed-precondition', 'Only pending bids can be accepted');
    }

    // Enforce the same fee-cap and account-state checks used by Firestore rules.
    const feePayerId = bidData.cargoListingId ? bidData.bidderId : bidData.listingOwnerId;
    if (!feePayerId) {
      throw new functions.https.HttpsError('failed-precondition', 'Bid is missing fee payer');
    }

    const feePayerRef = db.collection('users').doc(feePayerId);
    const feePayerDoc = await tx.get(feePayerRef);
    if (!feePayerDoc.exists) {
      throw new functions.https.HttpsError('failed-precondition', 'Fee payer profile not found');
    }
    const feePayerData = feePayerDoc.data() || {};
    const isFeePayerActive = feePayerData.isActive !== false && feePayerData.accountStatus !== 'suspended';
    if (!isFeePayerActive) {
      throw new functions.https.HttpsError('failed-precondition', 'Fee payer account is restricted');
    }

    const nowMs = Date.now();
    const outstandingCap = resolveOutstandingCap(feePayerData, nowMs);
    const outstanding = toFiniteNumber(feePayerData.outstandingPlatformFees, 0);
    const bidPrice = toFiniteNumber(bidData.price, 0);
    const projectedOutstanding = outstanding + (bidPrice * 0.05);
    if (projectedOutstanding > outstandingCap) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Projected outstanding platform fees exceed allowed cap',
        {
          reason: 'platform-fee-cap-exceeded',
          outstanding,
          projectedOutstanding,
          outstandingCap,
          bidPrice,
          feePayerId,
        }
      );
    }

    const pendingBidsQuery = listingMeta.listingType === 'cargo'
      ? db.collection('bids')
        .where('cargoListingId', '==', listingMeta.listingId)
        .where('status', '==', 'pending')
      : db.collection('bids')
        .where('truckListingId', '==', listingMeta.listingId)
        .where('status', '==', 'pending');

    const pendingBidsSnap = await tx.get(pendingBidsQuery);

    const updatePayload = {
      status: 'accepted',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    tx.update(bidRef, updatePayload);
    tx.update(listingMeta.ref, {
      status: 'negotiating',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    pendingBidsSnap.forEach((snap) => {
      if (snap.id === bidId) return;
      tx.update(snap.ref, {
        status: 'rejected',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return { alreadyAccepted: false, listingType: listingMeta.listingType, listingId: listingMeta.listingId };
  });

  return {
    success: true,
    bidId,
    ...result,
  };
});
