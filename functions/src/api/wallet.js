/**
 * Wallet Management Cloud Functions
 * Handles wallet operations: platform fee payment, top-up orders, GCash config
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { FieldValue, Timestamp } = require('firebase-admin/firestore');
const crypto = require('crypto');
const {
  loadPlatformSettings,
  calculatePlatformFeeAmount,
  shouldBlockForMaintenance,
} = require('../config/platformSettings');

const IDEMPOTENCY_COLLECTION = 'idempotency';
const ACTIVE_PLATFORM_FEE_ORDER_STATUSES = new Set(['awaiting_upload', 'pending', 'submitted', 'processing']);
const isProductionRuntime = process.env.NODE_ENV === 'production';

function checkAppToken(context) {
  if (process.env.APP_CHECK_ENFORCED !== 'true') return;
  if (context.app === undefined) {
    throw new HttpsError('failed-precondition', 'App Check verification required');
  }
}

// Avoid module-load crashes during deployment discovery; enforce at call-time instead.
if (isProductionRuntime && (!process.env.GCASH_ACCOUNT_NUMBER || !process.env.GCASH_ACCOUNT_NAME)) {
  console.warn('GCash env vars missing at module init; wallet calls will fail until env is configured.');
}

const BASE_GCASH_CONFIG = {
  accountNumber: process.env.GCASH_ACCOUNT_NUMBER || null,
  accountName: process.env.GCASH_ACCOUNT_NAME || null,
  qrCodeUrl: process.env.GCASH_QR_URL || null,
  maxDailyTopup: 50000,
  maxDailySubmissions: 5,
  orderExpiryMinutes: 30,
};

function resolveRuntimeGcashConfig(platformSettings = null) {
  return {
    accountNumber: platformSettings?.gcash?.accountNumber || BASE_GCASH_CONFIG.accountNumber,
    accountName: platformSettings?.gcash?.accountName || BASE_GCASH_CONFIG.accountName,
    qrCodeUrl: platformSettings?.gcash?.qrCodeUrl || BASE_GCASH_CONFIG.qrCodeUrl,
    maxDailyTopup: BASE_GCASH_CONFIG.maxDailyTopup,
    maxDailySubmissions: BASE_GCASH_CONFIG.maxDailySubmissions,
    orderExpiryMinutes: BASE_GCASH_CONFIG.orderExpiryMinutes,
  };
}

function assertGcashConfigured(gcashConfig) {
  if (!gcashConfig.accountNumber || !gcashConfig.accountName) {
    throw new HttpsError(
      'failed-precondition',
      'GCash configuration is missing. Contact support.'
    );
  }
}

// Helper: Generate unique order ID
function generateOrderId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${timestamp}-${random}`;
}

function normalizeIdempotencyKey(rawKey) {
  if (rawKey === undefined || rawKey === null || rawKey === '') {
    return null;
  }
  if (typeof rawKey !== 'string') {
    throw new HttpsError('invalid-argument', 'idempotencyKey must be a string');
  }

  const trimmed = rawKey.trim();
  if (!trimmed) {
    throw new HttpsError('invalid-argument', 'idempotencyKey cannot be empty');
  }
  if (trimmed.length > 128) {
    throw new HttpsError('invalid-argument', 'idempotencyKey must be at most 128 characters');
  }
  return trimmed;
}

function getIdempotencyLockRef(db, userId, operation, idempotencyKey) {
  if (!idempotencyKey) {
    return null;
  }
  const keyHash = crypto.createHash('sha256').update(idempotencyKey).digest('hex');
  return db.collection(IDEMPOTENCY_COLLECTION).doc(`${userId}:${operation}:${keyHash}`);
}

function timestampToMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return 0;
}

function buildPlatformOrderResponse(orderData, gcashConfig) {
  const expiresAtDate = orderData.expiresAt?.toDate ? orderData.expiresAt.toDate() : null;
  return {
    orderId: orderData.orderId,
    bidId: orderData.bidId,
    amount: orderData.amount,
    gcashAccountNumber: maskPhoneNumber(orderData.gcashAccountNumber || gcashConfig.accountNumber),
    gcashAccountName: orderData.gcashAccountName || gcashConfig.accountName,
    gcashQrUrl: orderData.gcashQrUrl || gcashConfig.qrCodeUrl,
    expiresAt: expiresAtDate ? expiresAtDate.toISOString() : null,
    expiresInMinutes: gcashConfig.orderExpiryMinutes,
  };
}

function buildTopUpOrderResponse(orderData, gcashConfig) {
  const expiresAtDate = orderData.expiresAt?.toDate ? orderData.expiresAt.toDate() : null;
  return {
    orderId: orderData.orderId,
    amount: parseFloat(orderData.amount),
    gcashAccountNumber: maskPhoneNumber(orderData.gcashAccountNumber || gcashConfig.accountNumber),
    gcashAccountName: orderData.gcashAccountName || gcashConfig.accountName,
    gcashQrUrl: orderData.gcashQrUrl || gcashConfig.qrCodeUrl,
    expiresAt: expiresAtDate ? expiresAtDate.toISOString() : null,
    expiresInMinutes: gcashConfig.orderExpiryMinutes,
  };
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
exports.createPlatformFeeOrder = onCall(
  { region: 'asia-southeast1' },
  async (request) => {
    const data = request.data || {};
    const context = request;
    checkAppToken(context);

    if (!context.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    const { bidId, idempotencyKey: rawIdempotencyKey } = data;
    const userId = context.auth.uid;
    const idempotencyKey = normalizeIdempotencyKey(rawIdempotencyKey);

    if (!bidId) {
      throw new HttpsError('invalid-argument', 'Bid ID is required');
    }

  const db = admin.firestore();
  const platformSettings = await loadPlatformSettings(db);
  const runtimeGcashConfig = resolveRuntimeGcashConfig(platformSettings);
  assertGcashConfigured(runtimeGcashConfig);
  if (shouldBlockForMaintenance(platformSettings, context.auth?.token)) {
    throw new HttpsError('failed-precondition', 'Platform is currently under maintenance');
  }
  if (platformSettings?.features?.paymentVerificationEnabled === false) {
    throw new HttpsError('failed-precondition', 'GCash payment verification is currently disabled');
  }

  const lockRef = getIdempotencyLockRef(db, userId, 'createPlatformFeeOrder', idempotencyKey);

  const result = await db.runTransaction(async (tx) => {
    if (lockRef) {
      const lockDoc = await tx.get(lockRef);
      if (lockDoc.exists) {
        const lockedOrderId = lockDoc.data().orderId;
        if (lockedOrderId) {
          const lockedOrderDoc = await tx.get(db.collection('orders').doc(lockedOrderId));
          if (lockedOrderDoc.exists) {
            const existingLockedOrder = { id: lockedOrderDoc.id, ...lockedOrderDoc.data() };
            if (existingLockedOrder.userId !== userId) {
              throw new HttpsError('permission-denied', 'Idempotency key belongs to a different user');
            }
            return { orderData: existingLockedOrder, reused: true };
          }
        }
      }
    }

    // Validate bid exists
    const bidDoc = await tx.get(db.collection('bids').doc(bidId));
    if (!bidDoc.exists) {
      throw new HttpsError('not-found', 'Bid not found');
    }

    const bid = { id: bidDoc.id, ...bidDoc.data() };

    // Fetch contract for this bid (contract is normally created at bid acceptance)
    const contractSnap = await tx.get(
      db.collection('contracts')
        .where('bidId', '==', bidId)
        .limit(1)
    );

    const contractDoc = contractSnap.empty ? null : contractSnap.docs[0];
    const contract = contractDoc ? { id: contractDoc.id, ...contractDoc.data() } : null;
    const contractRef = contractDoc ? contractDoc.ref : null;

    // Backward compatibility: allow payment from accepted/contracted bids even if contract is missing
    if (!contract && bid.status !== 'accepted' && bid.status !== 'contracted') {
      throw new HttpsError(
        'failed-precondition',
        'Platform fee can only be paid for accepted/contracted bids'
      );
    }

    // Fast path when contract already marked as paid
    if (contract?.platformFeePaid) {
      throw new HttpsError(
        'already-exists',
        'Platform fee already paid for this contract'
      );
    }

    // Determine who is the trucker (platform fee payer)
    const isCargo = contract ? contract.listingType === 'cargo' : !!bid.cargoListingId;
    const truckerUserId = isCargo ? bid.bidderId : bid.listingOwnerId;
    const expectedPayerId = contract?.platformFeePayerId || truckerUserId;

    // Verify the user is the trucker
    if (expectedPayerId !== userId) {
      throw new HttpsError('permission-denied', 'Only the trucker can pay the platform fee');
    }

    // Use contract fee when available to avoid pricing drift
    const platformFee = contract?.platformFee || calculatePlatformFeeAmount(bid.price, platformSettings);

    // Check if fee already paid
    const existingFeeSnap = await tx.get(
      db.collection('platformFees')
        .where('bidId', '==', bidId)
        .where('status', '==', 'completed')
        .limit(1)
    );

    if (!existingFeeSnap.empty) {
      throw new HttpsError(
        'already-exists',
        'Platform fee already paid for this bid'
      );
    }

    // Enforce one active platform fee order per bid + user.
    const existingOrdersSnap = await tx.get(
      db.collection('orders')
        .where('bidId', '==', bidId)
        .limit(20)
    );
    const reusableOrder = existingOrdersSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((order) =>
        order.userId === userId &&
        order.type === 'platform_fee' &&
        ACTIVE_PLATFORM_FEE_ORDER_STATUSES.has(order.status))
      .sort((a, b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt))[0];

    if (reusableOrder) {
      if (contractRef && contract?.platformFeeOrderId !== reusableOrder.orderId) {
        tx.update(contractRef, {
          platformFeeOrderId: reusableOrder.orderId,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      if (lockRef) {
        tx.set(lockRef, {
          userId,
          operation: 'createPlatformFeeOrder',
          orderId: reusableOrder.orderId,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      return { orderData: reusableOrder, reused: true };
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
    const expiresAt = new Date(Date.now() + runtimeGcashConfig.orderExpiryMinutes * 60 * 1000);

    const contractId = contract?.id || null;
    if (contractRef) {
      // Update contract with order reference
      tx.update(contractRef, {
        platformFeeOrderId: orderId,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    const orderData = {
      orderId,
      userId,
      type: 'platform_fee',
      bidId,
      listingId,
      contractId,  // NEW: Link to contract
      listingOwnerId: bid.listingOwnerId,
      amount: platformFee,
      method: 'gcash',
      status: 'awaiting_upload',
      gcashAccountNumber: runtimeGcashConfig.accountNumber,
      gcashAccountName: runtimeGcashConfig.accountName,
      expectedReceiverName: runtimeGcashConfig.accountName,
      gcashQrUrl: runtimeGcashConfig.qrCodeUrl,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromDate(expiresAt),
      updatedAt: FieldValue.serverTimestamp(),
    };

    tx.set(db.collection('orders').doc(orderId), orderData);

    if (lockRef) {
      tx.set(lockRef, {
        userId,
        operation: 'createPlatformFeeOrder',
        orderId,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    return { orderData, reused: false };
  });

    return {
      success: true,
      reused: result.reused,
      order: buildPlatformOrderResponse(result.orderData, runtimeGcashConfig),
    };
  }
);

/**
 * Create Top-Up Order (GCash Screenshot Verification)
 */
exports.createTopUpOrder = onCall(
  { region: 'asia-southeast1' },
  async (request) => {
    const data = request.data || {};
    const context = request;
    checkAppToken(context);

    if (!context.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    const { amount, idempotencyKey: rawIdempotencyKey } = data;
    const userId = context.auth.uid;
    const idempotencyKey = normalizeIdempotencyKey(rawIdempotencyKey);

    if (!amount || amount <= 0) {
      throw new HttpsError('invalid-argument', 'Valid amount is required');
    }

  const db = admin.firestore();
  const platformSettings = await loadPlatformSettings(db);
  const runtimeGcashConfig = resolveRuntimeGcashConfig(platformSettings);
  assertGcashConfigured(runtimeGcashConfig);
  if (shouldBlockForMaintenance(platformSettings, context.auth?.token)) {
    throw new HttpsError('failed-precondition', 'Platform is currently under maintenance');
  }
  if (platformSettings?.features?.paymentVerificationEnabled === false) {
    throw new HttpsError('failed-precondition', 'GCash payment verification is currently disabled');
  }

  if (amount > runtimeGcashConfig.maxDailyTopup) {
    throw new HttpsError(
      'invalid-argument',
      `Maximum top-up amount is ₱${runtimeGcashConfig.maxDailyTopup.toLocaleString()}`
    );
  }

  const lockRef = getIdempotencyLockRef(db, userId, 'createTopUpOrder', idempotencyKey);

  const result = await db.runTransaction(async (tx) => {
    if (lockRef) {
      const lockDoc = await tx.get(lockRef);
      if (lockDoc.exists) {
        const lockedOrderId = lockDoc.data().orderId;
        if (lockedOrderId) {
          const lockedOrderDoc = await tx.get(db.collection('orders').doc(lockedOrderId));
          if (lockedOrderDoc.exists) {
            const existingLockedOrder = { id: lockedOrderDoc.id, ...lockedOrderDoc.data() };
            if (existingLockedOrder.userId !== userId) {
              throw new HttpsError('permission-denied', 'Idempotency key belongs to a different user');
            }
            return { orderData: existingLockedOrder, reused: true };
          }
        }
      }
    }

    // Check daily submission limit inside transaction to prevent TOCTOU race
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayOrdersSnapshot = await tx.get(
      db.collection('orders')
        .where('userId', '==', userId)
        .where('createdAt', '>=', Timestamp.fromDate(today))
    );

    if (todayOrdersSnapshot.size >= runtimeGcashConfig.maxDailySubmissions) {
      throw new HttpsError(
        'resource-exhausted',
        `Daily limit reached. Maximum ${runtimeGcashConfig.maxDailySubmissions} top-up attempts per day.`
      );
    }

    // Create order
    const orderId = generateOrderId();
    const expiresAt = new Date(Date.now() + runtimeGcashConfig.orderExpiryMinutes * 60 * 1000);

    const orderData = {
      orderId,
      userId,
      type: 'topup',
      amount: parseFloat(amount),
      method: 'gcash',
      status: 'awaiting_upload',
      gcashAccountNumber: runtimeGcashConfig.accountNumber,
      gcashAccountName: runtimeGcashConfig.accountName,
      expectedReceiverName: runtimeGcashConfig.accountName,
      gcashQrUrl: runtimeGcashConfig.qrCodeUrl,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromDate(expiresAt),
      updatedAt: FieldValue.serverTimestamp(),
    };

    tx.set(db.collection('orders').doc(orderId), orderData);

    if (lockRef) {
      tx.set(lockRef, {
        userId,
        operation: 'createTopUpOrder',
        orderId,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    return { orderData, reused: false };
  });

    return {
      success: true,
      reused: result.reused,
      order: buildTopUpOrderResponse(result.orderData, runtimeGcashConfig),
    };
  }
);

/**
 * Get GCash Configuration
 */
exports.getGcashConfig = onCall(
  { region: 'asia-southeast1' },
  async (request) => {
    const context = request;
    checkAppToken(context);

    if (!context.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }
    const runtimeSettings = await loadPlatformSettings(admin.firestore());
    const runtimeGcashConfig = resolveRuntimeGcashConfig(runtimeSettings);
    assertGcashConfigured(runtimeGcashConfig);

    return {
      accountName: runtimeGcashConfig.accountName,
      accountNumber: maskPhoneNumber(runtimeGcashConfig.accountNumber),
      qrCodeUrl: runtimeGcashConfig.qrCodeUrl,
      maxDailyTopup: runtimeGcashConfig.maxDailyTopup,
      orderExpiryMinutes: runtimeGcashConfig.orderExpiryMinutes,
      paymentVerificationEnabled: runtimeSettings?.features?.paymentVerificationEnabled !== false,
    };
  }
);

// Wallet payout functionality removed - direct GCash payment only

/**
 * Get a single order by ID
 */
exports.getOrder = onCall(
  { region: 'asia-southeast1' },
  async (request) => {
    const data = request.data || {};
    const context = request;
    checkAppToken(context);

    if (!context.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    const { orderId } = data;
    if (!orderId) {
      throw new HttpsError('invalid-argument', 'orderId is required');
    }

  const db = admin.firestore();
  const orderDoc = await db.collection('orders').doc(orderId).get();

  if (!orderDoc.exists) {
    throw new HttpsError('not-found', 'Order not found');
  }

  const order = { id: orderDoc.id, ...orderDoc.data() };

  // Security: only the order owner can view it
  if (order.userId !== context.auth.uid) {
    throw new HttpsError('permission-denied', 'Access denied');
  }

  // Get latest payment submission for this order
  const submissionsSnap = await db.collection('paymentSubmissions')
    .where('orderId', '==', orderId)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  const latestSubmission = submissionsSnap.empty
    ? null
    : { id: submissionsSnap.docs[0].id, ...submissionsSnap.docs[0].data() };

    return { order, latestSubmission };
  }
);

/**
 * Get current user's pending orders
 */
exports.getPendingOrders = onCall(
  { region: 'asia-southeast1' },
  async (request) => {
    const context = request;
    checkAppToken(context);

    if (!context.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

  const db = admin.firestore();
  const ordersSnap = await db.collection('orders')
    .where('userId', '==', context.auth.uid)
    .where('status', 'in', ['awaiting_upload', 'pending', 'submitted', 'processing'])
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get();

    const orders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return { orders };
  }
);


