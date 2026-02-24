import { useState } from 'react';
import { ExternalLink, MoreVertical, Copy, ShieldCheck } from 'lucide-react';
import { AppLogo } from './AppLogo';

const BROWSER_INSTRUCTIONS = {
  facebook: {
    android: [
      'Tap the three-dot menu in the top-right corner.',
      'Choose "Open in browser".',
    ],
    ios: [
      'Tap the menu button at the bottom of Facebook.',
      'Select "Open in Safari".',
    ],
  },
  instagram: {
    android: [
      'Tap the three-dot menu in the top-right corner.',
      'Choose "Open in browser".',
    ],
    ios: [
      'Tap the three-dot menu in the top-right corner.',
      'Choose "Open in browser".',
    ],
  },
  telegram: {
    android: [
      'Tap the three-dot menu in the top-right corner.',
      'Choose "Open in external browser".',
    ],
    ios: [
      'Tap the share or menu button in Telegram.',
      'Choose "Open in Safari".',
    ],
  },
  gmail: {
    android: [
      'Tap the three-dot menu in the top-right corner.',
      'Choose "Open in browser".',
    ],
    ios: [
      'Tap the Safari icon at the bottom.',
      'If needed, choose "Open in Safari".',
    ],
  },
  outlook: {
    android: [
      'Tap the three-dot menu in the top-right corner.',
      'Choose "Open in browser".',
    ],
    ios: [
      'Tap the share or menu button in Outlook.',
      'Choose "Open in Safari".',
    ],
  },
  yahoo_mail: {
    android: [
      'Tap the menu icon in the top-right corner.',
      'Choose "Open in browser".',
    ],
    ios: [
      'Tap the share or menu button in Yahoo Mail.',
      'Choose "Open in Safari".',
    ],
  },
  default: {
    android: [
      'Tap the menu icon in the top-right corner.',
      'Choose "Open in browser".',
    ],
    ios: [
      'Tap the menu icon in the current app.',
      'Choose "Open in Safari".',
    ],
  },
};

function getInstructionSteps(browserName, platform) {
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
  const instructions = getInstructionSteps(browserName, platform);
  const label = getBrowserLabel(browserName);
  const isAndroid = platform === 'android';
  const [copied, setCopied] = useState(false);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API may not be available in some WebViews.
    }
  };

  return (
    <div
      data-testid="inapp-overlay"
      className="fixed inset-0 z-[10000] overflow-y-auto bg-gradient-to-b from-slate-100 to-white px-5 dark:from-gray-950 dark:to-gray-900 sm:px-6"
      style={{
        paddingTop: 'max(24px, env(safe-area-inset-top, 20px))',
        paddingBottom: 'max(24px, env(safe-area-inset-bottom, 16px))',
      }}
    >
      <div className="mx-auto flex min-h-full w-full max-w-md items-center justify-center">
        <div
          data-testid="inapp-card"
          className="animate-overlay-enter w-full rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-[0_28px_70px_-42px_rgba(15,23,42,0.45)] backdrop-blur-sm dark:border-gray-800 dark:bg-gray-950/90"
        >
          <div className="mb-5 flex items-center gap-3">
            <AppLogo size={56} className="shrink-0 shadow-md" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-gray-400">
                GetGo Secure Access
              </p>
              <div className="mt-1 flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-gray-200">
                <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                External browser required
              </div>
            </div>
          </div>

          <h1
            data-testid="inapp-title"
            className={`text-balance font-bold leading-tight text-slate-900 dark:text-white ${
              isAndroid ? 'text-center text-xl' : 'text-2xl'
            }`}
          >
            {platform === 'android' ? 'Open in Google' : 'Open in Safari'}
          </h1>
          {!isAndroid && (
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-gray-300">
              You are viewing GetGo in {label}&apos;s built-in browser. For the best and most stable experience,
              continue in your phone&apos;s browser.
            </p>
          )}

          {platform === 'android' && (
            <div className="mt-4 px-2">
              <button
                data-testid="inapp-primary-cta"
                onClick={onOpenBrowser}
                className="animate-overlay-enter-delay flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 transition-transform duration-200 active:scale-[0.98]"
              >
                <ExternalLink className="size-5" />
                Open in Google
              </button>
            </div>
          )}

          <div
            data-testid="inapp-steps"
            className={`${isAndroid ? 'mt-6' : 'mt-5'} rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-gray-800 dark:bg-gray-900/70`}
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-gray-400">
              {platform === 'android' ? 'If the button does not work' : 'Manual steps'}
            </p>
            <ol className="space-y-3">
              {instructions.map((step, index) => (
                <li key={`${platform}-${index}`} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-semibold text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                    {index + 1}
                  </span>
                  <div className="flex min-w-0 items-start gap-2 text-sm leading-relaxed text-slate-700 dark:text-gray-200">
                    {index === 0 && <MoreVertical className="mt-0.5 size-4 shrink-0 text-orange-600 dark:text-orange-400" />}
                    <span className="break-words">{step}</span>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {platform === 'ios' && (
            <button
              data-testid="inapp-ios-copy"
              onClick={handleCopyUrl}
              className="animate-overlay-enter-delay mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <Copy className="size-4" />
              {copied ? 'Link copied' : 'Copy link to open in Safari'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default InAppBrowserOverlay;
