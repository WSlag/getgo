#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { FieldPath } = require('firebase-admin/firestore');
const { resolveEffectivePostingRole } = require('../src/utils/roleResolution');

const VALID_ROLES = new Set(['shipper', 'trucker']);
const PAGE_SIZE = 300;
const MAX_DETAIL_ROWS = 1000;

function getArgValue(flag) {
  const idx = process.argv.findIndex((arg) => arg === flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) {
    out.push(list.slice(i, i + size));
  }
  return out;
}

function normalizeRole(value) {
  return String(value || '').trim().toLowerCase();
}

async function scanCollectionPaged(queryFactory, onDocs) {
  let cursor = null;
  while (true) {
    let q = queryFactory();
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.limit(PAGE_SIZE).get();
    if (snap.empty) break;
    await onDocs(snap.docs);
    cursor = snap.docs[snap.docs.length - 1];
    if (snap.size < PAGE_SIZE) break;
  }
}

async function buildUserRoleResolver(db) {
  const cache = new Map();
  return async (userId) => {
    const uid = String(userId || '').trim();
    if (!uid) return null;
    if (cache.has(uid)) return cache.get(uid);
    const doc = await db.collection('users').doc(uid).get();
    if (!doc.exists) {
      cache.set(uid, null);
      return null;
    }
    const role = resolveEffectivePostingRole(doc.data() || {});
    cache.set(uid, role);
    return role;
  };
}

async function migrateLegacyBrokerRoles(db, applyChanges) {
  const brokerUsers = [];
  await scanCollectionPaged(
    () => db.collection('users').where('role', '==', 'broker').orderBy(FieldPath.documentId()),
    async (docs) => {
      docs.forEach((doc) => brokerUsers.push({ id: doc.id, data: doc.data() || {} }));
    }
  );

  const migratable = [];
  const unresolved = [];
  brokerUsers.forEach((item) => {
    const sourceRole = normalizeRole(item.data.brokerSourceRole);
    if (VALID_ROLES.has(sourceRole)) {
      migratable.push({
        userId: item.id,
        fromRole: 'broker',
        toRole: sourceRole,
        brokerSourceRole: sourceRole,
      });
    } else {
      unresolved.push({
        userId: item.id,
        role: normalizeRole(item.data.role) || null,
        brokerSourceRole: sourceRole || null,
      });
    }
  });

  if (applyChanges && migratable.length > 0) {
    for (const items of chunk(migratable, 400)) {
      const batch = db.batch();
      items.forEach((row) => {
        batch.update(db.collection('users').doc(row.userId), {
          role: row.toRole,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
    }
  }

  return {
    totalLegacyBrokerUsers: brokerUsers.length,
    migratableCount: migratable.length,
    unresolvedCount: unresolved.length,
    migratedCount: applyChanges ? migratable.length : 0,
    unresolvedUsers: unresolved,
  };
}

async function generateListingMismatchReport(db) {
  const resolveRole = await buildUserRoleResolver(db);
  const cargoMismatches = [];
  const truckMismatches = [];
  let cargoScanned = 0;
  let truckScanned = 0;
  let cargoMismatchCount = 0;
  let truckMismatchCount = 0;

  await scanCollectionPaged(
    () => db.collection('cargoListings').orderBy(FieldPath.documentId()),
    async (docs) => {
      for (const doc of docs) {
        cargoScanned += 1;
        const data = doc.data() || {};
        const ownerId = String(data.userId || data.shipperId || '').trim();
        const ownerRole = ownerId ? await resolveRole(ownerId) : null;
        if (ownerRole !== 'shipper') {
          cargoMismatchCount += 1;
          if (cargoMismatches.length < MAX_DETAIL_ROWS) {
            cargoMismatches.push({
              listingId: doc.id,
              listingType: 'cargo',
              ownerId: ownerId || null,
              ownerEffectiveRole: ownerRole,
              status: data.status || null,
            });
          }
        }
      }
    }
  );

  await scanCollectionPaged(
    () => db.collection('truckListings').orderBy(FieldPath.documentId()),
    async (docs) => {
      for (const doc of docs) {
        truckScanned += 1;
        const data = doc.data() || {};
        const ownerId = String(data.userId || data.truckerId || '').trim();
        const ownerRole = ownerId ? await resolveRole(ownerId) : null;
        if (ownerRole !== 'trucker') {
          truckMismatchCount += 1;
          if (truckMismatches.length < MAX_DETAIL_ROWS) {
            truckMismatches.push({
              listingId: doc.id,
              listingType: 'truck',
              ownerId: ownerId || null,
              ownerEffectiveRole: ownerRole,
              status: data.status || null,
            });
          }
        }
      }
    }
  );

  return {
    cargoScanned,
    truckScanned,
    cargoMismatchCount,
    truckMismatchCount,
    cargoMismatches,
    truckMismatches,
    detailRowLimit: MAX_DETAIL_ROWS,
  };
}

async function main() {
  const applyChanges = hasFlag('--apply');
  const projectId = getArgValue('--project')
    || process.env.GCLOUD_PROJECT
    || process.env.FIREBASE_PROJECT_ID
    || undefined;
  const reportPathArg = getArgValue('--report');

  admin.initializeApp(projectId ? { projectId } : undefined);
  const db = admin.firestore();

  const migration = await migrateLegacyBrokerRoles(db, applyChanges);
  const mismatches = await generateListingMismatchReport(db);

  const report = {
    generatedAt: new Date().toISOString(),
    projectId: projectId || null,
    applyChanges,
    migration,
    mismatches,
  };

  const defaultFile = `broker-role-migration-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const reportFilePath = reportPathArg
    ? path.resolve(reportPathArg)
    : path.resolve(process.cwd(), defaultFile);
  fs.writeFileSync(reportFilePath, JSON.stringify(report, null, 2), 'utf8');

  console.log(`[broker-role-migration] apply=${applyChanges}`);
  console.log(`[broker-role-migration] totalLegacy=${migration.totalLegacyBrokerUsers} migratable=${migration.migratableCount} unresolved=${migration.unresolvedCount}`);
  console.log(`[broker-role-migration] cargoScanned=${mismatches.cargoScanned} cargoMismatch=${mismatches.cargoMismatchCount}`);
  console.log(`[broker-role-migration] truckScanned=${mismatches.truckScanned} truckMismatch=${mismatches.truckMismatchCount}`);
  console.log(`[broker-role-migration] report=${reportFilePath}`);
}

main().catch((error) => {
  console.error('[broker-role-migration] failed:', error?.message || error);
  process.exit(1);
});
