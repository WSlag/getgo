/**
 * Shipment Triggers
 * Sends notifications on shipment status changes and location updates
 */

const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

async function resolveParticipantIds(db, shipment) {
  let shipperId = shipment.shipperId || null;
  let truckerId = shipment.truckerId || null;

  if (shipperId && truckerId) {
    return { shipperId, truckerId };
  }

  if (!shipment.contractId) {
    return { shipperId, truckerId };
  }

  const contractDoc = await db.collection('contracts').doc(shipment.contractId).get();
  if (!contractDoc.exists) {
    return { shipperId, truckerId };
  }

  const contract = contractDoc.data();
  if (contract.listingType === 'cargo') {
    shipperId = shipperId || contract.listingOwnerId || null;
    truckerId = truckerId || contract.bidderId || null;
  } else {
    shipperId = shipperId || contract.bidderId || null;
    truckerId = truckerId || contract.listingOwnerId || null;
  }

  return { shipperId, truckerId };
}

/**
 * Notify shipper when shipment location is updated
 */
exports.onShipmentLocationUpdate = onDocumentUpdated(
  {
    region: 'asia-southeast1',
    document: 'shipments/{shipmentId}',
  },
  async (event) => {
    const change = event.data;
    if (!change) return null;
    const before = change.before.data();
    const after = change.after.data();
    const shipmentId = event.params.shipmentId;

    // Only trigger if location actually changed
    if (before.currentLat === after.currentLat && before.currentLng === after.currentLng) {
      return null;
    }

    const db = admin.firestore();

    // Determine who to notify (notify the shipper, not the trucker)
    const { shipperId, truckerId } = await resolveParticipantIds(db, after);
    if (!shipperId) return null;

    // Get trucker name
    const truckerDoc = truckerId
      ? await db.collection('users').doc(truckerId).get()
      : null;
    const truckerName = truckerDoc?.exists ? truckerDoc.data().name : 'Trucker';

    // Create notification
    await db.collection(`users/${shipperId}/notifications`).doc().set({
      type: 'SHIPMENT_UPDATE',
      title: 'Shipment Location Updated',
      message: `${truckerName} updated the location. Progress: ${Math.round(after.progress || 0)}%`,
      data: {
        shipmentId,
        contractId: after.contractId,
        trackingNumber: after.trackingNumber,
        currentLocation: after.currentLocation,
        progress: after.progress,
        currentLat: after.currentLat,
        currentLng: after.currentLng,
      },
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return null;
  }
);

/**
 * Notify both parties when shipment status changes
 */
exports.onShipmentStatusChanged = onDocumentUpdated(
  {
    region: 'asia-southeast1',
    document: 'shipments/{shipmentId}',
  },
  async (event) => {
    const change = event.data;
    if (!change) return null;
    const before = change.before.data();
    const after = change.after.data();
    const shipmentId = event.params.shipmentId;

    // Only trigger if status changed
    if (before.status === after.status) {
      return null;
    }

    const db = admin.firestore();
    const { shipperId, truckerId } = await resolveParticipantIds(db, after);
    if (!shipperId && !truckerId) return null;

    const statusMessages = {
      pending: 'Shipment is waiting for pickup confirmation',
      pending_pickup: 'Shipment is waiting for pickup confirmation',
      picked_up: 'Shipment has been picked up',
      in_transit: 'Shipment is in transit',
      delivered: 'Shipment has been delivered',
      cancelled: 'Shipment has been cancelled',
    };

    const message = statusMessages[after.status] || `Status changed to ${after.status}`;

    // Notify shipper
    if (shipperId) {
      await db.collection(`users/${shipperId}/notifications`).doc().set({
        type: 'SHIPMENT_STATUS',
        title: 'Shipment Status Update',
        message: `${message} - Tracking: ${after.trackingNumber}`,
        data: {
          shipmentId,
          contractId: after.contractId,
          trackingNumber: after.trackingNumber,
          status: after.status,
        },
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Notify trucker
    if (truckerId) {
      await db.collection(`users/${truckerId}/notifications`).doc().set({
        type: 'SHIPMENT_STATUS',
        title: 'Shipment Status Update',
        message: `${message} - Tracking: ${after.trackingNumber}`,
        data: {
          shipmentId,
          contractId: after.contractId,
          trackingNumber: after.trackingNumber,
          status: after.status,
        },
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    return null;
  }
);
