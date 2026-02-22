/**
 * Shipment Management Cloud Functions
 * Handles shipment tracking and location updates
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Haversine formula to calculate distance between two coordinates (in km)
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

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

function getCoordinates(cityName) {
  if (!cityName) return { lat: 7.5, lng: 124.5 };
  const normalized = Object.keys(cityCoordinates).find(
    key => key.toLowerCase().includes(cityName.toLowerCase()) ||
      cityName.toLowerCase().includes(key.toLowerCase().split(' ')[0])
  );
  return cityCoordinates[normalized] || { lat: 7.5, lng: 124.5 };
}

function resolveShipmentActors(contract, shipment) {
  const isCargo = contract.listingType === 'cargo';
  const shipperId = shipment.shipperId || (isCargo ? contract.listingOwnerId : contract.bidderId);
  const truckerId = shipment.truckerId || (isCargo ? contract.bidderId : contract.listingOwnerId);
  return { shipperId, truckerId };
}

/**
 * Update Shipment Location
 */
exports.updateShipmentLocation = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { shipmentId, currentLocation } = data;
  const currentLat = Number(data?.currentLat);
  const currentLng = Number(data?.currentLng);
  const userId = context.auth.uid;

  if (!shipmentId) {
    throw new functions.https.HttpsError('invalid-argument', 'Shipment ID is required');
  }

  if (!Number.isFinite(currentLat) || !Number.isFinite(currentLng)) {
    throw new functions.https.HttpsError('invalid-argument', 'Coordinates are required');
  }

  if (currentLat < -90 || currentLat > 90 || currentLng < -180 || currentLng > 180) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid coordinates');
  }

  const db = admin.firestore();
  const shipmentRef = db.collection('shipments').doc(shipmentId);

  const result = await db.runTransaction(async (tx) => {
    const shipmentDoc = await tx.get(shipmentRef);
    if (!shipmentDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Shipment not found');
    }

    const shipment = { id: shipmentDoc.id, ...shipmentDoc.data() };
    if (!shipment.contractId) {
      throw new functions.https.HttpsError('failed-precondition', 'Shipment is missing contract reference');
    }

    const contractRef = db.collection('contracts').doc(shipment.contractId);
    const contractDoc = await tx.get(contractRef);
    if (!contractDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Contract not found');
    }

    const contract = contractDoc.data();
    const { shipperId, truckerId } = resolveShipmentActors(contract, shipment);

    if (userId !== truckerId) {
      throw new functions.https.HttpsError('permission-denied', 'Only the assigned trucker can update location');
    }

    const rawStatus = shipment.status || 'pending_pickup';
    const currentStatus = rawStatus === 'pending' ? 'pending_pickup' : rawStatus;
    if (currentStatus === 'delivered') {
      throw new functions.https.HttpsError('failed-precondition', 'Cannot update location of delivered shipment');
    }
    if (currentStatus === 'pending_pickup') {
      throw new functions.https.HttpsError('failed-precondition', 'Pickup must be confirmed before location updates');
    }

    const originCoords = getCoordinates(shipment.origin || contract.pickupAddress);
    const destCoords = getCoordinates(shipment.destination || contract.deliveryAddress);

    const distanceFromOrigin = calculateDistance(
      originCoords.lat, originCoords.lng,
      currentLat, currentLng
    );
    const totalDistance = calculateDistance(
      originCoords.lat, originCoords.lng,
      destCoords.lat, destCoords.lng
    );

    let progress = Number(shipment.progress || 0);
    if (totalDistance > 0) {
      progress = Math.min(100, Math.round((distanceFromOrigin / totalDistance) * 100));
    }

    let nextStatus = currentStatus;
    if (nextStatus === 'picked_up' && progress > 0) {
      nextStatus = 'in_transit';
    }

    const updateData = {
      currentLat,
      currentLng,
      currentLocation: currentLocation || shipment.currentLocation || 'Unknown',
      progress,
      status: nextStatus,
      shipperId,
      truckerId,
      updatedBy: userId,
      updatedByRole: 'trucker',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    tx.update(shipmentRef, updateData);

    return {
      id: shipmentId,
      currentLat,
      currentLng,
      currentLocation: updateData.currentLocation,
      progress,
      status: nextStatus,
      shipperId,
      truckerId,
    };
  });

  return {
    message: 'Location updated',
    shipment: result,
  };
});

/**
 * Update Shipment Status
 */
exports.updateShipmentStatus = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { shipmentId, status } = data;
  const userId = context.auth.uid;

  if (!shipmentId || !status) {
    throw new functions.https.HttpsError('invalid-argument', 'Shipment ID and status are required');
  }

  const validStatuses = ['picked_up', 'in_transit'];
  if (!validStatuses.includes(status)) {
    if (status === 'delivered') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Delivered status is set by shipper through contract completion'
      );
    }
    throw new functions.https.HttpsError('invalid-argument', 'Invalid status');
  }

  const db = admin.firestore();
  const shipmentRef = db.collection('shipments').doc(shipmentId);
  const allowedTransitions = {
    pending_pickup: 'picked_up',
    picked_up: 'in_transit',
  };

  const result = await db.runTransaction(async (tx) => {
    const shipmentDoc = await tx.get(shipmentRef);
    if (!shipmentDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Shipment not found');
    }

    const shipment = { id: shipmentDoc.id, ...shipmentDoc.data() };
    if (!shipment.contractId) {
      throw new functions.https.HttpsError('failed-precondition', 'Shipment is missing contract reference');
    }

    const contractRef = db.collection('contracts').doc(shipment.contractId);
    const contractDoc = await tx.get(contractRef);
    if (!contractDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Contract not found');
    }

    const contract = contractDoc.data();
    const { shipperId, truckerId } = resolveShipmentActors(contract, shipment);

    if (userId !== truckerId) {
      throw new functions.https.HttpsError('permission-denied', 'Only the assigned trucker can update status');
    }

    const rawStatus = shipment.status || 'pending_pickup';
    const currentStatus = rawStatus === 'pending' ? 'pending_pickup' : rawStatus;
    if (currentStatus === 'delivered') {
      throw new functions.https.HttpsError('failed-precondition', 'Shipment is already delivered');
    }

    if (status === currentStatus) {
      return {
        id: shipmentId,
        status: currentStatus,
        progress: Number(shipment.progress || 0),
        currentLocation: shipment.currentLocation || 'Unknown',
        deliveredAt: shipment.deliveredAt || null,
        shipperId,
        truckerId,
      };
    }

    if (allowedTransitions[currentStatus] !== status) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `Invalid status transition: ${currentStatus} -> ${status}`
      );
    }

    const updateData = {
      status,
      shipperId,
      truckerId,
      updatedBy: userId,
      updatedByRole: 'trucker',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (status === 'in_transit') {
      updateData.progress = Math.max(1, Number(shipment.progress || 0));
    }

    tx.update(shipmentRef, updateData);

    return {
      id: shipmentId,
      status,
      progress: updateData.progress ?? Number(shipment.progress || 0),
      currentLocation: shipment.currentLocation || 'Unknown',
      deliveredAt: shipment.deliveredAt || null,
      shipperId,
      truckerId,
    };
  });

  return {
    message: 'Status updated',
    shipment: result,
  };
});
