#!/usr/bin/env node
/**
 * Push Notification Smoke Test
 *
 * Connects to the real karga-ph project and:
 *   1. Lists all FCM tokens registered for the given user
 *   2. Sends a test push notification via FCM
 *   3. Checks stale-token cleanup is wired correctly
 *
 * Usage:
 *   node functions/scripts/smoke-push-notifications.cjs --uid <firebase-uid> [--key <path/to/serviceAccountKey.json>]
 *
 * Auth (pick one):
 *   --key path/to/serviceAccountKey.json   (download from Firebase Console → Project Settings → Service Accounts)
 *   GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service account key
 */

const admin = require('firebase-admin');
const fs = require('fs');

const PROJECT_ID = 'karga-ph';

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return null;
  return process.argv[idx + 1];
}

function pass(msg) { console.log(`  ✓ ${msg}`); }
function fail(msg) { console.error(`  ✗ ${msg}`); process.exitCode = 1; }
function info(msg) { console.log(`  · ${msg}`); }

async function run() {
  const uid = getArg('--uid');
  const keyPath = getArg('--key');

  if (!uid) {
    console.error('Usage: node smoke-push-notifications.cjs --uid <firebase-uid> [--key <serviceAccountKey.json>]');
    process.exit(1);
  }

  console.log(`\nPush Notification Smoke Test — project: ${PROJECT_ID}`);
  console.log(`Target UID: ${uid}\n`);

  // ── Init ──────────────────────────────────────────────────────────────────
  let credential;
  if (keyPath) {
    if (!fs.existsSync(keyPath)) {
      console.error(`Service account key not found: ${keyPath}`);
      process.exit(1);
    }
    const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    credential = admin.credential.cert(serviceAccount);
    info(`Using service account: ${serviceAccount.client_email}`);
  } else {
    info('Using Application Default Credentials');
  }

  admin.initializeApp({ projectId: PROJECT_ID, ...(credential ? { credential } : {}) });
  const db = admin.firestore();
  const messaging = admin.messaging();

  // ── Step 1: Fetch FCM tokens ───────────────────────────────────────────────
  console.log('Step 1: Check FCM tokens in Firestore');
  const tokensSnap = await db
    .collection('users').doc(uid)
    .collection('fcmTokens')
    .limit(10)
    .get();

  if (tokensSnap.empty) {
    fail('No FCM tokens found for this user.');
    info('Make sure the user has logged in and granted push permission on a device.');
    info('Check Firestore → users/{uid}/fcmTokens');
    process.exit(1);
  }

  const tokens = tokensSnap.docs.map((d) => {
    const data = d.data();
    return { id: d.id, platform: data.platform || '?', ua: (data.userAgent || '').slice(0, 60) };
  });

  pass(`Found ${tokens.length} token(s):`);
  tokens.forEach((t, i) => {
    info(`  [${i + 1}] ${t.id.slice(0, 40)}… (${t.platform})`);
  });

  // ── Step 2: Send test push ─────────────────────────────────────────────────
  console.log('\nStep 2: Send test push notification');
  const tokenIds = tokens.map((t) => t.id);

  let response;
  try {
    response = await messaging.sendEachForMulticast({
      tokens: tokenIds,
      notification: {
        title: '🔔 Push Test',
        body: 'If you see this, FCM is working end-to-end.',
      },
      data: {
        type: 'SMOKE_TEST',
        ts: String(Date.now()),
      },
      webpush: {
        notification: {
          icon: 'https://getgoph.com/icons/icon-192x192.png',
          badge: 'https://getgoph.com/icons/icon-72x72.png',
          requireInteraction: false,
        },
      },
    });
  } catch (err) {
    fail(`FCM sendEachForMulticast threw: ${err.message}`);
    process.exit(1);
  }

  const successCount = response.responses.filter((r) => r.success).length;
  const failCount = response.responses.filter((r) => !r.success).length;

  if (successCount > 0) {
    pass(`${successCount}/${tokenIds.length} token(s) delivered successfully.`);
  }
  if (failCount > 0) {
    const errors = response.responses
      .filter((r) => !r.success)
      .map((r) => r.error?.code || r.error?.message || 'unknown');
    fail(`${failCount}/${tokenIds.length} token(s) failed: ${[...new Set(errors)].join(', ')}`);
  }

  // ── Step 3: Stale token cleanup check ─────────────────────────────────────
  console.log('\nStep 3: Stale token cleanup');
  const staleTokenIds = [];
  response.responses.forEach((r, i) => {
    const code = r.error?.code || '';
    if (
      code === 'messaging/registration-token-not-registered' ||
      code === 'messaging/invalid-registration-token'
    ) {
      staleTokenIds.push(tokenIds[i]);
    }
  });

  if (staleTokenIds.length === 0) {
    pass('No stale tokens detected.');
  } else {
    info(`Cleaning up ${staleTokenIds.length} stale token(s)...`);
    const batch = db.batch();
    staleTokenIds.forEach((tokenId) => {
      batch.delete(db.collection('users').doc(uid).collection('fcmTokens').doc(tokenId));
    });
    await batch.commit();
    pass(`Removed ${staleTokenIds.length} stale token(s) from Firestore.`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────');
  if (process.exitCode === 1) {
    console.error('Smoke test FAILED — check errors above.');
  } else {
    console.log('Smoke test PASSED');
    console.log('Check the target device for a notification titled "Push Test".');
  }
  console.log('─────────────────────────────────────────\n');
}

run().catch((err) => {
  console.error('\nUnhandled error:', err.message || err);
  process.exit(1);
});
