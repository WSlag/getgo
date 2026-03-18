const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');
const {
  resolveCoordinatePair,
  calculateHaversineDistanceKm,
  toWholeKm,
  DEFAULT_COORDS,
} = require('../utils/geo');
const { containsContactInfo, sanitizePublicName } = require('../utils/contactModeration');

function toTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolvePostingRole(user = {}) {
  const role = String(user.role || '').trim().toLowerCase();
  const brokerSourceRole = String(user.brokerSourceRole || '').trim().toLowerCase();

  if (role === 'shipper' || role === 'trucker') return role;
  if (role === 'broker' && (brokerSourceRole === 'shipper' || brokerSourceRole === 'trucker')) {
    return brokerSourceRole;
  }
  return null;
}

function assertNoContact(value, fieldName) {
  const normalized = toTrimmedString(value);
  if (normalized && containsContactInfo(normalized)) {
    throw new functions.https.HttpsError('invalid-argument', `${fieldName} cannot contain contact information`);
  }
}

function assertListingTextFieldsNoContact(data = {}) {
  assertNoContact(data.origin, 'origin');
  assertNoContact(data.destination, 'destination');
  assertNoContact(data.originStreetAddress, 'originStreetAddress');
  assertNoContact(data.destinationStreetAddress, 'destinationStreetAddress');
  assertNoContact(data.description, 'description');
}

function computeRouteFields(payload = {}) {
  const originCoords = resolveCoordinatePair({
    lat: payload.originLat ?? payload.originCoords?.lat,
    lng: payload.originLng ?? payload.originCoords?.lng,
    name: payload.origin,
    fallback: DEFAULT_COORDS,
  });

  const destCoords = resolveCoordinatePair({
    lat: payload.destLat ?? payload.destCoords?.lat,
    lng: payload.destLng ?? payload.destCoords?.lng,
    name: payload.destination,
    fallback: DEFAULT_COORDS,
  });

  return {
    originLat: originCoords.lat,
    originLng: originCoords.lng,
    destLat: destCoords.lat,
    destLng: destCoords.lng,
    routeDistanceKm: toWholeKm(
      calculateHaversineDistanceKm(originCoords.lat, originCoords.lng, destCoords.lat, destCoords.lng)
    ),
  };
}

async function getCurrentUser(db, userId) {
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'User profile not found');
  }
  return userDoc.data() || {};
}

function validateCreateCommon(data = {}) {
  const origin = toTrimmedString(data.origin);
  const destination = toTrimmedString(data.destination);
  if (!origin || !destination) {
    throw new functions.https.HttpsError('invalid-argument', 'Origin and destination are required');
  }
  assertListingTextFieldsNoContact({
    origin,
    destination,
    originStreetAddress: data.originStreetAddress,
    destinationStreetAddress: data.destinationStreetAddress,
    description: data.description,
  });

  const askingPrice = toFiniteNumber(data.askingPrice, NaN);
  if (!Number.isFinite(askingPrice) || askingPrice <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Asking price must be greater than zero');
  }

  return {
    origin,
    destination,
    askingPrice,
  };
}

exports.createCargoListing = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const userId = context.auth.uid;
  const db = admin.firestore();
  const user = await getCurrentUser(db, userId);

  if (resolvePostingRole(user) !== 'shipper') {
    throw new functions.https.HttpsError('permission-denied', 'Only shipper accounts can create cargo listings');
  }

  const { origin, destination, askingPrice } = validateCreateCommon(data || {});
  const route = computeRouteFields({ ...(data || {}), origin, destination });

  const listingData = {
    userId,
    userName: sanitizePublicName(user.name, 'Unknown'),
    userTransactions: Number(user.shipperProfile?.totalTransactions || 0),
    origin,
    destination,
    ...route,
    routeDistanceUpdatedAt: FieldValue.serverTimestamp(),
    originStreetAddress: toTrimmedString(data?.originStreetAddress),
    destinationStreetAddress: toTrimmedString(data?.destinationStreetAddress),
    cargoType: toTrimmedString(data?.cargoType),
    weight: toFiniteNumber(data?.weight, 0),
    weightUnit: toTrimmedString(data?.weightUnit) || 'tons',
    vehicleNeeded: toTrimmedString(data?.vehicleNeeded || data?.vehicleType),
    askingPrice,
    description: toTrimmedString(data?.description),
    pickupDate: data?.pickupDate || null,
    photos: Array.isArray(data?.photos) ? data.photos : [],
    status: 'open',
    bidCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  const ref = await db.collection('cargoListings').add(listingData);
  return { id: ref.id };
});

exports.updateCargoListing = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const listingId = toTrimmedString(data?.listingId);
  if (!listingId) {
    throw new functions.https.HttpsError('invalid-argument', 'listingId is required');
  }

  const db = admin.firestore();
  const listingRef = db.collection('cargoListings').doc(listingId);
  const listingDoc = await listingRef.get();
  if (!listingDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Listing not found');
  }

  const listing = listingDoc.data() || {};
  if (listing.userId !== context.auth.uid) {
    throw new functions.https.HttpsError('permission-denied', 'Only listing owner can update this listing');
  }

  const updates = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  const origin = toTrimmedString(data?.origin) || listing.origin;
  const destination = toTrimmedString(data?.destination) || listing.destination;
  if (data?.origin !== undefined && origin !== listing.origin) {
    assertNoContact(origin, 'origin');
  }
  if (data?.destination !== undefined && destination !== listing.destination) {
    assertNoContact(destination, 'destination');
  }
  const route = computeRouteFields({ ...(listing || {}), ...(data || {}), origin, destination });
  updates.origin = origin;
  updates.destination = destination;
  updates.originLat = route.originLat;
  updates.originLng = route.originLng;
  updates.destLat = route.destLat;
  updates.destLng = route.destLng;
  updates.routeDistanceKm = route.routeDistanceKm;
  updates.routeDistanceUpdatedAt = FieldValue.serverTimestamp();

  if (data?.originStreetAddress !== undefined) {
    const nextOriginStreetAddress = toTrimmedString(data.originStreetAddress);
    if (nextOriginStreetAddress !== toTrimmedString(listing.originStreetAddress)) {
      assertNoContact(nextOriginStreetAddress, 'originStreetAddress');
    }
    updates.originStreetAddress = nextOriginStreetAddress;
  }
  if (data?.destinationStreetAddress !== undefined) {
    const nextDestinationStreetAddress = toTrimmedString(data.destinationStreetAddress);
    if (nextDestinationStreetAddress !== toTrimmedString(listing.destinationStreetAddress)) {
      assertNoContact(nextDestinationStreetAddress, 'destinationStreetAddress');
    }
    updates.destinationStreetAddress = nextDestinationStreetAddress;
  }
  if (data?.cargoType !== undefined) updates.cargoType = toTrimmedString(data.cargoType);
  if (data?.weight !== undefined) updates.weight = toFiniteNumber(data.weight, 0);
  if (data?.weightUnit !== undefined) updates.weightUnit = toTrimmedString(data.weightUnit) || 'tons';
  if (data?.vehicleNeeded !== undefined || data?.vehicleType !== undefined) {
    updates.vehicleNeeded = toTrimmedString(data.vehicleNeeded || data.vehicleType);
  }
  if (data?.askingPrice !== undefined) updates.askingPrice = toFiniteNumber(data.askingPrice, 0);
  if (data?.description !== undefined) {
    const nextDescription = toTrimmedString(data.description);
    if (nextDescription !== toTrimmedString(listing.description)) {
      assertNoContact(nextDescription, 'description');
    }
    updates.description = nextDescription;
  }
  if (data?.pickupDate !== undefined) updates.pickupDate = data.pickupDate || null;
  if (Array.isArray(data?.photos)) updates.photos = data.photos;

  await listingRef.update(updates);
  return { success: true };
});

exports.createTruckListing = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const userId = context.auth.uid;
  const db = admin.firestore();
  const user = await getCurrentUser(db, userId);

  if (resolvePostingRole(user) !== 'trucker') {
    throw new functions.https.HttpsError('permission-denied', 'Only trucker accounts can create truck listings');
  }

  const truckerProfileDoc = await db.collection('users').doc(userId).collection('truckerProfile').doc('profile').get();
  const truckerProfile = truckerProfileDoc.exists ? (truckerProfileDoc.data() || {}) : {};

  const { origin, destination, askingPrice } = validateCreateCommon(data || {});
  const route = computeRouteFields({ ...(data || {}), origin, destination });

  const listingData = {
    userId,
    userName: sanitizePublicName(user.name, 'Unknown'),
    userRating: Number(truckerProfile.rating || 0),
    userTrips: Number(truckerProfile.totalTrips || 0),
    origin,
    destination,
    ...route,
    routeDistanceUpdatedAt: FieldValue.serverTimestamp(),
    originStreetAddress: toTrimmedString(data?.originStreetAddress),
    destinationStreetAddress: toTrimmedString(data?.destinationStreetAddress),
    vehicleType: toTrimmedString(data?.vehicleType),
    capacity: toFiniteNumber(data?.capacity, toFiniteNumber(data?.weight, 0)),
    capacityUnit: toTrimmedString(data?.capacityUnit || data?.unit) || 'tons',
    plateNumber: toTrimmedString(data?.plateNumber),
    askingPrice,
    description: toTrimmedString(data?.description),
    availableDate: data?.availableDate || data?.pickupDate || null,
    departureTime: toTrimmedString(data?.departureTime),
    photos: Array.isArray(data?.photos) ? data.photos : [],
    status: 'open',
    bidCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  const ref = await db.collection('truckListings').add(listingData);
  return { id: ref.id };
});

exports.updateTruckListing = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const listingId = toTrimmedString(data?.listingId);
  if (!listingId) {
    throw new functions.https.HttpsError('invalid-argument', 'listingId is required');
  }

  const db = admin.firestore();
  const listingRef = db.collection('truckListings').doc(listingId);
  const listingDoc = await listingRef.get();
  if (!listingDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Listing not found');
  }

  const listing = listingDoc.data() || {};
  if (listing.userId !== context.auth.uid) {
    throw new functions.https.HttpsError('permission-denied', 'Only listing owner can update this listing');
  }

  const updates = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  const origin = toTrimmedString(data?.origin) || listing.origin;
  const destination = toTrimmedString(data?.destination) || listing.destination;
  if (data?.origin !== undefined && origin !== listing.origin) {
    assertNoContact(origin, 'origin');
  }
  if (data?.destination !== undefined && destination !== listing.destination) {
    assertNoContact(destination, 'destination');
  }
  const route = computeRouteFields({ ...(listing || {}), ...(data || {}), origin, destination });
  updates.origin = origin;
  updates.destination = destination;
  updates.originLat = route.originLat;
  updates.originLng = route.originLng;
  updates.destLat = route.destLat;
  updates.destLng = route.destLng;
  updates.routeDistanceKm = route.routeDistanceKm;
  updates.routeDistanceUpdatedAt = FieldValue.serverTimestamp();

  if (data?.originStreetAddress !== undefined) {
    const nextOriginStreetAddress = toTrimmedString(data.originStreetAddress);
    if (nextOriginStreetAddress !== toTrimmedString(listing.originStreetAddress)) {
      assertNoContact(nextOriginStreetAddress, 'originStreetAddress');
    }
    updates.originStreetAddress = nextOriginStreetAddress;
  }
  if (data?.destinationStreetAddress !== undefined) {
    const nextDestinationStreetAddress = toTrimmedString(data.destinationStreetAddress);
    if (nextDestinationStreetAddress !== toTrimmedString(listing.destinationStreetAddress)) {
      assertNoContact(nextDestinationStreetAddress, 'destinationStreetAddress');
    }
    updates.destinationStreetAddress = nextDestinationStreetAddress;
  }
  if (data?.vehicleType !== undefined) updates.vehicleType = toTrimmedString(data.vehicleType);
  if (data?.capacity !== undefined || data?.weight !== undefined) {
    updates.capacity = toFiniteNumber(data.capacity, toFiniteNumber(data.weight, 0));
  }
  if (data?.capacityUnit !== undefined || data?.unit !== undefined) {
    updates.capacityUnit = toTrimmedString(data.capacityUnit || data.unit) || 'tons';
  }
  if (data?.plateNumber !== undefined) updates.plateNumber = toTrimmedString(data.plateNumber);
  if (data?.askingPrice !== undefined) updates.askingPrice = toFiniteNumber(data.askingPrice, 0);
  if (data?.description !== undefined) {
    const nextDescription = toTrimmedString(data.description);
    if (nextDescription !== toTrimmedString(listing.description)) {
      assertNoContact(nextDescription, 'description');
    }
    updates.description = nextDescription;
  }
  if (data?.availableDate !== undefined || data?.pickupDate !== undefined) {
    updates.availableDate = data.availableDate || data.pickupDate || null;
  }
  if (data?.departureTime !== undefined) updates.departureTime = toTrimmedString(data.departureTime);
  if (Array.isArray(data?.photos)) updates.photos = data.photos;

  await listingRef.update(updates);
  return { success: true };
});
