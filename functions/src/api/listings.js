/**
 * Listings & Route Optimization Cloud Functions
 * Handles backload matching and popular routes
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

const ROUTE_OPTIMIZER_TYPE = Object.freeze({
  BOTH: 'both',
  CARGO: 'cargo',
  TRUCK: 'truck',
});

const ACTIVE_TRUCK_STATUSES = ['open', 'available', 'waiting', 'in_transit'];

function getCoordinates(cityName) {
  if (!cityName) return { lat: 7.5, lng: 124.5 };
  const normalized = Object.keys(cityCoordinates).find(
    key => key.toLowerCase().includes(cityName.toLowerCase()) ||
      cityName.toLowerCase().includes(key.toLowerCase().split(' ')[0])
  );
  return cityCoordinates[normalized] || { lat: 7.5, lng: 124.5 };
}

function parseCoordinate(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getReferenceCoordinates({ name, lat, lng }) {
  const parsedLat = parseCoordinate(lat);
  const parsedLng = parseCoordinate(lng);
  if (parsedLat !== null && parsedLng !== null) {
    return { lat: parsedLat, lng: parsedLng };
  }
  return getCoordinates(name);
}

function clampDetourKm(value, fallback = 50) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(10, Math.min(200, parsed));
}

function normalizeRouteSearchType(type) {
  const normalized = String(type || '').trim().toLowerCase();
  if (normalized === ROUTE_OPTIMIZER_TYPE.CARGO) return ROUTE_OPTIMIZER_TYPE.CARGO;
  if (normalized === ROUTE_OPTIMIZER_TYPE.TRUCK) return ROUTE_OPTIMIZER_TYPE.TRUCK;
  return ROUTE_OPTIMIZER_TYPE.BOTH;
}

function toMatchedListing(listing, listingType, referenceCoords, maxDetourKm, destinationCoords = null) {
  const listingOriginCoords = getReferenceCoordinates({
    name: listing.origin,
    lat: listing.originLat,
    lng: listing.originLng,
  });
  const listingDestinationCoords = getReferenceCoordinates({
    name: listing.destination,
    lat: listing.destLat,
    lng: listing.destLng,
  });

  const originDistance = calculateDistance(
    referenceCoords.lat,
    referenceCoords.lng,
    listingOriginCoords.lat,
    listingOriginCoords.lng
  );
  const destinationDistance = destinationCoords
    ? calculateDistance(
      destinationCoords.lat,
      destinationCoords.lng,
      listingDestinationCoords.lat,
      listingDestinationCoords.lng
    )
    : null;
  const scoringDistance = destinationDistance === null
    ? originDistance
    : ((originDistance * 0.65) + (destinationDistance * 0.35));

  if (scoringDistance > maxDetourKm) {
    return null;
  }

  const routeDistance = calculateDistance(
    listingOriginCoords.lat,
    listingOriginCoords.lng,
    listingDestinationCoords.lat,
    listingDestinationCoords.lng
  );

  return {
    ...listing,
    listingType,
    routeDistance: Math.round(routeDistance),
    originDistance: Math.round(originDistance),
    destDistance: destinationDistance === null ? null : Math.round(destinationDistance),
    matchScore: Math.max(0, Math.round(100 - ((scoringDistance / maxDetourKm) * 100))),
  };
}

/**
 * Find Backload Opportunities
 * Finds cargo listings near trucker's destination
 */
exports.findBackloadOpportunities = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const {
    origin,
    destination,
    originLat,
    originLng,
    destLat,
    destLng,
    maxDetourKm = 50,
    type,
  } = data || {};

  if (!origin) {
    throw new functions.https.HttpsError('invalid-argument', 'Origin is required');
  }

  const db = admin.firestore();
  const normalizedType = normalizeRouteSearchType(type);
  const boundedDetourKm = clampDetourKm(maxDetourKm, 50);

  const originCoords = getReferenceCoordinates({
    name: origin,
    lat: originLat,
    lng: originLng,
  });
  const destinationCoords = destination
    ? getReferenceCoordinates({
      name: destination,
      lat: destLat,
      lng: destLng,
    })
    : null;
  const searchReferenceCoords = destinationCoords || originCoords;

  const shouldIncludeCargo = normalizedType !== ROUTE_OPTIMIZER_TYPE.TRUCK;
  const shouldIncludeTrucks = normalizedType !== ROUTE_OPTIMIZER_TYPE.CARGO;

  const [cargoSnap, truckSnap] = await Promise.all([
    shouldIncludeCargo
      ? db.collection('cargoListings')
        .where('status', '==', 'open')
        .limit(150)
        .get()
      : Promise.resolve(null),
    shouldIncludeTrucks
      ? db.collection('truckListings')
        .where('status', 'in', ACTIVE_TRUCK_STATUSES)
        .limit(150)
        .get()
      : Promise.resolve(null),
  ]);

  const cargoMatches = [];
  if (cargoSnap) {
    cargoSnap.docs.forEach((doc) => {
      const listing = { id: doc.id, ...doc.data() };
      const match = toMatchedListing(
        listing,
        ROUTE_OPTIMIZER_TYPE.CARGO,
        searchReferenceCoords,
        boundedDetourKm,
        destinationCoords
      );
      if (match) cargoMatches.push(match);
    });
  }

  const truckMatches = [];
  if (truckSnap) {
    truckSnap.docs.forEach((doc) => {
      const listing = { id: doc.id, ...doc.data() };
      const match = toMatchedListing(
        listing,
        ROUTE_OPTIMIZER_TYPE.TRUCK,
        searchReferenceCoords,
        boundedDetourKm,
        destinationCoords
      );
      if (match) truckMatches.push(match);
    });
  }

  cargoMatches.sort((a, b) => b.matchScore - a.matchScore);
  truckMatches.sort((a, b) => b.matchScore - a.matchScore);

  return {
    matches: cargoMatches.slice(0, 20),
    cargoMatches: cargoMatches.slice(0, 20),
    truckMatches: truckMatches.slice(0, 20),
    total: cargoMatches.length + truckMatches.length,
    maxDetourKm: boundedDetourKm,
    type: normalizedType,
  };
});

/**
 * Get Popular Routes
 * Returns frequently traveled routes based on completed contracts
 */
exports.getPopularRoutes = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const db = admin.firestore();

  // Get completed contracts
  const contractsSnap = await db.collection('contracts')
    .where('status', 'in', ['signed', 'completed'])
    .limit(500)
    .get();

  // Count routes
  const routeCounts = {};

  contractsSnap.docs.forEach(doc => {
    const contract = doc.data();
    const route = `${contract.pickupAddress} → ${contract.deliveryAddress}`;

    if (routeCounts[route]) {
      routeCounts[route].count++;
      routeCounts[route].totalPrice += contract.agreedPrice || 0;
    } else {
      routeCounts[route] = {
        origin: contract.pickupAddress,
        destination: contract.deliveryAddress,
        count: 1,
        totalPrice: contract.agreedPrice || 0,
      };
    }
  });

  // Convert to array and calculate average price
  const routes = Object.entries(routeCounts).map(([route, data]) => ({
    route,
    origin: data.origin,
    destination: data.destination,
    count: data.count,
    averagePrice: Math.round(data.totalPrice / data.count),
    distance: Math.round(calculateDistance(
      getCoordinates(data.origin).lat,
      getCoordinates(data.origin).lng,
      getCoordinates(data.destination).lat,
      getCoordinates(data.destination).lng
    )),
  }));

  // Sort by frequency
  routes.sort((a, b) => b.count - a.count);

  return {
    routes: routes.slice(0, 20), // Top 20 popular routes
  };
});

/**
 * Request to chat before placing a bid
 * Creates a notification for listing owner so they can review the listing and respond.
 */
exports.requestListingChat = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { listingId, listingType, note } = data || {};
  if (!listingId || !listingType) {
    throw new functions.https.HttpsError('invalid-argument', 'listingId and listingType are required');
  }

  const normalizedType = String(listingType).toLowerCase();
  if (!['cargo', 'truck'].includes(normalizedType)) {
    throw new functions.https.HttpsError('invalid-argument', 'listingType must be cargo or truck');
  }

  const listingCollection = normalizedType === 'cargo' ? 'cargoListings' : 'truckListings';
  const db = admin.firestore();

  const [listingDoc, requesterDoc] = await Promise.all([
    db.collection(listingCollection).doc(listingId).get(),
    db.collection('users').doc(context.auth.uid).get(),
  ]);

  if (!listingDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Listing not found');
  }

  const listing = listingDoc.data();
  const listingOwnerId = listing.userId;
  if (!listingOwnerId) {
    throw new functions.https.HttpsError('failed-precondition', 'Listing owner is missing');
  }

  if (listingOwnerId === context.auth.uid) {
    throw new functions.https.HttpsError('failed-precondition', 'Cannot request chat on your own listing');
  }

  const requesterName = requesterDoc.exists
    ? (requesterDoc.data().name || requesterDoc.data().displayName || 'A user')
    : 'A user';
  const safeNote = typeof note === 'string' ? note.trim().slice(0, 200) : '';

  const requestRef = db.collection('chatRequests').doc(`${listingId}_${context.auth.uid}`);
  await requestRef.set({
    listingId,
    listingType: normalizedType,
    listingOwnerId,
    requesterId: context.auth.uid,
    requesterName,
    route: {
      origin: listing.origin || '',
      destination: listing.destination || '',
    },
    note: safeNote,
    status: 'pending',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  const notificationMessageBase = `${requesterName} requested to chat about ${listing.origin || 'origin'} -> ${listing.destination || 'destination'}.`;
  const notificationMessage = safeNote
    ? `${notificationMessageBase} Note: ${safeNote}`
    : notificationMessageBase;

  await db.collection(`users/${listingOwnerId}/notifications`).doc().set({
    type: 'CHAT_REQUEST',
    title: 'New Chat Request',
    message: notificationMessage,
    data: {
      listingId,
      listingType: normalizedType,
      requesterId: context.auth.uid,
      requesterName,
      origin: listing.origin || null,
      destination: listing.destination || null,
    },
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await db.collection(`users/${context.auth.uid}/notifications`).doc().set({
    type: 'CHAT_REQUEST_SENT',
    title: 'Chat Request Sent',
    message: `You requested to chat with the ${normalizedType === 'cargo' ? 'shipper' : 'trucker'}.`,
    data: {
      listingId,
      listingType: normalizedType,
      listingOwnerId,
    },
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    success: true,
    requestId: requestRef.id,
    message: 'Chat request sent',
  };
});
