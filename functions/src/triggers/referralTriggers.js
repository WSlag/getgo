/**
 * Referral / Commission Firestore triggers
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const { loadPlatformSettings } = require('../config/platformSettings');

const REGION = 'asia-southeast1';
const DEFAULT_REFERRAL_RATES = {
  STARTER: 3,
  SILVER: 4,
  GOLD: 5,
  PLATINUM: 6,
};

function roundToCents(value) {
  const n = Number(value || 0);
  return Math.round(n * 100) / 100;
}

function resolveTierRate(tier, settings) {
  const normalizedTier = String(tier || 'STARTER').toUpperCase();
  const rates = settings?.referralCommission || {};
  const fromSettings =
    rates[normalizedTier] ??
    rates[normalizedTier.toLowerCase()] ??
    rates[(normalizedTier.charAt(0) + normalizedTier.slice(1).toLowerCase())];
  const fallback = DEFAULT_REFERRAL_RATES[normalizedTier] || DEFAULT_REFERRAL_RATES.STARTER;
  const parsed = Number(fromSettings);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Create broker commission when a platform fee is recorded as completed.
 * Commission base: paid platform fee amount.
 */
exports.onPlatformFeeCompleted = onDocumentCreated(
  {
    region: REGION,
    document: 'platformFees/{feeId}',
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return null;
    const db = admin.firestore();
    const runtimeSettings = await loadPlatformSettings(db);
    if (runtimeSettings?.features?.referralProgramEnabled === false) {
      return null;
    }
    const feeId = event.params.feeId;
    const fee = snap.data() || {};

    if (fee.status !== 'completed') {
      return null;
    }

    const referredUserId = fee.userId;
    const platformFeeAmount = Number(fee.amount || 0);
    if (!referredUserId || platformFeeAmount <= 0) {
      return null;
    }

    const referralRef = db.collection('brokerReferrals').doc(referredUserId);
    const referralDoc = await referralRef.get();
    if (!referralDoc.exists) {
      return null;
    }

    const referral = referralDoc.data() || {};
    const brokerId = referral.brokerId;
    if (!brokerId) {
      return null;
    }

    const brokerRef = db.collection('brokers').doc(brokerId);
    const brokerProfileRef = db.collection('users').doc(brokerId).collection('brokerProfile').doc('profile');
    const commissionRef = db.collection('brokerCommissions').doc(feeId);
    const now = admin.firestore.FieldValue.serverTimestamp();

    let commissionAmount = 0;
    let commissionRate = 0;

    await db.runTransaction(async (tx) => {
      const [existingCommission, brokerDoc, settingsDoc] = await Promise.all([
        tx.get(commissionRef),
        tx.get(brokerRef),
        tx.get(db.collection('settings').doc('platform')),
      ]);

      if (existingCommission.exists) {
        return;
      }
      if (!brokerDoc.exists) {
        return;
      }

      const broker = brokerDoc.data() || {};
      if (broker.status && broker.status !== 'active') {
        return;
      }

      commissionRate = resolveTierRate(broker.tier, settingsDoc.exists ? settingsDoc.data() : null);
      commissionAmount = roundToCents(platformFeeAmount * (commissionRate / 100));
      if (commissionAmount <= 0) {
        return;
      }

      tx.set(commissionRef, {
        brokerId,
        referredUserId,
        referralCode: referral.brokerCode || null,
        platformFeeId: feeId,
        platformFeeAmount,
        commissionRate,
        commissionAmount,
        contractId: fee.contractId || null,
        bidId: fee.bidId || null,
        status: 'accrued',
        source: 'platform_fee',
        createdAt: now,
        updatedAt: now,
      });

      tx.update(brokerRef, {
        totalEarnings: admin.firestore.FieldValue.increment(commissionAmount),
        availableBalance: admin.firestore.FieldValue.increment(commissionAmount),
        totalTransactions: admin.firestore.FieldValue.increment(1),
        updatedAt: now,
      });

      tx.set(brokerProfileRef, {
        totalEarnings: admin.firestore.FieldValue.increment(commissionAmount),
        availableBalance: admin.firestore.FieldValue.increment(commissionAmount),
        totalTransactions: admin.firestore.FieldValue.increment(1),
        updatedAt: now,
      }, { merge: true });

      tx.update(referralRef, {
        status: 'qualified',
        totalQualifiedFees: admin.firestore.FieldValue.increment(platformFeeAmount),
        totalCommission: admin.firestore.FieldValue.increment(commissionAmount),
        totalTransactions: admin.firestore.FieldValue.increment(1),
        lastQualifiedAt: now,
        updatedAt: now,
      });
    });

    if (commissionAmount > 0) {
      await db.collection('users').doc(brokerId).collection('notifications').add({
        type: 'BROKER_COMMISSION_EARNED',
        title: 'Commission Earned',
        message: `You earned PHP ${commissionAmount.toLocaleString()} from a referred transaction.`,
        data: {
          platformFeeId: feeId,
          referredUserId,
          contractId: fee.contractId || null,
          platformFeeAmount,
          commissionRate,
          commissionAmount,
        },
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    return null;
  }
);
