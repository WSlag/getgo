/**
 * FCM Service
 * Sends targeted push notifications to a specific user via their registered FCM tokens.
 * Push failures are always non-fatal - the caller must catch errors independently.
 */

const admin = require('firebase-admin');

const MAX_TOKENS_PER_USER = 5;
const TOKEN_FETCH_LIMIT = 20;

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

/**
 * Send a push notification to all FCM tokens registered for a user.
 * Automatically removes stale/invalid tokens after a failed send.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} userId
 * @param {{ title: string, body?: string, data?: Record<string, string> }} payload
 */
async function sendPushToUser(db, userId, { title, body, data = {} }) {
  if (!userId || !title) return;

  const tokensSnap = await db
    .collection('users')
    .doc(userId)
    .collection('fcmTokens')
    .limit(TOKEN_FETCH_LIMIT)
    .get();

  if (tokensSnap.empty) return;

  const sortedDocs = sortTokenDocsByRecency(tokensSnap.docs);
  const tokens = sortedDocs.slice(0, MAX_TOKENS_PER_USER).map((doc) => doc.id);

  if (tokens.length === 0) return;

  // Ensure all data values are strings (FCM requirement)
  const safeData = Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value != null)
      .map(([key, value]) => [key, String(value)])
  );

  const response = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title, body: body || '' },
    data: safeData,
    webpush: {
      notification: {
        icon: 'https://getgoph.com/icons/icon-192x192.png',
        badge: 'https://getgoph.com/icons/icon-72x72.png',
        requireInteraction: false,
      },
    },
  });

  // Clean up stale / invalid tokens
  const staleTokenIds = [];
  response.responses.forEach((result, index) => {
    if (!result.success) {
      const code = result.error?.code || '';
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        staleTokenIds.push(tokens[index]);
      }
    }
  });

  if (staleTokenIds.length > 0) {
    const batch = db.batch();
    staleTokenIds.forEach((tokenId) => {
      batch.delete(
        db.collection('users').doc(userId).collection('fcmTokens').doc(tokenId)
      );
    });
    await batch.commit();
  }
}

module.exports = { sendPushToUser };
