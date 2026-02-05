import { Router } from 'express';
import { Op } from 'sequelize';
import {
  Rating,
  Contract,
  Bid,
  CargoListing,
  TruckListing,
  User,
  TruckerProfile,
  ShipperProfile,
  Notification,
} from '../models/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { sequelize } from '../models/index.js';

const router = Router();

// Get ratings for a user
router.get('/user/:userId', async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const ratings = await Rating.findAndCountAll({
      where: { ratedUserId: req.params.userId },
      include: [
        {
          model: User,
          as: 'rater',
          attributes: ['id', 'name', 'profileImage'],
        },
        {
          model: Contract,
          include: [
            {
              model: Bid,
              include: [
                { model: CargoListing, attributes: ['origin', 'destination'] },
                { model: TruckListing, attributes: ['origin', 'destination'] },
              ],
            },
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    // Calculate average rating
    const avgResult = await Rating.findOne({
      where: { ratedUserId: req.params.userId },
      attributes: [[sequelize.fn('AVG', sequelize.col('score')), 'avgRating']],
      raw: true,
    });

    res.json({
      ratings: ratings.rows,
      total: ratings.count,
      averageRating: avgResult?.avgRating ? parseFloat(avgResult.avgRating).toFixed(1) : null,
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
    const ratings = await Rating.findAll({
      where: { contractId: req.params.contractId },
      include: [
        {
          model: User,
          as: 'rater',
          attributes: ['id', 'name', 'profileImage'],
        },
        {
          model: User,
          as: 'ratedUser',
          attributes: ['id', 'name', 'profileImage'],
        },
      ],
    });

    // Check if current user has already rated
    const myRating = ratings.find((r) => r.raterId === req.user.id);

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
    const { contractId, score, tags = [], comment } = req.body;

    if (!contractId || !score) {
      return res.status(400).json({ error: 'Contract ID and score are required' });
    }

    if (score < 1 || score > 5) {
      return res.status(400).json({ error: 'Score must be between 1 and 5' });
    }

    // Get contract with related data
    const contract = await Contract.findByPk(contractId, {
      include: [
        {
          model: Bid,
          include: [
            {
              model: CargoListing,
              include: [{ model: User, as: 'shipper' }],
            },
            {
              model: TruckListing,
              include: [{ model: User, as: 'trucker' }],
            },
            {
              model: User,
              as: 'bidder',
            },
          ],
        },
      ],
    });

    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    if (contract.status !== 'completed') {
      return res.status(400).json({ error: 'Can only rate completed contracts' });
    }

    const bid = contract.Bid;
    const listing = bid.CargoListing || bid.TruckListing;
    const listingOwnerId = listing.userId;
    const bidderId = bid.bidderId;

    // Check user is involved
    if (req.user.id !== listingOwnerId && req.user.id !== bidderId) {
      return res.status(403).json({ error: 'Not authorized to rate this contract' });
    }

    // Determine who is being rated
    const ratedUserId = req.user.id === listingOwnerId ? bidderId : listingOwnerId;

    // Check if already rated
    const existingRating = await Rating.findOne({
      where: {
        contractId,
        raterId: req.user.id,
      },
    });

    if (existingRating) {
      return res.status(400).json({ error: 'You have already rated this contract' });
    }

    // Create rating
    const rating = await Rating.create({
      contractId,
      raterId: req.user.id,
      ratedUserId,
      score,
      tags,
      comment,
    });

    // Update trucker profile rating if rated user is a trucker
    const truckerProfile = await TruckerProfile.findOne({ where: { userId: ratedUserId } });
    if (truckerProfile) {
      // Calculate new average rating
      const avgResult = await Rating.findOne({
        where: { ratedUserId },
        attributes: [[sequelize.fn('AVG', sequelize.col('score')), 'avgRating']],
        raw: true,
      });

      const newRating = avgResult?.avgRating ? parseFloat(avgResult.avgRating) : score;

      // Update trucker profile
      await truckerProfile.update({
        rating: newRating,
        totalTrips: truckerProfile.totalTrips + 1,
      });

      // Update badge based on rating and trips
      const newBadge = calculateBadge(newRating, truckerProfile.totalTrips + 1);
      if (newBadge !== truckerProfile.badge) {
        await truckerProfile.update({ badge: newBadge });

        // Notify trucker of badge upgrade
        await Notification.create({
          userId: ratedUserId,
          type: 'BADGE_UPGRADE',
          title: 'Badge Upgraded!',
          message: `Congratulations! You've earned the ${newBadge} badge!`,
          data: { oldBadge: truckerProfile.badge, newBadge },
        });
      }
    }

    // Update shipper profile if rated user is a shipper
    const shipperProfile = await ShipperProfile.findOne({ where: { userId: ratedUserId } });
    if (shipperProfile) {
      await shipperProfile.update({
        totalTransactions: shipperProfile.totalTransactions + 1,
      });

      // Update membership tier based on transactions
      const newTier = calculateMembershipTier(shipperProfile.totalTransactions + 1);
      if (newTier !== shipperProfile.membershipTier) {
        await shipperProfile.update({ membershipTier: newTier });

        // Notify shipper of tier upgrade
        await Notification.create({
          userId: ratedUserId,
          type: 'TIER_UPGRADE',
          title: 'Membership Tier Upgraded!',
          message: `Congratulations! You've reached ${newTier} tier! Enjoy new benefits.`,
          data: { oldTier: shipperProfile.membershipTier, newTier },
        });
      }
    }

    // Notify the rated user
    await Notification.create({
      userId: ratedUserId,
      type: 'RATING_REQUEST',
      title: 'New Rating Received',
      message: `You received a ${score}-star rating for contract #${contract.contractNumber}`,
      data: { contractId, ratingId: rating.id, score },
    });

    res.status(201).json({
      message: 'Rating submitted successfully',
      rating,
    });
  } catch (error) {
    console.error('Create rating error:', error);
    res.status(500).json({ error: 'Failed to submit rating' });
  }
});

// Get my given ratings
router.get('/my-ratings', authenticateToken, async (req, res) => {
  try {
    const ratings = await Rating.findAll({
      where: { raterId: req.user.id },
      include: [
        {
          model: User,
          as: 'ratedUser',
          attributes: ['id', 'name', 'profileImage'],
        },
        {
          model: Contract,
          attributes: ['id', 'contractNumber'],
        },
      ],
      order: [['createdAt', 'DESC']],
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
    // Get completed contracts where user is involved
    const contracts = await Contract.findAll({
      where: { status: 'completed' },
      include: [
        {
          model: Bid,
          include: [
            {
              model: CargoListing,
              include: [
                {
                  model: User,
                  as: 'shipper',
                  attributes: ['id', 'name', 'profileImage'],
                },
              ],
            },
            {
              model: TruckListing,
              include: [
                {
                  model: User,
                  as: 'trucker',
                  attributes: ['id', 'name', 'profileImage'],
                },
              ],
            },
            {
              model: User,
              as: 'bidder',
              attributes: ['id', 'name', 'profileImage'],
            },
          ],
        },
        {
          model: Rating,
          as: 'ratings',
        },
      ],
      order: [['updatedAt', 'DESC']],
    });

    // Filter to contracts user is involved in and hasn't rated yet
    const pendingRatings = contracts.filter((contract) => {
      const bid = contract.Bid;
      if (!bid) return false;

      const listing = bid.CargoListing || bid.TruckListing;
      const isInvolved = bid.bidderId === req.user.id || listing.userId === req.user.id;
      if (!isInvolved) return false;

      // Check if user has already rated
      const hasRated = contract.ratings?.some((r) => r.raterId === req.user.id);
      return !hasRated;
    });

    res.json({
      pendingRatings: pendingRatings.map((contract) => {
        const bid = contract.Bid;
        const listing = bid.CargoListing || bid.TruckListing;
        const otherUser =
          listing.userId === req.user.id
            ? bid.bidder
            : bid.CargoListing?.shipper || bid.TruckListing?.trucker;

        return {
          contractId: contract.id,
          contractNumber: contract.contractNumber,
          route: `${listing.origin} → ${listing.destination}`,
          otherUser: otherUser
            ? { id: otherUser.id, name: otherUser.name, profileImage: otherUser.profileImage }
            : null,
          completedAt: contract.updatedAt,
        };
      }),
    });
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
