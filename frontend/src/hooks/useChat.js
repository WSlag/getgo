import { useState, useEffect, useCallback } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { sendChatMessage, markMessagesRead } from '../services/firestoreService';
import { parseTimestampSafely, sortEntitiesOldestFirst } from '../utils/activitySorting';

// Hook to get chat messages for a bid (real-time)
export function useChat(bidId) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!bidId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'bids', bidId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((docSnap) => {
          const messageData = docSnap.data();
          return {
            id: docSnap.id,
            ...messageData,
            createdAt: parseTimestampSafely(messageData.createdAt).date,
          };
        });
        setMessages(sortEntitiesOldestFirst(data, { fallbackKeys: ['sentAt'] }));
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching chat messages:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [bidId]);

  return { messages, loading, error };
}

// Hook for chat actions (send message, mark as read)
export function useChatActions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const sendMessage = useCallback(async (bidId, senderId, senderName, message) => {
    if (!bidId || !senderId || !message?.trim()) {
      throw new Error('Missing required parameters');
    }

    setLoading(true);
    setError(null);

    try {
      // Send via Firestore (creates message + notification)
      await sendChatMessage(bidId, senderId, senderName, message.trim());

      setLoading(false);
      return { success: true };
    } catch (err) {
      console.error('Failed to send message:', err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, []);

  const markAsRead = useCallback(async (bidId, userId) => {
    if (!bidId || !userId) return;

    try {
      await markMessagesRead(bidId, userId);
    } catch (err) {
      console.error('Failed to mark messages as read:', err);
    }
  }, []);

  return {
    sendMessage,
    markAsRead,
    loading,
    error,
  };
}

export default useChat;
