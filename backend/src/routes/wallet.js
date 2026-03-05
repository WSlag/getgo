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
import { Wallet, WalletTransaction, User, Bid, CargoListing, TruckListing } from '../models/index.js';
import { authenticateToken } from '../middleware/auth.js';
import admin from '../config/firebase-admin.js';

const PLATFORM_FEE_RATE = parseFloat(process.env.PLATFORM_FEE_RATE) || 0.05;

// GCash configuration for screenshot verification
const GCASH_CONFIG = {
  accountNumber: process.env.GCASH_ACCOUNT_NUMBER || '09171234567',
  accountName: process.env.GCASH_ACCOUNT_NAME || 'KARGA CONNECT',
  qrCodeUrl: process.env.GCASH_QR_URL || null,
  maxDailyTopup: 50000,
  maxDailySubmissions: 5,
  orderExpiryMinutes: 30,
};

const router = Router();

// Payment methods configuration
const paymentMethods = {
  gcash: { name: 'GCash', fee: 0 },
  maya: { name: 'Maya', fee: 0 },
  grabpay: { name: 'GrabPay', fee: 0 },
  bank: { name: 'Bank Transfer', fee: 0 },
  seveneleven: { name: '7-Eleven', fee: 15 },
  cebuana: { name: 'Cebuana', fee: 25 },
};

// DEPRECATED ROUTES - Wallet functionality removed
/* WALLET DEPRECATED
// Get wallet balance and transactions
router.get('/', authenticateToken, async (req, res) => {
  try {
    let wallet = await Wallet.findOne({
      where: { userId: req.user.id },
      include: [
        {
          model: WalletTransaction,
          as: 'transactions',
          order: [['createdAt', 'DESC']],
          limit: 50,
        },
      ],
    });

    // Create wallet if doesn't exist
    if (!wallet) {
      wallet = await Wallet.create({ userId: req.user.id, balance: 0 });
    }

    res.json({
      wallet: {
        id: wallet.id,
        balance: parseFloat(wallet.balance),
        transactions: wallet.transactions || [],
      },
    });
  } catch (error) {
    console.error('Get wallet error:', error);
    res.status(500).json({ error: 'Failed to get wallet' });
  }
});

// Get wallet transactions
router.get('/transactions', authenticateToken, async (req, res) => {
  try {
    const { limit = 50, offset = 0, type } = req.query;

    const wallet = await Wallet.findOne({ where: { userId: req.user.id } });
    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    const where = { walletId: wallet.id };
    if (type) where.type = type;

    const transactions = await WalletTransaction.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json({
      transactions: transactions.rows,
      total: transactions.count,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

// Top up wallet (Mock payment)
router.post('/topup', authenticateToken, async (req, res) => {
  try {
    const { amount, method = 'gcash' } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    if (!paymentMethods[method]) {
      return res.status(400).json({ error: 'Invalid payment method' });
    }

    let wallet = await Wallet.findOne({ where: { userId: req.user.id } });
    if (!wallet) {
      wallet = await Wallet.create({ userId: req.user.id, balance: 0 });
    }

    const fee = paymentMethods[method].fee;
    const netAmount = amount - fee;

    // Simulate payment processing (in production, integrate with actual payment gateway)
    // For demo, we'll automatically approve the top-up

    // Generate reference number
    const prefix = method.toUpperCase().substring(0, 2);
    const reference = `${prefix}-${Date.now().toString().slice(-8)}`;

    // Update wallet balance
    await wallet.update({ balance: parseFloat(wallet.balance) + netAmount });

    // Create transaction record
    const transaction = await WalletTransaction.create({
      walletId: wallet.id,
      type: 'topup',
      amount: netAmount,
      method: paymentMethods[method].name,
      description: `Top-up via ${paymentMethods[method].name}`,
      reference,
      status: 'completed',
    });

    // If there was a fee, create a fee transaction
    if (fee > 0) {
      await WalletTransaction.create({
        walletId: wallet.id,
        type: 'fee',
        amount: -fee,
        description: `${paymentMethods[method].name} processing fee`,
        reference,
        status: 'completed',
      });
    }

    res.json({
      message: 'Top-up successful',
      transaction,
      newBalance: parseFloat(wallet.balance),
      fee,
    });
  } catch (error) {
    console.error('Top up error:', error);
    res.status(500).json({ error: 'Top-up failed' });
  }
});

// Request payout
router.post('/payout', authenticateToken, async (req, res) => {
  try {
    const { amount, method = 'gcash', accountDetails } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    const wallet = await Wallet.findOne({ where: { userId: req.user.id } });
    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    if (parseFloat(wallet.balance) < amount) {
      return res.status(400).json({
        error: 'Insufficient balance',
        currentBalance: parseFloat(wallet.balance),
        requestedAmount: amount,
      });
    }

    // Generate reference number
    const prefix = 'PO';
    const reference = `${prefix}-${Date.now().toString().slice(-8)}`;

    // Update wallet balance
    await wallet.update({ balance: parseFloat(wallet.balance) - amount });

    // Create payout transaction
    const transaction = await WalletTransaction.create({
      walletId: wallet.id,
      type: 'payout',
      amount: -amount,
      method: paymentMethods[method]?.name || method,
      description: `Payout to ${paymentMethods[method]?.name || method}`,
      reference,
      status: 'completed', // In production, this would be 'pending' until verified
    });

    res.json({
      message: 'Payout processed successfully',
      transaction,
      newBalance: parseFloat(wallet.balance),
    });
  } catch (error) {
    console.error('Payout error:', error);
    res.status(500).json({ error: 'Payout failed' });
  }
});

// Deduct platform fee (internal use)
router.post('/deduct-fee', authenticateToken, async (req, res) => {
  try {
    const { amount, description, contractId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    const wallet = await Wallet.findOne({ where: { userId: req.user.id } });
    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    if (parseFloat(wallet.balance) < amount) {
      return res.status(400).json({
        error: 'Insufficient balance for platform fee',
        currentBalance: parseFloat(wallet.balance),
        requiredFee: amount,
      });
    }

    // Update wallet balance
    await wallet.update({ balance: parseFloat(wallet.balance) - amount });

    // Create fee transaction
    const transaction = await WalletTransaction.create({
      walletId: wallet.id,
      type: 'fee',
      amount: -amount,
      description: description || 'Platform fee',
      reference: contractId || `FEE-${Date.now()}`,
      status: 'completed',
    });

    res.json({
      message: 'Fee deducted successfully',
      transaction,
      newBalance: parseFloat(wallet.balance),
    });
  } catch (error) {
    console.error('Deduct fee error:', error);
    res.status(500).json({ error: 'Fee deduction failed' });
  }
});

// Get payment methods
router.get('/payment-methods', (req, res) => {
  res.json({ paymentMethods });
});

// Pay platform fee for contract creation
router.post('/pay-platform-fee', authenticateToken, async (req, res) => {
  try {
    const { bidId, amount } = req.body;
    const userId = req.user.uid;

    if (!bidId) {
      return res.status(400).json({ error: 'Bid ID is required' });
    }

    const db = admin.firestore();

    // Validate bid exists in Firestore and is accepted
    const bidDoc = await db.collection('bids').doc(bidId).get();
    if (!bidDoc.exists) {
      return res.status(404).json({ error: 'Bid not found' });
    }

    const bid = { id: bidDoc.id, ...bidDoc.data() };

    if (bid.status !== 'accepted') {
      return res.status(400).json({ error: 'Bid must be accepted before paying platform fee' });
    }

    // Verify the user is the listing owner
    if (bid.listingOwnerId !== userId) {
      return res.status(403).json({ error: 'Only the listing owner can pay the platform fee' });
    }

    // Calculate expected fee
    const expectedFee = Math.round(bid.price * PLATFORM_FEE_RATE);
    const feeAmount = amount || expectedFee;

    // Check if fee already paid for this bid in Firestore
    const existingFeeSnap = await db.collection('platformFees')
      .where('bidId', '==', bidId)
      .where('status', '==', 'completed')
      .limit(1)
      .get();

    if (!existingFeeSnap.empty) {
      return res.status(400).json({
        error: 'Platform fee already paid for this bid',
        transactionId: existingFeeSnap.docs[0].id,
      });
    }

    // Get wallet balance from Firestore
    const walletRef = db.doc(`users/${userId}/wallet/main`);
    const walletSnap = await walletRef.get();
    const currentBalance = walletSnap.exists ? (walletSnap.data().balance || 0) : 0;

    // Check sufficient balance
    if (currentBalance < feeAmount) {
      return res.status(400).json({
        error: 'Insufficient wallet balance',
        currentBalance,
        requiredFee: feeAmount,
        shortfall: feeAmount - currentBalance,
      });
    }

    // Deduct from Firestore wallet
    const newBalance = currentBalance - feeAmount;
    await walletRef.set({
      balance: newBalance,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // Record fee transaction in Firestore wallet transactions
    const txRef = db.collection(`users/${userId}/walletTransactions`).doc();
    await txRef.set({
      type: 'fee',
      amount: -feeAmount,
      method: 'wallet',
      description: `Platform fee for contract (${bid.origin} → ${bid.destination})`,
      reference: bidId,
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      status: 'completed',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Record in platformFees collection for tracking
    await db.collection('platformFees').doc().set({
      bidId,
      userId,
      amount: feeAmount,
      status: 'completed',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({
      message: 'Platform fee paid successfully',
      transactionId: txRef.id,
      newBalance,
      bidId,
      feeAmount,
    });
  } catch (error) {
    console.error('Pay platform fee error:', error);
    res.status(500).json({ error: 'Failed to process platform fee payment' });
  }
});

// Check if platform fee is paid for a bid
router.get('/fee-status/:bidId', authenticateToken, async (req, res) => {
  try {
    const { bidId } = req.params;

    const feeTransaction = await WalletTransaction.findOne({
      where: {
        reference: bidId,
        type: 'fee',
        status: 'completed',
      },
    });

    res.json({
      paid: !!feeTransaction,
      transaction: feeTransaction,
    });
  } catch (error) {
    console.error('Check fee status error:', error);
    res.status(500).json({ error: 'Failed to check fee status' });
  }
});
END WALLET DEPRECATED */

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
  res.json({
    accountName: GCASH_CONFIG.accountName,
    accountNumber: maskPhoneNumber(GCASH_CONFIG.accountNumber),
    qrCodeUrl: GCASH_CONFIG.qrCodeUrl,
    maxDailyTopup: GCASH_CONFIG.maxDailyTopup,
    orderExpiryMinutes: GCASH_CONFIG.orderExpiryMinutes,
  });
});

export default router;
