/**
 * Browser and platform detection utilities for PWA install flow.
 * Detects in-app browsers (Facebook, Instagram, etc.), platform (iOS/Android/desktop),
 * and provides helpers for escaping in-app browsers.
 */

const IN_APP_BROWSERS = [
  { tokens: ['FBAN', 'FBAV'], name: 'facebook' },
  { tokens: ['Instagram'], name: 'instagram' },
  { tokens: ['GSA/'], name: 'gmail' },
  { tokens: ['Line/'], name: 'line' },
  { tokens: ['MicroMessenger'], name: 'wechat' },
  { tokens: ['BytedanceWebview', 'TikTok'], name: 'tiktok' },
  { tokens: ['Twitter'], name: 'twitter' },
];

export function detectInAppBrowser() {
  const ua = navigator.userAgent || '';
  for (const { tokens, name } of IN_APP_BROWSERS) {
    if (tokens.some((t) => ua.includes(t))) {
      return { isInAppBrowser: true, browserName: name };
    }
  }
  return { isInAppBrowser: false, browserName: null };
}

export function detectPlatform() {
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  // iPadOS reports as Mac but has touch
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

export function isStandaloneMode() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    navigator.standalone === true
  );
}

export function isIOSSafari() {
  if (detectPlatform() !== 'ios') return false;
  if (isStandaloneMode()) return false;
  if (detectInAppBrowser().isInAppBrowser) return false;
  const ua = navigator.userAgent || '';
  // Must be Safari — not Chrome iOS (CriOS) or Firefox iOS (FxiOS)
  if (/CriOS|FxiOS|OPiOS|EdgiOS/i.test(ua)) return false;
  return /Safari/i.test(ua);
}

export function buildAndroidIntentUrl(currentUrl) {
  try {
    const url = new URL(currentUrl);
    return `intent://${url.host}${url.pathname}${url.search}${url.hash}#Intent;scheme=https;end`;
  } catch {
    return null;
  }
}
