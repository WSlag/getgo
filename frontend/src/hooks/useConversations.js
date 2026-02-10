import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
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

    const fetchConversations = async () => {
      try {
        setLoading(true);

        // Get all bids where user is the bidder
        const bidderQuery = query(
          collection(db, 'bids'),
          where('bidderId', '==', userId)
        );
        const bidderSnapshot = await getDocs(bidderQuery);

        // Get all bids where user is the listing owner
        const ownerQuery = query(
          collection(db, 'bids'),
          where('listingOwnerId', '==', userId)
        );
        const ownerSnapshot = await getDocs(ownerQuery);

        // Combine and deduplicate bids
        const bidMap = new Map();

        [...bidderSnapshot.docs, ...ownerSnapshot.docs].forEach((bidDoc) => {
          const bidData = bidDoc.data();
          if (!bidMap.has(bidDoc.id)) {
            bidMap.set(bidDoc.id, {
              id: bidDoc.id,
              ...bidData,
              createdAt: bidData.createdAt?.toDate?.() || new Date(),
            });
          }
        });

        // Fetch last message for each bid
        const conversationsWithMessages = await Promise.all(
          Array.from(bidMap.values()).map(async (bid) => {
            try {
              // Get last message
              const messagesQuery = query(
                collection(db, 'bids', bid.id, 'messages')
              );
              const messagesSnapshot = await getDocs(messagesQuery);

              const messages = messagesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.() || new Date(),
              })).sort((a, b) => b.createdAt - a.createdAt);

              const lastMessage = messages[0] || null;
              const unreadCount = messages.filter(
                msg => msg.recipientId === userId && !msg.read
              ).length;

              // Determine other party info
              const isUserBidder = bid.bidderId === userId;
              const otherPartyId = isUserBidder ? bid.listingOwnerId : bid.bidderId;
              const otherPartyName = isUserBidder ? bid.listingOwnerName : bid.bidderName;

              return {
                ...bid,
                lastMessage,
                unreadCount,
                otherPartyId,
                otherPartyName: otherPartyName || 'Unknown',
                // Use last message time if available, otherwise bid creation time
                lastActivityAt: lastMessage?.createdAt || bid.createdAt,
              };
            } catch (err) {
              console.error(`Error fetching messages for bid ${bid.id}:`, err);
              return {
                ...bid,
                lastMessage: null,
                unreadCount: 0,
                otherPartyId: bid.bidderId === userId ? bid.listingOwnerId : bid.bidderId,
                otherPartyName: bid.bidderId === userId ? bid.listingOwnerName : bid.bidderName || 'Unknown',
                lastActivityAt: bid.createdAt,
              };
            }
          })
        );

        // Sort by last activity (most recent first)
        conversationsWithMessages.sort((a, b) => b.lastActivityAt - a.lastActivityAt);

        setConversations(conversationsWithMessages);
        setError(null);
      } catch (err) {
        console.error('Error fetching conversations:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();

    // Refresh every 30 seconds
    const interval = setInterval(fetchConversations, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  return { conversations, loading, error };
}

export default useConversations;
