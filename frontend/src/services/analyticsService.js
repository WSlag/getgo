import { getAnalytics, isSupported, logEvent } from 'firebase/analytics';
import app, { analytics } from '../firebase';

const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';
let cachedAnalytics = null;
let analyticsInitPromise = null;

function sanitizeParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => {
      const type = typeof value;
      return value !== undefined && value !== null && (type === 'string' || type === 'number' || type === 'boolean');
    })
  );
}

export function trackAnalyticsEvent(eventName, params = {}) {
  if (!eventName || typeof window === 'undefined' || useEmulator) return false;

  const send = async () => {
    try {
      const supported = await isSupported();
      if (!supported) return;

      if (!cachedAnalytics) {
        cachedAnalytics = analytics || getAnalytics(app);
      }
      logEvent(cachedAnalytics, eventName, sanitizeParams(params));
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn(`[analytics] Failed to track "${eventName}":`, error?.message || error);
      }
    }
  };

  if (cachedAnalytics || analytics) {
    analyticsInitPromise = (analyticsInitPromise || Promise.resolve())
      .then(send)
      .catch(() => {});
    return true;
  }

  analyticsInitPromise = (analyticsInitPromise || Promise.resolve())
    .then(send)
    .catch(() => {});
  return true;
}
