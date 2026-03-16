import { useState, useEffect, useRef, useCallback } from 'react';
import {
  detectInAppBrowser,
  detectPlatform,
  isStandaloneMode,
  isIOSSafari,
} from '../utils/browserDetect';
import { trackAnalyticsEvent } from '../services/analyticsService';

const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const KEYS = {
  installDismissedAt: 'karga.pwa.installDismissedAt',
  installAccepted: 'karga.pwa.installAccepted',
  iosDismissedAt: 'karga.pwa.iosDismissedAt',
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
  const [engagementReached, setEngagementReached] = useState(
    () => localStorage.getItem(KEYS.engagementReached) === 'true'
  );
  const [canPrompt, setCanPrompt] = useState(false);
  // Delay showing install banner so it doesn't clash with onboarding modal
  const [bannerReady, setBannerReady] = useState(false);
  const [installAccepted, setInstallAccepted] = useState(
    () => localStorage.getItem(KEYS.installAccepted) === 'true'
  );
  const [installDismissedRecently, setInstallDismissedRecently] = useState(
    () => isWithinCooldown(KEYS.installDismissedAt)
  );
  const [iosDismissedRecently, setIosDismissedRecently] = useState(
    () => isWithinCooldown(KEYS.iosDismissedAt)
  );
  const [manualIOSInstallOpen, setManualIOSInstallOpen] = useState(false);

  const deferredPrompt = useRef(null);

  // --- Delay banner by 4s to avoid clashing with onboarding modal ---
  useEffect(() => {
    const t = setTimeout(() => setBannerReady(true), 4000);
    return () => clearTimeout(t);
  }, []);

  // --- Visit count & auto-engagement ---
  useEffect(() => {
    const count = parseInt(localStorage.getItem(KEYS.visitCount) || '0', 10) + 1;
    localStorage.setItem(KEYS.visitCount, String(count));
    if (count >= 1 && !engagementReached) {
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

  const dismissInstallBanner = useCallback(() => {
    localStorage.setItem(KEYS.installDismissedAt, new Date().toISOString());
    setInstallDismissedRecently(true);
  }, []);

  const dismissIOSInstall = useCallback(() => {
    setManualIOSInstallOpen(false);
    localStorage.setItem(KEYS.iosDismissedAt, new Date().toISOString());
    setIosDismissedRecently(true);
  }, []);

  const promptInstall = useCallback(async (source = 'unknown') => {
    const prompt = deferredPrompt.current;
    if (!prompt) return false;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') {
      localStorage.setItem(KEYS.installAccepted, 'true');
      setInstallAccepted(true);
      trackAnalyticsEvent('install_success', { source, platform });
    } else {
      dismissInstallBanner();
    }
    deferredPrompt.current = null;
    setCanPrompt(false);
    return true;
  }, [dismissInstallBanner, platform]);

  const triggerInstall = useCallback(async () => {
    await promptInstall('install_banner');
  }, [promptInstall]);

  const waitForInstallPrompt = useCallback((timeoutMs) => {
    return new Promise((resolve) => {
      if (deferredPrompt.current) {
        resolve(true);
        return;
      }
      let settled = false;
      const onPrompt = (e) => {
        if (settled) return;
        settled = true;
        e.preventDefault();
        deferredPrompt.current = e;
        setCanPrompt(true);
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', onPrompt);
        resolve(true);
      };
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        window.removeEventListener('beforeinstallprompt', onPrompt);
        resolve(false);
      }, timeoutMs);
      window.addEventListener('beforeinstallprompt', onPrompt);
    });
  }, []);

  const launchInstallFromProfile = useCallback(async () => {
    if (standalone || installAccepted) return 'already_installed';
    if (inApp.isInAppBrowser) return 'in_app_browser';

    if (iosSafari) {
      setManualIOSInstallOpen(true);
      return 'ios_sheet_opened';
    }

    const didPrompt = await promptInstall('profile_button');
    if (didPrompt) return 'prompt_shown';

    // SW may still be registering — wait for beforeinstallprompt
    const arrived = await waitForInstallPrompt(5000);
    if (arrived) {
      const retry = await promptInstall('profile_button');
      if (retry) return 'prompt_shown';
    }

    return 'not_available';
  }, [standalone, installAccepted, inApp.isInAppBrowser, iosSafari, promptInstall, waitForInstallPrompt]);

  // --- Computed booleans ---
  const showInAppOverlay = inApp.isInAppBrowser;

  const showInstallBanner =
    !showInAppOverlay &&
    bannerReady &&
    canPrompt &&
    !standalone &&
    engagementReached &&
    !installAccepted &&
    !installDismissedRecently;

  const showIOSInstall =
    !showInAppOverlay &&
    (
      manualIOSInstallOpen ||
      (
        bannerReady &&
        iosSafari &&
        !standalone &&
        engagementReached &&
        !installAccepted &&
        !iosDismissedRecently
      )
    );
  const isInstallAlreadySatisfied = standalone || installAccepted;

  return {
    // In-app browser
    isInAppBrowser: inApp.isInAppBrowser,
    inAppBrowserName: inApp.browserName,
    platform,
    showInAppOverlay,

    // Android/Desktop install
    showInstallBanner,
    triggerInstall,
    dismissInstallBanner,

    // iOS Safari
    showIOSInstall,
    dismissIOSInstall,
    launchInstallFromProfile,

    // General
    isStandalone: standalone,
    isInstallAlreadySatisfied,
    isInstallEngagementReached: engagementReached,
    markEngagement,
  };
}
