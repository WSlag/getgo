/**
 * Admin Broadcast Triggers
 * Processes queued admin broadcast jobs and delivers notifications to active users.
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');
const { sendPushToUser } = require('../services/fcmService');

const REGION = 'asia-southeast1';
const BROADCAST_JOB_COLLECTION = 'adminBroadcastJobs';
const USER_BATCH_SIZE = 300;

function safeErrorMessage(error) {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  return error.message || 'Unknown error';
}

function normalizeTrimmedText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeRole(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'shipper' || normalized === 'trucker' || normalized === 'broker') {
    return normalized;
  }
  return null;
}

function resolveNotificationRole(userData = {}) {
  const explicitRole = normalizeRole(userData.role);
  if (explicitRole) return explicitRole;
  if (userData.isBroker === true) return 'broker';
  return null;
}

function isEligibleRecipient(userData = {}) {
  if (userData.isActive === false) return false;
  const accountStatus = String(userData.accountStatus || 'active').trim().toLowerCase();
  if (accountStatus === 'suspended') return false;
  return true;
}

function buildProgress(stats = {}) {
  return {
    totalUsers: Number(stats.totalUsers || 0),
    processedUsers: Number(stats.processedUsers || 0),
    deliveredUsers: Number(stats.deliveredUsers || 0),
    skippedUsers: Number(stats.skippedUsers || 0),
    failedUsers: Number(stats.failedUsers || 0),
  };
}

function buildBroadcastNotification({ jobId, title, message, createdBy, role }) {
  const payload = {
    type: 'ADMIN_MESSAGE',
    title,
    message,
    data: {
      source: 'admin_broadcast',
      jobId,
      createdBy: createdBy || null,
    },
    isRead: false,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (role) {
    payload.workspaceRole = role;
    payload.forRole = role;
  }

  return payload;
}

async function claimQueuedJob(jobRef) {
  const db = admin.firestore();
  return db.runTransaction(async (tx) => {
    const fresh = await tx.get(jobRef);
    if (!fresh.exists) return null;

    const data = fresh.data() || {};
    if (data.status !== 'queued') return null;

    tx.update(jobRef, {
      status: 'processing',
      startedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      error: null,
    });

    return data;
  });
}

async function updateJobProgress(jobRef, stats, extra = {}) {
  await jobRef.set({
    ...extra,
    updatedAt: FieldValue.serverTimestamp(),
    totalUsers: Number(stats.totalUsers || 0),
    processedUsers: Number(stats.processedUsers || 0),
    deliveredUsers: Number(stats.deliveredUsers || 0),
    skippedUsers: Number(stats.skippedUsers || 0),
    failedUsers: Number(stats.failedUsers || 0),
    progress: buildProgress(stats),
  }, { merge: true });
}

async function processBroadcastJob({ db, jobId, jobRef, jobData, stats }) {
  const title = normalizeTrimmedText(jobData.title);
  const message = normalizeTrimmedText(jobData.message);
  if (!title || !message) {
    throw new Error('Broadcast job is missing title or message');
  }

  let cursorDoc = null;
  let hasMore = true;
  while (hasMore) {
    let usersQuery = db.collection('users')
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(USER_BATCH_SIZE);
    if (cursorDoc) {
      usersQuery = usersQuery.startAfter(cursorDoc);
    }

    const usersSnap = await usersQuery.get();
    if (usersSnap.empty) break;

    const batch = db.batch();
    let batchWriteCount = 0;
    const pushRecipientIds = [];

    usersSnap.docs.forEach((userDoc) => {
      const userData = userDoc.data() || {};
      stats.totalUsers += 1;
      stats.processedUsers += 1;

      if (!isEligibleRecipient(userData)) {
        stats.skippedUsers += 1;
        return;
      }

      const role = resolveNotificationRole(userData);
      const notificationRef = userDoc.ref.collection('notifications').doc(`broadcast_${jobId}`);
      batch.set(
        notificationRef,
        buildBroadcastNotification({
          jobId,
          title,
          message,
          createdBy: jobData.createdBy,
          role,
        }),
        { merge: true }
      );
      batchWriteCount += 1;
      stats.deliveredUsers += 1;
      pushRecipientIds.push(userDoc.id);
    });

    if (batchWriteCount > 0) {
      await batch.commit();
    }

    // Fire push notifications for this page — non-fatal, run after Firestore commit
    await Promise.allSettled(
      pushRecipientIds.map((uid) =>
        sendPushToUser(db, uid, { title, body: message, data: { type: 'ADMIN_MESSAGE', jobId } }).catch((pushErr) => {
          console.error(`[adminBroadcastTriggers] Push failed for uid=${uid} (non-fatal):`, pushErr.message);
        })
      )
    );

    cursorDoc = usersSnap.docs[usersSnap.docs.length - 1] || null;
    await updateJobProgress(jobRef, stats, {
      lastProcessedUserId: cursorDoc ? cursorDoc.id : null,
    });

    hasMore = usersSnap.size === USER_BATCH_SIZE;
  }
}

exports.onAdminBroadcastJobCreated = onDocumentCreated(
  {
    region: REGION,
    document: `${BROADCAST_JOB_COLLECTION}/{jobId}`,
    timeoutSeconds: 540,
    memory: '1GiB',
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return null;

    const { jobId } = event.params;
    const db = admin.firestore();
    const jobRef = db.collection(BROADCAST_JOB_COLLECTION).doc(jobId);
    const stats = {
      totalUsers: 0,
      processedUsers: 0,
      deliveredUsers: 0,
      skippedUsers: 0,
      failedUsers: 0,
    };

    try {
      const jobData = await claimQueuedJob(jobRef);
      if (!jobData) return null;

      await processBroadcastJob({
        db,
        jobId,
        jobRef,
        jobData,
        stats,
      });

      await updateJobProgress(jobRef, stats, {
        status: 'completed',
        completedAt: FieldValue.serverTimestamp(),
        lastProcessedUserId: null,
        error: null,
      });

      return null;
    } catch (error) {
      console.error('[onAdminBroadcastJobCreated] Failed broadcast job', {
        jobId,
        error: safeErrorMessage(error),
      });
      await updateJobProgress(jobRef, stats, {
        status: 'failed',
        failedAt: FieldValue.serverTimestamp(),
        error: safeErrorMessage(error),
      });
      return null;
    }
  }
);
