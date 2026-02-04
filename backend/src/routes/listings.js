import { Router } from 'express';
import { CargoListing, TruckListing, User, ShipperProfile, TruckerProfile, Bid } from '../models/index.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';

const router = Router();

// Philippine city coordinates
const cityCoordinates = {
  'Davao City': { lat: 7.0707, lng: 125.6087 },
  'Cebu City': { lat: 10.3157, lng: 123.8854 },
  'General Santos': { lat: 6.1164, lng: 125.1716 },
  'Cagayan de Oro': { lat: 8.4542, lng: 124.6319 },
  'Manila': { lat: 14.5995, lng: 120.9842 },
  'Zamboanga City': { lat: 6.9214, lng: 122.0790 },
  'Butuan City': { lat: 8.9475, lng: 125.5406 },
  'Tagum City': { lat: 7.4478, lng: 125.8037 },
  'Digos City': { lat: 6.7496, lng: 125.3572 },
  'Cotabato City': { lat: 7.2236, lng: 124.2464 },
  'Iligan City': { lat: 8.2280, lng: 124.2452 },
  'Tacloban City': { lat: 11.2543, lng: 124.9634 },
  'Iloilo City': { lat: 10.7202, lng: 122.5621 },
  'Bacolod City': { lat: 10.6407, lng: 122.9688 },
};

const getCoordinates = (cityName) => {
  const normalized = Object.keys(cityCoordinates).find(
    key => key.toLowerCase().includes(cityName.toLowerCase()) ||
      cityName.toLowerCase().includes(key.toLowerCase().split(' ')[0])
  );
  return cityCoordinates[normalized] || { lat: 7.5, lng: 124.5 };
};

// ============ CARGO LISTINGS ============

// Get all cargo listings
router.get('/cargo', optionalAuth, async (req, res) => {
  try {
    const { status, origin, destination, limit = 50, offset = 0 } = req.query;

    const where = {};
    if (status) where.status = status;
    if (origin) where.origin = { [Op.like]: `%${origin}%` };
    if (destination) where.destination = { [Op.like]: `%${destination}%` };

    const listings = await CargoListing.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'shipper',
          attributes: ['id', 'name', 'phone', 'email', 'facebookUrl'],
          include: [{ model: ShipperProfile, as: 'shipperProfile' }],
        },
        {
          model: Bid,
          as: 'bids',
          include: [
            {
              model: User,
              as: 'bidder',
              attributes: ['id', 'name'],
              include: [{ model: TruckerProfile, as: 'truckerProfile' }],
            },
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json({
      listings: listings.rows,
      total: listings.count,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    console.error('Get cargo listings error:', error);
    res.status(500).json({ error: 'Failed to get cargo listings' });
  }
});

// Get single cargo listing
router.get('/cargo/:id', optionalAuth, async (req, res) => {
  try {
    const listing = await CargoListing.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'shipper',
          attributes: ['id', 'name', 'phone', 'email', 'facebookUrl'],
          include: [{ model: ShipperProfile, as: 'shipperProfile' }],
        },
        {
          model: Bid,
          as: 'bids',
          include: [
            {
              model: User,
              as: 'bidder',
              attributes: ['id', 'name', 'phone', 'email', 'facebookUrl'],
              include: [{ model: TruckerProfile, as: 'truckerProfile' }],
            },
          ],
        },
      ],
    });

    if (!listing) {
      return res.status(404).json({ error: 'Cargo listing not found' });
    }

    res.json({ listing });
  } catch (error) {
    console.error('Get cargo listing error:', error);
    res.status(500).json({ error: 'Failed to get cargo listing' });
  }
});

// Create cargo listing
router.post('/cargo', authenticateToken, async (req, res) => {
  try {
    const {
      origin,
      destination,
      cargoType,
      weight,
      weightUnit = 'tons',
      vehicleNeeded,
      askingPrice,
      description,
      pickupDate,
      photos = [],
    } = req.body;

    if (!origin || !destination || !askingPrice) {
      return res.status(400).json({ error: 'Origin, destination, and asking price are required' });
    }

    const originCoords = getCoordinates(origin);
    const destCoords = getCoordinates(destination);

    const listing = await CargoListing.create({
      userId: req.user.id,
      origin,
      destination,
      originLat: originCoords.lat,
      originLng: originCoords.lng,
      destLat: destCoords.lat,
      destLng: destCoords.lng,
      cargoType,
      weight,
      weightUnit,
      vehicleNeeded,
      askingPrice,
      description,
      pickupDate,
      photos,
    });

    res.status(201).json({
      message: 'Cargo listing created successfully',
      listing,
    });
  } catch (error) {
    console.error('Create cargo listing error:', error);
    res.status(500).json({ error: 'Failed to create cargo listing' });
  }
});

// Update cargo listing
router.put('/cargo/:id', authenticateToken, async (req, res) => {
  try {
    const listing = await CargoListing.findByPk(req.params.id);

    if (!listing) {
      return res.status(404).json({ error: 'Cargo listing not found' });
    }

    if (listing.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to update this listing' });
    }

    const updates = req.body;
    if (updates.origin) {
      const coords = getCoordinates(updates.origin);
      updates.originLat = coords.lat;
      updates.originLng = coords.lng;
    }
    if (updates.destination) {
      const coords = getCoordinates(updates.destination);
      updates.destLat = coords.lat;
      updates.destLng = coords.lng;
    }

    await listing.update(updates);

    res.json({
      message: 'Cargo listing updated successfully',
      listing,
    });
  } catch (error) {
    console.error('Update cargo listing error:', error);
    res.status(500).json({ error: 'Failed to update cargo listing' });
  }
});

// Delete cargo listing
router.delete('/cargo/:id', authenticateToken, async (req, res) => {
  try {
    const listing = await CargoListing.findByPk(req.params.id);

    if (!listing) {
      return res.status(404).json({ error: 'Cargo listing not found' });
    }

    if (listing.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this listing' });
    }

    await listing.destroy();

    res.json({ message: 'Cargo listing deleted successfully' });
  } catch (error) {
    console.error('Delete cargo listing error:', error);
    res.status(500).json({ error: 'Failed to delete cargo listing' });
  }
});

// ============ TRUCK LISTINGS ============

// Get all truck listings
router.get('/trucks', optionalAuth, async (req, res) => {
  try {
    const { status, origin, destination, vehicleType, limit = 50, offset = 0 } = req.query;

    const where = {};
    if (status) where.status = status;

    const listings = await TruckListing.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'trucker',
          attributes: ['id', 'name', 'phone', 'email', 'facebookUrl'],
          include: [{ model: TruckerProfile, as: 'truckerProfile' }],
        },
        {
          model: Bid,
          as: 'bids',
          include: [
            {
              model: User,
              as: 'bidder',
              attributes: ['id', 'name'],
              include: [{ model: ShipperProfile, as: 'shipperProfile' }],
            },
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json({
      listings: listings.rows,
      total: listings.count,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    console.error('Get truck listings error:', error);
    res.status(500).json({ error: 'Failed to get truck listings' });
  }
});

// Get single truck listing
router.get('/trucks/:id', optionalAuth, async (req, res) => {
  try {
    const listing = await TruckListing.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'trucker',
          attributes: ['id', 'name', 'phone', 'email', 'facebookUrl'],
          include: [{ model: TruckerProfile, as: 'truckerProfile' }],
        },
        {
          model: Bid,
          as: 'bids',
          include: [
            {
              model: User,
              as: 'bidder',
              attributes: ['id', 'name', 'phone', 'email', 'facebookUrl'],
              include: [{ model: ShipperProfile, as: 'shipperProfile' }],
            },
          ],
        },
      ],
    });

    if (!listing) {
      return res.status(404).json({ error: 'Truck listing not found' });
    }

    res.json({ listing });
  } catch (error) {
    console.error('Get truck listing error:', error);
    res.status(500).json({ error: 'Failed to get truck listing' });
  }
});

// Create truck listing
router.post('/trucks', authenticateToken, async (req, res) => {
  try {
    const {
      origin,
      destination,
      vehicleType,
      capacity,
      capacityUnit = 'tons',
      plateNumber,
      askingPrice,
      description,
      availableDate,
      departureTime,
    } = req.body;

    if (!origin || !destination || !askingPrice) {
      return res.status(400).json({ error: 'Origin, destination, and asking price are required' });
    }

    const originCoords = getCoordinates(origin);
    const destCoords = getCoordinates(destination);

    const listing = await TruckListing.create({
      userId: req.user.id,
      origin,
      destination,
      originLat: originCoords.lat,
      originLng: originCoords.lng,
      destLat: destCoords.lat,
      destLng: destCoords.lng,
      vehicleType,
      capacity,
      capacityUnit,
      plateNumber,
      askingPrice,
      description,
      availableDate,
      departureTime,
    });

    res.status(201).json({
      message: 'Truck listing created successfully',
      listing,
    });
  } catch (error) {
    console.error('Create truck listing error:', error);
    res.status(500).json({ error: 'Failed to create truck listing' });
  }
});

// Update truck listing
router.put('/trucks/:id', authenticateToken, async (req, res) => {
  try {
    const listing = await TruckListing.findByPk(req.params.id);

    if (!listing) {
      return res.status(404).json({ error: 'Truck listing not found' });
    }

    if (listing.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to update this listing' });
    }

    const updates = req.body;
    if (updates.origin) {
      const coords = getCoordinates(updates.origin);
      updates.originLat = coords.lat;
      updates.originLng = coords.lng;
    }
    if (updates.destination) {
      const coords = getCoordinates(updates.destination);
      updates.destLat = coords.lat;
      updates.destLng = coords.lng;
    }

    await listing.update(updates);

    res.json({
      message: 'Truck listing updated successfully',
      listing,
    });
  } catch (error) {
    console.error('Update truck listing error:', error);
    res.status(500).json({ error: 'Failed to update truck listing' });
  }
});

// Delete truck listing
router.delete('/trucks/:id', authenticateToken, async (req, res) => {
  try {
    const listing = await TruckListing.findByPk(req.params.id);

    if (!listing) {
      return res.status(404).json({ error: 'Truck listing not found' });
    }

    if (listing.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this listing' });
    }

    await listing.destroy();

    res.json({ message: 'Truck listing deleted successfully' });
  } catch (error) {
    console.error('Delete truck listing error:', error);
    res.status(500).json({ error: 'Failed to delete truck listing' });
  }
});

export default router;
