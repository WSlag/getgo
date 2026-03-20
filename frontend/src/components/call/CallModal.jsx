import { useEffect, useCallback } from 'react';
import { PhoneOff, Mic, MicOff, Volume2, VolumeX, Phone } from 'lucide-react';
import { useAgoraCall } from '@/hooks/useAgoraCall';

const LEAVE_CALL_TIMEOUT_MS = 1500;

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function Avatar({ name, size = 80 }) {
  const initial = (name || '?')[0].toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #22c55e 0%, #10b981 50%, #059669 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.4,
        fontWeight: 700,
        color: 'white',
        userSelect: 'none',
        boxShadow: '0 8px 32px rgba(34, 197, 94, 0.4)',
      }}
    >
      {initial}
    </div>
  );
}

function RoundButton({ onClick, label, color, size = 64, disabled = false, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-disabled={disabled}
      disabled={disabled}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: color,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform 0.15s, filter 0.15s',
        flexShrink: 0,
        opacity: disabled ? 0.55 : 1,
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.filter = 'brightness(1.15)';
      }}
      onMouseLeave={(e) => { e.currentTarget.style.filter = ''; }}
      onMouseDown={(e) => {
        if (disabled) return;
        e.currentTarget.style.transform = 'scale(0.93)';
      }}
      onMouseUp={(e) => { e.currentTarget.style.transform = ''; }}
    >
      {children}
    </button>
  );
}

/**
 * Full-screen voice call overlay.
 *
 * Props:
 *   open           - whether the modal is visible
 *   callId         - Firestore call document ID
 *   channelName    - Agora channel name (= callId)
 *   agoraUid       - numeric Agora UID for the local user
 *   otherPartyName - display name of the other party
 *   isOutgoing     - true = we initiated, false = we accepted
 *   callStatus     - Firestore call status
 *   onUpdateStatus - (callId, status) => void updates Firestore
 *   onClose        - (reason: string) => void closes the modal
 */
export function CallModal({
  open,
  callId,
  channelName,
  agoraUid,
  otherPartyName,
  isOutgoing,
  callStatus,
  onUpdateStatus,
  onClose,
}) {
  const {
    callState,
    isMuted,
    remoteUsers,
    error,
    duration,
    joinChannel,
    leaveChannel,
    toggleMute,
    resetCall,
  } = useAgoraCall();

  const leaveChannelSafely = useCallback(async () => {
    let timeoutId;
    const timeoutPromise = new Promise((resolve) => {
      timeoutId = setTimeout(resolve, LEAVE_CALL_TIMEOUT_MS);
    });
    try {
      await Promise.race([leaveChannel(), timeoutPromise]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }, [leaveChannel]);

  // Join the channel when the modal opens.
  useEffect(() => {
    if (!open || !channelName || agoraUid == null) return;
    joinChannel(channelName, agoraUid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, channelName, agoraUid]);

  const handleEnd = useCallback(async () => {
    try {
      await leaveChannelSafely();
      if (callId && onUpdateStatus) {
        await onUpdateStatus(callId, 'ended');
      }
    } catch (err) {
      console.warn('[CallModal] end-call status update failed:', err);
    } finally {
      resetCall();
      onClose('ended');
    }
  }, [callId, onUpdateStatus, leaveChannelSafely, resetCall, onClose]);

  const handleCancel = useCallback(async () => {
    try {
      await leaveChannelSafely();
      if (callId && onUpdateStatus) {
        await onUpdateStatus(callId, isOutgoing ? 'ended' : 'rejected');
      }
    } catch (err) {
      console.warn('[CallModal] cancel-call status update failed:', err);
    } finally {
      resetCall();
      onClose(isOutgoing ? 'cancelled' : 'rejected');
    }
  }, [callId, isOutgoing, onUpdateStatus, leaveChannelSafely, resetCall, onClose]);

  const handleDismiss = useCallback(async () => {
    const isTerminalStatus = ['ended', 'rejected', 'missed'].includes(callStatus);
    try {
      await leaveChannelSafely();
      if (callId && onUpdateStatus && !isTerminalStatus) {
        await onUpdateStatus(callId, isOutgoing ? 'ended' : 'rejected');
      }
    } catch (err) {
      console.warn('[CallModal] dismiss-call status update failed:', err);
    } finally {
      resetCall();
      onClose('dismissed');
    }
  }, [callId, callStatus, isOutgoing, leaveChannelSafely, onUpdateStatus, onClose, resetCall]);

  if (!open) return null;

  const hasRemoteParticipant = remoteUsers.length > 0;
  const isConnecting = callState === 'idle' || callState === 'joining';
  const isActive = callState === 'active';
  const isError = callState === 'error';
  const isTerminalStatus = ['ended', 'rejected', 'missed'].includes(callStatus);

  let statusText = '';
  if (isError) {
    statusText = error || 'Call failed';
  } else if (isTerminalStatus) {
    if (callStatus === 'missed') statusText = 'No answer';
    else if (callStatus === 'rejected') statusText = 'Call declined';
    else statusText = 'Call ended';
  } else if (isActive) {
    statusText = formatDuration(duration);
  } else if (isOutgoing && !hasRemoteParticipant && callStatus === 'ringing') {
    statusText = 'Ringing...';
  } else {
    statusText = 'Connecting...';
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        backgroundColor: 'rgba(10, 15, 25, 0.96)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0',
        padding: '32px 24px',
      }}
    >
      {/* Call type label */}
      <p
        style={{
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.4)',
          marginBottom: 32,
        }}
      >
        Voice Call
      </p>

      {/* Avatar with pulse rings when ringing */}
      <div style={{ position: 'relative', marginBottom: 28 }}>
        {isConnecting && (
          <>
            <div
              className="animate-pulse-ring"
              style={{
                position: 'absolute',
                inset: -20,
                borderRadius: '50%',
                border: '2px solid rgba(34, 197, 94, 0.35)',
                pointerEvents: 'none',
              }}
            />
            <div
              className="animate-pulse-ring"
              style={{
                position: 'absolute',
                inset: -36,
                borderRadius: '50%',
                border: '2px solid rgba(34, 197, 94, 0.18)',
                animationDelay: '0.4s',
                pointerEvents: 'none',
              }}
            />
          </>
        )}
        <Avatar name={otherPartyName} size={96} />
      </div>

      {/* Name */}
      <p
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: 'white',
          marginBottom: 10,
          textAlign: 'center',
          maxWidth: 280,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {otherPartyName || 'User'}
      </p>

      {/* Status / timer */}
      <p
        style={{
          fontSize: 15,
          color: isError ? '#fca5a5' : 'rgba(255,255,255,0.55)',
          marginBottom: 56,
          minHeight: 22,
          textAlign: 'center',
        }}
      >
        {statusText}
      </p>

      {/* Controls */}
      {isActive ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            {/* Mute */}
            <RoundButton
              onClick={toggleMute}
              label={isMuted ? 'Unmute' : 'Mute'}
              color={isMuted ? '#374151' : 'rgba(255,255,255,0.12)'}
              size={56}
            >
              {isMuted
                ? <MicOff color="white" size={20} />
                : <Mic color="white" size={20} />
              }
            </RoundButton>

            {/* End call */}
            <RoundButton
              onClick={handleEnd}
              label="End call"
              color="#ef4444"
              size={72}
            >
              <PhoneOff color="white" size={28} />
            </RoundButton>

            {/* Web fallback: output route is controlled by browser/device */}
            <RoundButton
              label="Speaker output is controlled by your device and browser"
              color="rgba(255,255,255,0.12)"
              size={56}
              disabled
            >
              <Volume2 color="white" size={20} />
            </RoundButton>
          </div>

          <p
            style={{
              margin: 0,
              fontSize: 12,
              lineHeight: 1.35,
              color: 'rgba(255,255,255,0.56)',
              textAlign: 'center',
              maxWidth: 300,
            }}
          >
            Speaker output is controlled by your device/browser on web.
          </p>
        </div>
      ) : (
        /* Ringing / error / ended - show cancel + optional dismiss */
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          {isError || isTerminalStatus || callState === 'ended' ? (
            <RoundButton
              onClick={handleDismiss}
              label="Dismiss"
              color="rgba(255,255,255,0.12)"
              size={64}
            >
              <VolumeX color="white" size={24} />
            </RoundButton>
          ) : null}
          <RoundButton
            onClick={handleCancel}
            label={isOutgoing ? 'Cancel call' : 'Decline'}
            color="#ef4444"
            size={72}
          >
            <PhoneOff color="white" size={28} />
          </RoundButton>
          {/* Non-interactive call state indicator for callee while connecting */}
          {!isOutgoing && isConnecting && (
            <div
              role="status"
              aria-label="Call connecting"
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                backgroundColor: '#22c55e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                opacity: 0.9,
              }}
            >
              <Phone color="white" size={28} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CallModal;
