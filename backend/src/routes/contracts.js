import { Router } from 'express';
import { Op } from 'sequelize';
import {
  Contract,
  Bid,
  CargoListing,
  TruckListing,
  User,
  TruckerProfile,
  ShipperProfile,
  Notification,
  Shipment,
} from '../models/index.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

const PLATFORM_FEE_RATE = parseFloat(process.env.PLATFORM_FEE_RATE) || 0.03;

// Generate unique contract number
const generateContractNumber = () => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `KC-${year}${month}-${random}`;
};

// Generate unique tracking number
const generateTrackingNumber = () => {
  const random = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `TRK-${random}`;
};

// Get all contracts for the current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    // Find contracts where user is either shipper or trucker
    const contracts = await Contract.findAndCountAll({
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
                  attributes: ['id', 'name', 'phone', 'email', 'facebookUrl'],
                  include: [{ model: ShipperProfile, as: 'shipperProfile' }],
                },
              ],
            },
            {
              model: TruckListing,
              include: [
                {
                  model: User,
                  as: 'trucker',
                  attributes: ['id', 'name', 'phone', 'email', 'facebookUrl'],
                  include: [{ model: TruckerProfile, as: 'truckerProfile' }],
                },
              ],
            },
            {
              model: User,
              as: 'bidder',
              attributes: ['id', 'name', 'phone', 'email', 'facebookUrl'],
              include: [
                { model: TruckerProfile, as: 'truckerProfile' },
                { model: ShipperProfile, as: 'shipperProfile' },
              ],
            },
          ],
        },
        {
          model: Shipment,
          as: 'shipment',
        },
      ],
      where: status ? { status } : {},
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    // Filter to only include contracts where user is involved
    const userContracts = contracts.rows.filter((contract) => {
      const bid = contract.Bid;
      if (!bid) return false;

      // User is the bidder
      if (bid.bidderId === req.user.id) return true;

      // User is the listing owner
      if (bid.CargoListing && bid.CargoListing.userId === req.user.id) return true;
      if (bid.TruckListing && bid.TruckListing.userId === req.user.id) return true;

      return false;
    });

    res.json({
      contracts: userContracts,
      total: userContracts.length,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    console.error('Get contracts error:', error);
    res.status(500).json({ error: 'Failed to get contracts' });
  }
});

// Get single contract
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const contract = await Contract.findByPk(req.params.id, {
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
                  attributes: ['id', 'name', 'phone', 'email', 'facebookUrl'],
                  include: [{ model: ShipperProfile, as: 'shipperProfile' }],
                },
              ],
            },
            {
              model: TruckListing,
              include: [
                {
                  model: User,
                  as: 'trucker',
                  attributes: ['id', 'name', 'phone', 'email', 'facebookUrl'],
                  include: [{ model: TruckerProfile, as: 'truckerProfile' }],
                },
              ],
            },
            {
              model: User,
              as: 'bidder',
              attributes: ['id', 'name', 'phone', 'email', 'facebookUrl'],
              include: [
                { model: TruckerProfile, as: 'truckerProfile' },
                { model: ShipperProfile, as: 'shipperProfile' },
              ],
            },
          ],
        },
        {
          model: Shipment,
          as: 'shipment',
        },
      ],
    });

    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    // Check user is involved in this contract
    const bid = contract.Bid;
    const isInvolved =
      bid.bidderId === req.user.id ||
      (bid.CargoListing && bid.CargoListing.userId === req.user.id) ||
      (bid.TruckListing && bid.TruckListing.userId === req.user.id);

    if (!isInvolved) {
      return res.status(403).json({ error: 'Not authorized to view this contract' });
    }

    res.json({ contract });
  } catch (error) {
    console.error('Get contract error:', error);
    res.status(500).json({ error: 'Failed to get contract' });
  }
});

// Create contract from accepted bid
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { bidId, terms } = req.body;

    if (!bidId) {
      return res.status(400).json({ error: 'Bid ID is required' });
    }

    const bid = await Bid.findByPk(bidId, {
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
    });

    if (!bid) {
      return res.status(404).json({ error: 'Bid not found' });
    }

    if (bid.status !== 'accepted') {
      return res.status(400).json({ error: 'Bid must be accepted before creating a contract' });
    }

    // Check if contract already exists for this bid
    const existingContract = await Contract.findOne({ where: { bidId } });
    if (existingContract) {
      return res.status(400).json({ error: 'Contract already exists for this bid' });
    }

    // Determine listing owner
    const listing = bid.CargoListing || bid.TruckListing;
    const listingOwnerId = listing.userId;

    // Only listing owner can create contract
    if (listingOwnerId !== req.user.id) {
      return res.status(403).json({ error: 'Only the listing owner can create the contract' });
    }

    const platformFee = Math.round(bid.price * PLATFORM_FEE_RATE);

    // Create contract
    const contract = await Contract.create({
      bidId,
      contractNumber: generateContractNumber(),
      agreedPrice: bid.price,
      platformFee,
      terms: terms || `Standard terms for shipment from ${listing.origin} to ${listing.destination}`,
      status: 'draft',
    });

    // Update listing status
    await listing.update({ status: 'contracted' });

    // Notify bidder
    await Notification.create({
      userId: bid.bidderId,
      type: 'CONTRACT_READY',
      title: 'Contract Ready for Signing',
      message: `Contract #${contract.contractNumber} is ready for your signature`,
      data: { contractId: contract.id, bidId },
    });

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${bid.bidderId}`).emit('contract-ready', {
        contractId: contract.id,
        contractNumber: contract.contractNumber,
      });
    }

    res.status(201).json({
      message: 'Contract created successfully',
      contract,
    });
  } catch (error) {
    console.error('Create contract error:', error);
    res.status(500).json({ error: 'Failed to create contract' });
  }
});

// Sign contract
router.put('/:id/sign', authenticateToken, async (req, res) => {
  try {
    const contract = await Contract.findByPk(req.params.id, {
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

    if (contract.status !== 'draft') {
      return res.status(400).json({ error: 'Contract has already been signed or is not in draft status' });
    }

    const bid = contract.Bid;
    const listing = bid.CargoListing || bid.TruckListing;
    const listingOwnerId = listing.userId;
    const bidderId = bid.bidderId;

    // Determine if user is shipper or trucker in this transaction
    const isCargo = !!bid.CargoListing;
    let isShipper, isTrucker;

    if (isCargo) {
      // Cargo listing: shipper owns listing, trucker is bidder
      isShipper = listingOwnerId === req.user.id;
      isTrucker = bidderId === req.user.id;
    } else {
      // Truck listing: trucker owns listing, shipper is bidder
      isTrucker = listingOwnerId === req.user.id;
      isShipper = bidderId === req.user.id;
    }

    if (!isShipper && !isTrucker) {
      return res.status(403).json({ error: 'Not authorized to sign this contract' });
    }

    const signature = `${req.user.name} - ${new Date().toISOString()}`;
    const updates = {};

    if (isShipper) {
      if (contract.shipperSignature) {
        return res.status(400).json({ error: 'Shipper has already signed' });
      }
      updates.shipperSignature = signature;
    } else {
      if (contract.truckerSignature) {
        return res.status(400).json({ error: 'Trucker has already signed' });
      }
      updates.truckerSignature = signature;
    }

    await contract.update(updates);
    await contract.reload();

    // Check if both parties have signed
    if (contract.shipperSignature && contract.truckerSignature) {
      await contract.update({
        status: 'signed',
        signedAt: new Date(),
      });

      // Create shipment for tracking
      const shipment = await Shipment.create({
        contractId: contract.id,
        trackingNumber: generateTrackingNumber(),
        currentLocation: listing.origin,
        status: 'picked_up',
        progress: 0,
      });

      // Update listing status to in_transit
      await listing.update({ status: 'in_transit' });

      // Notify both parties
      const otherUserId = isShipper ? bidderId : listingOwnerId;
      await Notification.create({
        userId: otherUserId,
        type: 'SHIPMENT_UPDATE',
        title: 'Contract Fully Signed!',
        message: `Contract #${contract.contractNumber} is now active. Tracking: ${shipment.trackingNumber}`,
        data: { contractId: contract.id, shipmentId: shipment.id, trackingNumber: shipment.trackingNumber },
      });

      // Emit socket events
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${otherUserId}`).emit('contract-signed', {
          contractId: contract.id,
          trackingNumber: shipment.trackingNumber,
        });
      }
    } else {
      // Notify the other party to sign
      const otherUserId = isShipper ? bidderId : listingOwnerId;
      await Notification.create({
        userId: otherUserId,
        type: 'CONTRACT_READY',
        title: 'Waiting for Your Signature',
        message: `Contract #${contract.contractNumber} needs your signature`,
        data: { contractId: contract.id },
      });
    }

    res.json({
      message: 'Contract signed successfully',
      contract,
      fullyExecuted: !!(contract.shipperSignature && contract.truckerSignature),
    });
  } catch (error) {
    console.error('Sign contract error:', error);
    res.status(500).json({ error: 'Failed to sign contract' });
  }
});

// Complete contract (mark delivery done)
router.put('/:id/complete', authenticateToken, async (req, res) => {
  try {
    const contract = await Contract.findByPk(req.params.id, {
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
        {
          model: Shipment,
          as: 'shipment',
        },
      ],
    });

    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    if (contract.status !== 'signed') {
      return res.status(400).json({ error: 'Contract must be signed before it can be completed' });
    }

    const bid = contract.Bid;
    const listing = bid.CargoListing || bid.TruckListing;

    // Only listing owner (shipper for cargo, trucker for truck) can mark complete
    if (listing.userId !== req.user.id) {
      return res.status(403).json({ error: 'Only the listing owner can mark the contract as complete' });
    }

    // Update contract status
    await contract.update({ status: 'completed' });

    // Update shipment
    if (contract.shipment) {
      await contract.shipment.update({
        status: 'delivered',
        progress: 100,
        currentLocation: listing.destination,
        deliveredAt: new Date(),
      });
    }

    // Update listing status
    const listingStatus = bid.CargoListing ? 'delivered' : 'completed';
    await listing.update({ status: listingStatus });

    // Notify bidder to rate
    await Notification.create({
      userId: bid.bidderId,
      type: 'RATING_REQUEST',
      title: 'Rate Your Experience',
      message: `Please rate your experience for contract #${contract.contractNumber}`,
      data: { contractId: contract.id },
    });

    // Notify listing owner to rate
    await Notification.create({
      userId: listing.userId,
      type: 'RATING_REQUEST',
      title: 'Rate Your Experience',
      message: `Please rate your experience for contract #${contract.contractNumber}`,
      data: { contractId: contract.id },
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`user:${bid.bidderId}`).emit('contract-completed', {
        contractId: contract.id,
      });
    }

    res.json({
      message: 'Contract completed successfully',
      contract,
    });
  } catch (error) {
    console.error('Complete contract error:', error);
    res.status(500).json({ error: 'Failed to complete contract' });
  }
});

// Get contract by bid ID
router.get('/bid/:bidId', authenticateToken, async (req, res) => {
  try {
    const contract = await Contract.findOne({
      where: { bidId: req.params.bidId },
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
                  attributes: ['id', 'name', 'phone', 'email', 'facebookUrl'],
                },
              ],
            },
            {
              model: TruckListing,
              include: [
                {
                  model: User,
                  as: 'trucker',
                  attributes: ['id', 'name', 'phone', 'email', 'facebookUrl'],
                },
              ],
            },
            {
              model: User,
              as: 'bidder',
              attributes: ['id', 'name', 'phone', 'email', 'facebookUrl'],
            },
          ],
        },
        {
          model: Shipment,
          as: 'shipment',
        },
      ],
    });

    if (!contract) {
      return res.status(404).json({ error: 'Contract not found for this bid' });
    }

    res.json({ contract });
  } catch (error) {
    console.error('Get contract by bid error:', error);
    res.status(500).json({ error: 'Failed to get contract' });
  }
});

export default router;
