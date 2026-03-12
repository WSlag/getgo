import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ANNOUNCEMENT_DEDUPE_MS = 2500;
const ANNOUNCEMENT_MIN_GAP_MS = 400;

const LiveRegionContext = createContext(null);

function nowMs() {
  return Date.now();
}

export function LiveRegionProvider({ children }) {
  const [politeMessage, setPoliteMessage] = useState('');
  const [assertiveMessage, setAssertiveMessage] = useState('');
  const lastByChannelRef = useRef({ polite: { message: '', time: 0 }, assertive: { message: '', time: 0 } });

  const announce = useCallback((channel, rawMessage) => {
    const message = String(rawMessage || '').trim();
    if (!message) return;

    const current = nowMs();
    const last = lastByChannelRef.current[channel];
    if (!last) return;

    const duplicateWithinWindow = last.message === message && current - last.time < ANNOUNCEMENT_DEDUPE_MS;
    const tooFrequent = current - last.time < ANNOUNCEMENT_MIN_GAP_MS;

    if (duplicateWithinWindow || tooFrequent) {
      return;
    }

    lastByChannelRef.current[channel] = { message, time: current };

    if (channel === 'assertive') {
      setAssertiveMessage('');
      window.setTimeout(() => setAssertiveMessage(message), 10);
      return;
    }

    setPoliteMessage('');
    window.setTimeout(() => setPoliteMessage(message), 10);
  }, []);

  const value = useMemo(() => ({
    announcePolite: (message) => announce('polite', message),
    announceAssertive: (message) => announce('assertive', message),
  }), [announce]);

  return (
    <LiveRegionContext.Provider value={value}>
      {children}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {politeMessage}
      </div>
      <div className="sr-only" aria-live="assertive" aria-atomic="true" role="alert">
        {assertiveMessage}
      </div>
    </LiveRegionContext.Provider>
  );
}

export function useLiveRegion() {
  const context = useContext(LiveRegionContext);
  if (!context) {
    throw new Error('useLiveRegion must be used within a LiveRegionProvider');
  }
  return context;
}

export default LiveRegionProvider;
