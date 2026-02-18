import { Router } from 'express';
import admin from 'firebase-admin';
import { db } from '../config/firestore.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Get unread message count
// IMPORTANT: must be defined before GET /:bidId to avoid Express matching 'unread' as a bidId
router.get('/unread/count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;

    // Get all bids where user is involved (either as bidder or listing owner)
    const bidsSnapshot = await db.collection('bids')
      .where('bidderId', '==', userId)
      .get();

    const bidsSnapshot2 = await db.collection('bids')
      .where('listingOwnerId', '==', userId)
      .get();

    // Combine bid IDs
    const bidIds = [
      ...bidsSnapshot.docs.map(doc => doc.id),
      ...bidsSnapshot2.docs.map(doc => doc.id)
    ];

    // Count unread messages across all bids
    let unreadCount = 0;

    for (const bidId of bidIds) {
      const unreadSnapshot = await db.collection('bids')
        .doc(bidId)
        .collection('messages')
        .where('senderId', '!=', userId)
        .where('isRead', '==', false)
        .get();

      unreadCount += unreadSnapshot.size;
    }

    res.json({ unreadCount });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// Get chat messages for a bid
router.get('/:bidId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { bidId } = req.params;

    // Fetch bid from Firestore
    const bidDoc = await db.collection('bids').doc(bidId).get();

    if (!bidDoc.exists) {
      return res.status(404).json({ error: 'Bid not found' });
    }

    const bid = { id: bidDoc.id, ...bidDoc.data() };

    // 🔒 CRITICAL SECURITY: Verify user is authorized (bidder or listing owner)
    if (bid.bidderId !== userId && bid.listingOwnerId !== userId) {
      return res.status(403).json({ error: 'Not authorized to access this chat' });
    }

    // Fetch messages from Firestore subcollection
    const messagesSnapshot = await db.collection('bids')
      .doc(bidId)
      .collection('messages')
      .orderBy('createdAt', 'asc')
      .get();

    const messages = messagesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || null
    }));

    res.json({ messages });
  } catch (error) {
    console.error('Get chat messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// Send a chat message
router.post('/:bidId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { bidId } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Fetch bid from Firestore
    const bidDoc = await db.collection('bids').doc(bidId).get();

    if (!bidDoc.exists) {
      return res.status(404).json({ error: 'Bid not found' });
    }

    const bid = { id: bidDoc.id, ...bidDoc.data() };

    // 🔒 SECURITY: Verify user is authorized to send messages in this chat
    if (bid.bidderId !== userId && bid.listingOwnerId !== userId) {
      return res.status(403).json({ error: 'Not authorized to send messages in this chat' });
    }

    // Get current user data for sender info
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    // Create message in Firestore subcollection
    const messageRef = db.collection('bids').doc(bidId).collection('messages').doc();
    const chatMessage = {
      senderId: userId,
      senderName: userData?.name || 'Unknown',
      message: message.trim(),
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await messageRef.set(chatMessage);

    // Determine recipient
    const recipientId = bid.bidderId === userId ? bid.listingOwnerId : bid.bidderId;

    // Create notification for recipient
    if (recipientId && recipientId !== userId) {
      await db.collection('users').doc(recipientId).collection('notifications').doc().set({
        type: 'NEW_MESSAGE',
        title: 'New Message',
        message: `${userData?.name || 'Someone'}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`,
        data: { bidId },
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    res.status(201).json({
      message: 'Message sent successfully',
      chatMessage: {
        id: messageRef.id,
        ...chatMessage,
        createdAt: new Date()
      },
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Mark messages as read
router.put('/:bidId/read', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { bidId } = req.params;

    // Fetch bid to verify authorization
    const bidDoc = await db.collection('bids').doc(bidId).get();

    if (!bidDoc.exists) {
      return res.status(404).json({ error: 'Bid not found' });
    }

    const bid = { id: bidDoc.id, ...bidDoc.data() };

    // 🔒 CRITICAL SECURITY: Verify user is authorized
    if (bid.bidderId !== userId && bid.listingOwnerId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Mark messages as read (messages NOT sent by current user)
    const messagesRef = db.collection('bids').doc(bidId).collection('messages');

    const unreadSnapshot = await messagesRef
      .where('senderId', '!=', userId)
      .where('isRead', '==', false)
      .get();

    // Batch update all unread messages
    const batch = db.batch();
    unreadSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, { isRead: true });
    });
    await batch.commit();

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

export default router;
