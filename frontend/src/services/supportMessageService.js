import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
  onSnapshot
} from 'firebase/firestore';
import { db, auth } from '../firebase';

// ============================================================
// SUPPORT MESSAGE CONSTANTS
// ============================================================

export const SUPPORT_CATEGORIES = [
  { id: 'account', label: 'Account Issues' },
  { id: 'payment', label: 'Payment Problems' },
  { id: 'contract', label: 'Contract Questions' },
  { id: 'technical', label: 'Technical Support' },
  { id: 'bug', label: 'Bug Report' },
  { id: 'other', label: 'Other' }
];

export const CONVERSATION_STATUS = {
  OPEN: 'open',
  PENDING: 'pending',
  RESOLVED: 'resolved',
  CLOSED: 'closed'
};

// ============================================================
// CREATE CONVERSATION
// ============================================================

/**
 * Create a new support conversation
 * @param {string} userId - The user's ID
 * @param {string} userName - The user's display name
 * @param {string} userRole - The user's role (shipper, trucker, broker)
 * @param {string} subject - The support category/subject
 * @param {string} initialMessage - The initial message
 * @returns {Promise<{id: string}>} - The created conversation ID
 */
export const createSupportConversation = async (
  userId,
  userName,
  userRole,
  subject,
  initialMessage
) => {
  const normalizedUserId = typeof userId === 'string' ? userId.trim() : '';
  const normalizedUserName = typeof userName === 'string' && userName.trim()
    ? userName.trim()
    : 'User';
  const normalizedUserRole = typeof userRole === 'string' ? userRole.trim() : 'shipper';
  const normalizedSubject = typeof subject === 'string' ? subject.trim() : '';
  const normalizedMessage = typeof initialMessage === 'string' ? initialMessage.trim() : '';

  if (!normalizedUserId) {
    const err = new Error('User ID is required');
    err.code = 'invalid-argument';
    throw err;
  }

  if (!normalizedSubject) {
    const err = new Error('Subject is required');
    err.code = 'invalid-argument';
    throw err;
  }

  if (!normalizedMessage) {
    const err = new Error('Initial message is required');
    err.code = 'invalid-argument';
    throw err;
  }

  if (normalizedMessage.length > 5000) {
    const err = new Error('Message is too long (max 5000 characters)');
    err.code = 'invalid-argument';
    throw err;
  }

  // Create the conversation document
  const conversationsRef = collection(db, 'supportConversations');
  const conversationRef = doc(conversationsRef);
  const conversationId = conversationRef.id;

  const now = new Date();
  
  await setDoc(conversationRef, {
    userId: normalizedUserId,
    userName: normalizedUserName,
    userRole: normalizedUserRole,
    status: CONVERSATION_STATUS.OPEN,
    subject: normalizedSubject,
    lastMessage: normalizedMessage.substring(0, 200),
    lastMessageAt: now,
    lastMessageSenderId: normalizedUserId,
    unreadCount: 0,
    adminUnreadCount: 1, // Admin has unread because it's a new conversation
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    resolvedBy: null
  });

  // Add the initial message
  const messagesRef = collection(db, 'supportConversations', conversationId, 'messages');
  const messageRef = doc(messagesRef);
  
  await setDoc(messageRef, {
    senderId: normalizedUserId,
    senderName: normalizedUserName,
    senderRole: 'user',
    message: normalizedMessage,
    isRead: false,
    createdAt: now,
    updatedAt: now
  });

  return { id: conversationId };
};

// ============================================================
// SEND MESSAGE
// ============================================================

/**
 * Send a message in an existing support conversation
 * @param {string} conversationId - The conversation ID
 * @param {string} senderId - The sender's ID (user ID or 'admin')
 * @param {string} senderName - The sender's display name
 * @param {string} senderRole - 'user' or 'admin'
 * @param {string} message - The message content
 * @returns {Promise<{id: string}>} - The created message ID
 */
export const sendSupportMessage = async (
  conversationId,
  senderId,
  senderName,
  senderRole,
  message
) => {
  const normalizedConversationId = typeof conversationId === 'string' ? conversationId.trim() : '';
  const normalizedSenderId = typeof senderId === 'string' ? senderId.trim() : '';
  const normalizedSenderName = typeof senderName === 'string' && senderName.trim()
    ? senderName.trim()
    : 'User';
  const normalizedSenderRole = senderRole === 'admin' ? 'admin' : 'user';
  const normalizedMessage = typeof message === 'string' ? message.trim() : '';

  if (!normalizedConversationId) {
    const err = new Error('Conversation ID is required');
    err.code = 'invalid-argument';
    throw err;
  }

  if (!normalizedSenderId) {
    const err = new Error('Sender ID is required');
    err.code = 'invalid-argument';
    throw err;
  }

  if (!normalizedMessage) {
    const err = new Error('Message is required');
    err.code = 'invalid-argument';
    throw err;
  }

  if (normalizedMessage.length > 5000) {
    const err = new Error('Message is too long (max 5000 characters)');
    err.code = 'invalid-argument';
    throw err;
  }

  // Verify conversation exists
  const conversationRef = doc(db, 'supportConversations', normalizedConversationId);
  const conversationSnap = await getDoc(conversationRef);
  
  if (!conversationSnap.exists()) {
    const err = new Error('Conversation not found');
    err.code = 'not-found';
    throw err;
  }

  const conversationData = conversationSnap.data();
  const isAdmin = normalizedSenderRole === 'admin';

  // Verify sender is either the conversation owner or an admin
  if (!isAdmin && conversationData.userId !== normalizedSenderId) {
    const err = new Error('You can only send messages in your own conversations');
    err.code = 'permission-denied';
    throw err;
  }

  const now = new Date();
  const messageRef = doc(collection(db, 'supportConversations', normalizedConversationId, 'messages'));
  
  await setDoc(messageRef, {
    senderId: normalizedSenderId,
    senderName: normalizedSenderName,
    senderRole: normalizedSenderRole,
    message: normalizedMessage,
    isRead: false,
    createdAt: now,
    updatedAt: now
  });

  // Update conversation with last message info
  const updateData = {
    lastMessage: normalizedMessage.substring(0, 200),
    lastMessageAt: now,
    lastMessageSenderId: normalizedSenderId,
    updatedAt: now
  };

  // Increment unread count for the recipient
  if (normalizedSenderRole === 'user') {
    updateData.adminUnreadCount = (conversationData.adminUnreadCount || 0) + 1;
  } else {
    updateData.unreadCount = (conversationData.unreadCount || 0) + 1;
  }

  await updateDoc(conversationRef, updateData);

  return { id: messageRef.id };
};

// ============================================================
// GET CONVERSATIONS
// ============================================================

/**
 * Get all support conversations for a user
 * @param {string} userId - The user's ID
 * @returns {Promise<Array>} - Array of conversation objects
 */
export const getUserConversations = async (userId) => {
  const normalizedUserId = typeof userId === 'string' ? userId.trim() : '';

  if (!normalizedUserId) {
    const err = new Error('User ID is required');
    err.code = 'invalid-argument';
    throw err;
  }

  const conversationsRef = collection(db, 'supportConversations');
  const q = query(
    conversationsRef,
    where('userId', '==', normalizedUserId),
    orderBy('updatedAt', 'desc')
  );

  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

/**
 * Get all support conversations for admin view
 * @param {string} status - Optional status filter
 * @returns {Promise<Array>} - Array of conversation objects
 */
export const getAllConversations = async (status = null) => {
  const conversationsRef = collection(db, 'supportConversations');
  
  let q;
  if (status) {
    q = query(
      conversationsRef,
      where('status', '==', status),
      orderBy('updatedAt', 'desc')
    );
  } else {
    q = query(
      conversationsRef,
      orderBy('updatedAt', 'desc')
    );
  }

  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

/**
 * Get a single conversation by ID
 * @param {string} conversationId - The conversation ID
 * @returns {Promise<Object>} - The conversation object
 */
export const getConversation = async (conversationId) => {
  const normalizedConversationId = typeof conversationId === 'string' ? conversationId.trim() : '';

  if (!normalizedConversationId) {
    const err = new Error('Conversation ID is required');
    err.code = 'invalid-argument';
    throw err;
  }

  const conversationRef = doc(db, 'supportConversations', normalizedConversationId);
  const snapshot = await getDoc(conversationRef);

  if (!snapshot.exists()) {
    const err = new Error('Conversation not found');
    err.code = 'not-found';
    throw err;
  }

  return { id: snapshot.id, ...snapshot.data() };
};

// ============================================================
// GET MESSAGES
// ============================================================

/**
 * Get all messages in a conversation
 * @param {string} conversationId - The conversation ID
 * @returns {Promise<Array>} - Array of message objects
 */
export const getConversationMessages = async (conversationId) => {
  const normalizedConversationId = typeof conversationId === 'string' ? conversationId.trim() : '';

  if (!normalizedConversationId) {
    const err = new Error('Conversation ID is required');
    err.code = 'invalid-argument';
    throw err;
  }

  const messagesRef = collection(db, 'supportConversations', normalizedConversationId, 'messages');
  const q = query(
    messagesRef,
    orderBy('createdAt', 'asc')
  );

  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

/**
 * Subscribe to conversation messages for real-time updates
 * @param {string} conversationId - The conversation ID
 * @param {Function} callback - Callback function to handle updates
 * @returns {Function} - Unsubscribe function
 */
export const subscribeToMessages = (conversationId, callback) => {
  const normalizedConversationId = typeof conversationId === 'string' ? conversationId.trim() : '';

  if (!normalizedConversationId) {
    const err = new Error('Conversation ID is required');
    err.code = 'invalid-argument';
    throw err;
  }

  const messagesRef = collection(db, 'supportConversations', normalizedConversationId, 'messages');
  const q = query(
    messagesRef,
    orderBy('createdAt', 'asc')
  );

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(messages);
  });
};

/**
 * Subscribe to user's conversations for real-time updates
 * @param {string} userId - The user's ID
 * @param {Function} callback - Callback function to handle updates
 * @returns {Function} - Unsubscribe function
 */
export const subscribeToUserConversations = (userId, callback) => {
  const normalizedUserId = typeof userId === 'string' ? userId.trim() : '';

  if (!normalizedUserId) {
    const err = new Error('User ID is required');
    err.code = 'invalid-argument';
    throw err;
  }

  const conversationsRef = collection(db, 'supportConversations');
  const q = query(
    conversationsRef,
    where('userId', '==', normalizedUserId),
    orderBy('updatedAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const conversations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(conversations);
  });
};

/**
 * Subscribe to all conversations for admin view
 * @param {string} status - Optional status filter
 * @param {Function} callback - Callback function to handle updates
 * @returns {Function} - Unsubscribe function
 */
export const subscribeToAllConversations = (status, callback) => {
  const conversationsRef = collection(db, 'supportConversations');
  
  let q;
  if (status) {
    q = query(
      conversationsRef,
      where('status', '==', status),
      orderBy('updatedAt', 'desc')
    );
  } else {
    q = query(
      conversationsRef,
      orderBy('updatedAt', 'desc')
    );
  }

  return onSnapshot(q, (snapshot) => {
    const conversations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(conversations);
  });
};

// ============================================================
// MARK AS READ
// ============================================================

/**
 * Mark messages in a conversation as read
 * @param {string} conversationId - The conversation ID
 * @param {string} userId - The user's ID (to determine which count to reset)
 * @param {boolean} isAdmin - Whether the user is an admin
 */
export const markConversationAsRead = async (conversationId, userId, isAdmin = false) => {
  const normalizedConversationId = typeof conversationId === 'string' ? conversationId.trim() : '';
  const normalizedUserId = typeof userId === 'string' ? userId.trim() : '';

  if (!normalizedConversationId) {
    const err = new Error('Conversation ID is required');
    err.code = 'invalid-argument';
    throw err;
  }

  const conversationRef = doc(db, 'supportConversations', normalizedConversationId);
  const snapshot = await getDoc(conversationRef);

  if (!snapshot.exists()) {
    return; // Conversation might have been deleted
  }

  const updateData = {
    updatedAt: new Date()
  };

  if (isAdmin) {
    updateData.adminUnreadCount = 0;
  } else {
    updateData.unreadCount = 0;
  }

  await updateDoc(conversationRef, updateData);

  // Also mark all messages as read
  const messagesRef = collection(db, 'supportConversations', normalizedConversationId, 'messages');
  const messagesQuery = query(messagesRef, where('isRead', '==', false));
  const messagesSnapshot = await getDocs(messagesQuery);

  const batch = writeBatch(db);
  messagesSnapshot.docs.forEach(msgDoc => {
    batch.update(msgDoc.ref, { isRead: true, updatedAt: new Date() });
  });

  await batch.commit();
};

// ============================================================
// UPDATE CONVERSATION STATUS
// ============================================================

/**
 * Update conversation status
 * @param {string} conversationId - The conversation ID
 * @param {string} status - New status (open, pending, resolved, closed)
 * @param {string} resolvedBy - Admin UID who resolved the conversation (optional)
 */
export const updateConversationStatus = async (conversationId, status, resolvedBy = null) => {
  const normalizedConversationId = typeof conversationId === 'string' ? conversationId.trim() : '';
  const normalizedStatus = typeof status === 'string' ? status.trim() : '';

  if (!normalizedConversationId) {
    const err = new Error('Conversation ID is required');
    err.code = 'invalid-argument';
    throw err;
  }

  const validStatuses = ['open', 'pending', 'resolved', 'closed'];
  if (!validStatuses.includes(normalizedStatus)) {
    const err = new Error('Invalid status value');
    err.code = 'invalid-argument';
    throw err;
  }

  const conversationRef = doc(db, 'supportConversations', normalizedConversationId);
  const snapshot = await getDoc(conversationRef);

  if (!snapshot.exists()) {
    const err = new Error('Conversation not found');
    err.code = 'not-found';
    throw err;
  }

  const updateData = {
    status: normalizedStatus,
    updatedAt: new Date()
  };

  if (normalizedStatus === 'resolved' || normalizedStatus === 'closed') {
    updateData.resolvedAt = new Date();
    if (resolvedBy) {
      updateData.resolvedBy = resolvedBy;
    }
  }

  await updateDoc(conversationRef, updateData);
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Get count of open support conversations (for badges)
 * @returns {Promise<number>} - Count of open conversations
 */
export const getOpenConversationsCount = async () => {
  const conversationsRef = collection(db, 'supportConversations');
  const q = query(
    conversationsRef,
    where('status', 'in', ['open', 'pending'])
  );

  const snapshot = await getDocs(q);
  return snapshot.size;
};

/**
 * Get count of unread admin messages (for admin badges)
 * @returns {Promise<number>} - Count of unread messages
 */
export const getAdminUnreadCount = async () => {
  const conversationsRef = collection(db, 'supportConversations');
  const q = query(
    conversationsRef,
    where('adminUnreadCount', '>', 0)
  );

  const snapshot = await getDocs(q);
  
  // Sum up all unread counts
  let totalUnread = 0;
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    totalUnread += data.adminUnreadCount || 0;
  });
  
  return totalUnread;
};
