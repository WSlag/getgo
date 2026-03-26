#!/usr/bin/env node
/* eslint-disable no-console */

const admin = require('firebase-admin');
const {
  recomputeUserRatingAggregate,
  getMergedRatingDocsForRatee,
  computeRatingAggregateFromDocs,
  getBadgeForTrucker,
} = require('../src/services/ratingAggregation');

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

function createReconcileSummary() {
  return {
    candidateCount: 0,
    processed: 0,
    updated: 0,
    wouldUpdate: 0,
    unchanged: 0,
    skippedMissingUser: 0,
    failed: 0,
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

async function collectCandidateRateeIds({ db, pageSize }) {
  const rateeIds = new Set();
  let scannedRatings = 0;
  let scannedUsers = 0;

  let lastRatingDoc = null;
  while (true) {
    let ratingQuery = db.collection('ratings')
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(pageSize);
    if (lastRatingDoc) {
      ratingQuery = ratingQuery.startAfter(lastRatingDoc);
    }

    const ratingSnap = await ratingQuery.get();
    if (ratingSnap.empty) break;

    ratingSnap.docs.forEach((docSnap) => {
      scannedRatings += 1;
      const data = docSnap.data() || {};
      const rateeId = normalizeId(data.rateeId) || normalizeId(data.ratedUserId);
      if (rateeId) {
        rateeIds.add(rateeId);
      }
    });

    lastRatingDoc = ratingSnap.docs[ratingSnap.docs.length - 1];
    if (ratingSnap.size < pageSize) break;
  }

  let lastUserDoc = null;
  while (true) {
    let userQuery = db.collection('users')
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(pageSize);
    if (lastUserDoc) {
      userQuery = userQuery.startAfter(lastUserDoc);
    }

    const userSnap = await userQuery.get();
    if (userSnap.empty) break;

    userSnap.docs.forEach((docSnap) => {
      scannedUsers += 1;
      const data = docSnap.data() || {};
      const totalRatings = Number(data.totalRatings || 0);
      const averageRating = Number(data.averageRating || 0);
      if (totalRatings > 0 || averageRating > 0) {
        rateeIds.add(docSnap.id);
      }
    });

    lastUserDoc = userSnap.docs[userSnap.docs.length - 1];
    if (userSnap.size < pageSize) break;
  }

  return {
    rateeIds: Array.from(rateeIds),
    scannedRatings,
    scannedUsers,
  };
}

async function analyzeAggregateDelta(db, rateeId) {
  const userRef = db.collection('users').doc(rateeId);
  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    return {
      missingUser: true,
      changed: false,
    };
  }

  const userData = userDoc.data() || {};
  const ratingDocs = await getMergedRatingDocsForRatee(db, rateeId);
  const aggregate = computeRatingAggregateFromDocs(ratingDocs);

  const currentAverage = Number(userData.averageRating || 0);
  const currentTotal = Number(userData.totalRatings || 0);
  const userChanged = (
    Math.abs(currentAverage - aggregate.averageRating) > 0.0001
    || currentTotal !== aggregate.totalRatings
  );

  let truckerChanged = false;
  if (userData.role === 'trucker') {
    const truckerDoc = await userRef.collection('truckerProfile').doc('profile').get();
    if (truckerDoc.exists) {
      const truckerData = truckerDoc.data() || {};
      const currentBadge = String(truckerData.badge || 'STARTER').toUpperCase();
      const currentTruckerRating = Number(truckerData.rating || 0);
      const nextBadge = getBadgeForTrucker(aggregate.averageRating, Number(truckerData.totalTrips || 0));
      truckerChanged = (
        Math.abs(currentTruckerRating - aggregate.averageRating) > 0.0001
        || currentBadge !== nextBadge
      );
    }
  }

  return {
    missingUser: false,
    changed: userChanged || truckerChanged,
  };
}

async function reconcileRatingAggregates({ db, rateeIds, apply }) {
  const summary = createReconcileSummary();
  summary.candidateCount = rateeIds.length;

  for (const rateeId of rateeIds) {
    try {
      if (!apply) {
        const delta = await analyzeAggregateDelta(db, rateeId);
        if (delta.missingUser) {
          summary.skippedMissingUser += 1;
          continue;
        }
        summary.processed += 1;
        if (delta.changed) summary.wouldUpdate += 1;
        else summary.unchanged += 1;
        continue;
      }

      const result = await recomputeUserRatingAggregate({
        db,
        rateeId,
        notifyBadgeUpgrade: false,
      });

      if (result.skippedReason === 'missing_user') {
        summary.skippedMissingUser += 1;
        continue;
      }

      summary.processed += 1;
      if (result.userChanged || result.truckerChanged) {
        summary.updated += 1;
      } else {
        summary.unchanged += 1;
      }
    } catch (error) {
      summary.failed += 1;
      console.error(`Aggregate reconcile failed for user ${rateeId}:`, error.message || error);
    }
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

function printReconcileSummary(title, summary) {
  console.log(`\n${title}`);
  console.log('='.repeat(title.length));
  console.log(`Candidates: ${summary.candidateCount}`);
  console.log(`Processed users: ${summary.processed}`);
  console.log(`Would update (dry-run): ${summary.wouldUpdate}`);
  console.log(`Updated (apply): ${summary.updated}`);
  console.log(`Unchanged: ${summary.unchanged}`);
  console.log(`Skipped missing users: ${summary.skippedMissingUser}`);
  console.log(`Failed: ${summary.failed}`);
}

async function main() {
  const apply = hasFlag('--apply');
  const reconcileAggregates = hasFlag('--reconcile-aggregates');
  const pageSize = Math.min(Math.max(parseNumberFlag('--page-size', 250), 25), 500);
  const reconcilePageSize = Math.min(Math.max(parseNumberFlag('--reconcile-page-size', pageSize), 25), 500);
  const maxMismatch = Math.max(parseNumberFlag('--max-mismatch', 0), 0);
  const maxInvalidScore = Math.max(parseNumberFlag('--max-invalid-score', 0), 0);

  if (!admin.apps.length) {
    admin.initializeApp();
  }

  const db = admin.firestore();

  console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Schema page size: ${pageSize}`);
  console.log(`Reconcile aggregates: ${reconcileAggregates ? 'enabled' : 'disabled'}`);
  if (reconcileAggregates) {
    console.log(`Reconcile page size: ${reconcilePageSize}`);
  }
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

  if (!reconcileAggregates) return;

  const candidates = await collectCandidateRateeIds({ db, pageSize: reconcilePageSize });
  console.log('\nAggregate reconcile candidate collection');
  console.log('=====================================');
  console.log(`Ratings scanned: ${candidates.scannedRatings}`);
  console.log(`Users scanned: ${candidates.scannedUsers}`);
  console.log(`Unique candidate users: ${candidates.rateeIds.length}`);

  const reconcileDrySummary = await reconcileRatingAggregates({
    db,
    rateeIds: candidates.rateeIds,
    apply: false,
  });
  printReconcileSummary('Aggregate reconcile dry-run', reconcileDrySummary);

  if (!apply) return;

  const reconcileApplySummary = await reconcileRatingAggregates({
    db,
    rateeIds: candidates.rateeIds,
    apply: true,
  });
  printReconcileSummary('Aggregate reconcile apply', reconcileApplySummary);

  const reconcileVerifySummary = await reconcileRatingAggregates({
    db,
    rateeIds: candidates.rateeIds,
    apply: false,
  });
  printReconcileSummary('Aggregate reconcile verification', reconcileVerifySummary);
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
