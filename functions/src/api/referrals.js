/**
 * Broker Referral & Commission Cloud Functions
 * Authoritative implementation for broker registration, attribution,
 * commission accrual (based on platform fee), and admin payout approvals.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');
const {
  loadPlatformSettings,
  shouldBlockForMaintenance,
} = require('../config/platformSettings');

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

function toDate(value) {
  if (!value) return null;
  if (value.toDate && typeof value.toDate === 'function') return value.toDate();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toTimestampNumber(value) {
  const dateValue = toDate(value);
  return dateValue ? dateValue.getTime() : 0;
}

function resolveCommissionRate(tier, settings) {
  const normalizedTier = String(tier || 'STARTER').toUpperCase();
  const rates = settings?.referralCommission || {};
  const configuredRate =
    rates[normalizedTier] ??
    rates[normalizedTier.toLowerCase()] ??
    rates[(normalizedTier.charAt(0) + normalizedTier.slice(1).toLowerCase())];
  const parsedRate = Number(configuredRate);
  if (Number.isFinite(parsedRate) && parsedRate > 0) {
    return parsedRate;
  }
  return DEFAULT_REFERRAL_RATES[normalizedTier] || DEFAULT_REFERRAL_RATES.STARTER;
}

async function assertReferralProgramEnabled(db, context) {
  const settings = await loadPlatformSettings(db);
  if (shouldBlockForMaintenance(settings, context?.auth?.token)) {
    throw new functions.https.HttpsError('failed-precondition', 'Platform is currently under maintenance');
  }
  if (settings?.features?.referralProgramEnabled === false) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Referral program is currently disabled by admin'
    );
  }
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
      createdAt: FieldValue.serverTimestamp(),
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
  await assertReferralProgramEnabled(db, context);
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

  const now = FieldValue.serverTimestamp();
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
  await assertReferralProgramEnabled(db, context);
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
  const now = FieldValue.serverTimestamp();

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
      totalReferrals: FieldValue.increment(1),
      updatedAt: now,
    });

    tx.set(brokerProfileRef, {
      totalReferrals: FieldValue.increment(1),
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
    createdAt: FieldValue.serverTimestamp(),
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
    db.collection('brokerReferrals').where('brokerId', '==', userId).orderBy('createdAt', 'desc').limit(100).get(),
    db.collection('brokerCommissions').where('brokerId', '==', userId).orderBy('createdAt', 'desc').limit(100).get(),
    db.collection('brokerPayoutRequests').where('brokerId', '==', userId).orderBy('createdAt', 'desc').limit(100).get(),
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
  const settings = await loadPlatformSettings(db);
  if (shouldBlockForMaintenance(settings, context?.auth?.token)) {
    throw new functions.https.HttpsError('failed-precondition', 'Platform is currently under maintenance');
  }
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
  const now = FieldValue.serverTimestamp();

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
  const now = FieldValue.serverTimestamp();

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
    createdAt: FieldValue.serverTimestamp(),
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
  const status = String(data?.status || '').trim().toLowerCase();
  const allowedStatuses = new Set(['pending', 'approved', 'rejected', 'all', '']);
  if (!allowedStatuses.has(status)) {
    throw new functions.https.HttpsError('invalid-argument', 'status must be all, pending, approved, or rejected');
  }

  let query = db.collection('brokerPayoutRequests');
  if (status && status !== 'all') {
    query = query.where('status', '==', status);
  }
  query = query.orderBy('createdAt', 'desc').limit(limit);

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
  const now = FieldValue.serverTimestamp();

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
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  return { success: true };
});

/**
 * Admin: broker referral quality report.
 * Highlights contracts cancelled before platform-fee payment where fee payer was referred.
 */
exports.adminGetBrokerReferralReport = functions.region(REGION).https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const db = admin.firestore();
  const scanLimit = Math.min(Math.max(Number(data?.scanLimit || 1000), 100), 5000);
  const recentLimit = Math.min(Math.max(Number(data?.recentLimit || 30), 1), 100);

  const [cancelledContractsSnap, settingsDoc] = await Promise.all([
    db.collection('contracts').where('status', '==', 'cancelled').limit(scanLimit).get(),
    db.collection('settings').doc('platform').get(),
  ]);

  const settings = settingsDoc.exists ? settingsDoc.data() || {} : {};
  const cancelledContracts = cancelledContractsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const unpaidCancelledContracts = cancelledContracts.filter((contract) => (
    contract.platformFeePaid !== true &&
    !!contract.platformFeePayerId
  ));

  const feePayerIds = [...new Set(unpaidCancelledContracts.map((contract) => contract.platformFeePayerId).filter(Boolean))];
  const referralMap = new Map();
  if (feePayerIds.length > 0) {
    const referralDocs = await db.getAll(
      ...feePayerIds.map((uid) => db.collection('brokerReferrals').doc(uid))
    );
    referralDocs.forEach((doc) => {
      if (doc.exists) {
        referralMap.set(doc.id, doc.data() || {});
      }
    });
  }

  const referredCancelledContracts = unpaidCancelledContracts.filter((contract) =>
    referralMap.has(contract.platformFeePayerId)
  );

  const brokerIds = [...new Set(referredCancelledContracts.map((contract) =>
    referralMap.get(contract.platformFeePayerId)?.brokerId
  ).filter(Boolean))];

  const brokerMap = new Map();
  const brokerUserMap = new Map();
  if (brokerIds.length > 0) {
    const [brokerDocs, brokerUserDocs] = await Promise.all([
      db.getAll(...brokerIds.map((brokerId) => db.collection('brokers').doc(brokerId))),
      db.getAll(...brokerIds.map((brokerId) => db.collection('users').doc(brokerId))),
    ]);

    brokerDocs.forEach((doc) => {
      if (doc.exists) {
        brokerMap.set(doc.id, doc.data() || {});
      }
    });

    brokerUserDocs.forEach((doc) => {
      if (doc.exists) {
        brokerUserMap.set(doc.id, doc.data() || {});
      }
    });
  }

  let totalWaivedPlatformFees = 0;
  let totalEstimatedCommissionLost = 0;
  let cargoCount = 0;
  let truckCount = 0;

  const brokerBreakdownMap = new Map();
  const recentContracts = referredCancelledContracts.map((contract) => {
    const referral = referralMap.get(contract.platformFeePayerId) || {};
    const brokerId = referral.brokerId || null;
    const broker = brokerId ? (brokerMap.get(brokerId) || {}) : {};
    const brokerUser = brokerId ? (brokerUserMap.get(brokerId) || {}) : {};
    const platformFee = Number(contract.platformFee || 0);
    const brokerTier = String(broker.tier || 'STARTER').toUpperCase();
    const commissionRate = resolveCommissionRate(brokerTier, settings);
    const estimatedCommissionLost = roundToCents(platformFee * (commissionRate / 100));

    totalWaivedPlatformFees += platformFee;
    totalEstimatedCommissionLost += estimatedCommissionLost;

    const listingType = String(contract.listingType || '').toLowerCase();
    if (listingType === 'cargo') cargoCount += 1;
    else if (listingType === 'truck') truckCount += 1;

    if (brokerId) {
      const existing = brokerBreakdownMap.get(brokerId) || {
        brokerId,
        brokerName: brokerUser.name || null,
        brokerPhone: brokerUser.phone || null,
        brokerCode: broker.referralCode || null,
        tier: brokerTier,
        contractsCancelledUnpaid: 0,
        waivedPlatformFees: 0,
        estimatedCommissionLost: 0,
      };
      existing.contractsCancelledUnpaid += 1;
      existing.waivedPlatformFees = roundToCents(existing.waivedPlatformFees + platformFee);
      existing.estimatedCommissionLost = roundToCents(existing.estimatedCommissionLost + estimatedCommissionLost);
      brokerBreakdownMap.set(brokerId, existing);
    }

    return {
      contractId: contract.id,
      contractNumber: contract.contractNumber || null,
      listingType: listingType || 'unknown',
      platformFee,
      platformFeeStatus: contract.platformFeeStatus || 'waived',
      platformFeePayerId: contract.platformFeePayerId || null,
      brokerId,
      brokerName: brokerUser.name || null,
      brokerCode: referral.brokerCode || broker.referralCode || null,
      brokerTier,
      commissionRate,
      estimatedCommissionLost,
      cancelledAt: contract.cancelledAt || contract.updatedAt || contract.createdAt || null,
    };
  })
    .sort((a, b) => toTimestampNumber(b.cancelledAt) - toTimestampNumber(a.cancelledAt))
    .slice(0, recentLimit);

  const brokerBreakdown = [...brokerBreakdownMap.values()]
    .sort((a, b) => (
      b.contractsCancelledUnpaid - a.contractsCancelledUnpaid ||
      b.waivedPlatformFees - a.waivedPlatformFees
    ))
    .slice(0, 20);

  return {
    summary: {
      scannedCancelledContracts: cancelledContracts.length,
      unpaidCancelledContracts: unpaidCancelledContracts.length,
      referredCancelledUnpaidContracts: referredCancelledContracts.length,
      cargoCancelledUnpaidContracts: cargoCount,
      truckCancelledUnpaidContracts: truckCount,
      waivedPlatformFees: roundToCents(totalWaivedPlatformFees),
      estimatedCommissionLost: roundToCents(totalEstimatedCommissionLost),
      note: 'Cancelled contracts with unpaid platform fee are waived and do not generate broker commission.',
    },
    recentContracts,
    brokerBreakdown,
  };
});
