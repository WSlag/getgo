/**
 * Platform Fee Reminder System
 * Runs daily at 9 AM Manila time (UTC+8)
 * Sends reminders on Day 1, 2 and suspends accounts on Day 3
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

exports.sendPlatformFeeReminders = onSchedule(
  {
    region: 'asia-southeast1',
    schedule: '0 9 * * *', // Every day at 9 AM
    timeZone: 'Asia/Manila',
  },
  async () => {
    const db = admin.firestore();
    const now = new Date();

    // Query contracts with unpaid platform fees
    const unpaidContracts = await db.collection('contracts')
      .where('platformFeePaid', '==', false)
      .get();

    const batch = db.batch();
    const notifications = [];
    const suspensions = [];

    for (const doc of unpaidContracts.docs) {
      const contract = { id: doc.id, ...doc.data() };

      // Skip cancelled and draft contracts
      if (contract.status === 'cancelled' || contract.status === 'draft') {
        continue;
      }

      // Only process contracts where billing has started
      if (!contract.platformFeeBillingStartedAt) {
        continue;
      }

      const billingStartedAt = contract.platformFeeBillingStartedAt.toDate();
      const dueDate = contract.platformFeeDueDate?.toDate() || (() => {
        const d = new Date(billingStartedAt);
        d.setDate(d.getDate() + 3);
        return d;
      })();

      const daysSinceBillingStart = Math.floor(
        (now - billingStartedAt) / (1000 * 60 * 60 * 24)
      );
      const daysUntilDue = Math.floor((dueDate - now) / (1000 * 60 * 60 * 24));

      // Day 1: Initial reminder
      if (daysSinceBillingStart === 1 && !contract.platformFeeReminders?.includes('day_1')) {
        notifications.push({
          userId: contract.platformFeePayerId,
          notification: {
            type: 'PLATFORM_FEE_REMINDER',
            title: 'Reminder: Platform Fee Payment',
            message: `Pay ₱${contract.platformFee.toLocaleString()} for Contract #${contract.contractNumber}. Due in ${daysUntilDue} days.`,
            data: {
              contractId: contract.id,
              platformFee: contract.platformFee,
              daysUntilDue,
            },
            isRead: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        });
        batch.update(doc.ref, {
          platformFeeReminders: admin.firestore.FieldValue.arrayUnion('day_1'),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      // Day 2: Final warning
      else if (daysSinceBillingStart === 2 && !contract.platformFeeReminders?.includes('day_2')) {
        notifications.push({
          userId: contract.platformFeePayerId,
          notification: {
            type: 'PLATFORM_FEE_REMINDER',
            title: 'FINAL REMINDER: Platform Fee',
            message: `Pay ₱${contract.platformFee.toLocaleString()} by ${dueDate.toLocaleDateString()} or account will be suspended tomorrow.`,
            data: {
              contractId: contract.id,
              platformFee: contract.platformFee,
              dueDate: dueDate.toISOString(),
            },
            isRead: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        });
        batch.update(doc.ref, {
          platformFeeReminders: admin.firestore.FieldValue.arrayUnion('day_2'),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      // Day 3+: Suspend
      else if (daysUntilDue <= 0 && contract.platformFeeStatus !== 'overdue') {
        batch.update(doc.ref, {
          platformFeeStatus: 'overdue',
          overdueAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        suspensions.push({
          userId: contract.platformFeePayerId,
          contractId: contract.id,
          platformFee: contract.platformFee,
          contractNumber: contract.contractNumber,
        });
      }
    }

    // Commit contract updates
    await batch.commit();

    // Send notifications
    for (const { userId, notification } of notifications) {
      await db.collection(`users/${userId}/notifications`).doc().set(notification);
    }

    // Process suspensions
    for (const { userId, contractId, platformFee, contractNumber } of suspensions) {
      try {
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        const totalOutstanding = userData.outstandingPlatformFees || 0;

        // Update user account status
        await db.collection('users').doc(userId).update({
          accountStatus: 'suspended',
          suspensionReason: 'unpaid_platform_fees',
          suspendedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Send suspension notification
        await db.collection(`users/${userId}/notifications`).doc().set({
          type: 'ACCOUNT_SUSPENDED',
          title: 'Account Suspended - Payment Required',
          message: `Account suspended due to unpaid platform fees. Total outstanding: ₱${totalOutstanding.toLocaleString()}. Pay all outstanding fees to reactivate.`,
          data: {
            contractId,
            platformFee,
            contractNumber,
            totalOutstanding,
            suspendedAt: new Date().toISOString(),
          },
          isRead: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Create admin log
        await db.collection('adminLogs').add({
          action: 'AUTO_SUSPEND_UNPAID_FEES',
          targetUserId: userId,
          contractId,
          amount: platformFee,
          totalOutstanding,
          performedBy: 'SYSTEM',
          performedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (error) {
        console.error(`Error suspending user ${userId}:`, error);
      }
    }
    return null;
  }
);
