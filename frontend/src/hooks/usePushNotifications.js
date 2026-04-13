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
import { doc, setDoc, deleteDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import {
  getOrInitMessaging,
  db,
  functions,
  hasValidAppCheckToken,
  hasValidMessagingInstallationAuthToken,
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
  shouldPurgeInstallationsForStaleCleanup,
  markStaleCleanupInstallationsPurged,
  migrateLegacyKeysForUid,
  ensureMessagingIdentityMigration,
  classifyPushRegistrationError,
  buildPushRegistrationDiagnostics,
  shouldShortCircuitForAppCheck,
  isInUnauthorizedSessionCooldown,
  markUnauthorizedSessionCooldown,
  clearUnauthorizedSessionCooldown,
  shouldPreferProjectDefaultVapidForSession,
  markProjectDefaultVapidPreferredForSession,
  clearProjectDefaultVapidPreferredForSession,
  cleanupPushRegistrationOnLogout,
  reconcileBrowserTokenRegistration,
} from './pushNotificationUtils';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;
const VAPID_MODE = (() => {
  const normalized = String(import.meta.env.VITE_FIREBASE_VAPID_MODE || 'auto').trim().toLowerCase();
  if (normalized === 'configured' || normalized === 'project_default' || normalized === 'auto') {
    return normalized;
  }
  return 'auto';
})();
const APP_CHECK_TOKEN_ERROR_CODE = 'app-check-token-unavailable';
const INSTALLATIONS_AUTH_ERROR_CODE = 'installations-auth-unavailable';

const MAX_AUTO_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 1500;
const RETRY_MAX_DELAY_MS = 30000;
const VAPID_KEY_DEBUG_PREFIX_LEN = 12;

let messagingModulePromise = null;

function isAppCheckTokenError(error) {
  return error?.code === APP_CHECK_TOKEN_ERROR_CODE;
}

function isInstallationsAuthError(error) {
  return error?.code === INSTALLATIONS_AUTH_ERROR_CODE;
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

  // Prefer the app-shell worker when available (production build).
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    // Ignore and try firebase messaging worker fallback (dev/localhost).
  }

  try {
    return await navigator.serviceWorker.register('/firebase-messaging-sw.js');
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

async function clearServiceWorkerPushSubscription(swRegistration) {
  if (!swRegistration?.pushManager?.getSubscription) {
    return false;
  }

  try {
    const existingSubscription = await swRegistration.pushManager.getSubscription();
    if (!existingSubscription) return false;
    return await existingSubscription.unsubscribe().catch(() => false);
  } catch {
    return false;
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
  const [isRegistrationStatusChecked, setIsRegistrationStatusChecked] = useState(
    () => !(userId && getInitialPermission() === 'granted')
  );

  const registeredForUid = useRef(null);
  const retryAttemptRef = useRef(0);
  const retryTimerRef = useRef(null);
  const latestPermissionRef = useRef(permissionStatus);
  const latestUserIdRef = useRef(userId);
  const topicSyncSignatureRef = useRef('');
  const identityMigrationCheckedRef = useRef(false);
  const unauthorizedSelfHealAttemptedRef = useRef(new Set());
  const registrationInFlightRef = useRef(new Set());

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
    clearProjectDefaultVapidPreferredForSession(uid);
    unauthorizedSelfHealAttemptedRef.current.delete(uid);
    registrationInFlightRef.current.delete(uid);
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
    const hasConfiguredVapid = Boolean(VAPID_KEY);
    if (VAPID_MODE === 'configured' && !hasConfiguredVapid) {
      const error = new Error('Missing VAPID key for web push registration.');
      error.code = 'missing-vapid-key';
      throw error;
    }

    const appCheckReady = shouldInitializeAppCheck
      ? await hasValidAppCheckToken(3000).catch(() => false)
      : true;
    if (shouldShortCircuitForAppCheck({
      appCheckRequired: shouldInitializeAppCheck,
      appCheckReady,
    })) {
      const error = new Error('App Check token unavailable.');
      error.code = APP_CHECK_TOKEN_ERROR_CODE;
      throw buildPushErrorWithMeta(error, {
        appCheckReady,
      });
    }

    const installationsReady = await hasValidMessagingInstallationAuthToken(3000, true).catch(() => false);
    if (!installationsReady) {
      const error = new Error(
        'Messaging registration blocked: Firebase Installations auth token is unavailable (unauthorized session).'
      );
      error.code = INSTALLATIONS_AUTH_ERROR_CODE;
      throw buildPushErrorWithMeta(error, {
        appCheckReady,
        installationsReady,
      });
    }

    const messagingInstance = await getOrInitMessaging();
    if (!messagingInstance) {
      const error = new Error('FCM Messaging is unavailable in this runtime.');
      error.code = 'messaging-unavailable';
      throw error;
    }

    const swReg = await ensureAppServiceWorkerRegistration();
    const messagingModule = await getMessagingModule();
    const prefersProjectDefaultVapid = shouldPreferProjectDefaultVapidForSession(uid);
    const canUseConfiguredVapid = VAPID_MODE !== 'project_default' && hasConfiguredVapid;
    const forceConfiguredVapid = VAPID_MODE === 'configured';
    const shouldTryConfiguredFirst = canUseConfiguredVapid && !prefersProjectDefaultVapid;

    let token = '';
    let tokenAcquisitionMode = shouldTryConfiguredFirst
      ? 'configured_vapid'
      : prefersProjectDefaultVapid
        ? 'project_default_vapid_session_preferred'
        : 'project_default_vapid';

    const buildGetTokenOptions = (mode) => ({
      ...(mode === 'configured' && VAPID_KEY ? { vapidKey: VAPID_KEY } : {}),
      ...(swReg ? { serviceWorkerRegistration: swReg } : {}),
    });

    if (shouldTryConfiguredFirst) {
      try {
        token = await messagingModule.getToken(messagingInstance, buildGetTokenOptions('configured'));
        clearProjectDefaultVapidPreferredForSession(uid);
      } catch (error) {
        const classification = classifyPushRegistrationError(error);
        const shouldTryProjectDefaultVapid =
          !forceConfiguredVapid && (
            classification.category === 'unauthorized'
            || String(error?.code || '').toLowerCase().includes('token-subscribe-failed')
          );

        if (!shouldTryProjectDefaultVapid) {
          throw buildPushErrorWithMeta(error, {
            appCheckReady,
            installationsReady,
            swScope: swReg?.scope || '',
            tokenAcquisitionMode: 'configured_vapid_failed',
            configuredVapidPrefix: String(VAPID_KEY).slice(0, VAPID_KEY_DEBUG_PREFIX_LEN),
          });
        }

        const hadMutableVapidKey =
          messagingInstance
          && typeof messagingInstance === 'object'
          && Object.prototype.hasOwnProperty.call(messagingInstance, 'vapidKey');
        const previousRuntimeVapidKey = hadMutableVapidKey ? messagingInstance.vapidKey : undefined;
        const fallbackSubscriptionCleared = await clearServiceWorkerPushSubscription(swReg);
        markProjectDefaultVapidPreferredForSession(uid);
        try {
          if (hadMutableVapidKey) {
            messagingInstance.vapidKey = undefined;
          }
          token = await messagingModule.getToken(messagingInstance, buildGetTokenOptions('project_default'));
          tokenAcquisitionMode = fallbackSubscriptionCleared
            ? 'project_default_vapid_fallback_after_subscription_reset'
            : 'project_default_vapid_fallback';
          console.warn('[usePushNotifications] FCM token acquired via project-default VAPID fallback.', {
            configuredVapidPrefix: String(VAPID_KEY).slice(0, VAPID_KEY_DEBUG_PREFIX_LEN),
            fallbackSubscriptionCleared,
          });
        } catch (fallbackError) {
          throw buildPushErrorWithMeta(fallbackError, {
            appCheckReady,
            installationsReady,
            swScope: swReg?.scope || '',
            tokenAcquisitionMode: 'project_default_vapid_fallback_failed',
            configuredVapidPrefix: String(VAPID_KEY).slice(0, VAPID_KEY_DEBUG_PREFIX_LEN),
            fallbackSubscriptionCleared,
          });
        } finally {
          if (hadMutableVapidKey) {
            messagingInstance.vapidKey = previousRuntimeVapidKey;
          }
        }
      }
    } else {
      try {
        token = await messagingModule.getToken(messagingInstance, buildGetTokenOptions('project_default'));
      } catch (error) {
        const classification = classifyPushRegistrationError(error);
        const shouldRetryAfterSubscriptionReset =
          classification.category === 'unauthorized'
          || String(error?.code || '').toLowerCase().includes('token-subscribe-failed');

        if (!shouldRetryAfterSubscriptionReset) {
          throw buildPushErrorWithMeta(error, {
            appCheckReady,
            installationsReady,
            swScope: swReg?.scope || '',
            tokenAcquisitionMode: tokenAcquisitionMode === 'project_default_vapid_session_preferred'
              ? 'project_default_vapid_session_preferred_failed'
              : 'project_default_vapid_failed',
            configuredVapidPrefix: String(VAPID_KEY).slice(0, VAPID_KEY_DEBUG_PREFIX_LEN),
          });
        }

        const fallbackSubscriptionCleared = await clearServiceWorkerPushSubscription(swReg);
        const hadMutableVapidKey =
          messagingInstance
          && typeof messagingInstance === 'object'
          && Object.prototype.hasOwnProperty.call(messagingInstance, 'vapidKey');
        // In project-default mode, clear any runtime-customized key before retry.
        // This avoids reusing stale configured-key state from earlier sessions.
        if (hadMutableVapidKey) {
          messagingInstance.vapidKey = undefined;
        }
        markProjectDefaultVapidPreferredForSession(uid);

        try {
          token = await messagingModule.getToken(messagingInstance, buildGetTokenOptions('project_default'));
          tokenAcquisitionMode = fallbackSubscriptionCleared
            ? 'project_default_vapid_recovery_after_subscription_reset'
            : 'project_default_vapid_recovery';
          console.warn('[usePushNotifications] FCM token acquired after project-default recovery reset.', {
            fallbackSubscriptionCleared,
            configuredVapidPrefix: String(VAPID_KEY).slice(0, VAPID_KEY_DEBUG_PREFIX_LEN),
          });
        } catch (fallbackError) {
          throw buildPushErrorWithMeta(fallbackError, {
            appCheckReady,
            installationsReady,
            swScope: swReg?.scope || '',
            tokenAcquisitionMode: 'project_default_vapid_recovery_failed',
            configuredVapidPrefix: String(VAPID_KEY).slice(0, VAPID_KEY_DEBUG_PREFIX_LEN),
            fallbackSubscriptionCleared,
          });
        }
      }
    }

    if (!token) {
      throw buildPushErrorWithMeta(new Error('FCM registration returned no token.'), {
        appCheckReady,
        installationsReady,
        swScope: swReg?.scope || '',
        tokenAcquisitionMode,
        configuredVapidPrefix: String(VAPID_KEY).slice(0, VAPID_KEY_DEBUG_PREFIX_LEN),
      });
    }

    const previousToken = getStoredToken(uid);

    try {
      await setDoc(
        doc(db, 'users', uid, 'fcmTokens', token),
        {
          token,
          tokenAcquisitionMode,
          platform: 'web',
          userAgent: navigator.userAgent,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      throw buildPushErrorWithMeta(error, {
        appCheckReady,
        installationsReady,
        swScope: swReg?.scope || '',
        tokenAcquisitionMode,
        configuredVapidPrefix: String(VAPID_KEY).slice(0, VAPID_KEY_DEBUG_PREFIX_LEN),
        registrationStage: 'firestore_write_failed',
      });
    }

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

  const resolveMessagingTokenForVerification = useCallback(async () => {
    const hasConfiguredVapid = Boolean(VAPID_KEY);
    if (VAPID_MODE === 'configured' && !hasConfiguredVapid) return '';
    const prefersProjectDefaultVapid = shouldPreferProjectDefaultVapidForSession(userId);
    const shouldUseConfiguredVapid =
      VAPID_MODE !== 'project_default'
      && hasConfiguredVapid
      && !prefersProjectDefaultVapid;

    // Warm App Check opportunistically, but continue verification even when
    // attestation is temporarily unavailable.
    if (shouldInitializeAppCheck) {
      await hasValidAppCheckToken(2500).catch(() => false);
    }
    const installationsReady = await hasValidMessagingInstallationAuthToken(2500).catch(() => false);
    if (!installationsReady) return '';

    const messagingInstance = await getOrInitMessaging();
    if (!messagingInstance) return '';

    const swReg = await ensureAppServiceWorkerRegistration();
    const messagingModule = await getMessagingModule();

    return messagingModule.getToken(messagingInstance, {
      ...(shouldUseConfiguredVapid ? { vapidKey: VAPID_KEY } : {}),
      ...(swReg ? { serviceWorkerRegistration: swReg } : {}),
    });
  }, [userId]);

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

    if (registrationInFlightRef.current.has(uid)) {
      if (options.interactive) {
        showToast({
          title: 'Push activation in progress',
          message: 'Please wait for the current activation attempt to finish.',
          type: 'warning',
        });
      }
      return;
    }

    registrationInFlightRef.current.add(uid);

    try {
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

        if (isInstallationsAuthError(error)) {
          const scheduled = scheduleRetry(uid, () => registerWithRecovery(uid));
          if (options.interactive || !scheduled) {
            showToast({
              title: 'Push not activated',
              message: 'Security session is still syncing. Please try again in a moment.',
              type: 'warning',
            });
          }
          return;
        }

        const classification = classifyPushRegistrationError(error);
        let recoveryAction = 'none';
        let purgedInstallations = false;
        let cooldownSet = false;

        if (classification.category === 'stale_cleanup') {
          const includeInstallations = shouldPurgeInstallationsForStaleCleanup(uid);
          await purgeLocalMessagingRegistrationArtifacts({ includeInstallations });
          if (includeInstallations) {
            markStaleCleanupInstallationsPurged(uid);
            purgedInstallations = true;
            recoveryAction = 'stale_cleanup_full_reset';
          } else {
            recoveryAction = 'stale_cleanup_reset';
          }
          clearStoredRegistration(uid);
          setIsRegistered(false);
          retryAttemptRef.current = 0;
          clearRetryTimer();
          markUnauthorizedSessionCooldown(uid);
          cooldownSet = true;
          recoveryAction = 'stale_cleanup_session_cooldown';
          const diagnostics = buildPushRegistrationDiagnostics({
            permissionStatus: latestPermissionRef.current,
            appCheckReady: error?.pushMeta?.appCheckReady,
            installationsReady: error?.pushMeta?.installationsReady,
            swRegistration: error?.pushMeta?.swScope ? { scope: error.pushMeta.swScope } : null,
            tokenAcquisitionMode: error?.pushMeta?.tokenAcquisitionMode,
            configuredVapidPrefix: error?.pushMeta?.configuredVapidPrefix,
            registrationStage: error?.pushMeta?.registrationStage,
            classification,
            recoveryAction,
            purgedInstallations,
            cooldownSet,
          });
          console.warn('[usePushNotifications] Push registration diagnostics:', diagnostics);
          if (options.interactive) {
            showToast({
              title: 'Push temporarily unavailable',
              message: 'Push registration is blocked for this session. Refresh and try again.',
              type: 'warning',
            });
          }
          return;
        }

        if (classification.category === 'unauthorized' && options.allowUnauthorizedSelfHeal !== false) {
          const hasAttemptedSelfHeal = unauthorizedSelfHealAttemptedRef.current.has(uid);
          if (!hasAttemptedSelfHeal) {
            unauthorizedSelfHealAttemptedRef.current.add(uid);
            await purgeLocalMessagingRegistrationArtifacts({ includeInstallations: true });
            clearStoredRegistration(uid);
            setIsRegistered(false);
            retryAttemptRef.current = 0;
            clearRetryTimer();
            purgedInstallations = true;
            recoveryAction = options.interactive
              ? 'unauthorized_self_heal_interactive_retry'
              : 'unauthorized_session_cooldown_after_self_heal';

            const diagnostics = buildPushRegistrationDiagnostics({
              permissionStatus: latestPermissionRef.current,
              appCheckReady: error?.pushMeta?.appCheckReady,
              installationsReady: error?.pushMeta?.installationsReady,
              swRegistration: error?.pushMeta?.swScope ? { scope: error.pushMeta.swScope } : null,
              tokenAcquisitionMode: error?.pushMeta?.tokenAcquisitionMode,
              configuredVapidPrefix: error?.pushMeta?.configuredVapidPrefix,
              registrationStage: error?.pushMeta?.registrationStage,
              classification,
              recoveryAction,
              purgedInstallations,
              cooldownSet,
            });
            console.warn('[usePushNotifications] Push registration diagnostics:', diagnostics);

            if (options.interactive) {
              clearUnauthorizedSessionCooldown(uid);
              setTimeout(() => {
                void registerWithRecovery(uid, {
                  interactive: true,
                  allowUnauthorizedSelfHeal: false,
                });
              }, 0);
            } else {
              markUnauthorizedSessionCooldown(uid);
              cooldownSet = true;
              showToast({
                title: 'Push temporarily unavailable',
                message: 'Push registration is blocked for this session. Refresh and retry.',
                type: 'warning',
              });
            }
            return;
          }
        }

        const scheduled = classification.shouldRetry && scheduleRetry(uid, () => registerWithRecovery(uid));
        if (!scheduled) {
          clearLocalPushState(uid);
          recoveryAction = 'local_state_cleared';
        } else {
          recoveryAction = 'retry_scheduled';
        }
        if (classification.shouldEnterSessionCooldown) {
          await purgeLocalMessagingRegistrationArtifacts({ includeInstallations: true });
          markUnauthorizedSessionCooldown(uid);
          purgedInstallations = true;
          cooldownSet = true;
          recoveryAction = 'unauthorized_session_cooldown';
        }
        const diagnostics = buildPushRegistrationDiagnostics({
          permissionStatus: latestPermissionRef.current,
          appCheckReady: error?.pushMeta?.appCheckReady,
          installationsReady: error?.pushMeta?.installationsReady,
          swRegistration: error?.pushMeta?.swScope ? { scope: error.pushMeta.swScope } : null,
          tokenAcquisitionMode: error?.pushMeta?.tokenAcquisitionMode,
          configuredVapidPrefix: error?.pushMeta?.configuredVapidPrefix,
          registrationStage: error?.pushMeta?.registrationStage,
          classification,
          recoveryAction,
          purgedInstallations,
          cooldownSet,
        });
        console.warn('[usePushNotifications] Push registration diagnostics:', diagnostics);

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
    } finally {
      registrationInFlightRef.current.delete(uid);
    }
  }, [
    clearLocalPushState,
    clearRetryTimer,
    clearUnauthorizedSessionCooldown,
    saveTokenToFirestore,
    scheduleRetry,
    showToast,
  ]);

  useEffect(() => {
    if (identityMigrationCheckedRef.current) return;
    identityMigrationCheckedRef.current = true;

    const migration = ensureMessagingIdentityMigration(messagingClientIdentity);
    if (!migration.migrated) return;

    setIsRegistered(false);
    registeredForUid.current = null;
    retryAttemptRef.current = 0;
    topicSyncSignatureRef.current = '';
    // Purge stale messaging/installations IndexedDB state after app identity migration.
    void purgeLocalMessagingRegistrationArtifacts({ includeInstallations: true });
    clearRetryTimer();

    if (import.meta.env.DEV) {
      console.info('[usePushNotifications] Messaging identity changed, cleared local push registration artifacts.');
    }
  }, [clearRetryTimer]);

  useEffect(() => {
    if (!userId) {
      setIsRegistered(false);
      setIsRegistrationStatusChecked(true);
      registeredForUid.current = null;
      retryAttemptRef.current = 0;
      topicSyncSignatureRef.current = '';
      unauthorizedSelfHealAttemptedRef.current.clear();
      registrationInFlightRef.current.clear();
      clearRetryTimer();
      return;
    }

    migrateLegacyKeysForUid(userId);
    setIsRegistered(getStoredRegistration(userId));
    setIsRegistrationStatusChecked(permissionStatus !== 'granted');
    registeredForUid.current = null;
    retryAttemptRef.current = 0;
    topicSyncSignatureRef.current = '';
    unauthorizedSelfHealAttemptedRef.current.delete(userId);
    clearRetryTimer();
  }, [clearRetryTimer, permissionStatus, userId]);

  useEffect(() => {
    if (!userId || permissionStatus !== 'granted') {
      setIsRegistrationStatusChecked(true);
      return;
    }

    let cancelled = false;

    const reconcileRegistrationState = async () => {
      setIsRegistrationStatusChecked(false);

      if (isInUnauthorizedSessionCooldown(userId)) {
        setIsRegistered(false);
        registeredForUid.current = null;
        setIsRegistrationStatusChecked(true);
        return;
      }

      const storedToken = getStoredToken(userId);
      const reconciliation = await reconcileBrowserTokenRegistration({
        storedToken,
        // Avoid passive getToken() calls when we have no local token to verify.
        // This prevents background FCM registration churn for users who still need
        // to explicitly activate push from the UI.
        resolveToken: storedToken ? resolveMessagingTokenForVerification : undefined,
        hasTokenDocument: async (token) => {
          const tokenDoc = await getDoc(doc(db, 'users', userId, 'fcmTokens', token));
          return tokenDoc.exists();
        },
      });

      if (cancelled) return;

      if (reconciliation.isRegistered) {
        persistLocalRegistration(userId, reconciliation.token);
        clearUnauthorizedSessionCooldown(userId);
        setIsRegistered(true);
        registeredForUid.current = userId;
        retryAttemptRef.current = 0;
        clearRetryTimer();
      } else {
        setIsRegistered(false);
        registeredForUid.current = null;
        if (reconciliation.reason === 'token-doc-missing' && reconciliation.tokenSource === 'storage') {
          clearStoredRegistration(userId);
        }
        if (import.meta.env.DEV && reconciliation.reason !== 'no-token') {
          console.info('[usePushNotifications] Registration reconciliation result:', reconciliation.reason);
        }
      }

      setIsRegistrationStatusChecked(true);
    };

    void reconcileRegistrationState();

    return () => {
      cancelled = true;
    };
  }, [
    clearRetryTimer,
    permissionStatus,
    resolveMessagingTokenForVerification,
    userId,
  ]);

  useEffect(() => {
    if (!userId || permissionStatus !== 'granted') return;
    if (!isRegistrationStatusChecked) return;
    if (isRegistered) return;
    if (registeredForUid.current === userId) return;
    if (isInUnauthorizedSessionCooldown(userId)) return;

    // Only auto-recover registrations we already had locally before.
    // Fresh activation stays explicit via the "Activate/Retry Activation" actions.
    const hasStoredToken = Boolean(getStoredToken(userId));
    if (!hasStoredToken) return;

    void registerWithRecovery(userId);
  }, [isRegistered, isRegistrationStatusChecked, permissionStatus, registerWithRecovery, userId]);

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
      clearUnauthorizedSessionCooldown(uid);
      await registerWithRecovery(uid, { interactive: true });
      return 'granted';
    }

    const permission = await Notification.requestPermission();
    setPermissionStatus(permission);

    if (permission === 'granted') {
      retryAttemptRef.current = 0;
      clearRetryTimer();
      clearUnauthorizedSessionCooldown(uid);
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

  return {
    permissionStatus,
    isRegistered,
    isRegistrationStatusChecked,
    requestAndRegister,
    unregisterToken,
  };
}
