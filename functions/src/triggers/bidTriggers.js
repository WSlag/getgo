/**
 * Bid Triggers
 * Sends notifications when bids are created, accepted, or rejected
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

/**
 * Notify listing owner when a new bid is placed
 */
exports.onBidCreated = functions.region('asia-southeast1').firestore
  .document('bids/{bidId}')
  .onCreate(async (snap, context) => {
    const bid = snap.data();
    const bidId = context.params.bidId;

    // Get bidder name
    const bidderDoc = await admin.firestore().collection('users').doc(bid.bidderId).get();
    const bidderName = bidderDoc.exists ? bidderDoc.data().name : 'Someone';

    // Notify listing owner
    if (bid.listingOwnerId) {
      await admin.firestore()
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

    return null;
  });

/**
 * Notify both parties when a bid is accepted or rejected
 */
exports.onBidStatusChanged = functions.region('asia-southeast1').firestore
  .document('bids/{bidId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const bidId = context.params.bidId;

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
        message: `You accepted ${bidderName}'s bid of ₱${after.price.toLocaleString()}. Please pay the platform fee to proceed.`,
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

    return null;
  });
