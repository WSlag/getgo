const admin = require('firebase-admin');
const axios = require('axios');
const {
  buildListingReferralId,
} = require('../src/services/brokerListingReferralService');

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
  assert(idToken, `Failed to get ID token for ${uid}`);
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

async function seedUser(uid, phone, name, role = 'shipper') {
  const now = admin.firestore.Timestamp.now();
  await admin.auth().createUser({ uid, phoneNumber: phone });
  await admin.firestore().collection('users').doc(uid).set({
    name,
    phone,
    role,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
}

async function waitForReferralStatus(db, referralId, expectedStatus, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const snap = await db.collection('brokerListingReferrals').doc(referralId).get();
    if (snap.exists && String(snap.data()?.status || '').toLowerCase() === expectedStatus) {
      return snap.data();
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Timed out waiting for referral ${referralId} status=${expectedStatus}`);
}

async function main() {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = EMULATOR_HOSTS.auth;
  process.env.FIRESTORE_EMULATOR_HOST = EMULATOR_HOSTS.firestore;

  admin.initializeApp({ projectId: PROJECT_ID });
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();

  const brokerUid = 'broker-referral-lifecycle';
  const ownerUid = 'listing-owner-lifecycle';
  const referredUid = 'referred-user-lifecycle';

  console.log('Clearing emulator state...');
  await clearEmulators();

  console.log('Seeding users and broker attribution...');
  await seedUser(brokerUid, '+639172200001', 'Lifecycle Broker', 'shipper');
  await seedUser(ownerUid, '+639172200002', 'Lifecycle Owner', 'shipper');
  await seedUser(referredUid, '+639172200003', 'Lifecycle Referred', 'trucker');

  await db.collection('brokers').doc(brokerUid).set({
    userId: brokerUid,
    sourceRole: 'shipper',
    referralCode: 'BRKLIFE1',
    tier: 'STARTER',
    status: 'active',
    totalEarnings: 0,
    pendingEarnings: 0,
    availableBalance: 0,
    totalReferrals: 1,
    totalTransactions: 0,
    createdAt: now,
    updatedAt: now,
  });

  await db.collection('users').doc(brokerUid).collection('brokerProfile').doc('profile').set({
    userId: brokerUid,
    sourceRole: 'shipper',
    referralCode: 'BRKLIFE1',
    tier: 'STARTER',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });

  await db.collection('brokerReferrals').doc(referredUid).set({
    brokerId: brokerUid,
    brokerCode: 'BRKLIFE1',
    referredUserId: referredUid,
    referredRole: 'trucker',
    status: 'attributed',
    totalQualifiedFees: 0,
    totalCommission: 0,
    totalTransactions: 0,
    createdAt: now,
    updatedAt: now,
  });

  console.log('Seeding listings...');
  const listingDismissId = 'cargo-lifecycle-dismiss';
  const listingActId = 'cargo-lifecycle-act';
  await db.collection('cargoListings').doc(listingDismissId).set({
    userId: ownerUid,
    origin: 'Davao',
    destination: 'Cebu',
    askingPrice: 25000,
    status: 'open',
    createdAt: now,
    updatedAt: now,
  });
  await db.collection('cargoListings').doc(listingActId).set({
    userId: ownerUid,
    origin: 'Iloilo',
    destination: 'Manila',
    askingPrice: 33000,
    status: 'open',
    createdAt: now,
    updatedAt: now,
  });

  const brokerToken = await signInWithCustomToken(brokerUid);
  const referredToken = await signInWithCustomToken(referredUid);
  assert(brokerToken && referredToken, 'Expected valid broker and referred tokens');

  console.log('Creating referral #1 (dismiss lifecycle)...');
  const sendDismiss = await callFunction('brokerReferListing', brokerToken, {
    listingId: listingDismissId,
    listingType: 'cargo',
    referredUserIds: [referredUid],
    note: 'Dismiss lifecycle test',
  });
  assert(sendDismiss?.success === true, 'Expected brokerReferListing success for dismiss flow');

  const dismissReferralId = buildListingReferralId({
    brokerId: brokerUid,
    listingType: 'cargo',
    listingId: listingDismissId,
    referredUserId: referredUid,
  });

  const openDismiss = await callFunction('referredUpdateListingReferralState', referredToken, {
    referralId: dismissReferralId,
    action: 'opened',
  });
  assert(openDismiss?.success === true, 'Expected opened update success');
  assert(openDismiss?.status === 'opened', `Expected status opened, got ${openDismiss?.status}`);

  const dismissResult = await callFunction('referredUpdateListingReferralState', referredToken, {
    referralId: dismissReferralId,
    action: 'dismissed',
  });
  assert(dismissResult?.success === true, 'Expected dismissed update success');
  assert(dismissResult?.status === 'dismissed', `Expected dismissed status, got ${dismissResult?.status}`);

  const closedFilter = await callFunction('referredGetListingReferrals', referredToken, {
    statusFilter: 'closed',
    limit: 20,
  });
  assert(
    Array.isArray(closedFilter?.items) && closedFilter.items.some((item) => item.id === dismissReferralId),
    'Expected dismissed referral in closed filter'
  );

  const activeFilterAfterDismiss = await callFunction('referredGetListingReferrals', referredToken, {
    statusFilter: 'active',
    limit: 20,
  });
  assert(
    Array.isArray(activeFilterAfterDismiss?.items) && !activeFilterAfterDismiss.items.some((item) => item.id === dismissReferralId),
    'Dismissed referral must not appear in active filter'
  );

  console.log('Creating referral #2 (act lifecycle via bid trigger)...');
  const sendAct = await callFunction('brokerReferListing', brokerToken, {
    listingId: listingActId,
    listingType: 'cargo',
    referredUserIds: [referredUid],
    note: 'Act lifecycle test',
  });
  assert(sendAct?.success === true, 'Expected brokerReferListing success for acted flow');

  const actReferralId = buildListingReferralId({
    brokerId: brokerUid,
    listingType: 'cargo',
    listingId: listingActId,
    referredUserId: referredUid,
  });

  const openAct = await callFunction('referredUpdateListingReferralState', referredToken, {
    referralId: actReferralId,
    action: 'opened',
  });
  assert(openAct?.success === true, 'Expected opened update success for acted flow');

  const bidId = 'bid-lifecycle-act-1';
  await db.collection('bids').doc(bidId).set({
    bidderId: referredUid,
    bidderName: 'Lifecycle Referred',
    listingOwnerId: ownerUid,
    listingOwnerName: 'Lifecycle Owner',
    cargoListingId: listingActId,
    listingType: 'cargo',
    origin: 'Iloilo',
    destination: 'Manila',
    price: 31500,
    status: 'pending',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const actedReferral = await waitForReferralStatus(db, actReferralId, 'acted');
  assert(String(actedReferral?.actedBidId || '') === bidId, 'Expected actedBidId to match trigger bid');

  const actedFilter = await callFunction('referredGetListingReferrals', referredToken, {
    statusFilter: 'acted',
    limit: 20,
  });
  assert(
    Array.isArray(actedFilter?.items) && actedFilter.items.some((item) => item.id === actReferralId),
    'Expected acted referral in acted filter'
  );

  const activeFilterAfterAct = await callFunction('referredGetListingReferrals', referredToken, {
    statusFilter: 'active',
    limit: 20,
  });
  assert(
    Array.isArray(activeFilterAfterAct?.items) && !activeFilterAfterAct.items.some((item) => item.id === actReferralId),
    'Acted referral must not appear in active filter'
  );

  console.log('Referral lifecycle integration validation passed.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });

