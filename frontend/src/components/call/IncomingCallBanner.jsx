import React from 'react';
import { Phone, PhoneOff } from 'lucide-react';

/**
 * Floating incoming-call banner, rendered above the mobile nav bar.
 * Styled like an iOS call notification for familiarity.
 *
 * Props:
 *   incomingCall — call document from Firestore (or null)
 *   onAccept     — (call) => void
 *   onDecline    — (call) => void
 */
export function IncomingCallBanner({ incomingCall, onAccept, onDecline }) {
  if (!incomingCall) return null;

  const callerInitial = (incomingCall.callerName || '?')[0].toUpperCase();

  return (
    <div
      className="animate-slide-up-fade"
      style={{
        position: 'fixed',
        /* Sit above the mobile nav (≈72px) + safe area */
        bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(360px, calc(100vw - 24px))',
        zIndex: 9999,
        backgroundColor: '#111827',
        borderRadius: 20,
        padding: '14px 16px',
        boxShadow:
          '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #22c55e, #059669)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: 18,
          fontWeight: 700,
          color: 'white',
          boxShadow: '0 4px 12px rgba(34,197,94,0.4)',
        }}
      >
        {callerInitial}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            color: 'white',
            fontWeight: 600,
            fontSize: 15,
            lineHeight: '1.3',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {incomingCall.callerName || 'Unknown'}
        </p>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 1 }}>
          Incoming voice call
        </p>
      </div>

      {/* Decline */}
      <button
        type="button"
        onClick={() => onDecline(incomingCall)}
        aria-label="Decline call"
        style={{
          width: 42,
          height: 42,
          borderRadius: '50%',
          backgroundColor: '#ef4444',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'filter 0.15s, transform 0.15s',
          boxShadow: '0 4px 12px rgba(239,68,68,0.4)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.15)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.filter = ''; }}
        onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.92)'; }}
        onMouseUp={(e) => { e.currentTarget.style.transform = ''; }}
      >
        <PhoneOff color="white" size={17} />
      </button>

      {/* Accept */}
      <button
        type="button"
        onClick={() => onAccept(incomingCall)}
        aria-label="Accept call"
        style={{
          width: 42,
          height: 42,
          borderRadius: '50%',
          backgroundColor: '#22c55e',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'filter 0.15s, transform 0.15s',
          boxShadow: '0 4px 12px rgba(34,197,94,0.4)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.15)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.filter = ''; }}
        onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.92)'; }}
        onMouseUp={(e) => { e.currentTarget.style.transform = ''; }}
      >
        <Phone color="white" size={17} />
      </button>
    </div>
  );
}
