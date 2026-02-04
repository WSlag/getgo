import { useEffect, useState, useCallback, useRef } from 'react';
import { socketService } from '../services/socketService';

/**
 * Custom hook for Socket.io integration
 * Handles connection lifecycle and event subscriptions
 */
export function useSocket(userId) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastBid, setLastBid] = useState(null);
  const [lastMessage, setLastMessage] = useState(null);
  const [lastTrackingUpdate, setLastTrackingUpdate] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const unsubscribersRef = useRef([]);

  // Connect when userId is available
  useEffect(() => {
    if (!userId) return;

    socketService.connect(userId);

    // Track connection status
    const checkConnection = setInterval(() => {
      setIsConnected(socketService.isConnected());
    }, 1000);

    // Subscribe to events
    const unsubBid = socketService.onBidReceived((data) => {
      console.log('Bid received via socket:', data);
      setLastBid(data);
      addNotification({
        type: 'bid',
        title: 'New Bid Received',
        message: `${data.bidderName || 'Someone'} placed a bid of ₱${data.amount?.toLocaleString() || data.price?.toLocaleString()}`,
        data,
        timestamp: Date.now(),
      });
    });

    const unsubBidAccepted = socketService.onBidAccepted((data) => {
      console.log('Bid accepted via socket:', data);
      addNotification({
        type: 'bid-accepted',
        title: 'Bid Accepted!',
        message: `Your bid on ${data.cargoDescription || 'cargo'} was accepted`,
        data,
        timestamp: Date.now(),
      });
    });

    const unsubMessage = socketService.onNewMessage((data) => {
      console.log('Message received via socket:', data);
      setLastMessage(data);
      addNotification({
        type: 'message',
        title: 'New Message',
        message: `${data.senderName || 'Someone'}: ${data.preview || data.message?.substring(0, 50)}`,
        data,
        timestamp: Date.now(),
      });
    });

    const unsubTracking = socketService.onTrackingUpdate((data) => {
      console.log('Tracking update via socket:', data);
      setLastTrackingUpdate(data);
      addNotification({
        type: 'tracking',
        title: 'Shipment Update',
        message: `Shipment is now at ${data.currentLocation || data.city}`,
        data,
        timestamp: Date.now(),
      });
    });

    const unsubNotification = socketService.onNotification((data) => {
      console.log('Notification via socket:', data);
      addNotification(data);
    });

    unsubscribersRef.current = [
      unsubBid,
      unsubBidAccepted,
      unsubMessage,
      unsubTracking,
      unsubNotification,
    ];

    return () => {
      clearInterval(checkConnection);
      unsubscribersRef.current.forEach((unsub) => unsub?.());
      socketService.disconnect();
    };
  }, [userId]);

  // Add notification to the list
  const addNotification = useCallback((notification) => {
    setNotifications((prev) => [
      { id: Date.now(), ...notification },
      ...prev.slice(0, 49), // Keep last 50 notifications
    ]);
  }, []);

  // Clear a specific notification
  const clearNotification = useCallback((notificationId) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  }, []);

  // Clear all notifications
  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Join a listing room
  const joinListing = useCallback((listingId) => {
    socketService.joinListing(listingId);
  }, []);

  // Leave a listing room
  const leaveListing = useCallback((listingId) => {
    socketService.leaveListing(listingId);
  }, []);

  // Emit a new bid
  const emitBid = useCallback((bidData) => {
    socketService.emitNewBid(bidData);
  }, []);

  // Emit bid accepted
  const emitBidAccepted = useCallback((data) => {
    socketService.emitBidAccepted(data);
  }, []);

  // Emit a chat message
  const emitMessage = useCallback((messageData) => {
    socketService.emitChatMessage(messageData);
  }, []);

  // Emit a shipment update
  const emitShipmentUpdate = useCallback((updateData) => {
    socketService.emitShipmentUpdate(updateData);
  }, []);

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
