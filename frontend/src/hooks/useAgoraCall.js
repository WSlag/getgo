import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';

/**
 * Agora RTC voice call hook (voice-only, no video).
 *
 * Manages the Agora client lifecycle: joining, publishing mic audio,
 * subscribing to remote audio, muting, and leaving.
 *
 * callState values:
 *   'idle'    - not in a call
 *   'joining' - connecting to Agora channel / waiting for remote participant
 *   'active'  - in call, both sides connected
 *   'ended'   - call finished or failed
 *   'error'   - unrecoverable error
 */
export function useAgoraCall() {
  const clientRef = useRef(null);
  const localTrackRef = useRef(null);
  const durationRef = useRef(null);
  const callStateRef = useRef('idle');
  const joinTaskRef = useRef(null);
  const callSessionRef = useRef(0);
  const isLeavingRef = useRef(false);

  const [callState, setCallState] = useState('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [error, setError] = useState(null);
  const [duration, setDuration] = useState(0);

  const setCallStateSafe = useCallback((nextState) => {
    callStateRef.current = nextState;
    setCallState(nextState);
  }, []);

  const stopDurationTimer = useCallback(() => {
    if (durationRef.current) {
      clearInterval(durationRef.current);
      durationRef.current = null;
    }
  }, []);

  const startDurationTimer = useCallback(() => {
    if (durationRef.current) return;
    setDuration(0);
    durationRef.current = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
  }, []);

  const cleanupLocalTrack = useCallback(async () => {
    if (localTrackRef.current) {
      try {
        localTrackRef.current.stop();
        localTrackRef.current.close();
      } catch {
        // Best-effort cleanup.
      }
      localTrackRef.current = null;
    }
  }, []);

  const cleanupClient = useCallback(async () => {
    if (clientRef.current) {
      const client = clientRef.current;
      clientRef.current = null;
      try {
        await client.leave();
      } catch {
        // Best-effort cleanup.
      }
    }
  }, []);

  /**
   * Join an Agora channel and start publishing microphone audio.
   * @param {string} channelName - Agora channel name (= callId)
   * @param {number} agoraUid    - Numeric Agora UID for this user
   */
  const joinChannel = useCallback(
    async (channelName, agoraUid) => {
      if (callStateRef.current === 'joining' || callStateRef.current === 'active') return;

      const sessionId = callSessionRef.current + 1;
      callSessionRef.current = sessionId;
      isLeavingRef.current = false;

      const isSessionStale = () => isLeavingRef.current || callSessionRef.current !== sessionId;

      setCallStateSafe('joining');
      setError(null);
      setRemoteUsers([]);
      setIsMuted(false);
      stopDurationTimer();

      let task = null;
      task = (async () => {
        let joinedAndPublished = false;
        try {
          // Lazy-load the Agora SDK to avoid bundle impact when feature unused
          const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
          if (isSessionStale()) return;

          // Create a new client for this call session
          const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
          clientRef.current = client;

          // Remote user joined and published audio
          client.on('user-published', async (user, mediaType) => {
            await client.subscribe(user, mediaType);
            if (mediaType !== 'audio') return;

            user.audioTrack?.play();
            setRemoteUsers((prev) => {
              if (prev.find((u) => u.uid === user.uid)) return prev;
              const next = [...prev, user];
              if (prev.length === 0) {
                setCallStateSafe('active');
                startDurationTimer();
              }
              return next;
            });
          });

          // Remote user stopped publishing. Do not end on unpublish because
          // this can happen during mute/state transitions without a true hang-up.
          client.on('user-unpublished', (_user, mediaType) => {
            if (mediaType !== 'audio') return;
            // Keep call active; user-left / connection-state-change will handle actual teardown.
          });

          // Remote user left the channel
          client.on('user-left', (user) => {
            setRemoteUsers((prev) => {
              const next = prev.filter((u) => u.uid !== user.uid);
              if (prev.length > 0 && next.length === 0 && callStateRef.current === 'active') {
                stopDurationTimer();
                setCallStateSafe('ended');
              }
              return next;
            });
          });

          // Handle network disconnection
          client.on('connection-state-change', (curState) => {
            if (curState === 'DISCONNECTED') {
              stopDurationTimer();
              setCallStateSafe('ended');
            }
          });

          // Fetch token from our Cloud Function
          const { token, appId } = await api.calls.generateToken(channelName, agoraUid);
          if (isSessionStale()) return;

          // Create mic audio track
          const micTrack = await AgoraRTC.createMicrophoneAudioTrack();
          localTrackRef.current = micTrack;
          if (isSessionStale()) return;

          // Join channel and publish
          await client.join(appId, channelName, token, agoraUid);
          if (isSessionStale()) return;
          await client.publish([micTrack]);
          joinedAndPublished = true;
        } catch (err) {
          const message = err?.message || '';
          const expectedTeardown = isSessionStale()
            || /PeerConnection already disconnected/i.test(message);

          if (expectedTeardown) return;

          console.error('[useAgoraCall] joinChannel failed:', err);
          setError(message || 'Failed to join call');
          setCallStateSafe('error');
          stopDurationTimer();
        } finally {
          if (!joinedAndPublished || isSessionStale()) {
            await cleanupLocalTrack();
            await cleanupClient();
          }
          if (joinTaskRef.current === task) {
            joinTaskRef.current = null;
          }
        }
      })();

      joinTaskRef.current = task;
      await task;
    },
    [startDurationTimer, stopDurationTimer, cleanupLocalTrack, cleanupClient, setCallStateSafe]
  );

  /**
   * Leave the current Agora channel and clean up resources.
   */
  const leaveChannel = useCallback(async () => {
    isLeavingRef.current = true;
    callSessionRef.current += 1;
    stopDurationTimer();
    if (joinTaskRef.current) {
      // Do not block user hang-up on an in-flight join task (token/mic/join can
      // stall on some mobile browsers). Mark this session stale and continue
      // teardown immediately so UI actions stay responsive.
      joinTaskRef.current.catch(() => {});
      joinTaskRef.current = null;
    }
    await cleanupLocalTrack();
    await cleanupClient();
    isLeavingRef.current = false;
    setCallStateSafe('ended');
    setRemoteUsers([]);
    setIsMuted(false);
  }, [stopDurationTimer, cleanupLocalTrack, cleanupClient, setCallStateSafe]);

  /**
   * Toggle microphone mute/unmute.
   */
  const toggleMute = useCallback(() => {
    if (!localTrackRef.current) return;
    const nextMuted = !isMuted;
    localTrackRef.current.setEnabled(!nextMuted);
    setIsMuted(nextMuted);
  }, [isMuted]);

  /**
   * Reset back to idle (e.g., after showing "call ended" state).
   */
  const resetCall = useCallback(() => {
    setCallStateSafe('idle');
    setError(null);
    setDuration(0);
    setRemoteUsers([]);
    setIsMuted(false);
    stopDurationTimer();
  }, [setCallStateSafe, stopDurationTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopDurationTimer();
      if (localTrackRef.current) {
        try {
          localTrackRef.current.stop();
          localTrackRef.current.close();
        } catch {
          // Best-effort cleanup.
        }
      }
      if (clientRef.current) {
        clientRef.current.leave().catch(() => {});
      }
    };
  }, [stopDurationTimer]);

  return {
    callState,
    isMuted,
    remoteUsers,
    error,
    duration,
    joinChannel,
    leaveChannel,
    toggleMute,
    resetCall,
  };
}
