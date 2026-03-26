/**
 * Firebase Cloud Messaging Service Worker
 * Handles push notifications when the app is in the background or closed.
 *
 * Uses Firebase compat CDN v10.12.0 via importScripts because service workers
 * cannot use ES module syntax (import/export). This SW runs in its own context
 * completely separate from the frontend app — version mismatch with frontend v12 is safe.
 *
 * Firebase config values are intentionally hardcoded here (standard Firebase pattern).
 * These are public keys already embedded in the frontend bundle.
 */

/* global firebase */

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyB9c2Ftm9WVdBHyaA8uqHWJy_lZFMFPAB4',
  authDomain: 'karga-ph.firebaseapp.com',
  projectId: 'karga-ph',
  storageBucket: 'karga-ph.firebasestorage.app',
  messagingSenderId: '580800488549',
  appId: '1:580800488549:web:3b5051b8c1ec0c8ba9128c',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  if (!title) return;

  self.registration.showNotification(title, {
    body: body || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    data: payload.data || {},
  });
});
