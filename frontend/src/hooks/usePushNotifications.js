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
import { messaging, db, functions } from '../firebase';
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
    if (!userId || !messaging || permissionStatus !== 'granted') return;
    if (registeredForUid.current === userId) return;
    registeredForUid.current = userId;
    saveTokenToFirestore(userId).catch(() => {
      registeredForUid.current = null;
    });
  }, [userId, permissionStatus]);

  // Foreground message handler — show in-app toast
  useEffect(() => {
    if (!messaging) return undefined;
    return onMessage(messaging, (payload) => {
      const { title, body } = payload.notification || {};
      if (!title) return;
      showToast({ title, message: body || '', type: payload.data?.type || 'default' });
    });
  }, [showToast]);

  async function saveTokenToFirestore(uid) {
    if (!messaging || !VAPID_KEY || !uid) return;
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
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
    if (!messaging || !uid) return;
    try {
      const token = await getToken(messaging, { vapidKey: VAPID_KEY }).catch(() => null);
      if (token) {
        await deleteToken(messaging);
        await deleteDoc(doc(db, 'users', uid, 'fcmTokens', token)).catch(() => {});
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
