/**
 * Wallet Routes
 *
 * NOTE: Most wallet functionality has been REMOVED in favor of direct GCash payment.
 * Platform fees are now paid via GCash screenshot upload instead of wallet deduction.
 *
 * DEPRECATED ROUTES (commented out below):
 * - GET / - Get wallet balance
 * - GET /transactions - Get wallet transactions
 * - POST /topup - Wallet top-up
 * - POST /payout - Wallet payout
 * - POST /pay-platform-fee - Wallet-based platform fee payment
 * - GET /fee-status/:bidId - Platform fee status
 * - GET /payment-methods - Payment methods list
 *
 * ACTIVE ROUTES (kept for GCash order management):
 * - GET /order/:orderId - Get order details
 * - GET /pending-orders - Get user's pending orders
 * - GET /gcash-config - Get GCash configuration
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import admin from '../config/firebase-admin.js';

const hasGcashConfig = !!(process.env.GCASH_ACCOUNT_NUMBER && process.env.GCASH_ACCOUNT_NAME);

const GCASH_CONFIG = {
  accountNumber: process.env.GCASH_ACCOUNT_NUMBER,
  accountName: process.env.GCASH_ACCOUNT_NAME,
  qrCodeUrl: process.env.GCASH_QR_URL || null,
  maxDailyTopup: 50000,
  maxDailySubmissions: 5,
  orderExpiryMinutes: 30,
};

const router = Router();



// ============================================================
// GCASH SCREENSHOT VERIFICATION ENDPOINTS (ACTIVE)
// ============================================================

// Helper: Generate unique order ID
const generateOrderId = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${timestamp}-${random}`;
};

// Helper: Mask phone number for display
const maskPhoneNumber = (phone) => {
  if (!phone || phone.length < 7) return phone;
  return phone.slice(0, 4) + '****' + phone.slice(-3);
};

// Create a top-up order for GCash screenshot verification
router.post('/create-topup-order', authenticateToken, async (req, res) => {
  try {
    if (!hasGcashConfig) {
      return res.status(503).json({ error: 'GCash payment settings are not configured' });
    }

    const { amount } = req.body;
    const userId = req.user.uid || req.user.id;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    if (amount > GCASH_CONFIG.maxDailyTopup) {
      return res.status(400).json({
        error: `Maximum top-up amount is ₱${GCASH_CONFIG.maxDailyTopup.toLocaleString()}`,
      });
    }

    // Check if Firebase Admin is available
    const db = admin.firestore?.();
    if (!db) {
      return res.status(500).json({ error: 'Firebase not configured' });
    }

    // Check daily submission limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayOrdersSnapshot = await db
      .collection('orders')
      .where('userId', '==', userId)
      .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(today))
      .get();

    if (todayOrdersSnapshot.size >= GCASH_CONFIG.maxDailySubmissions) {
      return res.status(429).json({
        error: `Daily limit reached. Maximum ${GCASH_CONFIG.maxDailySubmissions} top-up attempts per day.`,
      });
    }

    // Create order in Firestore
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

    res.json({
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
    });
  } catch (error) {
    console.error('Create top-up order error:', error);
    res.status(500).json({ error: 'Failed to create top-up order' });
  }
});

// Get order status
router.get('/order/:orderId', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.uid || req.user.id;

    const db = admin.firestore?.();
    if (!db) {
      return res.status(500).json({ error: 'Firebase not configured' });
    }

    const orderDoc = await db.collection('orders').doc(orderId).get();

    if (!orderDoc.exists) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderDoc.data();

    // Verify ownership
    if (order.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to view this order' });
    }

    // Get latest submission for this order
    const submissionsSnapshot = await db
      .collection('paymentSubmissions')
      .where('orderId', '==', orderId)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    let latestSubmission = null;
    if (!submissionsSnapshot.empty) {
      const subDoc = submissionsSnapshot.docs[0];
      latestSubmission = { id: subDoc.id, ...subDoc.data() };
    }

    res.json({
      order: {
        ...order,
        createdAt: order.createdAt?.toDate?.() || order.createdAt,
        expiresAt: order.expiresAt?.toDate?.() || order.expiresAt,
        updatedAt: order.updatedAt?.toDate?.() || order.updatedAt,
      },
      latestSubmission,
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Failed to get order' });
  }
});

// Get user's pending orders
router.get('/pending-orders', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid || req.user.id;

    const db = admin.firestore?.();
    if (!db) {
      return res.status(500).json({ error: 'Firebase not configured' });
    }

    const ordersSnapshot = await db
      .collection('orders')
      .where('userId', '==', userId)
      .where('status', 'in', ['awaiting_upload', 'processing'])
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    const orders = ordersSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      expiresAt: doc.data().expiresAt?.toDate?.() || doc.data().expiresAt,
    }));

    res.json({ orders });
  } catch (error) {
    console.error('Get pending orders error:', error);
    res.status(500).json({ error: 'Failed to get pending orders' });
  }
});

// Get GCash configuration (public info only)
router.get('/gcash-config', authenticateToken, (req, res) => {
  if (!hasGcashConfig) {
    return res.status(503).json({ error: 'GCash payment settings are not configured' });
  }

  res.json({
    accountName: GCASH_CONFIG.accountName,
    accountNumber: maskPhoneNumber(GCASH_CONFIG.accountNumber),
    qrCodeUrl: GCASH_CONFIG.qrCodeUrl,
    maxDailyTopup: GCASH_CONFIG.maxDailyTopup,
    orderExpiryMinutes: GCASH_CONFIG.orderExpiryMinutes,
  });
});

export default router;
