/**
 * Wallet Management Cloud Functions
 * Handles wallet operations: platform fee payment, top-up orders, GCash config
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');

const PLATFORM_FEE_RATE = 0.05; // 5%
const IDEMPOTENCY_COLLECTION = 'idempotency';
const ACTIVE_PLATFORM_FEE_ORDER_STATUSES = new Set(['awaiting_upload', 'pending', 'submitted', 'processing']);
const isProductionRuntime = process.env.NODE_ENV === 'production';

function checkAppToken(context) {
  if (process.env.APP_CHECK_ENFORCED !== 'true') return;
  if (context.app === undefined) {
    throw new functions.https.HttpsError('failed-precondition', 'App Check verification required');
  }
}

// GCash configuration
if (isProductionRuntime && !process.env.GCASH_ACCOUNT_NUMBER) {
  throw new Error('GCASH_ACCOUNT_NUMBER environment variable is required');
}
if (isProductionRuntime && !process.env.GCASH_ACCOUNT_NAME) {
  throw new Error('GCASH_ACCOUNT_NAME environment variable is required');
}

const GCASH_CONFIG = {
  accountNumber: process.env.GCASH_ACCOUNT_NUMBER || null,
  accountName: process.env.GCASH_ACCOUNT_NAME || null,
  qrCodeUrl: process.env.GCASH_QR_URL || null,
  maxDailyTopup: 50000,
  maxDailySubmissions: 5,
  orderExpiryMinutes: 30,
};

function assertGcashConfigured() {
  if (!GCASH_CONFIG.accountNumber || !GCASH_CONFIG.accountName) {
    throw new functions.https.HttpsError(
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
    throw new functions.https.HttpsError('invalid-argument', 'idempotencyKey must be a string');
  }

  const trimmed = rawKey.trim();
  if (!trimmed) {
    throw new functions.https.HttpsError('invalid-argument', 'idempotencyKey cannot be empty');
  }
  if (trimmed.length > 128) {
    throw new functions.https.HttpsError('invalid-argument', 'idempotencyKey must be at most 128 characters');
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

function buildPlatformOrderResponse(orderData) {
  const expiresAtDate = orderData.expiresAt?.toDate ? orderData.expiresAt.toDate() : null;
  return {
    orderId: orderData.orderId,
    bidId: orderData.bidId,
    amount: orderData.amount,
    gcashAccountNumber: maskPhoneNumber(orderData.gcashAccountNumber || GCASH_CONFIG.accountNumber),
    gcashAccountName: orderData.gcashAccountName || GCASH_CONFIG.accountName,
    gcashQrUrl: orderData.gcashQrUrl || GCASH_CONFIG.qrCodeUrl,
    expiresAt: expiresAtDate ? expiresAtDate.toISOString() : null,
    expiresInMinutes: GCASH_CONFIG.orderExpiryMinutes,
  };
}

function buildTopUpOrderResponse(orderData) {
  const expiresAtDate = orderData.expiresAt?.toDate ? orderData.expiresAt.toDate() : null;
  return {
    orderId: orderData.orderId,
    amount: parseFloat(orderData.amount),
    gcashAccountNumber: maskPhoneNumber(orderData.gcashAccountNumber || GCASH_CONFIG.accountNumber),
    gcashAccountName: orderData.gcashAccountName || GCASH_CONFIG.accountName,
    gcashQrUrl: orderData.gcashQrUrl || GCASH_CONFIG.qrCodeUrl,
    expiresAt: expiresAtDate ? expiresAtDate.toISOString() : null,
    expiresInMinutes: GCASH_CONFIG.orderExpiryMinutes,
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
exports.createPlatformFeeOrder = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  checkAppToken(context);

  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }
  assertGcashConfigured();

  const { bidId, idempotencyKey: rawIdempotencyKey } = data;
  const userId = context.auth.uid;
  const idempotencyKey = normalizeIdempotencyKey(rawIdempotencyKey);

  if (!bidId) {
    throw new functions.https.HttpsError('invalid-argument', 'Bid ID is required');
  }

  const db = admin.firestore();
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
              throw new functions.https.HttpsError('permission-denied', 'Idempotency key belongs to a different user');
            }
            return { orderData: existingLockedOrder, reused: true };
          }
        }
      }
    }

    // Validate bid exists
    const bidDoc = await tx.get(db.collection('bids').doc(bidId));
    if (!bidDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Bid not found');
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
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Platform fee can only be paid for accepted/contracted bids'
      );
    }

    // Fast path when contract already marked as paid
    if (contract?.platformFeePaid) {
      throw new functions.https.HttpsError(
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
      throw new functions.https.HttpsError('permission-denied', 'Only the trucker can pay the platform fee');
    }

    // Use contract fee when available to avoid pricing drift
    const platformFee = contract?.platformFee || Math.round(bid.price * PLATFORM_FEE_RATE);

    // Check if fee already paid
    const existingFeeSnap = await tx.get(
      db.collection('platformFees')
        .where('bidId', '==', bidId)
        .where('status', '==', 'completed')
        .limit(1)
    );

    if (!existingFeeSnap.empty) {
      throw new functions.https.HttpsError(
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
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      if (lockRef) {
        tx.set(lockRef, {
          userId,
          operation: 'createPlatformFeeOrder',
          orderId: reusableOrder.orderId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
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
    const expiresAt = new Date(Date.now() + GCASH_CONFIG.orderExpiryMinutes * 60 * 1000);

    const contractId = contract?.id || null;
    if (contractRef) {
      // Update contract with order reference
      tx.update(contractRef, {
        platformFeeOrderId: orderId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
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
      gcashAccountNumber: GCASH_CONFIG.accountNumber,
      gcashAccountName: GCASH_CONFIG.accountName,
      expectedReceiverName: GCASH_CONFIG.accountName,
      gcashQrUrl: GCASH_CONFIG.qrCodeUrl,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    tx.set(db.collection('orders').doc(orderId), orderData);

    if (lockRef) {
      tx.set(lockRef, {
        userId,
        operation: 'createPlatformFeeOrder',
        orderId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    return { orderData, reused: false };
  });

  return {
    success: true,
    reused: result.reused,
    order: buildPlatformOrderResponse(result.orderData),
  };
});

/**
 * Create Top-Up Order (GCash Screenshot Verification)
 */
exports.createTopUpOrder = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  checkAppToken(context);

  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }
  assertGcashConfigured();

  const { amount, idempotencyKey: rawIdempotencyKey } = data;
  const userId = context.auth.uid;
  const idempotencyKey = normalizeIdempotencyKey(rawIdempotencyKey);

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
              throw new functions.https.HttpsError('permission-denied', 'Idempotency key belongs to a different user');
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
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(today))
    );

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
      type: 'topup',
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

    tx.set(db.collection('orders').doc(orderId), orderData);

    if (lockRef) {
      tx.set(lockRef, {
        userId,
        operation: 'createTopUpOrder',
        orderId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    return { orderData, reused: false };
  });

  return {
    success: true,
    reused: result.reused,
    order: buildTopUpOrderResponse(result.orderData),
  };
});

/**
 * Get GCash Configuration
 */
exports.getGcashConfig = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  checkAppToken(context);

  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }
  assertGcashConfigured();

  return {
    accountName: GCASH_CONFIG.accountName,
    accountNumber: maskPhoneNumber(GCASH_CONFIG.accountNumber),
    qrCodeUrl: GCASH_CONFIG.qrCodeUrl,
    maxDailyTopup: GCASH_CONFIG.maxDailyTopup,
    orderExpiryMinutes: GCASH_CONFIG.orderExpiryMinutes,
  };
});

// Wallet payout functionality removed - direct GCash payment only

/**
 * Get a single order by ID
 */
exports.getOrder = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  checkAppToken(context);

  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { orderId } = data;
  if (!orderId) {
    throw new functions.https.HttpsError('invalid-argument', 'orderId is required');
  }

  const db = admin.firestore();
  const orderDoc = await db.collection('orders').doc(orderId).get();

  if (!orderDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Order not found');
  }

  const order = { id: orderDoc.id, ...orderDoc.data() };

  // Security: only the order owner can view it
  if (order.userId !== context.auth.uid) {
    throw new functions.https.HttpsError('permission-denied', 'Access denied');
  }

  // Get latest payment submission for this order
  const submissionsSnap = await db.collection('paymentSubmissions')
    .where('orderId', '==', orderId)
    .orderBy('submittedAt', 'desc')
    .limit(1)
    .get();

  const latestSubmission = submissionsSnap.empty
    ? null
    : { id: submissionsSnap.docs[0].id, ...submissionsSnap.docs[0].data() };

  return { order, latestSubmission };
});

/**
 * Get current user's pending orders
 */
exports.getPendingOrders = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  checkAppToken(context);

  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const db = admin.firestore();
  const ordersSnap = await db.collection('orders')
    .where('userId', '==', context.auth.uid)
    .where('status', 'in', ['pending', 'submitted'])
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get();

  const orders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  return { orders };
});
