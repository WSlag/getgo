import { Router } from 'express';
import admin from 'firebase-admin';
import { db } from '../config/firestore.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

const cityCoordinates = {
  'Davao City': { lat: 7.0707, lng: 125.6087 },
  'Cebu City': { lat: 10.3157, lng: 123.8854 },
  'General Santos': { lat: 6.1164, lng: 125.1716 },
  'Cagayan de Oro': { lat: 8.4542, lng: 124.6319 },
  Manila: { lat: 14.5995, lng: 120.9842 },
  'Zamboanga City': { lat: 6.9214, lng: 122.079 },
  'Butuan City': { lat: 8.9475, lng: 125.5406 },
  'Tagum City': { lat: 7.4478, lng: 125.8037 },
  'Digos City': { lat: 6.7496, lng: 125.3572 },
  'Cotabato City': { lat: 7.2236, lng: 124.2464 },
  'Iligan City': { lat: 8.228, lng: 124.2452 },
  'Tacloban City': { lat: 11.2543, lng: 124.9634 },
  'Iloilo City': { lat: 10.7202, lng: 122.5621 },
  'Bacolod City': { lat: 10.6407, lng: 122.9688 },
};

const toDate = (v) => {
  if (!v) return null;
  if (v.toDate && typeof v.toDate === 'function') return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const getLocationName = (lat, lng) => {
  let closestCity = 'Unknown Location';
  let minDistance = Number.POSITIVE_INFINITY;

  for (const [city, coords] of Object.entries(cityCoordinates)) {
    const distance = calculateDistance(lat, lng, coords.lat, coords.lng);
    if (distance < minDistance) {
      minDistance = distance;
      closestCity = city;
    }
  }

  return minDistance > 50 ? `Near ${closestCity}` : closestCity;
};

const contractCache = new Map();
const getContract = async (contractId) => {
  if (!contractId) return null;
  if (contractCache.has(contractId)) return contractCache.get(contractId);
  const doc = await db.collection('contracts').doc(contractId).get();
  const contract = doc.exists ? { id: doc.id, ...doc.data() } : null;
  contractCache.set(contractId, contract);
  return contract;
};

const getParticipants = (shipment, contract) => {
  let shipperId = shipment.shipperId || null;
  let truckerId = shipment.truckerId || null;

  if ((!shipperId || !truckerId) && contract) {
    if (contract.listingType === 'cargo') {
      shipperId = contract.listingOwnerId;
      truckerId = contract.bidderId;
    } else if (contract.listingType === 'truck') {
      shipperId = contract.bidderId;
      truckerId = contract.listingOwnerId;
    }
  }

  return { shipperId, truckerId };
};

const getRouteInfo = (shipment, contract) => {
  return {
    origin: shipment.origin || contract?.pickupCity || null,
    destination: shipment.destination || contract?.deliveryCity || null,
    originLat: shipment.originLat ?? null,
    originLng: shipment.originLng ?? null,
    destLat: shipment.destLat ?? null,
    destLng: shipment.destLng ?? null,
  };
};

const loadUserShipments = async (userId) => {
  const [byParticipant, byShipper, byTrucker] = await Promise.all([
    db.collection('shipments').where('participantIds', 'array-contains', userId).limit(200).get(),
    db.collection('shipments').where('shipperId', '==', userId).limit(200).get(),
    db.collection('shipments').where('truckerId', '==', userId).limit(200).get(),
  ]);

  const map = new Map();
  [byParticipant, byShipper, byTrucker].forEach((snap) => {
    snap.docs.forEach((doc) => {
      map.set(doc.id, { id: doc.id, ...doc.data() });
    });
  });

  return [...map.values()];
};

const canAccessShipment = (shipment, userId, participants, contract) => {
  if (!shipment || !userId) return false;

  const participantIds = shipment.participantIds || contract?.participantIds || [];
  if (participantIds.includes(userId)) return true;

  return participants.shipperId === userId || participants.truckerId === userId;
};

const formatShipment = (shipment, contract, participants) => {
  const route = getRouteInfo(shipment, contract);

  return {
    id: shipment.id,
    trackingNumber: shipment.trackingNumber,
    status: shipment.status,
    progress: shipment.progress ?? 0,
    currentLocation: shipment.currentLocation || route.origin,
    currentLat: shipment.currentLat ?? null,
    currentLng: shipment.currentLng ?? null,
    eta: shipment.eta || null,
    deliveredAt: toDate(shipment.deliveredAt),
    createdAt: toDate(shipment.createdAt),
    updatedAt: toDate(shipment.updatedAt),
    contractId: shipment.contractId || contract?.id || null,
    contractNumber: contract?.contractNumber || null,
    agreedPrice: contract?.agreedPrice || null,
    listingType: contract?.listingType || null,
    shipperId: participants.shipperId,
    truckerId: participants.truckerId,
    ...route,
  };
};

router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { status, limit = 50, offset = 0 } = req.query;

    const shipments = await loadUserShipments(userId);
    const enriched = await Promise.all(
      shipments.map(async (shipment) => {
        const contract = await getContract(shipment.contractId);
        const participants = getParticipants(shipment, contract);
        return { shipment, contract, participants };
      })
    );

    let filtered = enriched.filter(({ shipment, contract, participants }) =>
      canAccessShipment(shipment, userId, participants, contract)
    );

    if (status) {
      filtered = filtered.filter(({ shipment }) => shipment.status === status);
    }

    filtered.sort((a, b) => (toDate(b.shipment.createdAt)?.getTime() || 0) - (toDate(a.shipment.createdAt)?.getTime() || 0));

    const safeLimit = Math.max(1, Number(limit));
    const safeOffset = Math.max(0, Number(offset));

    res.json({
      shipments: filtered.slice(safeOffset, safeOffset + safeLimit).map(({ shipment, contract, participants }) => formatShipment(shipment, contract, participants)),
      total: filtered.length,
      limit: safeLimit,
      offset: safeOffset,
    });
  } catch (error) {
    console.error('Get shipments error:', error);
    res.status(500).json({ error: 'Failed to get shipments' });
  }
});

router.get('/track/:trackingNumber', async (req, res) => {
  try {
    const snapshot = await db.collection('shipments').where('trackingNumber', '==', req.params.trackingNumber).limit(1).get();
    if (snapshot.empty) return res.status(404).json({ error: 'Shipment not found' });

    const shipment = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    const contract = await getContract(shipment.contractId);
    const route = getRouteInfo(shipment, contract);

    res.json({
      trackingNumber: shipment.trackingNumber,
      status: shipment.status,
      progress: shipment.progress ?? 0,
      currentLocation: shipment.currentLocation || route.origin,
      origin: route.origin,
      destination: route.destination,
      eta: shipment.eta || null,
      deliveredAt: toDate(shipment.deliveredAt),
      lastUpdate: toDate(shipment.updatedAt),
    });
  } catch (error) {
    console.error('Track shipment error:', error);
    res.status(500).json({ error: 'Failed to track shipment' });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const doc = await db.collection('shipments').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Shipment not found' });

    const shipment = { id: doc.id, ...doc.data() };
    const contract = await getContract(shipment.contractId);
    const participants = getParticipants(shipment, contract);

    if (!canAccessShipment(shipment, req.user.uid, participants, contract)) {
      return res.status(403).json({ error: 'Not authorized to view this shipment' });
    }

    res.json({ shipment: formatShipment(shipment, contract, participants), contract });
  } catch (error) {
    console.error('Get shipment error:', error);
    res.status(500).json({ error: 'Failed to get shipment' });
  }
});
router.put('/:id/location', authenticateToken, async (req, res) => {
  try {
    const { currentLat, currentLng, currentLocation } = req.body;
    if (currentLat === undefined || currentLng === undefined) {
      return res.status(400).json({ error: 'Coordinates are required' });
    }

    const lat = Number(currentLat);
    const lng = Number(currentLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    const ref = db.collection('shipments').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Shipment not found' });

    const shipment = { id: doc.id, ...doc.data() };
    const contract = await getContract(shipment.contractId);
    const participants = getParticipants(shipment, contract);

    if (participants.truckerId !== req.user.uid) {
      return res.status(403).json({ error: 'Only the assigned trucker can update location' });
    }

    if (shipment.status === 'delivered') {
      return res.status(400).json({ error: 'Cannot update location of delivered shipment' });
    }

    const route = getRouteInfo(shipment, contract);
    let progress = Number(shipment.progress || 0);
    let status = shipment.status || 'picked_up';

    if ([route.originLat, route.originLng, route.destLat, route.destLng].every(Number.isFinite)) {
      const traveled = calculateDistance(route.originLat, route.originLng, lat, lng);
      const total = calculateDistance(route.originLat, route.originLng, route.destLat, route.destLng);
      if (total > 0) progress = Math.min(100, Math.round((traveled / total) * 100));
      if (progress > 0 && status === 'picked_up') status = 'in_transit';
    }

    const location = currentLocation || getLocationName(lat, lng);

    await ref.update({
      currentLat: lat,
      currentLng: lng,
      currentLocation: location,
      progress,
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    if (participants.shipperId) {
      await db.collection('users').doc(participants.shipperId).collection('notifications').doc().set({
        type: 'SHIPMENT_UPDATE',
        title: 'Shipment Location Updated',
        message: `Your shipment is now at ${location} (${progress}% complete)`,
        data: {
          shipmentId: shipment.id,
          trackingNumber: shipment.trackingNumber,
          currentLocation: location,
          progress,
        },
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    const io = req.app.get('io');
    if (io && participants.shipperId) {
      io.to(`user:${participants.shipperId}`).emit('tracking-update', {
        shipmentId: shipment.id,
        trackingNumber: shipment.trackingNumber,
        currentLocation: location,
        currentLat: lat,
        currentLng: lng,
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
        currentLocation: location,
        currentLat: lat,
        currentLng: lng,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

router.put('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['picked_up', 'in_transit', 'delivered'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const ref = db.collection('shipments').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Shipment not found' });

    const shipment = { id: doc.id, ...doc.data() };
    const contract = await getContract(shipment.contractId);
    const participants = getParticipants(shipment, contract);

    if (participants.truckerId !== req.user.uid) {
      return res.status(403).json({ error: 'Only the assigned trucker can update status' });
    }

    const currentStatus = shipment.status || 'picked_up';
    const transitions = {
      picked_up: ['in_transit'],
      in_transit: ['delivered'],
      delivered: [],
    };

    if (!transitions[currentStatus].includes(status)) {
      return res.status(400).json({ error: `Cannot transition from ${currentStatus} to ${status}` });
    }

    const route = getRouteInfo(shipment, contract);
    const updates = {
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (status === 'delivered') {
      updates.progress = 100;
      updates.deliveredAt = admin.firestore.FieldValue.serverTimestamp();
      if (route.destination) updates.currentLocation = route.destination;
      if (Number.isFinite(route.destLat)) updates.currentLat = route.destLat;
      if (Number.isFinite(route.destLng)) updates.currentLng = route.destLng;
    }

    await ref.update(updates);

    if (participants.shipperId) {
      await db.collection('users').doc(participants.shipperId).collection('notifications').doc().set({
        type: 'SHIPMENT_UPDATE',
        title: status === 'delivered' ? 'Shipment Delivered!' : 'Shipment Status Update',
        message: status === 'delivered' ? 'Your shipment has been delivered!' : `Your shipment is now ${status.replace('_', ' ')}`,
        data: {
          shipmentId: shipment.id,
          trackingNumber: shipment.trackingNumber,
          status,
        },
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    const io = req.app.get('io');
    if (io && participants.shipperId) {
      io.to(`user:${participants.shipperId}`).emit('tracking-update', {
        shipmentId: shipment.id,
        trackingNumber: shipment.trackingNumber,
        status,
        progress: status === 'delivered' ? 100 : shipment.progress,
        currentLocation: status === 'delivered' ? (route.destination || shipment.currentLocation) : shipment.currentLocation,
        updatedAt: new Date(),
      });
    }

    res.json({
      message: 'Status updated',
      shipment: {
        id: shipment.id,
        trackingNumber: shipment.trackingNumber,
        status,
        progress: status === 'delivered' ? 100 : shipment.progress,
        currentLocation: status === 'delivered' ? (route.destination || shipment.currentLocation) : shipment.currentLocation,
      },
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

export default router;
