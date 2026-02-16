/**
 * Broker Referral & Commission Cloud Functions
 * Authoritative implementation for broker registration, attribution,
 * commission accrual (based on platform fee), and admin payout approvals.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

const REGION = 'asia-southeast1';
const MIN_PAYOUT_AMOUNT = 500;
const DEFAULT_REFERRAL_RATES = {
  STARTER: 3,
  SILVER: 4,
  GOLD: 5,
  PLATINUM: 6,
};
const ALLOWED_TIERS = Object.keys(DEFAULT_REFERRAL_RATES);

function normalizeReferralCode(input) {
  return String(input || '').trim().toUpperCase();
}

function buildBrokerCodePrefix(role) {
  if (role === 'shipper') return 'SHP';
  if (role === 'trucker') return 'TRK';
  return 'BRK';
}

function roundToCents(value) {
  const n = Number(value || 0);
  return Math.round(n * 100) / 100;
}

async function verifyAdmin(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  if (context.auth.token?.admin === true) {
    return true;
  }

  const db = admin.firestore();
  const userDoc = await db.collection('users').doc(context.auth.uid).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required');
  }

  const user = userDoc.data() || {};
  if (user.isAdmin === true || user.role === 'admin') {
    return true;
  }

  throw new functions.https.HttpsError('permission-denied', 'Admin access required');
}

async function generateUniqueReferralCode(db, role) {
  const prefix = buildBrokerCodePrefix(role);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const random = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const code = `${prefix}${random}`;
    const existing = await db.collection('brokers').where('referralCode', '==', code).limit(1).get();
    if (existing.empty) return code;
  }

  throw new functions.https.HttpsError('resource-exhausted', 'Failed to generate unique referral code');
}

async function notifyAllAdmins(db, payload) {
  const [adminsByRole, adminsByFlag] = await Promise.all([
    db.collection('users').where('role', '==', 'admin').limit(50).get(),
    db.collection('users').where('isAdmin', '==', true).limit(50).get(),
  ]);

  const adminIds = new Set();
  const batch = db.batch();

  [...adminsByRole.docs, ...adminsByFlag.docs].forEach((doc) => {
    if (adminIds.has(doc.id)) return;
    adminIds.add(doc.id);
    const notifRef = db.collection('users').doc(doc.id).collection('notifications').doc();
    batch.set(notifRef, {
      ...payload,
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  if (adminIds.size > 0) {
    await batch.commit();
  }
}

/**
 * Register current user as broker (server-authoritative).
 */
exports.brokerRegister = functions.region(REGION).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const db = admin.firestore();
  const userId = context.auth.uid;
  const userRef = db.collection('users').doc(userId);
  const brokerRef = db.collection('brokers').doc(userId);
  const brokerProfileRef = userRef.collection('brokerProfile').doc('profile');

  const [userDoc, brokerDoc, brokerProfileDoc] = await Promise.all([
    userRef.get(),
    brokerRef.get(),
    brokerProfileRef.get(),
  ]);

  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'User profile not found');
  }
  if (brokerDoc.exists || brokerProfileDoc.exists) {
    throw new functions.https.HttpsError('already-exists', 'Already registered as broker');
  }

  const user = userDoc.data() || {};
  const requestedCode = normalizeReferralCode(data?.referralCode);
  let referralCode = requestedCode;

  if (referralCode) {
    if (!/^[A-Z0-9]{6,12}$/.test(referralCode)) {
      throw new functions.https.HttpsError('invalid-argument', 'Referral code format is invalid');
    }
    const existingCode = await db.collection('brokers').where('referralCode', '==', referralCode).limit(1).get();
    if (!existingCode.empty) {
      throw new functions.https.HttpsError('already-exists', 'Referral code already in use');
    }
  } else {
    referralCode = await generateUniqueReferralCode(db, user.role);
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  const profile = {
    userId,
    sourceRole: user.role || null,
    referralCode,
    tier: 'STARTER',
    status: 'active',
    totalEarnings: 0,
    pendingEarnings: 0,
    availableBalance: 0,
    totalReferrals: 0,
    totalTransactions: 0,
    createdAt: now,
    updatedAt: now,
  };

  await db.runTransaction(async (tx) => {
    tx.set(brokerRef, profile);
    tx.set(brokerProfileRef, profile);
    tx.update(userRef, {
      isBroker: true,
      brokerSourceRole: user.role || null,
      brokerRegisteredAt: now,
      updatedAt: now,
    });
  });

  return {
    success: true,
    broker: {
      userId,
      referralCode,
      tier: 'STARTER',
      status: 'active',
    },
  };
});

/**
 * Apply a referral code to the current authenticated user.
 * One-time attribution only.
 */
exports.brokerApplyReferralCode = functions.region(REGION).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const referralCode = normalizeReferralCode(data?.referralCode);
  if (!referralCode) {
    throw new functions.https.HttpsError('invalid-argument', 'Referral code is required');
  }

  const db = admin.firestore();
  const referredUserId = context.auth.uid;
  const referralRef = db.collection('brokerReferrals').doc(referredUserId);
  const referredUserRef = db.collection('users').doc(referredUserId);

  const brokerQuery = await db.collection('brokers').where('referralCode', '==', referralCode).limit(1).get();
  if (brokerQuery.empty) {
    throw new functions.https.HttpsError('not-found', 'Referral code not found');
  }

  const brokerDoc = brokerQuery.docs[0];
  const brokerId = brokerDoc.id;
  const broker = brokerDoc.data() || {};
  if (broker.status && broker.status !== 'active') {
    throw new functions.https.HttpsError('failed-precondition', 'Broker referral code is not active');
  }
  if (brokerId === referredUserId) {
    throw new functions.https.HttpsError('failed-precondition', 'Self-referral is not allowed');
  }

  const brokerRef = db.collection('brokers').doc(brokerId);
  const brokerProfileRef = db.collection('users').doc(brokerId).collection('brokerProfile').doc('profile');
  const now = admin.firestore.FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    const [existingReferral, referredUserDoc] = await Promise.all([
      tx.get(referralRef),
      tx.get(referredUserRef),
    ]);

    if (existingReferral.exists) {
      throw new functions.https.HttpsError('already-exists', 'Referral attribution already exists for this user');
    }
    if (!referredUserDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Referred user profile not found');
    }

    const referredUser = referredUserDoc.data() || {};
    if (referredUser.referredByBrokerId) {
      throw new functions.https.HttpsError('already-exists', 'Referral code already applied');
    }

    tx.set(referralRef, {
      brokerId,
      brokerCode: referralCode,
      referredUserId,
      referredRole: referredUser.role || null,
      status: 'attributed',
      totalQualifiedFees: 0,
      totalCommission: 0,
      totalTransactions: 0,
      createdAt: now,
      updatedAt: now,
    });

    tx.update(referredUserRef, {
      referredByBrokerId: brokerId,
      referredByCode: referralCode,
      referredAt: now,
      updatedAt: now,
    });

    tx.update(brokerRef, {
      totalReferrals: admin.firestore.FieldValue.increment(1),
      updatedAt: now,
    });

    tx.set(brokerProfileRef, {
      totalReferrals: admin.firestore.FieldValue.increment(1),
      updatedAt: now,
    }, { merge: true });
  });

  const referredUserDoc = await referredUserRef.get();
  const referredUser = referredUserDoc.exists ? referredUserDoc.data() || {} : {};
  const referredName = referredUser.name || referredUser.phone || 'A new user';

  await db.collection('users').doc(brokerId).collection('notifications').add({
    type: 'BROKER_NEW_REFERRAL',
    title: 'New Referral Attributed',
    message: `${referredName} joined using your referral code.`,
    data: {
      referredUserId,
      brokerId,
      referralCode,
    },
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true, brokerId, referralCode };
});

/**
 * Get broker dashboard data (profile + ledger + payouts).
 */
exports.brokerGetDashboard = functions.region(REGION).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const userId = context.auth.uid;
  const db = admin.firestore();

  const brokerDoc = await db.collection('brokers').doc(userId).get();
  if (!brokerDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Broker profile not found');
  }

  const [referralsSnap, commissionsSnap, payoutsSnap] = await Promise.all([
    db.collection('brokerReferrals').where('brokerId', '==', userId).limit(100).get(),
    db.collection('brokerCommissions').where('brokerId', '==', userId).limit(100).get(),
    db.collection('brokerPayoutRequests').where('brokerId', '==', userId).limit(100).get(),
  ]);

  const referrals = referralsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const byCreatedDesc = (a, b) => {
    const aSeconds = a.createdAt?.seconds || 0;
    const bSeconds = b.createdAt?.seconds || 0;
    return bSeconds - aSeconds;
  };
  const commissions = commissionsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort(byCreatedDesc).slice(0, 50);
  const payouts = payoutsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort(byCreatedDesc).slice(0, 50);

  return {
    broker: { id: brokerDoc.id, ...brokerDoc.data() },
    referrals,
    commissions,
    payouts,
  };
});

/**
 * Broker payout request (admin-approved workflow).
 */
exports.brokerRequestPayout = functions.region(REGION).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const db = admin.firestore();
  const brokerId = context.auth.uid;
  const amount = roundToCents(data?.amount);
  const method = String(data?.method || 'gcash').toLowerCase();
  const payoutDetails = data?.payoutDetails || {};

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Valid payout amount is required');
  }
  if (amount < MIN_PAYOUT_AMOUNT) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      `Minimum payout amount is PHP ${MIN_PAYOUT_AMOUNT.toLocaleString()}`
    );
  }

  const brokerRef = db.collection('brokers').doc(brokerId);
  const brokerProfileRef = db.collection('users').doc(brokerId).collection('brokerProfile').doc('profile');
  const payoutRef = db.collection('brokerPayoutRequests').doc();
  const now = admin.firestore.FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    const brokerDoc = await tx.get(brokerRef);
    if (!brokerDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Broker profile not found');
    }

    const broker = brokerDoc.data() || {};
    if (broker.status && broker.status !== 'active') {
      throw new functions.https.HttpsError('failed-precondition', 'Broker account is not active');
    }

    const availableBalance = Number(broker.availableBalance || 0);
    if (availableBalance < amount) {
      throw new functions.https.HttpsError('failed-precondition', 'Insufficient available balance');
    }

    tx.set(payoutRef, {
      brokerId,
      amount,
      method,
      payoutDetails,
      status: 'pending',
      requestedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    tx.update(brokerRef, {
      availableBalance: roundToCents(availableBalance - amount),
      pendingEarnings: roundToCents(Number(broker.pendingEarnings || 0) + amount),
      updatedAt: now,
    });

    tx.set(brokerProfileRef, {
      availableBalance: roundToCents(availableBalance - amount),
      pendingEarnings: roundToCents(Number(broker.pendingEarnings || 0) + amount),
      updatedAt: now,
    }, { merge: true });
  });

  await notifyAllAdmins(db, {
    type: 'BROKER_PAYOUT_REVIEW',
    title: 'Broker Payout Request',
    message: `A broker requested payout of PHP ${amount.toLocaleString()}.`,
    data: {
      requestId: payoutRef.id,
      brokerId,
      amount,
      method,
      actionRequired: 'REVIEW_BROKER_PAYOUT',
    },
  });

  return { success: true, requestId: payoutRef.id };
});

/**
 * Admin: list brokers.
 */
exports.adminGetBrokers = functions.region(REGION).https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const db = admin.firestore();
  const limit = Math.min(Math.max(Number(data?.limit || 100), 1), 500);
  const tier = data?.tier && data.tier !== 'all' ? String(data.tier).toUpperCase() : null;

  let query = db.collection('brokers').limit(limit);
  if (tier) {
    query = db.collection('brokers').where('tier', '==', tier).limit(limit);
  }

  const snap = await query.get();
  const brokers = await Promise.all(snap.docs.map(async (doc) => {
    const broker = { id: doc.id, ...doc.data() };
    let user = null;
    try {
      const userDoc = await db.collection('users').doc(doc.id).get();
      if (userDoc.exists) {
        const userData = userDoc.data() || {};
        user = {
          name: userData.name || null,
          phone: userData.phone || null,
          email: userData.email || null,
        };
      }
    } catch (error) {
      // Ignore enrichment errors per user.
    }
    return { ...broker, user };
  }));

  brokers.sort((a, b) => {
    const aSeconds = a.createdAt?.seconds || 0;
    const bSeconds = b.createdAt?.seconds || 0;
    return bSeconds - aSeconds;
  });

  return {
    brokers,
    total: brokers.length,
  };
});

/**
 * Admin: update broker tier.
 */
exports.adminUpdateBrokerTier = functions.region(REGION).https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const brokerId = String(data?.brokerId || '').trim();
  const tier = String(data?.tier || '').trim().toUpperCase();

  if (!brokerId || !tier) {
    throw new functions.https.HttpsError('invalid-argument', 'brokerId and tier are required');
  }
  if (!ALLOWED_TIERS.includes(tier)) {
    throw new functions.https.HttpsError('invalid-argument', `Tier must be one of: ${ALLOWED_TIERS.join(', ')}`);
  }

  const db = admin.firestore();
  const brokerRef = db.collection('brokers').doc(brokerId);
  const brokerProfileRef = db.collection('users').doc(brokerId).collection('brokerProfile').doc('profile');
  const now = admin.firestore.FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    const brokerDoc = await tx.get(brokerRef);
    if (!brokerDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Broker not found');
    }

    tx.update(brokerRef, {
      tier,
      updatedAt: now,
      tierUpdatedAt: now,
      tierUpdatedBy: context.auth.uid,
    });

    tx.set(brokerProfileRef, {
      tier,
      updatedAt: now,
      tierUpdatedAt: now,
      tierUpdatedBy: context.auth.uid,
    }, { merge: true });
  });

  await db.collection('users').doc(brokerId).collection('notifications').add({
    type: 'BROKER_STATUS',
    title: 'Broker Tier Updated',
    message: `Your broker tier has been updated to ${tier}.`,
    data: { tier, updatedBy: context.auth.uid },
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true };
});

/**
 * Admin: list payout requests.
 */
exports.adminGetBrokerPayoutRequests = functions.region(REGION).https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const db = admin.firestore();
  const limit = Math.min(Math.max(Number(data?.limit || 100), 1), 500);
  const status = String(data?.status || '').trim();

  let query = db.collection('brokerPayoutRequests');
  if (status && status !== 'all') {
    query = query.where('status', '==', status);
  }
  query = query.limit(limit);

  const snap = await query.get();
  const requests = await Promise.all(snap.docs.map(async (doc) => {
    const request = { id: doc.id, ...doc.data() };
    let broker = null;
    try {
      const userDoc = await db.collection('users').doc(request.brokerId).get();
      if (userDoc.exists) {
        const user = userDoc.data() || {};
        broker = {
          name: user.name || null,
          phone: user.phone || null,
          email: user.email || null,
        };
      }
    } catch (error) {
      // Ignore enrichment errors per row.
    }
    return { ...request, broker };
  }));

  requests.sort((a, b) => {
    const aSeconds = a.createdAt?.seconds || 0;
    const bSeconds = b.createdAt?.seconds || 0;
    return bSeconds - aSeconds;
  });

  return { requests, total: requests.length };
});

/**
 * Admin: approve/reject payout request.
 */
exports.adminReviewBrokerPayout = functions.region(REGION).https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const requestId = String(data?.requestId || '').trim();
  const decision = String(data?.decision || '').trim().toLowerCase();
  const notes = data?.notes ? String(data.notes).trim() : null;
  const payoutReference = data?.payoutReference ? String(data.payoutReference).trim() : null;

  if (!requestId || !decision) {
    throw new functions.https.HttpsError('invalid-argument', 'requestId and decision are required');
  }
  if (!['approve', 'reject'].includes(decision)) {
    throw new functions.https.HttpsError('invalid-argument', 'decision must be approve or reject');
  }

  const db = admin.firestore();
  const requestRef = db.collection('brokerPayoutRequests').doc(requestId);
  const now = admin.firestore.FieldValue.serverTimestamp();

  let brokerId = null;

  await db.runTransaction(async (tx) => {
    const requestDoc = await tx.get(requestRef);
    if (!requestDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Payout request not found');
    }

    const request = requestDoc.data() || {};
    if (request.status !== 'pending') {
      throw new functions.https.HttpsError('failed-precondition', 'Payout request is no longer pending');
    }

    brokerId = request.brokerId;
    const amount = Number(request.amount || 0);

    const brokerRef = db.collection('brokers').doc(brokerId);
    const brokerProfileRef = db.collection('users').doc(brokerId).collection('brokerProfile').doc('profile');
    const brokerDoc = await tx.get(brokerRef);
    if (!brokerDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Broker profile not found');
    }
    const broker = brokerDoc.data() || {};
    const pendingEarnings = Number(broker.pendingEarnings || 0);
    const availableBalance = Number(broker.availableBalance || 0);

    const isApproval = decision === 'approve';
    const nextPending = roundToCents(Math.max(0, pendingEarnings - amount));
    const nextAvailable = isApproval
      ? availableBalance
      : roundToCents(availableBalance + amount);
    const nextStatus = isApproval ? 'approved' : 'rejected';

    tx.update(requestRef, {
      status: nextStatus,
      reviewedAt: now,
      reviewedBy: context.auth.uid,
      reviewNotes: notes || null,
      payoutReference: isApproval ? payoutReference || null : null,
      updatedAt: now,
    });

    tx.update(brokerRef, {
      pendingEarnings: nextPending,
      availableBalance: nextAvailable,
      updatedAt: now,
    });

    tx.set(brokerProfileRef, {
      pendingEarnings: nextPending,
      availableBalance: nextAvailable,
      updatedAt: now,
    }, { merge: true });

    tx.set(db.collection('adminLogs').doc(), {
      action: isApproval ? 'BROKER_PAYOUT_APPROVED' : 'BROKER_PAYOUT_REJECTED',
      targetId: requestId,
      targetUserId: brokerId,
      amount,
      performedBy: context.auth.uid,
      notes: notes || null,
      createdAt: now,
    });
  });

  if (brokerId) {
    await db.collection('users').doc(brokerId).collection('notifications').add({
      type: 'BROKER_PAYOUT_STATUS',
      title: decision === 'approve' ? 'Payout Approved' : 'Payout Rejected',
      message: decision === 'approve'
        ? 'Your payout request has been approved by admin.'
        : 'Your payout request was rejected. The amount has been returned to your available balance.',
      data: { requestId, decision, notes: notes || null },
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  return { success: true };
});
