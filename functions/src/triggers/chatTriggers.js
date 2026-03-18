/**
 * Chat Triggers
 * Sends chat notifications server-side when a new message is created.
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');

function normalizeId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function truncateMessagePreview(message) {
  if (typeof message !== 'string') return '';
  const normalized = message.trim().replace(/\s+/g, ' ');
  if (!normalized) return '';
  return normalized.length > 50 ? `${normalized.slice(0, 50)}...` : normalized;
}

const PHONE_PATTERNS = [
  /(?:\+?63[\s.-]?|0)9\d{2}[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
  /\(0\d{1,2}\)[\s.-]?\d{3,4}[\s.-]?\d{4}\b/g,
  /\b0\d{1,2}[\s.-]\d{3,4}[\s.-]\d{4}\b/g,
];

const SOCIAL_PATTERNS = [
  /(?:https?:\/\/)?(?:www\.)?facebook\.com\/[^\s<>]+/gi,
  /(?:https?:\/\/)?(?:www\.)?fb\.com\/[^\s<>]+/gi,
  /(?:https?:\/\/)?(?:www\.)?m\.facebook\.com\/[^\s<>]+/gi,
  /(?:https?:\/\/)?fb\.me\/[^\s<>]+/gi,
  /(?:https?:\/\/)?(?:www\.)?messenger\.com\/[^\s<>]+/gi,
  /(?:https?:\/\/)?m\.me\/[^\s<>]+/gi,
  /(?:https?:\/\/)?(?:www\.)?instagram\.com\/[^\s<>]+/gi,
  /(?:https?:\/\/)?(?:www\.)?instagr\.am\/[^\s<>]+/gi,
  /(?:https?:\/\/)?(?:www\.)?wa\.me\/[^\s<>]+/gi,
  /(?:https?:\/\/)?(?:www\.)?whatsapp\.com\/[^\s<>]+/gi,
  /(?:https?:\/\/)?(?:www\.)?viber\.com\/[^\s<>]+/gi,
  /(?:https?:\/\/)?(?:www\.)?t\.me\/[^\s<>]+/gi,
  /(?:https?:\/\/)?(?:www\.)?telegram\.me\/[^\s<>]+/gi,
  /(?<![a-zA-Z0-9._%+-])@[a-zA-Z][a-zA-Z0-9._]{2,}/g,
];

const EMAIL_PATTERNS = [
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
];

function sanitizeMessageText(message) {
  if (!message || typeof message !== 'string') return '';

  let sanitized = message;
  PHONE_PATTERNS.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, '[Contact Hidden]');
  });
  SOCIAL_PATTERNS.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, '[Link Hidden]');
  });
  EMAIL_PATTERNS.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, '[Email Hidden]');
  });

  sanitized = sanitized.replace(/(\[Contact Hidden\]\s*)+/g, '[Contact Hidden] ');
  sanitized = sanitized.replace(/(\[Link Hidden\]\s*)+/g, '[Link Hidden] ');
  sanitized = sanitized.replace(/(\[Email Hidden\]\s*)+/g, '[Email Hidden] ');

  return sanitized.trim();
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
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    const messagePreview = truncateMessagePreview(sanitizeMessageText(messageData.message));
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
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return null;
  }
);
