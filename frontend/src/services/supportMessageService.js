import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { auth, db } from '../firebase';

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

const VALID_USER_ROLES = new Set(['shipper', 'trucker', 'broker', 'admin']);
const VALID_CONVERSATION_STATUSES = new Set(['open', 'pending', 'resolved', 'closed']);
const IDENTITY_CACHE_TTL_MS = 30_000;

let identityCache = null;

const createServiceError = (code, message) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');

const isPermissionDeniedError = (error) => {
  const code = normalizeString(error?.code).toLowerCase();
  const message = normalizeString(error?.message).toLowerCase();
  return (
    code === 'permission-denied'
    || message.includes('permission-denied')
    || message.includes('missing or insufficient permissions')
  );
};

const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeConversationData = (id, data = {}) => ({
  id,
  ...data,
  createdAt: toDate(data.createdAt),
  updatedAt: toDate(data.updatedAt),
  lastMessageAt: toDate(data.lastMessageAt),
  resolvedAt: toDate(data.resolvedAt)
});

const normalizeMessageData = (id, data = {}) => ({
  id,
  ...data,
  createdAt: toDate(data.createdAt),
  updatedAt: toDate(data.updatedAt)
});

const getCurrentAuthUser = () => {
  const user = auth.currentUser;
  if (!user?.uid) {
    throw createServiceError('unauthenticated', 'You must be logged in to use support messaging.');
  }
  return user;
};

const assertCallerUidMatch = (providedUid, authUid, fieldName = 'User ID') => {
  const normalizedProvidedUid = normalizeString(providedUid);
  if (normalizedProvidedUid && normalizedProvidedUid !== authUid) {
    throw createServiceError('permission-denied', `${fieldName} does not match the authenticated user.`);
  }
};

const getProfileRole = (profileData) => {
  const role = normalizeString(profileData?.role).toLowerCase();
  return VALID_USER_ROLES.has(role) ? role : 'shipper';
};

const getDisplayName = (authUser, fallbackName) => {
  const normalizedFallbackName = normalizeString(fallbackName);
  if (normalizedFallbackName) return normalizedFallbackName;
  const normalizedAuthName = normalizeString(authUser?.displayName);
  if (normalizedAuthName) return normalizedAuthName;
  return 'User';
};

const resolveIdentity = async () => {
  const user = getCurrentAuthUser();
  const now = Date.now();

  if (
    identityCache &&
    identityCache.uid === user.uid &&
    identityCache.expiresAt > now
  ) {
    return identityCache;
  }

  let isAdmin = false;
  let role = 'shipper';

  try {
    const tokenResult = await user.getIdTokenResult();
    if (tokenResult?.claims?.admin === true) {
      isAdmin = true;
    }
    const claimRole = normalizeString(tokenResult?.claims?.role).toLowerCase();
    if (VALID_USER_ROLES.has(claimRole)) {
      role = claimRole;
    }
  } catch (error) {
    console.warn('Unable to read token claims for support identity:', error);
  }

  try {
    const profileSnap = await getDoc(doc(db, 'users', user.uid));
    if (profileSnap.exists()) {
      const profile = profileSnap.data();
      if (profile?.isAdmin === true || normalizeString(profile?.role).toLowerCase() === 'admin') {
        isAdmin = true;
      }
      role = getProfileRole(profile);
    }
  } catch (error) {
    console.warn('Unable to read user profile for support identity:', error);
  }

  if (isAdmin) {
    role = 'admin';
  }

  identityCache = {
    uid: user.uid,
    user,
    isAdmin,
    role,
    expiresAt: now + IDENTITY_CACHE_TTL_MS
  };

  return identityCache;
};

const assertValidConversationId = (conversationId) => {
  const normalizedConversationId = normalizeString(conversationId);
  if (!normalizedConversationId) {
    throw createServiceError('invalid-argument', 'Conversation ID is required.');
  }
  return normalizedConversationId;
};

const assertValidMessage = (message) => {
  const normalizedMessage = normalizeString(message);
  if (!normalizedMessage) {
    throw createServiceError('invalid-argument', 'Message is required.');
  }
  if (normalizedMessage.length > 5000) {
    throw createServiceError('invalid-argument', 'Message is too long (max 5000 characters).');
  }
  return normalizedMessage;
};

const assertConversationAccess = (conversationData, identity) => {
  if (!identity.isAdmin && conversationData.userId !== identity.uid) {
    throw createServiceError('permission-denied', 'You can only access your own support conversations.');
  }
};

const assertAdminOnly = (identity, actionLabel = 'perform this action') => {
  if (!identity.isAdmin) {
    throw createServiceError('permission-denied', `You do not have permission to ${actionLabel}.`);
  }
};

const normalizeSubject = (subject) => {
  const normalizedSubject = normalizeString(subject);
  if (!normalizedSubject) {
    throw createServiceError('invalid-argument', 'Subject is required.');
  }
  return normalizedSubject;
};

const mapSnapshotToConversations = (snapshot) => snapshot.docs.map((snapshotDoc) => (
  normalizeConversationData(snapshotDoc.id, snapshotDoc.data())
));

const mapSnapshotToMessages = (snapshot) => snapshot.docs.map((snapshotDoc) => (
  normalizeMessageData(snapshotDoc.id, snapshotDoc.data())
));

const writeMessageDocumentWithRetry = async (
  messageRef,
  payload,
  { attempts = 3, baseDelayMs = 120 } = {}
) => {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await setDoc(messageRef, payload);
      return;
    } catch (error) {
      lastError = error;
      const shouldRetry = isPermissionDeniedError(error) && attempt < attempts;
      if (!shouldRetry) {
        throw error;
      }
      await sleep(baseDelayMs * attempt);
    }
  }

  throw lastError;
};

// ============================================================
// CREATE CONVERSATION
// ============================================================

export const createSupportConversation = async (
  userId,
  userName,
  userRole,
  subject,
  initialMessage
) => {
  const identity = await resolveIdentity();
  assertCallerUidMatch(userId, identity.uid, 'User ID');

  const normalizedSubject = normalizeSubject(subject);
  const normalizedMessage = assertValidMessage(initialMessage);
  const normalizedUserName = getDisplayName(identity.user, userName);

  const requestedRole = normalizeString(userRole).toLowerCase();
  const normalizedUserRole = VALID_USER_ROLES.has(requestedRole) ? requestedRole : identity.role;
  const now = new Date();

  const conversationRef = doc(collection(db, 'supportConversations'));
  await setDoc(conversationRef, {
    userId: identity.uid,
    userName: normalizedUserName,
    userRole: normalizedUserRole,
    status: CONVERSATION_STATUS.OPEN,
    subject: normalizedSubject,
    lastMessage: normalizedMessage.substring(0, 200),
    lastMessageAt: now,
    lastMessageSenderId: identity.uid,
    unreadCount: 0,
    adminUnreadCount: 1,
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    resolvedBy: null
  });

  const messageRef = doc(collection(db, 'supportConversations', conversationRef.id, 'messages'));
  const messagePayload = {
    senderId: identity.uid,
    senderName: normalizedUserName,
    senderRole: 'user',
    message: normalizedMessage,
    isRead: false,
    createdAt: now,
    updatedAt: now
  };

  let messageCreated = false;
  try {
    await writeMessageDocumentWithRetry(messageRef, messagePayload, { attempts: 4, baseDelayMs: 150 });
    messageCreated = true;
  } catch (error) {
    if (isPermissionDeniedError(error)) {
      // Fallback path for occasional parent-document propagation race right after conversation creation.
      await sleep(300);
      try {
        await sendSupportMessage(
          conversationRef.id,
          identity.uid,
          normalizedUserName,
          'user',
          normalizedMessage,
          { skipConversationUpdate: true }
        );
        messageCreated = true;
      } catch (fallbackError) {
        try {
          await deleteDoc(conversationRef);
        } catch (cleanupError) {
          console.warn('Failed to cleanup orphan support conversation after message write failure:', cleanupError);
        }
        throw fallbackError;
      }
    } else {
      try {
        await deleteDoc(conversationRef);
      } catch (cleanupError) {
        console.warn('Failed to cleanup orphan support conversation after message write failure:', cleanupError);
      }
      throw error;
    }
  }

  if (!messageCreated) {
    throw createServiceError('permission-denied', 'Failed to create the initial support message.');
  }

  return { id: conversationRef.id };
};

// ============================================================
// SEND MESSAGE
// ============================================================

export const sendSupportMessage = async (
  conversationId,
  senderId,
  senderName,
  senderRole,
  message,
  options = {}
) => {
  const skipConversationUpdate = options?.skipConversationUpdate === true;
  const normalizedConversationId = assertValidConversationId(conversationId);
  const normalizedMessage = assertValidMessage(message);
  const identity = await resolveIdentity();

  assertCallerUidMatch(senderId, identity.uid, 'Sender ID');

  const requestedSenderRole = normalizeString(senderRole).toLowerCase();
  let derivedSenderRole = identity.isAdmin ? 'admin' : 'user';
  if (requestedSenderRole) {
    if (!['user', 'admin'].includes(requestedSenderRole)) {
      throw createServiceError('invalid-argument', 'Invalid sender role.');
    }
    if (requestedSenderRole === 'admin' && !identity.isAdmin) {
      throw createServiceError('permission-denied', 'Sender role does not match the authenticated user.');
    }
    derivedSenderRole = requestedSenderRole;
  }

  const normalizedSenderName = getDisplayName(
    identity.user,
    senderName || (identity.isAdmin ? 'GetGo Support' : 'User')
  );

  const conversationRef = doc(db, 'supportConversations', normalizedConversationId);
  const conversationSnap = await getDoc(conversationRef);
  if (!conversationSnap.exists()) {
    throw createServiceError('not-found', 'Conversation not found.');
  }

  const conversationData = conversationSnap.data();
  assertConversationAccess(conversationData, identity);

  const now = new Date();
  const messageRef = doc(collection(db, 'supportConversations', normalizedConversationId, 'messages'));
  const messagePayload = {
    senderId: identity.uid,
    senderName: normalizedSenderName,
    senderRole: derivedSenderRole,
    message: normalizedMessage,
    isRead: false,
    createdAt: now,
    updatedAt: now
  };

  await writeMessageDocumentWithRetry(messageRef, messagePayload, { attempts: 3, baseDelayMs: 120 });

  if (skipConversationUpdate) {
    return { id: messageRef.id, metadataUpdated: false };
  }

  const updateData = {
    lastMessage: normalizedMessage.substring(0, 200),
    lastMessageAt: now,
    lastMessageSenderId: identity.uid,
    updatedAt: now
  };

  if (derivedSenderRole === 'user') {
    updateData.adminUnreadCount = (conversationData.adminUnreadCount || 0) + 1;
  } else {
    updateData.unreadCount = (conversationData.unreadCount || 0) + 1;
  }

  try {
    await updateDoc(conversationRef, updateData);
    return { id: messageRef.id, metadataUpdated: true };
  } catch (error) {
    if (isPermissionDeniedError(error)) {
      console.warn('Support message created but conversation metadata update was denied.', error);
      return { id: messageRef.id, metadataUpdated: false };
    }
    throw error;
  }
};

// ============================================================
// GET CONVERSATIONS
// ============================================================

export const getUserConversations = async (userId) => {
  const identity = await resolveIdentity();
  assertCallerUidMatch(userId, identity.uid, 'User ID');

  const conversationsQuery = query(
    collection(db, 'supportConversations'),
    where('userId', '==', identity.uid),
    orderBy('updatedAt', 'desc')
  );

  const snapshot = await getDocs(conversationsQuery);
  return mapSnapshotToConversations(snapshot);
};

export const getAllConversations = async (status = null) => {
  const identity = await resolveIdentity();
  assertAdminOnly(identity, 'view all support conversations');

  const conversationsRef = collection(db, 'supportConversations');
  const conversationsQuery = status
    ? query(conversationsRef, where('status', '==', status), orderBy('updatedAt', 'desc'))
    : query(conversationsRef, orderBy('updatedAt', 'desc'));

  const snapshot = await getDocs(conversationsQuery);
  return mapSnapshotToConversations(snapshot);
};

export const getConversation = async (conversationId) => {
  const normalizedConversationId = assertValidConversationId(conversationId);
  const identity = await resolveIdentity();

  const conversationSnap = await getDoc(doc(db, 'supportConversations', normalizedConversationId));
  if (!conversationSnap.exists()) {
    throw createServiceError('not-found', 'Conversation not found.');
  }

  const conversationData = conversationSnap.data();
  assertConversationAccess(conversationData, identity);
  return normalizeConversationData(conversationSnap.id, conversationData);
};

// ============================================================
// GET MESSAGES
// ============================================================

export const getConversationMessages = async (conversationId) => {
  const normalizedConversationId = assertValidConversationId(conversationId);
  const identity = await resolveIdentity();

  const conversationSnap = await getDoc(doc(db, 'supportConversations', normalizedConversationId));
  if (!conversationSnap.exists()) {
    throw createServiceError('not-found', 'Conversation not found.');
  }

  assertConversationAccess(conversationSnap.data(), identity);

  const messagesQuery = query(
    collection(db, 'supportConversations', normalizedConversationId, 'messages'),
    orderBy('createdAt', 'asc')
  );

  const snapshot = await getDocs(messagesQuery);
  return mapSnapshotToMessages(snapshot);
};

export const subscribeToMessages = (conversationId, callback, errorCallback) => {
  const normalizedConversationId = assertValidConversationId(conversationId);
  getCurrentAuthUser();

  const messagesQuery = query(
    collection(db, 'supportConversations', normalizedConversationId, 'messages'),
    orderBy('createdAt', 'asc')
  );

  return onSnapshot(
    messagesQuery,
    (snapshot) => {
      callback(mapSnapshotToMessages(snapshot));
    },
    (error) => {
      console.error('Error subscribing to messages:', error);
      if (errorCallback) {
        errorCallback(error);
      }
    }
  );
};

export const subscribeToUserConversations = (userId, callback, errorCallback) => {
  const authUser = getCurrentAuthUser();
  assertCallerUidMatch(userId, authUser.uid, 'User ID');

  const conversationsQuery = query(
    collection(db, 'supportConversations'),
    where('userId', '==', authUser.uid),
    orderBy('updatedAt', 'desc')
  );

  return onSnapshot(
    conversationsQuery,
    (snapshot) => {
      callback(mapSnapshotToConversations(snapshot));
    },
    (error) => {
      console.error('Error subscribing to user conversations:', error);
      if (errorCallback) {
        errorCallback(error);
      }
    }
  );
};

export const subscribeToAllConversations = (status, callback, errorCallback) => {
  getCurrentAuthUser();

  const conversationsRef = collection(db, 'supportConversations');
  const conversationsQuery = status
    ? query(conversationsRef, where('status', '==', status), orderBy('updatedAt', 'desc'))
    : query(conversationsRef, orderBy('updatedAt', 'desc'));

  return onSnapshot(
    conversationsQuery,
    (snapshot) => {
      callback(mapSnapshotToConversations(snapshot));
    },
    (error) => {
      console.error('Error subscribing to all conversations:', error);
      if (errorCallback) {
        errorCallback(error);
      }
    }
  );
};

// ============================================================
// MARK AS READ
// ============================================================

export const markConversationAsRead = async (conversationId, userId) => {
  const normalizedConversationId = assertValidConversationId(conversationId);
  const identity = await resolveIdentity();
  assertCallerUidMatch(userId, identity.uid, 'User ID');

  const conversationRef = doc(db, 'supportConversations', normalizedConversationId);
  const snapshot = await getDoc(conversationRef);
  if (!snapshot.exists()) {
    return;
  }

  const conversationData = snapshot.data();
  assertConversationAccess(conversationData, identity);

  const updateData = {
    updatedAt: new Date(),
    unreadCount: identity.isAdmin ? (conversationData.unreadCount || 0) : 0,
    adminUnreadCount: identity.isAdmin ? 0 : (conversationData.adminUnreadCount || 0)
  };
  await updateDoc(conversationRef, updateData);

  const messagesQuery = query(
    collection(db, 'supportConversations', normalizedConversationId, 'messages'),
    where('isRead', '==', false)
  );
  const messagesSnapshot = await getDocs(messagesQuery);
  if (messagesSnapshot.empty) {
    return;
  }

  const batchSize = 400;
  for (let index = 0; index < messagesSnapshot.docs.length; index += batchSize) {
    const batch = writeBatch(db);
    const chunk = messagesSnapshot.docs.slice(index, index + batchSize);
    chunk.forEach((messageDoc) => {
      batch.update(messageDoc.ref, { isRead: true, updatedAt: new Date() });
    });
    await batch.commit();
  }
};

// ============================================================
// UPDATE CONVERSATION STATUS
// ============================================================

export const updateConversationStatus = async (conversationId, status, resolvedBy = null) => {
  const normalizedConversationId = assertValidConversationId(conversationId);
  const normalizedStatus = normalizeString(status).toLowerCase();
  if (!VALID_CONVERSATION_STATUSES.has(normalizedStatus)) {
    throw createServiceError('invalid-argument', 'Invalid status value.');
  }

  const identity = await resolveIdentity();
  assertAdminOnly(identity, 'update support conversation status');

  const conversationRef = doc(db, 'supportConversations', normalizedConversationId);
  const snapshot = await getDoc(conversationRef);
  if (!snapshot.exists()) {
    throw createServiceError('not-found', 'Conversation not found.');
  }

  const normalizedResolvedBy = normalizeString(resolvedBy);
  const resolverUid = normalizedResolvedBy || identity.uid;

  const updateData = {
    status: normalizedStatus,
    updatedAt: new Date()
  };

  if (normalizedStatus === CONVERSATION_STATUS.RESOLVED || normalizedStatus === CONVERSATION_STATUS.CLOSED) {
    updateData.resolvedAt = new Date();
    updateData.resolvedBy = resolverUid;
  } else {
    updateData.resolvedAt = null;
    updateData.resolvedBy = null;
  }

  await updateDoc(conversationRef, updateData);
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

export const getOpenConversationsCount = async () => {
  const identity = await resolveIdentity();
  assertAdminOnly(identity, 'view support conversation metrics');

  const snapshot = await getDocs(query(
    collection(db, 'supportConversations'),
    where('status', 'in', [CONVERSATION_STATUS.OPEN, CONVERSATION_STATUS.PENDING])
  ));
  return snapshot.size;
};

export const getAdminUnreadCount = async () => {
  const identity = await resolveIdentity();
  assertAdminOnly(identity, 'view unread support message counts');

  const snapshot = await getDocs(query(
    collection(db, 'supportConversations'),
    where('adminUnreadCount', '>', 0)
  ));

  return snapshot.docs.reduce((totalUnread, snapshotDoc) => {
    const count = Number(snapshotDoc.data()?.adminUnreadCount || 0);
    return totalUnread + (Number.isFinite(count) ? count : 0);
  }, 0);
};
