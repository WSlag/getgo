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

async function waitForCondition(checkFn, timeoutMs = 20000, intervalMs = 400) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await checkFn();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return null;
}

async function countCollection(path) {
  const snap = await admin.firestore().collection(path).get();
  return snap.size;
}

async function main() {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = EMULATOR_HOSTS.auth;
  process.env.FIRESTORE_EMULATOR_HOST = EMULATOR_HOSTS.firestore;

  admin.initializeApp({ projectId: PROJECT_ID });
  const db = admin.firestore();

  const shipperUid = 'shipper-anti-contact';
  const truckerUid = 'trucker-anti-contact';

  console.log('Clearing emulator state...');
  await clearEmulators();

  console.log('Seeding users...');
  await seedUser({ uid: shipperUid, phone: '+639171222001', role: 'shipper', name: 'Shipper Safe' });
  await seedUser({ uid: truckerUid, phone: '+639171222002', role: 'trucker', name: 'Trucker Safe' });

  const shipperToken = await signInWithCustomToken(shipperUid);
  const truckerToken = await signInWithCustomToken(truckerUid);

  console.log('Validating createCargoListing contact rejection...');
  const createCargoError = await callFunctionExpectError('createCargoListing', shipperToken, {
    origin: 'Cebu',
    destination: 'Butuan',
    askingPrice: 48000,
    description: 'Call me 09995449410',
  });
  assert(createCargoError.toLowerCase().includes('description cannot contain contact information'), `Unexpected createCargoListing error: ${createCargoError}`);

  console.log('Validating createCargoListing safe payload...');
  const createdCargo = await callFunction('createCargoListing', shipperToken, {
    origin: 'Cebu',
    destination: 'Butuan',
    askingPrice: 48000,
    description: 'Pickup 10:30 PM @ terminal 2',
    pickupDate: '2026-03-21',
  });
  assert(typeof createdCargo?.id === 'string' && createdCargo.id.length > 0, 'Expected cargo listing id');

  console.log('Validating updateCargoListing contact rejection on changed fields...');
  const updateCargoError = await callFunctionExpectError('updateCargoListing', shipperToken, {
    listingId: createdCargo.id,
    originStreetAddress: 'https://facebook.com/unsafe.contact',
  });
  assert(updateCargoError.toLowerCase().includes('originstreetaddress cannot contain contact information'), `Unexpected updateCargoListing error: ${updateCargoError}`);

  console.log('Validating createTruckListing contact rejection...');
  const createTruckError = await callFunctionExpectError('createTruckListing', truckerToken, {
    origin: 'Davao',
    destination: 'Cebu',
    askingPrice: 52000,
    description: 'telegram @unsafe_handle',
  });
  assert(createTruckError.toLowerCase().includes('description cannot contain contact information'), `Unexpected createTruckListing error: ${createTruckError}`);

  console.log('Validating createTruckListing safe payload...');
  const createdTruck = await callFunction('createTruckListing', truckerToken, {
    origin: 'Davao',
    destination: 'Cebu',
    askingPrice: 52000,
    description: 'Departure 08:00, ETA 16:30',
    availableDate: '2026-03-21',
  });
  assert(typeof createdTruck?.id === 'string' && createdTruck.id.length > 0, 'Expected truck listing id');

  console.log('Validating deprecated requestListingChat behavior...');
  const notificationsBefore = await countCollection(`users/${shipperUid}/notifications`);
  const chatRequestsBefore = await countCollection('chatRequests');
  const requestChatResult = await callFunction('requestListingChat', shipperToken, {
    listingType: 'cargo',
    listingId: createdCargo.id,
    recipientId: truckerUid,
    note: 'Please call me',
  });
  assert(requestChatResult?.deprecated === true, 'requestListingChat must return deprecated=true');
  assert(requestChatResult?.success === false, 'requestListingChat should not report success');
  const notificationsAfter = await countCollection(`users/${shipperUid}/notifications`);
  const chatRequestsAfter = await countCollection('chatRequests');
  assert(notificationsAfter === notificationsBefore, 'requestListingChat should not create notifications');
  assert(chatRequestsAfter === chatRequestsBefore, 'requestListingChat should not write chatRequests');

  console.log('Seeding bid + chat message to validate trigger behavior...');
  const bidId = 'anti-contact-bid-1';
  const messageId = 'anti-contact-message-1';

  await db.collection('bids').doc(bidId).set({
    bidderId: truckerUid,
    bidderName: 'Trucker 09995449410',
    listingOwnerId: shipperUid,
    listingOwnerName: 'Shipper Safe',
    listingId: createdCargo.id,
    cargoListingId: createdCargo.id,
    truckListingId: null,
    listingType: 'cargo',
    origin: 'Cebu',
    destination: 'Butuan',
    price: 48000,
    message: 'Route details',
    status: 'pending',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await db.collection('bids').doc(bidId).collection('messages').doc(messageId).set({
    senderId: truckerUid,
    senderName: 'Injected 09995449410',
    recipientId: 'wrong-recipient',
    message: 'Reach me at 09995449410 for updates',
    read: false,
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const triggeredMessage = await waitForCondition(async () => {
    const snap = await db.collection('bids').doc(bidId).collection('messages').doc(messageId).get();
    const data = snap.data() || {};
    if (data.recipientId === shipperUid && data.senderName === 'Trucker') {
      return data;
    }
    return null;
  });
  assert(triggeredMessage, 'Chat trigger did not canonicalize recipientId/senderName');
  assert(triggeredMessage.read === false && triggeredMessage.isRead === false, 'Chat trigger should not mutate read flags');

  const notificationId = `chat_${bidId}_${messageId}`;
  const notification = await waitForCondition(async () => {
    const snap = await db.collection(`users/${shipperUid}/notifications`).doc(notificationId).get();
    if (!snap.exists) return null;
    const data = snap.data() || {};
    if (typeof data.message === 'string' && data.message.length > 0) return data;
    return null;
  });

  assert(notification, 'Expected chat notification to be created for recipient');
  assert(notification.type === 'NEW_MESSAGE', 'Expected NEW_MESSAGE notification type');
  assert(notification.message.includes('[Contact Hidden]'), 'Notification preview should sanitize contact info');
  assert(!notification.message.includes('09995449410'), 'Notification preview must not leak raw contact number');

  console.log('anti-contact cloud function checks passed.');
}

main().catch((error) => {
  console.error('anti-contact cloud function checks failed:', error);
  process.exit(1);
});
