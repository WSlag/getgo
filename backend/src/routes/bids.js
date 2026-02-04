import { Router } from 'express';
import { Bid, CargoListing, TruckListing, User, TruckerProfile, ShipperProfile, ChatMessage, Wallet, WalletTransaction, Notification } from '../models/index.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

const PLATFORM_FEE_RATE = parseFloat(process.env.PLATFORM_FEE_RATE) || 0.03;

// Get bids for a listing
router.get('/listing/:listingType/:listingId', authenticateToken, async (req, res) => {
  try {
    const { listingType, listingId } = req.params;

    const where = listingType === 'cargo'
      ? { cargoListingId: listingId }
      : { truckListingId: listingId };

    const bids = await Bid.findAll({
      where,
      include: [
        {
          model: User,
          as: 'bidder',
          attributes: ['id', 'name', 'phone', 'email', 'facebookUrl'],
          include: [
            { model: TruckerProfile, as: 'truckerProfile' },
            { model: ShipperProfile, as: 'shipperProfile' },
          ],
        },
        {
          model: ChatMessage,
          as: 'chatHistory',
          include: [{ model: User, as: 'sender', attributes: ['id', 'name'] }],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    res.json({ bids });
  } catch (error) {
    console.error('Get bids error:', error);
    res.status(500).json({ error: 'Failed to get bids' });
  }
});

// Get my bids
router.get('/my-bids', authenticateToken, async (req, res) => {
  try {
    const bids = await Bid.findAll({
      where: { bidderId: req.user.id },
      include: [
        {
          model: CargoListing,
          include: [{ model: User, as: 'shipper', attributes: ['id', 'name'] }],
        },
        {
          model: TruckListing,
          include: [{ model: User, as: 'trucker', attributes: ['id', 'name'] }],
        },
        {
          model: ChatMessage,
          as: 'chatHistory',
          order: [['createdAt', 'ASC']],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    res.json({ bids });
  } catch (error) {
    console.error('Get my bids error:', error);
    res.status(500).json({ error: 'Failed to get your bids' });
  }
});

// Create a bid
router.post('/', authenticateToken, async (req, res) => {
  try {
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
    let listing;
    if (listingType === 'cargo') {
      listing = await CargoListing.findByPk(listingId);
    } else {
      listing = await TruckListing.findByPk(listingId);
    }

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listing.status !== 'open') {
      return res.status(400).json({ error: 'Listing is no longer accepting bids' });
    }

    // Check if user is not bidding on their own listing
    if (listing.userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot bid on your own listing' });
    }

    // For truckers bidding on cargo, check wallet balance
    if (listingType === 'cargo') {
      const wallet = await Wallet.findOne({ where: { userId: req.user.id } });
      const requiredFee = Math.round(price * PLATFORM_FEE_RATE);

      if (!wallet || wallet.balance < requiredFee) {
        return res.status(400).json({
          error: `Insufficient wallet balance. You need ₱${requiredFee} to cover the platform fee.`,
          requiredFee,
          currentBalance: wallet ? wallet.balance : 0,
        });
      }
    }

    // Create bid
    const bidData = {
      bidderId: req.user.id,
      listingType,
      price,
      message,
    };

    if (listingType === 'cargo') {
      bidData.cargoListingId = listingId;
    } else {
      bidData.truckListingId = listingId;
      bidData.cargoType = cargoType;
      bidData.cargoWeight = cargoWeight;
    }

    const bid = await Bid.create(bidData);

    // Create notification for listing owner
    await Notification.create({
      userId: listing.userId,
      type: 'NEW_BID',
      title: 'New Bid Received!',
      message: `New bid of ₱${price.toLocaleString()} on your ${listing.origin} → ${listing.destination} listing`,
      data: { bidId: bid.id, listingId, listingType, price },
    });

    res.status(201).json({
      message: 'Bid placed successfully',
      bid,
    });
  } catch (error) {
    console.error('Create bid error:', error);
    res.status(500).json({ error: 'Failed to place bid' });
  }
});

// Accept a bid
router.put('/:id/accept', authenticateToken, async (req, res) => {
  try {
    const bid = await Bid.findByPk(req.params.id, {
      include: [
        { model: CargoListing },
        { model: TruckListing },
      ],
    });

    if (!bid) {
      return res.status(404).json({ error: 'Bid not found' });
    }

    const listing = bid.CargoListing || bid.TruckListing;
    if (listing.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to accept this bid' });
    }

    if (bid.status !== 'pending') {
      return res.status(400).json({ error: 'Bid has already been processed' });
    }

    // Update bid status
    await bid.update({ status: 'accepted' });

    // Update listing status
    await listing.update({ status: 'negotiating' });

    // Reject other bids
    const listingIdField = bid.cargoListingId ? 'cargoListingId' : 'truckListingId';
    await Bid.update(
      { status: 'rejected' },
      {
        where: {
          [listingIdField]: listing.id,
          id: { [require('sequelize').Op.ne]: bid.id },
          status: 'pending',
        },
      }
    );

    // Create notification for bidder
    await Notification.create({
      userId: bid.bidderId,
      type: 'BID_ACCEPTED',
      title: 'Bid Accepted!',
      message: `Your bid of ₱${bid.price.toLocaleString()} on ${listing.origin} → ${listing.destination} was accepted`,
      data: { bidId: bid.id },
    });

    res.json({
      message: 'Bid accepted successfully',
      bid,
    });
  } catch (error) {
    console.error('Accept bid error:', error);
    res.status(500).json({ error: 'Failed to accept bid' });
  }
});

// Reject a bid
router.put('/:id/reject', authenticateToken, async (req, res) => {
  try {
    const bid = await Bid.findByPk(req.params.id, {
      include: [
        { model: CargoListing },
        { model: TruckListing },
      ],
    });

    if (!bid) {
      return res.status(404).json({ error: 'Bid not found' });
    }

    const listing = bid.CargoListing || bid.TruckListing;
    if (listing.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to reject this bid' });
    }

    await bid.update({ status: 'rejected' });

    // Create notification for bidder
    await Notification.create({
      userId: bid.bidderId,
      type: 'BID_REJECTED',
      title: 'Bid Declined',
      message: `Your bid on ${listing.origin} → ${listing.destination} was declined`,
      data: { bidId: bid.id },
    });

    res.json({
      message: 'Bid rejected successfully',
      bid,
    });
  } catch (error) {
    console.error('Reject bid error:', error);
    res.status(500).json({ error: 'Failed to reject bid' });
  }
});

// Withdraw a bid
router.put('/:id/withdraw', authenticateToken, async (req, res) => {
  try {
    const bid = await Bid.findByPk(req.params.id);

    if (!bid) {
      return res.status(404).json({ error: 'Bid not found' });
    }

    if (bid.bidderId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to withdraw this bid' });
    }

    if (bid.status !== 'pending') {
      return res.status(400).json({ error: 'Can only withdraw pending bids' });
    }

    await bid.update({ status: 'withdrawn' });

    res.json({
      message: 'Bid withdrawn successfully',
      bid,
    });
  } catch (error) {
    console.error('Withdraw bid error:', error);
    res.status(500).json({ error: 'Failed to withdraw bid' });
  }
});

export default router;
