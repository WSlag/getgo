const { FieldValue } = require('firebase-admin/firestore');

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

async function accrueBrokerCommissionForPlatformFee({
  db,
  feeId,
  fee,
  settings = null,
  source = 'platform_fee',
  createNotification = true,
}) {
  const normalizedFee = fee || {};
  const referredUserId = String(normalizedFee.userId || '').trim();
  const platformFeeAmount = Number(normalizedFee.amount || 0);

  const outcome = {
    status: 'skipped',
    reason: 'unknown',
    feeId,
    referredUserId: referredUserId || null,
    brokerId: null,
    commissionAmount: 0,
    commissionRate: 0,
  };

  if (normalizedFee.status !== 'completed') {
    outcome.reason = 'fee_not_completed';
    return outcome;
  }
  if (!referredUserId || platformFeeAmount <= 0) {
    outcome.reason = 'invalid_fee_payload';
    return outcome;
  }

  const referralRef = db.collection('brokerReferrals').doc(referredUserId);
  const settingsRef = db.collection('settings').doc('platform');
  const now = FieldValue.serverTimestamp();
  let created = false;

  await db.runTransaction(async (tx) => {
    const commissionRef = db.collection('brokerCommissions').doc(feeId);
    const existingCommission = await tx.get(commissionRef);
    if (existingCommission.exists) {
      outcome.reason = 'commission_already_exists';
      return;
    }

    const referralDoc = await tx.get(referralRef);
    if (!referralDoc.exists) {
      outcome.reason = 'referral_not_found';
      return;
    }
    const referral = referralDoc.data() || {};
    const brokerId = String(referral.brokerId || '').trim();
    if (!brokerId) {
      outcome.reason = 'broker_id_missing';
      return;
    }
    outcome.brokerId = brokerId;

    const brokerRef = db.collection('brokers').doc(brokerId);
    const brokerProfileRef = db.collection('users').doc(brokerId).collection('brokerProfile').doc('profile');
    const brokerDoc = await tx.get(brokerRef);
    if (!brokerDoc.exists) {
      outcome.reason = 'broker_not_found';
      return;
    }
    const broker = brokerDoc.data() || {};
    if (broker.status && broker.status !== 'active') {
      outcome.reason = 'broker_inactive';
      return;
    }

    let settingsForRate = settings;
    if (!settingsForRate) {
      const settingsDoc = await tx.get(settingsRef);
      settingsForRate = settingsDoc.exists ? (settingsDoc.data() || {}) : null;
    }

    const commissionRate = resolveTierRate(broker.tier, settingsForRate);
    const commissionAmount = roundToCents(platformFeeAmount * (commissionRate / 100));
    if (commissionAmount <= 0) {
      outcome.reason = 'non_positive_commission';
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
      contractId: normalizedFee.contractId || null,
      bidId: normalizedFee.bidId || null,
      status: 'accrued',
      source,
      createdAt: now,
      updatedAt: now,
    });

    tx.update(brokerRef, {
      totalEarnings: FieldValue.increment(commissionAmount),
      availableBalance: FieldValue.increment(commissionAmount),
      totalTransactions: FieldValue.increment(1),
      updatedAt: now,
    });

    tx.set(brokerProfileRef, {
      totalEarnings: FieldValue.increment(commissionAmount),
      availableBalance: FieldValue.increment(commissionAmount),
      totalTransactions: FieldValue.increment(1),
      updatedAt: now,
    }, { merge: true });

    tx.update(referralRef, {
      status: 'qualified',
      totalQualifiedFees: FieldValue.increment(platformFeeAmount),
      totalCommission: FieldValue.increment(commissionAmount),
      totalTransactions: FieldValue.increment(1),
      lastQualifiedAt: now,
      updatedAt: now,
    });

    created = true;
    outcome.status = 'created';
    outcome.reason = 'created';
    outcome.commissionAmount = commissionAmount;
    outcome.commissionRate = commissionRate;
  });

  if (created && createNotification && outcome.brokerId) {
    await db.collection('users').doc(outcome.brokerId).collection('notifications').add({
      type: 'BROKER_COMMISSION_EARNED',
      title: 'Commission Earned',
      message: `You earned PHP ${outcome.commissionAmount.toLocaleString()} from a referred transaction.`,
      data: {
        platformFeeId: feeId,
        referredUserId,
        contractId: normalizedFee.contractId || null,
        platformFeeAmount,
        commissionRate: outcome.commissionRate,
        commissionAmount: outcome.commissionAmount,
      },
      isRead: false,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  return outcome;
}

module.exports = {
  DEFAULT_REFERRAL_RATES,
  roundToCents,
  resolveTierRate,
  accrueBrokerCommissionForPlatformFee,
};
