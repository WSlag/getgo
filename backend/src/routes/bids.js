import { Router } from 'express';
import admin from 'firebase-admin';
import { db } from '../config/firestore.js';
import { authenticateToken } from '../middleware/auth.js';

// Helper function to mask contact info
const maskContactInfo = (user, showContact = false) => {
  if (!user) return user;

  const masked = { ...user.toJSON ? user.toJSON() : user };

  if (!showContact) {
    if (masked.phone) {
      masked.phone = '****' + masked.phone.slice(-4);
      masked.phoneMasked = true;
    }
    if (masked.email) {
      masked.email = '****@****';
      masked.emailMasked = true;
    }
    if (masked.facebookUrl) {
      masked.facebookUrl = null;
      masked.facebookMasked = true;
    }
    masked.contactMasked = true;
  } else {
    masked.contactMasked = false;
  }

  return masked;
};

// Check if user has a signed contract with another user
const hasSignedContract = async (userId1, userId2) => {
  if (!userId1 || !userId2) return false;

  // Query Firestore for signed/completed contracts
  const contractsSnapshot = await db.collection('contracts')
    .where('status', 'in', ['signed', 'completed'])
    .get();

  // Check each contract to see if both users are involved
  for (const contractDoc of contractsSnapshot.docs) {
    const contract = contractDoc.data();

    // Get the associated bid
    const bidDoc = await db.collection('bids').doc(contract.bidId).get();
    if (!bidDoc.exists) continue;

    const bid = bidDoc.data();

    // Get the associated listing
    const listingId = bid.cargoListingId || bid.truckListingId;
    const listingCollection = bid.cargoListingId ? 'cargoListings' : 'truckListings';
    if (!listingId) continue;

    const listingDoc = await db.collection(listingCollection).doc(listingId).get();
    if (!listingDoc.exists) continue;

    const listing = listingDoc.data();

    // Check if both users are involved in this contract
    const involvedUsers = [listing.userId, bid.bidderId];
    if (involvedUsers.includes(userId1) && involvedUsers.includes(userId2)) {
      return true;
    }
  }

  return false;
};

const router = Router();

const PLATFORM_FEE_RATE = parseFloat(process.env.PLATFORM_FEE_RATE) || 0.03;

// Get bids for a listing
router.get('/listing/:listingType/:listingId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { listingType, listingId } = req.params;

    // Query bids from Firestore
    const fieldName = listingType === 'cargo' ? 'cargoListingId' : 'truckListingId';
    const bidsSnapshot = await db.collection('bids')
      .where(fieldName, '==', listingId)
      .get();

    // Get the listing to find its owner
    const listingCollection = listingType === 'cargo' ? 'cargoListings' : 'truckListings';
    const listingDoc = await db.collection(listingCollection).doc(listingId).get();
    if (!listingDoc.exists) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    const listing = { id: listingDoc.id, ...listingDoc.data() };
    const isListingOwner = listing.userId === userId;

    // Process bids and apply contact masking
    const bidsData = await Promise.all(
      bidsSnapshot.docs.map(async (bidDoc) => {
        const bid = { id: bidDoc.id, ...bidDoc.data() };
        if (!isListingOwner && bid.bidderId !== userId) {
          return null;
        }

        // Get bidder user data
        const bidderDoc = await db.collection('users').doc(bid.bidderId).get();
        const bidder = bidderDoc.exists ? { id: bidderDoc.id, ...bidderDoc.data() } : null;

        // Get chat messages for this bid
        let chatHistory = [];
        if (isListingOwner || bid.bidderId === userId) {
          const messagesSnapshot = await db.collection('bids')
            .doc(bidDoc.id)
            .collection('messages')
            .orderBy('createdAt', 'asc')
            .get();

          chatHistory = messagesSnapshot.docs.map(msgDoc => ({
            id: msgDoc.id,
            ...msgDoc.data()
          }));
        }

        // Listing owner can see bidder contacts only if there's a signed contract
        const canSeeContact = userId === bid.bidderId ||
          (isListingOwner && await hasSignedContract(userId, bid.bidderId));

        return {
          ...bid,
          bidder: bidder ? maskContactInfo(bidder, canSeeContact) : null,
          chatHistory,
          createdAt: bid.createdAt?.toDate?.() || null,
          updatedAt: bid.updatedAt?.toDate?.() || null,
        };
      })
    );
    const visibleBids = bidsData.filter(Boolean);

    // Sort by createdAt descending
    visibleBids.sort((a, b) => {
      const dateA = a.createdAt || new Date(0);
      const dateB = b.createdAt || new Date(0);
      return dateB - dateA;
    });

    res.json({ bids: visibleBids });
  } catch (error) {
    console.error('Get bids error:', error);
    res.status(500).json({ error: 'Failed to get bids' });
  }
});

// NOTE: This endpoint is UNUSED - Frontend queries Firestore directly via useBids.js hook
// Keeping for backward compatibility, but can be removed in future cleanup
// See: frontend/src/hooks/useBids.js line 67-70
router.get('/my-bids', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;

    // Query bids from Firestore
    const bidsSnapshot = await db.collection('bids')
      .where('bidderId', '==', userId)
      .get();

    const bidsData = await Promise.all(
      bidsSnapshot.docs.map(async (bidDoc) => {
        const bid = { id: bidDoc.id, ...bidDoc.data() };

        // Get associated listing data
        const listingId = bid.cargoListingId || bid.truckListingId;
        const listingCollection = bid.cargoListingId ? 'cargoListings' : 'truckListings';

        let listing = null;
        if (listingId) {
          const listingDoc = await db.collection(listingCollection).doc(listingId).get();
          if (listingDoc.exists) {
            listing = { id: listingDoc.id, ...listingDoc.data() };
          }
        }

        // Get chat messages
        const messagesSnapshot = await db.collection('bids')
          .doc(bidDoc.id)
          .collection('messages')
          .orderBy('createdAt', 'asc')
          .get();

        const chatHistory = messagesSnapshot.docs.map(msgDoc => ({
          id: msgDoc.id,
          ...msgDoc.data()
        }));

        return {
          ...bid,
          CargoListing: bid.cargoListingId ? listing : null,
          TruckListing: bid.truckListingId ? listing : null,
          chatHistory,
          createdAt: bid.createdAt?.toDate?.() || null,
          updatedAt: bid.updatedAt?.toDate?.() || null,
        };
      })
    );

    // Sort by createdAt descending
    bidsData.sort((a, b) => {
      const dateA = a.createdAt || new Date(0);
      const dateB = b.createdAt || new Date(0);
      return dateB - dateA;
    });

    res.json({ bids: bidsData });
  } catch (error) {
    console.error('Get my bids error:', error);
    res.status(500).json({ error: 'Failed to get your bids' });
  }
});

// Create a bid
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const {
      listingType,
      listingId,
      price,
      message,
      cargoType,
      cargoWeight,
    } = req.body;

    if (!listingType || !listingId || !price) {
      return res.status(400).json({ error: 'Listing type, listing ID, and price are required' });
    }

    // Check listing exists
    const listingCollection = listingType === 'cargo' ? 'cargoListings' : 'truckListings';
    const listingDoc = await db.collection(listingCollection).doc(listingId).get();

    if (!listingDoc.exists) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const listing = { id: listingDoc.id, ...listingDoc.data() };

    if (listing.status !== 'open') {
      return res.status(400).json({ error: 'Listing is no longer accepting bids' });
    }

    // Check if user is not bidding on their own listing
    if (listing.userId === userId) {
      return res.status(400).json({ error: 'Cannot bid on your own listing' });
    }

    // For truckers bidding on cargo, check wallet balance
    if (listingType === 'cargo') {
      const walletDoc = await db.collection('users').doc(userId).collection('wallet').doc('main').get();
      const wallet = walletDoc.exists ? walletDoc.data() : null;
      const requiredFee = Math.round(price * PLATFORM_FEE_RATE);

      if (!wallet || wallet.balance < requiredFee) {
        return res.status(400).json({
          error: `Insufficient wallet balance. You need ₱${requiredFee} to cover the platform fee.`,
          requiredFee,
          currentBalance: wallet ? wallet.balance : 0,
        });
      }
    }

    // Create bid in Firestore
    const bidRef = db.collection('bids').doc();
    const bidData = {
      bidderId: userId,
      listingOwnerId: listing.userId,
      listingType,
      price,
      message: message || '',
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (listingType === 'cargo') {
      bidData.cargoListingId = listingId;
    } else {
      bidData.truckListingId = listingId;
      bidData.cargoType = cargoType;
      bidData.cargoWeight = cargoWeight;
    }

    await bidRef.set(bidData);

    // Create notification for listing owner
    await db.collection('users').doc(listing.userId).collection('notifications').doc().set({
      type: 'NEW_BID',
      title: 'New Bid Received!',
      message: `New bid of ₱${price.toLocaleString()} on your ${listing.origin} → ${listing.destination} listing`,
      data: { bidId: bidRef.id, listingId, listingType, price },
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(201).json({
      message: 'Bid placed successfully',
      bid: {
        id: bidRef.id,
        ...bidData,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Create bid error:', error);
    res.status(500).json({ error: 'Failed to place bid' });
  }
});

// Accept a bid
router.put('/:id/accept', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const bidId = req.params.id;

    // Get bid from Firestore
    const bidDoc = await db.collection('bids').doc(bidId).get();

    if (!bidDoc.exists) {
      return res.status(404).json({ error: 'Bid not found' });
    }

    const bid = { id: bidDoc.id, ...bidDoc.data() };

    // Get the associated listing
    const listingId = bid.cargoListingId || bid.truckListingId;
    const listingCollection = bid.cargoListingId ? 'cargoListings' : 'truckListings';
    const listingDoc = await db.collection(listingCollection).doc(listingId).get();

    if (!listingDoc.exists) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const listing = { id: listingDoc.id, ...listingDoc.data() };

    // 🔒 AUTHORIZATION: Verify user is listing owner
    if (listing.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to accept this bid' });
    }

    if (bid.status !== 'pending') {
      return res.status(400).json({ error: 'Bid has already been processed' });
    }

    // Update bid status
    await bidDoc.ref.update({
      status: 'accepted',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update listing status
    await listingDoc.ref.update({
      status: 'negotiating',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Reject other bids on this listing
    const fieldName = bid.cargoListingId ? 'cargoListingId' : 'truckListingId';
    const otherBidsSnapshot = await db.collection('bids')
      .where(fieldName, '==', listingId)
      .where('status', '==', 'pending')
      .get();

    const batch = db.batch();
    otherBidsSnapshot.docs.forEach(doc => {
      if (doc.id !== bidId) {
        batch.update(doc.ref, {
          status: 'rejected',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    });
    await batch.commit();

    // Create notification for bidder
    await db.collection('users').doc(bid.bidderId).collection('notifications').doc().set({
      type: 'BID_ACCEPTED',
      title: 'Bid Accepted!',
      message: `Your bid of ₱${bid.price.toLocaleString()} on ${listing.origin} → ${listing.destination} was accepted`,
      data: { bidId: bidId },
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({
      message: 'Bid accepted successfully',
      bid: {
        ...bid,
        status: 'accepted',
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Accept bid error:', error);
    res.status(500).json({ error: 'Failed to accept bid' });
  }
});

// Reject a bid
router.put('/:id/reject', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const bidId = req.params.id;

    // Get bid from Firestore
    const bidDoc = await db.collection('bids').doc(bidId).get();

    if (!bidDoc.exists) {
      return res.status(404).json({ error: 'Bid not found' });
    }

    const bid = { id: bidDoc.id, ...bidDoc.data() };

    // Get the associated listing
    const listingId = bid.cargoListingId || bid.truckListingId;
    const listingCollection = bid.cargoListingId ? 'cargoListings' : 'truckListings';
    const listingDoc = await db.collection(listingCollection).doc(listingId).get();

    if (!listingDoc.exists) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const listing = { id: listingDoc.id, ...listingDoc.data() };

    // 🔒 AUTHORIZATION: Verify user is listing owner
    if (listing.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to reject this bid' });
    }

    // Update bid status
    await bidDoc.ref.update({
      status: 'rejected',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Create notification for bidder
    await db.collection('users').doc(bid.bidderId).collection('notifications').doc().set({
      type: 'BID_REJECTED',
      title: 'Bid Declined',
      message: `Your bid on ${listing.origin} → ${listing.destination} was declined`,
      data: { bidId: bidId },
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({
      message: 'Bid rejected successfully',
      bid: {
        ...bid,
        status: 'rejected',
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Reject bid error:', error);
    res.status(500).json({ error: 'Failed to reject bid' });
  }
});

// Withdraw a bid
router.put('/:id/withdraw', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const bidId = req.params.id;

    // Get bid from Firestore
    const bidDoc = await db.collection('bids').doc(bidId).get();

    if (!bidDoc.exists) {
      return res.status(404).json({ error: 'Bid not found' });
    }

    const bid = { id: bidDoc.id, ...bidDoc.data() };

    // 🔒 AUTHORIZATION: Verify user is the bidder
    if (bid.bidderId !== userId) {
      return res.status(403).json({ error: 'Not authorized to withdraw this bid' });
    }

    if (bid.status !== 'pending') {
      return res.status(400).json({ error: 'Can only withdraw pending bids' });
    }

    // Update bid status
    await bidDoc.ref.update({
      status: 'withdrawn',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({
      message: 'Bid withdrawn successfully',
      bid: {
        ...bid,
        status: 'withdrawn',
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Withdraw bid error:', error);
    res.status(500).json({ error: 'Failed to withdraw bid' });
  }
});

export default router;
