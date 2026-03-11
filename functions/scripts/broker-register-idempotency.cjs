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

async function seedUser(db, { uid, phone, name, role = 'shipper' }) {
  const now = admin.firestore.Timestamp.now();
  await admin.auth().createUser({ uid, phoneNumber: phone });
  await db.collection('users').doc(uid).set({
    name,
    phone,
    role,
    isActive: true,
    isBroker: false,
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

  console.log('Clearing emulator state...');
  await clearEmulators();

  // Scenario 1: Fresh broker registration and second idempotent re-register.
  const freshUid = 'broker-register-fresh';
  await seedUser(db, {
    uid: freshUid,
    phone: '+639172300001',
    name: 'Fresh Broker User',
    role: 'shipper',
  });

  const freshToken = await signInWithCustomToken(freshUid);
  const firstRegister = await callFunction('brokerRegister', freshToken, {});
  assert(firstRegister?.success === true, 'Fresh register should succeed');
  assert(firstRegister?.alreadyRegistered === false, 'Fresh register should set alreadyRegistered=false');
  assert(firstRegister?.broker?.referralCode, 'Fresh register should return referralCode');

  const freshBrokerDoc = await db.collection('brokers').doc(freshUid).get();
  const freshMirrorDoc = await db.collection('users').doc(freshUid).collection('brokerProfile').doc('profile').get();
  const freshUserDoc = await db.collection('users').doc(freshUid).get();
  assert(freshBrokerDoc.exists, 'Fresh register should create canonical broker doc');
  assert(freshMirrorDoc.exists, 'Fresh register should create mirror broker profile doc');
  assert(freshUserDoc.data()?.isBroker === true, 'Fresh register should set users/{uid}.isBroker=true');

  const secondRegister = await callFunction('brokerRegister', freshToken, {});
  assert(secondRegister?.success === true, 'Second register should succeed');
  assert(secondRegister?.alreadyRegistered === true, 'Second register should set alreadyRegistered=true');
  assert(
    secondRegister?.broker?.referralCode === firstRegister?.broker?.referralCode,
    'Second register should preserve referralCode'
  );

  // Scenario 2: Legacy partial state A (canonical doc exists, mirror missing).
  const partialCanonicalUid = 'broker-register-partial-canonical';
  await seedUser(db, {
    uid: partialCanonicalUid,
    phone: '+639172300002',
    name: 'Canonical Partial User',
    role: 'shipper',
  });
  await db.collection('brokers').doc(partialCanonicalUid).set({
    userId: partialCanonicalUid,
    sourceRole: 'shipper',
    referralCode: 'SHPPARTA1',
    tier: 'STARTER',
    status: 'active',
    totalEarnings: 100,
    pendingEarnings: 20,
    availableBalance: 80,
    totalReferrals: 2,
    totalTransactions: 3,
    createdAt: now,
    updatedAt: now,
  });

  const partialCanonicalToken = await signInWithCustomToken(partialCanonicalUid);
  const healCanonical = await callFunction('brokerRegister', partialCanonicalToken, {});
  assert(healCanonical?.success === true, 'Partial canonical healing should succeed');
  assert(healCanonical?.alreadyRegistered === true, 'Partial canonical healing should report alreadyRegistered=true');
  assert(
    healCanonical?.broker?.referralCode === 'SHPPARTA1',
    'Partial canonical healing should preserve canonical referralCode'
  );

  const healedMirror = await db.collection('users').doc(partialCanonicalUid).collection('brokerProfile').doc('profile').get();
  const healedCanonicalUser = await db.collection('users').doc(partialCanonicalUid).get();
  assert(healedMirror.exists, 'Partial canonical healing should create missing mirror doc');
  assert(healedCanonicalUser.data()?.isBroker === true, 'Partial canonical healing should set users/{uid}.isBroker=true');

  // Scenario 3: Legacy partial state B (mirror doc exists, canonical missing).
  const partialMirrorUid = 'broker-register-partial-mirror';
  await seedUser(db, {
    uid: partialMirrorUid,
    phone: '+639172300003',
    name: 'Mirror Partial User',
    role: 'trucker',
  });
  await db.collection('users').doc(partialMirrorUid).collection('brokerProfile').doc('profile').set({
    userId: partialMirrorUid,
    sourceRole: 'trucker',
    referralCode: 'TRKPARTB1',
    tier: 'SILVER',
    status: 'active',
    totalEarnings: 200,
    pendingEarnings: 50,
    availableBalance: 150,
    totalReferrals: 4,
    totalTransactions: 7,
    createdAt: now,
    updatedAt: now,
  });

  const partialMirrorToken = await signInWithCustomToken(partialMirrorUid);
  const healMirror = await callFunction('brokerRegister', partialMirrorToken, {});
  assert(healMirror?.success === true, 'Partial mirror healing should succeed');
  assert(healMirror?.alreadyRegistered === true, 'Partial mirror healing should report alreadyRegistered=true');
  assert(
    healMirror?.broker?.referralCode === 'TRKPARTB1',
    'Partial mirror healing should preserve mirror referralCode'
  );

  const healedCanonical = await db.collection('brokers').doc(partialMirrorUid).get();
  const healedMirrorUser = await db.collection('users').doc(partialMirrorUid).get();
  assert(healedCanonical.exists, 'Partial mirror healing should create missing canonical broker doc');
  assert(healedMirrorUser.data()?.isBroker === true, 'Partial mirror healing should set users/{uid}.isBroker=true');

  console.log('[broker-register-idempotency] all scenarios passed');
}

main().catch((error) => {
  console.error('[broker-register-idempotency] failed:', error?.message || error);
  process.exit(1);
});
