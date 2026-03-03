/**
 * Chat Triggers
 * Sends chat notifications server-side when a new message is created.
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

function normalizeId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function truncateMessagePreview(message) {
  if (typeof message !== 'string') return '';
  const normalized = message.trim().replace(/\s+/g, ' ');
  if (!normalized) return '';
  return normalized.length > 50 ? `${normalized.slice(0, 50)}...` : normalized;
}

function resolveParticipants(bid = {}) {
  return {
    bidderId: normalizeId(bid.bidderId),
    listingOwnerId: normalizeId(bid.listingOwnerId),
    bidderName: typeof bid.bidderName === 'string' ? bid.bidderName.trim() : '',
    listingOwnerName: typeof bid.listingOwnerName === 'string' ? bid.listingOwnerName.trim() : '',
  };
}

function resolveRecipientId(senderId, bidParticipants) {
  if (senderId === bidParticipants.bidderId) return bidParticipants.listingOwnerId;
  if (senderId === bidParticipants.listingOwnerId) return bidParticipants.bidderId;
  return '';
}

async function resolveSenderName(db, senderId, fallbackSenderName, bidParticipants) {
  if (fallbackSenderName) return fallbackSenderName;
  if (senderId === bidParticipants.bidderId && bidParticipants.bidderName) {
    return bidParticipants.bidderName;
  }
  if (senderId === bidParticipants.listingOwnerId && bidParticipants.listingOwnerName) {
    return bidParticipants.listingOwnerName;
  }

  try {
    const senderDoc = await db.collection('users').doc(senderId).get();
    if (senderDoc.exists) {
      const senderData = senderDoc.data() || {};
      const senderName = typeof senderData.name === 'string' ? senderData.name.trim() : '';
      if (senderName) return senderName;
    }
  } catch (error) {
    console.error('[onChatMessageCreated] Failed to resolve sender name:', error);
  }

  return 'User';
}

exports.onChatMessageCreated = onDocumentCreated(
  {
    region: 'asia-southeast1',
    document: 'bids/{bidId}/messages/{messageId}',
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return null;

    const { bidId, messageId } = event.params;
    const db = admin.firestore();
    const messageData = snap.data() || {};

    const senderId = normalizeId(messageData.senderId);
    if (!senderId) {
      console.warn('[onChatMessageCreated] Missing senderId', { bidId, messageId });
      return null;
    }

    const bidDoc = await db.collection('bids').doc(bidId).get();
    if (!bidDoc.exists) {
      console.warn('[onChatMessageCreated] Bid not found', { bidId, messageId });
      return null;
    }

    const bidParticipants = resolveParticipants(bidDoc.data() || {});
    if (!bidParticipants.bidderId || !bidParticipants.listingOwnerId) {
      console.warn('[onChatMessageCreated] Bid participants missing', { bidId, messageId });
      return null;
    }

    const recipientId = resolveRecipientId(senderId, bidParticipants);
    if (!recipientId || recipientId === senderId) {
      console.warn('[onChatMessageCreated] Unable to resolve recipient', { bidId, messageId, senderId });
      return null;
    }

    const senderName = await resolveSenderName(
      db,
      senderId,
      typeof messageData.senderName === 'string' ? messageData.senderName.trim() : '',
      bidParticipants
    );

    // Keep recipient metadata canonical for unread count logic and cross-client consistency.
    if (messageData.recipientId !== recipientId) {
      await snap.ref.set(
        {
          recipientId,
          senderName,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    const messagePreview = truncateMessagePreview(messageData.message);
    const notificationId = `chat_${bidId}_${messageId}`;

    await db.collection(`users/${recipientId}/notifications`).doc(notificationId).set({
      type: 'NEW_MESSAGE',
      title: 'New Message',
      message: `${senderName}: "${messagePreview}"`,
      data: {
        bidId,
        messageId,
        senderId,
        senderName,
      },
      isRead: false,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return null;
  }
);

