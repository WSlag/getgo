/**
 * Voice Call Cloud Functions
 * Generates Agora RTC tokens for authenticated participants.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { RtcTokenBuilder, RtcRole } = require('agora-token');
const { assertAppCheckGen1 } = require('../utils/appCheck');
const { enforceUserRateLimit } = require('../utils/callableRateLimit');

const db = admin.firestore();
const CALL_TOKEN_ALLOWED_STATUSES = new Set(['ringing', 'active']);
const CALL_TOKEN_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const CALL_TOKEN_RATE_LIMIT_ATTEMPTS = 15;

/**
 * Derive a deterministic Agora numeric UID (uint32) from a Firebase UID.
 * This must stay aligned with frontend/src/hooks/useCallSignaling.js.
 */
function deriveAgoraUid(firebaseUid) {
  if (!firebaseUid) return 0;
  let hash = 5381;
  for (let i = 0; i < firebaseUid.length; i += 1) {
    hash = ((hash << 5) + hash) ^ firebaseUid.charCodeAt(i);
    hash >>>= 0;
  }
  return hash % 4294967295;
}

/**
 * Generate an Agora RTC token for a voice call participant.
 *
 * Validates that the requesting user is a participant in the call document
 * before issuing a token. The channelName equals the callId stored in Firestore.
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
    const normalizedChannelName = String(channelName || '').trim();

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

    // channelName == callId; verify the caller is an authorized participant.
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

      if (!CALL_TOKEN_ALLOWED_STATUSES.has(callData.status)) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Call session is no longer active'
        );
      }

      if (callData.callerId !== callerUid && callData.calleeId !== callerUid) {
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
