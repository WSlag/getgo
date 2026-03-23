/**
 * Shipment Triggers
 * Sends notifications on shipment status changes and location updates
 */

const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const { FieldValue: AdminFieldValue } = require('firebase-admin/firestore');
const {
  ACTIVITY_TYPES,
  getBrokerReferralForUser,
  mapListingTypeToTypeBucket,
  mapShipmentStatusToActivityStatus,
  maskDisplayName,
  upsertBrokerMarketplaceActivity,
} = require('../services/brokerListingReferralService');

const FirestoreFieldValue = admin.firestore?.FieldValue || AdminFieldValue;
const { sendPushToUser } = require('../services/fcmService');

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

function normalizeListingType(value) {
  return String(value || '').toLowerCase() === 'cargo' ? 'cargo' : 'truck';
}

function normalizeShipmentStatus(value) {
  return String(value || '').trim().toLowerCase() || 'pending_pickup';
}

function resolveShipmentActivityType(listingType) {
  return listingType === 'cargo'
    ? ACTIVITY_TYPES.CARGO_SHIPMENT_STATUS
    : ACTIVITY_TYPES.TRUCK_DELIVERY_STATUS;
}

async function recordBrokerShipmentActivity(db, shipmentId, shipment, contract, shipmentStatusRaw) {
  if (!contract || !contract.bidderId || !shipmentId) return;

  const referredUserId = contract.bidderId;
  const referral = await getBrokerReferralForUser(referredUserId, db);
  if (!referral?.brokerId) return;

  const listingType = normalizeListingType(contract.listingType);
  const normalizedShipmentStatus = normalizeShipmentStatus(shipmentStatusRaw || shipment?.status);
  const statusBucket = mapShipmentStatusToActivityStatus(normalizedShipmentStatus);
  const [referredDoc, counterpartyDoc] = await Promise.all([
    db.collection('users').doc(referredUserId).get(),
    contract.listingOwnerId
      ? db.collection('users').doc(contract.listingOwnerId).get()
      : Promise.resolve(null),
  ]);

  await upsertBrokerMarketplaceActivity(`shipment:${shipmentId}:${normalizedShipmentStatus}`, {
    brokerId: referral.brokerId,
    referredUserId,
    activityType: resolveShipmentActivityType(listingType),
    listingType,
    typeBucket: mapListingTypeToTypeBucket(listingType),
    listingId: contract.listingId || null,
    bidId: contract.bidId || null,
    contractId: contract.id || shipment.contractId || null,
    shipmentId,
    amount: Number(contract.agreedPrice || 0) || null,
    origin: contract.pickupCity || contract.pickupAddress || shipment.origin || null,
    destination: contract.deliveryCity || contract.deliveryAddress || shipment.destination || null,
    status: statusBucket,
    statusBucket,
    shipmentStatus: normalizedShipmentStatus,
    activityAt: shipment.updatedAt || shipment.createdAt || FirestoreFieldValue.serverTimestamp(),
    referredUserMasked: maskDisplayName(
      referredDoc.exists ? referredDoc.data().name : null,
      referredDoc.exists ? referredDoc.data().phone : null
    ),
    counterpartyMasked: maskDisplayName(
      counterpartyDoc?.exists ? counterpartyDoc.data().name : contract.listingOwnerName,
      counterpartyDoc?.exists ? counterpartyDoc.data().phone : null
    ),
    source: 'trigger',
  }, db);
}

exports.onShipmentCreated = onDocumentCreated(
  {
    region: 'asia-southeast1',
    document: 'shipments/{shipmentId}',
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return null;
    const shipment = snap.data() || {};
    const shipmentId = event.params.shipmentId;
    if (!shipment.contractId) return null;

    const db = admin.firestore();
    const contractDoc = await db.collection('contracts').doc(shipment.contractId).get();
    if (!contractDoc.exists) return null;

    try {
      await recordBrokerShipmentActivity(
        db,
        shipmentId,
        shipment,
        { id: contractDoc.id, ...contractDoc.data() },
        shipment.status || 'pending_pickup'
      );
    } catch (error) {
      console.error('Failed to record broker shipment-created activity:', error);
    }

    return null;
  }
);

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
      createdAt: FirestoreFieldValue.serverTimestamp(),
    });

    try {
      await sendPushToUser(db, shipperId, {
        title: 'Shipment Location Updated',
        body: `${truckerName} updated the location. Progress: ${Math.round(after.progress || 0)}%`,
        data: { type: 'SHIPMENT_UPDATE', shipmentId, trackingNumber: String(after.trackingNumber || '') },
      });
    } catch (pushErr) {
      console.error('[shipmentTriggers] Push notification failed (non-fatal):', pushErr.message);
    }

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
        createdAt: FirestoreFieldValue.serverTimestamp(),
      });

      try {
        await sendPushToUser(db, shipperId, {
          title: 'Shipment Status Update',
          body: `${message} - Tracking: ${after.trackingNumber}`,
          data: { type: 'SHIPMENT_STATUS', shipmentId, status: after.status, trackingNumber: String(after.trackingNumber || '') },
        });
      } catch (pushErr) {
        console.error('[shipmentTriggers] Push notification failed (non-fatal):', pushErr.message);
      }
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
        createdAt: FirestoreFieldValue.serverTimestamp(),
      });

      try {
        await sendPushToUser(db, truckerId, {
          title: 'Shipment Status Update',
          body: `${message} - Tracking: ${after.trackingNumber}`,
          data: { type: 'SHIPMENT_STATUS', shipmentId, status: after.status, trackingNumber: String(after.trackingNumber || '') },
        });
      } catch (pushErr) {
        console.error('[shipmentTriggers] Push notification failed (non-fatal):', pushErr.message);
      }
    }

    if (after.contractId) {
      try {
        const contractDoc = await db.collection('contracts').doc(after.contractId).get();
        if (contractDoc.exists) {
          await recordBrokerShipmentActivity(
            db,
            shipmentId,
            after,
            { id: contractDoc.id, ...contractDoc.data() },
            after.status
          );
        }
      } catch (error) {
        console.error('Failed to record broker shipment status activity:', error);
      }
    }

    return null;
  }
);

