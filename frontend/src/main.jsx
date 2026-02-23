import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { registerSW } from 'virtual:pwa-register'
import { initSentry } from './services/sentryService'

initSentry();

const CHUNK_RELOAD_WINDOW_MS = 30000;
const CHUNK_RELOAD_KEY = 'karga_chunk_reload_ts';

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

if (typeof window !== 'undefined') {
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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
