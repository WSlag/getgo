const admin = require('firebase-admin');
const axios = require('axios');
const crypto = require('crypto');

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'karga-ph';
const REGION = 'asia-southeast1';
const EMULATOR_HOSTS = {
  auth: process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099',
  firestore: process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080',
  functions: process.env.FUNCTIONS_EMULATOR_HOST || '127.0.0.1:5001',
};
const STORAGE_EMULATOR_HOST = process.env.FIREBASE_STORAGE_EMULATOR_HOST || '127.0.0.1:9199';
const APP_CHECK_TOKEN = process.env.SMOKE_APP_CHECK_TOKEN || 'dev-smoke-app-check';
const USE_STORAGE_EMULATOR =
  process.env.SMOKE_USE_STORAGE_EMULATOR === 'true' || process.argv.includes('--storage');
const SMOKE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAEklEQVR4nGNgYGD4z8DAwMDAAAQBAQAYf4f7AAAAAElFTkSuQmCC';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function clearEmulators() {
  await axios.delete(`http://${EMULATOR_HOSTS.auth}/emulator/v1/projects/${PROJECT_ID}/accounts`);
  await axios.delete(`http://${EMULATOR_HOSTS.firestore}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`);
}

function unwrapCallableResult(payload) {
  if (payload?.error) {
    const err = new Error(payload.error.message || 'Callable error');
    err.status = payload.error.status || 'UNKNOWN';
    err.details = payload.error.details;
    throw err;
  }
  if (payload && Object.prototype.hasOwnProperty.call(payload, 'result')) return payload.result;
  if (payload && Object.prototype.hasOwnProperty.call(payload, 'data')) return payload.data;
  return payload;
}

async function signInWithCustomToken(uid) {
  const customToken = await admin.auth().createCustomToken(uid);
  const response = await axios.post(
    `http://${EMULATOR_HOSTS.auth}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`,
    { token: customToken, returnSecureToken: true }
  );
  const idToken = response.data?.idToken;
  assert(idToken, `Failed to obtain ID token for uid=${uid}`);
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
          'X-Firebase-AppCheck': APP_CHECK_TOKEN,
        },
      }
    );
    return unwrapCallableResult(response.data);
  } catch (error) {
    const payload = error?.response?.data;
    if (payload) {
      try {
        return unwrapCallableResult(payload);
      } catch (unwrappedError) {
        unwrappedError.raw = payload;
        throw unwrappedError;
      }
    }
    throw error;
  }
}

async function expectFunctionError(run, expectedStatus, expectedMessagePart) {
  let failed = false;
  try {
    await run();
    failed = true;
  } catch (error) {
    const status = String(error.status || '').toUpperCase();
    const message = String(error.message || '');
    if (expectedStatus) {
      assert(
        status.includes(expectedStatus.toUpperCase()),
        `Expected status ${expectedStatus}, got ${status || '<none>'} (${message})`
      );
    }
    if (expectedMessagePart) {
      assert(
        message.toLowerCase().includes(expectedMessagePart.toLowerCase()),
        `Expected message to include "${expectedMessagePart}", got "${message}"`
      );
    }
    return;
  }
  if (failed) {
    throw new Error(`Expected function call to fail with ${expectedStatus || 'an error'}, but it succeeded`);
  }
}

async function seedUser(authUser, profile) {
  await admin.auth().createUser(authUser);
  await admin.firestore().collection('users').doc(authUser.uid).set(profile);
}

async function seedBidAndContract({
  bidId,
  contractId,
  truckerUid,
  shipperUid,
  price,
  contractNumber,
  platformFee,
  route,
}) {
  const now = admin.firestore.FieldValue.serverTimestamp();
  const db = admin.firestore();

  await db.collection('bids').doc(bidId).set({
    bidderId: truckerUid,
    bidderName: 'Smoke Trucker',
    bidderType: 'trucker',
    listingOwnerId: null,
    listingOwnerName: null,
    cargoListingId: null,
    truckListingId: null,
    listingType: 'cargo',
    origin: route.origin,
    destination: route.destination,
    price,
    status: 'accepted',
    createdAt: now,
    updatedAt: now,
  });

  await db.collection('contracts').doc(contractId).set({
    bidId,
    listingType: 'cargo',
    listingOwnerId: shipperUid,
    platformFeePayerId: truckerUid,
    platformFee: platformFee,
    platformFeePercentage: 5,
    platformFeePaid: false,
    platformFeeStatus: 'unpaid',
    status: 'pending_payment',
    contractNumber,
    participantIds: [shipperUid, truckerUid],
    origin: route.origin,
    destination: route.destination,
    createdAt: now,
    updatedAt: now,
  });
}

async function findOnePlatformFeeByBid(bidId) {
  const snap = await admin.firestore()
    .collection('platformFees')
    .where('bidId', '==', bidId)
    .where('status', '==', 'completed')
    .limit(2)
    .get();
  assert(snap.size <= 1, `Expected <=1 platform fee for ${bidId}, got ${snap.size}`);
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

async function waitForSubmissionProcessing(submissionId, timeoutMs = 20000) {
  const startedAt = Date.now();
  const docRef = admin.firestore().collection('paymentSubmissions').doc(submissionId);

  while (Date.now() - startedAt < timeoutMs) {
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      const data = docSnap.data() || {};
      if (data.ocrStatus === 'failed' || data.ocrStatus === 'completed') {
        return data;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error(`Timed out waiting for processPaymentSubmission on ${submissionId}`);
}

function buildFirebaseStorageUrl(projectId, objectPath) {
  return `https://firebasestorage.googleapis.com/v0/b/${projectId}.appspot.com/o/${encodeURIComponent(objectPath)}?alt=media`;
}

function buildStorageEmulatorUrl(projectId, objectPath) {
  return `http://${STORAGE_EMULATOR_HOST}/v0/b/${projectId}.appspot.com/o/${encodeURIComponent(objectPath)}?alt=media`;
}

function appendDownloadToken(url, token) {
  if (!token) return url;
  return `${url}&token=${encodeURIComponent(token)}`;
}

async function createSmokeScreenshotUrl(userId, label) {
  const objectPath = `payments/${userId}/${label}-${Date.now()}.png`;

  if (!USE_STORAGE_EMULATOR) {
    return buildFirebaseStorageUrl(PROJECT_ID, objectPath);
  }

  const bucket = admin.storage().bucket(`${PROJECT_ID}.appspot.com`);
  const file = bucket.file(objectPath);
  const imageBuffer = Buffer.from(SMOKE_PNG_BASE64, 'base64');
  const downloadToken = crypto.randomUUID();

  await file.save(imageBuffer, {
    contentType: 'image/png',
    resumable: false,
    metadata: {
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
      },
    },
  });

  return appendDownloadToken(buildStorageEmulatorUrl(PROJECT_ID, objectPath), downloadToken);
}

async function main() {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = EMULATOR_HOSTS.auth;
  process.env.FIRESTORE_EMULATOR_HOST = EMULATOR_HOSTS.firestore;
  if (USE_STORAGE_EMULATOR) {
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = STORAGE_EMULATOR_HOST;
  }

  admin.initializeApp({
    projectId: PROJECT_ID,
    storageBucket: `${PROJECT_ID}.appspot.com`,
  });
  const db = admin.firestore();

  const shipperUid = 'shipper-gcash-smoke';
  const truckerUid = 'trucker-gcash-smoke';
  const adminUid = 'admin-gcash-smoke';

  const bid1Id = 'bid-gcash-smoke-1';
  const contract1Id = 'contract-gcash-smoke-1';
  const bid2Id = 'bid-gcash-smoke-2';
  const contract2Id = 'contract-gcash-smoke-2';

  const amount1 = 500;
  const amount2 = 700;

  console.log('1/8 Clearing emulators...');
  await clearEmulators();

  console.log('2/8 Seeding users, claims, and contracts...');
  const now = admin.firestore.FieldValue.serverTimestamp();
  await seedUser(
    { uid: shipperUid, phoneNumber: '+639171110001' },
    {
      name: 'Smoke Shipper',
      phone: '+639171110001',
      role: 'shipper',
      isAdmin: false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }
  );
  await seedUser(
    { uid: truckerUid, phoneNumber: '+639171110002' },
    {
      name: 'Smoke Trucker',
      phone: '+639171110002',
      role: 'trucker',
      isAdmin: false,
      isActive: true,
      outstandingPlatformFees: amount1 + amount2,
      outstandingFeeContracts: [contract1Id, contract2Id],
      createdAt: now,
      updatedAt: now,
    }
  );
  await seedUser(
    { uid: adminUid, phoneNumber: '+639171110003' },
    {
      name: 'Smoke Admin',
      phone: '+639171110003',
      role: 'shipper',
      isAdmin: false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }
  );
  await admin.auth().setCustomUserClaims(adminUid, { admin: true });
  await db.collection('users').doc(adminUid).update({
    role: 'admin',
    isAdmin: true,
    updatedAt: now,
  });

  await seedBidAndContract({
    bidId: bid1Id,
    contractId: contract1Id,
    truckerUid,
    shipperUid,
    price: 10000,
    contractNumber: 'SMOKE-CTR-0001',
    platformFee: amount1,
    route: { origin: 'Manila', destination: 'Cebu' },
  });
  await seedBidAndContract({
    bidId: bid2Id,
    contractId: contract2Id,
    truckerUid,
    shipperUid,
    price: 14000,
    contractNumber: 'SMOKE-CTR-0002',
    platformFee: amount2,
    route: { origin: 'Davao', destination: 'Cagayan de Oro' },
  });

  const shipperToken = await signInWithCustomToken(shipperUid);
  const truckerToken = await signInWithCustomToken(truckerUid);
  const adminToken = await signInWithCustomToken(adminUid);

  console.log('3/8 Validating callable access controls and idempotency...');
  await expectFunctionError(
    () => callFunction('createPlatformFeeOrder', shipperToken, { bidId: bid1Id, idempotencyKey: 'shipper-must-fail' }),
    'PERMISSION_DENIED',
    'Only the trucker can pay'
  );

  const config = await callFunction('getGcashConfig', truckerToken, {});
  assert(config?.accountName, 'getGcashConfig must include accountName');
  assert(String(config?.accountNumber || '').includes('****'), 'getGcashConfig should mask account number');

  const firstOrderResponse = await callFunction('createPlatformFeeOrder', truckerToken, {
    bidId: bid1Id,
    idempotencyKey: 'smoke-order-1',
  });
  assert(firstOrderResponse?.success === true, 'Expected first createPlatformFeeOrder success');
  const order1 = firstOrderResponse.order;
  assert(order1?.orderId, 'First order response missing orderId');
  assert(Number(order1.amount) === amount1, `Expected first order amount ${amount1}, got ${order1.amount}`);

  const sameKeyReuse = await callFunction('createPlatformFeeOrder', truckerToken, {
    bidId: bid1Id,
    idempotencyKey: 'smoke-order-1',
  });
  assert(sameKeyReuse?.reused === true, 'Expected same idempotency key to reuse existing order');
  assert(sameKeyReuse?.order?.orderId === order1.orderId, 'Expected same orderId for repeated idempotent call');

  const differentKeyReuse = await callFunction('createPlatformFeeOrder', truckerToken, {
    bidId: bid1Id,
    idempotencyKey: 'smoke-order-1-different-key',
  });
  assert(differentKeyReuse?.reused === true, 'Expected active order reuse even with different idempotency key');
  assert(differentKeyReuse?.order?.orderId === order1.orderId, 'Expected one active order per bid+payer');

  const pendingBeforeApproval = await callFunction('getPendingOrders', truckerToken, {});
  const pendingOrderIds = (pendingBeforeApproval.orders || []).map((o) => o.orderId || o.id);
  assert(pendingOrderIds.includes(order1.orderId), 'Expected first order in pending orders before approval');

  await expectFunctionError(
    () => callFunction('getOrder', shipperToken, { orderId: order1.orderId }),
    'PERMISSION_DENIED',
    'Access denied'
  );
  const truckerOrderRead = await callFunction('getOrder', truckerToken, { orderId: order1.orderId });
  assert((truckerOrderRead?.order?.orderId || truckerOrderRead?.order?.id) === order1.orderId, 'Trucker must read own order');

  console.log('4/8 Simulating payment submission and manual approval...');
  const screenshotUrl1 = await createSmokeScreenshotUrl(truckerUid, 'smoke1');
  const submission1Ref = await db.collection('paymentSubmissions').add({
    orderId: order1.orderId,
    bidId: bid1Id,
    userId: truckerUid,
    screenshotUrl: screenshotUrl1,
    status: 'pending',
    ocrStatus: 'pending',
    validationErrors: ['Synthetic smoke submission'],
    createdAt: now,
    uploadedAt: now,
    updatedAt: now,
  });
  const submission1Id = submission1Ref.id;
  const processedSubmission1 = await waitForSubmissionProcessing(submission1Id);
  assert(
    ['manual_review', 'rejected', 'approved'].includes(processedSubmission1.status),
    `Expected processed submission1 status, got ${processedSubmission1.status || 'unknown'}`
  );

  await expectFunctionError(
    () => callFunction('adminApprovePayment', truckerToken, { submissionId: submission1Id, notes: 'should-fail' }),
    'PERMISSION_DENIED',
    'Admin access required'
  );

  const approveResult = await callFunction('adminApprovePayment', adminToken, {
    submissionId: submission1Id,
    notes: 'Smoke test approve path',
  });
  assert(approveResult?.success === true, 'adminApprovePayment should return success');

  console.log('5/8 Verifying approval side effects...');
  const submission1Doc = await db.collection('paymentSubmissions').doc(submission1Id).get();
  const submission1 = submission1Doc.data() || {};
  assert(submission1.status === 'approved', `Expected submission1 status approved, got ${submission1.status}`);
  assert(submission1.resolvedBy === adminUid, `Expected submission1 resolvedBy ${adminUid}, got ${submission1.resolvedBy}`);

  const order1Doc = await db.collection('orders').doc(order1.orderId).get();
  const order1Data = order1Doc.data() || {};
  assert(order1Data.status === 'verified', `Expected order1 status verified, got ${order1Data.status}`);
  assert(order1Data.verifiedSubmissionId === submission1Id, 'Expected order1.verifiedSubmissionId to match submission1');

  const contract1Doc = await db.collection('contracts').doc(contract1Id).get();
  const contract1 = contract1Doc.data() || {};
  assert(contract1.status === 'draft', `Expected contract1 status draft after payment, got ${contract1.status}`);
  assert(contract1.platformFeePaid === true, 'Expected contract1 platformFeePaid=true');
  assert(contract1.platformFeeStatus === 'paid', `Expected contract1 platformFeeStatus=paid, got ${contract1.platformFeeStatus}`);
  assert(contract1.platformFeeOrderId === order1.orderId, 'Expected contract1 to retain payment order reference');

  const platformFee1 = await findOnePlatformFeeByBid(bid1Id);
  assert(platformFee1, 'Expected completed platform fee record for bid1');
  assert(platformFee1.orderId === order1.orderId, 'platformFees.orderId should match approved order');
  assert(Number(platformFee1.amount) === amount1, `Expected platform fee amount ${amount1}, got ${platformFee1.amount}`);

  const truckerDocAfterApprove = await db.collection('users').doc(truckerUid).get();
  const truckerAfterApprove = truckerDocAfterApprove.data() || {};
  assert(
    Number(truckerAfterApprove.outstandingPlatformFees) === amount2,
    `Expected outstandingPlatformFees=${amount2} after first approval, got ${truckerAfterApprove.outstandingPlatformFees}`
  );
  const remainingContracts = Array.isArray(truckerAfterApprove.outstandingFeeContracts)
    ? truckerAfterApprove.outstandingFeeContracts
    : [];
  assert(!remainingContracts.includes(contract1Id), 'Expected first contract removed from outstandingFeeContracts');
  assert(remainingContracts.includes(contract2Id), 'Expected second contract to remain in outstandingFeeContracts');

  const truckerNotificationsAfterApprove = await db.collection('users').doc(truckerUid).collection('notifications').get();
  const shipperNotificationsAfterApprove = await db.collection('users').doc(shipperUid).collection('notifications').get();
  assert(
    truckerNotificationsAfterApprove.docs.some((doc) => (doc.data()?.type === 'PAYMENT_VERIFIED')),
    'Expected PAYMENT_VERIFIED notification for trucker'
  );
  assert(
    shipperNotificationsAfterApprove.docs.some((doc) => (doc.data()?.type === 'CONTRACT_READY')),
    'Expected CONTRACT_READY notification for shipper'
  );

  const pendingAfterApproval = await callFunction('getPendingOrders', truckerToken, {});
  const pendingAfterApprovalIds = (pendingAfterApproval.orders || []).map((o) => o.orderId || o.id);
  assert(!pendingAfterApprovalIds.includes(order1.orderId), 'Approved order should not remain in pending orders');

  console.log('6/8 Running manual rejection path...');
  const secondOrderResponse = await callFunction('createPlatformFeeOrder', truckerToken, {
    bidId: bid2Id,
    idempotencyKey: 'smoke-order-2',
  });
  assert(secondOrderResponse?.success === true, 'Expected second order creation success');
  const order2Id = secondOrderResponse?.order?.orderId;
  assert(order2Id, 'Expected second orderId');
  assert(Number(secondOrderResponse.order.amount) === amount2, `Expected second order amount ${amount2}`);

  const screenshotUrl2 = await createSmokeScreenshotUrl(truckerUid, 'smoke2');
  const submission2Ref = await db.collection('paymentSubmissions').add({
    orderId: order2Id,
    bidId: bid2Id,
    userId: truckerUid,
    screenshotUrl: screenshotUrl2,
    status: 'pending',
    ocrStatus: 'pending',
    validationErrors: ['Synthetic smoke submission'],
    createdAt: now,
    uploadedAt: now,
    updatedAt: now,
  });
  const submission2Id = submission2Ref.id;
  const processedSubmission2 = await waitForSubmissionProcessing(submission2Id);
  assert(
    ['manual_review', 'rejected', 'approved'].includes(processedSubmission2.status),
    `Expected processed submission2 status, got ${processedSubmission2.status || 'unknown'}`
  );

  const rejectResult = await callFunction('adminRejectPayment', adminToken, {
    submissionId: submission2Id,
    reason: 'Smoke rejection path',
    notes: 'Smoke rejection path',
  });
  assert(rejectResult?.success === true, 'adminRejectPayment should return success');

  console.log('7/8 Verifying rejection side effects...');
  const submission2Doc = await db.collection('paymentSubmissions').doc(submission2Id).get();
  const submission2 = submission2Doc.data() || {};
  assert(submission2.status === 'rejected', `Expected submission2 status rejected, got ${submission2.status}`);
  assert(submission2.resolvedBy === adminUid, `Expected submission2 resolvedBy ${adminUid}, got ${submission2.resolvedBy}`);

  const order2Doc = await db.collection('orders').doc(order2Id).get();
  const order2 = order2Doc.data() || {};
  assert(order2.status === 'rejected', `Expected order2 status rejected, got ${order2.status}`);

  const contract2Doc = await db.collection('contracts').doc(contract2Id).get();
  const contract2 = contract2Doc.data() || {};
  assert(contract2.status === 'pending_payment', `Expected contract2 to remain pending_payment, got ${contract2.status}`);
  assert(contract2.platformFeePaid === false, 'Rejected payment must not mark contract2 as paid');

  const platformFee2 = await findOnePlatformFeeByBid(bid2Id);
  assert(platformFee2 === null, 'Rejected payment must not create completed platform fee record for bid2');

  const truckerNotificationsAfterReject = await db.collection('users').doc(truckerUid).collection('notifications').get();
  assert(
    truckerNotificationsAfterReject.docs.some((doc) => (doc.data()?.type === 'PAYMENT_STATUS')),
    'Expected PAYMENT_STATUS notification after rejection'
  );

  const finalPending = await callFunction('getPendingOrders', truckerToken, {});
  const finalPendingIds = (finalPending.orders || []).map((o) => o.orderId || o.id);
  assert(finalPendingIds.length === 0, `Expected no pending orders at end, got ${finalPendingIds.join(', ') || 'none'}`);

  console.log('8/8 GCash payment smoke test passed.');
  console.log(`Approved submission: ${submission1Id}`);
  console.log(`Rejected submission: ${submission2Id}`);
  console.log(`Order IDs: ${order1.orderId}, ${order2Id}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('GCash payment smoke test failed.');
    console.error(error?.stack || error?.message || error);
    process.exit(1);
  });
