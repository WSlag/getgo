/**
 * Admin Management Cloud Functions
 * Handles admin dashboard, user management, and financial operations
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Helper: Verify admin role
async function verifyAdmin(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  // Check custom claims
  if (!context.auth.token.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required');
  }

  return true;
}

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

  // Get total wallet balance (sum across all users)
  let totalWalletBalance = 0;
  const walletsSnap = await db.collectionGroup('wallet').get();
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

  const { status = 'manual_review', limit = 50 } = data || {};
  const db = admin.firestore();

  let query = db.collection('paymentSubmissions');

  if (status) {
    query = query.where('status', '==', status);
  }

  query = query.orderBy('createdAt', 'desc').limit(limit);

  const snapshot = await query.get();

  // Enrich submissions with order and user data
  const submissions = await Promise.all(snapshot.docs.map(async (doc) => {
    const submission = { id: doc.id, ...doc.data() };

    // Fetch order data
    if (submission.orderId) {
      try {
        const orderDoc = await db.collection('orders').doc(submission.orderId).get();
        if (orderDoc.exists) {
          const orderData = orderDoc.data();
          submission.orderAmount = orderData.amount;
          submission.orderType = orderData.type;
          submission.bidId = orderData.bidId;
        }
      } catch (error) {
        console.error('Error fetching order:', error);
      }
    }

    // Fetch user data
    if (submission.userId) {
      try {
        const userDoc = await db.collection('users').doc(submission.userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          submission.userName = userData.displayName || userData.email || 'Unknown User';
          submission.userEmail = userData.email;
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    }

    return submission;
  }));

  return { submissions, total: submissions.length };
});

/**
 * Get All Users
 */
exports.adminGetUsers = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const { role, limit = 100, offset = 0 } = data || {};
  const db = admin.firestore();

  let query = db.collection('users');

  if (role) {
    query = query.where('role', '==', role);
  }

  query = query.orderBy('createdAt', 'desc').limit(limit);

  const snapshot = await query.get();
  const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  return { users, total: users.length };
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
    console.error('Error disabling auth account:', error);
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
    console.error('Error enabling auth account:', error);
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

  const { status, limit = 100 } = data || {};
  const db = admin.firestore();

  let query = db.collection('contracts');

  if (status) {
    query = query.where('status', '==', status);
  }

  query = query.orderBy('createdAt', 'desc').limit(limit);

  const snapshot = await query.get();
  const contracts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  return { contracts, total: contracts.length };
});

/**
 * Get Outstanding Platform Fees Report
 * Returns all contracts with unpaid platform fees, enriched with trucker data
 */
exports.adminGetOutstandingFees = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const { limit = 100 } = data || {};
  const db = admin.firestore();

  // Query contracts with unpaid platform fees
  const unpaidContracts = await db.collection('contracts')
    .where('platformFeePaid', '==', false)
    .orderBy('platformFeeDueDate', 'asc')
    .limit(limit)
    .get();

  console.log(`Found ${unpaidContracts.size} contracts with unpaid platform fees`);

  // Enrich contracts with trucker data
  const contracts = await Promise.all(unpaidContracts.docs.map(async (doc) => {
    const contract = { id: doc.id, ...doc.data() };

    // Fetch trucker (platform fee payer) data
    if (contract.platformFeePayerId) {
      try {
        const truckerDoc = await db.collection('users').doc(contract.platformFeePayerId).get();
        if (truckerDoc.exists) {
          const truckerData = truckerDoc.data();
          contract.truckerName = truckerData.displayName || truckerData.name || 'Unknown';
          contract.truckerEmail = truckerData.email;
          contract.truckerPhone = truckerData.phone;
          contract.truckerAccountStatus = truckerData.accountStatus || 'active';
          contract.truckerOutstandingTotal = truckerData.outstandingPlatformFees || 0;
        }
      } catch (error) {
        console.error('Error fetching trucker data:', error);
      }
    }

    // Calculate days overdue
    if (contract.platformFeeDueDate) {
      const dueDate = contract.platformFeeDueDate.toDate();
      const now = new Date();
      const daysOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
      contract.daysOverdue = daysOverdue;
      contract.isOverdue = daysOverdue > 0;
    }

    return contract;
  }));

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
  });

  return {
    contracts,
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
      .where('status', '==', 'completed')
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
