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
    <div style={{
      position: 'fixed',
      bottom: '80px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      backgroundColor: '#1f2937',
      color: 'white',
      padding: '16px 20px',
      borderRadius: '12px',
      boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      maxWidth: '90vw',
      width: '400px'
    }}>
      <RefreshCw style={{ width: '24px', height: '24px', color: '#f97316', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: '600', marginBottom: '4px', fontSize: '14px' }}>Update Available</p>
        <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>A new version is ready to install</p>
      </div>
      <button
        onClick={handleUpdate}
        style={{
          backgroundColor: '#f97316',
          color: 'white',
          border: 'none',
          padding: '10px 16px',
          borderRadius: '8px',
          fontWeight: '600',
          cursor: 'pointer',
          fontSize: '14px',
          flexShrink: 0
        }}
      >
        Update
      </button>
      <button
        onClick={handleDismiss}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#9ca3af',
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}
      >
        <X style={{ width: '20px', height: '20px' }} />
      </button>
    </div>
  );
}

export default PWAUpdateNotification;
