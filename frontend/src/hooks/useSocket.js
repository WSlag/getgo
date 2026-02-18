import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * useSocket — Real-time event hook backed by Firestore onSnapshot.
 *
 * Previously used Socket.io (Express backend). Now uses Firestore listeners
 * so the app works without any backend server.
 *
 * Surfaces the same return shape as before so call sites need no changes:
 *   isConnected, lastBid, lastMessage, lastTrackingUpdate, notifications,
 *   addNotification, clearNotification, clearAllNotifications,
 *   joinListing, leaveListing, emitBid, emitBidAccepted, emitMessage, emitShipmentUpdate
 */
export function useSocket(userId) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastBid, setLastBid] = useState(null);
  const [lastMessage, setLastMessage] = useState(null);
  const [lastTrackingUpdate, setLastTrackingUpdate] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const initializedRef = useRef(false);

  // Add a notification to the in-memory list
  const addNotification = useCallback((notification) => {
    setNotifications((prev) => [
      { id: Date.now() + Math.random(), ...notification },
      ...prev.slice(0, 49),
    ]);
  }, []);

  const clearNotification = useCallback((notificationId) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  }, []);

  const clearAllNotifications = useCallback(() => setNotifications([]), []);

  useEffect(() => {
    if (!userId) {
      setIsConnected(false);
      return;
    }

    setIsConnected(true); // Firestore is always "connected" when authenticated
    initializedRef.current = true;
    const unsubscribers = [];

    // ── Watch bids on user's listings for new-bid events ──────────────────
    const bidsOnMyListingsQ = query(
      collection(db, 'bids'),
      where('listingOwnerId', '==', userId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    let firstBidSnapshot = true;
    const unsubBids = onSnapshot(bidsOnMyListingsQ, (snap) => {
      if (firstBidSnapshot) { firstBidSnapshot = false; return; } // skip initial load
      snap.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const bid = { id: change.doc.id, ...change.doc.data() };
          setLastBid(bid);
          addNotification({
            type: 'bid',
            title: 'New Bid Received',
            message: `${bid.bidderName || 'Someone'} placed a bid of ₱${(bid.price || bid.amount || 0).toLocaleString()}`,
            data: bid,
            timestamp: Date.now(),
          });
        }
      });
    });
    unsubscribers.push(unsubBids);

    // ── Watch user notifications (created by Firestore triggers) ──────────
    const notificationsQ = query(
      collection(db, 'users', userId, 'notifications'),
      where('isRead', '==', false),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    let firstNotifSnapshot = true;
    const unsubNotifs = onSnapshot(notificationsQ, (snap) => {
      if (firstNotifSnapshot) { firstNotifSnapshot = false; return; }
      snap.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const notif = { id: change.doc.id, ...change.doc.data() };
          addNotification({
            type: notif.type || 'notification',
            title: notif.title || 'Notification',
            message: notif.message || '',
            data: notif.data || {},
            timestamp: Date.now(),
          });

          // Surface specific event types
          if (notif.type === 'NEW_BID' && notif.data?.bidId) {
            setLastBid({ id: notif.data.bidId, ...notif.data });
          }
          if (notif.type === 'NEW_MESSAGE') {
            setLastMessage({ bidId: notif.data?.bidId, ...notif.data });
          }
        }
      });
    });
    unsubscribers.push(unsubNotifs);

    // ── Watch active shipments for tracking updates ────────────────────────
    const shipmentsQ = query(
      collection(db, 'shipments'),
      where('participantIds', 'array-contains', userId),
      where('status', 'in', ['picked_up', 'in_transit']),
      orderBy('updatedAt', 'desc'),
      limit(5)
    );

    let firstShipmentSnapshot = true;
    const unsubShipments = onSnapshot(shipmentsQ, (snap) => {
      if (firstShipmentSnapshot) { firstShipmentSnapshot = false; return; }
      snap.docChanges().forEach((change) => {
        if (change.type === 'modified') {
          const shipment = { id: change.doc.id, ...change.doc.data() };
          setLastTrackingUpdate(shipment);
          addNotification({
            type: 'tracking',
            title: 'Shipment Update',
            message: `Shipment is now at ${shipment.currentLocation || shipment.city || 'unknown location'}`,
            data: shipment,
            timestamp: Date.now(),
          });
        }
      });
    });
    unsubscribers.push(unsubShipments);

    return () => {
      setIsConnected(false);
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [userId, addNotification]);

  // These emit functions are no-ops — writes go through firestoreService directly
  const joinListing = useCallback(() => {}, []);
  const leaveListing = useCallback(() => {}, []);
  const emitBid = useCallback(() => {}, []);
  const emitBidAccepted = useCallback(() => {}, []);
  const emitMessage = useCallback(() => {}, []);
  const emitShipmentUpdate = useCallback(() => {}, []);

  return {
    isConnected,
    lastBid,
    lastMessage,
    lastTrackingUpdate,
    notifications,
    addNotification,
    clearNotification,
    clearAllNotifications,
    joinListing,
    leaveListing,
    emitBid,
    emitBidAccepted,
    emitMessage,
    emitShipmentUpdate,
  };
}

export default useSocket;
