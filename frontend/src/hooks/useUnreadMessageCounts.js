import { useEffect, useState } from 'react';
import { collection, collectionGroup, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { isPermissionDeniedError, reportFirestoreListenerError } from '../utils/firebaseErrors';
import { inferBidPerspectiveRole } from '../utils/workspace';

const EMPTY_UNREAD_BY_WORKSPACE = Object.freeze({
  shipper: 0,
  trucker: 0,
});

function isMessageRead(message) {
  return message?.isRead === true || message?.read === true;
}

export function useUnreadMessageCounts(userId, enabled = true) {
  const [totalUnread, setTotalUnread] = useState(0);
  const [unreadByWorkspace, setUnreadByWorkspace] = useState(EMPTY_UNREAD_BY_WORKSPACE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) {
      setTotalUnread(0);
      setUnreadByWorkspace(EMPTY_UNREAD_BY_WORKSPACE);
      setLoading(false);
      setError(null);
      return;
    }

    if (!userId) {
      setTotalUnread(0);
      setUnreadByWorkspace(EMPTY_UNREAD_BY_WORKSPACE);
      setLoading(false);
      setError(null);
      return;
    }

    let disposed = false;
    let bidderDocs = [];
    let ownerDocs = [];
    let unreadByBid = new Map();
    const bidsById = new Map();

    const recompute = () => {
      if (disposed) return;

      let total = 0;
      let shipper = 0;
      let trucker = 0;

      unreadByBid.forEach((count, bidId) => {
        const unread = Number(count || 0);
        if (!Number.isFinite(unread) || unread <= 0) return;
        total += unread;

        const workspaceRole = inferBidPerspectiveRole(bidsById.get(bidId), userId);
        if (workspaceRole === 'shipper') shipper += unread;
        if (workspaceRole === 'trucker') trucker += unread;
      });

      setTotalUnread(total);
      setUnreadByWorkspace({ shipper, trucker });
      setLoading(false);
      setError(null);
    };

    const syncBids = () => {
      const merged = new Map();
      [...bidderDocs, ...ownerDocs].forEach((docSnap) => {
        const bidData = docSnap.data() || {};
        const isParticipant = bidData.bidderId === userId || bidData.listingOwnerId === userId;
        if (!isParticipant) return;

        const existing = merged.get(docSnap.id);
        const nextBid = {
          id: docSnap.id,
          ...bidData,
          hasPendingWrites: docSnap.metadata.hasPendingWrites === true,
        };

        if (!existing || (existing.hasPendingWrites && !nextBid.hasPendingWrites)) {
          merged.set(docSnap.id, nextBid);
        }
      });

      bidsById.clear();
      merged.forEach((bid, bidId) => {
        bidsById.set(bidId, bid);
      });
      recompute();
    };

    setLoading(true);

    const bidderUnsub = onSnapshot(
      query(collection(db, 'bids'), where('bidderId', '==', userId)),
      { includeMetadataChanges: true },
      (snapshot) => {
        bidderDocs = snapshot.docs;
        syncBids();
      },
      (err) => {
        reportFirestoreListenerError('unread counts bidder bids', err);
        if (!isPermissionDeniedError(err)) {
          setError(err?.message || 'Unable to listen to bidder bids');
        }
      }
    );

    const ownerUnsub = onSnapshot(
      query(collection(db, 'bids'), where('listingOwnerId', '==', userId)),
      { includeMetadataChanges: true },
      (snapshot) => {
        ownerDocs = snapshot.docs;
        syncBids();
      },
      (err) => {
        reportFirestoreListenerError('unread counts owner bids', err);
        if (!isPermissionDeniedError(err)) {
          setError(err?.message || 'Unable to listen to owner bids');
        }
      }
    );

    const unreadMessagesUnsub = onSnapshot(
      query(collectionGroup(db, 'messages'), where('recipientId', '==', userId)),
      (snapshot) => {
        const nextUnreadByBid = new Map();
        snapshot.docs.forEach((docSnap) => {
          const messageData = docSnap.data() || {};
          if (isMessageRead(messageData)) return;

          const bidId = docSnap.ref?.parent?.parent?.id || null;
          if (!bidId) return;

          nextUnreadByBid.set(bidId, (nextUnreadByBid.get(bidId) || 0) + 1);
        });
        unreadByBid = nextUnreadByBid;
        recompute();
      },
      (err) => {
        reportFirestoreListenerError('unread counts messages', err);
        unreadByBid = new Map();
        recompute();
        if (!isPermissionDeniedError(err)) {
          setError(err?.message || 'Unable to listen to unread messages');
        }
      }
    );

    return () => {
      disposed = true;
      bidderUnsub();
      ownerUnsub();
      unreadMessagesUnsub();
      unreadByBid.clear();
      bidsById.clear();
    };
  }, [userId, enabled]);

  return { totalUnread, unreadByWorkspace, loading, error };
}

export default useUnreadMessageCounts;
