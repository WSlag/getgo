#!/usr/bin/env node
/* eslint-disable no-console */

const admin = require('firebase-admin');

function hasFlag(name) {
  return process.argv.includes(name);
}

function parseNumberFlag(name, fallback) {
  const raw = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (!raw) return fallback;
  const value = Number(raw.split('=')[1]);
  return Number.isFinite(value) ? value : fallback;
}

function isAdminUser(userData) {
  if (!userData || typeof userData !== 'object') return false;
  if (userData.isAdmin === true) return true;
  return String(userData.role || '').toLowerCase() === 'admin';
}

async function main() {
  const apply = hasFlag('--apply');
  const pageSize = Math.min(Math.max(parseNumberFlag('--page-size', 250), 25), 500);

  if (!admin.apps.length) {
    admin.initializeApp();
  }

  const db = admin.firestore();
  const usersRef = db.collection('users');

  let scanned = 0;
  let adminSkipped = 0;
  let nonAdminMatched = 0;
  let updated = 0;
  let unchanged = 0;
  let lastDoc = null;

  console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Page size: ${pageSize}`);

  while (true) {
    let query = usersRef
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(pageSize);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snap = await query.get();
    if (snap.empty) break;

    const batch = apply ? db.batch() : null;
    let pageUpdates = 0;

    snap.docs.forEach((docSnap) => {
      scanned += 1;
      const userData = docSnap.data() || {};

      if (isAdminUser(userData)) {
        adminSkipped += 1;
        return;
      }

      nonAdminMatched += 1;

      const needsReset = Boolean(
        userData.email != null
        || userData.emailAuthEnabled !== false
        || userData.emailAuthVerified !== false
        || userData.emailLinkedAt != null
      );

      if (!needsReset) {
        unchanged += 1;
        return;
      }

      if (apply) {
        batch.set(docSnap.ref, {
          email: null,
          emailAuthEnabled: false,
          emailAuthVerified: false,
          emailLinkedAt: null,
          emailAuthUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      updated += 1;
      pageUpdates += 1;
    });

    if (apply && pageUpdates > 0) {
      await batch.commit();
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < pageSize) break;
  }

  console.log('\nReset summary');
  console.log('=============');
  console.log(`Scanned users: ${scanned}`);
  console.log(`Skipped admin users: ${adminSkipped}`);
  console.log(`Matched non-admin users: ${nonAdminMatched}`);
  console.log(`Users needing reset: ${updated}`);
  console.log(`Users already clean: ${unchanged}`);
  if (!apply) {
    console.log('\nDry-run only. Re-run with --apply to execute updates.');
  }
}

main().catch((error) => {
  console.error('reset-test-user-email-auth failed:', error);
  process.exit(1);
});
