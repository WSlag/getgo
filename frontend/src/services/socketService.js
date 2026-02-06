import { io } from 'socket.io-client';

// Socket.io client configuration
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

class SocketService {
  constructor() {
    this.socket = null;
    this.userId = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  /**
   * Initialize socket connection
   * @param {string} userId - The user's ID to join their room
   */
  connect(userId) {
    if (this.socket?.connected && this.userId === userId) {
      console.log('Socket already connected for user:', userId);
      return;
    }

    // Disconnect existing connection if user changed
    if (this.socket && this.userId !== userId) {
      this.disconnect();
    }

    this.userId = userId;

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    this.setupEventHandlers();

    // Join user-specific room
    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket.id);
      this.reconnectAttempts = 0;
      if (this.userId) {
        this.socket.emit('join', this.userId);
      }
    });
  }

  /**
   * Set up default event handlers
   */
  setupEventHandlers() {
    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    this.socket.on('connect_error', () => {
      this.reconnectAttempts++;

      // Only log first error to reduce console noise
      if (this.reconnectAttempts === 1) {
        console.warn(`Socket server unavailable (${SOCKET_URL}) - real-time features disabled`);
      }

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.info('Running in offline mode. Start backend server for real-time features.');
      }
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('Socket reconnected after', attemptNumber, 'attempts');
      if (this.userId) {
        this.socket.emit('join', this.userId);
      }
    });
  }

  /**
   * Disconnect socket
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.userId = null;
      this.listeners.clear();
    }
  }

  /**
   * Check if socket is connected
   */
  isConnected() {
    return this.socket?.connected || false;
  }

  // ============================================================
  // LISTING ROOM MANAGEMENT
  // ============================================================

  /**
   * Join a listing room to receive real-time bid updates
   * @param {string} listingId - The listing ID to watch
   */
  joinListing(listingId) {
    if (this.socket?.connected) {
      this.socket.emit('join-listing', listingId);
      console.log('Joined listing room:', listingId);
    }
  }

  /**
   * Leave a listing room
   * @param {string} listingId - The listing ID to stop watching
   */
  leaveListing(listingId) {
    if (this.socket?.connected) {
      this.socket.emit('leave-listing', listingId);
      console.log('Left listing room:', listingId);
    }
  }

  // ============================================================
  // EMIT EVENTS
  // ============================================================

  /**
   * Emit a new bid event
   * @param {Object} bidData - The bid data to broadcast
   */
  emitNewBid(bidData) {
    if (this.socket?.connected) {
      this.socket.emit('new-bid', bidData);
      console.log('Emitted new-bid event:', bidData);
    }
  }

  /**
   * Emit a bid accepted event
   * @param {Object} data - The accepted bid data
   */
  emitBidAccepted(data) {
    if (this.socket?.connected) {
      this.socket.emit('bid-accepted', data);
      console.log('Emitted bid-accepted event:', data);
    }
  }

  /**
   * Emit a new chat message
   * @param {Object} messageData - The message data
   */
  emitChatMessage(messageData) {
    if (this.socket?.connected) {
      this.socket.emit('chat-message', messageData);
      console.log('Emitted chat-message event:', messageData);
    }
  }

  /**
   * Emit a shipment tracking update
   * @param {Object} updateData - The shipment update data
   */
  emitShipmentUpdate(updateData) {
    if (this.socket?.connected) {
      this.socket.emit('shipment-update', updateData);
      console.log('Emitted shipment-update event:', updateData);
    }
  }

  // ============================================================
  // SUBSCRIBE TO EVENTS
  // ============================================================

  /**
   * Subscribe to bid received events
   * @param {Function} callback - Callback function when bid is received
   * @returns {Function} Unsubscribe function
   */
  onBidReceived(callback) {
    if (!this.socket) return () => {};

    this.socket.on('bid-received', callback);
    return () => this.socket?.off('bid-received', callback);
  }

  /**
   * Subscribe to bid accepted events
   * @param {Function} callback - Callback function when bid is accepted
   * @returns {Function} Unsubscribe function
   */
  onBidAccepted(callback) {
    if (!this.socket) return () => {};

    this.socket.on('bid-accepted', callback);
    return () => this.socket?.off('bid-accepted', callback);
  }

  /**
   * Subscribe to new message events
   * @param {Function} callback - Callback function when message is received
   * @returns {Function} Unsubscribe function
   */
  onNewMessage(callback) {
    if (!this.socket) return () => {};

    this.socket.on('new-message', callback);
    return () => this.socket?.off('new-message', callback);
  }

  /**
   * Subscribe to tracking update events
   * @param {Function} callback - Callback function when tracking is updated
   * @returns {Function} Unsubscribe function
   */
  onTrackingUpdate(callback) {
    if (!this.socket) return () => {};

    this.socket.on('tracking-update', callback);
    return () => this.socket?.off('tracking-update', callback);
  }

  /**
   * Subscribe to notification events
   * @param {Function} callback - Callback function for notifications
   * @returns {Function} Unsubscribe function
   */
  onNotification(callback) {
    if (!this.socket) return () => {};

    this.socket.on('notification', callback);
    return () => this.socket?.off('notification', callback);
  }

  /**
   * Generic event subscription
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this.socket) return () => {};

    this.socket.on(event, callback);
    return () => this.socket?.off(event, callback);
  }
}

// Export singleton instance
export const socketService = new SocketService();
export default socketService;
