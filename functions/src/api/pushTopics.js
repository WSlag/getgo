/**
 * Push Topics API
 * Subscribes a user's FCM tokens to the correct listing notification topics.
 * Topic subscription requires Admin SDK — cannot be done from the frontend SDK.
 *
 * Topics:
 *   new-cargo-listings  → subscribed by truckers
 *   new-truck-listings  → subscribed by shippers
 *   brokers             → excluded from listing topics
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { assertAppCheckGen1 } = require('../utils/appCheck');
const { enforceUserRateLimit } = require('../utils/callableRateLimit');

const ROLE_TOPIC_MAP = {
  trucker: ['new-cargo-listings'],
  shipper: ['new-truck-listings'],
  // broker: intentionally excluded
};

const SUBSCRIBE_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const SUBSCRIBE_RATE_LIMIT_ATTEMPTS = 10;

exports.subscribeToListingTopics = functions
  .region('asia-southeast1')
  .https.onCall(async (data, context) => {
    assertAppCheckGen1(context, { allowAuthFallback: true });

    const uid = context.auth?.uid;
    if (!uid) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }

    await enforceUserRateLimit({
      db: admin.firestore(),
      uid,
      action: 'subscribeToListingTopics',
      windowMs: SUBSCRIBE_RATE_LIMIT_WINDOW_MS,
      maxAttempts: SUBSCRIBE_RATE_LIMIT_ATTEMPTS,
    });

    const role = String(data?.role || '').trim().toLowerCase();
    const topics = ROLE_TOPIC_MAP[role];

    // Broker and unknown roles: no-op (not an error)
    if (!topics || topics.length === 0) {
      return { subscribed: false, reason: 'role_not_eligible' };
    }

    const db = admin.firestore();
    const tokensSnap = await db
      .collection('users')
      .doc(uid)
      .collection('fcmTokens')
      .limit(5)
      .get();

    if (tokensSnap.empty) {
      return { subscribed: false, reason: 'no_tokens' };
    }

    const tokens = tokensSnap.docs.map((d) => d.id);

    for (const topic of topics) {
      try {
        await admin.messaging().subscribeToTopic(tokens, topic);
      } catch (err) {
        console.error(`[pushTopics] Failed to subscribe uid=${uid} to topic=${topic}:`, err?.message);
        // Non-fatal: log and continue
      }
    }

    return { subscribed: true, topics };
  });
