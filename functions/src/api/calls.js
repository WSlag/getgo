/**
 * Voice Call Cloud Functions
 * Server-authoritative signaling and budget enforcement.
 */

const functions = require('firebase-functions');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const { RtcTokenBuilder, RtcRole } = require('agora-token');
const { assertAppCheckGen1 } = require('../utils/appCheck');
const { enforceUserRateLimit } = require('../utils/callableRateLimit');
const { sanitizePublicName } = require('../utils/contactModeration');

const db = admin.firestore();

const CALL_TYPE_ALLOWED = new Set(['negotiation', 'monitoring']);
const CALL_TOKEN_ALLOWED_STATUSES = new Set(['ringing', 'active']);
const TERMINAL_CALL_STATUSES = new Set(['ended', 'rejected', 'missed']);

const MAX_CALL_ACTIVE_SECONDS = 300;
const TOTAL_CALL_BUDGET_SECONDS = 1200;

const CALL_TOKEN_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const CALL_TOKEN_RATE_LIMIT_ATTEMPTS = 15;
const CALL_START_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const CALL_START_RATE_LIMIT_ATTEMPTS = 20;
const CALL_ANSWER_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const CALL_ANSWER_RATE_LIMIT_ATTEMPTS = 30;
const CALL_END_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const CALL_END_RATE_LIMIT_ATTEMPTS = 60;
const CALL_ELIGIBILITY_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const CALL_ELIGIBILITY_RATE_LIMIT_ATTEMPTS = 120;

const SCHEDULER_BATCH_SIZE = 100;
const SCHEDULER_MAX_BATCHES = 20;

function normalizeId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeText(value, fallback = '', maxLength = 0) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  const safeValue = normalized || fallback;
  if (maxLength > 0 && safeValue.length > maxLength) {
    return safeValue.slice(0, maxLength);
  }
  return safeValue;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundSeconds(value) {
  const rounded = Math.round(Number(value || 0) * 1000) / 1000;
  return rounded < 0 ? 0 : rounded;
}

function timestampToMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  if (typeof value.seconds === 'number') {
    return (value.seconds * 1000) + Math.floor((value.nanoseconds || 0) / 1000000);
  }
  if (typeof value._seconds === 'number') {
    return (value._seconds * 1000) + Math.floor((value._nanoseconds || 0) / 1000000);
  }
  return null;
}

function resolveParticipantIds(uidA, uidB) {
  const left = normalizeId(uidA);
  const right = normalizeId(uidB);
  if (!left || !right || left === right) return [];
  return [left, right].sort((a, b) => a.localeCompare(b));
}

function buildPairKey(uidA, uidB) {
  const participants = resolveParticipantIds(uidA, uidB);
  if (participants.length !== 2) return '';
  return `${participants[0]}__${participants[1]}`;
}

function parseBudgetState(raw = {}) {
  const consumedFromField = toFiniteNumber(raw.consumedSeconds, NaN);
  const remainingFromField = toFiniteNumber(raw.remainingSeconds, NaN);

  let consumed = Number.isFinite(consumedFromField)
    ? consumedFromField
    : (Number.isFinite(remainingFromField)
      ? TOTAL_CALL_BUDGET_SECONDS - remainingFromField
      : 0);

  consumed = clamp(consumed, 0, TOTAL_CALL_BUDGET_SECONDS);
  const remaining = clamp(TOTAL_CALL_BUDGET_SECONDS - consumed, 0, TOTAL_CALL_BUDGET_SECONDS);

  return {
    consumedSeconds: roundSeconds(consumed),
    remainingSeconds: roundSeconds(remaining),
  };
}

function computeConsumedSeconds(callData = {}, fallbackEndedAtMs = Date.now()) {
  const answeredAtMs = timestampToMillis(callData.answeredAt);
  if (!Number.isFinite(answeredAtMs)) return 0;

  const endedAtMs = timestampToMillis(callData.endedAt);
  const resolvedEndedAtMs = Number.isFinite(endedAtMs)
    ? endedAtMs
    : fallbackEndedAtMs;

  const rawSeconds = Math.max(0, (resolvedEndedAtMs - answeredAtMs) / 1000);
  return roundSeconds(clamp(rawSeconds, 0, MAX_CALL_ACTIVE_SECONDS));
}

function deriveAgoraUid(firebaseUid) {
  if (!firebaseUid) return 0;
  let hash = 5381;
  for (let i = 0; i < firebaseUid.length; i += 1) {
    hash = ((hash << 5) + hash) ^ firebaseUid.charCodeAt(i);
    hash >>>= 0;
  }
  return hash % 4294967295;
}

function isQuotaError(error) {
  return String(error?.code || '').includes('resource-exhausted');
}

function ensureParticipant(callData, actorUid) {
  return callData?.callerId === actorUid || callData?.calleeId === actorUid;
}

function ensureStatusAllowedForToken(callData = {}) {
  if (!CALL_TOKEN_ALLOWED_STATUSES.has(callData.status)) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Call session is no longer active'
    );
  }

  if (callData.status === 'active' && callData.forcedEndAt) {
    const forcedEndAtMs = timestampToMillis(callData.forcedEndAt);
    if (Number.isFinite(forcedEndAtMs) && Date.now() > forcedEndAtMs) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Call session has timed out'
      );
    }
  }
}

async function finalizeCallWithUsage({
  tx,
  callRef,
  actorUid = null,
  desiredStatus = 'ended',
  skipParticipantCheck = false,
  nowTs,
}) {
  const callSnap = await tx.get(callRef);
  if (!callSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Call session not found');
  }

  const callData = callSnap.data() || {};

  if (!skipParticipantCheck) {
    if (!actorUid) {
      throw new functions.https.HttpsError('permission-denied', 'Actor is required');
    }
    if (!ensureParticipant(callData, actorUid)) {
      throw new functions.https.HttpsError('permission-denied', 'You are not a participant in this call');
    }
  }

  const participants = resolveParticipantIds(callData.callerId, callData.calleeId);
  if (participants.length !== 2) {
    throw new functions.https.HttpsError('failed-precondition', 'Call participants are invalid');
  }

  const pairKey = normalizeId(callData.pairKey) || buildPairKey(callData.callerId, callData.calleeId);
  if (!pairKey) {
    throw new functions.https.HttpsError('failed-precondition', 'Call pairKey is invalid');
  }

  const budgetRef = db.collection('callBudgets').doc(pairKey);
  const budgetSnap = await tx.get(budgetRef);
  const budgetData = budgetSnap.exists ? (budgetSnap.data() || {}) : {};
  const budgetState = parseBudgetState(budgetData);

  const callStatus = normalizeId(callData.status);
  const shouldSetTerminalStatus = !TERMINAL_CALL_STATUSES.has(callStatus);
  const effectiveStatus = shouldSetTerminalStatus ? desiredStatus : callStatus;

  const updates = {};
  if (shouldSetTerminalStatus) {
    updates.status = desiredStatus;
  }

  if (!callData.endedAt) {
    updates.endedAt = nowTs;
  }

  if (!callData.pairKey) {
    updates.pairKey = pairKey;
  }

  let consumedSeconds = roundSeconds(toFiniteNumber(callData.consumedSeconds, 0));
  const alreadySettled = callData.usageSettled === true;
  let nextConsumedTotal = budgetState.consumedSeconds;

  if (!alreadySettled) {
    consumedSeconds = computeConsumedSeconds(
      {
        ...callData,
        endedAt: callData.endedAt || nowTs,
      },
      nowTs.toMillis()
    );

    updates.usageSettled = true;
    updates.consumedSeconds = consumedSeconds;

    nextConsumedTotal = roundSeconds(
      clamp(budgetState.consumedSeconds + consumedSeconds, 0, TOTAL_CALL_BUDGET_SECONDS)
    );
  }

  const nextRemaining = roundSeconds(
    clamp(TOTAL_CALL_BUDGET_SECONDS - nextConsumedTotal, 0, TOTAL_CALL_BUDGET_SECONDS)
  );

  const budgetPayload = {
    pairKey,
    participantIds: participants,
    totalBudgetSeconds: TOTAL_CALL_BUDGET_SECONDS,
    consumedSeconds: nextConsumedTotal,
    remainingSeconds: nextRemaining,
    updatedAt: nowTs,
  };

  if (!budgetSnap.exists) {
    budgetPayload.createdAt = nowTs;
  }

  tx.set(budgetRef, budgetPayload, { merge: true });

  if (Object.keys(updates).length > 0) {
    tx.update(callRef, updates);
  }

  return {
    callId: callRef.id,
    status: effectiveStatus,
    pairKey,
    consumedSeconds,
    remainingSeconds: nextRemaining,
  };
}

exports.getVoiceCallEligibility = functions
  .region('asia-southeast1')
  .https.onCall(async (data, context) => {
    assertAppCheckGen1(context, { allowAuthFallback: true });

    const actorUid = normalizeId(context?.auth?.uid);
    if (!actorUid) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated to check call eligibility');
    }

    await enforceUserRateLimit({
      db,
      userId: actorUid,
      operation: 'getVoiceCallEligibility',
      maxAttempts: CALL_ELIGIBILITY_RATE_LIMIT_ATTEMPTS,
      windowMs: CALL_ELIGIBILITY_RATE_LIMIT_WINDOW_MS,
    });

    const calleeId = normalizeId(data?.calleeId);
    if (!calleeId || calleeId === actorUid) {
      throw new functions.https.HttpsError('invalid-argument', 'calleeId is required and must be another user');
    }

    const pairKey = buildPairKey(actorUid, calleeId);
    if (!pairKey) {
      throw new functions.https.HttpsError('failed-precondition', 'Unable to derive call pair key');
    }

    const budgetSnap = await db.collection('callBudgets').doc(pairKey).get();
    const budgetState = parseBudgetState(budgetSnap.exists ? (budgetSnap.data() || {}) : {});

    return {
      eligible: budgetState.remainingSeconds >= MAX_CALL_ACTIVE_SECONDS,
      remainingSeconds: budgetState.remainingSeconds,
      requiredSeconds: MAX_CALL_ACTIVE_SECONDS,
      totalBudgetSeconds: TOTAL_CALL_BUDGET_SECONDS,
      pairKey,
    };
  });

exports.startVoiceCall = functions
  .region('asia-southeast1')
  .https.onCall(async (data, context) => {
    assertAppCheckGen1(context, { allowAuthFallback: true });

    const callerId = normalizeId(context?.auth?.uid);
    if (!callerId) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated to start a call');
    }

    await enforceUserRateLimit({
      db,
      userId: callerId,
      operation: 'startVoiceCall',
      maxAttempts: CALL_START_RATE_LIMIT_ATTEMPTS,
      windowMs: CALL_START_RATE_LIMIT_WINDOW_MS,
    });

    const calleeId = normalizeId(data?.calleeId);
    if (!calleeId || calleeId === callerId) {
      throw new functions.https.HttpsError('invalid-argument', 'calleeId is required and must be another user');
    }

    const callType = normalizeId(data?.callType);
    if (!CALL_TYPE_ALLOWED.has(callType)) {
      throw new functions.https.HttpsError('invalid-argument', 'callType is invalid');
    }

    const contextId = normalizeText(data?.contextId, '', 128);
    if (!contextId) {
      throw new functions.https.HttpsError('invalid-argument', 'contextId is required');
    }

    const callerName = sanitizePublicName(normalizeText(data?.callerName, 'User', 100), 'User');
    const calleeName = sanitizePublicName(normalizeText(data?.calleeName, 'User', 100), 'User');

    const pairKey = buildPairKey(callerId, calleeId);
    if (!pairKey) {
      throw new functions.https.HttpsError('failed-precondition', 'Unable to derive call pair key');
    }

    const callRef = db.collection('calls').doc();
    const nowTs = admin.firestore.Timestamp.now();

    await db.runTransaction(async (tx) => {
      const budgetRef = db.collection('callBudgets').doc(pairKey);
      const budgetSnap = await tx.get(budgetRef);
      const budgetData = budgetSnap.exists ? (budgetSnap.data() || {}) : {};
      const budgetState = parseBudgetState(budgetData);

      if (budgetState.remainingSeconds < MAX_CALL_ACTIVE_SECONDS) {
        throw new functions.https.HttpsError(
          'resource-exhausted',
          'Call time budget exhausted for this shipper-trucker pair'
        );
      }

      const participants = resolveParticipantIds(callerId, calleeId);
      const budgetPayload = {
        pairKey,
        participantIds: participants,
        totalBudgetSeconds: TOTAL_CALL_BUDGET_SECONDS,
        consumedSeconds: budgetState.consumedSeconds,
        remainingSeconds: budgetState.remainingSeconds,
        updatedAt: nowTs,
      };
      if (!budgetSnap.exists) {
        budgetPayload.createdAt = nowTs;
      }
      tx.set(budgetRef, budgetPayload, { merge: true });

      tx.set(callRef, {
        callerId,
        calleeId,
        callerName,
        calleeName,
        channelName: callRef.id,
        status: 'ringing',
        callType,
        contextId,
        pairKey,
        createdAt: nowTs,
        answeredAt: null,
        endedAt: null,
        forcedEndAt: null,
        usageSettled: false,
        consumedSeconds: 0,
      });
    });

    return {
      callId: callRef.id,
      channelName: callRef.id,
      pairKey,
    };
  });

exports.answerVoiceCall = functions
  .region('asia-southeast1')
  .https.onCall(async (data, context) => {
    assertAppCheckGen1(context, { allowAuthFallback: true });

    const actorUid = normalizeId(context?.auth?.uid);
    if (!actorUid) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated to answer a call');
    }

    await enforceUserRateLimit({
      db,
      userId: actorUid,
      operation: 'answerVoiceCall',
      maxAttempts: CALL_ANSWER_RATE_LIMIT_ATTEMPTS,
      windowMs: CALL_ANSWER_RATE_LIMIT_WINDOW_MS,
    });

    const callId = normalizeId(data?.callId);
    if (!callId) {
      throw new functions.https.HttpsError('invalid-argument', 'callId is required');
    }

    const callRef = db.collection('calls').doc(callId);
    const result = await db.runTransaction(async (tx) => {
      const callSnap = await tx.get(callRef);
      if (!callSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Call session not found');
      }

      const callData = callSnap.data() || {};
      if (!ensureParticipant(callData, actorUid)) {
        throw new functions.https.HttpsError('permission-denied', 'You are not a participant in this call');
      }
      if (normalizeId(callData.calleeId) !== actorUid) {
        throw new functions.https.HttpsError('permission-denied', 'Only the callee can answer this call');
      }

      const callStatus = normalizeId(callData.status);
      if (TERMINAL_CALL_STATUSES.has(callStatus)) {
        throw new functions.https.HttpsError('failed-precondition', 'Call session is no longer active');
      }

      const pairKey = normalizeId(callData.pairKey) || buildPairKey(callData.callerId, callData.calleeId);
      if (!pairKey) {
        throw new functions.https.HttpsError('failed-precondition', 'Call pairKey is invalid');
      }

      const budgetRef = db.collection('callBudgets').doc(pairKey);
      const budgetSnap = await tx.get(budgetRef);
      const budgetData = budgetSnap.exists ? (budgetSnap.data() || {}) : {};
      const budgetState = parseBudgetState(budgetData);

      if (budgetState.remainingSeconds < MAX_CALL_ACTIVE_SECONDS) {
        throw new functions.https.HttpsError(
          'resource-exhausted',
          'Call time budget exhausted for this shipper-trucker pair'
        );
      }

      const participants = resolveParticipantIds(callData.callerId, callData.calleeId);
      const nowTs = admin.firestore.Timestamp.now();
      const forcedEndAt = admin.firestore.Timestamp.fromMillis(
        nowTs.toMillis() + (MAX_CALL_ACTIVE_SECONDS * 1000)
      );

      const budgetPayload = {
        pairKey,
        participantIds: participants,
        totalBudgetSeconds: TOTAL_CALL_BUDGET_SECONDS,
        consumedSeconds: budgetState.consumedSeconds,
        remainingSeconds: budgetState.remainingSeconds,
        updatedAt: nowTs,
      };
      if (!budgetSnap.exists) {
        budgetPayload.createdAt = nowTs;
      }
      tx.set(budgetRef, budgetPayload, { merge: true });

      if (callStatus === 'active') {
        const activeUpdates = {};
        if (!callData.answeredAt) activeUpdates.answeredAt = nowTs;
        if (!callData.forcedEndAt) activeUpdates.forcedEndAt = forcedEndAt;
        if (!callData.pairKey) activeUpdates.pairKey = pairKey;
        if (Object.keys(activeUpdates).length > 0) {
          tx.update(callRef, activeUpdates);
        }

        return {
          status: 'active',
          forcedEndAt: callData.forcedEndAt || activeUpdates.forcedEndAt || forcedEndAt,
          remainingSeconds: budgetState.remainingSeconds,
          pairKey,
        };
      }

      if (callStatus !== 'ringing') {
        throw new functions.https.HttpsError('failed-precondition', 'Call is not in ringing state');
      }

      tx.update(callRef, {
        status: 'active',
        answeredAt: nowTs,
        forcedEndAt,
        pairKey,
      });

      return {
        status: 'active',
        forcedEndAt,
        remainingSeconds: budgetState.remainingSeconds,
        pairKey,
      };
    });

    return result;
  });

exports.endVoiceCall = functions
  .region('asia-southeast1')
  .https.onCall(async (data, context) => {
    assertAppCheckGen1(context, { allowAuthFallback: true });

    const actorUid = normalizeId(context?.auth?.uid);
    if (!actorUid) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated to end a call');
    }

    await enforceUserRateLimit({
      db,
      userId: actorUid,
      operation: 'endVoiceCall',
      maxAttempts: CALL_END_RATE_LIMIT_ATTEMPTS,
      windowMs: CALL_END_RATE_LIMIT_WINDOW_MS,
    });

    const callId = normalizeId(data?.callId);
    const status = normalizeId(data?.status);

    if (!callId) {
      throw new functions.https.HttpsError('invalid-argument', 'callId is required');
    }
    if (!TERMINAL_CALL_STATUSES.has(status)) {
      throw new functions.https.HttpsError('invalid-argument', 'status must be ended, rejected, or missed');
    }

    const callRef = db.collection('calls').doc(callId);
    const nowTs = admin.firestore.Timestamp.now();
    const result = await db.runTransaction(async (tx) => finalizeCallWithUsage({
      tx,
      callRef,
      actorUid,
      desiredStatus: status,
      nowTs,
    }));

    return result;
  });

/**
 * Generate an Agora RTC token for a voice call participant.
 */
exports.generateAgoraToken = functions
  .region('asia-southeast1')
  .https.onCall(async (data, context) => {
    assertAppCheckGen1(context, { allowAuthFallback: true });

    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Must be authenticated to join a call'
      );
    }

    const appId = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;

    if (!appId || !appCertificate) {
      throw new functions.https.HttpsError(
        'internal',
        'Voice calling is not configured on this server'
      );
    }

    await enforceUserRateLimit({
      db,
      userId: context.auth.uid,
      operation: 'generateAgoraToken',
      maxAttempts: CALL_TOKEN_RATE_LIMIT_ATTEMPTS,
      windowMs: CALL_TOKEN_RATE_LIMIT_WINDOW_MS,
    });

    const { channelName, uid } = data || {};
    const normalizedChannelName = normalizeId(channelName);

    if (!normalizedChannelName) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'channelName is required'
      );
    }

    const numericUid = Number(uid);
    if (!Number.isFinite(numericUid) || numericUid < 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'uid must be a non-negative number'
      );
    }

    const expectedUid = deriveAgoraUid(context.auth.uid);
    if (numericUid !== expectedUid) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'uid does not match authenticated user'
      );
    }

    try {
      const callDoc = await db.collection('calls').doc(normalizedChannelName).get();
      if (!callDoc.exists) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Call session not found'
        );
      }

      const callData = callDoc.data() || {};
      const callerUid = context.auth.uid;

      if (callData.channelName !== normalizedChannelName) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Call channel mismatch'
        );
      }

      ensureStatusAllowedForToken(callData);

      if (!ensureParticipant(callData, callerUid)) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'You are not a participant in this call'
        );
      }
    } catch (err) {
      if (err instanceof functions.https.HttpsError) throw err;
      console.error('[generateAgoraToken] Firestore check error:', err);
      throw new functions.https.HttpsError('internal', 'Failed to verify call participation');
    }

    const expireTimeInSeconds = 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expireTimeInSeconds;

    let token;
    try {
      token = RtcTokenBuilder.buildTokenWithUid(
        appId,
        appCertificate,
        normalizedChannelName,
        numericUid,
        RtcRole.PUBLISHER,
        privilegeExpiredTs,
        privilegeExpiredTs
      );
    } catch (err) {
      console.error('[generateAgoraToken] Token build error:', err);
      throw new functions.https.HttpsError('internal', 'Failed to generate call token');
    }

    return {
      token,
      appId,
      channelName: normalizedChannelName,
      uid: numericUid,
    };
  });

exports.enforceVoiceCallTimeouts = onSchedule(
  {
    region: 'asia-southeast1',
    schedule: 'every 1 minutes',
    timeZone: 'Asia/Manila',
  },
  async () => {
    let processed = 0;
    let failed = 0;

    for (let batch = 0; batch < SCHEDULER_MAX_BATCHES; batch += 1) {
      const nowTs = admin.firestore.Timestamp.now();
      const overdueSnap = await db.collection('calls')
        .where('status', '==', 'active')
        .where('forcedEndAt', '<=', nowTs)
        .limit(SCHEDULER_BATCH_SIZE)
        .get();

      if (overdueSnap.empty) break;

      for (const callDoc of overdueSnap.docs) {
        try {
          await db.runTransaction(async (tx) => finalizeCallWithUsage({
            tx,
            callRef: callDoc.ref,
            desiredStatus: 'ended',
            skipParticipantCheck: true,
            nowTs: admin.firestore.Timestamp.now(),
          }));
          processed += 1;
        } catch (error) {
          failed += 1;
          console.error('[enforceVoiceCallTimeouts] Failed to finalize overdue call', {
            callId: callDoc.id,
            error: error?.message || error,
            isQuotaError: isQuotaError(error),
          });
        }
      }

      if (overdueSnap.size < SCHEDULER_BATCH_SIZE) break;
    }

    console.log('[enforceVoiceCallTimeouts] Completed', { processed, failed });
    return null;
  }
);
