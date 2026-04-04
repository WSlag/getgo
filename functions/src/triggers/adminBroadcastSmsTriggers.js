/**
 * Admin Broadcast SMS Triggers
 * Processes queued SMS broadcast items via SMSGate Cloud API.
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');
const { sendSmsViaSmsGate, waitForSmsGateFinalState } = require('../services/smsGateService');

const REGION = 'asia-southeast1';
const BROADCAST_JOB_COLLECTION = 'adminBroadcastJobs';
const SMS_QUEUE_COLLECTION = 'adminBroadcastSmsQueue';
const SMS_TRIGGER_MAX_INSTANCES = 10;
const SMS_TRIGGER_CONCURRENCY = 1;
const SMS_GATE_LOCK_COLLECTION = '_runtimeLocks';
const SMS_GATE_LOCK_DOCUMENT = 'adminBroadcastSmsGateLock';

function safeErrorMessage(error) {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  return error.message || 'Unknown error';
}

function toErrorCode(error) {
  return String(error?.code || '').trim().toLowerCase() || null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeLockOwner({ queueId, attempt }) {
  const seed = Math.random().toString(36).slice(2, 10);
  return `${queueId}:${attempt}:${Date.now()}:${seed}`;
}

function parsePositiveInt(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), min), max);
}

async function acquireSmsGateLock({
  db,
  queueId,
  attempt,
  maxWaitMs,
  pollIntervalMs,
  leaseMs,
}) {
  const lockRef = db.collection(SMS_GATE_LOCK_COLLECTION).doc(SMS_GATE_LOCK_DOCUMENT);
  const lockOwner = makeLockOwner({ queueId, attempt });
  const startedAtMs = Date.now();

  while (Date.now() - startedAtMs <= maxWaitMs) {
    let acquired = false;
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(lockRef);
      const data = snap.data() || {};
      const currentOwner = String(data.owner || '').trim();
      const expiresAtMs = Number(data.expiresAtMs || 0);
      const nowMs = Date.now();
      const lockExpired = !Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs;

      if (!currentOwner || lockExpired || currentOwner === lockOwner) {
        tx.set(lockRef, {
          owner: lockOwner,
          expiresAtMs: nowMs + leaseMs,
          queueId,
          attempt: attempt + 1,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        acquired = true;
      }
    });

    if (acquired) {
      return lockOwner;
    }
    await sleep(pollIntervalMs);
  }

  const lockError = new Error('Timed out waiting for SMS gateway send lock');
  lockError.code = 'smsgate_lock_timeout';
  lockError.retriable = true;
  return Promise.reject(lockError);
}

async function releaseSmsGateLock({ db, lockOwner }) {
  if (!lockOwner) return;
  const lockRef = db.collection(SMS_GATE_LOCK_COLLECTION).doc(SMS_GATE_LOCK_DOCUMENT);
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(lockRef);
      if (!snap.exists) return;
      const data = snap.data() || {};
      const currentOwner = String(data.owner || '').trim();
      if (currentOwner !== lockOwner) return;
      tx.set(lockRef, {
        owner: null,
        expiresAtMs: 0,
        queueId: null,
        attempt: null,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    });
  } catch (lockReleaseError) {
    console.warn('[onAdminBroadcastSmsQueued] Failed to release SMS gateway lock', {
      error: safeErrorMessage(lockReleaseError),
      lockOwner,
    });
  }
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
      lastErrorCode: null,
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

  await jobRef.update(payload);
}

function readSmsProgressCount(data = {}, key) {
  const nestedRaw = Number(data?.smsProgress?.[key]);
  if (Number.isFinite(nestedRaw)) return nestedRaw;
  const legacyRaw = Number(data?.[`smsProgress.${key}`]);
  if (Number.isFinite(legacyRaw)) return legacyRaw;
  return 0;
}

async function finalizeSmsJobIfDone(jobRef) {
  const snapshot = await jobRef.get();
  if (!snapshot.exists) return;
  const data = snapshot.data() || {};
  if (data.smsEnqueueComplete !== true) return;

  const queuedUsers = readSmsProgressCount(data, 'queuedUsers');
  const processedUsers = readSmsProgressCount(data, 'processedUsers');
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
    maxInstances: SMS_TRIGGER_MAX_INSTANCES,
    concurrency: SMS_TRIGGER_CONCURRENCY,
    retry: true,
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
    const sendCooldownMs = Math.min(
      Math.max(Number(queueData.sendCooldownMs || process.env.SMSGATE_SEND_COOLDOWN_MS || 2500), 0),
      10000
    );
    const statusPollIntervalMs = Math.min(
      Math.max(
        Number(queueData.statusPollIntervalMs || process.env.SMSGATE_STATUS_POLL_INTERVAL_MS || 2000),
        500
      ),
      10000
    );
    const statusMaxWaitMs = Math.min(
      Math.max(Number(queueData.statusMaxWaitMs || process.env.SMSGATE_STATUS_MAX_WAIT_MS || 45000), 2000),
      120000
    );
    const lockMaxWaitMs = parsePositiveInt(
      queueData.lockMaxWaitMs || process.env.SMSGATE_LOCK_MAX_WAIT_MS,
      120000,
      5000,
      300000
    );
    const lockPollIntervalMs = parsePositiveInt(
      queueData.lockPollIntervalMs || process.env.SMSGATE_LOCK_POLL_INTERVAL_MS,
      1000,
      200,
      5000
    );
    const lockLeaseMs = parsePositiveInt(
      queueData.lockLeaseMs
      || process.env.SMSGATE_LOCK_LEASE_MS
      || (statusMaxWaitMs + timeoutMs + sendCooldownMs + 15000),
      statusMaxWaitMs + timeoutMs + sendCooldownMs + 15000,
      5000,
      300000
    );
    const genericFailureMaxRetries = parsePositiveInt(
      queueData.genericFailureMaxRetries || process.env.SMSGATE_GENERIC_FAILURE_MAX_RETRIES,
      Math.max(maxRetries, 5),
      0,
      10
    );

    const message = String(queueData.message || '').trim();
    const phoneNumber = String(queueData.phoneNumber || '').trim();
    let sent = false;
    let lastError = null;
    let retryAttempts = 0;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        const lockOwner = await acquireSmsGateLock({
          db,
          queueId,
          attempt,
          maxWaitMs: lockMaxWaitMs,
          pollIntervalMs: lockPollIntervalMs,
          leaseMs: lockLeaseMs,
        });

        let sendResult = null;
        let deliveryOutcome = null;
        let providerMessageId = null;
        let initialProviderState = null;
        let initialProviderRecipientState = null;

        try {
          if (sendCooldownMs > 0) {
            await sleep(sendCooldownMs);
          }
          sendResult = await sendSmsViaSmsGate({
            to: phoneNumber,
            message,
            config: { timeoutMs },
          });
          providerMessageId = String(sendResult?.data?.id || '').trim() || null;
          initialProviderState = sendResult?.data?.state || null;
          initialProviderRecipientState = sendResult?.data?.recipients?.[0]?.state || null;

          if (providerMessageId) {
            deliveryOutcome = await waitForSmsGateFinalState({
              messageId: providerMessageId,
              config: { timeoutMs },
              pollIntervalMs: statusPollIntervalMs,
              maxWaitMs: statusMaxWaitMs,
            });

            const finalState = String(deliveryOutcome?.recipientState || deliveryOutcome?.state || '').trim().toLowerCase();
            if (finalState === 'failed') {
              const deliveryError = new Error(
                String(deliveryOutcome?.recipientError || 'SMS delivery failed on SMS gateway device')
              );
              deliveryError.code = 'smsgate_delivery_failed';
              deliveryError.retriable = true;
              deliveryError.details = {
                providerMessageId,
                providerState: deliveryOutcome?.state || null,
                providerRecipientState: deliveryOutcome?.recipientState || null,
              };
              throw deliveryError;
            }
          }
        } finally {
          await releaseSmsGateLock({ db, lockOwner });
        }

        sent = true;
        await queueRef.set({
          status: 'sent',
          attempts: attempt + 1,
          sentAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          lastError: null,
          lastErrorCode: null,
          providerMessageId,
          providerState: deliveryOutcome?.state || initialProviderState,
          providerRecipientState: deliveryOutcome?.recipientState || initialProviderRecipientState,
          providerRecipientError: deliveryOutcome?.recipientError || null,
          deliveryFinalized: deliveryOutcome ? deliveryOutcome.final === true : false,
        }, { merge: true });
        await bumpSmsProgress(jobRef, {
          processedUsers: 1,
          sentUsers: 1,
        });
        if (deliveryOutcome && deliveryOutcome.final !== true) {
          console.warn('[onAdminBroadcastSmsQueued] SMS delivery not finalized before timeout', {
            queueId,
            jobId,
            providerMessageId,
            providerState: deliveryOutcome.state,
            providerRecipientState: deliveryOutcome.recipientState,
            waitMs: statusMaxWaitMs,
          });
        }
        break;
      } catch (error) {
        lastError = error;
        const errorCode = toErrorCode(error);
        const errorMessage = safeErrorMessage(error);
        const errorDetails = error?.details && typeof error.details === 'object' ? error.details : null;
        const isRetriable = error?.retriable === true;
        const isCarrierGenericFailure = (
          errorCode === 'smsgate_delivery_failed'
          && errorMessage.toLowerCase().includes('generic failure')
        );
        const effectiveMaxRetries = isCarrierGenericFailure
          ? Math.max(maxRetries, genericFailureMaxRetries)
          : maxRetries;
        const hasAttemptsLeft = attempt < effectiveMaxRetries;
        await queueRef.set({
          attempts: attempt + 1,
          updatedAt: FieldValue.serverTimestamp(),
          lastError: errorMessage,
          lastErrorCode: errorCode,
          providerMessageId: errorDetails?.providerMessageId || null,
          providerState: errorDetails?.providerState || null,
          providerRecipientState: errorDetails?.providerRecipientState || null,
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
        const genericFailureRetryBaseMs = Math.min(
          Math.max(Number(process.env.SMSGATE_GENERIC_FAILURE_RETRY_BASE_MS || 12000), 1000),
          120000
        );
        const effectiveRetryBaseMs = isCarrierGenericFailure
          ? Math.max(retryBaseDelayMs, genericFailureRetryBaseMs)
          : retryBaseDelayMs;
        const delayMs = Math.min(effectiveRetryBaseMs * (2 ** attempt), 120000);
        console.warn('[onAdminBroadcastSmsQueued] Retrying SMS send', {
          queueId,
          jobId,
          attempt: attempt + 1,
          maxRetries: effectiveMaxRetries,
          delayMs,
          errorCode,
          error: errorMessage,
          providerMessageId: errorDetails?.providerMessageId || null,
          providerState: errorDetails?.providerState || null,
          providerRecipientState: errorDetails?.providerRecipientState || null,
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
        errorCode: toErrorCode(lastError),
        error: safeErrorMessage(lastError),
        providerMessageId: lastError?.details?.providerMessageId || null,
        providerState: lastError?.details?.providerState || null,
        providerRecipientState: lastError?.details?.providerRecipientState || null,
      });
    }

    await finalizeSmsJobIfDone(jobRef);
    return null;
  }
);
