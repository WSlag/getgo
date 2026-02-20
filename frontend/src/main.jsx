import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { registerSW } from 'virtual:pwa-register'
import { initSentry } from './services/sentryService'

initSentry();

const updateSW = registerSW({
  onNeedRefresh() {
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
