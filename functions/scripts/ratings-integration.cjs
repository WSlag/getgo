const admin = require('firebase-admin');
const axios = require('axios');

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'karga-ph';
const REGION = 'asia-southeast1';
const EMULATOR_HOSTS = {
  auth: process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099',
  firestore: process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080',
  functions: process.env.FUNCTIONS_EMULATOR_HOST || '127.0.0.1:5001',
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function clearEmulators() {
  await axios.delete(`http://${EMULATOR_HOSTS.auth}/emulator/v1/projects/${PROJECT_ID}/accounts`);
  await axios.delete(`http://${EMULATOR_HOSTS.firestore}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`);
}

async function signInWithCustomToken(uid) {
  const token = await admin.auth().createCustomToken(uid);
  const response = await axios.post(
    `http://${EMULATOR_HOSTS.auth}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`,
    { token, returnSecureToken: true }
  );
  const idToken = response.data?.idToken;
  assert(idToken, `Missing idToken for ${uid}`);
  return idToken;
}

async function callFunction(name, idToken, data = {}) {
  try {
    const response = await axios.post(
      `http://${EMULATOR_HOSTS.functions}/${PROJECT_ID}/${REGION}/${name}`,
      { data },
      {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      }
    );

    if (response.data?.error) {
      throw new Error(response.data.error.message || JSON.stringify(response.data.error));
    }

    return response.data?.result ?? response.data?.data ?? response.data;
  } catch (error) {
    const payload = error?.response?.data;
    const message = payload?.error?.message || error.message;
    throw new Error(`${name} failed: ${message}`);
  }
}

async function callFunctionExpectError(name, idToken, data = {}) {
  try {
    await callFunction(name, idToken, data);
  } catch (error) {
    return String(error.message || '');
  }
  throw new Error(`${name} unexpectedly succeeded`);
}

async function seedUser({ uid, phone, role, name }) {
  const now = admin.firestore.FieldValue.serverTimestamp();
  await admin.auth().createUser({ uid, phoneNumber: phone, displayName: name });
  await admin.firestore().collection('users').doc(uid).set({
    name,
    phone,
    role,
    isActive: true,
    accountStatus: 'active',
    createdAt: now,
    updatedAt: now,
  });
}

async function seedContract({
  id,
  status,
  listingOwnerId,
  bidderId,
  contractNumber,
  pickupAddress = 'Quezon City',
  deliveryAddress = 'Makati',
}) {
  const now = admin.firestore.FieldValue.serverTimestamp();
  await admin.firestore().collection('contracts').doc(id).set({
    contractNumber,
    status,
    listingOwnerId,
    bidderId,
    participantIds: [listingOwnerId, bidderId],
    pickupAddress,
    deliveryAddress,
    updatedAt: now,
    createdAt: now,
  });
}

async function countRatingsFor(contractId, raterId) {
  const snap = await admin.firestore().collection('ratings')
    .where('contractId', '==', contractId)
    .where('raterId', '==', raterId)
    .get();
  return snap.size;
}

async function main() {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = EMULATOR_HOSTS.auth;
  process.env.FIRESTORE_EMULATOR_HOST = EMULATOR_HOSTS.firestore;

  admin.initializeApp({ projectId: PROJECT_ID });
  const db = admin.firestore();

  const shipperUid = 'shipper-ratings-it';
  const truckerUid = 'trucker-ratings-it';
  const outsiderUid = 'outsider-ratings-it';
  const otherUid = 'other-ratings-it';

  console.log('Clearing emulator state...');
  await clearEmulators();

  console.log('Seeding users...');
  await seedUser({ uid: shipperUid, phone: '+639181000101', role: 'shipper', name: 'Shipper One' });
  await seedUser({ uid: truckerUid, phone: '+639181000102', role: 'trucker', name: 'Trucker One' });
  await seedUser({ uid: outsiderUid, phone: '+639181000103', role: 'shipper', name: 'Outsider User' });
  await seedUser({ uid: otherUid, phone: '+639181000104', role: 'trucker', name: 'Other Driver' });

  console.log('Seeding contracts...');
  await seedContract({
    id: 'ct-rating-success',
    status: 'completed',
    listingOwnerId: shipperUid,
    bidderId: truckerUid,
    contractNumber: 'KC-RATE-001',
  });
  await seedContract({
    id: 'ct-rating-race',
    status: 'completed',
    listingOwnerId: shipperUid,
    bidderId: truckerUid,
    contractNumber: 'KC-RATE-002',
  });
  await seedContract({
    id: 'ct-rating-not-completed',
    status: 'signed',
    listingOwnerId: shipperUid,
    bidderId: truckerUid,
    contractNumber: 'KC-RATE-003',
  });
  await seedContract({
    id: 'ct-rating-permission',
    status: 'completed',
    listingOwnerId: truckerUid,
    bidderId: otherUid,
    contractNumber: 'KC-RATE-004',
  });
  await seedContract({
    id: 'ct-rating-pending',
    status: 'completed',
    listingOwnerId: shipperUid,
    bidderId: truckerUid,
    contractNumber: 'KC-RATE-005',
  });
  await seedContract({
    id: 'ct-rating-legacy',
    status: 'completed',
    listingOwnerId: shipperUid,
    bidderId: truckerUid,
    contractNumber: 'KC-RATE-006',
  });
  await seedContract({
    id: 'ct-rating-canonical',
    status: 'completed',
    listingOwnerId: shipperUid,
    bidderId: truckerUid,
    contractNumber: 'KC-RATE-007',
  });

  console.log('Seeding legacy and canonical ratings...');
  await db.collection('ratings').doc('legacy_rating_doc').set({
    contractId: 'ct-rating-legacy',
    raterId: shipperUid,
    raterName: 'Shipper One',
    ratedUserId: truckerUid,
    score: 5,
    tags: ['professional'],
    comment: 'Legacy field row',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await db.collection('ratings').doc('canonical_rating_doc').set({
    contractId: 'ct-rating-canonical',
    raterId: shipperUid,
    raterName: 'Shipper One',
    rateeId: truckerUid,
    ratedUserId: truckerUid,
    score: 4,
    tags: ['punctual'],
    comment: 'Canonical row',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const shipperToken = await signInWithCustomToken(shipperUid);
  const outsiderToken = await signInWithCustomToken(outsiderUid);

  console.log('Validating submitRating success path...');
  const successResult = await callFunction('submitRating', shipperToken, {
    contractId: 'ct-rating-success',
    score: 5,
    tags: ['professional', 'good_communication'],
    comment: 'Excellent work',
  });
  assert(successResult?.rating?.id, 'Expected rating id in success response');
  assert(
    (await countRatingsFor('ct-rating-success', shipperUid)) === 1,
    'Expected exactly one rating for success contract'
  );

  console.log('Validating submitRating duplicate sequential rejection...');
  const duplicateMessage = await callFunctionExpectError('submitRating', shipperToken, {
    contractId: 'ct-rating-success',
    score: 5,
  });
  assert(
    duplicateMessage.toLowerCase().includes('already rated'),
    `Expected duplicate rejection, got: ${duplicateMessage}`
  );

  console.log('Validating submitRating duplicate concurrent rejection...');
  const raceResults = await Promise.allSettled([
    callFunction('submitRating', shipperToken, { contractId: 'ct-rating-race', score: 4 }),
    callFunction('submitRating', shipperToken, { contractId: 'ct-rating-race', score: 4 }),
  ]);
  const raceSuccessCount = raceResults.filter((item) => item.status === 'fulfilled').length;
  const raceFailureMessages = raceResults
    .filter((item) => item.status === 'rejected')
    .map((item) => String(item.reason?.message || ''));
  assert(raceSuccessCount === 1, `Expected one successful race submission, got ${raceSuccessCount}`);
  assert(
    raceFailureMessages.some((message) => message.toLowerCase().includes('already rated')),
    'Expected one already-rated rejection in race submission'
  );
  assert(
    (await countRatingsFor('ct-rating-race', shipperUid)) === 1,
    'Expected exactly one persisted rating after race submission'
  );

  console.log('Validating submitRating permission rejection...');
  const permissionMessage = await callFunctionExpectError('submitRating', outsiderToken, {
    contractId: 'ct-rating-permission',
    score: 5,
  });
  assert(
    permissionMessage.toLowerCase().includes('not authorized'),
    `Expected permission rejection, got: ${permissionMessage}`
  );

  console.log('Validating submitRating invalid score rejection...');
  const invalidScoreMessage = await callFunctionExpectError('submitRating', shipperToken, {
    contractId: 'ct-rating-pending',
    score: 0,
  });
  assert(
    invalidScoreMessage.toLowerCase().includes('score must be between 1 and 5'),
    `Expected invalid score rejection, got: ${invalidScoreMessage}`
  );

  console.log('Validating submitRating contract status rejection...');
  const notCompletedMessage = await callFunctionExpectError('submitRating', shipperToken, {
    contractId: 'ct-rating-not-completed',
    score: 5,
  });
  assert(
    notCompletedMessage.toLowerCase().includes('can only rate completed contracts'),
    `Expected contract status rejection, got: ${notCompletedMessage}`
  );

  console.log('Validating getPendingRatings includes/excludes expected contracts...');
  const pendingResult = await callFunction('getPendingRatings', shipperToken, {});
  const pendingIds = new Set((pendingResult?.pendingRatings || []).map((item) => item.contractId));

  assert(pendingIds.has('ct-rating-pending'), 'Expected pending contract to be included');
  assert(!pendingIds.has('ct-rating-success'), 'Did not expect already-rated contract in pending list');
  assert(!pendingIds.has('ct-rating-race'), 'Did not expect race-rated contract in pending list');
  assert(!pendingIds.has('ct-rating-legacy'), 'Did not expect legacy-rated contract in pending list');
  assert(!pendingIds.has('ct-rating-canonical'), 'Did not expect canonical-rated contract in pending list');

  console.log('ratings integration checks passed.');
}

main().catch((error) => {
  console.error('ratings integration checks failed:', error);
  process.exit(1);
});
