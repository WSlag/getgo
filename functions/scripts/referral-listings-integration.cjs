const admin = require('firebase-admin');
const axios = require('axios');
const {
  getDateKeyInTimeZone,
} = require('../src/services/brokerReferralMetrics');

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

async function callFunctionExpectError(name, idToken, data = {}) {
  try {
    await axios.post(
      `http://${EMULATOR_HOSTS.functions}/${PROJECT_ID}/${REGION}/${name}`,
      { data },
      {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      }
    );
  } catch (error) {
    const payload = error?.response?.data;
    const message = payload?.error?.message || error.message;
    return message;
  }
  throw new Error(`${name} unexpectedly succeeded`);
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

async function main() {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = EMULATOR_HOSTS.auth;
  process.env.FIRESTORE_EMULATOR_HOST = EMULATOR_HOSTS.firestore;

  admin.initializeApp({ projectId: PROJECT_ID });
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();

  const adminUid = 'admin-referral-integration';
  const brokerUid = 'broker-referral-integration';
  const ownerUid = 'listing-owner-integration';
  const referredUid1 = 'referred-integration-1';
  const referredUid2 = 'referred-integration-2';
  const referredUid3 = 'referred-integration-3';
  const referredUid4 = 'referred-integration-4';
  const referredUid5 = 'referred-integration-5';
  const referredUid6 = 'referred-integration-6';

  console.log('Clearing emulator state...');
  await clearEmulators();

  console.log('Seeding users...');
  await seedUser(adminUid, '+639171100001', 'Referral Admin', 'shipper');
  await seedUser(brokerUid, '+639171100002', 'Referral Broker', 'shipper');
  await seedUser(ownerUid, '+639171100003', 'Listing Owner', 'shipper');
  await seedUser(referredUid1, '+639171100004', 'Referred One', 'trucker');
  await seedUser(referredUid2, '+639171100005', 'Referred Two', 'trucker');
  await seedUser(referredUid3, '+639171100006', 'Referred Three', 'trucker');
  await seedUser(referredUid4, '+639171100007', 'Referred Four', 'shipper');
  await seedUser(referredUid5, '+639171100008', 'Referred Five', 'trucker');
  await seedUser(referredUid6, '+639171100009', 'Referred Six', 'trucker');
  await admin.auth().setCustomUserClaims(adminUid, { admin: true });

  const todayKey = getDateKeyInTimeZone(new Date(), 'Asia/Manila');
  const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const yesterdayKey = getDateKeyInTimeZone(yesterdayDate, 'Asia/Manila');
  assert(todayKey !== yesterdayKey, 'Date key setup invalid: today and yesterday keys must differ');

  console.log('Seeding broker and referrals...');
  await db.collection('brokers').doc(brokerUid).set({
    userId: brokerUid,
    sourceRole: 'shipper',
    referralCode: 'BRKINT1',
    tier: 'STARTER',
    status: 'active',
    totalEarnings: 0,
    pendingEarnings: 0,
    availableBalance: 0,
    totalReferrals: 6,
    totalTransactions: 0,
    dailyListingReferralDate: yesterdayKey,
    dailyListingReferralCount: 200,
    createdAt: now,
    updatedAt: now,
  });

  await db.collection('users').doc(brokerUid).collection('brokerProfile').doc('profile').set({
    userId: brokerUid,
    sourceRole: 'shipper',
    referralCode: 'BRKINT1',
    tier: 'STARTER',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });

  await Promise.all([
    db.collection('brokerReferrals').doc(referredUid1).set({
      brokerId: brokerUid,
      brokerCode: 'BRKINT1',
      referredUserId: referredUid1,
      referredRole: 'trucker',
      status: 'attributed',
      totalQualifiedFees: 0,
      totalCommission: 0,
      totalTransactions: 0,
      createdAt: now,
      updatedAt: now,
    }),
    db.collection('brokerReferrals').doc(referredUid2).set({
      brokerId: brokerUid,
      brokerCode: 'BRKINT1',
      referredUserId: referredUid2,
      referredRole: 'trucker',
      status: 'attributed',
      totalQualifiedFees: 0,
      totalCommission: 0,
      totalTransactions: 0,
      createdAt: now,
      updatedAt: now,
    }),
    db.collection('brokerReferrals').doc(referredUid3).set({
      brokerId: brokerUid,
      brokerCode: 'BRKINT1',
      referredUserId: referredUid3,
      referredRole: 'trucker',
      status: 'attributed',
      totalQualifiedFees: 0,
      totalCommission: 0,
      totalTransactions: 0,
      createdAt: now,
      updatedAt: now,
    }),
    db.collection('brokerReferrals').doc(referredUid4).set({
      brokerId: brokerUid,
      brokerCode: 'BRKINT1',
      referredUserId: referredUid4,
      referredRole: 'trucker',
      status: 'attributed',
      totalQualifiedFees: 0,
      totalCommission: 0,
      totalTransactions: 0,
      createdAt: now,
      updatedAt: now,
    }),
    db.collection('brokerReferrals').doc(referredUid5).set({
      brokerId: brokerUid,
      brokerCode: 'BRKINT1',
      referredUserId: referredUid5,
      referredRole: 'trucker',
      status: 'attributed',
      totalQualifiedFees: 0,
      totalCommission: 0,
      totalTransactions: 0,
      createdAt: now,
      updatedAt: now,
    }),
    db.collection('brokerReferrals').doc(referredUid6).set({
      brokerId: brokerUid,
      brokerCode: 'BRKINT1',
      referredUserId: referredUid6,
      referredRole: 'trucker',
      status: 'attributed',
      totalQualifiedFees: 0,
      totalCommission: 0,
      totalTransactions: 0,
      createdAt: now,
      updatedAt: now,
    }),
  ]);

  console.log('Seeding listing and historical listing-referral record...');
  await db.collection('cargoListings').doc('cargo-integration-1').set({
    userId: ownerUid,
    origin: 'Davao',
    destination: 'Cagayan de Oro',
    askingPrice: 28000,
    status: 'open',
    createdAt: now,
    updatedAt: now,
  });

  const olderRefTs = admin.firestore.Timestamp.fromMillis(Date.now() - 10 * 24 * 60 * 60 * 1000);
  await db.collection('brokerListingReferrals').doc('legacy_referral_row').set({
    brokerId: brokerUid,
    brokerMasked: 'R*** B***',
    referredUserId: referredUid2,
    referredUserMasked: 'R*** T***',
    listingId: 'cargo-legacy-1',
    listingType: 'cargo',
    listingOwnerId: ownerUid,
    listingStatusAtSend: 'open',
    route: { origin: 'Manila', destination: 'Cebu' },
    askingPrice: 12000,
    note: null,
    status: 'expired',
    expiresAt: olderRefTs,
    openedAt: null,
    actedAt: null,
    actedBidId: null,
    resendCount: 0,
    source: 'broker_manual',
    lastNotifiedAt: olderRefTs,
    createdAt: olderRefTs,
    updatedAt: olderRefTs,
  });

  const adminToken = await signInWithCustomToken(adminUid);
  const brokerToken = await signInWithCustomToken(brokerUid);
  assert(adminToken, 'Missing admin token');

  console.log('Validating switchUserRole rejects broker role...');
  const switchRoleError = await callFunctionExpectError('switchUserRole', brokerToken, { role: 'broker' });
  assert(
    String(switchRoleError || '').toLowerCase().includes('role must be one of'),
    `Expected switchUserRole to reject broker role, got: ${switchRoleError}`
  );

  console.log('Validating quota reset by date-key rollover...');
  const firstSend = await callFunction('brokerReferListing', brokerToken, {
    listingId: 'cargo-integration-1',
    listingType: 'cargo',
    referredUserIds: [referredUid1],
    note: 'Fresh referral after day rollover',
  });
  assert(firstSend?.success === true, 'Expected first referral send success');
  assert(firstSend.createdCount === 1, `Expected createdCount=1, got ${firstSend.createdCount}`);
  assert(firstSend.dailyUsage === 1, `Expected dailyUsage=1 after reset, got ${firstSend.dailyUsage}`);
  assert(firstSend.dailyRemaining === 199, `Expected dailyRemaining=199, got ${firstSend.dailyRemaining}`);

  const brokerAfterReset = (await db.collection('brokers').doc(brokerUid).get()).data() || {};
  assert(
    brokerAfterReset.dailyListingReferralDate === todayKey,
    `Expected dailyListingReferralDate=${todayKey}, got ${brokerAfterReset.dailyListingReferralDate}`
  );
  assert(
    Number(brokerAfterReset.dailyListingReferralCount) === 1,
    `Expected dailyListingReferralCount=1, got ${brokerAfterReset.dailyListingReferralCount}`
  );

  console.log('Validating role compatibility checks and eligibility metadata...');
  const referredUsersForCargo = await callFunction('brokerGetReferredUsers', brokerToken, {
    limit: 20,
    listingType: 'cargo',
  });
  const ineligibleUser = (referredUsersForCargo?.items || []).find((item) => item.referredUserId === referredUid4);
  assert(!!ineligibleUser, 'Expected referredUid4 in referred users list');
  assert(ineligibleUser.isEligible === false, 'Expected referredUid4 to be ineligible for cargo referrals');
  assert(ineligibleUser.ineligibleReason === 'role-mismatch', `Expected role-mismatch, got ${ineligibleUser.ineligibleReason}`);
  assert(ineligibleUser.requiredRole === 'trucker', `Expected requiredRole=trucker, got ${ineligibleUser.requiredRole}`);
  assert(ineligibleUser.currentRole === 'shipper', `Expected currentRole=shipper, got ${ineligibleUser.currentRole}`);

  const mismatchSend = await callFunction('brokerReferListing', brokerToken, {
    listingId: 'cargo-integration-1',
    listingType: 'cargo',
    referredUserIds: [referredUid4],
    note: 'Must fail on role mismatch',
  });
  assert(mismatchSend?.success === true, 'Expected mismatch send request to return success payload');
  assert(mismatchSend.createdCount === 0, `Expected createdCount=0 for mismatch, got ${mismatchSend.createdCount}`);
  assert(mismatchSend.skippedCount === 1, `Expected skippedCount=1 for mismatch, got ${mismatchSend.skippedCount}`);
  assert(
    Array.isArray(mismatchSend.errors) && mismatchSend.errors.some((item) => item?.code === 'role-mismatch'),
    'Expected role-mismatch error for incompatible referral user'
  );

  console.log('Validating summary is full-scan (not page-limited)...');
  const summaryResponse = await callFunction('brokerGetListingReferrals', brokerToken, {
    limit: 1,
    statusFilter: 'all',
    listingTypeFilter: 'all',
  });
  assert(Array.isArray(summaryResponse?.items), 'Expected items array in listing referrals response');
  assert(summaryResponse.items.length === 1, `Expected paged items length=1, got ${summaryResponse.items.length}`);
  assert(summaryResponse.summary?.total === 2, `Expected summary.total=2, got ${summaryResponse.summary?.total}`);
  assert(summaryResponse.summary?.expired === 1, `Expected summary.expired=1, got ${summaryResponse.summary?.expired}`);

  console.log('Validating in-day cap behavior with partial skip...');
  await db.collection('brokers').doc(brokerUid).set({
    dailyListingReferralDate: todayKey,
    dailyListingReferralCount: 199,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  const cappedSend = await callFunction('brokerReferListing', brokerToken, {
    listingId: 'cargo-integration-1',
    listingType: 'cargo',
    referredUserIds: [referredUid2, referredUid3],
    note: 'Only one slot should remain',
  });
  assert(cappedSend?.success === true, 'Expected capped referral send success');
  assert(cappedSend.createdCount === 1, `Expected createdCount=1 for cap scenario, got ${cappedSend.createdCount}`);
  assert(cappedSend.skippedCount === 1, `Expected skippedCount=1 for cap scenario, got ${cappedSend.skippedCount}`);
  assert(cappedSend.dailyUsage === 200, `Expected dailyUsage=200, got ${cappedSend.dailyUsage}`);
  assert(cappedSend.dailyRemaining === 0, `Expected dailyRemaining=0, got ${cappedSend.dailyRemaining}`);
  assert(
    Array.isArray(cappedSend.errors) && cappedSend.errors.some((item) => item?.code === 'daily-limit'),
    'Expected at least one daily-limit error in capped send'
  );

  const brokerAfterCap = (await db.collection('brokers').doc(brokerUid).get()).data() || {};
  assert(
    Number(brokerAfterCap.dailyListingReferralCount) === 200,
    `Expected broker count=200 after cap scenario, got ${brokerAfterCap.dailyListingReferralCount}`
  );

  console.log('Validating concurrency-safe daily cap with parallel sends...');
  await db.collection('brokers').doc(brokerUid).set({
    dailyListingReferralDate: todayKey,
    dailyListingReferralCount: 199,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  const parallelSends = await Promise.all([
    callFunction('brokerReferListing', brokerToken, {
      listingId: 'cargo-integration-1',
      listingType: 'cargo',
      referredUserIds: [referredUid5],
      note: 'Parallel send A',
    }),
    callFunction('brokerReferListing', brokerToken, {
      listingId: 'cargo-integration-1',
      listingType: 'cargo',
      referredUserIds: [referredUid6],
      note: 'Parallel send B',
    }),
  ]);

  const parallelCreated = parallelSends.reduce((sum, result) => sum + Number(result?.createdCount || 0), 0);
  const parallelDailyLimitErrors = parallelSends.reduce(
    (sum, result) => sum + (Array.isArray(result?.errors) ? result.errors.filter((item) => item?.code === 'daily-limit').length : 0),
    0
  );
  assert(parallelCreated === 1, `Expected exactly one successful parallel create, got ${parallelCreated}`);
  assert(parallelDailyLimitErrors >= 1, 'Expected at least one daily-limit error across parallel sends');

  const brokerAfterParallel = (await db.collection('brokers').doc(brokerUid).get()).data() || {};
  assert(
    Number(brokerAfterParallel.dailyListingReferralCount) === 200,
    `Expected broker count=200 after parallel cap test, got ${brokerAfterParallel.dailyListingReferralCount}`
  );

  console.log('Referral listing integration validation passed.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
