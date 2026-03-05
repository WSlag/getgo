import { Router } from 'express';
import admin from 'firebase-admin';
import { db } from '../config/firestore.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Get ratings for a user
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const userId = req.params.userId;

    // Query ratings from Firestore
    const ratingsSnapshot = await db.collection('ratings')
      .where('ratedUserId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit))
      .offset(parseInt(offset))
      .get();

    // Get total count
    const countSnapshot = await db.collection('ratings')
      .where('ratedUserId', '==', userId)
      .get();
    const total = countSnapshot.size;

    // Enrich ratings with basic rater data only (avoid leaking contract/listing internals)
    const ratings = await Promise.all(
      ratingsSnapshot.docs.map(async (ratingDoc) => {
        const rating = { id: ratingDoc.id, ...ratingDoc.data() };

        // Get rater info
        const raterDoc = await db.collection('users').doc(rating.raterId).get();
        const rater = raterDoc.exists ? {
          id: raterDoc.id,
          name: raterDoc.data().name,
          profileImage: raterDoc.data().profileImage,
        } : null;

        return {
          ...rating,
          rater,
          createdAt: rating.createdAt?.toDate?.() || null,
        };
      })
    );

    // Calculate average rating
    let totalScore = 0;
    countSnapshot.docs.forEach(doc => {
      totalScore += doc.data().score || 0;
    });
    const averageRating = countSnapshot.size > 0
      ? (totalScore / countSnapshot.size).toFixed(1)
      : null;

    res.json({
      ratings,
      total,
      averageRating,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    console.error('Get user ratings error:', error);
    res.status(500).json({ error: 'Failed to get ratings' });
  }
});

// Get rating for a specific contract
router.get('/contract/:contractId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const contractId = req.params.contractId;

    const contractDoc = await db.collection('contracts').doc(contractId).get();
    if (!contractDoc.exists) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const participantIds = contractDoc.data()?.participantIds || [];
    if (!participantIds.includes(userId)) {
      return res.status(403).json({ error: 'Not authorized to view these ratings' });
    }

    // Query ratings from Firestore
    const ratingsSnapshot = await db.collection('ratings')
      .where('contractId', '==', contractId)
      .get();

    // Enrich ratings with user data
    const ratings = await Promise.all(
      ratingsSnapshot.docs.map(async (ratingDoc) => {
        const rating = { id: ratingDoc.id, ...ratingDoc.data() };

        // Get rater info
        const raterDoc = await db.collection('users').doc(rating.raterId).get();
        const rater = raterDoc.exists ? {
          id: raterDoc.id,
          name: raterDoc.data().name,
          profileImage: raterDoc.data().profileImage,
        } : null;

        // Get rated user info
        const ratedUserDoc = await db.collection('users').doc(rating.ratedUserId).get();
        const ratedUser = ratedUserDoc.exists ? {
          id: ratedUserDoc.id,
          name: ratedUserDoc.data().name,
          profileImage: ratedUserDoc.data().profileImage,
        } : null;

        return {
          ...rating,
          rater,
          ratedUser,
          createdAt: rating.createdAt?.toDate?.() || null,
        };
      })
    );

    // Check if current user has already rated
    const myRating = ratings.find((r) => r.raterId === userId);

    res.json({
      ratings,
      myRating: myRating || null,
      hasRated: !!myRating,
    });
  } catch (error) {
    console.error('Get contract ratings error:', error);
    res.status(500).json({ error: 'Failed to get ratings' });
  }
});

// Create a rating
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { contractId, score, tags = [], comment } = req.body;

    if (!contractId || !score) {
      return res.status(400).json({ error: 'Contract ID and score are required' });
    }

    if (score < 1 || score > 5) {
      return res.status(400).json({ error: 'Score must be between 1 and 5' });
    }

    // Get contract from Firestore
    const contractDoc = await db.collection('contracts').doc(contractId).get();

    if (!contractDoc.exists) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const contract = { id: contractDoc.id, ...contractDoc.data() };

    if (contract.status !== 'completed') {
      return res.status(400).json({ error: 'Can only rate completed contracts' });
    }

    // Get bid
    const bidDoc = await db.collection('bids').doc(contract.bidId).get();
    if (!bidDoc.exists) {
      return res.status(404).json({ error: 'Bid not found' });
    }
    const bid = bidDoc.data();

    // Get listing to find owner
    const listingId = bid.cargoListingId || bid.truckListingId;
    const listingCollection = bid.cargoListingId ? 'cargoListings' : 'truckListings';
    const listingDoc = await db.collection(listingCollection).doc(listingId).get();

    if (!listingDoc.exists) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const listing = listingDoc.data();
    const listingOwnerId = listing.userId;
    const bidderId = bid.bidderId;

    // 🔒 AUTHORIZATION: Check user is involved in this contract
    if (userId !== listingOwnerId && userId !== bidderId) {
      return res.status(403).json({ error: 'Not authorized to rate this contract' });
    }

    // Determine who is being rated
    const ratedUserId = userId === listingOwnerId ? bidderId : listingOwnerId;

    // Check if already rated
    const existingRatingsSnapshot = await db.collection('ratings')
      .where('contractId', '==', contractId)
      .where('raterId', '==', userId)
      .get();

    if (!existingRatingsSnapshot.empty) {
      return res.status(400).json({ error: 'You have already rated this contract' });
    }

    // Create rating in Firestore
    const ratingRef = db.collection('ratings').doc();
    const ratingData = {
      contractId,
      raterId: userId,
      ratedUserId,
      score,
      tags: tags || [],
      comment: comment || '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await ratingRef.set(ratingData);

    // Get rated user's data to determine role
    const ratedUserDoc = await db.collection('users').doc(ratedUserId).get();
    const ratedUserData = ratedUserDoc.exists ? ratedUserDoc.data() : null;

    // Calculate new average rating for rated user
    const ratingsSnapshot = await db.collection('ratings')
      .where('ratedUserId', '==', ratedUserId)
      .get();

    let totalScore = 0;
    ratingsSnapshot.docs.forEach(doc => {
      totalScore += doc.data().score || 0;
    });
    const newRating = ratingsSnapshot.size > 0 ? totalScore / ratingsSnapshot.size : score;

    // Update user profile based on role (embedded in user document)
    if (ratedUserData) {
      const userRef = db.collection('users').doc(ratedUserId);

      if (ratedUserData.role === 'trucker' && ratedUserData.truckerProfile) {
        const truckerProfile = ratedUserData.truckerProfile;
        const newTotalTrips = (truckerProfile.totalTrips || 0) + 1;
        const newBadge = calculateBadge(newRating, newTotalTrips);

        await userRef.update({
          'truckerProfile.rating': newRating,
          'truckerProfile.totalTrips': newTotalTrips,
          'truckerProfile.badge': newBadge,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Notify if badge changed
        if (newBadge !== truckerProfile.badge) {
          await db.collection('users').doc(ratedUserId).collection('notifications').doc().set({
            type: 'BADGE_UPGRADE',
            title: 'Badge Upgraded!',
            message: `Congratulations! You've earned the ${newBadge} badge!`,
            data: { oldBadge: truckerProfile.badge, newBadge },
            isRead: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }

      if (ratedUserData.role === 'shipper' && ratedUserData.shipperProfile) {
        const shipperProfile = ratedUserData.shipperProfile;
        const newTotalTransactions = (shipperProfile.totalTransactions || 0) + 1;
        const newTier = calculateMembershipTier(newTotalTransactions);

        await userRef.update({
          'shipperProfile.totalTransactions': newTotalTransactions,
          'shipperProfile.membershipTier': newTier,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Notify if tier changed
        if (newTier !== shipperProfile.membershipTier) {
          await db.collection('users').doc(ratedUserId).collection('notifications').doc().set({
            type: 'TIER_UPGRADE',
            title: 'Membership Tier Upgraded!',
            message: `Congratulations! You've reached ${newTier} tier! Enjoy new benefits.`,
            data: { oldTier: shipperProfile.membershipTier, newTier },
            isRead: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }
    }

    // Notify the rated user
    await db.collection('users').doc(ratedUserId).collection('notifications').doc().set({
      type: 'RATING_REQUEST',
      title: 'New Rating Received',
      message: `You received a ${score}-star rating for contract #${contract.contractNumber}`,
      data: { contractId, ratingId: ratingRef.id, score },
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(201).json({
      message: 'Rating submitted successfully',
      rating: {
        id: ratingRef.id,
        ...ratingData,
        createdAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Create rating error:', error);
    res.status(500).json({ error: 'Failed to submit rating' });
  }
});

// Get my given ratings
router.get('/my-ratings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;

    // Query ratings from Firestore
    const ratingsSnapshot = await db.collection('ratings')
      .where('raterId', '==', userId)
      .get();

    // Enrich ratings with rated user and contract data
    const ratings = await Promise.all(
      ratingsSnapshot.docs.map(async (ratingDoc) => {
        const rating = { id: ratingDoc.id, ...ratingDoc.data() };

        // Get rated user info
        const ratedUserDoc = await db.collection('users').doc(rating.ratedUserId).get();
        const ratedUser = ratedUserDoc.exists ? {
          id: ratedUserDoc.id,
          name: ratedUserDoc.data().name,
          profileImage: ratedUserDoc.data().profileImage,
        } : null;

        // Get contract info
        let contract = null;
        if (rating.contractId) {
          const contractDoc = await db.collection('contracts').doc(rating.contractId).get();
          if (contractDoc.exists) {
            contract = {
              id: contractDoc.id,
              contractNumber: contractDoc.data().contractNumber,
            };
          }
        }

        return {
          ...rating,
          ratedUser,
          Contract: contract,
          createdAt: rating.createdAt?.toDate?.() || null,
        };
      })
    );

    // Sort by createdAt descending
    ratings.sort((a, b) => {
      const dateA = a.createdAt || new Date(0);
      const dateB = b.createdAt || new Date(0);
      return dateB - dateA;
    });

    res.json({ ratings });
  } catch (error) {
    console.error('Get my ratings error:', error);
    res.status(500).json({ error: 'Failed to get ratings' });
  }
});

// Get pending ratings (contracts I need to rate)
router.get('/pending', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;

    // Get completed contracts from Firestore
    const contractsSnapshot = await db.collection('contracts')
      .where('status', '==', 'completed')
      .get();

    // Process each contract to check if user is involved and hasn't rated
    const pendingRatings = [];

    for (const contractDoc of contractsSnapshot.docs) {
      const contract = { id: contractDoc.id, ...contractDoc.data() };

      // Get bid
      const bidDoc = await db.collection('bids').doc(contract.bidId).get();
      if (!bidDoc.exists) continue;
      const bid = bidDoc.data();

      // Get listing
      const listingId = bid.cargoListingId || bid.truckListingId;
      const listingCollection = bid.cargoListingId ? 'cargoListings' : 'truckListings';
      if (!listingId) continue;

      const listingDoc = await db.collection(listingCollection).doc(listingId).get();
      if (!listingDoc.exists) continue;
      const listing = listingDoc.data();

      // Check if user is involved
      const isInvolved = bid.bidderId === userId || listing.userId === userId;
      if (!isInvolved) continue;

      // Check if user has already rated this contract
      const ratingsSnapshot = await db.collection('ratings')
        .where('contractId', '==', contract.id)
        .where('raterId', '==', userId)
        .get();

      const hasRated = !ratingsSnapshot.empty;
      if (hasRated) continue;

      // Determine the other user
      const otherUserId = listing.userId === userId ? bid.bidderId : listing.userId;
      const otherUserDoc = await db.collection('users').doc(otherUserId).get();
      const otherUser = otherUserDoc.exists ? {
        id: otherUserDoc.id,
        name: otherUserDoc.data().name,
        profileImage: otherUserDoc.data().profileImage,
      } : null;

      pendingRatings.push({
        contractId: contract.id,
        contractNumber: contract.contractNumber,
        route: `${listing.origin} → ${listing.destination}`,
        otherUser,
        completedAt: contract.updatedAt?.toDate?.() || null,
      });
    }

    // Sort by completedAt descending
    pendingRatings.sort((a, b) => {
      const dateA = a.completedAt || new Date(0);
      const dateB = b.completedAt || new Date(0);
      return dateB - dateA;
    });

    res.json({ pendingRatings });
  } catch (error) {
    console.error('Get pending ratings error:', error);
    res.status(500).json({ error: 'Failed to get pending ratings' });
  }
});

// Helper function to calculate trucker badge
function calculateBadge(rating, trips) {
  if (rating >= 4.8 && trips >= 100) return 'ELITE';
  if (rating >= 4.5 && trips >= 50) return 'PRO';
  if (rating >= 4.0 && trips >= 20) return 'VERIFIED';
  if (trips >= 5) return 'ACTIVE';
  return 'STARTER';
}

// Helper function to calculate shipper membership tier
function calculateMembershipTier(transactions) {
  if (transactions >= 100) return 'DIAMOND';
  if (transactions >= 50) return 'PLATINUM';
  if (transactions >= 25) return 'GOLD';
  if (transactions >= 10) return 'SILVER';
  if (transactions >= 3) return 'BRONZE';
  return 'NEW';
}

export default router;
