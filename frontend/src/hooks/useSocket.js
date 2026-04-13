import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { safeFirestoreUnsubscribe } from '../utils/firebaseErrors';

/**
 * useSocket - Real-time event hook backed by Firestore onSnapshot.
 *
 * Kept API-compatible with the old socket-based hook:
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

    setIsConnected(true);
    initializedRef.current = true;
    const unsubscribers = [];

    const bidsOnMyListingsQ = query(
      collection(db, 'bids'),
      where('listingOwnerId', '==', userId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    let firstBidSnapshot = true;
    try {
      const unsubBids = onSnapshot(
        bidsOnMyListingsQ,
        (snap) => {
          if (firstBidSnapshot) {
            firstBidSnapshot = false;
            return;
          }
          snap.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const bid = { id: change.doc.id, ...change.doc.data() };
              setLastBid(bid);
              addNotification({
                type: 'bid',
                title: 'New Bid Received',
                message: `${bid.bidderName || 'Someone'} placed a bid of PHP ${(bid.price || bid.amount || 0).toLocaleString()}`,
                data: bid,
                timestamp: Date.now(),
              });
            }
          });
        },
        (error) => {
          if (import.meta.env.DEV) console.warn('useSocket: bids listener error:', error?.message || error);
        }
      );
      unsubscribers.push(unsubBids);
    } catch (error) {
      if (import.meta.env.DEV) console.warn('useSocket: failed to subscribe bids:', error?.message || error);
    }

    const notificationsQ = query(
      collection(db, 'users', userId, 'notifications'),
      where('isRead', '==', false),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    let firstNotifSnapshot = true;
    try {
      const unsubNotifs = onSnapshot(
        notificationsQ,
        (snap) => {
          if (firstNotifSnapshot) {
            firstNotifSnapshot = false;
            return;
          }
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

              if (notif.type === 'NEW_BID' && notif.data?.bidId) {
                setLastBid({ id: notif.data.bidId, ...notif.data });
              }
              if (notif.type === 'NEW_MESSAGE') {
                setLastMessage({ bidId: notif.data?.bidId, ...notif.data });
              }
            }
          });
        },
        (error) => {
          if (import.meta.env.DEV) console.warn('useSocket: notifications listener error:', error?.message || error);
        }
      );
      unsubscribers.push(unsubNotifs);
    } catch (error) {
      if (import.meta.env.DEV) console.warn('useSocket: failed to subscribe notifications:', error?.message || error);
    }

    const shipmentsQ = query(
      collection(db, 'shipments'),
      where('participantIds', 'array-contains', userId),
      where('status', 'in', ['pending_pickup', 'picked_up', 'in_transit']),
      orderBy('updatedAt', 'desc'),
      limit(5)
    );

    let firstShipmentSnapshot = true;
    try {
      const unsubShipments = onSnapshot(
        shipmentsQ,
        (snap) => {
          if (firstShipmentSnapshot) {
            firstShipmentSnapshot = false;
            return;
          }
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
        },
        (error) => {
          if (import.meta.env.DEV) console.warn('useSocket: shipments listener error:', error?.message || error);
        }
      );
      unsubscribers.push(unsubShipments);
    } catch (error) {
      if (import.meta.env.DEV) console.warn('useSocket: failed to subscribe shipments:', error?.message || error);
    }

    return () => {
      setIsConnected(false);
      unsubscribers.forEach((unsubscribe) => safeFirestoreUnsubscribe(unsubscribe, 'useSocket listener'));
    };
  }, [userId, addNotification]);

  // No-op emitters. Writes are handled by Firestore services directly.
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
