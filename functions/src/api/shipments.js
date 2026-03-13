/**
 * Shipment Management Cloud Functions
 * Handles shipment tracking and location updates
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { FieldValue: AdminFieldValue } = require('firebase-admin/firestore');
const {
  DEFAULT_COORDS,
  resolveCoordinatePair,
  calculateHaversineDistanceKm,
  computeProgressTowardDestination,
  toWholeKm,
} = require('../utils/geo');
const FirestoreFieldValue = admin.firestore?.FieldValue || AdminFieldValue;

function resolveShipmentActors(contract, shipment) {
  const isCargo = contract.listingType === 'cargo';
  const shipperId = shipment.shipperId || (isCargo ? contract.listingOwnerId : contract.bidderId);
  const truckerId = shipment.truckerId || (isCargo ? contract.bidderId : contract.listingOwnerId);
  return { shipperId, truckerId };
}

function resolveRouteCoordinates(shipment, contract) {
  const origin = resolveCoordinatePair({
    lat: shipment.originLat ?? contract.pickupLat,
    lng: shipment.originLng ?? contract.pickupLng,
    name: shipment.origin || contract.pickupCity || contract.pickupAddress || null,
    fallback: DEFAULT_COORDS,
  });

  const destination = resolveCoordinatePair({
    lat: shipment.destLat ?? contract.deliveryLat,
    lng: shipment.destLng ?? contract.deliveryLng,
    name: shipment.destination || contract.deliveryCity || contract.deliveryAddress || null,
    fallback: DEFAULT_COORDS,
  });

  return { origin, destination };
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

    const { origin, destination } = resolveRouteCoordinates(shipment, contract);
    const progress = computeProgressTowardDestination({
      origin,
      destination,
      current: { lat: currentLat, lng: currentLng },
      previousProgress: Number(shipment.progress || 0),
    });
    const remainingDistanceKm = toWholeKm(
      calculateHaversineDistanceKm(
        currentLat,
        currentLng,
        destination.lat,
        destination.lng
      )
    );

    let nextStatus = currentStatus;
    if (nextStatus === 'picked_up' && progress > 0) {
      nextStatus = 'in_transit';
    }

    const updateData = {
      currentLat,
      currentLng,
      currentLocation: currentLocation || shipment.currentLocation || 'Unknown',
      progress,
      remainingDistanceKm,
      status: nextStatus,
      shipperId,
      truckerId,
      updatedBy: userId,
      updatedByRole: 'trucker',
      updatedAt: FirestoreFieldValue.serverTimestamp(),
    };

    tx.update(shipmentRef, updateData);

    return {
      id: shipmentId,
      currentLat,
      currentLng,
      currentLocation: updateData.currentLocation,
      progress,
      remainingDistanceKm,
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
      updatedAt: FirestoreFieldValue.serverTimestamp(),
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

