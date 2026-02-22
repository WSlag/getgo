import React from 'react';
import { Download, X, Share, PlusSquare, Smartphone } from 'lucide-react';
import {
  Dialog,
  DialogBottomSheet,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

// --- Android / Desktop install banner ---
function InstallBanner({ onInstall, onDismiss }) {
  return (
    <div
      className="fixed left-1/2 z-[9998] w-[min(92vw,420px)] -translate-x-1/2 rounded-xl bg-gray-800 text-white shadow-2xl"
      style={{ bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="flex items-center gap-4 px-4 py-4 sm:px-5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-orange-600">
          <span className="text-lg font-bold text-white">K</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="mb-0.5 text-sm font-semibold">Install KARGA</p>
          <p className="m-0 text-xs text-gray-400">
            Fast access, works offline
          </p>
        </div>
        <button
          onClick={onInstall}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white border-none transition-colors hover:bg-orange-600"
        >
          <Download className="size-4" />
          Install
        </button>
        <button
          onClick={onDismiss}
          className="shrink-0 bg-transparent border-none p-1 text-gray-400 transition-colors hover:text-gray-200 cursor-pointer"
          aria-label="Dismiss install prompt"
        >
          <X className="size-5" />
        </button>
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
            <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 shadow-md">
              <span className="text-2xl font-bold text-white">K</span>
            </div>
            <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white">
              Install KARGA on your phone
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Get the full app experience — fast, offline-ready
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
            Maybe Later
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
  platform,
}) {
  return (
    <>
      {/* Android / Desktop banner */}
      {showInstallBanner && (
        <InstallBanner onInstall={triggerInstall} onDismiss={dismissInstallBanner} />
      )}

      {/* iOS Safari instructions */}
      <IOSInstallSheet open={showIOSInstall} onDismiss={dismissIOSInstall} />
    </>
  );
}

export default PWAInstallPrompt;
