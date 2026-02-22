/**
 * Bid Triggers
 * Sends notifications when bids are created, accepted, or rejected
 */

const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const {
  ACTIVE_LISTING_REFERRAL_STATUSES,
  LISTING_REFERRAL_COLLECTION,
  buildListingReferralId,
  getBrokerReferralForUser,
  mapBidActivityType,
  mapBidStatusToActivityStatus,
  maskDisplayName,
  upsertBrokerMarketplaceActivity,
  toDate,
} = require('../services/brokerListingReferralService');

async function markListingReferralAsActed(db, bidId, bid, brokerId) {
  const listingType = bid.cargoListingId ? 'cargo' : (bid.truckListingId ? 'truck' : null);
  const listingId = bid.cargoListingId || bid.truckListingId || null;
  if (!listingType || !listingId || !brokerId || !bid.bidderId) return;

  const referralId = buildListingReferralId({
    brokerId,
    listingType,
    listingId,
    referredUserId: bid.bidderId,
  });

  const referralRef = db.collection(LISTING_REFERRAL_COLLECTION).doc(referralId);
  await db.runTransaction(async (tx) => {
    const referralDoc = await tx.get(referralRef);
    if (!referralDoc.exists) return;
    const referral = referralDoc.data() || {};
    if (!ACTIVE_LISTING_REFERRAL_STATUSES.includes(referral.status)) return;

    const expiresAtDate = toDate(referral.expiresAt);
    if (expiresAtDate && expiresAtDate.getTime() < Date.now()) return;

    tx.update(referralRef, {
      status: 'acted',
      actedAt: admin.firestore.FieldValue.serverTimestamp(),
      actedBidId: bidId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    tx.set(db.collection('brokerListingReferralAudit').doc(), {
      eventType: 'act',
      actorId: bid.bidderId,
      referralDocId: referralId,
      metadata: { bidId, listingId, listingType },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
}

/**
 * Notify listing owner when a new bid is placed
 */
exports.onBidCreated = onDocumentCreated(
  {
    region: 'asia-southeast1',
    document: 'bids/{bidId}',
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return null;
    const bid = snap.data();
    const bidId = event.params.bidId;
    const db = admin.firestore();

    // Get bidder name
    const bidderDoc = await db.collection('users').doc(bid.bidderId).get();
    const bidderName = bidderDoc.exists ? bidderDoc.data().name : 'Someone';

    // Server-authoritative bid count increment with idempotency guard.
    const listingCollection = bid.cargoListingId ? 'cargoListings' : (bid.truckListingId ? 'truckListings' : null);
    const listingId = bid.cargoListingId || bid.truckListingId || null;
    if (listingCollection && listingId) {
      const listingRef = db.collection(listingCollection).doc(listingId);
      const ledgerRef = db.collection('bidCountEvents').doc(bidId);

      await db.runTransaction(async (tx) => {
        const [ledgerDoc, listingDoc] = await Promise.all([tx.get(ledgerRef), tx.get(listingRef)]);
        if (ledgerDoc.exists || !listingDoc.exists) {
          return;
        }

        tx.update(listingRef, {
          bidCount: admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        tx.set(ledgerRef, {
          bidId,
          listingId,
          listingCollection,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
    }

    // Notify listing owner
    if (bid.listingOwnerId) {
      await db
        .collection(`users/${bid.listingOwnerId}/notifications`)
        .doc()
        .set({
          type: 'NEW_BID',
          title: 'New Bid Received',
          message: `${bidderName} placed a bid of ₱${bid.price.toLocaleString()} on your listing`,
          data: {
            bidId,
            listingId: bid.listingId,
            bidderId: bid.bidderId,
            price: bid.price,
          },
          isRead: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }

    // Broker referred-activity + acted referral marker.
    try {
      const [referral, ownerDoc] = await Promise.all([
        getBrokerReferralForUser(bid.bidderId, db),
        bid.listingOwnerId ? db.collection('users').doc(bid.listingOwnerId).get() : Promise.resolve(null),
      ]);
      if (referral?.brokerId) {
        const listingType = bid.cargoListingId ? 'cargo' : 'truck';
        const activityType = mapBidActivityType(listingType);
        await upsertBrokerMarketplaceActivity(`bid:${bidId}`, {
          brokerId: referral.brokerId,
          referredUserId: bid.bidderId,
          activityType,
          listingType,
          bidId,
          contractId: null,
          amount: Number(bid.price || 0) || null,
          origin: bid.origin || null,
          destination: bid.destination || null,
          status: mapBidStatusToActivityStatus(bid.status),
          activityAt: bid.createdAt || admin.firestore.FieldValue.serverTimestamp(),
          referredUserMasked: maskDisplayName(bidderDoc.exists ? bidderDoc.data().name : null, bidderDoc.exists ? bidderDoc.data().phone : null),
          counterpartyMasked: maskDisplayName(ownerDoc?.exists ? ownerDoc.data().name : bid.listingOwnerName, ownerDoc?.exists ? ownerDoc.data().phone : null),
          source: 'trigger',
        }, db);

        await markListingReferralAsActed(db, bidId, bid, referral.brokerId);
      }
    } catch (error) {
      console.error('Failed to record broker bid activity:', error);
    }

    return null;
  }
);

/**
 * Notify both parties when a bid is accepted or rejected
 */
exports.onBidStatusChanged = onDocumentUpdated(
  {
    region: 'asia-southeast1',
    document: 'bids/{bidId}',
  },
  async (event) => {
    const change = event.data;
    if (!change) return null;
    const before = change.before.data();
    const after = change.after.data();
    const bidId = event.params.bidId;

    // Only trigger if status changed
    if (before.status === after.status) {
      return null;
    }

    const db = admin.firestore();

    // Get user names
    const ownerDoc = await db.collection('users').doc(after.listingOwnerId).get();
    const bidderDoc = await db.collection('users').doc(after.bidderId).get();
    const ownerName = ownerDoc.exists ? ownerDoc.data().name : 'Listing owner';
    const bidderName = bidderDoc.exists ? bidderDoc.data().name : 'Bidder';

    if (after.status === 'accepted') {
      // Notify bidder
      await db.collection(`users/${after.bidderId}/notifications`).doc().set({
        type: 'BID_ACCEPTED',
        title: 'Bid Accepted!',
        message: `${ownerName} accepted your bid of ₱${after.price.toLocaleString()}`,
        data: {
          bidId,
          listingId: after.listingId,
          price: after.price,
        },
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Notify listing owner
      await db.collection(`users/${after.listingOwnerId}/notifications`).doc().set({
        type: 'BID_ACCEPTED',
        title: 'Bid Accepted',
        message: `You accepted ${bidderName}'s bid of ₱${after.price.toLocaleString()}. Contract is being created.`,
        data: {
          bidId,
          listingId: after.listingId,
          price: after.price,
        },
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else if (after.status === 'rejected') {
      // Notify bidder
      await db.collection(`users/${after.bidderId}/notifications`).doc().set({
        type: 'BID_REJECTED',
        title: 'Bid Rejected',
        message: `${ownerName} rejected your bid of ₱${after.price.toLocaleString()}`,
        data: {
          bidId,
          listingId: after.listingId,
          price: after.price,
        },
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Keep broker activity bid status in sync.
    try {
      const activityRef = db.collection('brokerMarketplaceActivity').doc(`bid:${bidId}`);
      const activityDoc = await activityRef.get();
      if (activityDoc.exists) {
        await activityRef.set({
          status: mapBidStatusToActivityStatus(after.status),
          activityAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    } catch (error) {
      console.error('Failed to update broker bid activity status:', error);
    }

    return null;
  }
);

/**
 * Create contract immediately when bid is accepted
 * No payment blocking - contract created right away
 */
exports.onBidAccepted = onDocumentUpdated(
  {
    region: 'asia-southeast1',
    document: 'bids/{bidId}',
  },
  async (event) => {
    const change = event.data;
    if (!change) return null;
    const before = change.before.data();
    const after = change.after.data();
    const bidId = event.params.bidId;

    // Only trigger when status changes to 'accepted'
    if (before.status !== 'accepted' && after.status === 'accepted') {
      const { createContractFromApprovedFee } = require('../services/contractCreation');

      try {
        // Create contract immediately with platform fee debt tracking
        const contract = await createContractFromApprovedFee(
          bidId,
          after.listingOwnerId,
          {
            skipPaymentCheck: true,           // NEW FLAG
            createPlatformFeeDebt: true       // NEW FLAG
          }
        );

        // Notify trucker about outstanding platform fee policy
        await admin.firestore()
          .collection(`users/${after.bidderId}/notifications`)
          .doc()
          .set({
            type: 'PLATFORM_FEE_OUTSTANDING',
            title: 'Contract Created - Platform Fee Required',
            message: `Contract #${contract.contractNumber} is ready. Platform fee of PHP ${contract.platformFee.toLocaleString()} will be due after delivery completion.`,
            data: {
              contractId: contract.id,
              bidId,
              platformFee: contract.platformFee,
              actionRequired: 'PAY_PLATFORM_FEE',
            },
            isRead: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });

        console.log(`Contract ${contract.id} created with outstanding platform fee for trucker ${after.bidderId}`);
      } catch (error) {
        console.error('Error creating contract on bid acceptance:', error);
        await admin.firestore()
          .collection(`users/${after.listingOwnerId}/notifications`)
          .doc()
          .set({
            type: 'CONTRACT_CREATION_FAILED',
            title: 'Contract Creation Blocked',
            message: 'Contract was not created. The fee payer reached the outstanding fee limit or has account restrictions.',
            data: { bidId, listingId: after.listingId },
            isRead: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
      }
    }

    return null;
  }
);
