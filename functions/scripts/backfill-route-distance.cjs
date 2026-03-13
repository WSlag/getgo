#!/usr/bin/env node

const admin = require('firebase-admin');
const { FieldValue, FieldPath } = require('firebase-admin/firestore');
const {
  resolveCoordinatePair,
  calculateHaversineDistanceKm,
  toWholeKm,
  DEFAULT_COORDS,
} = require('../src/utils/geo');

function parseArg(prefix, fallback = '') {
  const raw = process.argv.find((arg) => arg.startsWith(prefix));
  return raw ? raw.slice(prefix.length) : fallback;
}

const apply = process.argv.includes('--apply');
const includeShipments = !process.argv.includes('--skip-shipments');
const projectId = parseArg('--project=', process.env.GCLOUD_PROJECT || process.env.PROJECT_ID || '');

if (!admin.apps.length) {
  admin.initializeApp(projectId ? { projectId } : undefined);
}

const db = admin.firestore();

function computeListingRouteFields(data = {}) {
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

  return {
    originLat: origin.lat,
    originLng: origin.lng,
    destLat: destination.lat,
    destLng: destination.lng,
    routeDistanceKm: toWholeKm(
      calculateHaversineDistanceKm(origin.lat, origin.lng, destination.lat, destination.lng)
    ),
  };
}

function listingNeedsUpdate(current, next) {
  const asComparableNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };

  return (
    asComparableNumber(current.originLat) !== asComparableNumber(next.originLat) ||
    asComparableNumber(current.originLng) !== asComparableNumber(next.originLng) ||
    asComparableNumber(current.destLat) !== asComparableNumber(next.destLat) ||
    asComparableNumber(current.destLng) !== asComparableNumber(next.destLng) ||
    asComparableNumber(current.routeDistanceKm) !== asComparableNumber(next.routeDistanceKm)
  );
}

async function* scanCollection(ref, pageSize = 300) {
  let cursor = null;

  while (true) {
    let q = ref.orderBy(FieldPath.documentId()).limit(pageSize);
    if (cursor) {
      q = q.startAfter(cursor);
    }

    const snap = await q.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      yield doc;
    }

    cursor = snap.docs[snap.docs.length - 1];
  }
}

async function backfillListings(collectionName) {
  let scanned = 0;
  let toUpdate = 0;
  let updated = 0;

  const batch = db.batch();
  let batchOps = 0;
  const flush = async () => {
    if (!apply || batchOps === 0) return;
    await batch.commit();
    updated += batchOps;
    batchOps = 0;
  };

  for await (const doc of scanCollection(db.collection(collectionName))) {
    scanned += 1;
    const data = doc.data() || {};
    if (!data.origin || !data.destination) continue;

    const normalized = computeListingRouteFields(data);
    if (!listingNeedsUpdate(data, normalized)) continue;

    toUpdate += 1;
    if (apply) {
      batch.set(doc.ref, {
        ...normalized,
        routeDistanceUpdatedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      batchOps += 1;
      if (batchOps >= 400) {
        await flush();
      }
    }
  }

  await flush();

  return { collectionName, scanned, toUpdate, updated: apply ? updated : 0 };
}

async function backfillShipments() {
  if (!includeShipments) {
    return { skipped: true, scanned: 0, toUpdate: 0, updated: 0 };
  }

  let scanned = 0;
  let toUpdate = 0;
  let updated = 0;

  const batch = db.batch();
  let batchOps = 0;

  const contractCache = new Map();
  const flush = async () => {
    if (!apply || batchOps === 0) return;
    await batch.commit();
    updated += batchOps;
    batchOps = 0;
  };

  for await (const doc of scanCollection(db.collection('shipments'))) {
    scanned += 1;
    const data = doc.data() || {};

    let contract = null;
    if (data.contractId) {
      if (contractCache.has(data.contractId)) {
        contract = contractCache.get(data.contractId);
      } else {
        const contractDoc = await db.collection('contracts').doc(data.contractId).get();
        contract = contractDoc.exists ? (contractDoc.data() || {}) : null;
        contractCache.set(data.contractId, contract);
      }
    }

    const origin = resolveCoordinatePair({
      lat: data.originLat ?? contract?.pickupLat,
      lng: data.originLng ?? contract?.pickupLng,
      name: data.origin || contract?.pickupCity || contract?.pickupAddress,
      fallback: DEFAULT_COORDS,
    });
    const destination = resolveCoordinatePair({
      lat: data.destLat ?? contract?.deliveryLat,
      lng: data.destLng ?? contract?.deliveryLng,
      name: data.destination || contract?.deliveryCity || contract?.deliveryAddress,
      fallback: DEFAULT_COORDS,
    });

    if (
      Number(data.originLat) === Number(origin.lat) &&
      Number(data.originLng) === Number(origin.lng) &&
      Number(data.destLat) === Number(destination.lat) &&
      Number(data.destLng) === Number(destination.lng)
    ) {
      continue;
    }

    toUpdate += 1;
    if (apply) {
      batch.set(doc.ref, {
        originLat: origin.lat,
        originLng: origin.lng,
        destLat: destination.lat,
        destLng: destination.lng,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      batchOps += 1;
      if (batchOps >= 400) {
        await flush();
      }
    }
  }

  await flush();

  return { skipped: false, scanned, toUpdate, updated: apply ? updated : 0 };
}

async function main() {
  console.log(`Route backfill mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);
  if (projectId) {
    console.log(`Project: ${projectId}`);
  }

  const cargo = await backfillListings('cargoListings');
  const truck = await backfillListings('truckListings');
  const shipments = await backfillShipments();

  console.log(JSON.stringify({ cargo, truck, shipments }, null, 2));
}

main().catch((error) => {
  console.error('Route backfill failed:', error);
  process.exit(1);
});
