import { ExternalLink, MoreVertical, Copy } from 'lucide-react';
import { AppLogo } from './AppLogo';

const BROWSER_INSTRUCTIONS = {
  facebook: {
    android: 'Tap the three-dot menu at the top right, then tap "Open in browser".',
    ios: 'Tap the menu at the bottom, then tap "Open in Safari".',
  },
  instagram: {
    android: 'Tap the three-dot menu at the top right, then tap "Open in browser".',
    ios: 'Tap the three-dot menu at the top right, then tap "Open in browser".',
  },
  telegram: {
    android: 'Tap the three-dot menu at the top right, then tap "Open in external browser".',
    ios: 'Tap the share or menu button, then choose "Open in Safari".',
  },
  gmail: {
    android: 'Tap the three-dot menu at the top right, then tap "Open in browser".',
    ios: 'Tap the Safari icon or "Open in Safari" at the bottom.',
  },
  outlook: {
    android: 'Tap the three-dot menu, then choose "Open in browser".',
    ios: 'Tap the share or menu button, then choose "Open in Safari".',
  },
  yahoo_mail: {
    android: 'Tap the menu icon, then choose "Open in browser".',
    ios: 'Tap the share or menu button, then choose "Open in Safari".',
  },
  default: {
    android: 'Tap the menu icon, then tap "Open in browser".',
    ios: 'Tap the menu icon, then tap "Open in Safari".',
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
    telegram: 'Telegram',
    gmail: 'Gmail',
    outlook: 'Outlook',
    yahoo_mail: 'Yahoo Mail',
    line: 'LINE',
    wechat: 'WeChat',
    tiktok: 'TikTok',
    twitter: 'X (Twitter)',
    android_webview: 'an in-app browser',
  };
  return labels[browserName] || 'this app';
}

export function InAppBrowserOverlay({ platform, browserName, onOpenBrowser }) {
  const instructions = getInstructions(browserName, platform);
  const label = getBrowserLabel(browserName);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      // Clipboard API may not be available in some WebViews.
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-white px-6 dark:bg-gray-950"
      style={{ paddingTop: 'env(safe-area-inset-top, 20px)' }}
    >
      <div className="mb-6">
        <AppLogo size={80} className="drop-shadow-lg" />
      </div>

      <h1 className="mb-2 text-center text-2xl font-bold text-gray-900 dark:text-white">
        {platform === 'android' ? 'Open in Google' : 'Open in Safari'}
      </h1>
      <p className="mb-8 max-w-sm text-center text-sm text-gray-500 dark:text-gray-400">
        You are viewing this in {label}&apos;s built-in browser.
        For the best experience, open GetGo in your phone browser.
      </p>

      {platform === 'android' && (
        <button
          onClick={onOpenBrowser}
          className="mb-4 flex w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-400 to-orange-600 px-6 py-3.5 font-semibold text-white shadow-md transition-transform active:scale-[0.98]"
        >
          <ExternalLink className="size-5" />
          Open in Google
        </button>
      )}

      <div className="mb-6 w-full max-w-xs rounded-xl bg-gray-50 p-4 dark:bg-gray-900">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          {platform === 'android' ? 'If the button does not work:' : 'How to open in Safari:'}
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

      {platform === 'ios' && (
        <button
          onClick={handleCopyUrl}
          className="mb-4 flex w-full max-w-xs items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <Copy className="size-4" />
          Copy link to open in Safari
        </button>
      )}
    </div>
  );
}

export default InAppBrowserOverlay;
