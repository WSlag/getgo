/**
 * Admin Management Cloud Functions
 * Handles admin dashboard, user management, and financial operations
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { verifyAdmin } = require('../utils/adminAuth');
const {
  loadPlatformSettings,
  savePlatformSettings,
  mergePlatformSettings,
  validatePlatformSettingsPatch,
} = require('../config/platformSettings');

function safeErrorMessage(error) {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  if (error.response) {
    return `HTTP ${error.response.status}: ${error.response.statusText || 'upstream error'}`;
  }
  return error.message || 'Unknown error';
}

function toComparableTimestamp(value, fallback = Number.POSITIVE_INFINITY) {
  if (!value) return fallback;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (value.seconds) return Number(value.seconds) * 1000;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? fallback : parsed;
}

function parseLimit(value, fallbackLimit) {
  const parsed = parseInt(value, 10);
  const base = Number.isFinite(parsed) ? parsed : fallbackLimit;
  return Math.min(Math.max(base, 1), 500);
}

function isPayableOutstandingContract(contract = {}) {
  if (contract.platformFeePaid === true) return false;
  if (Number(contract.platformFee || 0) <= 0) return false;
  if (contract.status === 'cancelled') return false;
  if (contract.platformFeeStatus === 'waived') return false;
  return true;
}

function normalizeStringArray(values) {
  if (!Array.isArray(values)) return [];
  return values.filter((value) => typeof value === 'string').sort();
}

function arraysEqual(a = [], b = []) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

async function reconcileUserOutstandingState(db, userId) {
  const userRef = db.collection('users').doc(userId);
  const [userDoc, unpaidContractsSnap] = await Promise.all([
    userRef.get(),
    db.collection('contracts')
      .where('platformFeePayerId', '==', userId)
      .where('platformFeePaid', '==', false)
      .get(),
  ]);

  if (!userDoc.exists) {
    return {
      userId,
      changed: false,
      skipped: 'user_not_found',
    };
  }

  const userData = userDoc.data() || {};
  const payableContracts = unpaidContractsSnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter(isPayableOutstandingContract);

  const outstandingTotal = payableContracts.reduce(
    (sum, contract) => sum + Number(contract.platformFee || 0),
    0
  );
  const outstandingContractIds = payableContracts.map((contract) => contract.id);

  const currentOutstanding = Number(userData.outstandingPlatformFees || 0);
  const existingContractIds = normalizeStringArray(userData.outstandingFeeContracts);
  const sortedOutstandingIds = normalizeStringArray(outstandingContractIds);

  const shouldUnsuspend = (
    userData.accountStatus === 'suspended' &&
    userData.suspensionReason === 'unpaid_platform_fees' &&
    outstandingTotal <= 0
  );

  const needsOutstandingUpdate = (
    currentOutstanding !== outstandingTotal ||
    !arraysEqual(existingContractIds, sortedOutstandingIds)
  );

  if (!needsOutstandingUpdate && !shouldUnsuspend) {
    return {
      userId,
      changed: false,
      outstandingTotal,
      outstandingContracts: outstandingContractIds.length,
      unsuspended: false,
    };
  }

  const updates = {
    outstandingPlatformFees: outstandingTotal,
    outstandingFeeContracts: outstandingContractIds,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (shouldUnsuspend) {
    updates.accountStatus = 'active';
    updates.suspensionReason = null;
    updates.suspendedAt = null;
    updates.unsuspendedAt = admin.firestore.FieldValue.serverTimestamp();
  }

  await userRef.update(updates);

  if (shouldUnsuspend) {
    await db.collection(`users/${userId}/notifications`).doc().set({
      type: 'ACCOUNT_UNSUSPENDED',
      title: 'Account Reactivated',
      message: 'Your account has been reactivated. No outstanding platform fees remain.',
      data: { source: 'admin_reconcile_outstanding_fees' },
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  return {
    userId,
    changed: true,
    outstandingTotal,
    outstandingContracts: outstandingContractIds.length,
    unsuspended: shouldUnsuspend,
  };
}

async function resolveCursor(db, collectionName, cursorId) {
  if (!cursorId || typeof cursorId !== 'string') return null;
  const cursorDoc = await db.collection(collectionName).doc(cursorId).get();
  return cursorDoc.exists ? cursorDoc : null;
}

/**
 * Get platform/system settings.
 */
exports.adminGetSystemSettings = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  await verifyAdmin(context);
  const db = admin.firestore();
  const settings = await loadPlatformSettings(db, { forceRefresh: true });
  return { settings };
});

/**
 * Update platform/system settings.
 */
exports.adminUpdateSystemSettings = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const patch = data?.settings;
  if (!patch || typeof patch !== 'object') {
    throw new functions.https.HttpsError('invalid-argument', 'settings object is required');
  }

  try {
    validatePlatformSettingsPatch(patch);
  } catch (error) {
    throw new functions.https.HttpsError('invalid-argument', error.message || 'Invalid settings payload');
  }

  const db = admin.firestore();
  const current = await loadPlatformSettings(db, { forceRefresh: true });
  const merged = mergePlatformSettings(current, patch);
  const saved = await savePlatformSettings(db, merged, context.auth.uid);

  await db.collection('adminLogs').add({
    action: 'UPDATE_SYSTEM_SETTINGS',
    targetId: 'settings/platform',
    performedBy: context.auth.uid,
    performedAt: admin.firestore.FieldValue.serverTimestamp(),
    changes: patch,
  });

  return { success: true, settings: saved };
});

/**
 * Get Dashboard Statistics
 */
exports.adminGetDashboardStats = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const db = admin.firestore();

  // Get counts
  const usersSnap = await db.collection('users').count().get();
  const cargoSnap = await db.collection('cargoListings').count().get();
  const trucksSnap = await db.collection('truckListings').count().get();
  const contractsSnap = await db.collection('contracts').count().get();
  const shipmentsSnap = await db.collection('shipments').where('status', '==', 'in_transit').count().get();

  // Get payment submissions count
  const pendingPaymentsSnap = await db.collection('paymentSubmissions')
    .where('status', '==', 'manual_review')
    .count()
    .get();

  // Get total wallet balance (sum across all users, capped for safety)
  let totalWalletBalance = 0;
  const walletsSnap = await db.collectionGroup('wallet').limit(10000).get();
  walletsSnap.docs.forEach(doc => {
    totalWalletBalance += doc.data().balance || 0;
  });

  // Get platform fees collected
  const platformFeesSnap = await db.collection('platformFees')
    .where('status', '==', 'completed')
    .get();

  let totalFees = 0;
  platformFeesSnap.docs.forEach(doc => {
    totalFees += doc.data().amount || 0;
  });

  return {
    users: {
      total: usersSnap.data().count,
    },
    listings: {
      cargo: cargoSnap.data().count,
      trucks: trucksSnap.data().count,
      total: cargoSnap.data().count + trucksSnap.data().count,
    },
    contracts: {
      total: contractsSnap.data().count,
    },
    shipments: {
      active: shipmentsSnap.data().count,
    },
    payments: {
      pendingReview: pendingPaymentsSnap.data().count,
    },
    financial: {
      totalWalletBalance,
      platformFeesCollected: totalFees,
    },
  };
});

/**
 * Get Pending Payments (for admin review)
 */
exports.adminGetPendingPayments = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const { status = 'manual_review', limit = 50, cursor: cursorId } = data || {};
  const db = admin.firestore();
  const safeLimit = parseLimit(limit, 50);

  let query = db.collection('paymentSubmissions');

  if (status) {
    query = query.where('status', '==', status);
  }

  query = query.orderBy('createdAt', 'desc');
  const cursorDoc = await resolveCursor(db, 'paymentSubmissions', cursorId);
  if (cursorDoc) {
    query = query.startAfter(cursorDoc);
  }
  query = query.limit(safeLimit);

  const snapshot = await query.get();
  const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;

  // Batch-fetch related order and user data to avoid N+1 queries
  const rawSubmissions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const orderIds = [...new Set(rawSubmissions.map(s => s.orderId).filter(Boolean))];
  const userIds = [...new Set(rawSubmissions.map(s => s.userId).filter(Boolean))];

  const orderMap = {};
  const userMap = {};

  try {
    if (orderIds.length) {
      const orderDocs = await db.getAll(...orderIds.map(id => db.collection('orders').doc(id)));
      orderDocs.forEach(d => { if (d.exists) orderMap[d.id] = d.data(); });
    }
  } catch (error) {
    console.error('Error batch-fetching orders: %s', safeErrorMessage(error));
  }

  try {
    if (userIds.length) {
      const userDocs = await db.getAll(...userIds.map(id => db.collection('users').doc(id)));
      userDocs.forEach(d => { if (d.exists) userMap[d.id] = d.data(); });
    }
  } catch (error) {
    console.error('Error batch-fetching users: %s', safeErrorMessage(error));
  }

  const submissions = rawSubmissions.map(submission => {
    if (submission.orderId && orderMap[submission.orderId]) {
      const orderData = orderMap[submission.orderId];
      submission.orderAmount = orderData.amount;
      submission.orderType = orderData.type;
      submission.bidId = orderData.bidId;
    }
    if (submission.userId && userMap[submission.userId]) {
      const userData = userMap[submission.userId];
      submission.userName = userData.displayName || userData.email || 'Unknown User';
      submission.userEmail = userData.email;
    }
    return submission;
  });

  return {
    submissions,
    total: submissions.length,
    nextCursor: submissions.length === safeLimit && lastDoc ? lastDoc.id : null,
  };
});

/**
 * Get All Users
 */
exports.adminGetUsers = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const { role, limit = 100, cursor: cursorId } = data || {};
  const db = admin.firestore();
  const safeLimit = parseLimit(limit, 100);

  let query = db.collection('users');

  if (role) {
    query = query.where('role', '==', role);
  }

  query = query.orderBy('createdAt', 'desc');
  const cursorDoc = await resolveCursor(db, 'users', cursorId);
  if (cursorDoc) {
    query = query.startAfter(cursorDoc);
  }
  query = query.limit(safeLimit);

  const snapshot = await query.get();
  const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
  const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  return {
    users,
    total: users.length,
    nextCursor: users.length === safeLimit && lastDoc ? lastDoc.id : null,
  };
});

/**
 * Suspend User
 */
exports.adminSuspendUser = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const { userId, reason } = data;

  if (!userId) {
    throw new functions.https.HttpsError('invalid-argument', 'User ID is required');
  }

  const db = admin.firestore();

  // Update user status
  await db.collection('users').doc(userId).update({
    isActive: false,
    suspendedAt: admin.firestore.FieldValue.serverTimestamp(),
    suspendedBy: context.auth.uid,
    suspensionReason: reason || 'No reason provided',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Disable Firebase Auth account
  try {
    await admin.auth().updateUser(userId, { disabled: true });
  } catch (error) {
    console.error('Error disabling auth account [userId=%s]: %s', userId, safeErrorMessage(error));
  }

  // Log admin action
  await db.collection('adminLogs').add({
    action: 'SUSPEND_USER',
    targetUserId: userId,
    performedBy: context.auth.uid,
    reason: reason || 'No reason provided',
    performedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { message: 'User suspended successfully' };
});

/**
 * Activate User
 */
exports.adminActivateUser = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const { userId } = data;

  if (!userId) {
    throw new functions.https.HttpsError('invalid-argument', 'User ID is required');
  }

  const db = admin.firestore();

  // Update user status
  await db.collection('users').doc(userId).update({
    isActive: true,
    suspendedAt: null,
    suspendedBy: null,
    suspensionReason: null,
    activatedAt: admin.firestore.FieldValue.serverTimestamp(),
    activatedBy: context.auth.uid,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Enable Firebase Auth account
  try {
    await admin.auth().updateUser(userId, { disabled: false });
  } catch (error) {
    console.error('Error enabling auth account [userId=%s]: %s', userId, safeErrorMessage(error));
  }

  // Log admin action
  await db.collection('adminLogs').add({
    action: 'ACTIVATE_USER',
    targetUserId: userId,
    performedBy: context.auth.uid,
    performedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { message: 'User activated successfully' };
});

/**
 * Verify User
 */
exports.adminVerifyUser = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const { userId } = data;

  if (!userId) {
    throw new functions.https.HttpsError('invalid-argument', 'User ID is required');
  }

  const db = admin.firestore();

  // Update user status
  await db.collection('users').doc(userId).update({
    isVerified: true,
    verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    verifiedBy: context.auth.uid,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Log admin action
  await db.collection('adminLogs').add({
    action: 'VERIFY_USER',
    targetUserId: userId,
    performedBy: context.auth.uid,
    performedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { message: 'User verified successfully' };
});

/**
 * Toggle Admin Role
 */
exports.adminToggleAdmin = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const { userId, grant } = data;

  if (!userId) {
    throw new functions.https.HttpsError('invalid-argument', 'User ID is required');
  }

  const db = admin.firestore();

  // Get current user state for audit logging
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'User not found');
  }
  const previousData = userDoc.data();

  if (grant) {
    // Grant admin
    await db.collection('users').doc(userId).update({
      isAdmin: true,
      role: 'admin',
      adminGrantedAt: admin.firestore.FieldValue.serverTimestamp(),
      adminGrantedBy: context.auth.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await admin.auth().setCustomUserClaims(userId, { admin: true });
  } else {
    // Revoke admin
    await db.collection('users').doc(userId).update({
      isAdmin: false,
      role: 'shipper', // Default role
      adminRevokedAt: admin.firestore.FieldValue.serverTimestamp(),
      adminRevokedBy: context.auth.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await admin.auth().setCustomUserClaims(userId, { admin: false });
  }

  // Enhanced audit logging with context
  await db.collection('adminLogs').add({
    action: grant ? 'GRANT_ADMIN' : 'REVOKE_ADMIN',
    targetUserId: userId,
    performedBy: context.auth.uid,
    performedAt: admin.firestore.FieldValue.serverTimestamp(),
    ipAddress: context.rawRequest?.ip || null,
    userAgent: context.rawRequest?.headers['user-agent'] || null,
    previousRole: previousData.role || null,
    previousIsAdmin: previousData.isAdmin || false,
    newRole: grant ? 'admin' : 'shipper',
    newIsAdmin: grant,
  });

  return { message: grant ? 'Admin privileges granted' : 'Admin privileges revoked' };
});

/**
 * Get Financial Summary
 */
exports.adminGetFinancialSummary = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const db = admin.firestore();

  // Get all wallet transactions
  const txSnap = await db.collectionGroup('walletTransactions')
    .orderBy('createdAt', 'desc')
    .limit(1000)
    .get();

  let totalTopups = 0;
  let totalPayouts = 0;
  let totalFees = 0;

  txSnap.docs.forEach(doc => {
    const tx = doc.data();
    const amount = Math.abs(tx.amount || 0);

    if (tx.type === 'topup') totalTopups += amount;
    else if (tx.type === 'payout') totalPayouts += amount;
    else if (tx.type === 'fee') totalFees += amount;
  });

  // Get GMV (Gross Merchandise Value) from contracts
  const contractsSnap = await db.collection('contracts')
    .where('status', 'in', ['signed', 'completed'])
    .limit(500)
    .get();

  let gmv = 0;
  contractsSnap.docs.forEach(doc => {
    gmv += doc.data().agreedPrice || 0;
  });

  return {
    totalTopups,
    totalPayouts,
    totalFees,
    gmv,
    netRevenue: totalFees,
  };
});

/**
 * Resolve Dispute
 */
exports.adminResolveDispute = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const { disputeId, resolution } = data;

  if (!disputeId || !resolution) {
    throw new functions.https.HttpsError('invalid-argument', 'Dispute ID and resolution are required');
  }

  const db = admin.firestore();

  // Update dispute
  await db.collection('disputes').doc(disputeId).update({
    status: 'resolved',
    resolution,
    resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
    resolvedBy: context.auth.uid,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Log admin action
  await db.collection('adminLogs').add({
    action: 'RESOLVE_DISPUTE',
    targetId: disputeId,
    performedBy: context.auth.uid,
    resolution,
    performedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { message: 'Dispute resolved successfully' };
});

/**
 * Get All Contracts (Admin)
 */
exports.adminGetContracts = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const { status, limit = 100, cursor: cursorId } = data || {};
  const db = admin.firestore();
  const safeLimit = parseLimit(limit, 100);

  let query = db.collection('contracts');

  if (status) {
    query = query.where('status', '==', status);
  }

  query = query.orderBy('createdAt', 'desc');
  const cursorDoc = await resolveCursor(db, 'contracts', cursorId);
  if (cursorDoc) {
    query = query.startAfter(cursorDoc);
  }
  query = query.limit(safeLimit);

  const snapshot = await query.get();
  const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
  const contracts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  return {
    contracts,
    total: contracts.length,
    nextCursor: contracts.length === safeLimit && lastDoc ? lastDoc.id : null,
  };
});

/**
 * Deactivate a listing (admin moderation)
 */
exports.adminDeactivateListing = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const { listingId, listingType, reason } = data || {};
  if (!listingId || !listingType) {
    throw new functions.https.HttpsError('invalid-argument', 'listingId and listingType are required');
  }

  const normalizedType = String(listingType).toLowerCase();
  const collectionName = normalizedType === 'cargo'
    ? 'cargoListings'
    : normalizedType === 'truck'
      ? 'truckListings'
      : null;

  if (!collectionName) {
    throw new functions.https.HttpsError('invalid-argument', 'listingType must be cargo or truck');
  }

  const db = admin.firestore();
  const listingRef = db.collection(collectionName).doc(String(listingId));
  const listingDoc = await listingRef.get();
  if (!listingDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Listing not found');
  }

  await listingRef.update({
    status: 'deactivated',
    deactivatedAt: admin.firestore.FieldValue.serverTimestamp(),
    deactivatedBy: context.auth.uid,
    deactivationReason: reason || 'Deactivated by admin',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await db.collection('adminLogs').add({
    action: 'DEACTIVATE_LISTING',
    targetId: String(listingId),
    targetType: collectionName,
    performedBy: context.auth.uid,
    reason: reason || 'Deactivated by admin',
    performedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true, message: 'Listing deactivated successfully' };
});

/**
 * Delete a rating (admin moderation)
 */
exports.adminDeleteRating = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const { ratingId } = data || {};
  if (!ratingId) {
    throw new functions.https.HttpsError('invalid-argument', 'ratingId is required');
  }

  const db = admin.firestore();
  const ratingRef = db.collection('ratings').doc(String(ratingId));
  const ratingDoc = await ratingRef.get();
  if (!ratingDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Rating not found');
  }

  const ratingData = ratingDoc.data() || {};
  await ratingRef.delete();

  await db.collection('adminLogs').add({
    action: 'DELETE_RATING',
    targetId: String(ratingId),
    performedBy: context.auth.uid,
    relatedContractId: ratingData.contractId || null,
    raterId: ratingData.raterId || null,
    ratedUserId: ratingData.ratedUserId || null,
    performedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true, message: 'Rating deleted successfully' };
});

/**
 * Get Outstanding Platform Fees Report
 * Returns all contracts with unpaid platform fees, enriched with trucker data
 */
exports.adminGetOutstandingFees = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const { limit = 100, cursor: cursorId } = data || {};
  const db = admin.firestore();
  const safeLimit = parseLimit(limit, 100);
  const cursorDoc = await resolveCursor(db, 'contracts', cursorId);
  let query = db.collection('contracts')
    .where('platformFeePaid', '==', false)
    .orderBy(admin.firestore.FieldPath.documentId(), 'asc');

  if (cursorDoc) {
    query = query.startAfter(cursorDoc.id);
  }
  query = query.limit(safeLimit);

  const unpaidContracts = await query.get();
  const lastDoc = unpaidContracts.docs[unpaidContracts.docs.length - 1] || null;

  // Batch-fetch trucker data to avoid N+1 queries
  const rawContracts = unpaidContracts.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(isPayableOutstandingContract)
    .sort((a, b) => {
      const dueDelta = toComparableTimestamp(a.platformFeeDueDate) - toComparableTimestamp(b.platformFeeDueDate);
      if (dueDelta !== 0) return dueDelta;
      return toComparableTimestamp(b.createdAt, 0) - toComparableTimestamp(a.createdAt, 0);
    });
  const payerIds = [...new Set(rawContracts.map(c => c.platformFeePayerId).filter(Boolean))];

  const truckerMap = {};
  try {
    if (payerIds.length) {
      const truckerDocs = await db.getAll(...payerIds.map(id => db.collection('users').doc(id)));
      truckerDocs.forEach(d => { if (d.exists) truckerMap[d.id] = d.data(); });
    }
  } catch (error) {
    console.error('Error batch-fetching truckers: %s', safeErrorMessage(error));
  }

  const contracts = rawContracts.map(contract => {
    if (contract.platformFeePayerId && truckerMap[contract.platformFeePayerId]) {
      const truckerData = truckerMap[contract.platformFeePayerId];
      contract.truckerName = truckerData.displayName || truckerData.name || 'Unknown';
      contract.truckerEmail = truckerData.email;
      contract.truckerPhone = truckerData.phone;
      contract.truckerAccountStatus = truckerData.accountStatus || 'active';
      contract.truckerOutstandingTotal = truckerData.outstandingPlatformFees || 0;
    }

    // Calculate days overdue
    if (contract.platformFeeDueDate) {
      const dueDate = contract.platformFeeDueDate.toDate();
      const now = new Date();
      const daysOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
      contract.daysOverdue = daysOverdue;
      contract.isOverdue = daysOverdue > 0;
    } else if (contract.platformFeeStatus === 'overdue') {
      contract.daysOverdue = null;
      contract.isOverdue = true;
    }

    return contract;
  });

  // Calculate totals
  const totalOutstanding = contracts.reduce((sum, c) => sum + (c.platformFee || 0), 0);
  const overdueCount = contracts.filter(c => c.platformFeeStatus === 'overdue').length;
  const suspendedCount = contracts.filter(c => c.truckerAccountStatus === 'suspended').length;

  // Get suspended users summary
  const suspendedUsers = await db.collection('users')
    .where('accountStatus', '==', 'suspended')
    .where('suspensionReason', '==', 'unpaid_platform_fees')
    .get();

  const suspendedUsersList = suspendedUsers.docs.map(doc => {
    const user = { id: doc.id, ...doc.data() };
    return {
      userId: user.id,
      name: user.displayName || user.name || 'Unknown',
      email: user.email,
      phone: user.phone,
      outstandingFees: user.outstandingPlatformFees || 0,
      suspendedAt: user.suspendedAt,
      contractIds: user.outstandingFeeContracts || [],
    };
  }).filter((user) => user.outstandingFees > 0 || user.contractIds.length > 0);

  return {
    contracts,
    total: contracts.length,
    nextCursor: contracts.length === safeLimit && lastDoc ? lastDoc.id : null,
    summary: {
      totalContracts: contracts.length,
      totalOutstanding,
      overdueCount,
      suspendedCount,
      suspendedUsers: suspendedUsersList.length,
    },
    suspendedUsers: suspendedUsersList,
  };
});

/**
 * Reconcile outstanding platform-fee balances and unpaid-fee suspension state.
 * - If userId is provided: reconciles that user only.
 * - Otherwise: reconciles up to `limit` candidate users from unpaid contracts + suspended unpaid-fee users.
 */
exports.adminReconcileOutstandingFees = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const { userId, limit = 200 } = data || {};
  const db = admin.firestore();

  if (userId) {
    const result = await reconcileUserOutstandingState(db, String(userId));
    return {
      mode: 'single',
      results: [result],
      totalUsersScanned: 1,
      totalUsersChanged: result.changed ? 1 : 0,
    };
  }

  const safeLimit = parseLimit(limit, 200);
  const [suspendedUsersSnap, unpaidContractsSnap] = await Promise.all([
    db.collection('users')
      .where('suspensionReason', '==', 'unpaid_platform_fees')
      .limit(safeLimit)
      .get(),
    db.collection('contracts')
      .where('platformFeePaid', '==', false)
      .limit(safeLimit * 5)
      .get(),
  ]);

  const candidateUserIds = new Set();
  suspendedUsersSnap.docs.forEach((doc) => candidateUserIds.add(doc.id));
  unpaidContractsSnap.docs.forEach((doc) => {
    const contract = doc.data() || {};
    if (contract.platformFeePayerId) {
      candidateUserIds.add(contract.platformFeePayerId);
    }
  });

  const userIds = Array.from(candidateUserIds).slice(0, safeLimit);
  const results = [];
  for (const candidateUserId of userIds) {
    // Sequential updates keep Firestore write pressure predictable in callable context.
    // eslint-disable-next-line no-await-in-loop
    const result = await reconcileUserOutstandingState(db, candidateUserId);
    results.push(result);
  }

  return {
    mode: 'batch',
    totalUsersScanned: results.length,
    totalUsersChanged: results.filter((item) => item.changed).length,
    results,
  };
});

/**
 * Weekly Marketplace KPI Trends (Growth + Collections)
 */
exports.adminGetMarketplaceKpis = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const db = admin.firestore();
  const weeks = Math.min(Math.max(Number(data?.weeks || 8), 1), 26);

  const startOfWeek = (input) => {
    const d = new Date(input);
    d.setHours(0, 0, 0, 0);
    const day = (d.getDay() + 6) % 7; // Monday = 0
    d.setDate(d.getDate() - day);
    return d;
  };

  const toDate = (value) => {
    if (!value) return null;
    if (value.toDate && typeof value.toDate === 'function') return value.toDate();
    if (value.seconds) return new Date(value.seconds * 1000);
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const now = new Date();
  const currentWeekStart = startOfWeek(now);
  const firstWeekStart = new Date(currentWeekStart);
  firstWeekStart.setDate(firstWeekStart.getDate() - ((weeks - 1) * 7));

  const bucketByKey = new Map();
  for (let i = 0; i < weeks; i++) {
    const weekStart = new Date(firstWeekStart);
    weekStart.setDate(firstWeekStart.getDate() + (i * 7));
    const key = weekStart.toISOString().slice(0, 10);
    bucketByKey.set(key, {
      weekStart: key,
      contractsCreated: 0,
      contractsCompleted: 0,
      feesBilled: 0,
      feesCollected: 0,
      overdueContracts: 0,
      disputesOpened: 0,
      unpaidSuspensions: 0,
    });
  }

  const getBucket = (date) => {
    if (!date) return null;
    const key = startOfWeek(date).toISOString().slice(0, 10);
    return bucketByKey.get(key) || null;
  };

  const [contractsSnap, feesSnap, disputesSnap, suspendedUsersSnap] = await Promise.all([
    db.collection('contracts')
      .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(firstWeekStart))
      .get(),
    db.collection('platformFees')
      .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(firstWeekStart))
      .get(),
    db.collection('disputes')
      .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(firstWeekStart))
      .get(),
    db.collection('users')
      .where('suspendedAt', '>=', admin.firestore.Timestamp.fromDate(firstWeekStart))
      .get(),
  ]);

  const completedByTrucker = new Map();

  contractsSnap.docs.forEach((doc) => {
    const contract = doc.data();

    const createdBucket = getBucket(toDate(contract.createdAt));
    if (createdBucket) {
      createdBucket.contractsCreated += 1;
      createdBucket.feesBilled += Number(contract.platformFee || 0);
    }

    if (contract.status === 'completed') {
      const completedBucket = getBucket(toDate(contract.completedAt) || toDate(contract.updatedAt));
      if (completedBucket) completedBucket.contractsCompleted += 1;

      const truckerId = contract.listingType === 'cargo' ? contract.bidderId : contract.listingOwnerId;
      if (truckerId) {
        completedByTrucker.set(truckerId, (completedByTrucker.get(truckerId) || 0) + 1);
      }
    }

    if (contract.platformFeeStatus === 'overdue') {
      const overdueBucket = getBucket(toDate(contract.overdueAt) || toDate(contract.updatedAt));
      if (overdueBucket) overdueBucket.overdueContracts += 1;
    }
  });

  feesSnap.docs.forEach((doc) => {
    const fee = doc.data();
    if (fee.status !== 'completed') return;
    const feeBucket = getBucket(toDate(fee.createdAt));
    if (feeBucket) feeBucket.feesCollected += Number(fee.amount || 0);
  });

  disputesSnap.docs.forEach((doc) => {
    const dispute = doc.data();
    const disputeBucket = getBucket(toDate(dispute.createdAt));
    if (disputeBucket) disputeBucket.disputesOpened += 1;
  });

  suspendedUsersSnap.docs.forEach((doc) => {
    const user = doc.data();
    if (user.suspensionReason !== 'unpaid_platform_fees') return;
    const suspensionBucket = getBucket(toDate(user.suspendedAt));
    if (suspensionBucket) suspensionBucket.unpaidSuspensions += 1;
  });

  const weekly = Array.from(bucketByKey.values());
  const totals = weekly.reduce((acc, row) => {
    acc.contractsCreated += row.contractsCreated;
    acc.contractsCompleted += row.contractsCompleted;
    acc.feesBilled += row.feesBilled;
    acc.feesCollected += row.feesCollected;
    acc.overdueContracts += row.overdueContracts;
    acc.disputesOpened += row.disputesOpened;
    acc.unpaidSuspensions += row.unpaidSuspensions;
    return acc;
  }, {
    contractsCreated: 0,
    contractsCompleted: 0,
    feesBilled: 0,
    feesCollected: 0,
    overdueContracts: 0,
    disputesOpened: 0,
    unpaidSuspensions: 0,
  });

  const activeTruckers = Array.from(completedByTrucker.values()).filter((count) => count >= 1).length;
  const repeatTruckers = Array.from(completedByTrucker.values()).filter((count) => count >= 2).length;

  const summary = {
    ...totals,
    feeRecoveryRate: totals.feesBilled > 0 ? Number(((totals.feesCollected / totals.feesBilled) * 100).toFixed(1)) : 0,
    disputeRate: totals.contractsCompleted > 0 ? Number(((totals.disputesOpened / totals.contractsCompleted) * 100).toFixed(1)) : 0,
    suspensionRate: totals.contractsCreated > 0 ? Number(((totals.unpaidSuspensions / totals.contractsCreated) * 100).toFixed(1)) : 0,
    repeatTruckerRate: activeTruckers > 0 ? Number(((repeatTruckers / activeTruckers) * 100).toFixed(1)) : 0,
  };

  return {
    weeks,
    from: firstWeekStart.toISOString(),
    to: now.toISOString(),
    weekly,
    summary,
  };
});
