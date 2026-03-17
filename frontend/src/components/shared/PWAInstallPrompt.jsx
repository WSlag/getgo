import { Download, PlusSquare, Smartphone } from 'lucide-react';
import {
  Dialog,
  DialogBottomSheet,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { AppLogo } from './AppLogo';

// --- Android / Desktop install banner ---
function InstallBanner({ onInstall, onDismiss }) {
  return (
    <div
      className="fixed left-1/2 z-[9998] w-[min(92vw,420px)] -translate-x-1/2"
      style={{ bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}
    >
      {/* Outer glow ring */}
      <div
        className="rounded-2xl p-px"
        style={{ background: 'linear-gradient(135deg, #FF9A56 0%, #FF6B35 100%)' }}
      >
        <div className="flex items-center gap-3 rounded-2xl bg-white dark:bg-gray-900 px-4 py-3 shadow-xl">
          <AppLogo size={42} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="mb-0 text-sm font-bold text-gray-900 dark:text-white leading-tight">
              E-install ang GetGo
            </p>
            <p className="m-0 text-xs text-gray-500 dark:text-gray-400">
              Mabilis mag-book kahit mabagal ang signal
            </p>
          </div>
          <button
            onClick={onInstall}
            className="flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold text-white border-none transition-all active:scale-95 hover:opacity-90"
            style={{
              background: 'linear-gradient(135deg, #FF9A56 0%, #FF6B35 100%)',
              boxShadow: '0 4px 14px rgba(249,115,22,0.4)',
            }}
          >
            <Download className="size-3.5" />
            Install
          </button>
          <button
            onClick={onDismiss}
            className="shrink-0 bg-transparent border-none px-2 py-1.5 rounded-lg text-xs font-medium text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}

// --- iOS Safari share icon (the square-with-arrow-up that iOS uses) ---
function IOSShareIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

// --- iOS Safari install instructions (bottom sheet) ---
function IOSInstallSheet({ open, onDismiss }) {
  const steps = [
    {
      icon: <IOSShareIcon className="size-5 text-orange-600 dark:text-orange-400" />,
      title: 'Tap the Share button',
      description: 'at the bottom of your Safari toolbar',
    },
    {
      icon: <PlusSquare className="size-5 text-orange-600 dark:text-orange-400" />,
      title: 'Tap "Add to Home Screen"',
      description: 'scroll down in the share menu to find it',
    },
    {
      icon: <Smartphone className="size-5 text-orange-600 dark:text-orange-400" />,
      title: 'Tap "Add"',
      description: 'in the top right corner — done!',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onDismiss()}>
      <DialogBottomSheet>
        <div className="px-6 pb-6 pt-2">
          {/* Header */}
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-4">
              <AppLogo size={56} className="drop-shadow-lg" />
            </div>
            <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white">
              Install GetGo on your phone
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Libre ito — E-save sa home screen para mabilis mag-book
            </DialogDescription>
          </div>

          {/* Steps */}
          <div className="mb-6 space-y-4">
            {steps.map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 dark:bg-orange-900/20">
                  {step.icon}
                </div>
                <div className="flex-1 pt-0.5">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    <span className="mr-1.5 inline-flex size-5 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    {step.title}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Dismiss */}
          <button
            onClick={onDismiss}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            Later
          </button>
        </div>
      </DialogBottomSheet>
    </Dialog>
  );
}

// --- Persistent install modal (shown after onboarding) ---
function InstallModal({ open, onInstall, onDismiss, installing }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onDismiss()}>
      <DialogBottomSheet>
        <div className="px-6 pb-6 pt-2">
          {/* Header */}
          <div className="mb-5 flex flex-col items-center text-center">
            <div className="mb-4">
              <AppLogo size={56} className="drop-shadow-lg" />
            </div>
            <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white">
              Install GetGo
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              E-install para mas mabilis at mas maganda ang experience
            </DialogDescription>
          </div>

          {/* Benefits */}
          <div className="mb-6 space-y-3">
            {[
              { icon: '\u26A1', text: 'Mas mabilis mag-load, instant access' },
              { icon: '\uD83D\uDD14', text: 'Real-time na notifications sa bids at cargo' },
              { icon: '\uD83D\uDCF1', text: 'Parang native app sa phone mo' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl bg-orange-50 dark:bg-orange-900/20 px-4 py-2.5">
                <span className="text-lg">{item.icon}</span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.text}</span>
              </div>
            ))}
          </div>

          {/* Install Button */}
          <button
            onClick={onInstall}
            disabled={installing}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold text-white border-none transition-all active:scale-[0.98] hover:opacity-90 disabled:opacity-70"
            style={{
              background: 'linear-gradient(135deg, #FF9A56 0%, #FF6B35 100%)',
              boxShadow: '0 4px 14px rgba(249,115,22,0.4)',
            }}
          >
            <Download className="size-4" />
            {installing ? 'Ini-install...' : 'E-install \u2014 Libre, 1 tap lang'}
          </button>

          {/* Dismiss */}
          <button
            onClick={onDismiss}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            Later
          </button>
        </div>
      </DialogBottomSheet>
    </Dialog>
  );
}

// --- Main export ---
export function PWAInstallPrompt({
  showInstallBanner,
  triggerInstall,
  dismissInstallBanner,
  showIOSInstall,
  dismissIOSInstall,
  showInstallModal,
  onInstallModalInstall,
  onInstallModalDismiss,
  installModalInstalling,
}) {
  return (
    <>
      {/* Android / Desktop banner */}
      {showInstallBanner && (
        <InstallBanner onInstall={triggerInstall} onDismiss={dismissInstallBanner} />
      )}

      {/* iOS Safari instructions */}
      <IOSInstallSheet open={showIOSInstall} onDismiss={dismissIOSInstall} />

      {/* Persistent install modal */}
      <InstallModal
        open={showInstallModal}
        onInstall={onInstallModalInstall}
        onDismiss={onInstallModalDismiss}
        installing={installModalInstalling}
      />
    </>
  );
}

export default PWAInstallPrompt;
