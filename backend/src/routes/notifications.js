import { Router } from 'express';
import admin from 'firebase-admin';
import { db } from '../config/firestore.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Get all notifications for user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { limit = 50, offset = 0, unreadOnly = false } = req.query;

    // Build query
    let query = db.collection('users').doc(userId).collection('notifications')
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit))
      .offset(parseInt(offset));

    // Filter by unread if requested
    if (unreadOnly === 'true') {
      query = db.collection('users').doc(userId).collection('notifications')
        .where('isRead', '==', false)
        .orderBy('createdAt', 'desc')
        .limit(parseInt(limit))
        .offset(parseInt(offset));
    }

    const notificationsSnapshot = await query.get();

    const notifications = notificationsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || null,
    }));

    // Get total count and unread count
    const allSnapshot = unreadOnly === 'true'
      ? await db.collection('users').doc(userId).collection('notifications')
          .where('isRead', '==', false)
          .get()
      : await db.collection('users').doc(userId).collection('notifications').get();

    const unreadSnapshot = await db.collection('users').doc(userId).collection('notifications')
      .where('isRead', '==', false)
      .get();

    res.json({
      notifications,
      total: allSnapshot.size,
      unreadCount: unreadSnapshot.size,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

// Get unread count
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;

    const unreadSnapshot = await db.collection('users').doc(userId).collection('notifications')
      .where('isRead', '==', false)
      .get();

    res.json({ unreadCount: unreadSnapshot.size });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// Mark notification as read
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const notificationId = req.params.id;

    const notificationRef = db.collection('users').doc(userId).collection('notifications').doc(notificationId);
    const notificationDoc = await notificationRef.get();

    if (!notificationDoc.exists) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // 🔒 AUTHORIZATION: Notification is in user's subcollection, so already authorized
    await notificationRef.update({
      isRead: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.put('/read-all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;

    // Get all unread notifications
    const unreadSnapshot = await db.collection('users').doc(userId).collection('notifications')
      .where('isRead', '==', false)
      .get();

    // Batch update all unread notifications
    const batch = db.batch();
    unreadSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        isRead: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

// Delete a notification
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const notificationId = req.params.id;

    const notificationRef = db.collection('users').doc(userId).collection('notifications').doc(notificationId);
    const notificationDoc = await notificationRef.get();

    if (!notificationDoc.exists) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // 🔒 AUTHORIZATION: Notification is in user's subcollection, so already authorized
    await notificationRef.delete();

    res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Delete all read notifications
router.delete('/clear-read', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;

    // Get all read notifications
    const readSnapshot = await db.collection('users').doc(userId).collection('notifications')
      .where('isRead', '==', true)
      .get();

    // Batch delete all read notifications
    const batch = db.batch();
    readSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    res.json({ message: 'Read notifications cleared' });
  } catch (error) {
    console.error('Clear notifications error:', error);
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
});

export default router;
