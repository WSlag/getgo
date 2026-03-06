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
      className="fixed inset-0 z-[10000] overflow-y-auto"
      style={{
        background: 'linear-gradient(160deg, #fff7ed 0%, #ffffff 50%, #fff7ed 100%)',
        paddingTop: 'max(24px, env(safe-area-inset-top, 20px))',
        paddingBottom: 'max(24px, env(safe-area-inset-bottom, 16px))',
        paddingLeft: '20px',
        paddingRight: '20px',
      }}
    >
      {/* Decorative background blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #fb923c, transparent 70%)' }} />
        <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #f97316, transparent 70%)' }} />
      </div>

      <div className="relative mx-auto flex min-h-full w-full max-w-sm items-center justify-center">
        <div
          data-testid="inapp-card"
          className="animate-overlay-enter w-full overflow-hidden rounded-3xl bg-white shadow-2xl"
          style={{ boxShadow: '0 24px 64px -12px rgba(249,115,22,0.18), 0 8px 24px -4px rgba(0,0,0,0.08)' }}
        >
          {/* Orange gradient header band */}
          <div
            className="relative flex items-center gap-3 px-5 py-4 overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #FF9A56 0%, #FF6B35 100%)' }}
          >
            {/* Decorative rings */}
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full border border-white/10 pointer-events-none" />
            <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full border border-white/10 pointer-events-none" />

            <div className="relative z-10 flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 border border-white/30 backdrop-blur-sm shadow-lg">
              <AppLogo size={32} className="shrink-0" />
            </div>
            <div className="relative z-10">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/70">
                GetGo Secure Access
              </p>
              <div className="mt-0.5 flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-white" />
                <span className="text-sm font-semibold text-white">External browser required</span>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-5 pt-5 pb-6">
            <h1
              data-testid="inapp-title"
              className="text-2xl font-black leading-tight text-gray-900"
              style={{ fontFamily: 'Outfit, sans-serif' }}
            >
              {platform === 'android' ? 'Open in Google' : 'Open in Safari'}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-500">
              You are viewing GetGo in {label}&apos;s built-in browser. For the best and most stable experience, continue in your phone&apos;s browser.
            </p>

            {/* Android primary CTA */}
            {platform === 'android' && (
              <button
                data-testid="inapp-primary-cta"
                onClick={onOpenBrowser}
                className="animate-overlay-enter-delay mt-5 flex w-full items-center justify-center gap-2 rounded-2xl text-white font-bold text-[15px] transition-all active:scale-[0.97] hover:opacity-90"
                style={{
                  padding: '14px 16px',
                  background: 'linear-gradient(135deg, #FF9A56 0%, #FF6B35 100%)',
                  boxShadow: '0 6px 20px rgba(249,115,22,0.4)',
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                <ExternalLink className="size-5" />
                Open in Google
              </button>
            )}

            {/* Manual steps */}
            <div
              data-testid="inapp-steps"
              className="mt-4 rounded-2xl border border-orange-100 bg-orange-50/60 p-4"
            >
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-orange-400">
                {platform === 'android' ? 'If the button does not work' : 'Manual steps'}
              </p>
              <ol className="space-y-3">
                {instructions.map((step, index) => (
                  <li key={`${platform}-${index}`} className="flex items-start gap-3">
                    <span
                      className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ background: 'linear-gradient(135deg, #FF9A56 0%, #FF6B35 100%)' }}
                    >
                      {index + 1}
                    </span>
                    <div className="flex min-w-0 items-start gap-1.5 text-sm leading-relaxed text-gray-700">
                      {index === 0 && <MoreVertical className="mt-0.5 size-4 shrink-0 text-orange-400" />}
                      <span className="break-words">{step}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* iOS copy link */}
            {platform === 'ios' && (
              <button
                data-testid="inapp-ios-copy"
                onClick={handleCopyUrl}
                className="animate-overlay-enter-delay mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 active:scale-[0.98]"
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
              >
                <Copy className="size-4 text-orange-500" />
                {copied ? 'Link copied!' : 'Copy link to open in Safari'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default InAppBrowserOverlay;
