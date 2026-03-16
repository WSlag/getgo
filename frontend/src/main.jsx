import React from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'
/* global __APP_BUILD_ID__ */

const APP_BUILD_ID = typeof __APP_BUILD_ID__ === 'string' ? __APP_BUILD_ID__ : 'dev';
const CHUNK_RELOAD_WINDOW_MS = 30000;
const CHUNK_RELOAD_KEY = 'karga_chunk_reload_ts';
const BUILD_ID_STORAGE_KEY = 'getgo_build_id';
const BUILD_REFRESH_GUARD_KEY = 'getgo_build_refresh_guard';
const STARTUP_DEFER_MS = 3000;
const SENTRY_INIT_KEY = 'getgo_sentry_initialized';

function isLeafletTarget(target) {
  return target instanceof Element && Boolean(target.closest('.leaflet-container'));
}

function installMobileZoomGuard() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const isNarrowViewport = window.matchMedia('(max-width: 1023px)').matches;
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
  if (!isNarrowViewport && !isCoarsePointer) return;

  const handleZoomGesture = (event) => {
    if (!event.cancelable) return;
    if (isLeafletTarget(event.target)) return;

    if (event.type === 'gesturestart' || event.type === 'gesturechange') {
      event.preventDefault();
      return;
    }

    if (event.type === 'touchmove' && event.touches?.length > 1) {
      event.preventDefault();
    }
  };

  // iOS/WebView fallback when viewport locking is not consistently enforced.
  document.addEventListener('gesturestart', handleZoomGesture, { capture: true, passive: false });
  document.addEventListener('gesturechange', handleZoomGesture, { capture: true, passive: false });
  document.addEventListener('touchmove', handleZoomGesture, { capture: true, passive: false });
}

function isDynamicImportFailure(reason) {
  const message = String(reason?.message || reason || '');
  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed') ||
    message.includes('error loading dynamically imported module')
  );
}

function recoverFromChunkLoadFailure(reason) {
  if (typeof window === 'undefined') return;

  const lastReloadAt = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
  if (Date.now() - lastReloadAt < CHUNK_RELOAD_WINDOW_MS) {
    return;
  }

  console.warn('[app] Recovering from stale chunk load failure:', reason);
  window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  window.location.reload();
}

function syncBuildVersionAndRefreshCaches() {
  if (typeof window === 'undefined') return;

  const previousBuildId = window.localStorage.getItem(BUILD_ID_STORAGE_KEY);
  if (!previousBuildId) {
    window.localStorage.setItem(BUILD_ID_STORAGE_KEY, APP_BUILD_ID);
    return;
  }

  if (previousBuildId === APP_BUILD_ID) {
    window.sessionStorage.removeItem(BUILD_REFRESH_GUARD_KEY);
    return;
  }

  window.localStorage.setItem(BUILD_ID_STORAGE_KEY, APP_BUILD_ID);

  // Prevent reload loops if cache clearing fails for any reason.
  if (window.sessionStorage.getItem(BUILD_REFRESH_GUARD_KEY) === APP_BUILD_ID) {
    return;
  }
  window.sessionStorage.setItem(BUILD_REFRESH_GUARD_KEY, APP_BUILD_ID);

  // In-app browsers can briefly report offline during navigation.
  // Avoid aggressive cache clears; do a single soft refresh when online.
  if (!navigator.onLine) {
    window.addEventListener('online', () => window.location.reload(), { once: true });
    return;
  }

  const refreshedUrl = new URL(window.location.href);
  refreshedUrl.searchParams.set('build', APP_BUILD_ID.slice(0, 19));
  window.location.replace(refreshedUrl.toString());
}

if (typeof window !== 'undefined') {
  syncBuildVersionAndRefreshCaches();
  installMobileZoomGuard();

  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    recoverFromChunkLoadFailure(event?.payload || event?.error || 'vite:preloadError');
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (!isDynamicImportFailure(event?.reason)) return;
    event.preventDefault();
    recoverFromChunkLoadFailure(event.reason);
  });
}

function scheduleIdleTask(task) {
  if (typeof window === 'undefined') return;
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(task, { timeout: STARTUP_DEFER_MS });
    return;
  }
  window.setTimeout(task, STARTUP_DEFER_MS);
}

function bootstrapSentryWhenIdle() {
  if (typeof window === 'undefined') return;
  if (window.sessionStorage.getItem(SENTRY_INIT_KEY) === '1') return;

  scheduleIdleTask(async () => {
    try {
      const sentryModule = await import('./services/sentryService');
      sentryModule.initSentry();
      window.sessionStorage.setItem(SENTRY_INIT_KEY, '1');
    } catch (error) {
      console.error('[app] Deferred Sentry initialization failed:', error);
    }
  });
}

function registerServiceWorkerWhenIdle() {
  if (typeof window === 'undefined') return;

  const doRegister = () => {
    scheduleIdleTask(async () => {
      try {
        const { registerSW } = await import('virtual:pwa-register');
        const updateSW = registerSW({
          immediate: true,
          onNeedRefresh() {
            updateSW(true);
            window.dispatchEvent(new CustomEvent('sw-update-available', {
              detail: { updateSW }
            }));
          },
          onOfflineReady() {},
          onRegistered() {},
          onRegisterError(error) {
            console.error('Service worker registration failed:', error);
          }
        });
      } catch (error) {
        console.error('[app] Deferred service worker registration failed:', error);
      }
    });
  };

  if (document.readyState === 'complete') {
    doRegister();
  } else {
    window.addEventListener('load', doRegister, { once: true });
  }
}

const rootElement = document.getElementById('root');
const prerenderFallback = document.getElementById('prerender-public-content');
if (prerenderFallback) {
  prerenderFallback.remove();
}
const appTree = (
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if (rootElement?.hasChildNodes()) {
  hydrateRoot(rootElement, appTree);
} else if (rootElement) {
  createRoot(rootElement).render(appTree);
}

bootstrapSentryWhenIdle();
registerServiceWorkerWhenIdle();
