/**
 * usePushNotifications
 * Manages FCM push notification token registration, topic subscription, and
 * foreground message handling.
 *
 * Returns:
 *   permissionStatus  — 'default' | 'granted' | 'denied' | 'unsupported'
 *   isRegistered      — true once a token is saved to Firestore
 *   requestAndRegister(uid) — requests OS permission, saves token, subscribes to topics
 *   unregisterToken(uid)    — deletes token locally and from Firestore (call on logout)
 */

import { useState, useEffect, useRef } from 'react';
import { getToken, onMessage, deleteToken } from 'firebase/messaging';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getOrInitMessaging, db, functions, waitForAppCheckInitialization, shouldInitializeAppCheck } from '../firebase';
import { useToast } from '../contexts/ToastContext';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;
const REGISTERED_KEY = 'karga.push.registered';

function getInitialPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

export function usePushNotifications(userId, userRole) {
  // useToast() returns showToast directly — do NOT destructure
  const showToast = useToast();
  const [permissionStatus, setPermissionStatus] = useState(getInitialPermission);
  const [isRegistered, setIsRegistered] = useState(
    () => localStorage.getItem(REGISTERED_KEY) === '1'
  );
  const registeredForUid = useRef(null);

  // Auto-register when userId is available and permission is already granted
  useEffect(() => {
    if (!userId || permissionStatus !== 'granted') return;
    if (registeredForUid.current === userId) return;
    registeredForUid.current = userId;
    saveTokenToFirestore(userId).catch(() => {
      registeredForUid.current = null;
    });
  }, [userId, permissionStatus]);

  // Foreground message handler — show in-app toast.
  // Only initialize messaging when permission is already granted; this prevents the Firebase
  // Functions client SDK from discovering the messaging instance (via getImmediate) and issuing
  // spurious FCM registration requests on every callable function invocation.
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
    return () => { if (unsubscribe) unsubscribe(); };
  }, [showToast, permissionStatus]);

  async function saveTokenToFirestore(uid) {
    if (!VAPID_KEY || !uid) return;

    // FCM registration requires an App Check token when enforcement is active.
    // Wait up to 6s for App Check to initialize before calling getToken().
    if (shouldInitializeAppCheck) {
      await waitForAppCheckInitialization(6000).catch(() => {});
    }

    // Lazily initialize messaging only when we actually need it for push registration.
    const messagingInstance = await getOrInitMessaging();
    if (!messagingInstance) return;

    // Pass the SW registration explicitly so FCM uses our /firebase-messaging-sw.js
    // and doesn't fall back to registering a generic SW on a different scope.
    let swReg;
    if ('serviceWorker' in navigator) {
      try {
        swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      } catch {
        // If SW registration fails, let getToken() handle it
      }
    }

    const token = await getToken(messagingInstance, {
      vapidKey: VAPID_KEY,
      ...(swReg ? { serviceWorkerRegistration: swReg } : {}),
    });
    if (!token) return;

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

    setIsRegistered(true);
    localStorage.setItem(REGISTERED_KEY, '1');

    // Subscribe to listing topic for this role (broker role → no-op on backend)
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
      await saveTokenToFirestore(uid);
    }
    return permission;
  }

  async function unregisterToken(uid) {
    if (!uid) return;
    try {
      const messagingInstance = await getOrInitMessaging();
      if (messagingInstance) {
        const token = await getToken(messagingInstance, { vapidKey: VAPID_KEY }).catch(() => null);
        if (token) {
          await deleteToken(messagingInstance);
          await deleteDoc(doc(db, 'users', uid, 'fcmTokens', token)).catch(() => {});
        }
      }
    } catch {
      // Non-fatal — proceed with local cleanup regardless
    }
    setIsRegistered(false);
    registeredForUid.current = null;
    localStorage.removeItem(REGISTERED_KEY);
  }

  return { permissionStatus, isRegistered, requestAndRegister, unregisterToken };
}
