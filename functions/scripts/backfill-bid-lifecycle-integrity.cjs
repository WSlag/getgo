#!/usr/bin/env node

const admin = require('firebase-admin');
const { FieldPath } = require('firebase-admin/firestore');

const PAGE_SIZE = 300;
const ACTIVE_BID_STATUSES = new Set(['pending', 'accepted']);

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function parseArg(prefix, fallback = '') {
  const raw = process.argv.find((arg) => arg.startsWith(prefix));
  return raw ? raw.slice(prefix.length) : fallback;
}

function normalizeStatus(status) {
  return String(status || '').trim().toLowerCase();
}

function isActiveBidStatus(status) {
  return ACTIVE_BID_STATUSES.has(normalizeStatus(status));
}

function listingKey(collectionName, listingId) {
  return `${collectionName}/${listingId}`;
}

function parseBidListingReference(bid = {}) {
  const cargoListingId = typeof bid.cargoListingId === 'string' ? bid.cargoListingId.trim() : '';
  const truckListingId = typeof bid.truckListingId === 'string' ? bid.truckListingId.trim() : '';
  const listingType = normalizeStatus(bid.listingType);
  const fallbackListingId = typeof bid.listingId === 'string' ? bid.listingId.trim() : '';

  if (cargoListingId) {
    return { collection: 'cargoListings', listingId: cargoListingId };
  }
  if (truckListingId) {
    return { collection: 'truckListings', listingId: truckListingId };
  }
  if (listingType === 'cargo' && fallbackListingId) {
    return { collection: 'cargoListings', listingId: fallbackListingId };
  }
  if (listingType === 'truck' && fallbackListingId) {
    return { collection: 'truckListings', listingId: fallbackListingId };
  }
  return null;
}

async function* scanCollection(ref, pageSize = PAGE_SIZE) {
  let cursor = null;
  while (true) {
    let q = ref.orderBy(FieldPath.documentId()).limit(pageSize);
    if (cursor) {
      q = q.startAfter(cursor);
    }
    const snap = await q.get();
    if (snap.empty) break;

    for (const docSnap of snap.docs) {
      yield docSnap;
    }

    cursor = snap.docs[snap.docs.length - 1];
    if (snap.size < pageSize) break;
  }
}

async function commitBatch({ db, apply, batch, pendingOps }) {
  if (!apply || pendingOps.value === 0) return;
  await batch.value.commit();
  batch.value = db.batch();
  pendingOps.value = 0;
}

async function gatherCancelledContractBidFixes(db) {
  const bidStatusCache = new Map();
  const bidIdsToCancel = new Set();
  let contractsScanned = 0;
  let cancelledContracts = 0;
  let linkedBidRefs = 0;
  let missingBidRefs = 0;
  let alreadyCancelled = 0;

  for await (const contractDoc of scanCollection(db.collection('contracts'))) {
    contractsScanned += 1;
    const contract = contractDoc.data() || {};
    if (normalizeStatus(contract.status) !== 'cancelled') continue;
    cancelledContracts += 1;

    const bidId = typeof contract.bidId === 'string' ? contract.bidId.trim() : '';
    if (!bidId) continue;
    linkedBidRefs += 1;

    if (!bidStatusCache.has(bidId)) {
      const bidDoc = await db.collection('bids').doc(bidId).get();
      if (!bidDoc.exists) {
        bidStatusCache.set(bidId, null);
      } else {
        const bidData = bidDoc.data() || {};
        bidStatusCache.set(bidId, {
          exists: true,
          status: normalizeStatus(bidData.status),
        });
      }
    }

    const cached = bidStatusCache.get(bidId);
    if (!cached || !cached.exists) {
      missingBidRefs += 1;
      continue;
    }

    if (cached.status === 'cancelled') {
      alreadyCancelled += 1;
      continue;
    }

    bidIdsToCancel.add(bidId);
  }

  return {
    contractsScanned,
    cancelledContracts,
    linkedBidRefs,
    missingBidRefs,
    alreadyCancelled,
    bidIdsToCancel,
  };
}

async function applyCancelledBidBackfill(db, bidIdsToCancel, apply) {
  let updated = 0;
  const batch = { value: db.batch() };
  const pendingOps = { value: 0 };

  for (const bidId of bidIdsToCancel) {
    const bidRef = db.collection('bids').doc(bidId);
    batch.value.update(bidRef, {
      status: 'cancelled',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    pendingOps.value += 1;

    if (pendingOps.value >= 400) {
      await commitBatch({ db, apply, batch, pendingOps });
      updated += 400;
    }
  }

  const remaining = pendingOps.value;
  await commitBatch({ db, apply, batch, pendingOps });
  if (apply) {
    updated += remaining;
  }

  return { updated: apply ? updated : 0 };
}

async function buildActiveBidCountMap(db, bidIdsToCancel) {
  const activeCountByListing = new Map();
  let bidsScanned = 0;
  let activeBids = 0;
  let bidsWithInvalidListingRef = 0;

  for await (const bidDoc of scanCollection(db.collection('bids'))) {
    bidsScanned += 1;
    const bid = bidDoc.data() || {};
    const listingRef = parseBidListingReference(bid);
    if (!listingRef || !listingRef.listingId) {
      bidsWithInvalidListingRef += 1;
      continue;
    }

    const status = bidIdsToCancel.has(bidDoc.id) ? 'cancelled' : normalizeStatus(bid.status);
    if (!isActiveBidStatus(status)) continue;

    const key = listingKey(listingRef.collection, listingRef.listingId);
    activeCountByListing.set(key, (activeCountByListing.get(key) || 0) + 1);
    activeBids += 1;
  }

  return {
    activeCountByListing,
    stats: {
      bidsScanned,
      activeBids,
      bidsWithInvalidListingRef,
    },
  };
}

async function reconcileListings({
  db,
  collectionName,
  activeCountByListing,
  apply,
  migrateCargoAvailableToOpen = false,
}) {
  const batch = { value: db.batch() };
  const pendingOps = { value: 0 };
  const seenListingKeys = new Set();
  let listingsScanned = 0;
  let statusUpdates = 0;
  let bidCountUpdates = 0;
  let appliedOps = 0;

  for await (const listingDoc of scanCollection(db.collection(collectionName))) {
    listingsScanned += 1;
    const data = listingDoc.data() || {};
    const key = listingKey(collectionName, listingDoc.id);
    seenListingKeys.add(key);

    const expectedBidCount = Math.max(0, Number(activeCountByListing.get(key) || 0));
    const currentBidCountRaw = Number(data.bidCount);
    const currentBidCount = Number.isFinite(currentBidCountRaw) ? Math.max(0, currentBidCountRaw) : 0;

    const updates = {};
    if (migrateCargoAvailableToOpen && normalizeStatus(data.status) === 'available') {
      updates.status = 'open';
      statusUpdates += 1;
    }
    if (currentBidCount !== expectedBidCount) {
      updates.bidCount = expectedBidCount;
      bidCountUpdates += 1;
    }

    if (Object.keys(updates).length === 0) continue;

    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    if (apply) {
      batch.value.update(listingDoc.ref, updates);
      pendingOps.value += 1;
      appliedOps += 1;
      if (pendingOps.value >= 400) {
        await commitBatch({ db, apply, batch, pendingOps });
      }
    }
  }

  await commitBatch({ db, apply, batch, pendingOps });

  return {
    collectionName,
    listingsScanned,
    statusUpdates,
    bidCountUpdates,
    updatesApplied: apply ? appliedOps : 0,
    seenListingKeys,
  };
}

async function main() {
  const apply = hasFlag('--apply');
  const projectId = parseArg(
    '--project=',
    process.env.GCLOUD_PROJECT || process.env.PROJECT_ID || process.env.FIREBASE_PROJECT_ID || ''
  );

  if (!admin.apps.length) {
    admin.initializeApp(projectId ? { projectId } : undefined);
  }

  const db = admin.firestore();

  console.log(`[bid-lifecycle-backfill] mode=${apply ? 'APPLY' : 'DRY-RUN'}`);
  if (projectId) {
    console.log(`[bid-lifecycle-backfill] project=${projectId}`);
  }

  const cancelledContractBackfill = await gatherCancelledContractBidFixes(db);
  const cancelledBidApply = await applyCancelledBidBackfill(
    db,
    cancelledContractBackfill.bidIdsToCancel,
    apply
  );

  const { activeCountByListing, stats: bidScanStats } = await buildActiveBidCountMap(
    db,
    cancelledContractBackfill.bidIdsToCancel
  );

  const cargoReconcile = await reconcileListings({
    db,
    collectionName: 'cargoListings',
    activeCountByListing,
    apply,
    migrateCargoAvailableToOpen: true,
  });
  const truckReconcile = await reconcileListings({
    db,
    collectionName: 'truckListings',
    activeCountByListing,
    apply,
    migrateCargoAvailableToOpen: false,
  });

  const seenListingKeys = new Set([
    ...cargoReconcile.seenListingKeys,
    ...truckReconcile.seenListingKeys,
  ]);
  const orphanActiveBidRefs = Array.from(activeCountByListing.keys()).filter(
    (key) => !seenListingKeys.has(key)
  );

  const summary = {
    generatedAt: new Date().toISOString(),
    apply,
    projectId: projectId || null,
    cancelledContractBidBackfill: {
      ...cancelledContractBackfill,
      bidIdsToCancel: cancelledContractBackfill.bidIdsToCancel.size,
      ...cancelledBidApply,
    },
    activeBidScan: bidScanStats,
    listingReconcile: {
      cargo: {
        collectionName: cargoReconcile.collectionName,
        listingsScanned: cargoReconcile.listingsScanned,
        statusUpdates: cargoReconcile.statusUpdates,
        bidCountUpdates: cargoReconcile.bidCountUpdates,
        updatesApplied: cargoReconcile.updatesApplied,
      },
      truck: {
        collectionName: truckReconcile.collectionName,
        listingsScanned: truckReconcile.listingsScanned,
        statusUpdates: truckReconcile.statusUpdates,
        bidCountUpdates: truckReconcile.bidCountUpdates,
        updatesApplied: truckReconcile.updatesApplied,
      },
      orphanActiveBidRefs: orphanActiveBidRefs.length,
      orphanActiveBidRefKeysSample: orphanActiveBidRefs.slice(0, 50),
    },
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error('[bid-lifecycle-backfill] failed:', error);
  process.exit(1);
});
