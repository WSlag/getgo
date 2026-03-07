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

async function signInWithCustomToken(uid, claims = undefined) {
  const token = await admin.auth().createCustomToken(uid, claims);
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

async function seedUser(uid, phone, name, role = 'shipper', isAdmin = false) {
  const now = admin.firestore.Timestamp.now();
  await admin.auth().createUser({ uid, phoneNumber: phone });
  await admin.firestore().collection('users').doc(uid).set({
    name,
    phone,
    role,
    isAdmin: false,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  if (isAdmin) {
    await admin.firestore().collection('users').doc(uid).set({
      role: 'admin',
      isAdmin: true,
      adminGrantedBy: 'integration-test',
      adminGrantedAt: now,
      updatedAt: now,
    }, { merge: true });
  }
}

async function main() {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = EMULATOR_HOSTS.auth;
  process.env.FIRESTORE_EMULATOR_HOST = EMULATOR_HOSTS.firestore;

  admin.initializeApp({ projectId: PROJECT_ID });
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();

  console.log('Clearing emulator state...');
  await clearEmulators();

  const adminUid = 'admin-reconcile-ref';
  const brokerUid = 'broker-reconcile-ref';
  const referredUid = 'referred-reconcile-ref';
  const unreferredUid = 'unreferred-reconcile-ref';

  console.log('Seeding users...');
  await seedUser(adminUid, '+639172300001', 'Admin Reconcile', 'admin', true);
  await seedUser(brokerUid, '+639172300002', 'Broker Reconcile', 'shipper');
  await seedUser(referredUid, '+639172300003', 'Referred Reconcile', 'trucker');
  await seedUser(unreferredUid, '+639172300004', 'Unreferred User', 'shipper');

  console.log('Seeding broker and referral state...');
  await db.collection('brokers').doc(brokerUid).set({
    userId: brokerUid,
    sourceRole: 'shipper',
    referralCode: 'BRKRCN1',
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
    referralCode: 'BRKRCN1',
    tier: 'STARTER',
    status: 'active',
    totalEarnings: 0,
    availableBalance: 0,
    totalTransactions: 0,
    createdAt: now,
    updatedAt: now,
  });
  await db.collection('brokerReferrals').doc(referredUid).set({
    brokerId: brokerUid,
    brokerCode: 'BRKRCN1',
    referredUserId: referredUid,
    referredRole: 'trucker',
    status: 'attributed',
    totalQualifiedFees: 0,
    totalCommission: 0,
    totalTransactions: 0,
    createdAt: now,
    updatedAt: now,
  });

  await db.collection('settings').doc('platform').set({
    features: {
      referralProgramEnabled: false,
    },
    referralCommission: {
      STARTER: 3,
      SILVER: 4,
      GOLD: 5,
      PLATINUM: 6,
    },
    updatedAt: now,
  }, { merge: true });

  console.log('Seeding platform fees...');
  await db.collection('platformFees').doc('fee-reconcile-create').set({
    status: 'completed',
    userId: referredUid,
    amount: 1000,
    createdAt: now,
  });
  await db.collection('platformFees').doc('fee-reconcile-no-ref').set({
    status: 'completed',
    userId: unreferredUid,
    amount: 1000,
    createdAt: now,
  });
  await db.collection('platformFees').doc('fee-reconcile-existing').set({
    status: 'completed',
    userId: referredUid,
    amount: 2000,
    createdAt: now,
  });
  await db.collection('brokerCommissions').doc('fee-reconcile-existing').set({
    brokerId: brokerUid,
    referredUserId: referredUid,
    platformFeeId: 'fee-reconcile-existing',
    platformFeeAmount: 2000,
    commissionRate: 3,
    commissionAmount: 60,
    status: 'accrued',
    source: 'seed',
    createdAt: now,
    updatedAt: now,
  });

  const adminToken = await signInWithCustomToken(adminUid, { admin: true });
  assert(adminToken, 'Expected admin token');

  console.log('Calling reconciliation callable...');
  const result = await callFunction('adminReconcileBrokerCommissions', adminToken, { limit: 10 });
  assert(result?.success === true, 'Expected reconciliation success');
  assert(result?.scanned === 3, `Expected scanned=3, got ${result?.scanned}`);
  assert(result?.created === 1, `Expected created=1, got ${result?.created}`);
  assert((result?.skippedByReason?.referral_not_found || 0) === 1, 'Expected referral_not_found skip');
  assert((result?.skippedByReason?.commission_already_exists || 0) === 1, 'Expected commission_already_exists skip');

  const createdCommission = await db.collection('brokerCommissions').doc('fee-reconcile-create').get();
  assert(createdCommission.exists, 'Expected missing commission to be created');
  const brokerDoc = await db.collection('brokers').doc(brokerUid).get();
  const broker = brokerDoc.data() || {};
  assert(Number(broker.totalEarnings || 0) === 30, `Expected broker totalEarnings=30, got ${broker.totalEarnings}`);
  assert(Number(broker.availableBalance || 0) === 30, `Expected broker availableBalance=30, got ${broker.availableBalance}`);

  console.log('Referral commission reconcile integration passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
