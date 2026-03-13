const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { FieldValue } = require('firebase-admin/firestore');

const {
  DEFAULT_COORDS,
  resolveCoordinatePair,
  calculateHaversineDistanceKm,
  toWholeKm,
} = require('../utils/geo');

function buildNormalizedRouteFields(data = {}) {
  const origin = resolveCoordinatePair({
    lat: data.originLat,
    lng: data.originLng,
    name: data.origin,
    fallback: DEFAULT_COORDS,
  });

  const destination = resolveCoordinatePair({
    lat: data.destLat,
    lng: data.destLng,
    name: data.destination,
    fallback: DEFAULT_COORDS,
  });

  const distanceKm = toWholeKm(
    calculateHaversineDistanceKm(origin.lat, origin.lng, destination.lat, destination.lng)
  );

  return {
    originLat: origin.lat,
    originLng: origin.lng,
    destLat: destination.lat,
    destLng: destination.lng,
    routeDistanceKm: distanceKm,
  };
}

function routeFieldsChanged(current = {}, normalized = {}) {
  const asComparableNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };

  return (
    asComparableNumber(current.originLat) !== asComparableNumber(normalized.originLat) ||
    asComparableNumber(current.originLng) !== asComparableNumber(normalized.originLng) ||
    asComparableNumber(current.destLat) !== asComparableNumber(normalized.destLat) ||
    asComparableNumber(current.destLng) !== asComparableNumber(normalized.destLng) ||
    asComparableNumber(current.routeDistanceKm) !== asComparableNumber(normalized.routeDistanceKm)
  );
}

async function normalizeListingRoute(event) {
  const afterSnap = event.data?.after;
  if (!afterSnap?.exists) return null;

  const after = afterSnap.data() || {};
  if (typeof after.origin !== 'string' || typeof after.destination !== 'string') {
    return null;
  }

  const normalized = buildNormalizedRouteFields(after);
  if (!routeFieldsChanged(after, normalized)) {
    return null;
  }

  await afterSnap.ref.set(
    {
      ...normalized,
      routeDistanceUpdatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return null;
}

exports.onCargoListingRouteNormalized = onDocumentWritten(
  {
    region: 'asia-southeast1',
    document: 'cargoListings/{listingId}',
  },
  normalizeListingRoute
);

exports.onTruckListingRouteNormalized = onDocumentWritten(
  {
    region: 'asia-southeast1',
    document: 'truckListings/{listingId}',
  },
  normalizeListingRoute
);
