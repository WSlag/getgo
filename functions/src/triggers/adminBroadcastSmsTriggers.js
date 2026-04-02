/**
 * Admin Broadcast SMS Triggers
 * Processes queued SMS broadcast items via SMSGate Cloud API.
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');
const { sendSmsViaSmsGate } = require('../services/smsGateService');

const REGION = 'asia-southeast1';
const BROADCAST_JOB_COLLECTION = 'adminBroadcastJobs';
const SMS_QUEUE_COLLECTION = 'adminBroadcastSmsQueue';

function safeErrorMessage(error) {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  return error.message || 'Unknown error';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function claimSmsQueueItem(queueRef) {
  const db = admin.firestore();
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(queueRef);
    if (!snap.exists) return null;
    const data = snap.data() || {};
    if (data.status !== 'queued') return null;

    tx.update(queueRef, {
      status: 'processing',
      processingStartedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      lastError: null,
    });
    return data;
  });
}

async function bumpSmsProgress(jobRef, increments = {}, extra = {}) {
  const payload = {
    updatedAt: FieldValue.serverTimestamp(),
    ...extra,
  };

  Object.entries(increments).forEach(([key, delta]) => {
    if (!Number.isFinite(delta) || delta === 0) return;
    payload[`smsProgress.${key}`] = FieldValue.increment(delta);
  });

  await jobRef.set(payload, { merge: true });
}

async function finalizeSmsJobIfDone(jobRef) {
  const snapshot = await jobRef.get();
  if (!snapshot.exists) return;
  const data = snapshot.data() || {};
  if (data.smsEnqueueComplete !== true) return;

  const smsProgress = data.smsProgress || {};
  const queuedUsers = Number(smsProgress.queuedUsers || 0);
  const processedUsers = Number(smsProgress.processedUsers || 0);
  if (processedUsers < queuedUsers) return;

  const patch = {
    smsStatus: 'completed',
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (String(data.status || '').toLowerCase() !== 'failed') {
    patch.status = 'completed';
    patch.completedAt = FieldValue.serverTimestamp();
    patch.error = null;
  }
  await jobRef.set(patch, { merge: true });
}

exports.onAdminBroadcastSmsQueued = onDocumentCreated(
  {
    region: REGION,
    document: `${SMS_QUEUE_COLLECTION}/{queueId}`,
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return null;

    const { queueId } = event.params;
    const db = admin.firestore();
    const queueRef = db.collection(SMS_QUEUE_COLLECTION).doc(queueId);
    const queueData = await claimSmsQueueItem(queueRef);
    if (!queueData) return null;

    const jobId = String(queueData.jobId || '').trim();
    if (!jobId) {
      await queueRef.set({
        status: 'failed',
        updatedAt: FieldValue.serverTimestamp(),
        lastError: 'missing_job_id',
      }, { merge: true });
      return null;
    }
    const jobRef = db.collection(BROADCAST_JOB_COLLECTION).doc(jobId);

    const maxRetries = Math.min(Math.max(Number(queueData.maxRetries || process.env.SMSGATE_MAX_RETRIES || 3), 0), 10);
    const retryBaseDelayMs = Math.min(
      Math.max(Number(queueData.retryBaseDelayMs || process.env.SMSGATE_RETRY_BASE_DELAY_MS || 1000), 100),
      60000
    );
    const timeoutMs = Math.min(Math.max(Number(queueData.timeoutMs || process.env.SMSGATE_TIMEOUT_MS || 15000), 1000), 60000);

    const message = String(queueData.message || '').trim();
    const phoneNumber = String(queueData.phoneNumber || '').trim();
    let sent = false;
    let lastError = null;
    let retryAttempts = 0;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        await sendSmsViaSmsGate({
          to: phoneNumber,
          message,
          config: { timeoutMs },
        });
        sent = true;
        await queueRef.set({
          status: 'sent',
          attempts: attempt + 1,
          sentAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          lastError: null,
        }, { merge: true });
        await bumpSmsProgress(jobRef, {
          processedUsers: 1,
          sentUsers: 1,
        });
        break;
      } catch (error) {
        lastError = error;
        const isRetriable = error?.retriable === true;
        const hasAttemptsLeft = attempt < maxRetries;
        await queueRef.set({
          attempts: attempt + 1,
          updatedAt: FieldValue.serverTimestamp(),
          lastError: safeErrorMessage(error),
        }, { merge: true });

        if (!isRetriable || !hasAttemptsLeft) {
          await queueRef.set({
            status: 'failed',
            failedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
          await bumpSmsProgress(jobRef, {
            processedUsers: 1,
            failedUsers: 1,
            retryAttempts,
          }, {
            smsStatus: 'processing',
          });
          break;
        }

        retryAttempts += 1;
        const delayMs = Math.min(retryBaseDelayMs * (2 ** attempt), 120000);
        console.warn('[onAdminBroadcastSmsQueued] Retrying SMS send', {
          queueId,
          jobId,
          attempt: attempt + 1,
          maxRetries,
          delayMs,
          error: safeErrorMessage(error),
        });
        await sleep(delayMs);
      }
    }

    if (sent) {
      if (retryAttempts > 0) {
        await bumpSmsProgress(jobRef, { retryAttempts });
      }
    } else {
      console.error('[onAdminBroadcastSmsQueued] SMS send failed', {
        queueId,
        jobId,
        error: safeErrorMessage(lastError),
      });
    }

    await finalizeSmsJobIfDone(jobRef);
    return null;
  }
);
