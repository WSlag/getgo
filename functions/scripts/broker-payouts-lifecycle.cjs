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
  if (!condition) {
    throw new Error(message);
  }
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

async function main() {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = EMULATOR_HOSTS.auth;
  process.env.FIRESTORE_EMULATOR_HOST = EMULATOR_HOSTS.firestore;

  admin.initializeApp({ projectId: PROJECT_ID });
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();

  const adminUid = 'admin-broker-payout-test';
  const brokerUid = 'broker-payout-test';
  const adminPhone = '+639171000001';
  const brokerPhone = '+639171000002';

  console.log('Clearing emulator state...');
  await clearEmulators();

  console.log('Seeding admin and broker users...');
  await admin.auth().createUser({ uid: adminUid, phoneNumber: adminPhone });
  await admin.auth().createUser({ uid: brokerUid, phoneNumber: brokerPhone });
  await admin.auth().setCustomUserClaims(adminUid, { admin: true });

  await db.collection('users').doc(adminUid).set({
    name: 'Admin Test',
    phone: adminPhone,
    role: 'shipper',
    isAdmin: false,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  await db.collection('users').doc(brokerUid).set({
    name: 'Broker Test',
    phone: brokerPhone,
    role: 'shipper',
    isBroker: true,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  await db.collection('brokers').doc(brokerUid).set({
    userId: brokerUid,
    sourceRole: 'shipper',
    referralCode: 'BRKTEST1',
    tier: 'STARTER',
    status: 'active',
    totalEarnings: 1000,
    pendingEarnings: 0,
    availableBalance: 1000,
    totalReferrals: 0,
    totalTransactions: 0,
    createdAt: now,
    updatedAt: now,
  });

  await db.collection('users').doc(brokerUid).collection('brokerProfile').doc('profile').set({
    userId: brokerUid,
    sourceRole: 'shipper',
    referralCode: 'BRKTEST1',
    tier: 'STARTER',
    status: 'active',
    totalEarnings: 1000,
    pendingEarnings: 0,
    availableBalance: 1000,
    totalReferrals: 0,
    totalTransactions: 0,
    createdAt: now,
    updatedAt: now,
  });

  const adminToken = await signInWithCustomToken(adminUid);
  const brokerToken = await signInWithCustomToken(brokerUid);

  console.log('Requesting first payout (for approval)...');
  const firstPayout = await callFunction('brokerRequestPayout', brokerToken, {
    amount: 500,
    method: 'gcash',
    payoutDetails: {
      accountName: 'Broker Test',
      accountNumber: '09170000002',
    },
  });
  assert(firstPayout?.success === true, 'Expected first payout request success');
  const firstRequestId = firstPayout.requestId;
  assert(firstRequestId, 'Missing first payout requestId');

  let brokerDoc = await db.collection('brokers').doc(brokerUid).get();
  let brokerData = brokerDoc.data() || {};
  assert(Number(brokerData.availableBalance) === 500, 'availableBalance should decrease to 500 after request');
  assert(Number(brokerData.pendingEarnings) === 500, 'pendingEarnings should increase to 500 after request');

  console.log('Listing pending payout requests as admin...');
  const pendingList = await callFunction('adminGetBrokerPayoutRequests', adminToken, {
    status: 'pending',
    limit: 50,
  });
  assert(Array.isArray(pendingList?.requests), 'Expected pending requests list');
  assert(pendingList.requests.some((request) => request.id === firstRequestId), 'First request missing from pending list');

  console.log('Approving first payout...');
  const approval = await callFunction('adminReviewBrokerPayout', adminToken, {
    requestId: firstRequestId,
    decision: 'approve',
    notes: 'Approved in lifecycle test',
    payoutReference: 'GCASH-TEST-001',
  });
  assert(approval?.success === true, 'Expected approval success');

  const approvedRequest = await db.collection('brokerPayoutRequests').doc(firstRequestId).get();
  const approvedData = approvedRequest.data() || {};
  assert(approvedData.status === 'approved', 'First payout should be approved');
  assert(approvedData.payoutReference === 'GCASH-TEST-001', 'Expected payout reference on approved request');

  brokerDoc = await db.collection('brokers').doc(brokerUid).get();
  brokerData = brokerDoc.data() || {};
  assert(Number(brokerData.availableBalance) === 500, 'availableBalance should remain 500 after approval');
  assert(Number(brokerData.pendingEarnings) === 0, 'pendingEarnings should return to 0 after approval');

  console.log('Requesting second payout (for rejection)...');
  const secondPayout = await callFunction('brokerRequestPayout', brokerToken, {
    amount: 500,
    method: 'bank',
    payoutDetails: {
      accountName: 'Broker Test',
      accountNumber: '000123456789',
    },
  });
  assert(secondPayout?.success === true, 'Expected second payout request success');
  const secondRequestId = secondPayout.requestId;
  assert(secondRequestId, 'Missing second payout requestId');

  console.log('Rejecting second payout...');
  const rejection = await callFunction('adminReviewBrokerPayout', adminToken, {
    requestId: secondRequestId,
    decision: 'reject',
    notes: 'Rejected in lifecycle test',
  });
  assert(rejection?.success === true, 'Expected rejection success');

  const rejectedRequest = await db.collection('brokerPayoutRequests').doc(secondRequestId).get();
  const rejectedData = rejectedRequest.data() || {};
  assert(rejectedData.status === 'rejected', 'Second payout should be rejected');

  brokerDoc = await db.collection('brokers').doc(brokerUid).get();
  brokerData = brokerDoc.data() || {};
  assert(Number(brokerData.availableBalance) === 500, 'availableBalance should return to 500 after rejection');
  assert(Number(brokerData.pendingEarnings) === 0, 'pendingEarnings should return to 0 after rejection');

  const approvedList = await callFunction('adminGetBrokerPayoutRequests', adminToken, {
    status: 'approved',
    limit: 50,
  });
  assert(approvedList.requests.some((request) => request.id === firstRequestId), 'First request missing from approved list');

  const rejectedList = await callFunction('adminGetBrokerPayoutRequests', adminToken, {
    status: 'rejected',
    limit: 50,
  });
  assert(rejectedList.requests.some((request) => request.id === secondRequestId), 'Second request missing from rejected list');

  const referralReport = await callFunction('adminGetBrokerReferralReport', adminToken, {
    recentLimit: 10,
    scanLimit: 200,
  });
  assert(referralReport?.summary, 'Referral report summary missing');
  assert(Array.isArray(referralReport?.recentContracts), 'Referral report recentContracts missing');
  assert(Array.isArray(referralReport?.brokerBreakdown), 'Referral report brokerBreakdown missing');

  console.log('Broker payout lifecycle validation passed.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
