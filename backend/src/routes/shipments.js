import { Router } from 'express';
import { Op } from 'sequelize';
import {
  Shipment,
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

const router = Router();

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

// Philippine city coordinates for lookup
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
  if (!cityName) return { lat: 7.5, lng: 124.5 };
  const normalized = Object.keys(cityCoordinates).find(
    key => key.toLowerCase().includes(cityName.toLowerCase()) ||
      cityName.toLowerCase().includes(key.toLowerCase().split(' ')[0])
  );
  return cityCoordinates[normalized] || { lat: 7.5, lng: 124.5 };
};

// Helper to get listing data from shipment
const getShipmentWithDetails = async (shipmentId) => {
  return await Shipment.findByPk(shipmentId, {
    include: [
      {
        model: Contract,
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
                    attributes: ['id', 'name', 'phone'],
                  },
                ],
              },
              {
                model: TruckListing,
                include: [
                  {
                    model: User,
                    as: 'trucker',
                    attributes: ['id', 'name', 'phone'],
                  },
                ],
              },
              {
                model: User,
                as: 'bidder',
                attributes: ['id', 'name', 'phone'],
              },
            ],
          },
        ],
      },
    ],
  });
};

// Extract shipper and trucker IDs from shipment
const getParticipants = (shipment) => {
  const bid = shipment.Contract?.Bid;
  if (!bid) return { shipperId: null, truckerId: null };

  const listing = bid.CargoListing || bid.TruckListing;
  const isCargo = !!bid.CargoListing;

  if (isCargo) {
    // Cargo listing: shipper owns listing, trucker is bidder
    return {
      shipperId: listing.userId,
      truckerId: bid.bidderId,
    };
  } else {
    // Truck listing: trucker owns listing, shipper is bidder
    return {
      shipperId: bid.bidderId,
      truckerId: listing.userId,
    };
  }
};

// Get listing origin/destination from shipment
const getRouteInfo = (shipment) => {
  const bid = shipment.Contract?.Bid;
  if (!bid) return null;

  const listing = bid.CargoListing || bid.TruckListing;
  if (!listing) return null;

  return {
    origin: listing.origin,
    destination: listing.destination,
    originLat: listing.originLat,
    originLng: listing.originLng,
    destLat: listing.destLat,
    destLng: listing.destLng,
  };
};

// Get all shipments for the current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    // Get all shipments with related data
    const shipments = await Shipment.findAll({
      include: [
        {
          model: Contract,
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
                      attributes: ['id', 'name'],
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
                      attributes: ['id', 'name'],
                      include: [{ model: TruckerProfile, as: 'truckerProfile' }],
                    },
                  ],
                },
                {
                  model: User,
                  as: 'bidder',
                  attributes: ['id', 'name'],
                },
              ],
            },
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    // Filter to shipments where user is involved
    const userShipments = shipments.filter((shipment) => {
      const { shipperId, truckerId } = getParticipants(shipment);
      return shipperId === req.user.id || truckerId === req.user.id;
    });

    // Apply status filter if provided
    const filteredShipments = status
      ? userShipments.filter((s) => s.status === status)
      : userShipments;

    // Transform shipments for response
    const transformedShipments = filteredShipments
      .slice(parseInt(offset), parseInt(offset) + parseInt(limit))
      .map((shipment) => {
        const { shipperId, truckerId } = getParticipants(shipment);
        const routeInfo = getRouteInfo(shipment);
        const bid = shipment.Contract?.Bid;
        const listing = bid?.CargoListing || bid?.TruckListing;

        return {
          id: shipment.id,
          trackingNumber: shipment.trackingNumber,
          status: shipment.status,
          progress: shipment.progress,
          currentLocation: shipment.currentLocation,
          currentLat: shipment.currentLat,
          currentLng: shipment.currentLng,
          eta: shipment.eta,
          deliveredAt: shipment.deliveredAt,
          createdAt: shipment.createdAt,
          updatedAt: shipment.updatedAt,
          contractId: shipment.Contract?.id,
          contractNumber: shipment.Contract?.contractNumber,
          shipperId,
          truckerId,
          origin: routeInfo?.origin,
          destination: routeInfo?.destination,
          originLat: routeInfo?.originLat,
          originLng: routeInfo?.originLng,
          destLat: routeInfo?.destLat,
          destLng: routeInfo?.destLng,
          listingType: bid?.CargoListing ? 'cargo' : 'truck',
          cargoType: listing?.cargoType || listing?.vehicleType,
          agreedPrice: shipment.Contract?.agreedPrice,
        };
      });

    res.json({
      shipments: transformedShipments,
      total: filteredShipments.length,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    console.error('Get shipments error:', error);
    res.status(500).json({ error: 'Failed to get shipments' });
  }
});

// Get single shipment by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const shipment = await getShipmentWithDetails(req.params.id);

    if (!shipment) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    const { shipperId, truckerId } = getParticipants(shipment);

    // Check user is involved in this shipment
    if (shipperId !== req.user.id && truckerId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to view this shipment' });
    }

    const routeInfo = getRouteInfo(shipment);

    res.json({
      shipment: {
        id: shipment.id,
        trackingNumber: shipment.trackingNumber,
        status: shipment.status,
        progress: shipment.progress,
        currentLocation: shipment.currentLocation,
        currentLat: shipment.currentLat,
        currentLng: shipment.currentLng,
        eta: shipment.eta,
        deliveredAt: shipment.deliveredAt,
        createdAt: shipment.createdAt,
        updatedAt: shipment.updatedAt,
        contract: shipment.Contract,
        shipperId,
        truckerId,
        ...routeInfo,
      },
    });
  } catch (error) {
    console.error('Get shipment error:', error);
    res.status(500).json({ error: 'Failed to get shipment' });
  }
});

// Public tracking lookup by tracking number
router.get('/track/:trackingNumber', async (req, res) => {
  try {
    const shipment = await Shipment.findOne({
      where: { trackingNumber: req.params.trackingNumber },
      include: [
        {
          model: Contract,
          attributes: ['contractNumber'],
          include: [
            {
              model: Bid,
              attributes: [],
              include: [
                { model: CargoListing, attributes: ['origin', 'destination'] },
                { model: TruckListing, attributes: ['origin', 'destination'] },
              ],
            },
          ],
        },
      ],
    });

    if (!shipment) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    const bid = shipment.Contract?.Bid;
    const listing = bid?.CargoListing || bid?.TruckListing;

    // Return limited public info
    res.json({
      trackingNumber: shipment.trackingNumber,
      status: shipment.status,
      progress: shipment.progress,
      currentLocation: shipment.currentLocation,
      origin: listing?.origin,
      destination: listing?.destination,
      eta: shipment.eta,
      deliveredAt: shipment.deliveredAt,
      lastUpdate: shipment.updatedAt,
    });
  } catch (error) {
    console.error('Track shipment error:', error);
    res.status(500).json({ error: 'Failed to track shipment' });
  }
});

// Update shipment location (trucker only)
router.put('/:id/location', authenticateToken, async (req, res) => {
  try {
    const { currentLat, currentLng, currentLocation } = req.body;

    // Validate coordinates
    if (currentLat === undefined || currentLng === undefined) {
      return res.status(400).json({ error: 'Coordinates are required' });
    }

    if (currentLat < -90 || currentLat > 90 || currentLng < -180 || currentLng > 180) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    const shipment = await getShipmentWithDetails(req.params.id);

    if (!shipment) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    const { shipperId, truckerId } = getParticipants(shipment);

    // Only trucker can update location
    if (truckerId !== req.user.id) {
      return res.status(403).json({ error: 'Only the assigned trucker can update location' });
    }

    // Cannot update delivered shipments
    if (shipment.status === 'delivered') {
      return res.status(400).json({ error: 'Cannot update location of delivered shipment' });
    }

    const routeInfo = getRouteInfo(shipment);

    // Calculate progress based on distance
    let progress = shipment.progress;
    let status = shipment.status;

    if (routeInfo && routeInfo.originLat && routeInfo.destLat) {
      const distanceFromOrigin = calculateDistance(
        routeInfo.originLat, routeInfo.originLng,
        currentLat, currentLng
      );
      const totalDistance = calculateDistance(
        routeInfo.originLat, routeInfo.originLng,
        routeInfo.destLat, routeInfo.destLng
      );

      if (totalDistance > 0) {
        progress = Math.min(100, Math.round((distanceFromOrigin / totalDistance) * 100));
      }

      // Auto-update status based on progress
      if (progress > 0 && status === 'picked_up') {
        status = 'in_transit';
      }
    }

    // Get location name if not provided
    const locationName = currentLocation || getLocationName(currentLat, currentLng);

    // Update shipment
    await shipment.update({
      currentLat,
      currentLng,
      currentLocation: locationName,
      progress,
      status,
    });

    // Create notification for shipper
    await Notification.create({
      userId: shipperId,
      type: 'SHIPMENT_UPDATE',
      title: 'Shipment Location Updated',
      message: `Your shipment is now at ${locationName} (${progress}% complete)`,
      data: {
        shipmentId: shipment.id,
        trackingNumber: shipment.trackingNumber,
        currentLocation: locationName,
        progress,
      },
    });

    // Emit socket event to shipper
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${shipperId}`).emit('tracking-update', {
        shipmentId: shipment.id,
        trackingNumber: shipment.trackingNumber,
        currentLocation: locationName,
        currentLat,
        currentLng,
        progress,
        status,
        updatedAt: new Date(),
      });
    }

    res.json({
      message: 'Location updated',
      shipment: {
        id: shipment.id,
        trackingNumber: shipment.trackingNumber,
        status,
        progress,
        currentLocation: locationName,
        currentLat,
        currentLng,
        updatedAt: shipment.updatedAt,
      },
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// Helper to get approximate location name from coordinates
const getLocationName = (lat, lng) => {
  let closestCity = 'Unknown Location';
  let minDistance = Infinity;

  for (const [city, coords] of Object.entries(cityCoordinates)) {
    const distance = calculateDistance(lat, lng, coords.lat, coords.lng);
    if (distance < minDistance) {
      minDistance = distance;
      closestCity = city;
    }
  }

  // If closest city is more than 50km away, show "Near [city]"
  if (minDistance > 50) {
    return `Near ${closestCity}`;
  }
  return closestCity;
};

// Update shipment status
router.put('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;

    if (!['picked_up', 'in_transit', 'delivered'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const shipment = await getShipmentWithDetails(req.params.id);

    if (!shipment) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    const { shipperId, truckerId } = getParticipants(shipment);

    // Only trucker can update status
    if (truckerId !== req.user.id) {
      return res.status(403).json({ error: 'Only the assigned trucker can update status' });
    }

    // Validate status transitions
    const validTransitions = {
      picked_up: ['in_transit'],
      in_transit: ['delivered'],
      delivered: [],
    };

    if (!validTransitions[shipment.status].includes(status)) {
      return res.status(400).json({
        error: `Cannot transition from ${shipment.status} to ${status}`,
      });
    }

    const updates = { status };

    // If marking as delivered
    if (status === 'delivered') {
      updates.deliveredAt = new Date();
      updates.progress = 100;

      const routeInfo = getRouteInfo(shipment);
      if (routeInfo) {
        updates.currentLocation = routeInfo.destination;
        updates.currentLat = routeInfo.destLat;
        updates.currentLng = routeInfo.destLng;
      }
    }

    await shipment.update(updates);

    // Create notification for shipper
    const notificationMessage = status === 'delivered'
      ? `Your shipment has been delivered!`
      : `Your shipment is now ${status.replace('_', ' ')}`;

    await Notification.create({
      userId: shipperId,
      type: 'SHIPMENT_UPDATE',
      title: status === 'delivered' ? 'Shipment Delivered!' : 'Shipment Status Update',
      message: notificationMessage,
      data: {
        shipmentId: shipment.id,
        trackingNumber: shipment.trackingNumber,
        status,
      },
    });

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${shipperId}`).emit('tracking-update', {
        shipmentId: shipment.id,
        trackingNumber: shipment.trackingNumber,
        status,
        progress: updates.progress || shipment.progress,
        currentLocation: updates.currentLocation || shipment.currentLocation,
        deliveredAt: updates.deliveredAt,
        updatedAt: new Date(),
      });
    }

    res.json({
      message: 'Status updated',
      shipment: {
        id: shipment.id,
        trackingNumber: shipment.trackingNumber,
        status,
        progress: updates.progress || shipment.progress,
        currentLocation: updates.currentLocation || shipment.currentLocation,
        deliveredAt: updates.deliveredAt,
      },
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

export default router;
