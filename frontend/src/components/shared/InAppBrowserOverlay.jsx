import { ExternalLink, MoreVertical, Copy } from 'lucide-react';
import { AppLogo } from './AppLogo';

const BROWSER_INSTRUCTIONS = {
  facebook: {
    android: 'Tap the ⋮ menu at the top right, then tap "Open in Chrome"',
    ios: 'Tap the ⋯ menu at the bottom, then tap "Open in Safari"',
  },
  instagram: {
    android: 'Tap the ⋮ menu at the top right, then tap "Open in browser"',
    ios: 'Tap the ⋯ menu at the top right, then tap "Open in browser"',
  },
  gmail: {
    android: 'Tap the ⋮ menu at the top right, then tap "Open in Chrome"',
    ios: 'Tap the Safari icon or "Open in Safari" at the bottom',
  },
  default: {
    android: 'Tap the menu icon, then tap "Open in browser"',
    ios: 'Tap the menu icon, then tap "Open in Safari"',
  },
};

function getInstructions(browserName, platform) {
  const browser = BROWSER_INSTRUCTIONS[browserName] || BROWSER_INSTRUCTIONS.default;
  return browser[platform] || browser.android;
}

function getBrowserLabel(browserName) {
  const labels = {
    facebook: 'Facebook',
    instagram: 'Instagram',
    gmail: 'Gmail',
    line: 'LINE',
    wechat: 'WeChat',
    tiktok: 'TikTok',
    twitter: 'X (Twitter)',
  };
  return labels[browserName] || 'this app';
}

export function InAppBrowserOverlay({ platform, browserName, onOpenBrowser, onDismiss }) {
  const instructions = getInstructions(browserName, platform);
  const label = getBrowserLabel(browserName);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      // Clipboard API may not be available in WebViews
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white px-6 dark:bg-gray-950"
      style={{ paddingTop: 'env(safe-area-inset-top, 20px)' }}
    >
      {/* Logo */}
      <div className="mb-6">
        <AppLogo size={80} className="drop-shadow-lg" />
      </div>

      <h1 className="mb-2 text-center text-2xl font-bold text-gray-900 dark:text-white">
        Open in your browser
      </h1>
      <p className="mb-8 max-w-sm text-center text-sm text-gray-500 dark:text-gray-400">
        You're viewing this in {label}'s built-in browser.
        For the best experience, open GetGo in your device's browser.
      </p>

      {/* Android: direct open button */}
      {platform === 'android' && (
        <button
          onClick={onOpenBrowser}
          className="mb-4 flex w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-400 to-orange-600 px-6 py-3.5 font-semibold text-white shadow-md transition-transform active:scale-[0.98]"
        >
          <ExternalLink className="size-5" />
          Open in Chrome
        </button>
      )}

      {/* Manual instructions */}
      <div className="mb-6 w-full max-w-xs rounded-xl bg-gray-50 p-4 dark:bg-gray-900">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          {platform === 'android' ? 'Or manually:' : 'How to open in Safari:'}
        </p>
        <div className="flex items-start gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
            <MoreVertical className="size-4 text-orange-600 dark:text-orange-400" />
          </div>
          <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            {instructions}
          </p>
        </div>
      </div>

      {/* iOS: copy URL fallback */}
      {platform === 'ios' && (
        <button
          onClick={handleCopyUrl}
          className="mb-4 flex w-full max-w-xs items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <Copy className="size-4" />
          Copy link to open in Safari
        </button>
      )}

      {/* Continue anyway */}
      <button
        onClick={onDismiss}
        className="mt-2 bg-transparent border-none text-sm text-gray-400 underline decoration-gray-300 underline-offset-2 transition-colors hover:text-gray-600 dark:text-gray-500 dark:decoration-gray-600 dark:hover:text-gray-300"
      >
        Continue anyway
      </button>
    </div>
  );
}

export default InAppBrowserOverlay;
