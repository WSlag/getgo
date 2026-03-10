import { ExternalLink, Copy, ShieldCheck } from 'lucide-react';
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
  whatsapp: {
    android: [
      'Tap the three-dot menu in the top-right corner.',
      'Choose "Open in browser".',
    ],
    ios: [
      'Tap the share button in WhatsApp.',
      'Choose "Open in Safari".',
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
    whatsapp: 'WhatsApp',
    android_webview: 'an in-app browser',
  };
  return labels[browserName] || 'this app';
}

export function InAppBrowserOverlay({ platform, browserName, onOpenBrowser }) {
  const instructions = getInstructionSteps(browserName, platform);
  const label = getBrowserLabel(browserName);

  return (
    <div
      data-testid="inapp-overlay"
      className="fixed inset-0 z-[10000] overflow-x-hidden overflow-y-auto"
      style={{
        background: 'linear-gradient(160deg, #fff7ed 0%, #ffffff 50%, #fff7ed 100%)',
        paddingTop: 'max(24px, env(safe-area-inset-top, 20px))',
        paddingBottom: 'max(24px, env(safe-area-inset-bottom, 16px))',
        paddingLeft: 'clamp(18px, 5vw, 24px)',
        paddingRight: 'clamp(18px, 5vw, 24px)',
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
          className="animate-overlay-enter w-full overflow-hidden rounded-[22px] bg-white shadow-2xl sm:rounded-2xl"
          style={{ boxShadow: '0 24px 64px -12px rgba(249,115,22,0.18), 0 8px 24px -4px rgba(0,0,0,0.08)' }}
        >
          {/* Orange gradient header band */}
          <div
            className="relative flex items-center gap-2.5 overflow-hidden pl-6 pr-5 py-3.5 sm:gap-3 sm:pl-7 sm:pr-6 sm:py-4"
            style={{ background: 'linear-gradient(135deg, #FF9A56 0%, #FF6B35 100%)' }}
          >
            {/* Decorative rings */}
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full border border-white/10 pointer-events-none" />
            <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full border border-white/10 pointer-events-none" />

            <div className="relative z-10 flex size-12 shrink-0 items-center justify-center rounded-xl border border-white/30 bg-white/20 shadow-lg backdrop-blur-sm">
              <AppLogo size={32} className="shrink-0" />
            </div>
            <div className="relative z-10 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.11em] text-white/70">
                GetGo Secure Access
              </p>
              <div className="mt-0.5 flex items-center gap-1 sm:gap-1.5">
                <ShieldCheck className="size-3.5 shrink-0 text-white" />
                <span className="break-words text-xs font-semibold leading-tight text-white sm:text-sm">
                  External browser required
                </span>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="pl-6 pr-5 pb-5 pt-4 sm:pl-7 sm:pr-6 sm:pb-6 sm:pt-5">
            <h1
              data-testid="inapp-title"
              className="break-words text-[clamp(1.65rem,6vw,2rem)] font-black leading-[1.05] text-gray-900"
              style={{ fontFamily: 'Outfit, sans-serif' }}
            >
              {platform === 'android' ? 'Open in Google' : 'Open in Safari'}
            </h1>
            <p className="mt-2 break-words text-[13px] leading-relaxed text-gray-500 sm:text-sm">
              You are viewing GetGo in {label}&apos;s built-in browser. For the best and most stable experience, continue in your phone&apos;s browser.
            </p>

            {/* Android primary CTA */}
            {platform === 'android' && (
              <button
                data-testid="inapp-primary-cta"
                onClick={onOpenBrowser}
                className="animate-overlay-enter-delay mt-4 flex w-full items-center justify-center gap-2 rounded-xl text-center text-[15px] font-bold leading-tight text-white transition-all hover:opacity-90 active:scale-[0.97] sm:mt-5 sm:rounded-2xl"
                style={{
                  padding: '14px 16px',
                  background: 'linear-gradient(135deg, #FF9A56 0%, #FF6B35 100%)',
                  boxShadow: '0 6px 20px rgba(249,115,22,0.4)',
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                <ExternalLink className="size-5 shrink-0" />
                <span className="break-words whitespace-normal">Open in Google</span>
              </button>
            )}

            {/* iOS primary CTA */}
            {platform === 'ios' && (
              <button
                data-testid="inapp-ios-copy"
                onClick={onOpenBrowser}
                className="animate-overlay-enter-delay mt-4 flex w-full items-center justify-center gap-2 rounded-xl text-center text-[14px] font-bold leading-tight text-white transition-all hover:opacity-90 active:scale-[0.97] sm:mt-5 sm:rounded-2xl sm:text-[15px]"
                style={{
                  padding: '14px 16px',
                  background: 'linear-gradient(135deg, #FF9A56 0%, #FF6B35 100%)',
                  boxShadow: '0 6px 20px rgba(249,115,22,0.4)',
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                <Copy className="size-5 shrink-0" />
                <span className="break-words whitespace-normal">Copy Link to Open in Safari</span>
              </button>
            )}

            {/* Manual steps */}
            <div
              data-testid="inapp-steps"
              className="mt-4 rounded-xl border border-orange-100 bg-orange-50/60 pl-5 pr-4 py-4 sm:rounded-2xl sm:pl-6 sm:pr-5 sm:py-5"
            >
              <p className="mb-2.5 break-words text-[10px] font-bold uppercase tracking-[0.11em] leading-tight text-orange-400 sm:mb-3">
                {platform === 'android' ? 'If the button does not work' : 'Manual steps'}
              </p>
              <ol className="space-y-2.5 sm:space-y-3">
                {instructions.map((step, index) => (
                  <li key={`${platform}-${index}`} className="flex items-start gap-3 sm:gap-3.5">
                    <span
                      className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white sm:h-6 sm:w-6 sm:text-xs"
                      style={{ background: 'linear-gradient(135deg, #FF9A56 0%, #FF6B35 100%)' }}
                    >
                      {index + 1}
                    </span>
                    <div className="flex min-w-0 items-start pl-1 text-[13px] leading-relaxed text-gray-700 sm:text-sm">
                      <span className="break-words">{step}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InAppBrowserOverlay;
