/**
 * usePushNotifications
 * Manages FCM push notification token registration, topic subscription, and
 * foreground message handling.
 *
 * Returns:
 *   permissionStatus  - 'default' | 'granted' | 'denied' | 'unsupported'
 *   isRegistered      - true once a token is saved to Firestore
 *   requestAndRegister(uid) - requests OS permission, saves token, subscribes to topics
 *   unregisterToken(uid)    - deletes token locally and from Firestore (call on logout)
 */

import { useState, useEffect, useRef } from 'react';
import { getToken, onMessage, deleteToken } from 'firebase/messaging';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getOrInitMessaging, db, functions, waitForAppCheckInitialization, shouldInitializeAppCheck } from '../firebase';
import { useToast } from '../contexts/ToastContext';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;
const REGISTERED_KEY = 'karga.push.registered';
const REGISTERED_TOKEN_KEY = 'karga.push.token';

function getInitialPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

export function usePushNotifications(userId, userRole) {
  const showToast = useToast();
  const [permissionStatus, setPermissionStatus] = useState(getInitialPermission);
  const [isRegistered, setIsRegistered] = useState(
    () => localStorage.getItem(REGISTERED_KEY) === '1'
  );
  const registeredForUid = useRef(null);

  function clearLocalPushState() {
    setIsRegistered(false);
    registeredForUid.current = null;
    localStorage.removeItem(REGISTERED_KEY);
    localStorage.removeItem(REGISTERED_TOKEN_KEY);
  }

  useEffect(() => {
    if (!userId || permissionStatus !== 'granted') return;
    if (registeredForUid.current === userId) return;
    registeredForUid.current = userId;
    saveTokenToFirestore(userId).catch(() => {
      registeredForUid.current = null;
      clearLocalPushState();
    });
  }, [userId, permissionStatus]);

  useEffect(() => {
    if (permissionStatus !== 'granted') return;
    let unsubscribe;
    getOrInitMessaging().then((m) => {
      if (!m) return;
      unsubscribe = onMessage(m, (payload) => {
        const { title, body } = payload.notification || {};
        if (!title) return;
        showToast({ title, message: body || '', type: payload.data?.type || 'default' });
      });
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [showToast, permissionStatus]);

  async function saveTokenToFirestore(uid) {
    if (!VAPID_KEY || !uid) return;

    if (shouldInitializeAppCheck) {
      const appCheckReady = await waitForAppCheckInitialization(6000).catch(() => false);
      if (!appCheckReady) {
        throw new Error('App Check is not ready for FCM registration.');
      }
    }

    const messagingInstance = await getOrInitMessaging();
    if (!messagingInstance) return;

    let swReg;
    if ('serviceWorker' in navigator) {
      try {
        swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      } catch {
        // If SW registration fails, let getToken() handle it.
      }
    }

    const token = await getToken(messagingInstance, {
      vapidKey: VAPID_KEY,
      ...(swReg ? { serviceWorkerRegistration: swReg } : {}),
    });
    if (!token) {
      throw new Error('FCM registration returned no token.');
    }

    const previousToken = localStorage.getItem(REGISTERED_TOKEN_KEY) || '';

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

    setIsRegistered(true);
    localStorage.setItem(REGISTERED_KEY, '1');
    localStorage.setItem(REGISTERED_TOKEN_KEY, token);

    if (userRole) {
      try {
        await httpsCallable(functions, 'subscribeToListingTopics')({ role: userRole });
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn('[usePushNotifications] Topic subscription failed:', err?.message);
        }
      }
    }
  }

  async function requestAndRegister(uid) {
    if (typeof Notification === 'undefined') return 'unsupported';
    const permission = await Notification.requestPermission();
    setPermissionStatus(permission);

    if (permission === 'granted') {
      registeredForUid.current = uid;
      try {
        await saveTokenToFirestore(uid);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('[usePushNotifications] Push registration failed:', error?.message || error);
        }
        clearLocalPushState();
        showToast({
          title: 'Push not activated',
          message: 'Try again in a moment. If this continues, refresh and retry.',
          type: 'warning',
        });
      }
    }

    return permission;
  }

  async function unregisterToken(uid) {
    if (!uid) return;
    const storedToken = localStorage.getItem(REGISTERED_TOKEN_KEY) || '';

    try {
      const messagingInstance = await getOrInitMessaging();
      if (messagingInstance) {
        let appCheckReadyForDelete = true;
        if (shouldInitializeAppCheck) {
          appCheckReadyForDelete = await waitForAppCheckInitialization(2000).catch(() => false);
        }

        // Avoid deleteToken() when App Check is unavailable to prevent logout churn.
        if (appCheckReadyForDelete) {
          await deleteToken(messagingInstance).catch(() => {});
        }
      }
    } catch {
      // Non-fatal: continue local cleanup.
    }

    if (storedToken) {
      await deleteDoc(doc(db, 'users', uid, 'fcmTokens', storedToken)).catch(() => {});
    }

    clearLocalPushState();
  }

  return { permissionStatus, isRegistered, requestAndRegister, unregisterToken };
}
