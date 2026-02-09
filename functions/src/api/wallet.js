/**
 * Wallet Management Cloud Functions
 * Handles wallet operations: platform fee payment, top-up orders, GCash config
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

const PLATFORM_FEE_RATE = 0.05; // 5%

// GCash configuration
const GCASH_CONFIG = {
  accountNumber: process.env.GCASH_ACCOUNT_NUMBER || '09272240000',
  accountName: process.env.GCASH_ACCOUNT_NAME || 'GetGo',
  qrCodeUrl: process.env.GCASH_QR_URL || null,
  maxDailyTopup: 50000,
  maxDailySubmissions: 5,
  orderExpiryMinutes: 30,
};

// Helper: Generate unique order ID
function generateOrderId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${timestamp}-${random}`;
}

// Helper: Mask phone number for display
function maskPhoneNumber(phone) {
  if (!phone || phone.length < 7) return phone;
  return phone.slice(0, 4) + '****' + phone.slice(-3);
}

/**
 * Create Platform Fee Payment Order (GCash Screenshot Verification)
 * Replaces wallet-based platform fee payment
 */
exports.createPlatformFeeOrder = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { bidId } = data;
  const userId = context.auth.uid;

  if (!bidId) {
    throw new functions.https.HttpsError('invalid-argument', 'Bid ID is required');
  }

  const db = admin.firestore();

  // Validate bid exists and is accepted
  const bidDoc = await db.collection('bids').doc(bidId).get();
  if (!bidDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Bid not found');
  }

  const bid = { id: bidDoc.id, ...bidDoc.data() };

  if (bid.status !== 'accepted') {
    throw new functions.https.HttpsError('failed-precondition', 'Bid must be accepted before paying platform fee');
  }

  // Verify the user is the listing owner
  if (bid.listingOwnerId !== userId) {
    throw new functions.https.HttpsError('permission-denied', 'Only the listing owner can pay the platform fee');
  }

  // Calculate platform fee
  const platformFee = Math.round(bid.price * PLATFORM_FEE_RATE);

  // Check if fee already paid
  const existingFeeSnap = await db.collection('platformFees')
    .where('bidId', '==', bidId)
    .where('status', '==', 'completed')
    .limit(1)
    .get();

  if (!existingFeeSnap.empty) {
    throw new functions.https.HttpsError(
      'already-exists',
      'Platform fee already paid for this bid'
    );
  }

  // Get listing data for reference
  let listingId = null;
  if (bid.cargoListingId) {
    listingId = bid.cargoListingId;
  } else if (bid.truckListingId) {
    listingId = bid.truckListingId;
  }

  // Create order
  const orderId = generateOrderId();
  const expiresAt = new Date(Date.now() + GCASH_CONFIG.orderExpiryMinutes * 60 * 1000);

  const orderData = {
    orderId,
    userId,
    type: 'platform_fee',
    bidId,
    listingId,
    listingOwnerId: userId,
    amount: platformFee,
    method: 'gcash',
    status: 'awaiting_upload',
    gcashAccountNumber: GCASH_CONFIG.accountNumber,
    gcashAccountName: GCASH_CONFIG.accountName,
    expectedReceiverName: GCASH_CONFIG.accountName,
    gcashQrUrl: GCASH_CONFIG.qrCodeUrl,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection('orders').doc(orderId).set(orderData);

  return {
    success: true,
    order: {
      orderId,
      bidId,
      amount: platformFee,
      gcashAccountNumber: maskPhoneNumber(GCASH_CONFIG.accountNumber),
      gcashAccountName: GCASH_CONFIG.accountName,
      gcashQrUrl: GCASH_CONFIG.qrCodeUrl,
      expiresAt: expiresAt.toISOString(),
      expiresInMinutes: GCASH_CONFIG.orderExpiryMinutes,
    },
  };
});

/**
 * Create Top-Up Order (GCash Screenshot Verification)
 */
exports.createTopUpOrder = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { amount } = data;
  const userId = context.auth.uid;

  if (!amount || amount <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Valid amount is required');
  }

  if (amount > GCASH_CONFIG.maxDailyTopup) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `Maximum top-up amount is ₱${GCASH_CONFIG.maxDailyTopup.toLocaleString()}`
    );
  }

  const db = admin.firestore();

  // Check daily submission limit
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayOrdersSnapshot = await db
    .collection('orders')
    .where('userId', '==', userId)
    .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(today))
    .get();

  if (todayOrdersSnapshot.size >= GCASH_CONFIG.maxDailySubmissions) {
    throw new functions.https.HttpsError(
      'resource-exhausted',
      `Daily limit reached. Maximum ${GCASH_CONFIG.maxDailySubmissions} top-up attempts per day.`
    );
  }

  // Create order
  const orderId = generateOrderId();
  const expiresAt = new Date(Date.now() + GCASH_CONFIG.orderExpiryMinutes * 60 * 1000);

  const orderData = {
    orderId,
    userId,
    amount: parseFloat(amount),
    method: 'gcash',
    status: 'awaiting_upload',
    gcashAccountNumber: GCASH_CONFIG.accountNumber,
    gcashAccountName: GCASH_CONFIG.accountName,
    expectedReceiverName: GCASH_CONFIG.accountName,
    gcashQrUrl: GCASH_CONFIG.qrCodeUrl,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection('orders').doc(orderId).set(orderData);

  return {
    success: true,
    order: {
      orderId,
      amount: parseFloat(amount),
      gcashAccountNumber: maskPhoneNumber(GCASH_CONFIG.accountNumber),
      gcashAccountName: GCASH_CONFIG.accountName,
      gcashQrUrl: GCASH_CONFIG.qrCodeUrl,
      expiresAt: expiresAt.toISOString(),
      expiresInMinutes: GCASH_CONFIG.orderExpiryMinutes,
    },
  };
});

/**
 * Get GCash Configuration
 */
exports.getGcashConfig = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  return {
    accountName: GCASH_CONFIG.accountName,
    accountNumber: maskPhoneNumber(GCASH_CONFIG.accountNumber),
    qrCodeUrl: GCASH_CONFIG.qrCodeUrl,
    maxDailyTopup: GCASH_CONFIG.maxDailyTopup,
    orderExpiryMinutes: GCASH_CONFIG.orderExpiryMinutes,
  };
});

// Wallet payout functionality removed - direct GCash payment only
