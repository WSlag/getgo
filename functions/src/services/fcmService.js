/**
 * FCM Service
 * Sends targeted push notifications to a specific user via their registered FCM tokens.
 * Push failures are always non-fatal — the caller must catch errors independently.
 */

const admin = require('firebase-admin');

const MAX_TOKENS_PER_USER = 5;

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
    .limit(MAX_TOKENS_PER_USER)
    .get();

  if (tokensSnap.empty) return;

  const tokens = tokensSnap.docs.map((d) => d.id);

  // Ensure all data values are strings (FCM requirement)
  const safeData = Object.fromEntries(
    Object.entries(data)
      .filter(([, v]) => v != null)
      .map(([k, v]) => [k, String(v)])
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
  response.responses.forEach((r, i) => {
    if (!r.success) {
      const code = r.error?.code || '';
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        staleTokenIds.push(tokens[i]);
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
