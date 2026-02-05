import { Router } from 'express';
import { Op } from 'sequelize';
import { CargoListing, TruckListing, User, ShipperProfile, TruckerProfile, Bid, Contract } from '../models/index.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';

// Haversine formula to calculate distance between two coordinates (in km)
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Helper function to mask contact info
const maskContactInfo = (user, showContact = false) => {
  if (!user) return user;

  const masked = { ...user.toJSON ? user.toJSON() : user };

  if (!showContact) {
    // Mask phone number (show only last 4 digits)
    if (masked.phone) {
      masked.phone = '****' + masked.phone.slice(-4);
      masked.phoneMasked = true;
    }
    // Hide email completely
    if (masked.email) {
      masked.email = '****@****';
      masked.emailMasked = true;
    }
    // Hide Facebook URL
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

  const contracts = await Contract.findAll({
    where: { status: { [require('sequelize').Op.in]: ['signed', 'completed'] } },
    include: [
      {
        model: Bid,
        include: [
          { model: CargoListing },
          { model: TruckListing },
        ],
      },
    ],
  });

  return contracts.some((contract) => {
    const bid = contract.Bid;
    if (!bid) return false;

    const listing = bid.CargoListing || bid.TruckListing;
    if (!listing) return false;

    // Check if both users are involved in this contract
    const involvedUsers = [listing.userId, bid.bidderId];
    return involvedUsers.includes(userId1) && involvedUsers.includes(userId2);
  });
};

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

// Get all cargo listings with advanced filtering
router.get('/cargo', optionalAuth, async (req, res) => {
  try {
    const {
      status,
      origin,
      destination,
      minPrice,
      maxPrice,
      minWeight,
      maxWeight,
      vehicleType,
      cargoType,
      pickupDateFrom,
      pickupDateTo,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      limit = 50,
      offset = 0,
    } = req.query;

    const where = {};

    // Status filter
    if (status) {
      where.status = status;
    } else {
      // Default to open listings
      where.status = 'open';
    }

    // Location filters (partial match)
    if (origin) where.origin = { [Op.like]: `%${origin}%` };
    if (destination) where.destination = { [Op.like]: `%${destination}%` };

    // Price range filter
    if (minPrice || maxPrice) {
      where.askingPrice = {};
      if (minPrice) where.askingPrice[Op.gte] = parseFloat(minPrice);
      if (maxPrice) where.askingPrice[Op.lte] = parseFloat(maxPrice);
    }

    // Weight range filter
    if (minWeight || maxWeight) {
      where.weight = {};
      if (minWeight) where.weight[Op.gte] = parseFloat(minWeight);
      if (maxWeight) where.weight[Op.lte] = parseFloat(maxWeight);
    }

    // Vehicle type filter
    if (vehicleType) where.vehicleNeeded = { [Op.like]: `%${vehicleType}%` };

    // Cargo type filter
    if (cargoType) where.cargoType = { [Op.like]: `%${cargoType}%` };

    // Date range filter
    if (pickupDateFrom || pickupDateTo) {
      where.pickupDate = {};
      if (pickupDateFrom) where.pickupDate[Op.gte] = new Date(pickupDateFrom);
      if (pickupDateTo) where.pickupDate[Op.lte] = new Date(pickupDateTo);
    }

    // Sorting options
    const validSortFields = ['createdAt', 'askingPrice', 'weight', 'pickupDate'];
    const orderField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const orderDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

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
      order: [[orderField, orderDirection]],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    // Apply contact masking to listings
    const currentUserId = req.user?.id;
    const maskedListings = await Promise.all(
      listings.rows.map(async (listing) => {
        const listingJson = listing.toJSON();
        // Check if current user has a signed contract with the shipper
        const canSeeContact = currentUserId && (
          currentUserId === listingJson.shipper?.id ||
          await hasSignedContract(currentUserId, listingJson.shipper?.id)
        );
        if (listingJson.shipper) {
          listingJson.shipper = maskContactInfo(listingJson.shipper, canSeeContact);
        }

        // Calculate route distance if coordinates exist
        if (listingJson.originLat && listingJson.originLng && listingJson.destLat && listingJson.destLng) {
          listingJson.routeDistance = Math.round(calculateDistance(
            listingJson.originLat, listingJson.originLng,
            listingJson.destLat, listingJson.destLng
          ));
        }

        return listingJson;
      })
    );

    res.json({
      listings: maskedListings,
      total: listings.count,
      limit: parseInt(limit),
      offset: parseInt(offset),
      filters: { status, origin, destination, minPrice, maxPrice, minWeight, maxWeight, vehicleType, cargoType },
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

    // Apply contact masking
    const currentUserId = req.user?.id;
    const listingJson = listing.toJSON();

    // Check if current user can see shipper contact
    const canSeeShipperContact = currentUserId && (
      currentUserId === listingJson.shipper?.id ||
      await hasSignedContract(currentUserId, listingJson.shipper?.id)
    );
    if (listingJson.shipper) {
      listingJson.shipper = maskContactInfo(listingJson.shipper, canSeeShipperContact);
    }

    // Mask bidder contacts too
    if (listingJson.bids) {
      listingJson.bids = await Promise.all(
        listingJson.bids.map(async (bid) => {
          const canSeeBidderContact = currentUserId && (
            currentUserId === bid.bidder?.id ||
            currentUserId === listingJson.userId ||
            await hasSignedContract(currentUserId, bid.bidder?.id)
          );
          if (bid.bidder) {
            bid.bidder = maskContactInfo(bid.bidder, canSeeBidderContact);
          }
          return bid;
        })
      );
    }

    res.json({ listing: listingJson });
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

// Get all truck listings with advanced filtering
router.get('/trucks', optionalAuth, async (req, res) => {
  try {
    const {
      status,
      origin,
      destination,
      vehicleType,
      minPrice,
      maxPrice,
      minCapacity,
      maxCapacity,
      availableDateFrom,
      availableDateTo,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      limit = 50,
      offset = 0,
    } = req.query;

    const where = {};

    // Status filter
    if (status) {
      where.status = status;
    } else {
      // Default to open listings
      where.status = 'open';
    }

    // Location filters (partial match)
    if (origin) where.origin = { [Op.like]: `%${origin}%` };
    if (destination) where.destination = { [Op.like]: `%${destination}%` };

    // Vehicle type filter
    if (vehicleType) where.vehicleType = { [Op.like]: `%${vehicleType}%` };

    // Price range filter
    if (minPrice || maxPrice) {
      where.askingPrice = {};
      if (minPrice) where.askingPrice[Op.gte] = parseFloat(minPrice);
      if (maxPrice) where.askingPrice[Op.lte] = parseFloat(maxPrice);
    }

    // Capacity range filter
    if (minCapacity || maxCapacity) {
      where.capacity = {};
      if (minCapacity) where.capacity[Op.gte] = parseFloat(minCapacity);
      if (maxCapacity) where.capacity[Op.lte] = parseFloat(maxCapacity);
    }

    // Date range filter
    if (availableDateFrom || availableDateTo) {
      where.availableDate = {};
      if (availableDateFrom) where.availableDate[Op.gte] = new Date(availableDateFrom);
      if (availableDateTo) where.availableDate[Op.lte] = new Date(availableDateTo);
    }

    // Sorting options
    const validSortFields = ['createdAt', 'askingPrice', 'capacity', 'availableDate'];
    const orderField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const orderDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

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
      order: [[orderField, orderDirection]],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    // Apply contact masking to listings
    const currentUserId = req.user?.id;
    const maskedListings = await Promise.all(
      listings.rows.map(async (listing) => {
        const listingJson = listing.toJSON();
        // Check if current user has a signed contract with the trucker
        const canSeeContact = currentUserId && (
          currentUserId === listingJson.trucker?.id ||
          await hasSignedContract(currentUserId, listingJson.trucker?.id)
        );
        if (listingJson.trucker) {
          listingJson.trucker = maskContactInfo(listingJson.trucker, canSeeContact);
        }

        // Calculate route distance if coordinates exist
        if (listingJson.originLat && listingJson.originLng && listingJson.destLat && listingJson.destLng) {
          listingJson.routeDistance = Math.round(calculateDistance(
            listingJson.originLat, listingJson.originLng,
            listingJson.destLat, listingJson.destLng
          ));
        }

        return listingJson;
      })
    );

    res.json({
      listings: maskedListings,
      total: listings.count,
      limit: parseInt(limit),
      offset: parseInt(offset),
      filters: { status, origin, destination, vehicleType, minPrice, maxPrice, minCapacity, maxCapacity },
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

    // Apply contact masking
    const currentUserId = req.user?.id;
    const listingJson = listing.toJSON();

    // Check if current user can see trucker contact
    const canSeeTruckerContact = currentUserId && (
      currentUserId === listingJson.trucker?.id ||
      await hasSignedContract(currentUserId, listingJson.trucker?.id)
    );
    if (listingJson.trucker) {
      listingJson.trucker = maskContactInfo(listingJson.trucker, canSeeTruckerContact);
    }

    // Mask bidder contacts too
    if (listingJson.bids) {
      listingJson.bids = await Promise.all(
        listingJson.bids.map(async (bid) => {
          const canSeeBidderContact = currentUserId && (
            currentUserId === bid.bidder?.id ||
            currentUserId === listingJson.userId ||
            await hasSignedContract(currentUserId, bid.bidder?.id)
          );
          if (bid.bidder) {
            bid.bidder = maskContactInfo(bid.bidder, canSeeBidderContact);
          }
          return bid;
        })
      );
    }

    res.json({ listing: listingJson });
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

// ============ ROUTE OPTIMIZATION / BACKLOAD FINDER ============

// Find compatible routes for backload opportunities
router.get('/optimize/backload', authenticateToken, async (req, res) => {
  try {
    const {
      origin,
      destination,
      originLat,
      originLng,
      destLat,
      destLng,
      maxDetourKm = 50,
      type = 'both', // 'cargo', 'truck', or 'both'
      limit = 20,
    } = req.query;

    if (!origin && !originLat) {
      return res.status(400).json({ error: 'Origin location is required' });
    }

    // Get coordinates from city name if not provided directly
    let originCoords = { lat: parseFloat(originLat), lng: parseFloat(originLng) };
    let destCoords = destLat ? { lat: parseFloat(destLat), lng: parseFloat(destLng) } : null;

    if (!originLat && origin) {
      originCoords = getCoordinates(origin);
    }
    if (!destLat && destination) {
      destCoords = getCoordinates(destination);
    }

    const results = {
      cargo: [],
      trucks: [],
      recommendations: [],
    };

    // Find cargo listings with compatible routes
    if (type === 'both' || type === 'cargo') {
      const cargoListings = await CargoListing.findAll({
        where: { status: 'open' },
        include: [
          {
            model: User,
            as: 'shipper',
            attributes: ['id', 'name'],
            include: [{ model: ShipperProfile, as: 'shipperProfile' }],
          },
        ],
        order: [['createdAt', 'DESC']],
        limit: 100,
      });

      // Filter by route compatibility
      const compatibleCargo = cargoListings
        .map((listing) => {
          const listingJson = listing.toJSON();

          // Calculate distances
          const originDistance = listingJson.originLat
            ? calculateDistance(originCoords.lat, originCoords.lng, listingJson.originLat, listingJson.originLng)
            : Infinity;

          const destDistance = destCoords && listingJson.destLat
            ? calculateDistance(destCoords.lat, destCoords.lng, listingJson.destLat, listingJson.destLng)
            : null;

          // Route distance of the listing
          const routeDistance = listingJson.originLat && listingJson.destLat
            ? calculateDistance(listingJson.originLat, listingJson.originLng, listingJson.destLat, listingJson.destLng)
            : 0;

          // Calculate compatibility score (lower is better)
          let compatibilityScore = originDistance;
          if (destDistance !== null) {
            compatibilityScore = (originDistance + destDistance) / 2;
          }

          return {
            ...listingJson,
            originDistance: Math.round(originDistance),
            destDistance: destDistance !== null ? Math.round(destDistance) : null,
            routeDistance: Math.round(routeDistance),
            compatibilityScore: Math.round(compatibilityScore),
            isBackloadMatch: originDistance <= parseFloat(maxDetourKm),
          };
        })
        .filter((item) => item.isBackloadMatch)
        .sort((a, b) => a.compatibilityScore - b.compatibilityScore)
        .slice(0, parseInt(limit));

      results.cargo = compatibleCargo;
    }

    // Find truck listings with compatible routes
    if (type === 'both' || type === 'truck') {
      const truckListings = await TruckListing.findAll({
        where: { status: 'open' },
        include: [
          {
            model: User,
            as: 'trucker',
            attributes: ['id', 'name'],
            include: [{ model: TruckerProfile, as: 'truckerProfile' }],
          },
        ],
        order: [['createdAt', 'DESC']],
        limit: 100,
      });

      // Filter by route compatibility
      const compatibleTrucks = truckListings
        .map((listing) => {
          const listingJson = listing.toJSON();

          // Calculate distances
          const originDistance = listingJson.originLat
            ? calculateDistance(originCoords.lat, originCoords.lng, listingJson.originLat, listingJson.originLng)
            : Infinity;

          const destDistance = destCoords && listingJson.destLat
            ? calculateDistance(destCoords.lat, destCoords.lng, listingJson.destLat, listingJson.destLng)
            : null;

          // Route distance of the listing
          const routeDistance = listingJson.originLat && listingJson.destLat
            ? calculateDistance(listingJson.originLat, listingJson.originLng, listingJson.destLat, listingJson.destLng)
            : 0;

          // Calculate compatibility score
          let compatibilityScore = originDistance;
          if (destDistance !== null) {
            compatibilityScore = (originDistance + destDistance) / 2;
          }

          return {
            ...listingJson,
            originDistance: Math.round(originDistance),
            destDistance: destDistance !== null ? Math.round(destDistance) : null,
            routeDistance: Math.round(routeDistance),
            compatibilityScore: Math.round(compatibilityScore),
            isBackloadMatch: originDistance <= parseFloat(maxDetourKm),
          };
        })
        .filter((item) => item.isBackloadMatch)
        .sort((a, b) => a.compatibilityScore - b.compatibilityScore)
        .slice(0, parseInt(limit));

      results.trucks = compatibleTrucks;
    }

    // Generate recommendations
    const allMatches = [
      ...results.cargo.map((c) => ({ ...c, listingType: 'cargo' })),
      ...results.trucks.map((t) => ({ ...t, listingType: 'truck' })),
    ].sort((a, b) => a.compatibilityScore - b.compatibilityScore);

    results.recommendations = allMatches.slice(0, 5).map((match) => ({
      id: match.id,
      type: match.listingType,
      route: `${match.origin} → ${match.destination}`,
      price: match.askingPrice,
      originDistance: match.originDistance,
      destDistance: match.destDistance,
      reason: match.originDistance <= 10
        ? 'Perfect match - same origin area'
        : match.originDistance <= 30
          ? 'Good match - nearby origin'
          : 'Reasonable detour',
    }));

    res.json({
      origin: origin || `${originCoords.lat}, ${originCoords.lng}`,
      destination: destination || (destCoords ? `${destCoords.lat}, ${destCoords.lng}` : null),
      maxDetourKm: parseFloat(maxDetourKm),
      totalMatches: results.cargo.length + results.trucks.length,
      ...results,
    });
  } catch (error) {
    console.error('Route optimization error:', error);
    res.status(500).json({ error: 'Failed to find backload opportunities' });
  }
});

// Get route suggestions based on popular routes
router.get('/optimize/popular-routes', async (req, res) => {
  try {
    // Aggregate popular routes from cargo listings
    const cargoRoutes = await CargoListing.findAll({
      attributes: ['origin', 'destination'],
      where: { status: { [Op.in]: ['open', 'contracted', 'delivered'] } },
      limit: 500,
    });

    // Count route frequencies
    const routeCounts = {};
    cargoRoutes.forEach((listing) => {
      const route = `${listing.origin}|${listing.destination}`;
      routeCounts[route] = (routeCounts[route] || 0) + 1;
    });

    // Sort by frequency
    const popularRoutes = Object.entries(routeCounts)
      .map(([route, count]) => {
        const [origin, destination] = route.split('|');
        const originCoords = getCoordinates(origin);
        const destCoords = getCoordinates(destination);
        const distance = calculateDistance(
          originCoords.lat, originCoords.lng,
          destCoords.lat, destCoords.lng
        );
        return { origin, destination, count, distance: Math.round(distance) };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    res.json({ popularRoutes });
  } catch (error) {
    console.error('Popular routes error:', error);
    res.status(500).json({ error: 'Failed to get popular routes' });
  }
});

export default router;
