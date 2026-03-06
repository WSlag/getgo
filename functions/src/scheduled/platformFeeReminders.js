/**
 * Platform Fee Reminder System
 * Runs daily at 9 AM Manila time (UTC+8)
 * Sends due/overdue reminders and action-restriction alerts for unpaid fees.
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const PLATFORM_FEE_DEBT_CAP = Number(process.env.PLATFORM_FEE_DEBT_CAP || 15000);

const REMINDER_STAGES = Object.freeze({
  DUE_24H: 'due_24h',
  OVERDUE_DAY_1: 'overdue_day_1',
  OVERDUE_DAY_2: 'overdue_day_2',
  OVERDUE_DAY_3: 'overdue_day_3',
  CAP_RESTRICTION_NOTICE: 'cap_restriction_notice',
});

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function formatCurrency(amount) {
  return `PHP ${Number(amount || 0).toLocaleString('en-PH')}`;
}

function formatDueDate(date) {
  if (!(date instanceof Date)) return '---';
  return date.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getReminderStages(contract) {
  if (!Array.isArray(contract?.platformFeeReminders)) return new Set();
  return new Set(contract.platformFeeReminders.map((value) => String(value || '').trim()).filter(Boolean));
}

function notificationId(contractId, stage) {
  return `platform_fee_${contractId}_${stage}`;
}

exports.sendPlatformFeeReminders = onSchedule(
  {
    region: 'asia-southeast1',
    schedule: '0 9 * * *',
    timeZone: 'Asia/Manila',
  },
  async () => {
    const db = admin.firestore();
    const now = new Date();

    const settingsDoc = await db.collection('settings').doc('platform').get();
    const remindersEnabled = settingsDoc.data()?.features?.platformFeeReminderNotificationsEnabled;
    if (remindersEnabled === false) {
      console.log('Platform fee reminder notifications disabled by settings flag.');
      return null;
    }

    const unpaidContracts = await db.collection('contracts')
      .where('platformFeePaid', '==', false)
      .get();

    for (const doc of unpaidContracts.docs) {
      try {
        const contract = { id: doc.id, ...doc.data() };
        const payerId = contract.platformFeePayerId;

        if (
          !payerId ||
          contract.status === 'cancelled' ||
          contract.status === 'draft' ||
          contract.platformFeeStatus === 'waived'
        ) {
          continue;
        }

        const billingStartedAt = toDate(contract.platformFeeBillingStartedAt);
        if (!billingStartedAt) {
          continue;
        }

        const dueDate = toDate(contract.platformFeeDueDate) || (() => {
          const derivedDueDate = new Date(billingStartedAt);
          derivedDueDate.setDate(derivedDueDate.getDate() + 3);
          return derivedDueDate;
        })();

        const reminderStages = getReminderStages(contract);
        const stagesToPersist = [];
        const contractUpdates = {};

        const msUntilDue = dueDate.getTime() - now.getTime();
        const hoursUntilDue = msUntilDue / MS_PER_HOUR;
        const isOverdue = msUntilDue <= 0;
        const overdueDays = isOverdue
          ? Math.floor(Math.abs(msUntilDue) / MS_PER_DAY) + 1
          : 0;

        if (
          !isOverdue &&
          hoursUntilDue <= 24 &&
          !reminderStages.has(REMINDER_STAGES.DUE_24H)
        ) {
          await db.collection(`users/${payerId}/notifications`)
            .doc(notificationId(contract.id, REMINDER_STAGES.DUE_24H))
            .set({
              type: 'PLATFORM_FEE_DUE',
              title: 'Platform Fee Payment Due',
              message: `Contract #${contract.contractNumber} has an unpaid platform fee of ${formatCurrency(contract.platformFee)}. Please pay on or before ${formatDueDate(dueDate)} to avoid action restrictions when debt reaches PHP 15,000.`,
              data: {
                contractId: contract.id,
                platformFee: contract.platformFee,
                dueDate: dueDate.toISOString(),
                actionRequired: 'PAY_PLATFORM_FEE',
                reminderStage: REMINDER_STAGES.DUE_24H,
              },
              isRead: false,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
          stagesToPersist.push(REMINDER_STAGES.DUE_24H);
        }

        if (isOverdue) {
          if (contract.platformFeeStatus !== 'overdue') {
            contractUpdates.platformFeeStatus = 'overdue';
            contractUpdates.overdueAt = admin.firestore.FieldValue.serverTimestamp();
          }

          const overdueStage = overdueDays >= 3
            ? REMINDER_STAGES.OVERDUE_DAY_3
            : overdueDays === 2
              ? REMINDER_STAGES.OVERDUE_DAY_2
              : REMINDER_STAGES.OVERDUE_DAY_1;

          if (!reminderStages.has(overdueStage)) {
            const isFinalWarning = overdueStage === REMINDER_STAGES.OVERDUE_DAY_3;
            await db.collection(`users/${payerId}/notifications`)
              .doc(notificationId(contract.id, overdueStage))
              .set({
                type: 'PLATFORM_FEE_OVERDUE',
                title: isFinalWarning ? 'Final Reminder: Action Restriction Risk' : 'Platform Fee Overdue',
                message: isFinalWarning
                  ? `Contract #${contract.contractNumber} platform fee remains unpaid after 3 days. Pay ${formatCurrency(contract.platformFee)} immediately to avoid new-job restrictions once debt reaches PHP 15,000.`
                  : `Your platform fee for Contract #${contract.contractNumber} is overdue by ${overdueDays} day(s). Pay ${formatCurrency(contract.platformFee)} now to keep your account active.`,
                data: {
                  contractId: contract.id,
                  platformFee: contract.platformFee,
                  dueDate: dueDate.toISOString(),
                  overdueDays,
                  actionRequired: 'PAY_PLATFORM_FEE',
                  reminderStage: overdueStage,
                },
                isRead: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
              }, { merge: true });
            stagesToPersist.push(overdueStage);
          }

          const userDoc = await db.collection('users').doc(payerId).get();
          const userData = userDoc.exists ? (userDoc.data() || {}) : {};
          const outstandingTotal = Number(userData.outstandingPlatformFees || contract.platformFee || 0);

          if (
            outstandingTotal >= PLATFORM_FEE_DEBT_CAP &&
            !reminderStages.has(REMINDER_STAGES.CAP_RESTRICTION_NOTICE)
          ) {
            await db.collection(`users/${payerId}/notifications`)
              .doc(notificationId(contract.id, REMINDER_STAGES.CAP_RESTRICTION_NOTICE))
              .set({
                type: 'PLATFORM_FEE_ACTION_RESTRICTED',
                title: 'Action Restricted: Debt Cap Reached',
                message: `Your unpaid platform fees have reached ${formatCurrency(outstandingTotal)}. New contract signing and job creation are restricted until due payments are settled.`,
                data: {
                  contractId: contract.id,
                  contractNumber: contract.contractNumber,
                  platformFee: contract.platformFee,
                  totalOutstanding: outstandingTotal,
                  debtCap: PLATFORM_FEE_DEBT_CAP,
                  actionRequired: 'PAY_PLATFORM_FEE',
                  reminderStage: REMINDER_STAGES.CAP_RESTRICTION_NOTICE,
                },
                isRead: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
              }, { merge: true });
            stagesToPersist.push(REMINDER_STAGES.CAP_RESTRICTION_NOTICE);
          }
        }

        if (stagesToPersist.length > 0) {
          contractUpdates.platformFeeReminders = admin.firestore.FieldValue.arrayUnion(...stagesToPersist);
        }

        if (Object.keys(contractUpdates).length > 0) {
          contractUpdates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
          await doc.ref.update(contractUpdates);
        }
      } catch (error) {
        console.error(`Failed processing platform fee reminder for contract ${doc.id}:`, error);
      }
    }

    return null;
  }
);
