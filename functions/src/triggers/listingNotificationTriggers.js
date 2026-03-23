/**
 * Listing Notification Triggers
 * Sends push-only FCM topic notifications when new cargo or truck listings are created.
 * No in-app notification document is written — the push nudges users to open the marketplace.
 *
 * Topic routing:
 *   new-cargo-listings  →  truckers (subscribed on FCM token registration)
 *   new-truck-listings  →  shippers (subscribed on FCM token registration)
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

const REGION = 'asia-southeast1';

/**
 * Both cargo and truck listings use 'open' as the canonical active status.
 * 'available' is a frontend display alias only (see frontend/src/utils/listingStatus.js).
 */
function isOpenListing(listing) {
  return String(listing.status || '').toLowerCase() === 'open';
}

exports.onCargoListingCreatedNotify = onDocumentCreated(
  {
    region: REGION,
    document: 'cargoListings/{listingId}',
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return null;

    const listing = snap.data() || {};
    if (!isOpenListing(listing)) return null;

    const origin = listing.pickupCity || listing.pickupAddress || '';
    const destination = listing.deliveryCity || listing.deliveryAddress || '';
    const route = origin && destination ? `${origin} → ${destination}` : 'Bagong cargo listing';

    try {
      await admin.messaging().send({
        topic: 'new-cargo-listings',
        notification: {
          title: 'Bagong Cargo na Available!',
          body: route,
        },
        data: {
          type: 'NEW_CARGO_LISTING',
          listingId: event.params.listingId,
        },
        webpush: {
          notification: {
            icon: 'https://getgoph.com/icons/icon-192x192.png',
            badge: 'https://getgoph.com/icons/icon-72x72.png',
          },
        },
      });
    } catch (err) {
      console.error('[onCargoListingCreatedNotify] Failed to send topic message:', err?.message);
    }

    return null;
  }
);

exports.onTruckListingCreatedNotify = onDocumentCreated(
  {
    region: REGION,
    // Note: truckerComplianceTriggers.js also registers onTruckListingCreated on this path.
    // Multiple triggers on the same path run independently — no conflict.
    document: 'truckListings/{listingId}',
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return null;

    const listing = snap.data() || {};
    if (!isOpenListing(listing)) return null;

    const truckerName = listing.truckerName || 'Trucker';
    const origin = listing.origin || listing.pickupCity || '';
    const destination = listing.destination || listing.deliveryCity || '';
    const route = origin && destination ? `${origin} → ${destination}` : 'Bagong truck listing';

    try {
      await admin.messaging().send({
        topic: 'new-truck-listings',
        notification: {
          title: `${truckerName} — Truck Available`,
          body: route,
        },
        data: {
          type: 'NEW_TRUCK_LISTING',
          listingId: event.params.listingId,
        },
        webpush: {
          notification: {
            icon: 'https://getgoph.com/icons/icon-192x192.png',
            badge: 'https://getgoph.com/icons/icon-72x72.png',
          },
        },
      });
    } catch (err) {
      console.error('[onTruckListingCreatedNotify] Failed to send topic message:', err?.message);
    }

    return null;
  }
);
