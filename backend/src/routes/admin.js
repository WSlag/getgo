import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import admin from '../config/firebase-admin.js';

const router = Router();

// Middleware to check admin role
const requireAdmin = async (req, res, next) => {
  try {
    const userId = req.user.uid;
    const db = admin.firestore?.();

    if (!db) {
      return res.status(500).json({ error: 'Firebase not configured' });
    }

    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const userData = userDoc.data();
    // Check for admin role OR isAdmin flag for flexibility
    if (userData.role !== 'admin' && !userData.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.isAdmin = true;
    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({ error: 'Failed to verify admin status' });
  }
};

// ============================================================
// PAYMENT REVIEW ENDPOINTS
// ============================================================

// Get all payment submissions pending review
router.get('/payments/pending', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { limit = 50, offset = 0, status } = req.query;
    const db = admin.firestore();

    // Accept status from query param, default to 'manual_review'
    const filterStatus = status || 'manual_review';

    const snapshot = await db
      .collection('paymentSubmissions')
      .where('status', '==', filterStatus)
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit))
      .get();

    const payments = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data();

        // Get user info
        let userInfo = null;
        try {
          const userDoc = await db.collection('users').doc(data.userId).get();
          if (userDoc.exists) {
            userInfo = {
              name: userDoc.data().name,
              phone: userDoc.data().phone,
            };
          }
        } catch (e) {
          console.error('Error getting user info:', e);
        }

        // Get order info
        let orderInfo = null;
        try {
          const orderDoc = await db.collection('orders').doc(data.orderId).get();
          if (orderDoc.exists) {
            orderInfo = {
              amount: orderDoc.data().amount,
              status: orderDoc.data().status,
            };
          }
        } catch (e) {
          console.error('Error getting order info:', e);
        }

        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || data.createdAt,
          uploadedAt: data.uploadedAt?.toDate?.() || data.uploadedAt,
          userInfo,
          orderInfo,
          // Flatten order amount for convenience
          orderAmount: orderInfo?.amount || data.orderAmount || 0,
        };
      })
    );

    res.json({ submissions: payments, total: snapshot.size });
  } catch (error) {
    console.error('Get pending payments error:', error);
    res.status(500).json({ error: 'Failed to get pending payments' });
  }
});

// Get payment verification statistics
// NOTE: This route MUST be defined before /:submissionId to avoid route conflicts
router.get('/payments/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();

    // Calculate today's start timestamp
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = admin.firestore.Timestamp.fromDate(today);

    // Get all-time counts for each status
    const [pending, approved, rejected, review, processing] = await Promise.all([
      db.collection('paymentSubmissions').where('status', '==', 'pending').count().get(),
      db.collection('paymentSubmissions').where('status', '==', 'approved').count().get(),
      db.collection('paymentSubmissions').where('status', '==', 'rejected').count().get(),
      db.collection('paymentSubmissions').where('status', '==', 'manual_review').count().get(),
      db.collection('orders').where('status', '==', 'processing').count().get(),
    ]);

    // Get today's approved/rejected counts
    const [approvedTodaySnap, rejectedTodaySnap] = await Promise.all([
      db.collection('paymentSubmissions')
        .where('status', '==', 'approved')
        .where('resolvedAt', '>=', todayTimestamp)
        .count().get(),
      db.collection('paymentSubmissions')
        .where('status', '==', 'rejected')
        .where('resolvedAt', '>=', todayTimestamp)
        .count().get(),
    ]);

    // Get today's approved submissions to calculate total amount
    const approvedTodayDocs = await db.collection('paymentSubmissions')
      .where('status', '==', 'approved')
      .where('resolvedAt', '>=', todayTimestamp)
      .get();

    // Calculate total amount approved today
    let totalAmountToday = 0;
    for (const doc of approvedTodayDocs.docs) {
      const data = doc.data();
      if (data.orderId) {
        try {
          const orderDoc = await db.collection('orders').doc(data.orderId).get();
          if (orderDoc.exists) {
            totalAmountToday += orderDoc.data().amount || 0;
          }
        } catch (e) {
          // Skip if order not found
        }
      }
    }

    // Get recent fraud flags
    let topFlags = [];
    try {
      const recentFlagsSnapshot = await db
        .collection('paymentSubmissions')
        .where('fraudFlags', '!=', [])
        .orderBy('fraudFlags')
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();

      // Count fraud flags
      const flagCounts = {};
      recentFlagsSnapshot.docs.forEach((doc) => {
        const flags = doc.data().fraudFlags || [];
        flags.forEach((flag) => {
          flagCounts[flag] = (flagCounts[flag] || 0) + 1;
        });
      });

      // Sort flags by count
      topFlags = Object.entries(flagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([flag, count]) => ({ flag, count }));
    } catch (e) {
      console.error('Error getting fraud flags:', e);
    }

    res.json({
      stats: {
        pending: pending.data().count,
        approved: approved.data().count,
        rejected: rejected.data().count,
        pendingReview: review.data().count,
        processing: processing.data().count,
        total:
          pending.data().count +
          approved.data().count +
          rejected.data().count +
          review.data().count,
        // Daily stats
        approvedToday: approvedTodaySnap.data().count,
        rejectedToday: rejectedTodaySnap.data().count,
        totalAmountToday,
      },
      topFraudFlags: topFlags,
    });
  } catch (error) {
    console.error('Get payment stats error:', error);
    res.status(500).json({ error: 'Failed to get payment statistics' });
  }
});

// Get all payment submissions with filters
router.get('/payments', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    const db = admin.firestore();

    let query = db.collection('paymentSubmissions').orderBy('createdAt', 'desc');

    if (status && status !== 'all') {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.limit(parseInt(limit)).get();

    const submissions = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data();

        // Get order info for orderAmount
        let orderAmount = data.orderAmount || 0;
        if (data.orderId && !orderAmount) {
          try {
            const orderDoc = await db.collection('orders').doc(data.orderId).get();
            if (orderDoc.exists) {
              orderAmount = orderDoc.data().amount || 0;
            }
          } catch (e) {
            console.error('Error getting order:', e);
          }
        }

        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || data.createdAt,
          orderAmount,
        };
      })
    );

    res.json({ submissions, total: snapshot.size });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ error: 'Failed to get payments' });
  }
});

// Get single payment submission details
router.get('/payments/:submissionId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { submissionId } = req.params;
    const db = admin.firestore();

    const submissionDoc = await db.collection('paymentSubmissions').doc(submissionId).get();

    if (!submissionDoc.exists) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const submission = submissionDoc.data();

    // Get user info
    let userInfo = null;
    try {
      const userDoc = await db.collection('users').doc(submission.userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        userInfo = {
          name: userData.name,
          phone: userData.phone,
          email: userData.email,
          createdAt: userData.createdAt?.toDate?.() || userData.createdAt,
        };
      }
    } catch (e) {
      console.error('Error getting user info:', e);
    }

    // Get order info
    let orderInfo = null;
    try {
      const orderDoc = await db.collection('orders').doc(submission.orderId).get();
      if (orderDoc.exists) {
        orderInfo = orderDoc.data();
        orderInfo.createdAt = orderInfo.createdAt?.toDate?.() || orderInfo.createdAt;
        orderInfo.expiresAt = orderInfo.expiresAt?.toDate?.() || orderInfo.expiresAt;
      }
    } catch (e) {
      console.error('Error getting order info:', e);
    }

    // Get fraud logs
    let fraudLogs = [];
    try {
      const logsSnapshot = await db
        .collection('fraudLogs')
        .where('submissionId', '==', submissionId)
        .orderBy('createdAt', 'desc')
        .get();

      fraudLogs = logsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      }));
    } catch (e) {
      console.error('Error getting fraud logs:', e);
    }

    res.json({
      submission: {
        id: submissionDoc.id,
        ...submission,
        createdAt: submission.createdAt?.toDate?.() || submission.createdAt,
        uploadedAt: submission.uploadedAt?.toDate?.() || submission.uploadedAt,
        resolvedAt: submission.resolvedAt?.toDate?.() || submission.resolvedAt,
        orderAmount: orderInfo?.amount || submission.orderAmount || 0,
      },
      userInfo,
      orderInfo,
      fraudLogs,
    });
  } catch (error) {
    console.error('Get payment details error:', error);
    res.status(500).json({ error: 'Failed to get payment details' });
  }
});

// Approve a payment manually
router.post('/payments/:submissionId/approve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { notes } = req.body;
    const adminId = req.user.uid;
    const db = admin.firestore();

    // Get submission
    const submissionRef = db.collection('paymentSubmissions').doc(submissionId);
    const submissionDoc = await submissionRef.get();

    if (!submissionDoc.exists) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const submission = submissionDoc.data();

    if (submission.status === 'approved') {
      return res.status(400).json({ error: 'Payment already approved' });
    }

    // Get order
    const orderRef = db.collection('orders').doc(submission.orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderDoc.data();

    // Use batch for atomic updates
    const batch = db.batch();

    // Update submission
    batch.update(submissionRef, {
      status: 'approved',
      resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
      resolvedBy: adminId,
      resolutionNotes: notes || 'Manual approval by admin',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update order
    batch.update(orderRef, {
      status: 'verified',
      verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      verifiedSubmissionId: submissionId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Credit wallet
    const walletRef = db.collection('users').doc(submission.userId).collection('wallet').doc('main');
    const walletDoc = await walletRef.get();

    if (walletDoc.exists) {
      batch.update(walletRef, {
        balance: admin.firestore.FieldValue.increment(order.amount),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      batch.set(walletRef, {
        balance: order.amount,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Create wallet transaction
    const txRef = db.collection('users').doc(submission.userId).collection('walletTransactions').doc();
    batch.set(txRef, {
      type: 'topup',
      amount: order.amount,
      method: 'GCash (Manual Approval)',
      description: `Top-up via GCash - manually approved`,
      reference: submissionId,
      status: 'completed',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Create fraud log
    const logRef = db.collection('fraudLogs').doc();
    batch.set(logRef, {
      submissionId,
      userId: submission.userId,
      action: 'manual_approved',
      fraudScore: submission.fraudScore || 0,
      triggeredRules: submission.fraudFlags || [],
      adminId,
      notes: notes || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Create notification for user
    const notifRef = db.collection('users').doc(submission.userId).collection('notifications').doc();
    batch.set(notifRef, {
      type: 'PAYMENT_STATUS',
      title: 'Payment Verified!',
      message: `Your ₱${order.amount.toLocaleString()} top-up has been verified and added to your wallet.`,
      data: { submissionId, status: 'approved', amount: order.amount },
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    res.json({
      success: true,
      message: 'Payment approved successfully',
      amount: order.amount,
    });
  } catch (error) {
    console.error('Approve payment error:', error);
    res.status(500).json({ error: 'Failed to approve payment' });
  }
});

// Reject a payment manually
router.post('/payments/:submissionId/reject', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { reason, notes } = req.body;
    const adminId = req.user.uid;
    const db = admin.firestore();

    if (!reason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    // Get submission
    const submissionRef = db.collection('paymentSubmissions').doc(submissionId);
    const submissionDoc = await submissionRef.get();

    if (!submissionDoc.exists) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const submission = submissionDoc.data();

    if (submission.status === 'rejected') {
      return res.status(400).json({ error: 'Payment already rejected' });
    }

    // Use batch for atomic updates
    const batch = db.batch();

    // Update submission
    batch.update(submissionRef, {
      status: 'rejected',
      resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
      resolvedBy: adminId,
      resolutionNotes: notes || reason,
      validationErrors: [...(submission.validationErrors || []), reason],
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update order
    const orderRef = db.collection('orders').doc(submission.orderId);
    batch.update(orderRef, {
      status: 'rejected',
      rejectionReason: reason,
      rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Create fraud log
    const logRef = db.collection('fraudLogs').doc();
    batch.set(logRef, {
      submissionId,
      userId: submission.userId,
      action: 'manual_rejected',
      fraudScore: submission.fraudScore || 0,
      triggeredRules: submission.fraudFlags || [],
      adminId,
      notes: reason,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Create notification for user
    const notifRef = db.collection('users').doc(submission.userId).collection('notifications').doc();
    batch.set(notifRef, {
      type: 'PAYMENT_STATUS',
      title: 'Payment Verification Failed',
      message: reason,
      data: { submissionId, status: 'rejected' },
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    res.json({
      success: true,
      message: 'Payment rejected successfully',
    });
  } catch (error) {
    console.error('Reject payment error:', error);
    res.status(500).json({ error: 'Failed to reject payment' });
  }
});

// ============================================================
// DASHBOARD OVERVIEW ENDPOINTS
// ============================================================

// Get dashboard overview stats
router.get('/dashboard/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();

    // Calculate today's start timestamp
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = admin.firestore.Timestamp.fromDate(today);

    // Calculate week start timestamp
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const weekTimestamp = admin.firestore.Timestamp.fromDate(weekStart);

    // Get counts in parallel
    const [
      usersCount,
      shippersCount,
      truckersCount,
      cargoListingsCount,
      truckListingsCount,
      contractsCount,
      activeContractsCount,
      completedContractsCount,
      disputesCount,
      pendingPaymentsCount,
    ] = await Promise.all([
      db.collection('users').count().get(),
      db.collection('users').where('role', '==', 'shipper').count().get(),
      db.collection('users').where('role', '==', 'trucker').count().get(),
      db.collection('cargoListings').count().get(),
      db.collection('truckListings').count().get(),
      db.collection('contracts').count().get(),
      db.collection('contracts').where('status', 'in', ['signed', 'in_transit']).count().get(),
      db.collection('contracts').where('status', '==', 'completed').count().get(),
      db.collection('disputes').where('status', '==', 'open').count().get(),
      db.collection('paymentSubmissions').where('status', '==', 'manual_review').count().get(),
    ]);

    // Get new users today and this week
    const [newUsersToday, newUsersWeek] = await Promise.all([
      db.collection('users').where('createdAt', '>=', todayTimestamp).count().get(),
      db.collection('users').where('createdAt', '>=', weekTimestamp).count().get(),
    ]);

    // Get revenue from completed contracts (platform fees)
    let totalRevenue = 0;
    let todayRevenue = 0;
    let weekRevenue = 0;

    try {
      const completedContracts = await db
        .collection('contracts')
        .where('status', '==', 'completed')
        .get();

      completedContracts.docs.forEach((doc) => {
        const data = doc.data();
        const platformFee = data.platformFee || 0;
        totalRevenue += platformFee;

        const completedAt = data.completedAt?.toDate?.();
        if (completedAt) {
          if (completedAt >= today) {
            todayRevenue += platformFee;
          }
          if (completedAt >= weekStart) {
            weekRevenue += platformFee;
          }
        }
      });
    } catch (e) {
      console.error('Error calculating revenue:', e);
    }

    res.json({
      users: {
        total: usersCount.data().count,
        shippers: shippersCount.data().count,
        truckers: truckersCount.data().count,
        newToday: newUsersToday.data().count,
        newThisWeek: newUsersWeek.data().count,
      },
      listings: {
        cargo: cargoListingsCount.data().count,
        trucks: truckListingsCount.data().count,
        total: cargoListingsCount.data().count + truckListingsCount.data().count,
      },
      contracts: {
        total: contractsCount.data().count,
        active: activeContractsCount.data().count,
        completed: completedContractsCount.data().count,
      },
      disputes: {
        open: disputesCount.data().count,
      },
      payments: {
        pendingReview: pendingPaymentsCount.data().count,
      },
      revenue: {
        total: totalRevenue,
        today: todayRevenue,
        week: weekRevenue,
      },
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to get dashboard stats' });
  }
});

// ============================================================
// USER MANAGEMENT ENDPOINTS
// ============================================================

// Get all users with filters
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { role, status, verified, search, limit = 50, offset = 0 } = req.query;
    const db = admin.firestore();

    let query = db.collection('users').orderBy('createdAt', 'desc');

    if (role && role !== 'all') {
      query = query.where('role', '==', role);
    }

    if (status === 'active') {
      query = query.where('isActive', '==', true);
    } else if (status === 'suspended') {
      query = query.where('isSuspended', '==', true);
    }

    if (verified === 'true') {
      query = query.where('isVerified', '==', true);
    } else if (verified === 'false') {
      query = query.where('isVerified', '==', false);
    }

    const snapshot = await query.limit(parseInt(limit)).get();

    let users = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        email: data.email,
        phone: data.phone,
        role: data.role,
        isAdmin: data.isAdmin || false,
        isVerified: data.isVerified || false,
        isSuspended: data.isSuspended || false,
        isActive: data.isActive !== false,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        lastLoginAt: data.lastLoginAt?.toDate?.() || data.lastLoginAt,
      };
    });

    // Filter by search term (client-side for flexibility)
    if (search) {
      const searchLower = search.toLowerCase();
      users = users.filter(
        (u) =>
          u.name?.toLowerCase().includes(searchLower) ||
          u.email?.toLowerCase().includes(searchLower) ||
          u.phone?.includes(search)
      );
    }

    res.json({ users, total: users.length });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Get single user details
router.get('/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const db = admin.firestore();

    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();

    // Get user's profiles (shipper/trucker)
    let shipperProfile = null;
    let truckerProfile = null;

    try {
      const shipperDoc = await db.collection('shipperProfiles').doc(userId).get();
      if (shipperDoc.exists) {
        shipperProfile = shipperDoc.data();
      }
    } catch (e) {
      console.error('Error getting shipper profile:', e);
    }

    try {
      const truckerDoc = await db.collection('truckerProfiles').doc(userId).get();
      if (truckerDoc.exists) {
        truckerProfile = truckerDoc.data();
      }
    } catch (e) {
      console.error('Error getting trucker profile:', e);
    }

    // Get user's wallet
    let wallet = null;
    try {
      const walletDoc = await db.collection('users').doc(userId).collection('wallet').doc('main').get();
      if (walletDoc.exists) {
        wallet = walletDoc.data();
      }
    } catch (e) {
      console.error('Error getting wallet:', e);
    }

    // Get user's recent activity counts
    const [listingsCount, contractsCount, ratingsCount] = await Promise.all([
      db.collection('cargoListings').where('userId', '==', userId).count().get(),
      db.collection('contracts').where('shipperId', '==', userId).count().get(),
      db.collection('ratings').where('rateeId', '==', userId).count().get().catch(() => ({ data: () => ({ count: 0 }) })),
    ]);

    res.json({
      user: {
        id: userDoc.id,
        ...userData,
        createdAt: userData.createdAt?.toDate?.() || userData.createdAt,
        lastLoginAt: userData.lastLoginAt?.toDate?.() || userData.lastLoginAt,
      },
      profiles: {
        shipper: shipperProfile,
        trucker: truckerProfile,
      },
      wallet,
      stats: {
        listings: listingsCount.data().count,
        contracts: contractsCount.data().count,
        ratings: ratingsCount.data().count,
      },
    });
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({ error: 'Failed to get user details' });
  }
});

// Suspend user
router.post('/users/:userId/suspend', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const adminId = req.user.uid;
    const db = admin.firestore();

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    await userRef.update({
      isSuspended: true,
      suspendedAt: admin.firestore.FieldValue.serverTimestamp(),
      suspendedBy: adminId,
      suspendReason: reason || 'Administrative action',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Create notification
    await db.collection('users').doc(userId).collection('notifications').add({
      type: 'ACCOUNT_STATUS',
      title: 'Account Suspended',
      message: reason || 'Your account has been suspended. Please contact support.',
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true, message: 'User suspended successfully' });
  } catch (error) {
    console.error('Suspend user error:', error);
    res.status(500).json({ error: 'Failed to suspend user' });
  }
});

// Activate user
router.post('/users/:userId/activate', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const db = admin.firestore();

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    await userRef.update({
      isSuspended: false,
      isActive: true,
      suspendedAt: admin.firestore.FieldValue.delete(),
      suspendedBy: admin.firestore.FieldValue.delete(),
      suspendReason: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Create notification
    await db.collection('users').doc(userId).collection('notifications').add({
      type: 'ACCOUNT_STATUS',
      title: 'Account Activated',
      message: 'Your account has been reactivated. Welcome back!',
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true, message: 'User activated successfully' });
  } catch (error) {
    console.error('Activate user error:', error);
    res.status(500).json({ error: 'Failed to activate user' });
  }
});

// Verify user
router.post('/users/:userId/verify', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.user.uid;
    const db = admin.firestore();

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    await userRef.update({
      isVerified: true,
      verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      verifiedBy: adminId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Create notification
    await db.collection('users').doc(userId).collection('notifications').add({
      type: 'ACCOUNT_STATUS',
      title: 'Account Verified',
      message: 'Your account has been verified! You now have full access to the platform.',
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true, message: 'User verified successfully' });
  } catch (error) {
    console.error('Verify user error:', error);
    res.status(500).json({ error: 'Failed to verify user' });
  }
});

// Toggle admin role
router.post('/users/:userId/admin', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { grant } = req.body;
    const adminId = req.user.uid;
    const db = admin.firestore();

    // Prevent self-demotion
    if (userId === adminId && !grant) {
      return res.status(400).json({ error: 'Cannot remove your own admin privileges' });
    }

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    await userRef.update({
      isAdmin: grant,
      role: grant ? 'admin' : userDoc.data().previousRole || 'shipper',
      previousRole: grant ? userDoc.data().role : null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Keep Firebase Auth custom claims in sync with Firestore role flags
    try {
      const userRecord = await admin.auth().getUser(userId);
      const existingClaims = userRecord.customClaims || {};
      await admin.auth().setCustomUserClaims(userId, {
        ...existingClaims,
        admin: !!grant,
      });
    } catch (claimError) {
      console.error('Failed to sync admin custom claim:', claimError);
      return res.status(500).json({
        error: 'Admin role updated in Firestore but failed to sync auth claims',
      });
    }

    res.json({
      success: true,
      message: grant ? 'Admin privileges granted' : 'Admin privileges revoked',
    });
  } catch (error) {
    console.error('Toggle admin error:', error);
    res.status(500).json({ error: 'Failed to update admin status' });
  }
});

// ============================================================
// LISTINGS MANAGEMENT ENDPOINTS
// ============================================================

// Get all listings (cargo + trucks)
router.get('/listings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { type, status, search, limit = 50 } = req.query;
    const db = admin.firestore();

    let cargoListings = [];
    let truckListings = [];

    if (!type || type === 'all' || type === 'cargo') {
      let cargoQuery = db.collection('cargoListings').orderBy('createdAt', 'desc');
      if (status && status !== 'all') {
        cargoQuery = cargoQuery.where('status', '==', status);
      }
      const cargoSnapshot = await cargoQuery.limit(parseInt(limit)).get();
      cargoListings = cargoSnapshot.docs.map((doc) => ({
        id: doc.id,
        type: 'cargo',
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      }));
    }

    if (!type || type === 'all' || type === 'truck') {
      let truckQuery = db.collection('truckListings').orderBy('createdAt', 'desc');
      if (status && status !== 'all') {
        truckQuery = truckQuery.where('status', '==', status);
      }
      const truckSnapshot = await truckQuery.limit(parseInt(limit)).get();
      truckListings = truckSnapshot.docs.map((doc) => ({
        id: doc.id,
        type: 'truck',
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      }));
    }

    let listings = [...cargoListings, ...truckListings].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      listings = listings.filter(
        (l) =>
          l.origin?.toLowerCase().includes(searchLower) ||
          l.destination?.toLowerCase().includes(searchLower) ||
          l.cargoType?.toLowerCase().includes(searchLower) ||
          l.truckType?.toLowerCase().includes(searchLower)
      );
    }

    res.json({ listings, total: listings.length });
  } catch (error) {
    console.error('Get listings error:', error);
    res.status(500).json({ error: 'Failed to get listings' });
  }
});

// Deactivate listing
router.post('/listings/:listingId/deactivate', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { listingId } = req.params;
    const { type, reason } = req.body;
    const adminId = req.user.uid;
    const db = admin.firestore();

    const collection = type === 'truck' ? 'truckListings' : 'cargoListings';
    const listingRef = db.collection(collection).doc(listingId);
    const listingDoc = await listingRef.get();

    if (!listingDoc.exists) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    await listingRef.update({
      status: 'deactivated',
      deactivatedAt: admin.firestore.FieldValue.serverTimestamp(),
      deactivatedBy: adminId,
      deactivateReason: reason || 'Administrative action',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Notify user
    const listing = listingDoc.data();
    await db.collection('users').doc(listing.userId).collection('notifications').add({
      type: 'LISTING_STATUS',
      title: 'Listing Deactivated',
      message: reason || 'Your listing has been deactivated by an administrator.',
      data: { listingId, type },
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true, message: 'Listing deactivated successfully' });
  } catch (error) {
    console.error('Deactivate listing error:', error);
    res.status(500).json({ error: 'Failed to deactivate listing' });
  }
});

// ============================================================
// CONTRACTS ENDPOINTS
// ============================================================

// Get all contracts
router.get('/contracts', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status, search, limit = 50 } = req.query;
    const db = admin.firestore();

    let query = db.collection('contracts').orderBy('createdAt', 'desc');

    if (status && status !== 'all') {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.limit(parseInt(limit)).get();

    const contracts = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data();

        // Get shipper and trucker names
        let shipperName = 'Unknown';
        let truckerName = 'Unknown';

        try {
          if (data.shipperId) {
            const shipperDoc = await db.collection('users').doc(data.shipperId).get();
            if (shipperDoc.exists) {
              shipperName = shipperDoc.data().name || 'Unknown';
            }
          }
          if (data.truckerId) {
            const truckerDoc = await db.collection('users').doc(data.truckerId).get();
            if (truckerDoc.exists) {
              truckerName = truckerDoc.data().name || 'Unknown';
            }
          }
        } catch (e) {
          console.error('Error getting party names:', e);
        }

        return {
          id: doc.id,
          ...data,
          shipperName,
          truckerName,
          createdAt: data.createdAt?.toDate?.() || data.createdAt,
          signedAt: data.signedAt?.toDate?.() || data.signedAt,
          completedAt: data.completedAt?.toDate?.() || data.completedAt,
        };
      })
    );

    res.json({ contracts, total: contracts.length });
  } catch (error) {
    console.error('Get contracts error:', error);
    res.status(500).json({ error: 'Failed to get contracts' });
  }
});

// Get contract details
router.get('/contracts/:contractId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { contractId } = req.params;
    const db = admin.firestore();

    const contractDoc = await db.collection('contracts').doc(contractId).get();

    if (!contractDoc.exists) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const contract = contractDoc.data();

    // Get related data
    let shipper = null;
    let trucker = null;
    let cargo = null;

    try {
      if (contract.shipperId) {
        const shipperDoc = await db.collection('users').doc(contract.shipperId).get();
        if (shipperDoc.exists) {
          shipper = { id: shipperDoc.id, ...shipperDoc.data() };
        }
      }
      if (contract.truckerId) {
        const truckerDoc = await db.collection('users').doc(contract.truckerId).get();
        if (truckerDoc.exists) {
          trucker = { id: truckerDoc.id, ...truckerDoc.data() };
        }
      }
      if (contract.cargoId) {
        const cargoDoc = await db.collection('cargoListings').doc(contract.cargoId).get();
        if (cargoDoc.exists) {
          cargo = { id: cargoDoc.id, ...cargoDoc.data() };
        }
      }
    } catch (e) {
      console.error('Error getting contract details:', e);
    }

    res.json({
      contract: {
        id: contractDoc.id,
        ...contract,
        createdAt: contract.createdAt?.toDate?.() || contract.createdAt,
        signedAt: contract.signedAt?.toDate?.() || contract.signedAt,
        completedAt: contract.completedAt?.toDate?.() || contract.completedAt,
      },
      shipper,
      trucker,
      cargo,
    });
  } catch (error) {
    console.error('Get contract details error:', error);
    res.status(500).json({ error: 'Failed to get contract details' });
  }
});

// ============================================================
// SHIPMENTS ENDPOINTS
// ============================================================

// Get all shipments (contracts in transit)
router.get('/shipments', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    const db = admin.firestore();

    let query = db.collection('contracts').orderBy('createdAt', 'desc');

    if (status === 'active') {
      query = query.where('status', 'in', ['signed', 'in_transit']);
    } else if (status === 'completed') {
      query = query.where('status', '==', 'completed');
    }

    const snapshot = await query.limit(parseInt(limit)).get();

    const shipments = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data();

        // Get tracking info if available
        let tracking = null;
        try {
          const trackingDoc = await db.collection('shipmentTracking').doc(doc.id).get();
          if (trackingDoc.exists) {
            tracking = trackingDoc.data();
          }
        } catch (e) {
          // No tracking data
        }

        // Get shipper and trucker names
        let shipperName = 'Unknown';
        let truckerName = 'Unknown';

        try {
          if (data.shipperId) {
            const shipperDoc = await db.collection('users').doc(data.shipperId).get();
            if (shipperDoc.exists) {
              shipperName = shipperDoc.data().name || 'Unknown';
            }
          }
          if (data.truckerId) {
            const truckerDoc = await db.collection('users').doc(data.truckerId).get();
            if (truckerDoc.exists) {
              truckerName = truckerDoc.data().name || 'Unknown';
            }
          }
        } catch (e) {
          console.error('Error getting party names:', e);
        }

        return {
          id: doc.id,
          contractId: doc.id,
          origin: data.origin,
          destination: data.destination,
          status: data.status,
          shipperName,
          truckerName,
          agreedPrice: data.agreedPrice,
          tracking,
          createdAt: data.createdAt?.toDate?.() || data.createdAt,
          startedAt: data.startedAt?.toDate?.() || data.startedAt,
          estimatedDelivery: data.estimatedDelivery?.toDate?.() || data.estimatedDelivery,
        };
      })
    );

    res.json({ shipments, total: shipments.length });
  } catch (error) {
    console.error('Get shipments error:', error);
    res.status(500).json({ error: 'Failed to get shipments' });
  }
});

// Get active shipments for map
router.get('/shipments/active', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();

    const snapshot = await db
      .collection('contracts')
      .where('status', '==', 'in_transit')
      .get();

    const shipments = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data();

        // Get latest location from tracking
        let currentLocation = null;
        try {
          const trackingDoc = await db.collection('shipmentTracking').doc(doc.id).get();
          if (trackingDoc.exists) {
            const tracking = trackingDoc.data();
            currentLocation = tracking.currentLocation || null;
          }
        } catch (e) {
          // No tracking
        }

        return {
          id: doc.id,
          origin: data.origin,
          destination: data.destination,
          currentLocation,
          progress: data.progress || 0,
        };
      })
    );

    res.json({ shipments });
  } catch (error) {
    console.error('Get active shipments error:', error);
    res.status(500).json({ error: 'Failed to get active shipments' });
  }
});

// ============================================================
// FINANCIAL ENDPOINTS
// ============================================================

// Get financial summary
router.get('/financial/summary', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();

    // Calculate time ranges
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = admin.firestore.Timestamp.fromDate(today);

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const weekTimestamp = admin.firestore.Timestamp.fromDate(weekStart);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthTimestamp = admin.firestore.Timestamp.fromDate(monthStart);

    // Get all completed contracts
    const completedContracts = await db
      .collection('contracts')
      .where('status', '==', 'completed')
      .get();

    let totalRevenue = 0;
    let todayRevenue = 0;
    let weekRevenue = 0;
    let monthRevenue = 0;
    let totalGMV = 0;

    completedContracts.docs.forEach((doc) => {
      const data = doc.data();
      const platformFee = data.platformFee || 0;
      const agreedPrice = data.agreedPrice || 0;

      totalRevenue += platformFee;
      totalGMV += agreedPrice;

      const completedAt = data.completedAt?.toDate?.();
      if (completedAt) {
        if (completedAt >= today) {
          todayRevenue += platformFee;
        }
        if (completedAt >= weekStart) {
          weekRevenue += platformFee;
        }
        if (completedAt >= monthStart) {
          monthRevenue += platformFee;
        }
      }
    });

    // Get total wallet balances
    let totalWalletBalance = 0;
    try {
      const usersSnapshot = await db.collection('users').get();
      for (const userDoc of usersSnapshot.docs) {
        try {
          const walletDoc = await db
            .collection('users')
            .doc(userDoc.id)
            .collection('wallet')
            .doc('main')
            .get();
          if (walletDoc.exists) {
            totalWalletBalance += walletDoc.data().balance || 0;
          }
        } catch (e) {
          // Skip
        }
      }
    } catch (e) {
      console.error('Error getting wallet balances:', e);
    }

    res.json({
      revenue: {
        total: totalRevenue,
        today: todayRevenue,
        week: weekRevenue,
        month: monthRevenue,
      },
      gmv: totalGMV,
      takeRate: totalGMV > 0 ? ((totalRevenue / totalGMV) * 100).toFixed(2) : 0,
      avgTransactionValue:
        completedContracts.size > 0
          ? Math.round(totalGMV / completedContracts.size)
          : 0,
      totalWalletBalance,
      totalContracts: completedContracts.size,
    });
  } catch (error) {
    console.error('Get financial summary error:', error);
    res.status(500).json({ error: 'Failed to get financial summary' });
  }
});

// Get all transactions
router.get('/financial/transactions', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { type, limit = 50 } = req.query;
    const db = admin.firestore();

    // Get transactions from all users
    const usersSnapshot = await db.collection('users').limit(100).get();

    let allTransactions = [];

    for (const userDoc of usersSnapshot.docs) {
      try {
        let txQuery = db
          .collection('users')
          .doc(userDoc.id)
          .collection('walletTransactions')
          .orderBy('createdAt', 'desc')
          .limit(parseInt(limit));

        if (type && type !== 'all') {
          txQuery = txQuery.where('type', '==', type);
        }

        const txSnapshot = await txQuery.get();

        const userTx = txSnapshot.docs.map((doc) => ({
          id: doc.id,
          userId: userDoc.id,
          userName: userDoc.data().name || 'Unknown',
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
        }));

        allTransactions = [...allTransactions, ...userTx];
      } catch (e) {
        // Skip user with no transactions
      }
    }

    // Sort by date
    allTransactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Limit total results
    allTransactions = allTransactions.slice(0, parseInt(limit));

    res.json({ transactions: allTransactions, total: allTransactions.length });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

// ============================================================
// DISPUTES ENDPOINTS
// ============================================================

// Get all disputes
router.get('/disputes', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    const db = admin.firestore();

    let query = db.collection('disputes').orderBy('createdAt', 'desc');

    if (status && status !== 'all') {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.limit(parseInt(limit)).get();

    const disputes = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data();

        // Get contract and user info
        let contractInfo = null;
        let filedByName = 'Unknown';

        try {
          if (data.contractId) {
            const contractDoc = await db.collection('contracts').doc(data.contractId).get();
            if (contractDoc.exists) {
              contractInfo = {
                id: contractDoc.id,
                origin: contractDoc.data().origin,
                destination: contractDoc.data().destination,
              };
            }
          }
          if (data.filedBy) {
            const userDoc = await db.collection('users').doc(data.filedBy).get();
            if (userDoc.exists) {
              filedByName = userDoc.data().name || 'Unknown';
            }
          }
        } catch (e) {
          console.error('Error getting dispute details:', e);
        }

        return {
          id: doc.id,
          ...data,
          contractInfo,
          filedByName,
          createdAt: data.createdAt?.toDate?.() || data.createdAt,
          resolvedAt: data.resolvedAt?.toDate?.() || data.resolvedAt,
        };
      })
    );

    res.json({ disputes, total: disputes.length });
  } catch (error) {
    console.error('Get disputes error:', error);
    res.status(500).json({ error: 'Failed to get disputes' });
  }
});

// Get dispute details
router.get('/disputes/:disputeId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { disputeId } = req.params;
    const db = admin.firestore();

    const disputeDoc = await db.collection('disputes').doc(disputeId).get();

    if (!disputeDoc.exists) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    const dispute = disputeDoc.data();

    // Get related data
    let contract = null;
    let filedByUser = null;
    let messages = [];

    try {
      if (dispute.contractId) {
        const contractDoc = await db.collection('contracts').doc(dispute.contractId).get();
        if (contractDoc.exists) {
          contract = { id: contractDoc.id, ...contractDoc.data() };
        }
      }
      if (dispute.filedBy) {
        const userDoc = await db.collection('users').doc(dispute.filedBy).get();
        if (userDoc.exists) {
          filedByUser = { id: userDoc.id, ...userDoc.data() };
        }
      }

      // Get dispute messages/chat
      const messagesSnapshot = await db
        .collection('disputes')
        .doc(disputeId)
        .collection('messages')
        .orderBy('createdAt', 'asc')
        .get();

      messages = messagesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      }));
    } catch (e) {
      console.error('Error getting dispute details:', e);
    }

    res.json({
      dispute: {
        id: disputeDoc.id,
        ...dispute,
        createdAt: dispute.createdAt?.toDate?.() || dispute.createdAt,
        resolvedAt: dispute.resolvedAt?.toDate?.() || dispute.resolvedAt,
      },
      contract,
      filedByUser,
      messages,
    });
  } catch (error) {
    console.error('Get dispute details error:', error);
    res.status(500).json({ error: 'Failed to get dispute details' });
  }
});

// Resolve dispute
router.post('/disputes/:disputeId/resolve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { resolution, favor, notes, refundAmount } = req.body;
    const adminId = req.user.uid;
    const db = admin.firestore();

    const disputeRef = db.collection('disputes').doc(disputeId);
    const disputeDoc = await disputeRef.get();

    if (!disputeDoc.exists) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    const dispute = disputeDoc.data();

    if (dispute.status === 'resolved') {
      return res.status(400).json({ error: 'Dispute already resolved' });
    }

    const batch = db.batch();

    // Update dispute
    batch.update(disputeRef, {
      status: 'resolved',
      resolution,
      resolvedInFavorOf: favor,
      adminNotes: notes,
      refundAmount: refundAmount || 0,
      resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
      resolvedBy: adminId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update contract status
    if (dispute.contractId) {
      const contractRef = db.collection('contracts').doc(dispute.contractId);
      batch.update(contractRef, {
        disputeResolved: true,
        disputeResolution: resolution,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Notify both parties
    if (dispute.shipperId) {
      const notifRef = db.collection('users').doc(dispute.shipperId).collection('notifications').doc();
      batch.set(notifRef, {
        type: 'DISPUTE_RESOLVED',
        title: 'Dispute Resolved',
        message: resolution,
        data: { disputeId, favor },
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    if (dispute.truckerId) {
      const notifRef = db.collection('users').doc(dispute.truckerId).collection('notifications').doc();
      batch.set(notifRef, {
        type: 'DISPUTE_RESOLVED',
        title: 'Dispute Resolved',
        message: resolution,
        data: { disputeId, favor },
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();

    res.json({ success: true, message: 'Dispute resolved successfully' });
  } catch (error) {
    console.error('Resolve dispute error:', error);
    res.status(500).json({ error: 'Failed to resolve dispute' });
  }
});

// ============================================================
// REFERRAL/BROKER ENDPOINTS
// ============================================================

// Get all brokers
router.get('/referrals/brokers', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { tier, status, limit = 50 } = req.query;
    const db = admin.firestore();

    let query = db.collection('brokers').orderBy('createdAt', 'desc');

    if (tier && tier !== 'all') {
      query = query.where('tier', '==', tier);
    }

    if (status && status !== 'all') {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.limit(parseInt(limit)).get();

    const brokers = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data();

        // Get user info
        let userInfo = null;
        try {
          const userDoc = await db.collection('users').doc(data.userId).get();
          if (userDoc.exists) {
            userInfo = {
              name: userDoc.data().name,
              email: userDoc.data().email,
              phone: userDoc.data().phone,
            };
          }
        } catch (e) {
          // Skip
        }

        return {
          id: doc.id,
          ...data,
          userInfo,
          createdAt: data.createdAt?.toDate?.() || data.createdAt,
        };
      })
    );

    res.json({ brokers, total: brokers.length });
  } catch (error) {
    console.error('Get brokers error:', error);
    res.status(500).json({ error: 'Failed to get brokers' });
  }
});

// Update broker tier
router.post('/referrals/:brokerId/tier', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { brokerId } = req.params;
    const { tier } = req.body;
    const adminId = req.user.uid;
    const db = admin.firestore();

    const brokerRef = db.collection('brokers').doc(brokerId);
    const brokerDoc = await brokerRef.get();

    if (!brokerDoc.exists) {
      return res.status(404).json({ error: 'Broker not found' });
    }

    await brokerRef.update({
      tier,
      tierUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      tierUpdatedBy: adminId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Notify broker
    const broker = brokerDoc.data();
    await db.collection('users').doc(broker.userId).collection('notifications').add({
      type: 'BROKER_STATUS',
      title: 'Tier Updated',
      message: `Your broker tier has been updated to ${tier}.`,
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true, message: 'Broker tier updated successfully' });
  } catch (error) {
    console.error('Update broker tier error:', error);
    res.status(500).json({ error: 'Failed to update broker tier' });
  }
});

// ============================================================
// RATINGS ENDPOINTS
// ============================================================

// Get all ratings
router.get('/ratings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { score, flagged, limit = 50 } = req.query;
    const db = admin.firestore();

    let query = db.collection('ratings').orderBy('createdAt', 'desc');

    if (score && score !== 'all') {
      query = query.where('score', '==', parseInt(score));
    }

    if (flagged === 'true') {
      query = query.where('isFlagged', '==', true);
    }

    const snapshot = await query.limit(parseInt(limit)).get();

    const ratings = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data();

        // Get user names
        let raterName = 'Unknown';
        let rateeName = 'Unknown';

        try {
          if (data.raterId) {
            const raterDoc = await db.collection('users').doc(data.raterId).get();
            if (raterDoc.exists) {
              raterName = raterDoc.data().name || 'Unknown';
            }
          }
          if (data.rateeId) {
            const rateeDoc = await db.collection('users').doc(data.rateeId).get();
            if (rateeDoc.exists) {
              rateeName = rateeDoc.data().name || 'Unknown';
            }
          }
        } catch (e) {
          console.error('Error getting user names:', e);
        }

        return {
          id: doc.id,
          ...data,
          raterName,
          rateeName,
          createdAt: data.createdAt?.toDate?.() || data.createdAt,
        };
      })
    );

    res.json({ ratings, total: ratings.length });
  } catch (error) {
    console.error('Get ratings error:', error);
    res.status(500).json({ error: 'Failed to get ratings' });
  }
});

// Delete rating
router.delete('/ratings/:ratingId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { ratingId } = req.params;
    const { reason } = req.body;
    const adminId = req.user.uid;
    const db = admin.firestore();

    const ratingRef = db.collection('ratings').doc(ratingId);
    const ratingDoc = await ratingRef.get();

    if (!ratingDoc.exists) {
      return res.status(404).json({ error: 'Rating not found' });
    }

    const rating = ratingDoc.data();

    // Archive instead of hard delete
    await db.collection('archivedRatings').doc(ratingId).set({
      ...rating,
      deletedAt: admin.firestore.FieldValue.serverTimestamp(),
      deletedBy: adminId,
      deleteReason: reason || 'Administrative action',
    });

    // Delete original
    await ratingRef.delete();

    // Update ratee's average rating
    if (rating.rateeId) {
      try {
        const remainingRatings = await db
          .collection('ratings')
          .where('rateeId', '==', rating.rateeId)
          .get();

        if (remainingRatings.size > 0) {
          const totalScore = remainingRatings.docs.reduce((sum, doc) => sum + (doc.data().score || 0), 0);
          const avgRating = totalScore / remainingRatings.size;

          await db.collection('users').doc(rating.rateeId).update({
            averageRating: avgRating,
            totalRatings: remainingRatings.size,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } else {
          await db.collection('users').doc(rating.rateeId).update({
            averageRating: 0,
            totalRatings: 0,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      } catch (e) {
        console.error('Error updating user rating:', e);
      }
    }

    res.json({ success: true, message: 'Rating deleted successfully' });
  } catch (error) {
    console.error('Delete rating error:', error);
    res.status(500).json({ error: 'Failed to delete rating' });
  }
});

// ============================================================
// SETTINGS ENDPOINTS
// ============================================================

// Get platform settings
router.get('/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();

    const settingsDoc = await db.collection('settings').doc('platform').get();

    if (!settingsDoc.exists) {
      // Return defaults
      return res.json({
        settings: {
          platformFeePercentage: 5,
          minimumFee: 50,
          maximumFee: 5000,
          gcashNumber: '',
          gcashName: '',
          referralCommission: {
            starter: 3,
            silver: 4,
            gold: 5,
            platinum: 6,
          },
          features: {
            paymentVerification: true,
            referralProgram: true,
            autoApprove: false,
            maintenanceMode: false,
          },
        },
      });
    }

    res.json({ settings: settingsDoc.data() });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// Update platform settings
router.put('/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { settings } = req.body;
    const adminId = req.user.uid;
    const db = admin.firestore();

    await db.collection('settings').doc('platform').set(
      {
        ...settings,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: adminId,
      },
      { merge: true }
    );

    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
