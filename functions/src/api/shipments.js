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

/**
 * Update Shipment Location
 */
exports.updateShipmentLocation = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { shipmentId, currentLat, currentLng, currentLocation } = data;
  const userId = context.auth.uid;

  if (!shipmentId) {
    throw new functions.https.HttpsError('invalid-argument', 'Shipment ID is required');
  }

  if (currentLat === undefined || currentLng === undefined) {
    throw new functions.https.HttpsError('invalid-argument', 'Coordinates are required');
  }

  if (currentLat < -90 || currentLat > 90 || currentLng < -180 || currentLng > 180) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid coordinates');
  }

  const db = admin.firestore();

  // Get shipment
  const shipmentDoc = await db.collection('shipments').doc(shipmentId).get();
  if (!shipmentDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Shipment not found');
  }

  const shipment = { id: shipmentDoc.id, ...shipmentDoc.data() };

  // Get contract to determine trucker
  const contractDoc = await db.collection('contracts').doc(shipment.contractId).get();
  if (!contractDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Contract not found');
  }

  const contract = contractDoc.data();

  // Determine trucker ID
  let truckerId;
  if (contract.listingType === 'cargo') {
    truckerId = contract.bidderId; // trucker bid on cargo
  } else {
    truckerId = contract.listingOwnerId; // trucker owns truck listing
  }

  // Only trucker can update location
  if (userId !== truckerId) {
    throw new functions.https.HttpsError('permission-denied', 'Only the assigned trucker can update location');
  }

  // Cannot update delivered shipments
  if (shipment.status === 'delivered') {
    throw new functions.https.HttpsError('failed-precondition', 'Cannot update location of delivered shipment');
  }

  // Calculate progress based on distance
  let progress = shipment.progress || 0;
  let status = shipment.status;

  const originCoords = getCoordinates(contract.pickupAddress);
  const destCoords = getCoordinates(contract.deliveryAddress);

  const distanceFromOrigin = calculateDistance(
    originCoords.lat, originCoords.lng,
    currentLat, currentLng
  );
  const totalDistance = calculateDistance(
    originCoords.lat, originCoords.lng,
    destCoords.lat, destCoords.lng
  );

  if (totalDistance > 0) {
    progress = Math.min(100, Math.round((distanceFromOrigin / totalDistance) * 100));
  }

  // Auto-update status based on progress
  if (progress > 0 && status === 'picked_up') {
    status = 'in_transit';
  }

  // Update shipment
  await db.collection('shipments').doc(shipmentId).update({
    currentLat,
    currentLng,
    currentLocation: currentLocation || 'Unknown',
    progress,
    status,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Determine shipper ID
  const shipperId = contract.listingType === 'cargo' ? contract.listingOwnerId : contract.bidderId;

  // Create notification for shipper
  await db.collection(`users/${shipperId}/notifications`).doc().set({
    type: 'SHIPMENT_UPDATE',
    title: 'Shipment Location Updated',
    message: `Your shipment is now at ${currentLocation || 'Unknown'} (${progress}% complete)`,
    data: {
      shipmentId,
      trackingNumber: shipment.trackingNumber,
      currentLocation: currentLocation || 'Unknown',
      progress,
    },
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    message: 'Location updated',
    shipment: {
      id: shipmentId,
      currentLat,
      currentLng,
      currentLocation: currentLocation || 'Unknown',
      progress,
      status,
    },
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

  const validStatuses = ['picked_up', 'in_transit', 'delivered'];
  if (!validStatuses.includes(status)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid status');
  }

  const db = admin.firestore();

  // Get shipment
  const shipmentDoc = await db.collection('shipments').doc(shipmentId).get();
  if (!shipmentDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Shipment not found');
  }

  const shipment = { id: shipmentDoc.id, ...shipmentDoc.data() };

  // Get contract to determine trucker
  const contractDoc = await db.collection('contracts').doc(shipment.contractId).get();
  if (!contractDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Contract not found');
  }

  const contract = contractDoc.data();

  // Determine trucker ID
  let truckerId;
  if (contract.listingType === 'cargo') {
    truckerId = contract.bidderId;
  } else {
    truckerId = contract.listingOwnerId;
  }

  // Only trucker can update status
  if (userId !== truckerId) {
    throw new functions.https.HttpsError('permission-denied', 'Only the assigned trucker can update status');
  }

  // Update shipment
  const updateData = {
    status,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (status === 'delivered') {
    updateData.progress = 100;
    updateData.deliveredAt = new Date();
  }

  await db.collection('shipments').doc(shipmentId).update(updateData);

  // Determine shipper ID
  const shipperId = contract.listingType === 'cargo' ? contract.listingOwnerId : contract.bidderId;

  // Create notification
  await db.collection(`users/${shipperId}/notifications`).doc().set({
    type: 'SHIPMENT_UPDATE',
    title: status === 'delivered' ? 'Shipment Delivered!' : 'Shipment Status Updated',
    message: `Shipment status: ${status}`,
    data: { shipmentId, trackingNumber: shipment.trackingNumber, status },
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    message: 'Status updated',
    shipment: { id: shipmentId, status },
  };
});
