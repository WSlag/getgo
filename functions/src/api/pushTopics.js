/**
 * Push Topics API
 * Keeps a user's FCM tokens aligned with role-based listing topics.
 * Topic management requires Admin SDK - cannot be done from the frontend SDK.
 *
 * Topics:
 *   new-cargo-listings -> truckers
 *   new-truck-listings -> shippers
 *   brokers            -> excluded from listing topics
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
const MANAGED_TOPICS = [...new Set(Object.values(ROLE_TOPIC_MAP).flat())];

const SUBSCRIBE_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const SUBSCRIBE_RATE_LIMIT_ATTEMPTS = 10;

function normalizeRole(value) {
  return String(value || '').trim().toLowerCase();
}

function toDateSafe(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') {
    const converted = value.toDate();
    return converted instanceof Date ? converted : null;
  }
  if (value instanceof Date) return value;
  return null;
}

function sortTokenDocsByRecency(tokenDocs = []) {
  return [...tokenDocs].sort((a, b) => {
    const aUpdatedAt = toDateSafe(a.get('updatedAt'));
    const bUpdatedAt = toDateSafe(b.get('updatedAt'));
    const aCreatedAt = toDateSafe(a.get('createdAt'));
    const bCreatedAt = toDateSafe(b.get('createdAt'));

    const aTimestamp = (aUpdatedAt || aCreatedAt || new Date(0)).getTime();
    const bTimestamp = (bUpdatedAt || bCreatedAt || new Date(0)).getTime();
    if (aTimestamp !== bTimestamp) {
      return bTimestamp - aTimestamp;
    }
    return String(a.id).localeCompare(String(b.id));
  });
}

async function syncListingTopicsForUser({ db, uid, role }) {
  const desiredTopics = ROLE_TOPIC_MAP[normalizeRole(role)] || [];

  const tokensSnap = await db
    .collection('users')
    .doc(uid)
    .collection('fcmTokens')
    .limit(20)
    .get();

  if (tokensSnap.empty) {
    return {
      synced: false,
      reason: 'no_tokens',
      desiredTopics,
      subscribedTopics: [],
      unsubscribedTopics: [],
    };
  }

  const sortedDocs = sortTokenDocsByRecency(tokensSnap.docs);
  const tokens = sortedDocs.slice(0, 5).map((doc) => doc.id);
  const topicsToSubscribe = desiredTopics;
  const topicsToUnsubscribe = MANAGED_TOPICS.filter((topic) => !desiredTopics.includes(topic));

  const subscribedTopics = [];
  const unsubscribedTopics = [];

  for (const topic of topicsToSubscribe) {
    try {
      await admin.messaging().subscribeToTopic(tokens, topic);
      subscribedTopics.push(topic);
    } catch (err) {
      console.error(`[pushTopics] Failed to subscribe uid=${uid} to topic=${topic}:`, err?.message);
    }
  }

  for (const topic of topicsToUnsubscribe) {
    try {
      await admin.messaging().unsubscribeFromTopic(tokens, topic);
      unsubscribedTopics.push(topic);
    } catch (err) {
      console.error(`[pushTopics] Failed to unsubscribe uid=${uid} from topic=${topic}:`, err?.message);
    }
  }

  return {
    synced: true,
    desiredTopics,
    subscribedTopics,
    unsubscribedTopics,
  };
}

async function handleSyncTopicsRequest(data, context) {
  assertAppCheckGen1(context, { allowAuthFallback: true });

  const uid = context.auth?.uid;
  if (!uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  }

  const db = admin.firestore();
  await enforceUserRateLimit({
    db,
    userId: uid,
    operation: 'syncListingTopics',
    windowMs: SUBSCRIBE_RATE_LIMIT_WINDOW_MS,
    maxAttempts: SUBSCRIBE_RATE_LIMIT_ATTEMPTS,
  });

  return syncListingTopicsForUser({
    db,
    uid,
    role: data?.role,
  });
}

exports.syncListingTopics = functions
  .region('asia-southeast1')
  .https.onCall(handleSyncTopicsRequest);

// Backward-compatible alias. Frontend can migrate to syncListingTopics gradually.
exports.subscribeToListingTopics = functions
  .region('asia-southeast1')
  .https.onCall(handleSyncTopicsRequest);
