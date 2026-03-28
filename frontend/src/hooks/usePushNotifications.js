/**
 * usePushNotifications
 * Manages FCM token registration, role-topic sync, and foreground message handling.
 *
 * Returns:
 *   permissionStatus - 'default' | 'granted' | 'denied' | 'unsupported'
 *   isRegistered     - true once a token is saved for the active uid
 *   requestAndRegister(uid) - requests permission (if needed) then registers/retries
 *   unregisterToken(uid)    - deletes token locally and from Firestore
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import {
  getOrInitMessaging,
  db,
  functions,
  hasValidAppCheckToken,
  shouldInitializeAppCheck,
} from '../firebase';
import { useToast } from '../contexts/ToastContext';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;
const REGISTERED_KEY_PREFIX = 'karga.push.registered';
const REGISTERED_TOKEN_KEY_PREFIX = 'karga.push.token';
const LEGACY_REGISTERED_KEY = 'karga.push.registered';
const LEGACY_REGISTERED_TOKEN_KEY = 'karga.push.token';
const APP_CHECK_TOKEN_ERROR_CODE = 'app-check-token-unavailable';

const MAX_AUTO_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 1500;
const RETRY_MAX_DELAY_MS = 30000;

let messagingModulePromise = null;

function isAppCheckTokenError(error) {
  return error?.code === APP_CHECK_TOKEN_ERROR_CODE;
}

function isMissingFunctionError(error) {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  return code === 'functions/not-found' || message.includes('not found');
}

function isRetryableRegistrationError(error) {
  if (isAppCheckTokenError(error)) return true;

  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  if (!code && !message) return false;

  return (
    code.includes('unavailable') ||
    code.includes('deadline-exceeded') ||
    code.includes('internal') ||
    code.includes('aborted') ||
    message.includes('network') ||
    message.includes('failed to fetch') ||
    message.includes('service worker') ||
    message.includes('messaging')
  );
}

function getRegisteredKey(uid) {
  return `${REGISTERED_KEY_PREFIX}.${uid}`;
}

function getRegisteredTokenKey(uid) {
  return `${REGISTERED_TOKEN_KEY_PREFIX}.${uid}`;
}

function getInitialPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

function getStoredRegistration(uid) {
  if (!uid) return false;
  try {
    return localStorage.getItem(getRegisteredKey(uid)) === '1';
  } catch {
    return false;
  }
}

function getStoredToken(uid) {
  if (!uid) return '';
  try {
    return localStorage.getItem(getRegisteredTokenKey(uid)) || '';
  } catch {
    return '';
  }
}

function persistLocalRegistration(uid, token) {
  if (!uid || !token) return;
  try {
    localStorage.setItem(getRegisteredKey(uid), '1');
    localStorage.setItem(getRegisteredTokenKey(uid), token);
  } catch {
    // Storage unavailable; rely on in-memory state.
  }
}

function clearStoredRegistration(uid) {
  if (!uid) return;
  try {
    localStorage.removeItem(getRegisteredKey(uid));
    localStorage.removeItem(getRegisteredTokenKey(uid));
  } catch {
    // Ignore storage cleanup failures.
  }
}

function migrateLegacyKeysForUid(uid) {
  if (!uid) return;
  try {
    const legacyRegistered = localStorage.getItem(LEGACY_REGISTERED_KEY);
    const legacyToken = localStorage.getItem(LEGACY_REGISTERED_TOKEN_KEY);

    if (legacyRegistered === '1' && legacyToken) {
      persistLocalRegistration(uid, legacyToken);
    }

    localStorage.removeItem(LEGACY_REGISTERED_KEY);
    localStorage.removeItem(LEGACY_REGISTERED_TOKEN_KEY);
  } catch {
    // Best effort migration.
  }
}

async function getMessagingModule() {
  if (!messagingModulePromise) {
    messagingModulePromise = import('firebase/messaging');
  }
  return messagingModulePromise;
}

async function ensureAppServiceWorkerRegistration() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const existingRootRegistration = await navigator.serviceWorker.getRegistration('/');
    if (existingRootRegistration) return existingRootRegistration;
  } catch {
    // Ignore and attempt registration.
  }

  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    // Ignore and fallback to ready.
  }

  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((resolve) => setTimeout(() => resolve(null), 2500)),
    ]);
  } catch {
    return null;
  }
}

export function usePushNotifications(userId, userRole) {
  const showToast = useToast();
  const [permissionStatus, setPermissionStatus] = useState(getInitialPermission);
  const [isRegistered, setIsRegistered] = useState(() => getStoredRegistration(userId));

  const registeredForUid = useRef(null);
  const retryAttemptRef = useRef(0);
  const retryTimerRef = useRef(null);
  const latestPermissionRef = useRef(permissionStatus);
  const latestUserIdRef = useRef(userId);
  const topicSyncSignatureRef = useRef('');

  useEffect(() => {
    latestPermissionRef.current = permissionStatus;
  }, [permissionStatus]);

  useEffect(() => {
    latestUserIdRef.current = userId;
  }, [userId]);

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const clearLocalPushState = useCallback((uid) => {
    clearStoredRegistration(uid);
    setIsRegistered(false);
    registeredForUid.current = null;
    retryAttemptRef.current = 0;
    topicSyncSignatureRef.current = '';
    clearRetryTimer();
  }, [clearRetryTimer]);

  const syncListingTopicsForRole = useCallback(async (uid, role, options = {}) => {
    if (!uid) return;

    const normalizedRole = String(role || '').trim().toLowerCase();
    const signature = `${uid}:${normalizedRole || 'none'}`;
    if (!options.force && topicSyncSignatureRef.current === signature) {
      return;
    }

    const payload = { role: normalizedRole };

    try {
      await httpsCallable(functions, 'syncListingTopics')(payload);
      topicSyncSignatureRef.current = signature;
      return;
    } catch (error) {
      if (!isMissingFunctionError(error)) {
        if (import.meta.env.DEV) {
          console.warn('[usePushNotifications] Topic sync failed:', error?.message || error);
        }
        return;
      }
    }

    try {
      await httpsCallable(functions, 'subscribeToListingTopics')(payload);
      topicSyncSignatureRef.current = signature;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[usePushNotifications] Topic sync fallback failed:', error?.message || error);
      }
    }
  }, []);

  const saveTokenToFirestore = useCallback(async (uid) => {
    if (!uid) return null;
    if (!VAPID_KEY) {
      const error = new Error('Missing VAPID key for web push registration.');
      error.code = 'missing-vapid-key';
      throw error;
    }

    if (shouldInitializeAppCheck) {
      const appCheckReady = await hasValidAppCheckToken(6000).catch(() => false);
      if (!appCheckReady) {
        const error = new Error('App Check token is unavailable for FCM registration.');
        error.code = APP_CHECK_TOKEN_ERROR_CODE;
        throw error;
      }
    }

    const messagingInstance = await getOrInitMessaging();
    if (!messagingInstance) {
      const error = new Error('FCM Messaging is unavailable in this runtime.');
      error.code = 'messaging-unavailable';
      throw error;
    }

    const swReg = await ensureAppServiceWorkerRegistration();
    const messagingModule = await getMessagingModule();

    const token = await messagingModule.getToken(messagingInstance, {
      vapidKey: VAPID_KEY,
      ...(swReg ? { serviceWorkerRegistration: swReg } : {}),
    });

    if (!token) {
      throw new Error('FCM registration returned no token.');
    }

    const previousToken = getStoredToken(uid);

    await setDoc(
      doc(db, 'users', uid, 'fcmTokens', token),
      {
        token,
        platform: 'web',
        userAgent: navigator.userAgent,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    if (previousToken && previousToken !== token) {
      await deleteDoc(doc(db, 'users', uid, 'fcmTokens', previousToken)).catch(() => {});
    }

    persistLocalRegistration(uid, token);
    setIsRegistered(true);
    retryAttemptRef.current = 0;
    clearRetryTimer();

    await syncListingTopicsForRole(uid, userRole, { force: true });

    return token;
  }, [clearRetryTimer, syncListingTopicsForRole, userRole]);

  const scheduleRetry = useCallback((uid, attemptFn) => {
    if (retryAttemptRef.current >= MAX_AUTO_RETRIES) {
      return false;
    }

    retryAttemptRef.current += 1;
    const attemptNumber = retryAttemptRef.current;
    const delayMs = Math.min(RETRY_BASE_DELAY_MS * (2 ** (attemptNumber - 1)), RETRY_MAX_DELAY_MS);

    clearRetryTimer();
    retryTimerRef.current = setTimeout(() => {
      if (latestUserIdRef.current !== uid) return;
      if (latestPermissionRef.current !== 'granted') return;
      void attemptFn();
    }, delayMs);

    return true;
  }, [clearRetryTimer]);

  const registerWithRecovery = useCallback(async (uid, options = {}) => {
    if (!uid) return;

    registeredForUid.current = uid;
    try {
      await saveTokenToFirestore(uid);
      registeredForUid.current = uid;
      return;
    } catch (error) {
      registeredForUid.current = null;

      if (import.meta.env.DEV) {
        console.warn('[usePushNotifications] Push registration failed:', error?.message || error);
      }

      const retryable = isRetryableRegistrationError(error);
      const scheduled = retryable && scheduleRetry(uid, () => registerWithRecovery(uid));

      if (!scheduled && !isAppCheckTokenError(error)) {
        clearLocalPushState(uid);
      }

      if (options.interactive || !scheduled) {
        showToast({
          title: 'Push not activated',
          message: isAppCheckTokenError(error)
            ? 'Security checks are still warming up. Please try again in a moment.'
            : 'Try again in a moment. If this continues, refresh and retry.',
          type: 'warning',
        });
      }
    }
  }, [clearLocalPushState, saveTokenToFirestore, scheduleRetry, showToast]);

  useEffect(() => {
    if (!userId) {
      setIsRegistered(false);
      registeredForUid.current = null;
      retryAttemptRef.current = 0;
      topicSyncSignatureRef.current = '';
      clearRetryTimer();
      return;
    }

    migrateLegacyKeysForUid(userId);
    setIsRegistered(getStoredRegistration(userId));
    registeredForUid.current = null;
    retryAttemptRef.current = 0;
    topicSyncSignatureRef.current = '';
    clearRetryTimer();
  }, [clearRetryTimer, userId]);

  useEffect(() => {
    if (!userId || permissionStatus !== 'granted') return;
    if (registeredForUid.current === userId) return;

    void registerWithRecovery(userId);
  }, [permissionStatus, registerWithRecovery, userId]);

  useEffect(() => {
    if (!userId || permissionStatus !== 'granted' || !isRegistered) return;
    void syncListingTopicsForRole(userId, userRole);
  }, [isRegistered, permissionStatus, syncListingTopicsForRole, userId, userRole]);

  useEffect(() => {
    if (permissionStatus !== 'granted') return;

    let unsubscribe;
    let cancelled = false;

    (async () => {
      const messagingInstance = await getOrInitMessaging();
      if (!messagingInstance || cancelled) return;

      const messagingModule = await getMessagingModule();
      if (cancelled) return;

      unsubscribe = messagingModule.onMessage(messagingInstance, (payload) => {
        const { title, body } = payload.notification || {};
        if (!title) return;
        showToast({ title, message: body || '', type: payload.data?.type || 'default' });
      });
    })();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [showToast, permissionStatus]);

  useEffect(() => () => {
    clearRetryTimer();
  }, [clearRetryTimer]);

  async function requestAndRegister(uid) {
    if (typeof Notification === 'undefined') return 'unsupported';
    if (!uid) return permissionStatus;

    if (Notification.permission === 'granted') {
      setPermissionStatus('granted');
      retryAttemptRef.current = 0;
      clearRetryTimer();
      await registerWithRecovery(uid, { interactive: true });
      return 'granted';
    }

    const permission = await Notification.requestPermission();
    setPermissionStatus(permission);

    if (permission === 'granted') {
      retryAttemptRef.current = 0;
      clearRetryTimer();
      await registerWithRecovery(uid, { interactive: true });
    }

    return permission;
  }

  async function unregisterToken(uid) {
    if (!uid) return;
    const storedToken = getStoredToken(uid);

    try {
      const messagingInstance = await getOrInitMessaging();
      if (messagingInstance) {
        let appCheckReadyForDelete = true;
        if (shouldInitializeAppCheck) {
          appCheckReadyForDelete = await hasValidAppCheckToken(2500).catch(() => false);
        }

        // Avoid deleteToken() when App Check is unavailable to prevent logout churn.
        if (appCheckReadyForDelete) {
          const messagingModule = await getMessagingModule();
          await messagingModule.deleteToken(messagingInstance).catch(() => {});
        } else if (import.meta.env.DEV) {
          console.warn('[usePushNotifications] Skipping deleteToken() because App Check token is unavailable.');
        }
      }
    } catch {
      // Non-fatal: continue local cleanup.
    }

    if (storedToken) {
      await deleteDoc(doc(db, 'users', uid, 'fcmTokens', storedToken)).catch(() => {});
    }

    clearLocalPushState(uid);
  }

  return { permissionStatus, isRegistered, requestAndRegister, unregisterToken };
}
