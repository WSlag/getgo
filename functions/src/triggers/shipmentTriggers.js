/**
 * Shipment Triggers
 * Sends notifications on shipment status changes and location updates
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

/**
 * Notify shipper when shipment location is updated
 */
exports.onShipmentLocationUpdate = functions.region('asia-southeast1').firestore
  .document('shipments/{shipmentId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const shipmentId = context.params.shipmentId;

    // Only trigger if location actually changed
    if (before.currentLat === after.currentLat && before.currentLng === after.currentLng) {
      return null;
    }

    const db = admin.firestore();

    // Determine who to notify (notify the shipper, not the trucker)
    const shipperId = after.shipperId;
    if (!shipperId) return null;

    // Get trucker name
    const truckerDoc = await db.collection('users').doc(after.truckerId).get();
    const truckerName = truckerDoc.exists ? truckerDoc.data().name : 'Trucker';

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
  });

/**
 * Notify both parties when shipment status changes
 */
exports.onShipmentStatusChanged = functions.region('asia-southeast1').firestore
  .document('shipments/{shipmentId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const shipmentId = context.params.shipmentId;

    // Only trigger if status changed
    if (before.status === after.status) {
      return null;
    }

    const db = admin.firestore();

    // Get user names
    const shipperDoc = await db.collection('users').doc(after.shipperId).get();
    const truckerDoc = await db.collection('users').doc(after.truckerId).get();
    const shipperName = shipperDoc.exists ? shipperDoc.data().name : 'Shipper';
    const truckerName = truckerDoc.exists ? truckerDoc.data().name : 'Trucker';

    const statusMessages = {
      pending: 'Shipment is pending',
      in_transit: 'Shipment is in transit',
      delivered: 'Shipment has been delivered',
      cancelled: 'Shipment has been cancelled',
    };

    const message = statusMessages[after.status] || `Status changed to ${after.status}`;

    // Notify shipper
    await db.collection(`users/${after.shipperId}/notifications`).doc().set({
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

    // Notify trucker
    await db.collection(`users/${after.truckerId}/notifications`).doc().set({
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

    return null;
  });
