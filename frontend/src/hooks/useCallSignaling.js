import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import api from '../services/api';

/**
 * Derive a deterministic Agora numeric UID (uint32) from a Firebase UID.
 * Agora UIDs must be non-negative integers in [0, 4294967295].
 * Same Firebase UID always maps to the same Agora UID across sessions.
 */
export function deriveAgoraUid(firebaseUid) {
  if (!firebaseUid) return 0;
  let hash = 5381;
  for (let i = 0; i < firebaseUid.length; i++) {
    hash = ((hash << 5) + hash) ^ firebaseUid.charCodeAt(i);
    hash = hash >>> 0; // keep as unsigned 32-bit
  }
  return hash % 4294967295;
}

/**
 * Firestore-based call signaling hook.
 *
 * Listens for incoming calls (documents in /calls where calleeId == currentUserId
 * and status == 'ringing'). Also provides helpers to initiate and update calls.
 *
 * @param {string|null} currentUserId - The authenticated user's Firebase UID
 */
export function useCallSignaling(currentUserId) {
  const [incomingCall, setIncomingCall] = useState(null);

  useEffect(() => {
    if (!currentUserId) {
      setIncomingCall(null);
      return;
    }

    const q = query(
      collection(db, 'calls'),
      where('calleeId', '==', currentUserId),
      where('status', '==', 'ringing')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty) {
          setIncomingCall(null);
          return;
        }
        // Pick the most recent ringing call
        const calls = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        calls.sort((a, b) => {
          const ta = a.createdAt?.seconds ?? 0;
          const tb = b.createdAt?.seconds ?? 0;
          return tb - ta;
        });
        setIncomingCall(calls[0]);
      },
      (err) => {
        console.warn('[useCallSignaling] listener error:', err);
        setIncomingCall(null);
      }
    );

    return () => unsubscribe();
  }, [currentUserId]);

  /**
   * Create a new call document (initiates the call).
   * Returns { callId, channelName }.
   */
  const initiateCall = useCallback(
    async ({ callerId, calleeId, callerName, calleeName, callType, contextId }) => {
      return api.calls.start({
        callerId,
        calleeId,
        callerName: callerName || 'User',
        calleeName: calleeName || 'User',
        callType,
        contextId,
      });
    },
    []
  );

  /**
   * Update a call's status (and optional extra fields).
   */
  const updateCallStatus = useCallback(async (callId, status, extra = {}) => {
    if (!callId || !status) return null;
    if (status === 'active') {
      return api.calls.answer(callId);
    }
    if (['ended', 'rejected', 'missed'].includes(status)) {
      return api.calls.end(callId, status, extra || {});
    }
    return null;
  }, []);

  const checkCallEligibility = useCallback(async ({ calleeId }) => {
    if (!calleeId) return { eligible: false, remainingSeconds: 0 };
    return api.calls.getEligibility(calleeId);
  }, []);

  return {
    incomingCall,
    initiateCall,
    updateCallStatus,
    checkCallEligibility,
  };
}
