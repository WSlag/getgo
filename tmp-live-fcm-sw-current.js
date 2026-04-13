/**
 * Firebase Cloud Messaging helper for the app service worker.
 *
 * This file is imported by /sw.js so push + notification click handling live
 * in a single active service worker lifecycle.
 *
 * It remains safe if loaded directly as a worker script.
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

function normalizeNotificationUrl(rawUrl) {
  const fallback = '/app/notifications';
  if (!rawUrl) return fallback;

  try {
    const scope = self.registration?.scope || self.location?.origin || 'https://getgoph.com';
    const scopeUrl = new URL(scope);
    const parsed = new URL(String(rawUrl), scopeUrl.origin);
    parsed.hash = '';

    if (parsed.pathname === '/app') {
      parsed.pathname = '/app/home';
    }

    if (parsed.origin === scopeUrl.origin) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }

    return parsed.toString();
  } catch {
    return fallback;
  }
}

function resolveNotificationUrl(data = {}) {
  const direct = data.url || data.link || data.route || data.href;
  if (direct) {
    return normalizeNotificationUrl(direct);
  }

  const type = String(data.type || '').toUpperCase();
  if (
    type.includes('BID') ||
    type.includes('MESSAGE') ||
    type.includes('SHIPMENT') ||
    type.includes('CONTRACT') ||
    type.includes('PAYMENT') ||
    type.includes('ADMIN')
  ) {
    return '/app/notifications';
  }

  if (type === 'NEW_CARGO_LISTING' || type === 'NEW_TRUCK_LISTING') {
    return '/app/home';
  }

  return '/app/notifications';
}

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  if (!title) return;

  const data = payload.data || {};
  const targetUrl = resolveNotificationUrl(data);

  self.registration.showNotification(title, {
    body: body || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    data: {
      ...data,
      targetUrl,
    },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = resolveNotificationUrl(event.notification?.data || {});

  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });

    for (const client of allClients) {
      const clientUrl = new URL(client.url);
      const target = new URL(targetUrl, clientUrl.origin);

      if (clientUrl.origin === target.origin) {
        await client.focus();
        if (
          clientUrl.pathname + clientUrl.search + clientUrl.hash
          !== target.pathname + target.search + target.hash
        ) {
          await client.navigate(target.href);
        }
        return;
      }
    }

    await clients.openWindow(targetUrl);
  })());
});

