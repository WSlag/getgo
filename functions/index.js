/**
 * Karga GCash Payment Verification Cloud Functions
 *
 * Main entry point for Firebase Cloud Functions that handle
 * payment screenshot verification using OCR and fraud detection.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp();

// Import services
const { processScreenshot, validateExtractedData } = require('./src/services/ocr');
const { analyzeImage } = require('./src/services/imageAnalysis');
const {
  detectFraud,
  checkDuplicateReference,
  checkDuplicateHash,
  determineFinalStatus,
  createFraudLog
} = require('./src/services/fraud');
const { createContractFromApprovedFee } = require('./src/services/contractCreation');

const db = admin.firestore();

/**
 * Process Payment Submission
 *
 * Triggered when a new document is created in /paymentSubmissions
 * Runs OCR, validates data, performs fraud detection, and updates status.
 */
exports.processPaymentSubmission = functions
  .region('asia-southeast1') // Manila region for lower latency
  .runWith({
    memory: '1GB',
    timeoutSeconds: 120
  })
  .firestore.document('paymentSubmissions/{submissionId}')
  .onCreate(async (snap, context) => {
    const submission = snap.data();
    const { submissionId } = context.params;

    console.log(`Processing payment submission: ${submissionId}`);

    try {
      // Step 1: Update status to processing
      await snap.ref.update({
        ocrStatus: 'processing',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Step 2: Get the order details
      const orderDoc = await db.collection('orders').doc(submission.orderId).get();
      if (!orderDoc.exists) {
        throw new Error(`Order not found: ${submission.orderId}`);
      }
      const order = orderDoc.data();

      // Check if order is expired
      if (order.expiresAt && order.expiresAt.toDate() < new Date()) {
        await handleExpiredOrder(snap.ref, submissionId, submission.userId);
        return;
      }

      // Step 3: Analyze image (get hash, dimensions, EXIF)
      console.log('Analyzing image...');
      const imageAnalysis = await analyzeImage(submission.screenshotUrl);

      if (!imageAnalysis.success) {
        console.warn('Image analysis failed:', imageAnalysis.error);
      }

      // Step 4: Check for duplicate image hash
      console.log('Checking for duplicate image...');
      const duplicateHash = await checkDuplicateHash(
        db,
        imageAnalysis.hash,
        submissionId
      );

      // Step 5: Run OCR
      console.log('Running OCR...');
      const ocrResults = await processScreenshot(submission.screenshotUrl);

      if (!ocrResults.success) {
        await handleOCRFailure(snap.ref, submissionId, submission.userId, ocrResults.error);
        return;
      }

      // Step 6: Validate extracted data
      console.log('Validating extracted data...');
      const validationResults = validateExtractedData(ocrResults.extractedData, order);

      // Step 7: Check for duplicate reference number
      console.log('Checking for duplicate reference...');
      const duplicateRef = await checkDuplicateReference(
        db,
        ocrResults.extractedData?.referenceNumber,
        submissionId,
        submission.userId,
        order.amount
      );

      // Step 8: Run fraud detection
      console.log('Running fraud detection...');
      const fraudResults = await detectFraud({
        submission,
        order,
        ocrResults,
        validationResults,
        imageAnalysis,
        duplicateHash,
        duplicateRef
      });

      // Step 9: Determine final status
      const finalStatus = determineFinalStatus(validationResults, fraudResults);
      console.log(`Final status: ${finalStatus}, Fraud score: ${fraudResults.score}`);

      // Step 10: Update submission with all results
      const updateData = {
        ocrStatus: 'completed',
        ocrCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
        extractedData: {
          referenceNumber: ocrResults.extractedData?.referenceNumber || null,
          amount: ocrResults.extractedData?.amount || null,
          amountRaw: ocrResults.extractedData?.amountRaw || null,
          senderName: ocrResults.extractedData?.senderName || null,
          receiverName: ocrResults.extractedData?.receiverName || null,
          timestamp: ocrResults.extractedData?.timestamp || null,
          confidence: ocrResults.confidence,
          rawText: ocrResults.rawText?.substring(0, 5000) || '' // Limit raw text size
        },
        validationStatus: validationResults.allPassed ? 'passed' : 'failed',
        validationResults: {
          amountMatch: validationResults.amountMatch,
          receiverMatch: validationResults.receiverMatch,
          timestampValid: validationResults.timestampValid,
          referencePresent: validationResults.referencePresent,
          hasRequiredFields: validationResults.hasRequiredFields
        },
        validationErrors: validationResults.errors || [],
        fraudScore: fraudResults.score,
        fraudFlags: fraudResults.flags,
        requiresManualReview: fraudResults.requiresReview,
        imageHash: imageAnalysis.hash || null,
        imageDimensions: imageAnalysis.dimensions || null,
        exifData: imageAnalysis.exif || null,
        status: finalStatus,
        resolvedAt: finalStatus !== 'manual_review'
          ? admin.firestore.FieldValue.serverTimestamp()
          : null,
        resolvedBy: finalStatus !== 'manual_review' ? 'system' : null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await snap.ref.update(updateData);

      // Step 11: If approved, credit wallet and update order
      if (finalStatus === 'approved') {
        await approvePayment(submission, order, submissionId);
      }

      // Step 12: If rejected, update order status
      if (finalStatus === 'rejected') {
        await rejectPayment(submission.orderId, validationResults.errors);
      }

      // Step 13: Create fraud log for audit trail
      await createFraudLog(db, submissionId, submission.userId, finalStatus, fraudResults);

      // Step 14: Send notification to user (for non-approved statuses, approved sends its own in approvePayment)
      if (finalStatus !== 'approved') {
        await sendUserNotification(submission.userId, finalStatus, order.amount, submissionId, null, order.type);
      }

      // Step 15: If flagged for review, notify admin
      if (finalStatus === 'manual_review') {
        await notifyAdminForReview(submissionId, submission.userId, order.amount, fraudResults);
      }

      console.log(`Payment submission ${submissionId} processed successfully: ${finalStatus}`);

    } catch (error) {
      console.error('Error processing submission:', error);

      // Update submission with error status
      await snap.ref.update({
        ocrStatus: 'failed',
        status: 'manual_review',
        validationErrors: [error.message || 'Processing failed'],
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Notify admin of processing error
      await notifyAdminForReview(submissionId, submission.userId, 0, {
        score: 0,
        flags: ['PROCESSING_ERROR'],
        details: [{ error: error.message }]
      });
    }
  });

/**
 * Handle expired order
 */
async function handleExpiredOrder(submissionRef, submissionId, userId) {
  await submissionRef.update({
    ocrStatus: 'completed',
    status: 'rejected',
    validationErrors: ['Order has expired. Please create a new top-up request.'],
    resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
    resolvedBy: 'system',
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  await sendUserNotification(userId, 'rejected', 0, submissionId, 'Order expired');
}

/**
 * Handle OCR failure
 */
async function handleOCRFailure(submissionRef, submissionId, userId, error) {
  await submissionRef.update({
    ocrStatus: 'failed',
    status: 'manual_review',
    validationErrors: [`OCR failed: ${error}`],
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  await sendUserNotification(userId, 'manual_review', 0, submissionId, 'Could not read screenshot');
}

/**
 * Approve payment - handle platform fee or wallet top-up
 */
async function approvePayment(submission, order, submissionId) {
  // Update order status
  await db.collection('orders').doc(submission.orderId).update({
    status: 'verified',
    verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    verifiedSubmissionId: submissionId,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // Check if this is a platform fee payment or wallet top-up
  if (order.type === 'platform_fee') {
    console.log(`Processing platform fee payment for bid ${order.bidId}`);

    // Record in platformFees collection
    await db.collection('platformFees').doc().set({
      bidId: order.bidId,
      userId: submission.userId,
      amount: order.amount,
      status: 'completed',
      submissionId,
      orderId: order.orderId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update contract to mark platform fee as paid and change status to draft
    try {
      if (order.contractId) {
        await db.collection('contracts').doc(order.contractId).update({
          status: 'draft', // Change from pending_payment to draft
          platformFeePaid: true,
          platformFeeStatus: 'paid',
          platformFeePaidAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Get contract to find payer
        const contractDoc = await db.collection('contracts').doc(order.contractId).get();
        if (contractDoc.exists) {
          const contract = contractDoc.data();
          const platformFeePayerId = contract.platformFeePayerId;

          // Update user's outstanding fees
          await db.collection('users').doc(platformFeePayerId).update({
            outstandingPlatformFees: admin.firestore.FieldValue.increment(-order.amount),
            outstandingFeeContracts: admin.firestore.FieldValue.arrayRemove(order.contractId),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          // Check if should unsuspend account
          const userDoc = await db.collection('users').doc(platformFeePayerId).get();
          if (userDoc.exists) {
            const userData = userDoc.data();

            if (
              userData.accountStatus === 'suspended' &&
              userData.suspensionReason === 'unpaid_platform_fees' &&
              (userData.outstandingPlatformFees - order.amount) <= 0
            ) {
              // Unsuspend automatically
              await db.collection('users').doc(platformFeePayerId).update({
                accountStatus: 'active',
                suspensionReason: null,
                suspendedAt: null,
                unsuspendedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });

              // Notify unsuspension
              await db.collection(`users/${platformFeePayerId}/notifications`).doc().set({
                type: 'ACCOUNT_UNSUSPENDED',
                title: 'Account Reactivated ✅',
                message: 'Your account has been reactivated. All platform fees have been paid.',
                data: { contractId: order.contractId },
                isRead: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
              });

              console.log(`Account unsuspended for user ${platformFeePayerId}`);
            }
          }

          // Send notification to trucker about payment confirmation
          await db.collection(`users/${submission.userId}/notifications`).doc().set({
            type: 'PAYMENT_VERIFIED',
            title: 'Platform Fee Paid ✅',
            message: `Your platform fee payment has been verified for Contract #${contract.contractNumber}. The contract is now ready for signing.`,
            data: {
              submissionId,
              contractId: order.contractId,
              bidId: order.bidId,
            },
            isRead: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          // Send notification to listing owner that payment is complete and contract ready
          const listingOwnerId = contract.listingOwnerId;
          if (listingOwnerId && listingOwnerId !== submission.userId) {
            await db.collection(`users/${listingOwnerId}/notifications`).doc().set({
              type: 'CONTRACT_READY',
              title: 'Contract Ready for Signing',
              message: `Contract #${contract.contractNumber} platform fee has been paid. Please review and sign the contract.`,
              data: {
                contractId: order.contractId,
                bidId: order.bidId,
              },
              isRead: false,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }

          console.log(`Contract ${order.contractId} platform fee marked as paid and status changed to draft`);
        }
      } else {
        console.warn('No contractId found in order - this should not happen with new flow');
      }
    } catch (error) {
      console.error('Error updating contract payment status:', error);
      // Notify user of error
      await db.collection(`users/${submission.userId}/notifications`).doc().set({
        type: 'PAYMENT_STATUS',
        title: 'Payment Verified',
        message: 'Your payment has been verified, but there was an issue updating the contract. Our team will assist you.',
        data: { submissionId, error: error.message },
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  } else {
    // Legacy: wallet top-up flow (kept for backward compatibility)
    console.log(`Processing wallet top-up: ₱${order.amount} for user ${submission.userId}`);

    const batch = db.batch();

    // Credit user's wallet
    const walletRef = db.collection('users').doc(submission.userId).collection('wallet').doc('main');
    const walletDoc = await walletRef.get();

    if (walletDoc.exists) {
      batch.update(walletRef, {
        balance: admin.firestore.FieldValue.increment(order.amount),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      batch.set(walletRef, {
        balance: order.amount,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // Create wallet transaction record
    const txRef = db.collection('users').doc(submission.userId).collection('walletTransactions').doc();
    batch.set(txRef, {
      type: 'topup',
      amount: order.amount,
      method: 'GCash (Screenshot)',
      description: `Top-up via GCash screenshot verification`,
      reference: submissionId,
      status: 'completed',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();
    console.log(`Wallet credited: ₱${order.amount} for user ${submission.userId}`);
  }
}

/**
 * Reject payment - update order status
 */
async function rejectPayment(orderId, errors) {
  await db.collection('orders').doc(orderId).update({
    status: 'rejected',
    rejectionReason: errors.join('; '),
    rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

/**
 * Send notification to user about payment status
 * Note: For platform_fee payments, contract creation sends its own notification
 */
async function sendUserNotification(userId, status, amount, submissionId, customMessage = null, orderType = null) {
  let title, message;

  switch (status) {
    case 'approved':
      // Note: Platform fee payments send a different notification in approvePayment function
      title = 'Payment Verified!';
      message = orderType === 'platform_fee'
        ? `Your platform fee payment has been verified. Contract is being created.`
        : `Your ₱${amount.toLocaleString()} top-up has been verified and added to your wallet.`;
      break;
    case 'rejected':
      title = 'Payment Verification Failed';
      message = customMessage || 'Your payment could not be verified. Please try again with a valid GCash receipt screenshot.';
      break;
    case 'manual_review':
      title = 'Payment Under Review';
      message = customMessage || 'Your payment is being reviewed by our team. This usually takes 5-10 minutes.';
      break;
    default:
      return;
  }

  const notifRef = db.collection('users').doc(userId).collection('notifications').doc();
  await notifRef.set({
    type: 'PAYMENT_STATUS',
    title,
    message,
    data: {
      submissionId,
      status,
      amount,
      orderType
    },
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

/**
 * Notify admin about payment requiring manual review
 */
async function notifyAdminForReview(submissionId, userId, amount, fraudResults) {
  // Get admin users (check both role='admin' and isAdmin=true)
  const [adminsByRole, adminsByFlag] = await Promise.all([
    db.collection('users').where('role', '==', 'admin').limit(10).get(),
    db.collection('users').where('isAdmin', '==', true).limit(10).get()
  ]);

  // Combine unique admins
  const adminIds = new Set();
  const admins = [];
  [...adminsByRole.docs, ...adminsByFlag.docs].forEach(doc => {
    if (!adminIds.has(doc.id)) {
      adminIds.add(doc.id);
      admins.push(doc);
    }
  });

  const adminsSnapshot = { docs: admins, empty: admins.length === 0 };

  const batch = db.batch();

  adminsSnapshot.docs.forEach(adminDoc => {
    const notifRef = db.collection('users').doc(adminDoc.id).collection('notifications').doc();
    batch.set(notifRef, {
      type: 'PAYMENT_REVIEW_NEEDED',
      title: 'Payment Needs Review',
      message: `A ₱${amount.toLocaleString()} payment submission requires manual review. Fraud score: ${fraudResults.score}`,
      data: {
        submissionId,
        userId,
        amount,
        fraudScore: fraudResults.score,
        flags: fraudResults.flags
      },
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });

  if (!adminsSnapshot.empty) {
    await batch.commit();
  }
}

/**
 * Admin Manual Approval
 *
 * HTTPS Callable function for admin to manually approve a payment
 */
exports.adminApprovePayment = functions
  .region('asia-southeast1')
  .https.onCall(async (data, context) => {
    // Verify admin role
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const adminDoc = await db.collection('users').doc(context.auth.uid).get();
    const userData = adminDoc.exists ? adminDoc.data() : null;
    if (!userData || (userData.role !== 'admin' && !userData.isAdmin)) {
      throw new functions.https.HttpsError('permission-denied', 'Must be admin');
    }

    const { submissionId, notes } = data;
    if (!submissionId) {
      throw new functions.https.HttpsError('invalid-argument', 'submissionId required');
    }

    // Get submission
    const submissionRef = db.collection('paymentSubmissions').doc(submissionId);
    const submissionDoc = await submissionRef.get();

    if (!submissionDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Submission not found');
    }

    const submission = submissionDoc.data();

    // Get order
    const orderDoc = await db.collection('orders').doc(submission.orderId).get();
    if (!orderDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Order not found');
    }
    const order = orderDoc.data();

    // Update submission
    await submissionRef.update({
      status: 'approved',
      resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
      resolvedBy: context.auth.uid,
      resolutionNotes: notes || 'Manual approval by admin',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Credit wallet
    await approvePayment(submission, order, submissionId);

    // Create fraud log
    await createFraudLog(db, submissionId, submission.userId, 'manual_approved', {
      score: submission.fraudScore || 0,
      flags: submission.fraudFlags || [],
      details: []
    }, context.auth.uid, notes);

    // Notify user (only for non-platform-fee orders, since approvePayment already sends CONTRACT_CREATED notification)
    if (order.type !== 'platform_fee') {
      await sendUserNotification(submission.userId, 'approved', order.amount, submissionId, null, order.type);
    }

    return { success: true, message: 'Payment approved' };
  });

/**
 * Admin Manual Rejection
 *
 * HTTPS Callable function for admin to manually reject a payment
 */
exports.adminRejectPayment = functions
  .region('asia-southeast1')
  .https.onCall(async (data, context) => {
    // Verify admin role
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const adminDoc = await db.collection('users').doc(context.auth.uid).get();
    const userData = adminDoc.exists ? adminDoc.data() : null;
    if (!userData || (userData.role !== 'admin' && !userData.isAdmin)) {
      throw new functions.https.HttpsError('permission-denied', 'Must be admin');
    }

    const { submissionId, reason, notes } = data;
    if (!submissionId) {
      throw new functions.https.HttpsError('invalid-argument', 'submissionId required');
    }

    // Get submission
    const submissionRef = db.collection('paymentSubmissions').doc(submissionId);
    const submissionDoc = await submissionRef.get();

    if (!submissionDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Submission not found');
    }

    const submission = submissionDoc.data();

    // Update submission
    await submissionRef.update({
      status: 'rejected',
      resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
      resolvedBy: context.auth.uid,
      resolutionNotes: notes || reason || 'Rejected by admin',
      validationErrors: [...(submission.validationErrors || []), reason || 'Manual rejection'],
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Update order
    await rejectPayment(submission.orderId, [reason || 'Rejected by admin']);

    // Create fraud log
    await createFraudLog(db, submissionId, submission.userId, 'manual_rejected', {
      score: submission.fraudScore || 0,
      flags: submission.fraudFlags || [],
      details: []
    }, context.auth.uid, reason || notes);

    // Notify user
    await sendUserNotification(submission.userId, 'rejected', 0, submissionId, reason);

    return { success: true, message: 'Payment rejected' };
  });

/**
 * Get Admin Payment Stats
 *
 * HTTPS Callable function to get payment verification statistics
 */
exports.getPaymentStats = functions
  .region('asia-southeast1')
  .https.onCall(async (data, context) => {
    // Verify admin role
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const adminDoc = await db.collection('users').doc(context.auth.uid).get();
    const userData = adminDoc.exists ? adminDoc.data() : null;
    if (!userData || (userData.role !== 'admin' && !userData.isAdmin)) {
      throw new functions.https.HttpsError('permission-denied', 'Must be admin');
    }

    // Get counts for each status
    const [pending, approved, rejected, review] = await Promise.all([
      db.collection('paymentSubmissions').where('status', '==', 'pending').count().get(),
      db.collection('paymentSubmissions').where('status', '==', 'approved').count().get(),
      db.collection('paymentSubmissions').where('status', '==', 'rejected').count().get(),
      db.collection('paymentSubmissions').where('status', '==', 'manual_review').count().get()
    ]);

    return {
      pending: pending.data().count,
      approved: approved.data().count,
      rejected: rejected.data().count,
      pendingReview: review.data().count,
      total: pending.data().count + approved.data().count + rejected.data().count + review.data().count
    };
  });

/**
 * Set Admin Role
 *
 * Secure Cloud Function to grant/revoke admin privileges.
 * Can only be called by existing admins or via Firebase Admin SDK.
 * Also sets Firebase Custom Claims for secure rule verification.
 */
exports.setAdminRole = functions
  .region('asia-southeast1')
  .https.onCall(async (data, context) => {
    // Must be authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    // Check if caller is an existing admin
    const callerDoc = await db.collection('users').doc(context.auth.uid).get();
    const callerData = callerDoc.exists ? callerDoc.data() : null;

    // Only existing admins can create new admins
    if (!callerData || (callerData.role !== 'admin' && !callerData.isAdmin)) {
      throw new functions.https.HttpsError('permission-denied', 'Only admins can grant admin privileges');
    }

    const { targetUserId, isAdmin } = data;

    if (!targetUserId || typeof isAdmin !== 'boolean') {
      throw new functions.https.HttpsError('invalid-argument', 'targetUserId (string) and isAdmin (boolean) required');
    }

    // Verify target user exists
    const targetDoc = await db.collection('users').doc(targetUserId).get();
    if (!targetDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Target user not found');
    }

    try {
      // Update Firestore document (bypasses security rules since this is server-side)
      await db.collection('users').doc(targetUserId).update({
        isAdmin: isAdmin,
        role: isAdmin ? 'admin' : (targetDoc.data().role === 'admin' ? 'user' : targetDoc.data().role),
        adminGrantedBy: context.auth.uid,
        adminGrantedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Set Firebase Custom Claims for secure verification in rules
      await admin.auth().setCustomUserClaims(targetUserId, { admin: isAdmin });

      // Log the admin action
      await db.collection('adminLogs').add({
        action: isAdmin ? 'GRANT_ADMIN' : 'REVOKE_ADMIN',
        targetUserId,
        performedBy: context.auth.uid,
        performedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`Admin privileges ${isAdmin ? 'granted to' : 'revoked from'} user ${targetUserId} by ${context.auth.uid}`);

      return {
        success: true,
        message: `Admin privileges ${isAdmin ? 'granted' : 'revoked'} successfully`
      };
    } catch (error) {
      console.error('Error setting admin role:', error);
      throw new functions.https.HttpsError('internal', 'Failed to update admin privileges');
    }
  });

/**
 * Initialize First Admin (One-time setup)
 *
 * This function can only be called ONCE when there are no admins in the system.
 * After the first admin is created, this function will reject all future calls.
 * Use this to bootstrap the admin system.
 */
exports.initializeFirstAdmin = functions
  .region('asia-southeast1')
  .https.onCall(async (data, context) => {
    // Must be authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    // Check if any admins already exist
    const existingAdmins = await db.collection('users')
      .where('role', '==', 'admin')
      .limit(1)
      .get();

    const existingAdminsByFlag = await db.collection('users')
      .where('isAdmin', '==', true)
      .limit(1)
      .get();

    if (!existingAdmins.empty || !existingAdminsByFlag.empty) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Admin already exists. Use setAdminRole to grant additional admin privileges.'
      );
    }

    // Verify caller's user document exists
    const callerDoc = await db.collection('users').doc(context.auth.uid).get();
    if (!callerDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User profile not found. Please complete registration first.');
    }

    try {
      // Grant admin to the caller
      await db.collection('users').doc(context.auth.uid).update({
        isAdmin: true,
        role: 'admin',
        adminGrantedAt: admin.firestore.FieldValue.serverTimestamp(),
        adminGrantedBy: 'SYSTEM_INIT'
      });

      // Set Firebase Custom Claims
      await admin.auth().setCustomUserClaims(context.auth.uid, { admin: true });

      // Log the initialization
      await db.collection('adminLogs').add({
        action: 'FIRST_ADMIN_INIT',
        targetUserId: context.auth.uid,
        performedBy: 'SYSTEM',
        performedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`First admin initialized: ${context.auth.uid}`);

      return {
        success: true,
        message: 'You are now the first admin. You can grant admin privileges to others using setAdminRole.'
      };
    } catch (error) {
      console.error('Error initializing first admin:', error);
      throw new functions.https.HttpsError('internal', 'Failed to initialize admin');
    }
  });

// =============================================================================
// CONTRACT MANAGEMENT FUNCTIONS
// =============================================================================

const contractFunctions = require('./src/api/contracts');
exports.createContract = contractFunctions.createContract;
exports.signContract = contractFunctions.signContract;
exports.completeContract = contractFunctions.completeContract;
exports.getContracts = contractFunctions.getContracts;
exports.getContract = contractFunctions.getContract;
exports.getContractByBid = contractFunctions.getContractByBid;

// =============================================================================
// WALLET MANAGEMENT FUNCTIONS
// =============================================================================

const walletFunctions = require('./src/api/wallet');
exports.createPlatformFeeOrder = walletFunctions.createPlatformFeeOrder;
exports.createTopUpOrder = walletFunctions.createTopUpOrder;
exports.getGcashConfig = walletFunctions.getGcashConfig;

// =============================================================================
// SHIPMENT MANAGEMENT FUNCTIONS
// =============================================================================

const shipmentFunctions = require('./src/api/shipments');
exports.updateShipmentLocation = shipmentFunctions.updateShipmentLocation;
exports.updateShipmentStatus = shipmentFunctions.updateShipmentStatus;

// =============================================================================
// RATING FUNCTIONS
// =============================================================================

const ratingFunctions = require('./src/api/ratings');
exports.submitRating = ratingFunctions.submitRating;
exports.getPendingRatings = ratingFunctions.getPendingRatings;

// =============================================================================
// ADMIN FUNCTIONS
// =============================================================================

const adminFunctions = require('./src/api/admin');
exports.adminGetDashboardStats = adminFunctions.adminGetDashboardStats;
exports.adminGetPendingPayments = adminFunctions.adminGetPendingPayments;
exports.adminGetUsers = adminFunctions.adminGetUsers;
exports.adminSuspendUser = adminFunctions.adminSuspendUser;
exports.adminActivateUser = adminFunctions.adminActivateUser;
exports.adminVerifyUser = adminFunctions.adminVerifyUser;
exports.adminToggleAdmin = adminFunctions.adminToggleAdmin;
exports.adminGetFinancialSummary = adminFunctions.adminGetFinancialSummary;
exports.adminResolveDispute = adminFunctions.adminResolveDispute;
exports.adminGetContracts = adminFunctions.adminGetContracts;
exports.adminGetOutstandingFees = adminFunctions.adminGetOutstandingFees;

// =============================================================================
// ROUTE OPTIMIZATION FUNCTIONS
// =============================================================================

const listingFunctions = require('./src/api/listings');
exports.findBackloadOpportunities = listingFunctions.findBackloadOpportunities;
exports.getPopularRoutes = listingFunctions.getPopularRoutes;

// =============================================================================
// FIRESTORE TRIGGERS
// =============================================================================

const bidTriggers = require('./src/triggers/bidTriggers');
exports.onBidCreated = bidTriggers.onBidCreated;
exports.onBidStatusChanged = bidTriggers.onBidStatusChanged;
exports.onBidAccepted = bidTriggers.onBidAccepted;

const shipmentTriggers = require('./src/triggers/shipmentTriggers');
exports.onShipmentLocationUpdate = shipmentTriggers.onShipmentLocationUpdate;
exports.onShipmentStatusChanged = shipmentTriggers.onShipmentStatusChanged;

const ratingTriggers = require('./src/triggers/ratingTriggers');
exports.onRatingCreated = ratingTriggers.onRatingCreated;

// =============================================================================
// SCHEDULED FUNCTIONS
// =============================================================================

const platformFeeReminders = require('./src/scheduled/platformFeeReminders');
exports.sendPlatformFeeReminders = platformFeeReminders.sendPlatformFeeReminders;
