import { Router } from 'express';
import { ChatMessage, Bid, User, Notification } from '../models/index.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Get chat messages for a bid
router.get('/:bidId', authenticateToken, async (req, res) => {
  try {
    const bid = await Bid.findByPk(req.params.bidId);
    if (!bid) {
      return res.status(404).json({ error: 'Bid not found' });
    }

    const messages = await ChatMessage.findAll({
      where: { bidId: req.params.bidId },
      include: [
        { model: User, as: 'sender', attributes: ['id', 'name', 'role'] },
      ],
      order: [['createdAt', 'ASC']],
    });

    res.json({ messages });
  } catch (error) {
    console.error('Get chat messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// Send a chat message
router.post('/:bidId', authenticateToken, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const bid = await Bid.findByPk(req.params.bidId, {
      include: [
        { model: User, as: 'bidder' },
      ],
    });

    if (!bid) {
      return res.status(404).json({ error: 'Bid not found' });
    }

    // Create message
    const chatMessage = await ChatMessage.create({
      bidId: req.params.bidId,
      senderId: req.user.id,
      message: message.trim(),
    });

    // Determine recipient
    const recipientId = bid.bidderId === req.user.id
      ? bid.CargoListing?.userId || bid.TruckListing?.userId
      : bid.bidderId;

    // Create notification for recipient
    if (recipientId && recipientId !== req.user.id) {
      await Notification.create({
        userId: recipientId,
        type: 'NEW_MESSAGE',
        title: 'New Message',
        message: `${req.user.name}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`,
        data: { bidId: req.params.bidId },
      });
    }

    // Fetch message with sender info
    const fullMessage = await ChatMessage.findByPk(chatMessage.id, {
      include: [
        { model: User, as: 'sender', attributes: ['id', 'name', 'role'] },
      ],
    });

    res.status(201).json({
      message: 'Message sent successfully',
      chatMessage: fullMessage,
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Mark messages as read
router.put('/:bidId/read', authenticateToken, async (req, res) => {
  try {
    await ChatMessage.update(
      { isRead: true },
      {
        where: {
          bidId: req.params.bidId,
          senderId: { [require('sequelize').Op.ne]: req.user.id },
          isRead: false,
        },
      }
    );

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

// Get unread message count
router.get('/unread/count', authenticateToken, async (req, res) => {
  try {
    // Get all bids where user is involved
    const bids = await Bid.findAll({
      where: {
        [require('sequelize').Op.or]: [
          { bidderId: req.user.id },
          // Would need to include listing checks too
        ],
      },
      attributes: ['id'],
    });

    const bidIds = bids.map(b => b.id);

    const count = await ChatMessage.count({
      where: {
        bidId: { [require('sequelize').Op.in]: bidIds },
        senderId: { [require('sequelize').Op.ne]: req.user.id },
        isRead: false,
      },
    });

    res.json({ unreadCount: count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

export default router;
