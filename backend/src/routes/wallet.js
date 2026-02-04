import { Router } from 'express';
import { Wallet, WalletTransaction, User } from '../models/index.js';
import { authenticateToken } from '../middleware/auth.js';

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

export default router;
