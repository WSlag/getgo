import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Hook to fetch all conversations for a user
 * A conversation is derived from bids where the user is either:
 * - The bidder (trucker bidding on cargo, or shipper booking truck)
 * - The listing owner (receiving bids)
 */
export function useConversations(userId) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const toDate = (value) => {
      if (!value) return new Date(0);
      if (value?.toDate && typeof value.toDate === 'function') {
        return value.toDate();
      }
      if (value?._seconds !== undefined) {
        return new Date(value._seconds * 1000);
      }
      const asDate = new Date(value);
      return Number.isNaN(asDate.getTime()) ? new Date(0) : asDate;
    };

    const isMessageRead = (message) => message?.isRead === true || message?.read === true;
    const inferRecipient = (message, bid) => {
      if (message?.recipientId) {
        return message.recipientId;
      }
      if (!message?.senderId || !bid) {
        return null;
      }
      return message.senderId === bid.bidderId ? bid.listingOwnerId : bid.bidderId;
    };

    const bidMap = new Map();
    const messagesByBid = new Map();
    const messageUnsubs = new Map();
    let bidderDocs = [];
    let ownerDocs = [];
    let disposed = false;

    const recompute = () => {
      if (disposed) return;
      const next = Array.from(bidMap.values()).map((bid) => {
        const messages = [...(messagesByBid.get(bid.id) || [])].sort((a, b) => b.createdAt - a.createdAt);
        const lastMessage = messages[0] || null;
        const unreadCount = messages.filter((message) => {
          const recipientId = inferRecipient(message, bid);
          return recipientId === userId && !isMessageRead(message);
        }).length;

        const isUserBidder = bid.bidderId === userId;
        const otherPartyId = isUserBidder ? bid.listingOwnerId : bid.bidderId;
        const otherPartyName = isUserBidder ? bid.listingOwnerName : bid.bidderName;

        return {
          ...bid,
          lastMessage,
          unreadCount,
          otherPartyId,
          otherPartyName: otherPartyName || 'Unknown',
          lastActivityAt: lastMessage?.createdAt || bid.createdAt,
        };
      });

      next.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
      setConversations(next);
      setLoading(false);
      setError(null);
    };

    const unsubscribeBidMessages = (bidId) => {
      const unsubscribe = messageUnsubs.get(bidId);
      if (unsubscribe) {
        unsubscribe();
        messageUnsubs.delete(bidId);
      }
      messagesByBid.delete(bidId);
    };

    const subscribeBidMessages = (bidId) => {
      if (messageUnsubs.has(bidId)) return;

      const q = query(
        collection(db, 'bids', bidId, 'messages'),
        orderBy('createdAt', 'asc')
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const messages = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
            createdAt: toDate(docSnap.data().createdAt),
          }));
          messagesByBid.set(bidId, messages);
          recompute();
        },
        (err) => {
          console.error(`Error subscribing messages for bid ${bidId}:`, err);
          messagesByBid.set(bidId, []);
          recompute();
        }
      );

      messageUnsubs.set(bidId, unsubscribe);
    };

    const syncBids = () => {
      const merged = new Map();
      [...bidderDocs, ...ownerDocs].forEach((docSnap) => {
        if (merged.has(docSnap.id)) return;
        const bidData = docSnap.data();
        merged.set(docSnap.id, {
          id: docSnap.id,
          ...bidData,
          createdAt: toDate(bidData.createdAt),
          updatedAt: toDate(bidData.updatedAt),
        });
      });

      for (const bidId of bidMap.keys()) {
        if (!merged.has(bidId)) {
          bidMap.delete(bidId);
          unsubscribeBidMessages(bidId);
        }
      }

      merged.forEach((bid, bidId) => {
        bidMap.set(bidId, bid);
        subscribeBidMessages(bidId);
      });

      if (merged.size === 0) {
        setConversations([]);
        setLoading(false);
        setError(null);
        return;
      }

      recompute();
    };

    setLoading(true);

    const bidderUnsub = onSnapshot(
      query(collection(db, 'bids'), where('bidderId', '==', userId)),
      (snapshot) => {
        bidderDocs = snapshot.docs;
        syncBids();
      },
      (err) => {
        console.error('Error subscribing bidder conversations:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    const ownerUnsub = onSnapshot(
      query(collection(db, 'bids'), where('listingOwnerId', '==', userId)),
      (snapshot) => {
        ownerDocs = snapshot.docs;
        syncBids();
      },
      (err) => {
        console.error('Error subscribing owner conversations:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => {
      disposed = true;
      bidderUnsub();
      ownerUnsub();
      messageUnsubs.forEach((unsubscribe) => unsubscribe());
      messageUnsubs.clear();
      bidMap.clear();
      messagesByBid.clear();
    };
  }, [userId]);

  return { conversations, loading, error };
}

export default useConversations;
