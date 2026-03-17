import { useState, useEffect, useRef, useCallback } from 'react';
import {
  detectInAppBrowser,
  detectPlatform,
  isStandaloneMode,
  isIOSSafari,
} from '../utils/browserDetect';
import { trackAnalyticsEvent } from '../services/analyticsService';

const IOS_COOLDOWN_MS    = 7 * 24 * 60 * 60 * 1000; // 7 days
const MODAL_COOLDOWN_MS  = 1 * 60 * 60 * 1000;      // 1 hour

// Progressive cooldown: escalates with each banner dismiss
const BANNER_COOLDOWN_TIERS = [
  1 * 24 * 60 * 60 * 1000,  // 1 day after 1st dismiss
  3 * 24 * 60 * 60 * 1000,  // 3 days after 2nd dismiss
  7 * 24 * 60 * 60 * 1000,  // 7 days after 3rd dismiss
];
const MAX_AUTO_DISMISSES = 4; // stop auto-prompting after 4th dismiss

const KEYS = {
  installDismissedAt: 'karga.pwa.installDismissedAt',
  installAccepted: 'karga.pwa.installAccepted',
  iosDismissedAt: 'karga.pwa.iosDismissedAt',
  visitCount: 'karga.pwa.visitCount',
  engagementReached: 'karga.pwa.engagementReached',
  installModalDismissedAt: 'karga.pwa.installModalDismissedAt',
  installModalPending: 'karga.pwa.installModalPending',
  dismissCount: 'karga.pwa.dismissCount',
};

function isWithinCooldown(key, durationMs) {
  const val = localStorage.getItem(key);
  if (!val) return false;
  return Date.now() - Date.parse(val) < durationMs;
}

function getBannerCooldownMs() {
  const count = parseInt(localStorage.getItem(KEYS.dismissCount) || '0', 10);
  if (count >= MAX_AUTO_DISMISSES) return Infinity;  // 4+ → never
  if (count === 0) return BANNER_COOLDOWN_TIERS[0];  // no dismiss yet
  return BANNER_COOLDOWN_TIERS[Math.min(count - 1, BANNER_COOLDOWN_TIERS.length - 1)];
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
    () => isWithinCooldown(KEYS.installDismissedAt, getBannerCooldownMs())
  );
  const [iosDismissedRecently, setIosDismissedRecently] = useState(
    () => isWithinCooldown(KEYS.iosDismissedAt, IOS_COOLDOWN_MS)
  );
  const [manualIOSInstallOpen, setManualIOSInstallOpen] = useState(false);
  const [installModalDismissedRecently, setInstallModalDismissedRecently] = useState(
    () => {
      const val = localStorage.getItem(KEYS.installModalDismissedAt);
      if (!val) return false;
      return Date.now() - Date.parse(val) < MODAL_COOLDOWN_MS;
    }
  );
  const [showInstallModal, setShowInstallModal] = useState(
    () => {
      const pending = localStorage.getItem(KEYS.installModalPending) === 'true';
      const accepted = localStorage.getItem(KEYS.installAccepted) === 'true';
      const dismissed = (() => {
        const val = localStorage.getItem(KEYS.installModalDismissedAt);
        if (!val) return false;
        return Date.now() - Date.parse(val) < MODAL_COOLDOWN_MS;
      })();
      return pending && !accepted && !dismissed;
    }
  );

  const deferredPrompt = useRef(null);

  // --- Delay banner by 4s to avoid clashing with onboarding modal ---
  useEffect(() => {
    const t = setTimeout(() => setBannerReady(true), 4000);
    return () => clearTimeout(t);
  }, []);

  // --- Capture beforeinstallprompt ---
  useEffect(() => {
    if (standalone) return;
    const handler = (e) => {
      e.preventDefault();
      deferredPrompt.current = e;
      setCanPrompt(true);
      // Browser fires this only when app is NOT installed.
      // Clear stale installAccepted flag from a previous install (user uninstalled).
      if (localStorage.getItem(KEYS.installAccepted) === 'true') {
        localStorage.removeItem(KEYS.installAccepted);
        setInstallAccepted(false);
      }
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
    const currentCount = parseInt(localStorage.getItem(KEYS.dismissCount) || '0', 10);
    localStorage.setItem(KEYS.dismissCount, String(currentCount + 1));
    localStorage.setItem(KEYS.installDismissedAt, new Date().toISOString());
    setInstallDismissedRecently(true);
    trackAnalyticsEvent('install_dismissed', {
      source: 'install_banner',
      platform,
      dismiss_count: currentCount + 1,
    });
  }, [platform]);

  const dismissIOSInstall = useCallback(() => {
    setManualIOSInstallOpen(false);
    localStorage.setItem(KEYS.iosDismissedAt, new Date().toISOString());
    setIosDismissedRecently(true);
    trackAnalyticsEvent('install_dismissed', { source: 'ios_sheet', platform });
  }, [platform]);

  const openInstallModal = useCallback(() => {
    if (standalone || installAccepted || installModalDismissedRecently || !engagementReached) return;
    localStorage.setItem(KEYS.installModalPending, 'true');
    setShowInstallModal(true);
  }, [standalone, installAccepted, installModalDismissedRecently, engagementReached]);

  const dismissInstallModal = useCallback(() => {
    localStorage.removeItem(KEYS.installModalPending);
    localStorage.setItem(KEYS.installModalDismissedAt, new Date().toISOString());
    setShowInstallModal(false);
    setInstallModalDismissedRecently(true);
    trackAnalyticsEvent('install_dismissed', { source: 'install_modal', platform });
  }, [platform]);

  const promptInstall = useCallback(async (source = 'unknown') => {
    const prompt = deferredPrompt.current;
    if (!prompt) return false;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') {
      localStorage.setItem(KEYS.installAccepted, 'true');
      setInstallAccepted(true);
      localStorage.removeItem(KEYS.installModalPending);
      setShowInstallModal(false);
      trackAnalyticsEvent('install_success', { source, platform });
    } else {
      // Dismiss the originating surface only
      if (source === 'install_banner') {
        dismissInstallBanner();
      } else {
        dismissInstallModal();
      }
    }
    deferredPrompt.current = null;
    setCanPrompt(false);
    return true;
  }, [dismissInstallBanner, dismissInstallModal, platform]);

  const triggerInstall = useCallback(async () => {
    trackAnalyticsEvent('install_clicked', { source: 'install_banner', platform });
    await promptInstall('install_banner');
  }, [promptInstall, platform]);

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
    const arrived = await waitForInstallPrompt(15000);
    if (arrived) {
      const retry = await promptInstall('profile_button');
      if (retry) return 'prompt_shown';
    }

    return 'not_available';
  }, [standalone, installAccepted, inApp.isInAppBrowser, iosSafari, promptInstall, waitForInstallPrompt]);

  const resetInstallCooldownOnMilestone = useCallback(() => {
    if (standalone || installAccepted) return;
    const count = parseInt(localStorage.getItem(KEYS.dismissCount) || '0', 10);
    if (count >= MAX_AUTO_DISMISSES) return; // respect user who dismissed 4+ times
    const dismissedAt = localStorage.getItem(KEYS.installDismissedAt);
    if (!dismissedAt) return; // nothing to reset
    localStorage.removeItem(KEYS.installDismissedAt);
    setInstallDismissedRecently(false);
    trackAnalyticsEvent('install_cooldown_reset', { platform });
  }, [standalone, installAccepted, platform]);

  // --- Computed booleans ---
  const showInAppOverlay = inApp.isInAppBrowser;
  const maxDismissesReached = parseInt(localStorage.getItem(KEYS.dismissCount) || '0', 10) >= MAX_AUTO_DISMISSES;

  const showInstallBanner =
    !showInAppOverlay &&
    bannerReady &&
    canPrompt &&
    !standalone &&
    engagementReached &&
    !installAccepted &&
    !installDismissedRecently &&
    !maxDismissesReached;

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

    // Persistent install modal
    showInstallModal,
    openInstallModal,
    dismissInstallModal,

    // General
    isStandalone: standalone,
    isInstallAlreadySatisfied,
    isInstallEngagementReached: engagementReached,
    markEngagement,
    resetInstallCooldownOnMilestone,
  };
}
