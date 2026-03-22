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
const TRUCKER_CANCELLATION_THRESHOLD = 5;
const TRUCKER_CANCELLATION_WINDOW_DAYS = 30;
const TRUCKER_CANCELLATION_BLOCK_DAYS = 7;
const ADMIN_GRANTS_ENABLED = String(process.env.ALLOW_ADMIN_GRANTS || '').trim().toLowerCase() === 'true';
const BROADCAST_TITLE_MAX_LENGTH = 120;
const BROADCAST_MESSAGE_MAX_LENGTH = 2000;
const BROADCAST_JOB_COLLECTION = 'adminBroadcastJobs';

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

function buildAdminListResponse({ items, total, nextCursor, legacyKey, extra = {} }) {
  const safeItems = Array.isArray(items) ? items : [];
  const payload = {
    items: safeItems,
    total: Number.isFinite(total) ? total : safeItems.length,
    nextCursor: nextCursor || null,
    meta: {
      asOf: new Date().toISOString(),
    },
    ...extra,
  };
  if (legacyKey) {
    payload[legacyKey] = safeItems;
  }
  return payload;
}

function encodeCursor(payload = {}) {
  try {
    return Buffer.from(JSON.stringify(payload)).toString('base64url');
  } catch (error) {
    return null;
  }
}

function decodeCursor(cursorValue) {
  if (!cursorValue || typeof cursorValue !== 'string') return null;
  try {
    return JSON.parse(Buffer.from(cursorValue, 'base64url').toString('utf8'));
  } catch (error) {
    return null;
  }
}

function toDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
  if (typeof value._seconds === 'number') return new Date(value._seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function serializeForApi(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value?.toDate === 'function') {
    const date = value.toDate();
    return Number.isNaN(date?.getTime?.()) ? null : date.toISOString();
  }
  if (typeof value?._seconds === 'number') {
    return new Date(value._seconds * 1000).toISOString();
  }
  if (typeof value?.seconds === 'number') {
    return new Date(value.seconds * 1000).toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((entry) => serializeForApi(entry));
  }
  if (typeof value === 'object') {
    const output = {};
    Object.entries(value).forEach(([key, entry]) => {
      output[key] = serializeForApi(entry);
    });
    return output;
  }
  return value;
}

function startOfRollingWindow(referenceDate, days) {
  const result = new Date(referenceDate);
  result.setDate(result.getDate() - days);
  return result;
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

function isActiveAdminUser(userData = {}) {
  const isAdmin = userData.isAdmin === true || userData.role === 'admin';
  const isActive = userData.isActive !== false;
  const accountStatus = String(userData.accountStatus || 'active').trim().toLowerCase();
  return isAdmin && isActive && accountStatus !== 'suspended';
}

async function getActiveAdminCount(db) {
  const [adminsByRole, adminsByFlag] = await Promise.all([
    db.collection('users').where('role', '==', 'admin').get(),
    db.collection('users').where('isAdmin', '==', true).get(),
  ]);
  const adminMap = new Map();
  adminsByRole.docs.forEach((docSnap) => {
    adminMap.set(docSnap.id, { ...(adminMap.get(docSnap.id) || {}), ...(docSnap.data() || {}) });
  });
  adminsByFlag.docs.forEach((docSnap) => {
    adminMap.set(docSnap.id, { ...(adminMap.get(docSnap.id) || {}), ...(docSnap.data() || {}) });
  });
  return [...adminMap.values()].filter((userData) => isActiveAdminUser(userData)).length;
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

function normalizeTrimmedText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validateBoundedText(value, label, maxLength) {
  const normalized = normalizeTrimmedText(value);
  if (!normalized) {
    throw new functions.https.HttpsError('invalid-argument', `${label} is required`);
  }
  if (normalized.length > maxLength) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `${label} must be ${maxLength} characters or less`
    );
  }
  return normalized;
}

function serializeBroadcastJob(docSnap) {
  if (!docSnap || !docSnap.exists) return null;
  const data = docSnap.data() || {};
  return serializeForApi({
    id: docSnap.id,
    ...data,
  });
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
 * Queue a broadcast message for all active users.
 */
exports.adminQueueBroadcastMessage = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const title = validateBoundedText(data?.title, 'title', BROADCAST_TITLE_MAX_LENGTH);
  const message = validateBoundedText(data?.message, 'message', BROADCAST_MESSAGE_MAX_LENGTH);
  const db = admin.firestore();
  const settings = await loadPlatformSettings(db, { forceRefresh: true });
  if (settings?.communications?.broadcastEnabled === false) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Broadcast messaging is currently disabled in system settings'
    );
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  const jobRef = db.collection(BROADCAST_JOB_COLLECTION).doc();

  await jobRef.set({
    type: 'broadcast',
    status: 'queued',
    title,
    message,
    audience: 'all_active_users',
    createdBy: context.auth.uid,
    createdAt: now,
    queuedAt: now,
    updatedAt: now,
    totalUsers: 0,
    processedUsers: 0,
    deliveredUsers: 0,
    skippedUsers: 0,
    failedUsers: 0,
    progress: {
      totalUsers: 0,
      processedUsers: 0,
      deliveredUsers: 0,
      skippedUsers: 0,
      failedUsers: 0,
    },
    error: null,
  });

  await db.collection('adminLogs').add({
    action: 'QUEUE_BROADCAST_MESSAGE',
    targetId: jobRef.id,
    performedBy: context.auth.uid,
    performedAt: now,
    changes: {
      title,
      messageLength: message.length,
    },
  });

  return {
    success: true,
    jobId: jobRef.id,
    status: 'queued',
  };
});

/**
 * Get broadcast job processing status.
 */
exports.adminGetBroadcastJobStatus = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const jobId = normalizeTrimmedText(data?.jobId);
  if (!jobId) {
    throw new functions.https.HttpsError('invalid-argument', 'jobId is required');
  }

  const db = admin.firestore();
  const jobDoc = await db.collection(BROADCAST_JOB_COLLECTION).doc(jobId).get();
  if (!jobDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Broadcast job not found');
  }

  return { job: serializeBroadcastJob(jobDoc) };
});

/**
 * Get Dashboard Statistics
 */
exports.adminGetDashboardStats = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const db = admin.firestore();
  const asOf = new Date().toISOString();

  // Get counts
  const [
    usersSnap,
    cargoSnap,
    trucksSnap,
    contractsSnap,
    shipmentsSnap,
    pendingPaymentsSnap,
    openDisputesSnap,
    pendingBrokerPayoutsSnap,
    openSupportTicketsSnap,
  ] = await Promise.all([
    db.collection('users').count().get(),
    db.collection('cargoListings').count().get(),
    db.collection('truckListings').count().get(),
    db.collection('contracts').count().get(),
    db.collection('shipments')
      .where('status', 'in', ['pending_pickup', 'picked_up', 'in_transit'])
      .count()
      .get(),
    db.collection('paymentSubmissions')
      .where('status', '==', 'manual_review')
      .count()
      .get(),
    db.collection('disputes')
      .where('status', 'in', ['open', 'investigating'])
      .count()
      .get(),
    db.collection('brokerPayoutRequests')
      .where('status', '==', 'pending')
      .count()
      .get(),
    db.collection('supportConversations')
      .where('status', 'in', ['open', 'pending'])
      .count()
      .get(),
  ]);

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
    badges: {
      pendingPayments: pendingPaymentsSnap.data().count,
      openDisputes: openDisputesSnap.data().count,
      pendingBrokerPayouts: pendingBrokerPayoutsSnap.data().count,
      openSupportTickets: openSupportTicketsSnap.data().count,
    },
    financial: {
      totalWalletBalance,
      platformFeesCollected: totalFees,
    },
    meta: { asOf },
  };
});

/**
 * Server-authoritative dashboard overview payload for admin UI.
 */
exports.adminGetDashboardOverview = functions.region('asia-southeast1').runWith({ timeoutSeconds: 300, memory: '512MB' }).https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const db = admin.firestore();
  const asOf = new Date().toISOString();

  const getStartOfManilaDay = () => {
    const now = new Date();
    const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
    const manilaMs = utcMs + (8 * 60 * 60 * 1000);
    const manilaDate = new Date(manilaMs);
    manilaDate.setHours(0, 0, 0, 0);
    const startUtcMs = manilaDate.getTime() - (8 * 60 * 60 * 1000);
    return admin.firestore.Timestamp.fromDate(new Date(startUtcMs));
  };

  const parseAmount = (raw) => {
    if (raw === null || raw === undefined) return 0;
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
    if (typeof raw === 'string') {
      const normalized = raw.replace(/[^0-9.-]/g, '');
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };

  const startOfDay = getStartOfManilaDay();
  const [
    usersSnap,
    shippersSnap,
    truckersSnap,
    cargoSnap,
    openCargoSnap,
    trucksSnap,
    availableTrucksSnap,
    contractsSnap,
    activeContractsSnap,
    pendingPaymentsSnap,
    approvedTodaySnapshot,
    rejectedTodaySnapshot,
    openDisputesSnap,
    pendingBrokerPayoutsSnap,
    openSupportTicketsSnap,
  ] = await Promise.all([
    db.collection('users').count().get(),
    db.collection('users').where('role', '==', 'shipper').count().get(),
    db.collection('users').where('role', '==', 'trucker').count().get(),
    db.collection('cargoListings').count().get(),
    db.collection('cargoListings').where('status', '==', 'open').count().get(),
    db.collection('truckListings').count().get(),
    db.collection('truckListings').where('status', 'in', ['open', 'available']).count().get(),
    db.collection('contracts').count().get(),
    db.collection('contracts').where('status', 'in', ['signed', 'in_transit']).count().get(),
    db.collection('paymentSubmissions').where('status', '==', 'manual_review').count().get(),
    db.collection('paymentSubmissions')
      .where('status', '==', 'approved')
      .where('resolvedAt', '>=', startOfDay)
      .get(),
    db.collection('paymentSubmissions')
      .where('status', '==', 'rejected')
      .where('resolvedAt', '>=', startOfDay)
      .get(),
    db.collection('disputes').where('status', 'in', ['open', 'investigating']).count().get(),
    db.collection('brokerPayoutRequests').where('status', '==', 'pending').count().get(),
    db.collection('supportConversations').where('status', 'in', ['open', 'pending']).count().get(),
  ]);

  let totalAmountToday = 0;
  const fallbackOrderIds = [];
  approvedTodaySnapshot.docs.forEach((docSnap) => {
    const submission = docSnap.data() || {};
    const candidateAmount =
      parseAmount(submission.orderAmount) ||
      parseAmount(submission.amount) ||
      parseAmount(submission.extractedData?.amount);
    if (candidateAmount > 0) {
      totalAmountToday += candidateAmount;
    } else if (submission.orderId) {
      fallbackOrderIds.push(submission.orderId);
    }
  });

  if (fallbackOrderIds.length > 0) {
    try {
      const uniqueOrderIds = [...new Set(fallbackOrderIds)];
      const orderDocs = await db.getAll(...uniqueOrderIds.map((orderId) => db.collection('orders').doc(orderId)));
      orderDocs.forEach((orderDoc) => {
        if (!orderDoc.exists) return;
        const order = orderDoc.data() || {};
        totalAmountToday += parseAmount(order.amount);
      });
    } catch (error) {
      console.error('adminGetDashboardOverview: order amount fallback failed: %s', safeErrorMessage(error));
    }
  }

  const [recentPayments, recentContracts, recentUsers] = await Promise.all([
    db.collection('paymentSubmissions').orderBy('createdAt', 'desc').limit(2).get(),
    db.collection('contracts').orderBy('createdAt', 'desc').limit(2).get(),
    db.collection('users').orderBy('createdAt', 'desc').limit(2).get(),
  ]);

  const recentActivity = [];
  recentPayments.forEach((docSnap) => {
    const item = docSnap.data() || {};
    const createdAt = toDateValue(item.createdAt);
    recentActivity.push({
      id: docSnap.id,
      type: 'payment',
      status: item.status || 'pending',
      message: `Payment submission (${item.status || 'pending'})`,
      createdAt: createdAt ? createdAt.toISOString() : null,
      ts: createdAt ? createdAt.getTime() : 0,
    });
  });
  recentContracts.forEach((docSnap) => {
    const item = docSnap.data() || {};
    const createdAt = toDateValue(item.createdAt);
    recentActivity.push({
      id: docSnap.id,
      type: 'contract',
      status: item.status || 'created',
      message: `Contract ${item.status || 'created'}`,
      createdAt: createdAt ? createdAt.toISOString() : null,
      ts: createdAt ? createdAt.getTime() : 0,
    });
  });
  recentUsers.forEach((docSnap) => {
    const item = docSnap.data() || {};
    const createdAt = toDateValue(item.createdAt);
    recentActivity.push({
      id: docSnap.id,
      type: 'user',
      status: item.role || 'user',
      message: `New ${item.role || 'user'} registered`,
      createdAt: createdAt ? createdAt.toISOString() : null,
      ts: createdAt ? createdAt.getTime() : 0,
    });
  });

  recentActivity.sort((a, b) => (b.ts || 0) - (a.ts || 0));

  return {
    stats: {
      totalUsers: usersSnap.data().count,
      shippers: shippersSnap.data().count,
      truckers: truckersSnap.data().count,
      totalListings: cargoSnap.data().count + trucksSnap.data().count,
      openCargo: openCargoSnap.data().count,
      availableTrucks: availableTrucksSnap.data().count,
      totalContracts: contractsSnap.data().count,
      activeContracts: activeContractsSnap.data().count,
      pendingPayments: pendingPaymentsSnap.data().count,
      approvedToday: approvedTodaySnapshot.size,
      rejectedToday: rejectedTodaySnapshot.size,
      totalAmountToday,
    },
    badges: {
      pendingPayments: pendingPaymentsSnap.data().count,
      openDisputes: openDisputesSnap.data().count,
      pendingBrokerPayouts: pendingBrokerPayoutsSnap.data().count,
      openSupportTickets: openSupportTicketsSnap.data().count,
    },
    recentActivity: recentActivity.slice(0, 8).map(({ ts: _ts, ...item }) => item),
    meta: { asOf },
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
  const rawSubmissions = snapshot.docs.map(doc => serializeForApi({ id: doc.id, ...doc.data() }));
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

  return buildAdminListResponse({
    items: submissions,
    total: submissions.length,
    nextCursor: submissions.length === safeLimit && lastDoc ? lastDoc.id : null,
    legacyKey: 'submissions',
  });
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
  const users = snapshot.docs.map(doc => serializeForApi({ id: doc.id, ...doc.data() }));

  return buildAdminListResponse({
    items: users,
    total: users.length,
    nextCursor: users.length === safeLimit && lastDoc ? lastDoc.id : null,
    legacyKey: 'users',
  });
});

/**
 * Suspend User
 * - Syncs both isActive and accountStatus
 * - Harvests trucker identifiers (license number, plate numbers, doc hashes)
 *   and writes them to suspendedIdentifiers for cross-account detection
 */
exports.adminSuspendUser = functions.region('asia-southeast1').runWith({ timeoutSeconds: 120 }).https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const { userId, reason } = data;

  if (!userId) {
    throw new functions.https.HttpsError('invalid-argument', 'User ID is required');
  }

  const db = admin.firestore();
  const suspendedAt = admin.firestore.FieldValue.serverTimestamp();
  const suspensionReason = reason || 'No reason provided';

  // Update user status — sync both suspension fields
  await db.collection('users').doc(userId).update({
    isActive: false,
    accountStatus: 'suspended',
    suspendedAt,
    suspendedBy: context.auth.uid,
    suspensionReason,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Disable Firebase Auth account
  try {
    await admin.auth().updateUser(userId, { disabled: true });
  } catch (error) {
    console.error('Error disabling auth account [userId=%s]: %s', userId, safeErrorMessage(error));
  }

  // Harvest trucker identifiers for cross-account detection
  try {
    const [truckerProfileSnap, listingsSnap, contractsSnap] = await Promise.all([
      db.collection('users').doc(userId).collection('truckerProfile').doc('profile').get(),
      db.collection('truckListings').where('userId', '==', userId).get(),
      db.collection('contracts').where('truckerId', '==', userId).get(),
    ]);

    const nowTs = admin.firestore.FieldValue.serverTimestamp();
    const batch = db.batch();
    const addedValues = new Set();

    const addIdentifier = (type, value, docType = null) => {
      if (!value || typeof value !== 'string') return;
      const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
      if (!normalized || addedValues.has(`${type}:${normalized}`)) return;
      addedValues.add(`${type}:${normalized}`);
      const ref = db.collection('suspendedIdentifiers').doc();
      batch.set(ref, {
        type,
        value: normalized,
        docType: docType || null,
        originalUserId: userId,
        suspendedAt: nowTs,
        addedBy: context.auth.uid,
        notes: null,
      });
    };

    // Extract from truckerProfile
    if (truckerProfileSnap.exists) {
      const profile = truckerProfileSnap.data() || {};
      addIdentifier('licenseNumber', profile.licenseNumber, 'driver_license');
      addIdentifier('plateNumber', profile.plateNumber, 'lto_registration');
      addIdentifier('docImageHash', profile.driverLicenseHash, 'driver_license');
      addIdentifier('docImageHash', profile.ltoRegistrationHash, 'lto_registration');

      // Update documentHashRegistry entries to mark accountStatus as suspended
      const hashesToUpdate = [profile.driverLicenseHash, profile.ltoRegistrationHash].filter(Boolean);
      if (hashesToUpdate.length > 0) {
        const registrySnap = await db.collection('documentHashRegistry')
          .where('userId', '==', userId)
          .get();
        registrySnap.forEach(doc => {
          batch.update(doc.ref, { accountStatus: 'suspended' });
        });
      }
    }

    // Extract plate numbers from all truck listings
    listingsSnap.forEach(doc => {
      const plate = (doc.data() || {}).plateNumber;
      addIdentifier('plateNumber', plate);
    });

    // Extract plate numbers from contracts
    contractsSnap.forEach(doc => {
      const plate = (doc.data() || {}).vehiclePlateNumber;
      addIdentifier('plateNumber', plate);
    });

    if (addedValues.size > 0) {
      await batch.commit();
    }
  } catch (harvestError) {
    // Non-fatal: suspension already applied; log and continue
    console.error('adminSuspendUser: identifier harvest failed [userId=%s]: %s', userId, safeErrorMessage(harvestError));
  }

  // Log admin action
  await db.collection('adminLogs').add({
    action: 'SUSPEND_USER',
    targetUserId: userId,
    performedBy: context.auth.uid,
    reason: suspensionReason,
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

  // Update user status — sync both suspension fields
  await db.collection('users').doc(userId).update({
    isActive: true,
    accountStatus: 'active',
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
 * Clear admin review flag on a trucker account.
 * Call this after an admin manually reviews the flagged document match.
 */
exports.adminClearTruckerReview = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const userId = typeof data?.userId === 'string' ? data.userId.trim() : '';
  const notes = typeof data?.notes === 'string' ? data.notes.trim() : '';

  if (!userId) {
    throw new functions.https.HttpsError('invalid-argument', 'User ID is required');
  }

  const db = admin.firestore();
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'User not found');
  }

  const now = admin.firestore.FieldValue.serverTimestamp();

  await userRef.update({
    requiresAdminReview: false,
    reviewClearedAt: now,
    reviewClearedBy: context.auth.uid,
    reviewClearedNotes: notes || null,
    updatedAt: now,
  });

  await db.collection('adminLogs').add({
    action: 'CLEAR_TRUCKER_REVIEW',
    targetUserId: userId,
    performedBy: context.auth.uid,
    notes: notes || null,
    performedAt: now,
  });

  return { message: 'Review flag cleared' };
});

/**
 * Get paginated list of trucker accounts flagged for admin review.
 * Returns user doc + truckerProfile for each flagged account.
 */
exports.adminGetReviewQueue = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const db = admin.firestore();
  const pageSize = Math.min(typeof data?.pageSize === 'number' ? data.pageSize : 20, 50);
  const startAfterUid = typeof data?.startAfterUid === 'string' ? data.startAfterUid.trim() : null;

  let query = db.collection('users')
    .where('requiresAdminReview', '==', true)
    .orderBy('reviewFlaggedAt', 'desc')
    .limit(pageSize);

  if (startAfterUid) {
    const cursorDoc = await db.collection('users').doc(startAfterUid).get();
    if (cursorDoc.exists) {
      query = query.startAfter(cursorDoc);
    }
  }

  const snap = await query.get();

  const results = await Promise.all(
    snap.docs.map(async (userDoc) => {
      const uid = userDoc.id;
      const userData = userDoc.data() || {};

      const profileSnap = await db.collection('users').doc(uid)
        .collection('truckerProfile').doc('profile').get();
      const profile = profileSnap.exists ? profileSnap.data() : null;

      return {
        uid,
        displayName: userData.displayName || null,
        email: userData.email || null,
        phone: userData.phone || null,
        accountStatus: userData.accountStatus || null,
        requiresAdminReview: userData.requiresAdminReview || false,
        reviewReason: userData.reviewReason || null,
        reviewFlaggedAt: userData.reviewFlaggedAt || null,
        reviewClearedAt: userData.reviewClearedAt || null,
        truckerProfile: profile ? {
          licenseNumber: profile.licenseNumber || null,
          licenseExpiry: profile.licenseExpiry || null,
          plateNumber: profile.plateNumber || null,
          driverLicenseHash: profile.driverLicenseHash || null,
          ltoRegistrationHash: profile.ltoRegistrationHash || null,
          driverLicenseCopy: profile.driverLicenseCopy || null,
          ltoRegistrationCopy: profile.ltoRegistrationCopy || null,
          ocrLicenseConfidence: profile.ocrLicenseConfidence || null,
          ocrPlateConfidence: profile.ocrPlateConfidence || null,
        } : null,
      };
    })
  );

  return {
    items: results,
    hasMore: snap.docs.length === pageSize,
    lastUid: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1].id : null,
  };
});

/**
 * Manually add a license number, plate number, or doc image hash
 * to the suspendedIdentifiers blocklist.
 */
exports.adminAddSuspendedIdentifier = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const VALID_TYPES = ['licenseNumber', 'plateNumber', 'docImageHash'];
  const type = typeof data?.type === 'string' ? data.type.trim() : '';
  const rawValue = typeof data?.value === 'string' ? data.value.trim() : '';
  const docType = typeof data?.docType === 'string' ? data.docType.trim() : null;
  const originalUserId = typeof data?.originalUserId === 'string' ? data.originalUserId.trim() : null;
  const notes = typeof data?.notes === 'string' ? data.notes.trim() : null;

  if (!VALID_TYPES.includes(type)) {
    throw new functions.https.HttpsError('invalid-argument', `type must be one of: ${VALID_TYPES.join(', ')}`);
  }
  if (!rawValue) {
    throw new functions.https.HttpsError('invalid-argument', 'value is required');
  }

  // Normalize value consistently with the harvest logic
  const value = rawValue.toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
  if (!value) {
    throw new functions.https.HttpsError('invalid-argument', 'value normalized to empty string');
  }

  const db = admin.firestore();

  // Avoid duplicates
  const existing = await db.collection('suspendedIdentifiers')
    .where('type', '==', type)
    .where('value', '==', value)
    .limit(1)
    .get();

  if (!existing.empty) {
    return { message: 'Identifier already exists in blocklist', alreadyExisted: true };
  }

  await db.collection('suspendedIdentifiers').add({
    type,
    value,
    docType: docType || null,
    originalUserId: originalUserId || null,
    suspendedAt: admin.firestore.FieldValue.serverTimestamp(),
    addedBy: context.auth.uid,
    notes: notes || null,
  });

  await db.collection('adminLogs').add({
    action: 'ADD_SUSPENDED_IDENTIFIER',
    type,
    value,
    originalUserId: originalUserId || null,
    performedBy: context.auth.uid,
    performedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { message: 'Identifier added to blocklist', alreadyExisted: false };
});

/**
 * One-time backfill: harvest identifiers from all existing suspended accounts
 * and write them to suspendedIdentifiers. Safe to re-run (deduplicates by value).
 */
exports.adminBackfillSuspendedIdentifiers = functions.region('asia-southeast1').runWith({ timeoutSeconds: 540 }).https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const db = admin.firestore();

  // Query all suspended users (either field may be set depending on when they were suspended)
  const [byIsActive, byAccountStatus] = await Promise.all([
    db.collection('users').where('isActive', '==', false).get(),
    db.collection('users').where('accountStatus', '==', 'suspended').get(),
  ]);

  // Deduplicate user IDs across both queries
  const uidSet = new Set();
  byIsActive.forEach(doc => uidSet.add(doc.id));
  byAccountStatus.forEach(doc => uidSet.add(doc.id));

  const userIds = Array.from(uidSet);

  let totalAdded = 0;
  let totalSkipped = 0;
  let errors = 0;

  // Load existing blocklist values to avoid duplicates
  const existingSnap = await db.collection('suspendedIdentifiers').get();
  const existingKeys = new Set();
  existingSnap.forEach(doc => {
    const d = doc.data() || {};
    if (d.type && d.value) existingKeys.add(`${d.type}:${d.value}`);
  });

  const nowTs = admin.firestore.FieldValue.serverTimestamp();

  for (const userId of userIds) {
    try {
      const [profileSnap, listingsSnap, contractsSnap] = await Promise.all([
        db.collection('users').doc(userId).collection('truckerProfile').doc('profile').get(),
        db.collection('truckListings').where('userId', '==', userId).get(),
        db.collection('contracts').where('truckerId', '==', userId).get(),
      ]);

      const batch = db.batch();
      let batchHasWrites = false;

      const addIdentifier = (type, value, docType) => {
        if (!value || typeof value !== 'string') return;
        const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
        if (!normalized) return;
        const key = `${type}:${normalized}`;
        if (existingKeys.has(key)) { totalSkipped++; return; }
        existingKeys.add(key);
        const ref = db.collection('suspendedIdentifiers').doc();
        batch.set(ref, {
          type,
          value: normalized,
          docType: docType || null,
          originalUserId: userId,
          suspendedAt: nowTs,
          addedBy: 'backfill',
          notes: 'backfilled by adminBackfillSuspendedIdentifiers',
        });
        batchHasWrites = true;
        totalAdded++;
      };

      if (profileSnap.exists) {
        const p = profileSnap.data() || {};
        addIdentifier('licenseNumber', p.licenseNumber, 'driver_license');
        addIdentifier('plateNumber', p.plateNumber, 'lto_registration');
        addIdentifier('docImageHash', p.driverLicenseHash, 'driver_license');
        addIdentifier('docImageHash', p.ltoRegistrationHash, 'lto_registration');
      }

      listingsSnap.forEach(doc => {
        addIdentifier('plateNumber', (doc.data() || {}).plateNumber, null);
      });

      contractsSnap.forEach(doc => {
        addIdentifier('plateNumber', (doc.data() || {}).vehiclePlateNumber, null);
      });

      if (batchHasWrites) await batch.commit();
    } catch (err) {
      errors++;
      console.error('adminBackfillSuspendedIdentifiers: error for userId=%s: %s', userId, safeErrorMessage(err));
    }
  }

  await db.collection('adminLogs').add({
    action: 'BACKFILL_SUSPENDED_IDENTIFIERS',
    performedBy: context.auth.uid,
    suspendedUsersFound: userIds.length,
    identifiersAdded: totalAdded,
    identifiersSkipped: totalSkipped,
    errors,
    performedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    message: 'Backfill complete',
    suspendedUsersFound: userIds.length,
    identifiersAdded: totalAdded,
    identifiersSkipped: totalSkipped,
    errors,
  };
});

/**
 * Clear trucker cancellation signing block and reset abuse baseline timestamp.
 */
exports.adminUnblockTruckerCancellationBlock = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const userId = typeof data?.userId === 'string' ? data.userId.trim() : '';
  const reason = typeof data?.reason === 'string' ? data.reason.trim() : '';

  if (!userId) {
    throw new functions.https.HttpsError('invalid-argument', 'User ID is required');
  }

  const db = admin.firestore();
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'User not found');
  }

  const truckerProfileDoc = await db.collection('users').doc(userId).collection('truckerProfile').doc('profile').get();
  if (!truckerProfileDoc.exists) {
    throw new functions.https.HttpsError('failed-precondition', 'Target user does not have a trucker profile');
  }

  const complianceRef = db.collection('users').doc(userId).collection('truckerCompliance').doc('profile');
  const now = admin.firestore.FieldValue.serverTimestamp();

  await complianceRef.set({
    cancellationBlockUntil: null,
    cancellationBlockedAt: null,
    cancellationBlockReason: null,
    cancellationResetAt: now,
    cancellationResetBy: context.auth.uid,
    cancellationResetReason: reason || 'Reset via admin dashboard',
    updatedAt: now,
  }, { merge: true });

  await db.collection(`users/${userId}/notifications`).doc().set({
    type: 'ACCOUNT_RESTRICTED',
    title: 'Cancellation Block Reset',
    message: 'Your cancellation signing block was reset by admin review. Future checks will use a new baseline.',
    data: {
      reason: 'admin-trucker-cancellation-reset',
      resetBy: context.auth.uid,
    },
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await db.collection('adminLogs').add({
    action: 'ADMIN_TRUCKER_CANCELLATION_RESET',
    targetUserId: userId,
    performedBy: context.auth.uid,
    reason: reason || 'Reset via admin dashboard',
    performedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { message: 'Trucker cancellation block reset successfully' };
});

/**
 * Get trucker cancellation abuse status for admin review.
 */
exports.adminGetTruckerCancellationStatus = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const userId = typeof data?.userId === 'string' ? data.userId.trim() : '';
  if (!userId) {
    throw new functions.https.HttpsError('invalid-argument', 'User ID is required');
  }

  const db = admin.firestore();
  const [userDoc, profileDoc, complianceDoc] = await Promise.all([
    db.collection('users').doc(userId).get(),
    db.collection('users').doc(userId).collection('truckerProfile').doc('profile').get(),
    db.collection('users').doc(userId).collection('truckerCompliance').doc('profile').get(),
  ]);

  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'User not found');
  }
  if (!profileDoc.exists) {
    throw new functions.https.HttpsError('failed-precondition', 'Target user does not have a trucker profile');
  }

  const now = new Date();
  const complianceData = complianceDoc.exists ? (complianceDoc.data() || {}) : {};
  const resetAt = toDateValue(complianceData.cancellationResetAt);
  const rollingWindowStart = startOfRollingWindow(now, TRUCKER_CANCELLATION_WINDOW_DAYS);
  const baselineDate = resetAt && resetAt.getTime() > rollingWindowStart.getTime()
    ? resetAt
    : rollingWindowStart;

  const countSnap = await db.collection('contracts')
    .where('truckerId', '==', userId)
    .where('cancelledByRole', '==', 'trucker')
    .where('cancelledAt', '>=', admin.firestore.Timestamp.fromDate(baselineDate))
    .count()
    .get();
  const cancellationCountInWindow = Number(countSnap?.data()?.count || 0);

  const blockUntilDate = toDateValue(complianceData.cancellationBlockUntil);
  const isBlocked = Boolean(blockUntilDate && blockUntilDate.getTime() > now.getTime());

  return {
    userId,
    isBlocked,
    blockReason: complianceData.cancellationBlockReason || null,
    blockUntil: blockUntilDate ? blockUntilDate.toISOString() : null,
    blockedAt: toDateValue(complianceData.cancellationBlockedAt)?.toISOString() || null,
    resetAt: resetAt ? resetAt.toISOString() : null,
    resetBy: complianceData.cancellationResetBy || null,
    resetReason: complianceData.cancellationResetReason || null,
    docsRequiredOnSigning: complianceData.docsRequiredOnSigning !== false,
    cancellationCountInWindow,
    threshold: TRUCKER_CANCELLATION_THRESHOLD,
    windowDays: TRUCKER_CANCELLATION_WINDOW_DAYS,
    blockDays: TRUCKER_CANCELLATION_BLOCK_DAYS,
    baselineStart: baselineDate.toISOString(),
  };
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

  if (!userId || typeof grant !== 'boolean') {
    throw new functions.https.HttpsError('invalid-argument', 'userId and grant (boolean) are required');
  }

  const db = admin.firestore();

  // Get current user state for audit logging
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'User not found');
  }
  const previousData = userDoc.data() || {};
  const targetIsAdmin = previousData.isAdmin === true || previousData.role === 'admin';

  if (grant && !ADMIN_GRANTS_ENABLED) {
    await db.collection('adminLogs').add({
      action: 'BLOCKED_ADMIN_GRANT_ATTEMPT',
      targetUserId: userId,
      performedBy: context.auth.uid,
      reason: 'admin_grants_disabled',
      performedAt: admin.firestore.FieldValue.serverTimestamp(),
      ipAddress: context.rawRequest?.ip || null,
      userAgent: context.rawRequest?.headers['user-agent'] || null,
    });
    throw new functions.https.HttpsError('failed-precondition', 'Granting new admins is currently disabled');
  }

  if (!grant && targetIsAdmin && isActiveAdminUser(previousData)) {
    const activeAdminCount = await getActiveAdminCount(db);
    if (activeAdminCount <= 1) {
      await db.collection('adminLogs').add({
        action: 'LAST_ADMIN_REVOKE_BLOCKED',
        targetUserId: userId,
        performedBy: context.auth.uid,
        reason: 'cannot_revoke_last_admin',
        activeAdminCount,
        performedAt: admin.firestore.FieldValue.serverTimestamp(),
        ipAddress: context.rawRequest?.ip || null,
        userAgent: context.rawRequest?.headers['user-agent'] || null,
      });
      throw new functions.https.HttpsError('failed-precondition', 'Cannot revoke the last active admin');
    }
  }

  const normalizedPreviousRole = String(previousData.role || '').trim().toLowerCase();
  const normalizedPreviousNonAdminRole = String(previousData.previousNonAdminRole || '').trim().toLowerCase();
  const resolvedPreviousNonAdminRole = ['shipper', 'trucker'].includes(normalizedPreviousNonAdminRole)
    ? normalizedPreviousNonAdminRole
    : ['shipper', 'trucker'].includes(normalizedPreviousRole)
      ? normalizedPreviousRole
      : 'shipper';

  if (grant) {
    // Grant admin
    await db.collection('users').doc(userId).update({
      isAdmin: true,
      role: 'admin',
      previousNonAdminRole: resolvedPreviousNonAdminRole,
      adminGrantedAt: admin.firestore.FieldValue.serverTimestamp(),
      adminGrantedBy: context.auth.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } else {
    // Revoke admin
    await db.collection('users').doc(userId).update({
      isAdmin: false,
      role: resolvedPreviousNonAdminRole,
      adminRevokedAt: admin.firestore.FieldValue.serverTimestamp(),
      adminRevokedBy: context.auth.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  const authUser = await admin.auth().getUser(userId);
  const currentClaims = authUser.customClaims || {};
  await admin.auth().setCustomUserClaims(userId, {
    ...currentClaims,
    admin: grant,
  });

  if (!grant && targetIsAdmin) {
    await db.collection(`users/${userId}/notifications`).doc().set({
      type: 'ADMIN_ROLE_REVOKED',
      title: 'Admin Access Revoked',
      message: 'Your admin access has been revoked. Contact the account owner if this was unexpected.',
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
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
    newRole: grant ? 'admin' : resolvedPreviousNonAdminRole,
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
    meta: {
      asOf: new Date().toISOString(),
    },
  };
});

/**
 * Admin financial overview payload (server-authoritative).
 */
exports.adminGetFinancialOverview = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const db = admin.firestore();
  const safeLimit = parseLimit(data?.limit || 50, 50);
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const weekAgo = new Date(startOfToday.getTime() - (7 * 24 * 60 * 60 * 1000));
  const monthAgo = new Date(startOfToday.getTime() - (30 * 24 * 60 * 60 * 1000));

  const [platformFeesSnapshot, pendingPayoutsSnapshot, walletsSnapshot] = await Promise.all([
    db.collection('platformFees')
      .where('status', '==', 'completed')
      .orderBy('createdAt', 'desc')
      .limit(5000)
      .get(),
    db.collection('brokerPayoutRequests')
      .where('status', '==', 'pending')
      .get(),
    db.collectionGroup('wallet').limit(10000).get(),
  ]);

  let totalRevenue = 0;
  let todayRevenue = 0;
  let weekRevenue = 0;
  let monthRevenue = 0;

  const transactions = [];
  const recentRows = platformFeesSnapshot.docs.slice(0, safeLimit);
  recentRows.forEach((docSnap) => {
    const fee = docSnap.data() || {};
    const amount = Number(fee.amount || 0);
    const createdAt = toDateValue(fee.createdAt) || now;

    transactions.push({
      id: docSnap.id,
      type: 'fee',
      amount,
      userId: fee.userId || '',
      userName: fee.userName || null,
      createdAt: createdAt.toISOString(),
    });
  });

  platformFeesSnapshot.docs.forEach((docSnap) => {
    const fee = docSnap.data() || {};
    const amount = Number(fee.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) return;

    totalRevenue += amount;
    const createdAt = toDateValue(fee.createdAt);
    if (!createdAt) return;
    if (createdAt >= startOfToday) todayRevenue += amount;
    if (createdAt >= weekAgo) weekRevenue += amount;
    if (createdAt >= monthAgo) monthRevenue += amount;
  });

  let totalWalletBalance = 0;
  walletsSnapshot.docs.forEach((docSnap) => {
    const wallet = docSnap.data() || {};
    totalWalletBalance += Number(wallet.balance || 0);
  });

  let pendingPayouts = 0;
  pendingPayoutsSnapshot.docs.forEach((docSnap) => {
    const request = docSnap.data() || {};
    pendingPayouts += Number(request.amount || 0);
  });

  const userIds = [...new Set(transactions.map((item) => item.userId).filter(Boolean))];
  if (userIds.length > 0) {
    try {
      const userDocs = await db.getAll(...userIds.map((userId) => db.collection('users').doc(userId)));
      const userMap = {};
      userDocs.forEach((docSnap) => {
        if (!docSnap.exists) return;
        const user = docSnap.data() || {};
        userMap[docSnap.id] = user.displayName || user.name || user.email || docSnap.id.slice(0, 12);
      });
      transactions.forEach((item) => {
        if (!item.userName && item.userId) {
          item.userName = userMap[item.userId] || item.userId.slice(0, 12);
        }
      });
    } catch (error) {
      console.warn('adminGetFinancialOverview: user enrichment failed: %s', safeErrorMessage(error));
    }
  }

  return {
    stats: {
      totalRevenue,
      todayRevenue,
      weekRevenue,
      monthRevenue,
      totalWalletBalance,
      pendingPayouts,
    },
    items: transactions,
    transactions,
    total: transactions.length,
    nextCursor: null,
    meta: {
      asOf: new Date().toISOString(),
    },
  };
});

/**
 * Resolve Dispute
 */
exports.adminResolveDispute = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const disputeId = typeof data?.disputeId === 'string' ? data.disputeId.trim() : '';
  const resolution = typeof data?.resolution === 'string' ? data.resolution.trim().toLowerCase() : '';
  const notes = typeof data?.notes === 'string' ? data.notes.trim() : '';

  if (!disputeId || !resolution) {
    throw new functions.https.HttpsError('invalid-argument', 'Dispute ID and resolution are required');
  }

  const db = admin.firestore();
  const disputeRef = db.collection('disputes').doc(disputeId);
  const disputeDoc = await disputeRef.get();
  if (!disputeDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Dispute not found');
  }

  await disputeRef.update({
    status: 'resolved',
    resolution,
    resolutionCode: resolution,
    resolutionNotes: notes || null,
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
    notes: notes || null,
    performedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true, message: 'Dispute resolved successfully' };
});

/**
 * Canonical disputes list (server-authoritative).
 */
exports.adminGetDisputes = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const { status = 'all', limit = 100, cursor: cursorId } = data || {};
  const db = admin.firestore();
  const safeLimit = parseLimit(limit, 100);
  const normalizedStatus = typeof status === 'string' ? status.trim().toLowerCase() : 'all';
  const cursorDoc = await resolveCursor(db, 'disputes', cursorId);
  const canUseCreatedAtCursor = !!cursorDoc?.get('createdAt');

  let baseQuery = db.collection('disputes');
  if (normalizedStatus && normalizedStatus !== 'all') {
    baseQuery = baseQuery.where('status', '==', normalizedStatus);
  }

  let snapshot;
  let usedFallbackQuery = false;
  try {
    let query = baseQuery.orderBy('createdAt', 'desc');
    if (canUseCreatedAtCursor) {
      query = query.startAfter(cursorDoc);
    }
    snapshot = await query.limit(safeLimit).get();
  } catch (error) {
    const code = error?.code;
    const message = String(error?.message || '').toLowerCase();
    const canFallback = (
      code === 9 ||
      code === 'failed-precondition' ||
      message.includes('requires an index')
    );
    if (!canFallback) {
      throw error;
    }

    let fallbackQuery = baseQuery.orderBy(admin.firestore.FieldPath.documentId());
    if (cursorDoc) {
      fallbackQuery = fallbackQuery.startAfter(cursorDoc.id);
    }
    snapshot = await fallbackQuery.limit(safeLimit).get();
    usedFallbackQuery = true;
  }

  const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
  const rawDisputes = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  const contractIds = [...new Set(rawDisputes.map((item) => item.contractId).filter(Boolean))];
  const [contractsDocs, summaryAll, summaryOpen, summaryInvestigating, summaryResolved] = await Promise.all([
    contractIds.length
      ? db.getAll(...contractIds.map((contractId) => db.collection('contracts').doc(contractId)))
      : Promise.resolve([]),
    db.collection('disputes').count().get(),
    db.collection('disputes').where('status', '==', 'open').count().get(),
    db.collection('disputes').where('status', '==', 'investigating').count().get(),
    db.collection('disputes').where('status', '==', 'resolved').count().get(),
  ]);

  const contractMap = {};
  contractsDocs.forEach((docSnap) => {
    if (docSnap.exists) {
      contractMap[docSnap.id] = docSnap.data() || {};
    }
  });

  const userIds = [...new Set(
    rawDisputes.flatMap((item) => {
      const contract = item.contractId ? (contractMap[item.contractId] || {}) : {};
      return [
        item.shipperId,
        item.truckerId,
        item.openedBy,
        item.resolvedBy,
        contract.listingOwnerId,
        contract.bidderId,
      ].filter(Boolean);
    })
  )];

  const userMap = {};
  if (userIds.length > 0) {
    try {
      const userDocs = await db.getAll(...userIds.map((userId) => db.collection('users').doc(userId)));
      userDocs.forEach((docSnap) => {
        if (!docSnap.exists) return;
        const userData = docSnap.data() || {};
        userMap[docSnap.id] = {
          id: docSnap.id,
          name: userData.name || userData.displayName || userData.email || docSnap.id,
          phone: userData.phone || null,
          email: userData.email || null,
        };
      });
    } catch (error) {
      console.warn('adminGetDisputes: user enrichment failed: %s', safeErrorMessage(error));
    }
  }

  const disputes = rawDisputes
    .map((item) => {
      const contract = item.contractId ? (contractMap[item.contractId] || {}) : {};
      const shipperId = item.shipperId || contract.listingOwnerId || null;
      const truckerId = item.truckerId || contract.bidderId || null;
      const createdAt = toDateValue(item.createdAt || item.filedAt || item.updatedAt);
      const updatedAt = toDateValue(item.updatedAt || item.createdAt);
      const filedAt = toDateValue(item.filedAt || item.createdAt || item.updatedAt);

      return {
        id: item.id,
        disputeId: item.id,
        contractId: item.contractId || null,
        contractNumber: item.contractNumber || contract.contractNumber || null,
        status: String(item.status || 'open').toLowerCase(),
        reason: item.reason || item.disputeReason || contract.disputeReason || 'No reason provided',
        description: item.description || item.disputeDescription || contract.disputeDescription || '',
        shipperId,
        truckerId,
        shipperName: item.shipperName || contract.listingOwnerName || userMap[shipperId]?.name || 'N/A',
        truckerName: item.truckerName || contract.bidderName || userMap[truckerId]?.name || 'N/A',
        openedBy: item.openedBy || null,
        openedByName: item.openedBy ? (userMap[item.openedBy]?.name || item.openedBy) : null,
        resolvedBy: item.resolvedBy || null,
        resolvedByName: item.resolvedBy ? (userMap[item.resolvedBy]?.name || item.resolvedBy) : null,
        resolution: item.resolution || item.resolutionCode || null,
        resolutionCode: item.resolutionCode || item.resolution || null,
        resolutionNotes: item.resolutionNotes || null,
        filedAt: filedAt ? filedAt.toISOString() : null,
        createdAt: createdAt ? createdAt.toISOString() : null,
        updatedAt: updatedAt ? updatedAt.toISOString() : null,
        resolvedAt: toDateValue(item.resolvedAt)?.toISOString() || null,
      };
    })
    .sort((a, b) => {
      if (usedFallbackQuery) return 0;
      return toComparableTimestamp(b.createdAt, 0) - toComparableTimestamp(a.createdAt, 0);
    });

  return buildAdminListResponse({
    items: disputes,
    total: summaryAll.data().count,
    nextCursor: snapshot.docs.length === safeLimit && lastDoc ? lastDoc.id : null,
    legacyKey: 'disputes',
    extra: {
      summary: {
        total: summaryAll.data().count,
        open: summaryOpen.data().count,
        investigating: summaryInvestigating.data().count,
        resolved: summaryResolved.data().count,
      },
      meta: {
        asOf: new Date().toISOString(),
        queryFallback: usedFallbackQuery,
      },
    },
  });
});

/**
 * Optional migration helper: backfill disputes from legacy disputed contracts.
 * Idempotent via deterministic dispute document IDs.
 */
exports.adminBackfillLegacyDisputes = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const db = admin.firestore();
  const safeLimit = parseLimit(data?.limit || 200, 200);
  const dryRun = data?.dryRun !== false;

  const disputedContractsSnap = await db.collection('contracts')
    .where('status', '==', 'disputed')
    .orderBy('updatedAt', 'desc')
    .limit(safeLimit)
    .get();

  let created = 0;
  let skippedExisting = 0;
  let failed = 0;
  const touchedDisputeIds = [];

  for (const contractDoc of disputedContractsSnap.docs) {
    const contract = contractDoc.data() || {};
    const disputeId = `legacy_contract_${contractDoc.id}`;
    const disputeRef = db.collection('disputes').doc(disputeId);
    // eslint-disable-next-line no-await-in-loop
    const existing = await disputeRef.get();
    if (existing.exists) {
      skippedExisting += 1;
      continue;
    }

    if (dryRun) {
      created += 1;
      touchedDisputeIds.push(disputeId);
      continue;
    }

    try {
      // eslint-disable-next-line no-await-in-loop
      await disputeRef.set({
        contractId: contractDoc.id,
        contractNumber: contract.contractNumber || null,
        status: 'open',
        reason: contract.disputeReason || 'Legacy disputed contract',
        description: contract.disputeDescription || null,
        shipperId: contract.listingOwnerId || null,
        truckerId: contract.bidderId || null,
        shipperName: contract.listingOwnerName || null,
        truckerName: contract.bidderName || null,
        filedAt: contract.disputeFiledAt || contract.updatedAt || admin.firestore.FieldValue.serverTimestamp(),
        source: 'legacy_contract_disputed_status',
        sourceContractId: contractDoc.id,
        migrationKey: `contract:${contractDoc.id}`,
        migratedAt: admin.firestore.FieldValue.serverTimestamp(),
        migratedBy: context.auth.uid,
        createdAt: contract.disputeFiledAt || contract.updatedAt || admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      created += 1;
      touchedDisputeIds.push(disputeId);
    } catch (error) {
      failed += 1;
      console.error('adminBackfillLegacyDisputes: failed for contractId=%s: %s', contractDoc.id, safeErrorMessage(error));
    }
  }

  await db.collection('adminLogs').add({
    action: 'BACKFILL_LEGACY_DISPUTES',
    performedBy: context.auth.uid,
    performedAt: admin.firestore.FieldValue.serverTimestamp(),
    dryRun,
    scanned: disputedContractsSnap.size,
    created,
    skippedExisting,
    failed,
  });

  return {
    success: true,
    dryRun,
    scanned: disputedContractsSnap.size,
    created,
    skippedExisting,
    failed,
    touchedDisputeIds: touchedDisputeIds.slice(0, 50),
    meta: { asOf: new Date().toISOString() },
  };
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
  const contracts = snapshot.docs.map(doc => serializeForApi({ id: doc.id, ...doc.data() }));

  return buildAdminListResponse({
    items: contracts,
    total: contracts.length,
    nextCursor: contracts.length === safeLimit && lastDoc ? lastDoc.id : null,
    legacyKey: 'contracts',
  });
});

/**
 * Get Listings (Admin, callable-backed cutover source)
 */
exports.adminGetListings = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const db = admin.firestore();
  const safeLimit = parseLimit(data?.limit || 100, 100);
  const normalizedType = String(data?.type || 'all').trim().toLowerCase();
  const normalizedStatus = String(data?.status || 'all').trim().toLowerCase();
  const cursor = decodeCursor(data?.cursor);
  const windowLimit = Math.min(Math.max(safeLimit * 5, safeLimit), 500);

  const includeCargo = normalizedType === 'all' || normalizedType === 'cargo';
  const includeTruck = normalizedType === 'all' || normalizedType === 'truck';
  if (!includeCargo && !includeTruck) {
    throw new functions.https.HttpsError('invalid-argument', 'type must be all, cargo, or truck');
  }

  const [cargoSnapshot, truckSnapshot] = await Promise.all([
    includeCargo
      ? db.collection('cargoListings').orderBy('createdAt', 'desc').limit(windowLimit).get()
      : Promise.resolve({ docs: [] }),
    includeTruck
      ? db.collection('truckListings').orderBy('createdAt', 'desc').limit(windowLimit).get()
      : Promise.resolve({ docs: [] }),
  ]);

  const combined = [
    ...cargoSnapshot.docs.map((docSnap) => ({ id: docSnap.id, type: 'cargo', ...docSnap.data() })),
    ...truckSnapshot.docs.map((docSnap) => ({ id: docSnap.id, type: 'truck', ...docSnap.data() })),
  ]
    .filter((item) => normalizedStatus === 'all' || String(item.status || '').toLowerCase() === normalizedStatus)
    .map((item) => {
      const createdAtMs = toComparableTimestamp(item.createdAt, toComparableTimestamp(item.updatedAt, 0));
      return {
        ...item,
        createdAtMs,
        cursorKey: `${item.type}:${item.id}`,
      };
    })
    .sort((a, b) => {
      if (b.createdAtMs !== a.createdAtMs) return b.createdAtMs - a.createdAtMs;
      return String(b.cursorKey).localeCompare(String(a.cursorKey));
    });

  const filtered = cursor
    ? combined.filter((item) => (
      item.createdAtMs < Number(cursor.createdAtMs || 0)
      || (
        item.createdAtMs === Number(cursor.createdAtMs || 0)
        && String(item.cursorKey) < String(cursor.key || '')
      )
    ))
    : combined;

  const pageItems = filtered.slice(0, safeLimit).map(({ createdAtMs: _createdAtMs, cursorKey: _cursorKey, ...item }) => serializeForApi(item));
  const lastItem = filtered[safeLimit - 1] || null;
  const nextCursor = lastItem
    ? encodeCursor({ createdAtMs: lastItem.createdAtMs, key: lastItem.cursorKey })
    : null;

  const countCollection = async (collectionName) => {
    if (normalizedStatus === 'all') {
      return db.collection(collectionName).count().get();
    }
    return db.collection(collectionName).where('status', '==', normalizedStatus).count().get();
  };
  const [cargoCountSnap, truckCountSnap] = await Promise.all([
    includeCargo ? countCollection('cargoListings') : Promise.resolve({ data: () => ({ count: 0 }) }),
    includeTruck ? countCollection('truckListings') : Promise.resolve({ data: () => ({ count: 0 }) }),
  ]);
  const totalCount = (cargoCountSnap.data().count || 0) + (truckCountSnap.data().count || 0);

  return buildAdminListResponse({
    items: pageItems,
    total: totalCount,
    nextCursor,
    legacyKey: 'listings',
  });
});

/**
 * Get Ratings (Admin, callable-backed cutover source)
 */
exports.adminGetRatings = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const db = admin.firestore();
  const safeLimit = parseLimit(data?.limit || 100, 100);
  const rawScoreFilter = data?.score;
  const scoreFilter = Number.isFinite(Number(rawScoreFilter)) ? Number(rawScoreFilter) : null;
  const cursorId = typeof data?.cursor === 'string' ? data.cursor : null;
  const cursorDoc = await resolveCursor(db, 'ratings', cursorId);

  let baseQuery = db.collection('ratings');
  if (scoreFilter !== null) {
    baseQuery = baseQuery.where('score', '==', scoreFilter);
  }

  let snapshot;
  let usedFallbackQuery = false;
  try {
    let query = baseQuery.orderBy('createdAt', 'desc');
    if (cursorDoc) query = query.startAfter(cursorDoc);
    snapshot = await query.limit(safeLimit).get();
  } catch (error) {
    const code = error?.code;
    const message = String(error?.message || '').toLowerCase();
    const canFallback = (
      code === 9 ||
      code === 'failed-precondition' ||
      message.includes('requires an index')
    );
    if (!canFallback) throw error;

    let fallbackQuery = baseQuery.orderBy(admin.firestore.FieldPath.documentId());
    if (cursorDoc) fallbackQuery = fallbackQuery.startAfter(cursorDoc.id);
    snapshot = await fallbackQuery.limit(safeLimit).get();
    usedFallbackQuery = true;
  }

  const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
  const rawRatings = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));

  const contractIds = [...new Set(rawRatings.map((item) => item.contractId).filter(Boolean))];
  const userIds = [...new Set(rawRatings.flatMap((item) => [
    item.raterId,
    item.ratedUserId,
    item.rateeId,
    item.reviewerId,
  ].filter(Boolean)))];

  const [contractDocs, userDocs, totalCountSnap] = await Promise.all([
    contractIds.length
      ? db.getAll(...contractIds.map((contractId) => db.collection('contracts').doc(contractId)))
      : Promise.resolve([]),
    userIds.length
      ? db.getAll(...userIds.map((userId) => db.collection('users').doc(userId)))
      : Promise.resolve([]),
    scoreFilter === null
      ? db.collection('ratings').count().get()
      : db.collection('ratings').where('score', '==', scoreFilter).count().get(),
  ]);

  const contractMap = {};
  contractDocs.forEach((docSnap) => {
    if (docSnap.exists) contractMap[docSnap.id] = docSnap.data() || {};
  });
  const userMap = {};
  userDocs.forEach((docSnap) => {
    if (!docSnap.exists) return;
    const user = docSnap.data() || {};
    userMap[docSnap.id] = user.name || user.displayName || user.email || docSnap.id;
  });

  const ratings = rawRatings
    .map((item) => {
      const contract = item.contractId ? (contractMap[item.contractId] || {}) : {};
      const raterId = item.raterId || item.reviewerId || null;
      const ratedUserId = item.ratedUserId || item.rateeId || null;
      return {
        ...item,
        score: Number(item.score || 0),
        raterId,
        ratedUserId,
        raterName: item.raterName || userMap[raterId] || 'Unknown',
        ratedUserName: item.ratedUserName || userMap[ratedUserId] || 'Unknown',
        contractNumber: item.contractNumber || contract.contractNumber || null,
      };
    })
    .sort((a, b) => {
      if (usedFallbackQuery) return 0;
      return toComparableTimestamp(b.createdAt, 0) - toComparableTimestamp(a.createdAt, 0);
    });

  return buildAdminListResponse({
    items: ratings,
    total: totalCountSnap.data().count || ratings.length,
    nextCursor: snapshot.docs.length === safeLimit && lastDoc ? lastDoc.id : null,
    legacyKey: 'ratings',
    extra: {
      meta: {
        asOf: new Date().toISOString(),
        queryFallback: usedFallbackQuery,
      },
    },
  });
});

/**
 * Get All Shipments (Admin)
 *
 * Uses an orderBy(createdAt) query when available, with a graceful fallback to
 * unordered reads for legacy rows that may miss createdAt/index coverage.
 */
exports.adminGetShipments = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const { status, limit = 200, cursor: cursorId } = data || {};
  const db = admin.firestore();
  const safeLimit = parseLimit(limit, 200);
  const normalizedStatus = typeof status === 'string' ? status.trim().toLowerCase() : '';
  const cursorDoc = await resolveCursor(db, 'shipments', cursorId);
  const canUseCreatedAtCursor = !!cursorDoc?.get('createdAt');

  let baseQuery = db.collection('shipments');
  if (normalizedStatus && normalizedStatus !== 'all') {
    baseQuery = baseQuery.where('status', '==', normalizedStatus);
  }

  let snapshot;
  let usedFallbackQuery = false;
  try {
    let query = baseQuery.orderBy('createdAt', 'desc');
    if (canUseCreatedAtCursor) {
      query = query.startAfter(cursorDoc);
    }
    snapshot = await query.limit(safeLimit).get();
  } catch (error) {
    const code = error?.code;
    const message = String(error?.message || '').toLowerCase();
    const canFallback = (
      code === 9 ||
      code === 'failed-precondition' ||
      message.includes('requires an index')
    );

    if (!canFallback) {
      throw error;
    }

    let fallbackQuery = baseQuery.orderBy(admin.firestore.FieldPath.documentId());
    if (cursorDoc) {
      fallbackQuery = fallbackQuery.startAfter(cursorDoc.id);
    }
    snapshot = await fallbackQuery.limit(safeLimit).get();
    usedFallbackQuery = true;
  }

  const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;

  const shipments = snapshot.docs
    .map((doc) => serializeForApi({ id: doc.id, ...doc.data() }))
    .sort((a, b) => {
      if (usedFallbackQuery) return 0;
      const aTs = toComparableTimestamp(a.createdAt, toComparableTimestamp(a.updatedAt, 0));
      const bTs = toComparableTimestamp(b.createdAt, toComparableTimestamp(b.updatedAt, 0));
      return bTs - aTs;
    });

  return buildAdminListResponse({
    items: shipments,
    total: shipments.length,
    nextCursor: shipments.length === safeLimit && lastDoc ? lastDoc.id : null,
    legacyKey: 'shipments',
    extra: {
      meta: {
        asOf: new Date().toISOString(),
        queryFallback: usedFallbackQuery,
      },
    },
  });
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

  return buildAdminListResponse({
    items: contracts,
    total: contracts.length,
    nextCursor: contracts.length === safeLimit && lastDoc ? lastDoc.id : null,
    legacyKey: 'contracts',
    extra: {
      summary: {
        totalContracts: contracts.length,
        totalOutstanding,
        overdueCount,
        suspendedCount,
        suspendedUsers: suspendedUsersList.length,
      },
      suspendedUsers: suspendedUsersList,
    },
  });
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
exports.adminGetMarketplaceKpis = functions.region('asia-southeast1').runWith({ timeoutSeconds: 300, memory: '512MB' }).https.onCall(async (data, context) => {
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
    meta: {
      asOf: new Date().toISOString(),
    },
  };
});
