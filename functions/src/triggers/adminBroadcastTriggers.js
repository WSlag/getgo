/**
 * Admin Broadcast Triggers
 * Processes queued admin broadcast jobs and delivers in-app notifications.
 * Optional SMS delivery is fanned out into a dedicated queue collection.
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');
const { sendPushToUser } = require('../services/fcmService');
const { normalizePhoneNumber } = require('../services/smsGateService');

const REGION = 'asia-southeast1';
const BROADCAST_JOB_COLLECTION = 'adminBroadcastJobs';
const SMS_QUEUE_COLLECTION = 'adminBroadcastSmsQueue';
const USER_BATCH_SIZE = 300;
const SMS_AUDIENCE_MODE_ALL = 'all';
const SMS_AUDIENCE_MODE_PHONE_ALLOWLIST = 'phone_allowlist';

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

function isEligibleInAppRecipient(userData = {}) {
  if (userData.isActive === false) return false;
  const accountStatus = String(userData.accountStatus || 'active').trim().toLowerCase();
  if (accountStatus === 'suspended') return false;
  return true;
}

function resolveSmsAudience(rawSmsAudience = {}) {
  const mode = String(rawSmsAudience?.mode || '').trim().toLowerCase();
  const normalizedMode = mode === SMS_AUDIENCE_MODE_PHONE_ALLOWLIST
    ? SMS_AUDIENCE_MODE_PHONE_ALLOWLIST
    : SMS_AUDIENCE_MODE_ALL;
  const phoneAllowlistSet = new Set(
    (Array.isArray(rawSmsAudience?.phoneAllowlist) ? rawSmsAudience.phoneAllowlist : [])
      .map((value) => normalizePhoneNumber(value))
      .filter(Boolean)
  );

  return {
    mode: normalizedMode,
    phoneAllowlistSet,
    phoneAllowlistCount: phoneAllowlistSet.size,
  };
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
      smsStatus: data?.channels?.sms === true ? 'processing' : (data.smsStatus || 'disabled'),
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

async function incrementJobSmsProgress(jobRef, deltas = {}, extra = {}) {
  const payload = {
    ...extra,
    updatedAt: FieldValue.serverTimestamp(),
  };

  Object.entries(deltas).forEach(([key, delta]) => {
    if (!Number.isFinite(delta) || delta === 0) return;
    payload[`smsProgress.${key}`] = FieldValue.increment(delta);
  });

  await jobRef.update(payload);
}

async function processBroadcastJob({ db, jobId, jobRef, jobData, stats }) {
  const title = normalizeTrimmedText(jobData.title);
  const message = normalizeTrimmedText(jobData.message);
  if (!title || !message) {
    throw new Error('Broadcast job is missing title or message');
  }

  const channels = jobData.channels || {};
  const inAppEnabled = channels.inApp !== false;
  const smsEnabled = channels.sms === true;
  const smsConfig = jobData.smsConfig || {};
  const smsAudience = resolveSmsAudience(jobData.smsAudience || {});
  const smsPhoneAllowlistEnabled = smsEnabled && smsAudience.mode === SMS_AUDIENCE_MODE_PHONE_ALLOWLIST;
  const matchedAllowlistPhones = new Set();
  const smsStats = {
    totalUsers: Number(jobData?.smsProgress?.totalUsers || 0),
    queuedUsers: Number(jobData?.smsProgress?.queuedUsers || 0),
    processedUsers: Number(jobData?.smsProgress?.processedUsers || 0),
    sentUsers: Number(jobData?.smsProgress?.sentUsers || 0),
    failedUsers: Number(jobData?.smsProgress?.failedUsers || 0),
    noPhoneUsers: Number(jobData?.smsProgress?.noPhoneUsers || 0),
    retryAttempts: Number(jobData?.smsProgress?.retryAttempts || 0),
    filteredOutUsers: Number(jobData?.smsProgress?.filteredOutUsers || 0),
    unmatchedAllowlistPhones: Number(jobData?.smsProgress?.unmatchedAllowlistPhones || 0),
  };

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
    const smsDelta = {
      totalUsers: 0,
      queuedUsers: 0,
      noPhoneUsers: 0,
      filteredOutUsers: 0,
    };

    usersSnap.docs.forEach((userDoc) => {
      const userData = userDoc.data() || {};

      if (inAppEnabled) {
        stats.totalUsers += 1;
        stats.processedUsers += 1;

        if (!isEligibleInAppRecipient(userData)) {
          stats.skippedUsers += 1;
        } else {
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
        }
      }

      if (smsEnabled) {
        smsStats.totalUsers += 1;
        smsDelta.totalUsers += 1;
        const normalizedPhone = normalizePhoneNumber(userData.phone || null);
        if (!normalizedPhone) {
          smsStats.noPhoneUsers += 1;
          smsDelta.noPhoneUsers += 1;
          return;
        }
        if (smsPhoneAllowlistEnabled && !smsAudience.phoneAllowlistSet.has(normalizedPhone)) {
          smsStats.filteredOutUsers += 1;
          smsDelta.filteredOutUsers += 1;
          return;
        }
        if (smsPhoneAllowlistEnabled) {
          matchedAllowlistPhones.add(normalizedPhone);
        }

        const queueRef = db.collection(SMS_QUEUE_COLLECTION).doc(`${jobId}_${userDoc.id}`);
        batch.set(queueRef, {
          jobId,
          userId: userDoc.id,
          phoneNumber: normalizedPhone,
          title,
          message,
          status: 'queued',
          attempts: 0,
          maxRetries: Number(smsConfig.maxRetries || 3),
          retryBaseDelayMs: Number(smsConfig.retryBaseDelayMs || 1000),
          timeoutMs: Number(smsConfig.timeoutMs || 15000),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          lastError: null,
        }, { merge: false });
        batchWriteCount += 1;
        smsStats.queuedUsers += 1;
        smsDelta.queuedUsers += 1;
      }
    });

    if (batchWriteCount > 0) {
      await batch.commit();
    }

    if (inAppEnabled) {
      // Push notifications remain best-effort and non-fatal.
      await Promise.allSettled(
        pushRecipientIds.map((uid) =>
          sendPushToUser(db, uid, { title, body: message, data: { type: 'ADMIN_MESSAGE', jobId } }).catch((pushErr) => {
            console.error(`[adminBroadcastTriggers] Push failed for uid=${uid} (non-fatal):`, pushErr.message);
          })
        )
      );
    }

    cursorDoc = usersSnap.docs[usersSnap.docs.length - 1] || null;
    await updateJobProgress(jobRef, stats, {
      lastProcessedUserId: cursorDoc ? cursorDoc.id : null,
    });
    if (smsEnabled) {
      await incrementJobSmsProgress(jobRef, smsDelta, {
        smsStatus: 'processing',
        smsEnqueueComplete: false,
      });
    }

    hasMore = usersSnap.size === USER_BATCH_SIZE;
  }

  if (smsPhoneAllowlistEnabled) {
    smsStats.unmatchedAllowlistPhones = Math.max(
      smsAudience.phoneAllowlistCount - matchedAllowlistPhones.size,
      0
    );
    await jobRef.update({
      updatedAt: FieldValue.serverTimestamp(),
      'smsProgress.unmatchedAllowlistPhones': smsStats.unmatchedAllowlistPhones,
    });
  }

  return {
    inAppEnabled,
    smsEnabled,
    smsAudienceMode: smsAudience.mode,
    smsAudienceAllowlistCount: smsAudience.phoneAllowlistCount,
    smsFilteredOutUsers: smsStats.filteredOutUsers,
    smsUnmatchedAllowlistPhones: smsStats.unmatchedAllowlistPhones,
    smsQueuedUsers: smsStats.queuedUsers,
    smsNoPhoneUsers: smsStats.noPhoneUsers,
    smsTotalUsers: smsStats.totalUsers,
  };
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

      const result = await processBroadcastJob({
        db,
        jobId,
        jobRef,
        jobData,
        stats,
      });

      const shouldFinalizeNow = !result.smsEnabled || result.smsQueuedUsers === 0;
      await updateJobProgress(jobRef, stats, {
        status: shouldFinalizeNow ? 'completed' : 'processing',
        completedAt: shouldFinalizeNow ? FieldValue.serverTimestamp() : null,
        lastProcessedUserId: null,
        smsStatus: result.smsEnabled
          ? (result.smsQueuedUsers > 0 ? 'processing' : 'completed')
          : 'disabled',
        smsEnqueueComplete: true,
        error: null,
      });
      console.log('[onAdminBroadcastJobCreated] Broadcast enqueue completed', {
        jobId,
        inAppEnabled: result.inAppEnabled,
        smsEnabled: result.smsEnabled,
        smsAudienceMode: result.smsAudienceMode,
        smsAudienceAllowlistCount: result.smsAudienceAllowlistCount,
        smsQueuedUsers: result.smsQueuedUsers,
        smsTotalUsers: result.smsTotalUsers,
        smsNoPhoneUsers: result.smsNoPhoneUsers,
        smsFilteredOutUsers: result.smsFilteredOutUsers,
        smsUnmatchedAllowlistPhones: result.smsUnmatchedAllowlistPhones,
      });

      return null;
    } catch (error) {
      console.error('[onAdminBroadcastJobCreated] Failed broadcast job', {
        jobId,
        error: safeErrorMessage(error),
      });
      await updateJobProgress(jobRef, stats, {
        status: 'failed',
        smsStatus: 'failed',
        smsEnqueueComplete: true,
        failedAt: FieldValue.serverTimestamp(),
        error: safeErrorMessage(error),
      });
      return null;
    }
  }
);
