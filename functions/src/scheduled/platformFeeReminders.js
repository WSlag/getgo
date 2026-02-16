/**
 * Platform Fee Reminder System
 * Runs daily at 9 AM Manila time (UTC+8)
 * Sends reminders on Day 1, 2 and suspends accounts on Day 3
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.sendPlatformFeeReminders = functions
  .region('asia-southeast1')
  .pubsub.schedule('0 9 * * *')  // Every day at 9 AM
  .timeZone('Asia/Manila')
  .onRun(async (context) => {
    const db = admin.firestore();
    const now = new Date();

    console.log(`Running platform fee reminder check at ${now.toISOString()}`);

    // Query contracts with unpaid platform fees
    const unpaidContracts = await db.collection('contracts')
      .where('platformFeePaid', '==', false)
      .get();

    console.log(`Found ${unpaidContracts.size} contracts with unpaid platform fees`);

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
        console.log(`Skipping contract ${contract.id} - billing not started yet`);
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

      console.log(`Processing contract ${contract.id}: ${contract.contractNumber}`);
      console.log(`  Billing started: ${billingStartedAt.toISOString()}`);
      console.log(`  Days since billing: ${daysSinceBillingStart}`);
      console.log(`  Due date: ${dueDate.toISOString()}`);
      console.log(`  Days until due: ${daysUntilDue}`);
      console.log(`  Status: ${contract.platformFeeStatus}`);
      console.log(`  Reminders sent: ${contract.platformFeeReminders?.join(', ') || 'none'}`);

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
    console.log(`Batch committed: ${unpaidContracts.size} contracts processed`);

    // Send notifications
    for (const { userId, notification } of notifications) {
      await db.collection(`users/${userId}/notifications`).doc().set(notification);
    }
    console.log(`Sent ${notifications.length} reminder notifications`);

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

        console.log(`Suspended user ${userId} for unpaid platform fee on contract ${contractId}`);
      } catch (error) {
        console.error(`Error suspending user ${userId}:`, error);
      }
    }

    console.log(`Completed: Sent ${notifications.length} reminders, suspended ${suspensions.length} accounts`);
    return null;
  });
