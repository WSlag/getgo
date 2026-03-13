#!/usr/bin/env node

const admin = require('firebase-admin');
const assert = require('assert');
const {
  computeProgressTowardDestination,
  calculateHaversineDistanceKm,
  resolveCoordinatePair,
  DEFAULT_COORDS,
} = require('../src/utils/geo');

const projectId = process.env.PW_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'karga-ph';

if (!admin.apps.length) {
  admin.initializeApp({ projectId });
}

const db = admin.firestore();

async function waitForCondition(checkFn, timeoutMs = 20000, intervalMs = 400) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await checkFn();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return null;
}

async function testListingNormalization() {
  const listingRef = db.collection('cargoListings').doc(`route_smoke_${Date.now()}`);

  await listingRef.set({
    userId: 'smoke-user',
    userName: 'Smoke User',
    origin: 'Manila',
    destination: 'Cebu City',
    status: 'open',
    bidCount: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const normalized = await waitForCondition(async () => {
    const doc = await listingRef.get();
    const data = doc.data() || {};
    if (typeof data.routeDistanceKm === 'number' && typeof data.originLat === 'number' && typeof data.destLat === 'number') {
      return data;
    }
    return null;
  });

  assert(normalized, 'listing normalization trigger did not populate route fields');

  const firstUpdatedAtMillis = normalized.routeDistanceUpdatedAt?.toMillis?.() || 0;
  assert(firstUpdatedAtMillis > 0, 'routeDistanceUpdatedAt should be populated by trigger');

  await listingRef.update({
    description: `updated-${Date.now()}`,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Wait briefly to allow any unexpected trigger rewrites to occur.
  await new Promise((resolve) => setTimeout(resolve, 2500));

  const afterNoRouteChange = (await listingRef.get()).data() || {};
  const secondUpdatedAtMillis = afterNoRouteChange.routeDistanceUpdatedAt?.toMillis?.() || 0;

  assert(
    secondUpdatedAtMillis === firstUpdatedAtMillis,
    'routeDistanceUpdatedAt changed on non-route update; trigger idempotency broken'
  );

  await listingRef.delete();
}

function testProgressHelper() {
  const origin = resolveCoordinatePair({ name: 'Manila', fallback: DEFAULT_COORDS });
  const destination = resolveCoordinatePair({ name: 'Cebu City', fallback: DEFAULT_COORDS });

  const atOrigin = computeProgressTowardDestination({
    origin,
    destination,
    current: origin,
    previousProgress: 0,
  });
  assert(atOrigin >= 0, 'progress at origin should be >= 0');

  const nearDestination = {
    lat: destination.lat - 0.05,
    lng: destination.lng - 0.05,
  };

  const p1 = computeProgressTowardDestination({
    origin,
    destination,
    current: nearDestination,
    previousProgress: atOrigin,
  });

  const p2 = computeProgressTowardDestination({
    origin,
    destination,
    current: origin,
    previousProgress: p1,
  });

  assert(p1 >= atOrigin, 'progress should increase when moving toward destination');
  assert(p2 >= p1, 'progress should remain monotonic');

  const distance = calculateHaversineDistanceKm(origin.lat, origin.lng, destination.lat, destination.lng);
  assert(distance > 0, 'distance helper should return positive value for known route');
}

async function main() {
  console.log('Running route distance smoke checks...');
  await testListingNormalization();
  testProgressHelper();
  console.log('Route distance smoke checks passed.');
}

main().catch((error) => {
  console.error('Route distance smoke checks failed:', error);
  process.exit(1);
});
