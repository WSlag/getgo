import { useState, useEffect, useRef, useCallback } from 'react';
import {
  detectInAppBrowser,
  detectPlatform,
  isStandaloneMode,
  isIOSSafari,
} from '../utils/browserDetect';

const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const KEYS = {
  installDismissedAt: 'karga.pwa.installDismissedAt',
  installAccepted: 'karga.pwa.installAccepted',
  iosDismissedAt: 'karga.pwa.iosDismissedAt',
  inAppDismissed: 'karga.pwa.inAppDismissed',
  visitCount: 'karga.pwa.visitCount',
  engagementReached: 'karga.pwa.engagementReached',
};

function isWithinCooldown(key) {
  const val = localStorage.getItem(key);
  if (!val) return false;
  return Date.now() - Date.parse(val) < COOLDOWN_MS;
}

export function usePWAInstall() {
  // --- Static detection (runs once) ---
  const [inApp] = useState(() => detectInAppBrowser());
  const [platform] = useState(() => detectPlatform());
  const [standalone] = useState(() => isStandaloneMode());
  const [iosSafari] = useState(() => isIOSSafari());

  // --- State ---
  const [inAppDismissed, setInAppDismissed] = useState(
    () => localStorage.getItem(KEYS.inAppDismissed) === 'true'
  );
  const [engagementReached, setEngagementReached] = useState(
    () => localStorage.getItem(KEYS.engagementReached) === 'true'
  );
  const [canPrompt, setCanPrompt] = useState(false);
  const [installAccepted, setInstallAccepted] = useState(
    () => localStorage.getItem(KEYS.installAccepted) === 'true'
  );
  const [installDismissedRecently, setInstallDismissedRecently] = useState(
    () => isWithinCooldown(KEYS.installDismissedAt)
  );
  const [iosDismissedRecently, setIosDismissedRecently] = useState(
    () => isWithinCooldown(KEYS.iosDismissedAt)
  );

  const deferredPrompt = useRef(null);

  // --- Visit count & auto-engagement ---
  useEffect(() => {
    const count = parseInt(localStorage.getItem(KEYS.visitCount) || '0', 10) + 1;
    localStorage.setItem(KEYS.visitCount, String(count));
    if (count >= 2 && !engagementReached) {
      localStorage.setItem(KEYS.engagementReached, 'true');
      setEngagementReached(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Capture beforeinstallprompt ---
  useEffect(() => {
    if (standalone) return;
    const handler = (e) => {
      e.preventDefault();
      deferredPrompt.current = e;
      setCanPrompt(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [standalone]);

  // --- Actions ---
  const markEngagement = useCallback(() => {
    if (!engagementReached) {
      localStorage.setItem(KEYS.engagementReached, 'true');
      setEngagementReached(true);
    }
  }, [engagementReached]);

  const dismissInAppOverlay = useCallback(() => {
    localStorage.setItem(KEYS.inAppDismissed, 'true');
    setInAppDismissed(true);
  }, []);

  const dismissInstallBanner = useCallback(() => {
    localStorage.setItem(KEYS.installDismissedAt, new Date().toISOString());
    setInstallDismissedRecently(true);
  }, []);

  const dismissIOSInstall = useCallback(() => {
    localStorage.setItem(KEYS.iosDismissedAt, new Date().toISOString());
    setIosDismissedRecently(true);
  }, []);

  const triggerInstall = useCallback(async () => {
    const prompt = deferredPrompt.current;
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') {
      localStorage.setItem(KEYS.installAccepted, 'true');
      setInstallAccepted(true);
    } else {
      dismissInstallBanner();
    }
    deferredPrompt.current = null;
    setCanPrompt(false);
  }, [dismissInstallBanner]);

  // --- Computed booleans ---
  const showInAppOverlay = inApp.isInAppBrowser && !inAppDismissed;

  const showInstallBanner =
    canPrompt &&
    !standalone &&
    engagementReached &&
    !installAccepted &&
    !installDismissedRecently;

  const showIOSInstall =
    iosSafari &&
    !standalone &&
    engagementReached &&
    !installAccepted &&
    !iosDismissedRecently;

  return {
    // In-app browser
    isInAppBrowser: inApp.isInAppBrowser,
    inAppBrowserName: inApp.browserName,
    platform,
    showInAppOverlay,
    dismissInAppOverlay,

    // Android/Desktop install
    showInstallBanner,
    triggerInstall,
    dismissInstallBanner,

    // iOS Safari
    showIOSInstall,
    dismissIOSInstall,

    // General
    isStandalone: standalone,
    markEngagement,
  };
}
