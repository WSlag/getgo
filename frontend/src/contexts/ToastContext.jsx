import React, { createContext, useContext, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Check, MessageSquare, Package, Star, AlertCircle, Banknote, X } from 'lucide-react';

const ToastContext = createContext(null);

const ICON_MAP = {
  bid: Banknote,
  'bid-accepted': Check,
  message: MessageSquare,
  SHIPMENT_STATUS: Package,
  tracking: Package,
  RATING_REQUEST: Star,
  error: AlertCircle,
};

const COLOR_MAP = {
  bid: { bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800', icon: 'bg-green-500' },
  'bid-accepted': { bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800', icon: 'bg-blue-500' },
  message: { bg: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800', icon: 'bg-purple-500' },
  SHIPMENT_STATUS: { bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800', icon: 'bg-orange-500' },
  tracking: { bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800', icon: 'bg-orange-500' },
  RATING_REQUEST: { bg: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800', icon: 'bg-yellow-500' },
  error: { bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800', icon: 'bg-red-500' },
  default: { bg: 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700', icon: 'bg-gray-500' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((toast) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, ...toast }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}

      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-[min(320px,calc(100vw-32px))]">
        {toasts.map((toast) => {
          const colors = COLOR_MAP[toast.type] || COLOR_MAP.default;
          const Icon = ICON_MAP[toast.type];

          return (
            <div
              key={toast.id}
              className={cn(
                "flex items-start gap-3 p-4 rounded-xl shadow-lg border backdrop-blur-sm animate-in slide-in-from-top-2 duration-300",
                colors.bg
              )}
            >
              <div className={cn(
                "size-8 rounded-full flex items-center justify-center flex-shrink-0 text-white",
                colors.icon
              )}>
                {Icon ? <Icon className="size-4" /> : <AlertCircle className="size-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-900 dark:text-white leading-snug">
                  {toast.title}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 leading-snug break-words">
                  {toast.message}
                </p>
              </div>
              <button
                onClick={() => dismissToast(toast.id)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
              >
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
