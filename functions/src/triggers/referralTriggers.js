/**
 * Referral / Commission Firestore triggers
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const { loadPlatformSettings } = require('../config/platformSettings');
const {
  accrueBrokerCommissionForPlatformFee,
} = require('../services/brokerCommissionService');

const REGION = 'asia-southeast1';

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
    const feeId = event.params.feeId;
    const fee = snap.data() || {};
    const runtimeSettings = await loadPlatformSettings(db);

    if (runtimeSettings?.features?.referralProgramEnabled === false) {
      console.info('[broker-commission]', {
        event: 'trigger_skip',
        reason: 'referral_program_disabled',
        feeId,
      });
      return null;
    }

    const outcome = await accrueBrokerCommissionForPlatformFee({
      db,
      feeId,
      fee,
      settings: runtimeSettings,
      source: 'platform_fee',
      createNotification: true,
    });

    console.info('[broker-commission]', {
      event: outcome.status === 'created' ? 'trigger_created' : 'trigger_skipped',
      feeId,
      brokerId: outcome.brokerId || null,
      referredUserId: outcome.referredUserId || null,
      status: outcome.status,
      reason: outcome.reason,
      commissionAmount: outcome.commissionAmount || 0,
      commissionRate: outcome.commissionRate || 0,
    });

    return null;
  }
);
