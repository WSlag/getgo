#!/usr/bin/env node
/* eslint-disable no-console */

const admin = require('firebase-admin');

function parseNumberFlag(name, fallback) {
  const raw = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (!raw) return fallback;
  const value = Number(raw.split('=')[1]);
  return Number.isFinite(value) ? value : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function normalizeId(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function scoreIsValid(score) {
  const parsed = Number(score);
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 5;
}

function createSummary() {
  return {
    total: 0,
    missingCanonical: 0,
    inconsistentTarget: 0,
    invalidScore: 0,
    alreadyNormalized: 0,
    updated: 0,
    skippedNoTarget: 0,
  };
}

async function processRatings({ db, apply, pageSize }) {
  const summary = createSummary();
  let lastDoc = null;

  while (true) {
    let query = db.collection('ratings')
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(pageSize);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snap = await query.get();
    if (snap.empty) break;

    const batch = apply ? db.batch() : null;
    let pendingWrites = 0;

    snap.docs.forEach((doc) => {
      summary.total += 1;
      const data = doc.data() || {};
      const canonicalRateeId = normalizeId(data.rateeId) || normalizeId(data.ratedUserId);
      const legacyRateeId = normalizeId(data.ratedUserId);
      const currentRateeId = normalizeId(data.rateeId);
      const hasMismatch = currentRateeId && legacyRateeId && currentRateeId !== legacyRateeId;

      if (!canonicalRateeId) {
        summary.missingCanonical += 1;
        summary.skippedNoTarget += 1;
      }

      if (hasMismatch) {
        summary.inconsistentTarget += 1;
      }

      if (!scoreIsValid(data.score)) {
        summary.invalidScore += 1;
      }

      if (!apply) return;
      if (!canonicalRateeId) return;

      const updates = {};
      if (currentRateeId !== canonicalRateeId) {
        updates.rateeId = canonicalRateeId;
      }
      if (legacyRateeId !== canonicalRateeId) {
        updates.ratedUserId = canonicalRateeId;
      }

      if (Object.keys(updates).length === 0) {
        summary.alreadyNormalized += 1;
        return;
      }

      updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
      batch.update(doc.ref, updates);
      pendingWrites += 1;
      summary.updated += 1;
    });

    if (apply && pendingWrites > 0) {
      await batch.commit();
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < pageSize) break;
  }

  return summary;
}

function printSummary(title, summary) {
  console.log(`\n${title}`);
  console.log('='.repeat(title.length));
  console.log(`Total ratings scanned: ${summary.total}`);
  console.log(`Missing canonical target (rateeId/ratedUserId): ${summary.missingCanonical}`);
  console.log(`Inconsistent target ids (rateeId vs ratedUserId): ${summary.inconsistentTarget}`);
  console.log(`Invalid score rows: ${summary.invalidScore}`);
  console.log(`Already normalized rows: ${summary.alreadyNormalized}`);
  console.log(`Updated rows: ${summary.updated}`);
  console.log(`Skipped rows (no target): ${summary.skippedNoTarget}`);
}

async function main() {
  const apply = hasFlag('--apply');
  const pageSize = Math.min(Math.max(parseNumberFlag('--page-size', 250), 25), 500);
  const maxMismatch = Math.max(parseNumberFlag('--max-mismatch', 0), 0);
  const maxInvalidScore = Math.max(parseNumberFlag('--max-invalid-score', 0), 0);

  if (!admin.apps.length) {
    admin.initializeApp();
  }

  const db = admin.firestore();

  console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Page size: ${pageSize}`);
  console.log(`Blocking threshold (target mismatches): ${maxMismatch}`);
  console.log(`Blocking threshold (invalid score rows): ${maxInvalidScore}`);

  const preSummary = await processRatings({ db, apply: false, pageSize });
  printSummary('Pre-migration analysis', preSummary);

  if (apply) {
    const applySummary = await processRatings({ db, apply: true, pageSize });
    printSummary('Apply pass summary', applySummary);
  }

  const verifySummary = await processRatings({ db, apply: false, pageSize });
  printSummary('Post-migration verification', verifySummary);

  const targetMismatchCount = verifySummary.missingCanonical + verifySummary.inconsistentTarget;
  const exceedsTargetThreshold = targetMismatchCount > maxMismatch;
  const exceedsInvalidScoreThreshold = verifySummary.invalidScore > maxInvalidScore;

  if (exceedsTargetThreshold || exceedsInvalidScoreThreshold) {
    console.error('\nVerification failed: blocking thresholds exceeded.');
    console.error(`Target mismatches: ${targetMismatchCount} (max ${maxMismatch})`);
    console.error(`Invalid score rows: ${verifySummary.invalidScore} (max ${maxInvalidScore})`);
    process.exit(1);
  }

  console.log('\nVerification passed within thresholds.');
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
