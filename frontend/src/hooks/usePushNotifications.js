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
  messagingClientIdentity,
} from '../firebase';
import { useToast } from '../contexts/ToastContext';
import {
  getStoredRegistration,
  getStoredToken,
  persistLocalRegistration,
  clearStoredRegistration,
  purgeLocalMessagingRegistrationArtifacts,
  migrateLegacyKeysForUid,
  ensureMessagingIdentityMigration,
  classifyPushRegistrationError,
  buildPushRegistrationDiagnostics,
  isInUnauthorizedSessionCooldown,
  markUnauthorizedSessionCooldown,
  clearUnauthorizedSessionCooldown,
  cleanupPushRegistrationOnLogout,
} from './pushNotificationUtils';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;
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

function getInitialPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

function buildPushErrorWithMeta(error, meta) {
  if (error instanceof Error) {
    error.pushMeta = { ...(error.pushMeta || {}), ...(meta || {}) };
    return error;
  }
  const wrapped = new Error(String(error || 'Push registration failed.'));
  wrapped.pushMeta = { ...(meta || {}) };
  return wrapped;
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
  const identityMigrationCheckedRef = useRef(false);

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
    clearUnauthorizedSessionCooldown(uid);
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

    const appCheckReady = shouldInitializeAppCheck
      ? await hasValidAppCheckToken(3000).catch(() => false)
      : true;

    const messagingInstance = await getOrInitMessaging();
    if (!messagingInstance) {
      const error = new Error('FCM Messaging is unavailable in this runtime.');
      error.code = 'messaging-unavailable';
      throw error;
    }

    const swReg = await ensureAppServiceWorkerRegistration();
    const messagingModule = await getMessagingModule();

    let token = '';
    try {
      token = await messagingModule.getToken(messagingInstance, {
        vapidKey: VAPID_KEY,
        ...(swReg ? { serviceWorkerRegistration: swReg } : {}),
      });
    } catch (error) {
      throw buildPushErrorWithMeta(error, {
        appCheckReady,
        swScope: swReg?.scope || '',
      });
    }

    if (!token) {
      throw buildPushErrorWithMeta(new Error('FCM registration returned no token.'), {
        appCheckReady,
        swScope: swReg?.scope || '',
      });
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
    clearUnauthorizedSessionCooldown(uid);
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
      if (isInUnauthorizedSessionCooldown(uid)) return;
      void attemptFn();
    }, delayMs);

    return true;
  }, [clearRetryTimer]);

  const registerWithRecovery = useCallback(async (uid, options = {}) => {
    if (!uid) return;

    if (isInUnauthorizedSessionCooldown(uid)) {
      if (options.interactive) {
        showToast({
          title: 'Push temporarily unavailable',
          message: 'Push registration is cooling down for this session. Refresh and try again.',
          type: 'warning',
        });
      }
      return;
    }

    registeredForUid.current = uid;
    try {
      await saveTokenToFirestore(uid);
      registeredForUid.current = uid;
      return;
    } catch (error) {
      registeredForUid.current = null;

      if (isAppCheckTokenError(error)) {
        const scheduled = scheduleRetry(uid, () => registerWithRecovery(uid));
        if (options.interactive || !scheduled) {
          showToast({
            title: 'Push not activated',
            message: 'Security checks are still warming up. Please try again in a moment.',
            type: 'warning',
          });
        }
        return;
      }

      const classification = classifyPushRegistrationError(error);
      const diagnostics = buildPushRegistrationDiagnostics({
        permissionStatus: latestPermissionRef.current,
        appCheckReady: error?.pushMeta?.appCheckReady,
        swRegistration: error?.pushMeta?.swScope ? { scope: error.pushMeta.swScope } : null,
        classification,
      });
      console.warn('[usePushNotifications] Push registration diagnostics:', diagnostics);

      if (classification.category === 'stale_cleanup') {
        await purgeLocalMessagingRegistrationArtifacts();
        clearStoredRegistration(uid);
        setIsRegistered(false);
        retryAttemptRef.current = 0;
        clearRetryTimer();
        if (options.interactive) {
          showToast({
            title: 'Push state refreshed',
            message: 'Stale push state was cleared. Try activating again.',
            type: 'warning',
          });
        }
        return;
      }

      const scheduled = classification.shouldRetry && scheduleRetry(uid, () => registerWithRecovery(uid));
      if (!scheduled) {
        clearLocalPushState(uid);
      }
      if (classification.shouldEnterSessionCooldown) {
        await purgeLocalMessagingRegistrationArtifacts({ includeInstallations: true });
        markUnauthorizedSessionCooldown(uid);
      }

      if (options.interactive || !scheduled) {
        const message = classification.category === 'unauthorized'
          ? 'Push registration is blocked for this session. Refresh and retry.'
          : 'Try again in a moment. If this continues, refresh and retry.';

        showToast({
          title: 'Push not activated',
          message,
          type: 'warning',
        });
      }
    }
  }, [clearLocalPushState, clearRetryTimer, saveTokenToFirestore, scheduleRetry, showToast]);

  useEffect(() => {
    if (identityMigrationCheckedRef.current) return;
    identityMigrationCheckedRef.current = true;

    const migration = ensureMessagingIdentityMigration(messagingClientIdentity);
    if (!migration.migrated) return;

    setIsRegistered(false);
    registeredForUid.current = null;
    retryAttemptRef.current = 0;
    topicSyncSignatureRef.current = '';
    clearRetryTimer();

    if (import.meta.env.DEV) {
      console.info('[usePushNotifications] Messaging identity changed, cleared local push registration artifacts.');
    }
  }, [clearRetryTimer]);

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
    await cleanupPushRegistrationOnLogout({
      uid,
      storedToken,
      deleteStoredTokenDoc: async (token) => deleteDoc(doc(db, 'users', uid, 'fcmTokens', token)),
      clearLocalPushState,
    });
  }

  return { permissionStatus, isRegistered, requestAndRegister, unregisterToken };
}
