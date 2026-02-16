import React, { useState, useEffect } from 'react';
import { RefreshCw, X } from 'lucide-react';

export function PWAUpdateNotification() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [updateFn, setUpdateFn] = useState(null);

  useEffect(() => {
    const handleUpdateAvailable = (event) => {
      setShowUpdate(true);
      setUpdateFn(() => event.detail.updateSW);
    };

    window.addEventListener('sw-update-available', handleUpdateAvailable);
    return () => {
      window.removeEventListener('sw-update-available', handleUpdateAvailable);
    };
  }, []);

  const handleUpdate = () => {
    if (updateFn) {
      updateFn(true);
    }
  };

  const handleDismiss = () => {
    setShowUpdate(false);
  };

  if (!showUpdate) return null;

  return (
    <div
      className="fixed left-1/2 z-[9999] w-[min(92vw,420px)] -translate-x-1/2 rounded-xl bg-gray-800 text-white shadow-2xl"
      style={{ bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="flex items-center gap-4 px-4 py-4 sm:px-5">
        <RefreshCw className="size-6 text-orange-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm mb-1">Update Available</p>
          <p className="text-xs text-gray-400 m-0">A new version is ready to install</p>
        </div>
        <button
          onClick={handleUpdate}
          className="bg-orange-500 hover:bg-orange-600 text-white border-none px-4 py-2 rounded-lg font-semibold text-sm shrink-0 transition-colors"
        >
          Update
        </button>
        <button
          onClick={handleDismiss}
          className="bg-transparent border-none text-gray-400 hover:text-gray-200 cursor-pointer p-1 shrink-0 transition-colors"
          aria-label="Dismiss update notification"
        >
          <X className="size-5" />
        </button>
      </div>
    </div>
  );
}

export default PWAUpdateNotification;
