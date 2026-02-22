/**
 * Karga GCash Payment Verification Cloud Functions
 *
 * Main entry point for Firebase Cloud Functions that handle
 * payment screenshot verification using OCR and fraud detection.
 */

const functions = require('firebase-functions');
const { onCall } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');
const axios = require('axios');

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
const { isTrustedPaymentScreenshotUrl } = require('./src/utils/storageUrl');
const { loadPlatformSettings } = require('./src/config/platformSettings');

const { verifyAdmin } = require('./src/utils/adminAuth');

const db = admin.firestore();

function safeErrorMessage(error) {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  if (error.response) {
    return `HTTP ${error.response.status}: ${error.response.statusText || 'upstream error'}`;
  }
  return error.message || 'Unknown error';
}

function getAllowedOrigins() {
  const rawOrigins = process.env.ALLOWED_ORIGIN || 'https://karga-ph.web.app';
  return rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function applyCors(req, res, options = {}) {
  const allowedOrigins = getAllowedOrigins();
  const requestOrigin = req.headers.origin || '';
  const defaultOrigin = allowedOrigins[0] || 'https://karga-ph.web.app';
  const originToSet = allowedOrigins.includes(requestOrigin) ? requestOrigin : defaultOrigin;

  res.set('Access-Control-Allow-Origin', originToSet);
  res.set('Vary', 'Origin');
  res.set('Access-Control-Allow-Methods', options.methods || 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', options.headers || 'Content-Type');
}

function isAppCheckEnforced() {
  return process.env.APP_CHECK_ENFORCED === 'true';
}

async function verifyHttpAppCheckToken(req, res) {
  if (!isAppCheckEnforced()) return true;

  const token = req.headers['x-firebase-appcheck'];
  if (!token || typeof token !== 'string') {
    res.status(401).json({ error: 'App Check token missing' });
    return false;
  }

  try {
    await admin.appCheck().verifyToken(token);
    return true;
  } catch (error) {
    res.status(401).json({ error: 'App Check token invalid' });
    return false;
  }
}

/**
 * Process Payment Submission
 *
 * Triggered when a new document is created in /paymentSubmissions
 * Runs OCR, validates data, performs fraud detection, and updates status.
 */
exports.processPaymentSubmission = onDocumentCreated(
  {
    region: 'asia-southeast1', // Manila region for lower latency
    document: 'paymentSubmissions/{submissionId}',
    memory: '1GiB',
    timeoutSeconds: 120,
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const submission = snap.data();
    const { submissionId } = event.params;

    try {
      // Step 1: Update status to processing
      await snap.ref.update({
        ocrStatus: 'processing',
        updatedAt: FieldValue.serverTimestamp()
      });

      // Step 2: Get the order details
      const orderDoc = await db.collection('orders').doc(submission.orderId).get();
      if (!orderDoc.exists) {
        throw new Error(`Order not found: ${submission.orderId}`);
      }
      const order = orderDoc.data();

      // Security: enforce order ownership before processing any uploaded screenshot
      if (order.userId !== submission.userId) {
        throw new Error('Order ownership mismatch');
      }

      // Security: reject untrusted screenshot URLs (SSRF defense)
      if (!isTrustedPaymentScreenshotUrl(submission.screenshotUrl, submission.userId)) {
        throw new Error('Untrusted screenshot URL');
      }

      // Check if order is expired
      if (order.expiresAt && order.expiresAt.toDate() < new Date()) {
        await handleExpiredOrder(snap.ref, submissionId, submission.userId);
        return;
      }

      // Step 3: Analyze image (get hash, dimensions, EXIF)
      const imageAnalysis = await analyzeImage(submission.screenshotUrl, submission.userId);

      if (!imageAnalysis.success) {
        console.warn('Image analysis failed:', imageAnalysis.error);
      }

      // Step 4: Check for duplicate image hash
      const duplicateHash = await checkDuplicateHash(
        db,
        imageAnalysis.hash,
        submissionId
      );

      // Step 5: Run OCR
      const ocrResults = await processScreenshot(submission.screenshotUrl, submission.userId);

      if (!ocrResults.success) {
        await handleOCRFailure(snap.ref, submissionId, submission.userId, ocrResults.error);
        return;
      }

      // Step 6: Validate extracted data
      const validationResults = validateExtractedData(ocrResults.extractedData, order);

      // Step 7: Check for duplicate reference number
      const duplicateRef = await checkDuplicateReference(
        db,
        ocrResults.extractedData?.referenceNumber,
        submissionId,
        submission.userId,
        order.amount
      );

      // Step 8: Run fraud detection
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
      let finalStatus = determineFinalStatus(validationResults, fraudResults);
      const platformSettings = await loadPlatformSettings(db);
      if (
        finalStatus === 'approved' &&
        platformSettings?.features?.autoApproveLowRiskPayments === false
      ) {
        finalStatus = 'manual_review';
      }

      // Step 10: Update submission with all results
      const updateData = {
        ocrStatus: 'completed',
        ocrCompletedAt: FieldValue.serverTimestamp(),
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
          ? FieldValue.serverTimestamp()
          : null,
        resolvedBy: finalStatus !== 'manual_review' ? 'system' : null,
        updatedAt: FieldValue.serverTimestamp()
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

    } catch (error) {
      console.error('Error processing submission:', safeErrorMessage(error));

      // Update submission with error status
      await snap.ref.update({
        ocrStatus: 'failed',
        status: 'manual_review',
        validationErrors: [error.message || 'Processing failed'],
        updatedAt: FieldValue.serverTimestamp()
      });

      // Notify admin of processing error
      await notifyAdminForReview(submissionId, submission.userId, 0, {
        score: 0,
        flags: ['PROCESSING_ERROR'],
        details: [{ error: error.message }]
      });
    }
  }
);

/**
 * Handle expired order
 */
async function handleExpiredOrder(submissionRef, submissionId, userId) {
  await submissionRef.update({
    ocrStatus: 'completed',
    status: 'rejected',
    validationErrors: ['Order has expired. Please create a new top-up request.'],
    resolvedAt: FieldValue.serverTimestamp(),
    resolvedBy: 'system',
    updatedAt: FieldValue.serverTimestamp()
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
    updatedAt: FieldValue.serverTimestamp()
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
    verifiedAt: FieldValue.serverTimestamp(),
    verifiedSubmissionId: submissionId,
    updatedAt: FieldValue.serverTimestamp()
  });

  // Check if this is a platform fee payment or wallet top-up
  if (order.type === 'platform_fee') {

    // Record in platformFees collection
    await db.collection('platformFees').doc().set({
      bidId: order.bidId,
      userId: submission.userId,
      amount: order.amount,
      status: 'completed',
      submissionId,
      orderId: order.orderId,
      createdAt: FieldValue.serverTimestamp(),
    });

    // Update contract to mark platform fee as paid.
    // Keep lifecycle state for deferred-fee contracts (e.g. signed/completed),
    // only promoting pending_payment -> draft.
    try {
      if (order.contractId) {
        const contractRef = db.collection('contracts').doc(order.contractId);
        const contractDoc = await contractRef.get();

        if (contractDoc.exists) {
          const contract = contractDoc.data();
          const currentStatus = contract.status || 'draft';
          const nextStatus = currentStatus === 'pending_payment' ? 'draft' : currentStatus;
          const humanStatus = nextStatus.replace(/_/g, ' ');

          await contractRef.update({
            status: nextStatus,
            platformFeePaid: true,
            platformFeeStatus: 'paid',
            platformFeePaidAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });

          const platformFeePayerId = contract.platformFeePayerId;

          // Update user's outstanding fees
          await db.collection('users').doc(platformFeePayerId).update({
            outstandingPlatformFees: FieldValue.increment(-order.amount),
            outstandingFeeContracts: FieldValue.arrayRemove(order.contractId),
            updatedAt: FieldValue.serverTimestamp(),
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
                unsuspendedAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
              });

              // Notify unsuspension
              await db.collection(`users/${platformFeePayerId}/notifications`).doc().set({
                type: 'ACCOUNT_UNSUSPENDED',
                title: 'Account Reactivated',
                message: 'Your account has been reactivated. All platform fees have been paid.',
                data: { contractId: order.contractId },
                isRead: false,
                createdAt: FieldValue.serverTimestamp(),
              });
            }
          }

          // Notify payer
          await db.collection(`users/${submission.userId}/notifications`).doc().set({
            type: 'PAYMENT_VERIFIED',
            title: 'Platform Fee Paid',
            message: nextStatus === 'draft'
              ? `Your platform fee payment has been verified for Contract #${contract.contractNumber}. The contract is ready for signing.`
              : `Your platform fee payment has been verified for Contract #${contract.contractNumber}. Contract status remains ${humanStatus}.`,
            data: {
              submissionId,
              contractId: order.contractId,
              bidId: order.bidId,
            },
            isRead: false,
            createdAt: FieldValue.serverTimestamp(),
          });

          // Notify counterparty
          const listingOwnerId = contract.listingOwnerId;
          if (listingOwnerId && listingOwnerId !== submission.userId) {
            await db.collection(`users/${listingOwnerId}/notifications`).doc().set({
              type: 'CONTRACT_READY',
              title: nextStatus === 'draft' ? 'Contract Ready for Signing' : 'Platform Fee Settled',
              message: nextStatus === 'draft'
                ? `Contract #${contract.contractNumber} platform fee has been paid. Please review and sign the contract.`
                : `Contract #${contract.contractNumber} platform fee has been paid. Contract status remains ${humanStatus}.`,
              data: {
                contractId: order.contractId,
                bidId: order.bidId,
              },
              isRead: false,
              createdAt: FieldValue.serverTimestamp(),
            });
          }
        }
      } else {
        console.warn('No contractId found in order - this should not happen with new flow');
      }
    } catch (error) {
      console.error('Error updating contract payment status:', safeErrorMessage(error));
      // Notify user of error
      await db.collection(`users/${submission.userId}/notifications`).doc().set({
        type: 'PAYMENT_STATUS',
        title: 'Payment Verified',
        message: 'Your payment has been verified, but there was an issue updating the contract. Our team will assist you.',
        data: { submissionId, error: error.message },
        isRead: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  } else {
    // Legacy: wallet top-up flow (kept for backward compatibility)

    const batch = db.batch();

    // Credit user's wallet
    const walletRef = db.collection('users').doc(submission.userId).collection('wallet').doc('main');
    const walletDoc = await walletRef.get();

    if (walletDoc.exists) {
      batch.update(walletRef, {
        balance: FieldValue.increment(order.amount),
        updatedAt: FieldValue.serverTimestamp()
      });
    } else {
      batch.set(walletRef, {
        balance: order.amount,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
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
      createdAt: FieldValue.serverTimestamp()
    });

    await batch.commit();
  }
}

/**
 * Reject payment - update order status
 */
async function rejectPayment(orderId, errors) {
  await db.collection('orders').doc(orderId).update({
    status: 'rejected',
    rejectionReason: errors.join('; '),
    rejectedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
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
    createdAt: FieldValue.serverTimestamp()
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
      createdAt: FieldValue.serverTimestamp()
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
exports.adminApprovePayment = onCall(
  { region: 'asia-southeast1' },
  async (request) => {
    const data = request.data || {};
    const context = request;
    await verifyAdmin(context);

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
      resolvedAt: FieldValue.serverTimestamp(),
      resolvedBy: context.auth.uid,
      resolutionNotes: notes || 'Manual approval by admin',
      updatedAt: FieldValue.serverTimestamp()
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
  }
);

/**
 * Admin Manual Rejection
 *
 * HTTPS Callable function for admin to manually reject a payment
 */
exports.adminRejectPayment = onCall(
  { region: 'asia-southeast1' },
  async (request) => {
    const data = request.data || {};
    const context = request;
    await verifyAdmin(context);

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
      resolvedAt: FieldValue.serverTimestamp(),
      resolvedBy: context.auth.uid,
      resolutionNotes: notes || reason || 'Rejected by admin',
      validationErrors: [...(submission.validationErrors || []), reason || 'Manual rejection'],
      updatedAt: FieldValue.serverTimestamp()
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
  }
);

/**
 * Get Admin Payment Stats
 *
 * HTTPS Callable function to get payment verification statistics
 */
exports.getPaymentStats = onCall(
  { region: 'asia-southeast1' },
  async (request) => {
    const context = request;
    await verifyAdmin(context);

    const getStartOfManilaDay = () => {
      // Convert current time to UTC then shift to UTC+8 (Asia/Manila),
      // truncate to local midnight, then shift back to UTC.
      const now = new Date();
      const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
      const manilaMs = utcMs + (8 * 60 * 60 * 1000);
      const manilaDate = new Date(manilaMs);
      manilaDate.setHours(0, 0, 0, 0);
      const startUtcMs = manilaDate.getTime() - (8 * 60 * 60 * 1000);
      return admin.firestore.Timestamp.fromDate(new Date(startUtcMs));
    };

    // Get counts for each status
    const [pending, approved, rejected, review] = await Promise.all([
      db.collection('paymentSubmissions').where('status', '==', 'pending').count().get(),
      db.collection('paymentSubmissions').where('status', '==', 'approved').count().get(),
      db.collection('paymentSubmissions').where('status', '==', 'rejected').count().get(),
      db.collection('paymentSubmissions').where('status', '==', 'manual_review').count().get()
    ]);

    const startOfDay = getStartOfManilaDay();
    const [approvedTodaySnapshot, rejectedTodaySnapshot] = await Promise.all([
      db.collection('paymentSubmissions')
        .where('status', '==', 'approved')
        .where('resolvedAt', '>=', startOfDay)
        .get(),
      db.collection('paymentSubmissions')
        .where('status', '==', 'rejected')
        .where('resolvedAt', '>=', startOfDay)
        .get(),
    ]);

    const approvedToday = approvedTodaySnapshot.size;
    const rejectedToday = rejectedTodaySnapshot.size;

    const parseAmount = (raw) => {
      if (raw === null || raw === undefined) return 0;
      if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
      if (typeof raw === 'string') {
        const normalized = raw.replace(/[^0-9.-]/g, '');
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : 0;
      }
      return 0;
    };

    let totalAmountToday = 0;
    const fallbackOrderIds = [];

    approvedTodaySnapshot.docs.forEach((docSnap) => {
      const submission = docSnap.data() || {};
      const candidateAmount =
        parseAmount(submission.orderAmount) ||
        parseAmount(submission.amount) ||
        parseAmount(submission.extractedData?.amount);

      if (candidateAmount > 0) {
        totalAmountToday += candidateAmount;
      } else if (submission.orderId) {
        fallbackOrderIds.push(submission.orderId);
      }
    });

    if (fallbackOrderIds.length > 0) {
      try {
        const uniqueOrderIds = [...new Set(fallbackOrderIds)];
        const orderRefs = uniqueOrderIds.map((orderId) => db.collection('orders').doc(orderId));
        const orderDocs = await db.getAll(...orderRefs);

        orderDocs.forEach((orderDoc) => {
          if (!orderDoc.exists) return;
          const order = orderDoc.data() || {};
          totalAmountToday += parseAmount(order.amount);
        });
      } catch (error) {
        console.error('Error resolving order amounts for payment stats:', safeErrorMessage(error));
      }
    }

    const payload = {
      pending: pending.data().count,
      approved: approved.data().count,
      rejected: rejected.data().count,
      pendingReview: review.data().count,
      total: pending.data().count + approved.data().count + rejected.data().count + review.data().count,
      approvedToday,
      rejectedToday,
      totalAmountToday,
    };

    return {
      ...payload,
      stats: payload,
    };
  }
);

/**
 * Set Admin Role
 *
 * Secure Cloud Function to grant/revoke admin privileges.
 * Can only be called by existing admins or via Firebase Admin SDK.
 * Also sets Firebase Custom Claims for secure rule verification.
 */
exports.setAdminRole = onCall(
  { region: 'asia-southeast1' },
  async (request) => {
    const data = request.data || {};
    const context = request;
    await verifyAdmin(context);

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
        role: isAdmin ? 'admin' : (targetDoc.data().role === 'admin' ? 'shipper' : targetDoc.data().role),
        adminGrantedBy: context.auth.uid,
        adminGrantedAt: FieldValue.serverTimestamp()
      });

      // Set Firebase Custom Claims for secure verification in rules
      await admin.auth().setCustomUserClaims(targetUserId, { admin: isAdmin });

      // Log the admin action
      await db.collection('adminLogs').add({
        action: isAdmin ? 'GRANT_ADMIN' : 'REVOKE_ADMIN',
        targetUserId,
        performedBy: context.auth.uid,
        performedAt: FieldValue.serverTimestamp()
      });

      return {
        success: true,
        message: `Admin privileges ${isAdmin ? 'granted' : 'revoked'} successfully`
      };
    } catch (error) {
      console.error('Error setting admin role:', error);
      throw new functions.https.HttpsError('internal', 'Failed to update admin privileges');
    }
  }
);

/**
 * Initialize First Admin (One-time setup)
 *
 * This function can only be called ONCE when there are no admins in the system.
 * After the first admin is created, this function will reject all future calls.
 * Use this to bootstrap the admin system.
 */
exports.initializeFirstAdmin = onCall(
  { region: 'asia-southeast1' },
  async (request) => {
    const data = request.data || {};
    const context = request;
    // Must be authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const configuredBootstrapKey = process.env.INIT_ADMIN_KEY;
    const providedBootstrapKey = data?.bootstrapKey;
    if (!configuredBootstrapKey) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'First-admin bootstrap is disabled. Set INIT_ADMIN_KEY to enable it temporarily.'
      );
    }

    if (providedBootstrapKey !== configuredBootstrapKey) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Invalid bootstrap key'
      );
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
        adminGrantedAt: FieldValue.serverTimestamp(),
        adminGrantedBy: 'SYSTEM_INIT',
        updatedAt: FieldValue.serverTimestamp()
      });

      // Set Firebase Custom Claims
      await admin.auth().setCustomUserClaims(context.auth.uid, { admin: true });

      // Log the initialization
      await db.collection('adminLogs').add({
        action: 'FIRST_ADMIN_INIT',
        targetUserId: context.auth.uid,
        performedBy: 'SYSTEM',
        performedAt: FieldValue.serverTimestamp()
      });

      return {
        success: true,
        message: 'You are now the first admin. You can grant admin privileges to others using setAdminRole.'
      };
    } catch (error) {
      console.error('Error initializing first admin:', error);
      throw new functions.https.HttpsError('internal', 'Failed to initialize admin');
    }
  }
);

// =============================================================================
// SECURITY MONITORING FUNCTIONS
// =============================================================================

/**
 * Security Monitor: Detect privilege escalation on user creation
 * This is a defense-in-depth measure in case Firestore rules are misconfigured
 */
exports.validateUserCreation = onDocumentCreated(
  {
    region: 'asia-southeast1',
    document: 'users/{userId}',
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const userData = snap.data();
    const userId = event.params.userId;

    // Check for unauthorized admin privileges
    const hasUnauthorizedAdmin = userData.isAdmin === true || userData.role === 'admin';

    if (hasUnauthorizedAdmin) {
      console.error(`SECURITY ALERT: Unauthorized admin privilege escalation detected for user ${userId}`);

      // Immediately revoke admin privileges
      await snap.ref.update({
        isAdmin: false,
        role: 'shipper', // Reset to default
        securityFlagReason: 'Unauthorized admin privilege attempt during creation',
        securityFlaggedAt: FieldValue.serverTimestamp()
      });

      // Log security incident
      await db.collection('securityIncidents').add({
        type: 'PRIVILEGE_ESCALATION_ATTEMPT',
        userId,
        attemptedPrivileges: {
          isAdmin: userData.isAdmin,
          role: userData.role
        },
        detectedAt: FieldValue.serverTimestamp(),
        remediationAction: 'Privileges auto-revoked, account disabled'
      });

      // Auto-disable account pending investigation
      await admin.auth().updateUser(userId, { disabled: true });
    }
  }
);

/**
 * Scheduled Security Audit: Check for unauthorized admin accounts
 * Runs daily at 2 AM Manila time
 */
exports.auditAdminAccounts = onSchedule(
  {
    region: 'asia-southeast1',
    schedule: '0 2 * * *',
    timeZone: 'Asia/Manila',
  },
  async () => {

    // Get all admin users
    const adminsByRole = await db.collection('users')
      .where('role', '==', 'admin')
      .get();

    const adminsByFlag = await db.collection('users')
      .where('isAdmin', '==', true)
      .get();

    // Combine and deduplicate
    const adminIds = new Set([
      ...adminsByRole.docs.map(doc => doc.id),
      ...adminsByFlag.docs.map(doc => doc.id)
    ]);

    // Check each admin for authorization trail
    const unauthorizedAdmins = [];

    for (const adminId of adminIds) {
      const adminDoc = await db.collection('users').doc(adminId).get();
      const adminData = adminDoc.data();

      // Check if admin was properly granted (has adminGrantedBy field)
      if (!adminData.adminGrantedBy && !adminData.adminGrantedAt) {
        unauthorizedAdmins.push({
          userId: adminId,
          email: adminData.email,
          phone: adminData.phone,
          createdAt: adminData.createdAt,
          reason: 'Missing admin grant audit trail'
        });
      }
    }

    if (unauthorizedAdmins.length > 0) {
      console.error(`SECURITY ALERT: Found ${unauthorizedAdmins.length} unauthorized admin accounts`);

      // Log incident
      await db.collection('securityIncidents').add({
        type: 'UNAUTHORIZED_ADMIN_ACCOUNTS_DETECTED',
        count: unauthorizedAdmins.length,
        accounts: unauthorizedAdmins,
        detectedAt: FieldValue.serverTimestamp()
      });

      // Notify legitimate admins about unauthorized accounts
      const [legitimateByRole, legitimateByFlag] = await Promise.all([
        db.collection('users').where('role', '==', 'admin').where('adminGrantedBy', '!=', null).limit(10).get(),
        db.collection('users').where('isAdmin', '==', true).where('adminGrantedBy', '!=', null).limit(10).get()
      ]);

      const notifiedIds = new Set();
      const legitimateDocs = [...legitimateByRole.docs, ...legitimateByFlag.docs];
      const alertBatch = db.batch();

      for (const adminDoc of legitimateDocs) {
        if (notifiedIds.has(adminDoc.id)) continue;
        notifiedIds.add(adminDoc.id);

        const notifRef = db.collection('users').doc(adminDoc.id).collection('notifications').doc();
        alertBatch.set(notifRef, {
          type: 'SECURITY_ALERT',
          title: 'Unauthorized Admin Accounts Detected',
          message: `Security audit found ${unauthorizedAdmins.length} admin account(s) without proper authorization trail. Investigate immediately.`,
          data: { count: unauthorizedAdmins.length, detectedAt: new Date().toISOString() },
          isRead: false,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      if (notifiedIds.size > 0) {
        await alertBatch.commit();
      }
    }

    return null;
  }
);

// =============================================================================
// CONTRACT MANAGEMENT FUNCTIONS
// =============================================================================

const contractFunctions = require('./src/api/contracts');
exports.createContract = contractFunctions.createContract;
exports.signContract = contractFunctions.signContract;
exports.completeContract = contractFunctions.completeContract;
exports.cancelContract = contractFunctions.cancelContract;
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
exports.getOrder = walletFunctions.getOrder;
exports.getPendingOrders = walletFunctions.getPendingOrders;

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
exports.adminGetSystemSettings = adminFunctions.adminGetSystemSettings;
exports.adminUpdateSystemSettings = adminFunctions.adminUpdateSystemSettings;
exports.adminGetPendingPayments = adminFunctions.adminGetPendingPayments;
exports.adminGetUsers = adminFunctions.adminGetUsers;
exports.adminSuspendUser = adminFunctions.adminSuspendUser;
exports.adminActivateUser = adminFunctions.adminActivateUser;
exports.adminVerifyUser = adminFunctions.adminVerifyUser;
exports.adminToggleAdmin = adminFunctions.adminToggleAdmin;
exports.adminGetFinancialSummary = adminFunctions.adminGetFinancialSummary;
exports.adminResolveDispute = adminFunctions.adminResolveDispute;
exports.adminGetContracts = adminFunctions.adminGetContracts;
exports.adminDeactivateListing = adminFunctions.adminDeactivateListing;
exports.adminDeleteRating = adminFunctions.adminDeleteRating;
exports.adminGetOutstandingFees = adminFunctions.adminGetOutstandingFees;
exports.adminReconcileOutstandingFees = adminFunctions.adminReconcileOutstandingFees;
exports.adminGetMarketplaceKpis = adminFunctions.adminGetMarketplaceKpis;

// =============================================================================
// ACCOUNT RECOVERY FUNCTIONS
// =============================================================================

const recoveryFunctions = require('./src/api/recovery');
exports.authGetRecoveryStatus = recoveryFunctions.authGetRecoveryStatus;
exports.authGenerateRecoveryCodes = recoveryFunctions.authGenerateRecoveryCodes;
exports.authRecoverySignIn = recoveryFunctions.authRecoverySignIn;

// =============================================================================
// AUTH FUNCTIONS
// =============================================================================

const authFunctions = require('./src/api/auth');
exports.switchUserRole = authFunctions.switchUserRole;

// =============================================================================
// BROKER REFERRAL FUNCTIONS
// =============================================================================

const referralFunctions = require('./src/api/referrals');
exports.brokerRegister = referralFunctions.brokerRegister;
exports.brokerApplyReferralCode = referralFunctions.brokerApplyReferralCode;
exports.brokerGetDashboard = referralFunctions.brokerGetDashboard;
exports.brokerRequestPayout = referralFunctions.brokerRequestPayout;
exports.adminGetBrokers = referralFunctions.adminGetBrokers;
exports.adminUpdateBrokerTier = referralFunctions.adminUpdateBrokerTier;
exports.adminGetBrokerPayoutRequests = referralFunctions.adminGetBrokerPayoutRequests;
exports.adminReviewBrokerPayout = referralFunctions.adminReviewBrokerPayout;
exports.adminGetBrokerReferralReport = referralFunctions.adminGetBrokerReferralReport;

// =============================================================================
// ROUTE OPTIMIZATION FUNCTIONS
// =============================================================================

const listingFunctions = require('./src/api/listings');
exports.findBackloadOpportunities = listingFunctions.findBackloadOpportunities;
exports.getPopularRoutes = listingFunctions.getPopularRoutes;
exports.requestListingChat = listingFunctions.requestListingChat;

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

const referralTriggers = require('./src/triggers/referralTriggers');
exports.onPlatformFeeCompleted = referralTriggers.onPlatformFeeCompleted;

// =============================================================================
// SCHEDULED FUNCTIONS
// =============================================================================

const platformFeeReminders = require('./src/scheduled/platformFeeReminders');
exports.sendPlatformFeeReminders = platformFeeReminders.sendPlatformFeeReminders;

// =============================================================================
// ROUTING PROXY - Avoids CORS restrictions on OpenRouteService from the browser
// =============================================================================

function parseNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isValidLongitude(value) {
  return typeof value === 'number' && value >= -180 && value <= 180;
}

function isValidLatitude(value) {
  return typeof value === 'number' && value >= -90 && value <= 90;
}

function getSingleQueryParam(rawValue) {
  if (Array.isArray(rawValue)) {
    return rawValue.length > 0 ? String(rawValue[0]) : null;
  }
  if (rawValue === undefined || rawValue === null) return null;
  return String(rawValue);
}

function buildRoutePayload(body) {
  const coordinates = body?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length !== 2) {
    return null;
  }

  const start = coordinates[0];
  const end = coordinates[1];
  if (!Array.isArray(start) || start.length !== 2 || !Array.isArray(end) || end.length !== 2) {
    return null;
  }

  const startLng = parseNumber(start[0]);
  const startLat = parseNumber(start[1]);
  const endLng = parseNumber(end[0]);
  const endLat = parseNumber(end[1]);

  if (
    !isValidLongitude(startLng) ||
    !isValidLatitude(startLat) ||
    !isValidLongitude(endLng) ||
    !isValidLatitude(endLat)
  ) {
    return null;
  }

  return {
    coordinates: [
      [startLng, startLat],
      [endLng, endLat],
    ],
    format: body?.format === 'geojson' ? 'geojson' : 'json',
    instructions: body?.instructions === true,
  };
}

function buildGeocodeParams(endpoint, query) {
  const params = new URLSearchParams();
  const sharedAllowed = new Set([
    'text',
    'size',
    'boundary.country',
    'focus.point.lat',
    'focus.point.lon',
    'layers',
  ]);
  const reverseAllowed = new Set(['point.lat', 'point.lon', 'size']);
  const allowedKeys = endpoint === 'reverse' ? reverseAllowed : sharedAllowed;

  for (const key of allowedKeys) {
    const value = getSingleQueryParam(query[key]);
    if (value === null) continue;
    if (value.length > 140) return null;
    params.set(key, value);
  }

  const sizeValue = getSingleQueryParam(query.size);
  const size = parseInt(sizeValue || '5', 10);
  params.set('size', String(Math.min(Math.max(Number.isFinite(size) ? size : 5, 1), 10)));

  if (endpoint !== 'reverse' && !params.has('boundary.country')) {
    params.set('boundary.country', 'PH');
  }

  if (endpoint === 'reverse') {
    const lat = parseNumber(params.get('point.lat'));
    const lon = parseNumber(params.get('point.lon'));
    if (!isValidLatitude(lat) || !isValidLongitude(lon)) {
      return null;
    }
  } else {
    const text = params.get('text');
    if (!text || text.trim().length < 2) {
      return null;
    }
  }

  return params;
}

exports.getRoute = functions
  .region('asia-southeast1')
  .https.onRequest(async (req, res) => {
    applyCors(req, res, {
      methods: 'POST, OPTIONS',
      headers: 'Content-Type, X-Firebase-AppCheck',
    });

    if (req.method === 'OPTIONS') {
      return res.status(204).send('');
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!(await verifyHttpAppCheckToken(req, res))) {
      return;
    }

    const apiKey = process.env.OPENROUTE_API_KEY;
    const payload = buildRoutePayload(req.body);

    if (!payload) {
      return res.status(400).json({ error: 'Invalid route payload' });
    }

    if (!apiKey) {
      return res.status(200).json({
        routes: [],
        error: 'Routing service not configured',
      });
    }

    try {
      const response = await axios.post(
        'https://api.openrouteservice.org/v2/directions/driving-car',
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': apiKey,
          },
          timeout: 10000,
          validateStatus: null, // Forward all status codes
        }
      );

      if (response.status >= 200 && response.status < 300) {
        return res.status(200).json(response.data);
      }

      // Normalize upstream route failures to HTTP 200 so frontend can silently
      // fallback to straight-line estimation without noisy network errors.
      return res.status(200).json({
        routes: [],
        upstreamStatus: response.status,
        upstreamError: response.data || null,
      });
    } catch (err) {
      return res.status(200).json({
        routes: [],
        error: 'Failed to reach routing service',
      });
    }
  });

exports.geocode = functions
  .region('asia-southeast1')
  .https.onRequest(async (req, res) => {
    applyCors(req, res, {
      methods: 'GET, OPTIONS',
      headers: 'Content-Type, X-Firebase-AppCheck',
    });

    if (req.method === 'OPTIONS') {
      return res.status(204).send('');
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!(await verifyHttpAppCheckToken(req, res))) {
      return;
    }

    const apiKey = process.env.OPENROUTE_API_KEY;
    if (!apiKey) {
      return res.status(200).json({ features: [] });
    }

    const endpoint = getSingleQueryParam(req.query.endpoint);
    const allowedEndpoints = new Set(['search', 'autocomplete', 'reverse']);
    if (!allowedEndpoints.has(endpoint)) {
      return res.status(400).json({ error: 'Invalid endpoint' });
    }

    const params = buildGeocodeParams(endpoint, req.query);
    if (!params) {
      return res.status(400).json({ error: 'Invalid geocode parameters' });
    }

    params.set('api_key', apiKey);
    const orsUrl = `https://api.openrouteservice.org/geocode/${endpoint}?${params.toString()}`;

    try {
      const response = await axios.get(orsUrl, {
        timeout: 8000,
        validateStatus: null,
      });
      if (response.status >= 200 && response.status < 300) {
        return res.status(200).json(response.data);
      }
      return res.status(200).json({ features: [] });
    } catch (error) {
      return res.status(200).json({ features: [] });
    }
  });
