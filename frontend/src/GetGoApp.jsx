/**
 * GetGo App - Refactored UI with new design system
 * This is the new main app component that uses the enhanced UI components
 * while preserving all existing Firebase functionality
 */

import React, { useMemo, useState, useEffect, useRef, useCallback, useLayoutEffect, Suspense, lazy } from 'react';
import { Loader2, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// Firestore Service
import {
  createCargoListing,
  updateCargoListing,
  createTruckListing,
  updateTruckListing,
  createBid,
  uploadListingPhotos,
  uploadTruckerComplianceDocument,
  acceptBid,
  rejectBid,
  reopenListing,
  markNotificationRead,
  markAllNotificationsRead,
} from './services/firestoreService';

// Firebase
import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db, waitForAppCheckInitialization, shouldInitializeAppCheck } from './firebase';

// Hooks
import { useAuth } from './contexts/AuthContext';
import { useCargoListings } from './hooks/useCargoListings';
import { useTruckListings } from './hooks/useTruckListings';
import { useNotifications } from './hooks/useNotifications';
import { useBidsOnMyListings, useMyBids } from './hooks/useBids';
import { useConversations } from './hooks/useConversations';
// Wallet removed - using direct GCash payment
import { useShipments } from './hooks/useShipments';
import { useTheme } from './hooks/useTheme';
import { useMarketplace } from './hooks/useMarketplace';
import { useModals } from './hooks/useModals';
import { useSocket } from './hooks/useSocket';
import { useAuthGuard } from './hooks/useAuthGuard';
import { useToast } from './contexts/ToastContext';
import { useBrokerOnboarding } from './hooks/useBrokerOnboarding';
import { usePWAInstall } from './hooks/usePWAInstall';
import { InAppBrowserOverlay } from '@/components/shared/InAppBrowserOverlay';
import { PWAInstallPrompt } from '@/components/shared/PWAInstallPrompt';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { buildAndroidIntentUrl } from './utils/browserDetect';
import { useCallSignaling, deriveAgoraUid } from './hooks/useCallSignaling';
import { IncomingCallBanner } from '@/components/call/IncomingCallBanner';
const CallModal = lazy(() => import('@/components/call/CallModal').then((m) => ({ default: m.CallModal })));

// Layout Components
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import { NotFoundView } from '@/components/shared/NotFoundView';

// View Components
const HomeView = lazy(() => import('@/views/HomeView'));
const TrackingView = lazy(() => import('@/views/TrackingView'));
const AdminPaymentsView = lazy(() => import('@/views/AdminPaymentsView'));
const ContractVerificationView = lazy(() => import('@/views/ContractVerificationView')
  .then((module) => ({ default: module.ContractVerificationView })));
const ContractsView = lazy(() => import('@/views/ContractsView'));
const BidsView = lazy(() => import('@/views/BidsView'));
const ChatView = lazy(() => import('@/views/ChatView'));
const BrokerView = lazy(() => import('@/views/BrokerView'));
const NotificationsView = lazy(() => import('@/views/NotificationsView'));
const ProfilePage = lazy(() => import('@/components/profile/ProfilePage'));
const AdminDashboard = lazy(() => import('@/views/admin/AdminDashboard'));
const ActivityView = lazy(() => import('@/views/ActivityView'));
const HelpSupportView = lazy(() => import('@/views/HelpSupportView'));

// Modal Components
const PostModal = lazy(() => import('@/components/modals/PostModal'));
const BidModal = lazy(() => import('@/components/modals/BidModal'));
const CargoDetailsModal = lazy(() => import('@/components/modals/CargoDetailsModal'));
const TruckDetailsModal = lazy(() => import('@/components/modals/TruckDetailsModal'));
const ChatModal = lazy(() => import('@/components/modals/ChatModal'));
const MyBidsModal = lazy(() => import('@/components/modals/MyBidsModal'));
const RatingModal = lazy(() => import('@/components/modals/RatingModal'));
const GCashPaymentModal = lazy(() => import('@/components/modals/GCashPaymentModal'));
const RouteOptimizerModal = lazy(() => import('@/components/modals/RouteOptimizerModal'));
const ContractModal = lazy(() => import('@/components/modals/ContractModal'));
import ReferListingModal from '@/components/broker/ReferListingModal';
const FullMapModal = lazy(() => import('@/components/maps/FullMapModal'));
import AuthModal from '@/components/auth/AuthModal';
import { OnboardingGuideModal } from '@/components/modals/OnboardingGuideModal';
import { BrokerOnboardingGuideModal } from '@/components/broker/BrokerOnboardingGuideModal';
import LegalModal from '@/components/legal/LegalModal';

// API
import api from './services/api';
import { trackAnalyticsEvent } from './services/analyticsService';
import { guestCargoListings, guestTruckListings, guestActiveShipments } from '@/data/guestMarketplaceData';
import { canBidCargoStatus, canBookTruckStatus, matchesMarketplaceFilter, normalizeListingStatus, toTruckUiStatus } from '@/utils/listingStatus';
import { sortEntitiesNewestFirst } from '@/utils/activitySorting';
import { isPermissionDeniedError, reportFirestoreListenerError } from '@/utils/firebaseErrors';
import {
  WORKSPACE_ROLES,
  normalizeWorkspaceRole,
  resolveEffectivePostingRole,
  inferBidPerspectiveRole,
  inferConversationPerspectiveRole,
  inferContractPerspectiveRole,
  inferNotificationWorkspaceRole,
  resolveBidListingType,
} from '@/utils/workspace';
import { isChatNotificationType, sanitizeMessage } from '@/utils/messageUtils';
import { isActiveBidStatus, normalizeBidStatus } from '@/utils/bidStatus';

const SAVED_SEARCHES_KEY_PREFIX = 'karga.savedSearches.v1';
const SAVED_ROUTES_KEY_PREFIX = 'karga.savedRoutes.v1';
const ONBOARDING_DISMISSED_KEY_PREFIX = 'karga.onboardingDismissed.v1';
const INSTALL_STATUS_TOAST_COOLDOWN_MS = 2500;
const TERMINAL_CALL_STATUSES = new Set(['ended', 'rejected', 'missed']);
const INCOMING_RINGTONE_SRC = '/sounds/incoming-call.wav';
const INCOMING_VIBRATION_PATTERN = [350, 180, 350, 480];
const INCOMING_VIBRATION_REPEAT_MS = 2000;
const CALL_ELIGIBILITY_CACHE_TTL_MS = 60 * 1000;

function getUserScopedKey(prefix, uid) {
  return `${prefix}:${uid || 'guest'}`;
}

function getOnboardingDismissedKey(uid) {
  return `${ONBOARDING_DISMISSED_KEY_PREFIX}:${uid || 'guest'}`;
}

export default function GetGoApp() {
  // Firebase Auth
  const {
    authUser,
    userProfile,
    shipperProfile,
    truckerProfile,
    truckerCompliance,
    currentRole,
    brokerProfile,
    isBroker,
    logout,
    isAdmin,
    referralAttributionEvent,
    clearReferralAttributionEvent,
  } = useAuth();
  const showToast = useToast();

  const canSubscribeUserData = Boolean(authUser?.uid && userProfile);
  const activeUserId = canSubscribeUserData ? authUser.uid : null;

  const [appCheckReady, setAppCheckReady] = React.useState(!shouldInitializeAppCheck);
  useEffect(() => {
    if (shouldInitializeAppCheck) {
      waitForAppCheckInitialization(4000).then(() => setAppCheckReady(true));
    }
  }, []);

  const authUserForDataHooks = canSubscribeUserData && appCheckReady ? authUser : null;

  // Custom Hooks for UI State
  const { darkMode, toggleDarkMode } = useTheme();
  const {
    activeTab,
    setActiveTab,
    activeMarket,
    setActiveMarket,
    workspaceRole,
    setWorkspaceRole,
    filterStatus,
    setFilterStatus,
    searchQuery,
    setSearchQuery,
  } = useMarketplace('home', 'cargo', normalizeWorkspaceRole(currentRole || 'shipper'));
  const { modals, openModal, closeModal, getModalData } = useModals();
  const bidModalData = getModalData('bid');
  const mapModalData = getModalData('map');
  const cargoDetailsData = getModalData('cargoDetails');
  const truckDetailsData = getModalData('truckDetails');
  const chatModalData = getModalData('chat');
  const routeOptimizerData = getModalData('routeOptimizer');
  const referListingData = getModalData('referListing');
  const platformFeeData = getModalData('platformFee');
  const contractModalData = getModalData('contract');
  const editCargoData = getModalData('editCargo');
  const editTruckData = getModalData('editTruck');

  const shouldSubscribeListings = appCheckReady && (activeTab === 'home' || activeTab === 'activity' || activeTab === 'broker');
  const shouldSubscribeNotifications = appCheckReady && Boolean(activeUserId);
  const shouldSubscribeBids = appCheckReady && (activeTab === 'bids' || modals.bid || modals.cargoDetails || modals.truckDetails || modals.myBids);
  const shouldSubscribeOwnerListingBids = appCheckReady
    && activeTab === 'home'
    && Boolean(activeUserId)
    && ['shipper', 'trucker'].includes(workspaceRole);
  const shouldSubscribeConversations = appCheckReady && Boolean(activeUserId);
  const shouldSubscribeShipments = appCheckReady && (activeTab === 'tracking' || activeTab === 'contracts' || activeTab === 'activity');

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.debug('[listener-gating]', {
      activeTab,
      listings: shouldSubscribeListings,
      notifications: shouldSubscribeNotifications,
      bids: shouldSubscribeBids,
      conversations: shouldSubscribeConversations,
      shipments: shouldSubscribeShipments,
    });
  }, [
    activeTab,
    shouldSubscribeListings,
    shouldSubscribeNotifications,
    shouldSubscribeBids,
    shouldSubscribeConversations,
    shouldSubscribeShipments,
  ]);

  // Firebase Data Hooks - tab-scoped listener gating to protect first-interaction speed.
  const { listings: firebaseCargoListings } = useCargoListings({
    authUser: authUserForDataHooks,
    enabled: shouldSubscribeListings,
  });
  const { listings: firebaseTruckListings } = useTruckListings({
    authUser: authUserForDataHooks,
    enabled: shouldSubscribeListings,
  });
  const { notifications: firebaseNotifications } = useNotifications(activeUserId, 50, shouldSubscribeNotifications);
  const { bids: myBids } = useMyBids(activeUserId, shouldSubscribeBids);
  const { bids: ownerListingBids } = useBidsOnMyListings(activeUserId, shouldSubscribeOwnerListingBids);
  const { conversations, loading: conversationsLoading } = useConversations(activeUserId, shouldSubscribeConversations);
  const {
    shipments: firebaseShipments,
    activeShipments: firebaseActiveShipments,
    deliveredShipments: firebaseDeliveredShipments,
  } = useShipments(activeUserId, shouldSubscribeShipments);

  // Socket.io for instant notifications
  const {
    isConnected: socketConnected,
    notifications: socketNotifications,
    emitBid,
    emitShipmentUpdate,
    clearNotification,
  } = useSocket(activeUserId);

  // Voice Call Signaling
  const { incomingCall, initiateCall, updateCallStatus, checkCallEligibility } = useCallSignaling(activeUserId);
  const [activeCall, setActiveCall] = useState(null);
  const [pendingCallRequest, setPendingCallRequest] = useState(null);
  // activeCall: { callId, channelName, agoraUid, otherPartyName, otherPartyId, isOutgoing, status } | null
  const [callEligibilityByUser, setCallEligibilityByUser] = useState({});
  const callToastKeysRef = useRef(new Set());
  const incomingChatAutoClosedCallIdRef = useRef(null);
  const incomingRingtoneRef = useRef(null);
  const incomingVibrationIntervalRef = useRef(null);
  const canTriggerVibration = useCallback(() => {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
    const activation = navigator.userActivation;
    if (!activation) return true;
    return Boolean(activation.hasBeenActive || activation.isActive);
  }, []);

  const isCallQuotaError = useCallback((err) => {
    const code = String(err?.code || '').toLowerCase();
    return code.includes('resource-exhausted');
  }, []);

  const upsertCallEligibility = useCallback((otherUserId, eligible, checkedAtMs = Date.now()) => {
    const normalizedUserId = typeof otherUserId === 'string' ? otherUserId.trim() : '';
    if (!normalizedUserId) return;
    setCallEligibilityByUser((prev) => ({
      ...prev,
      [normalizedUserId]: {
        eligible: Boolean(eligible),
        checkedAtMs,
      },
    }));
  }, []);

  const isCallDisabled = useCallback((otherUserId) => {
    const normalizedUserId = typeof otherUserId === 'string' ? otherUserId.trim() : '';
    if (!normalizedUserId) return true;
    const cached = callEligibilityByUser[normalizedUserId];
    return cached ? cached.eligible === false : false;
  }, [callEligibilityByUser]);

  const ensureCallEligibility = useCallback(
    async (otherUserId, { force = false } = {}) => {
      const normalizedUserId = typeof otherUserId === 'string' ? otherUserId.trim() : '';
      if (!authUser?.uid || !normalizedUserId || normalizedUserId === authUser.uid) return false;

      const nowMs = Date.now();
      const cached = callEligibilityByUser[normalizedUserId];
      const isFresh = cached && (nowMs - cached.checkedAtMs) < CALL_ELIGIBILITY_CACHE_TTL_MS;
      if (!force && isFresh) {
        return cached.eligible !== false;
      }

      try {
        const eligibility = await checkCallEligibility({ calleeId: normalizedUserId });
        const eligible = eligibility?.eligible !== false;
        upsertCallEligibility(normalizedUserId, eligible, nowMs);
        return eligible;
      } catch (err) {
        if (isCallQuotaError(err)) {
          upsertCallEligibility(normalizedUserId, false, nowMs);
          return false;
        }
        // Fail open for transient eligibility lookup errors to avoid blocking valid calls.
        return true;
      }
    },
    [authUser?.uid, callEligibilityByUser, checkCallEligibility, upsertCallEligibility, isCallQuotaError]
  );

  useEffect(() => {
    setCallEligibilityByUser({});
  }, [authUser?.uid]);

  useEffect(() => {
    const callerId = typeof incomingCall?.callerId === 'string' ? incomingCall.callerId.trim() : '';
    if (!callerId || typeof ensureCallEligibility !== 'function') return;
    ensureCallEligibility(callerId).catch(() => {});
  }, [incomingCall?.id, incomingCall?.callerId, ensureCallEligibility]);

  const notifyCallStatus = useCallback((callId, status) => {
    if (!callId || !status) return;
    const key = `${callId}:${status}`;
    if (callToastKeysRef.current.has(key)) return;
    callToastKeysRef.current.add(key);

    if (status === 'ended') {
      showToast({ type: 'info', title: 'Call ended', message: '' });
    } else if (status === 'missed') {
      showToast({ type: 'info', title: 'No answer', message: 'The call was not answered.' });
    } else if (status === 'rejected') {
      showToast({ type: 'info', title: 'Call declined', message: '' });
    }
  }, [showToast]);

  const stopIncomingCallAlerts = useCallback(() => {
    if (incomingVibrationIntervalRef.current) {
      clearInterval(incomingVibrationIntervalRef.current);
      incomingVibrationIntervalRef.current = null;
    }

    if (canTriggerVibration()) {
      navigator.vibrate(0);
    }

    const audio = incomingRingtoneRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  }, [canTriggerVibration]);

  const startIncomingCallAlerts = useCallback(() => {
    const audio = incomingRingtoneRef.current;
    if (audio) {
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((err) => {
          // Autoplay may be blocked before user interaction; keep silent fallback.
          console.debug('[incoming-call] ringtone playback blocked:', err?.message || err);
        });
      }
    }

    if (canTriggerVibration()) {
      navigator.vibrate(INCOMING_VIBRATION_PATTERN);
      if (!incomingVibrationIntervalRef.current) {
        incomingVibrationIntervalRef.current = setInterval(() => {
          if (!canTriggerVibration()) return;
          navigator.vibrate(INCOMING_VIBRATION_PATTERN);
        }, INCOMING_VIBRATION_REPEAT_MS);
      }
    }
  }, [canTriggerVibration]);

  useEffect(() => {
    const audio = new Audio();
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 1;
    let cancelled = false;
    let objectUrl = null;

    const primeIncomingRingtone = async () => {
      try {
        const response = await fetch(INCOMING_RINGTONE_SRC, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`Incoming ringtone fetch failed with status ${response.status}`);
        }

        const blob = await response.blob();
        if (cancelled) return;

        objectUrl = URL.createObjectURL(blob);
        audio.src = objectUrl;
        audio.load();
      } catch (error) {
        // Fallback to direct URL if blob prefetch fails in some browsers.
        audio.src = INCOMING_RINGTONE_SRC;
        audio.load();
        console.debug('[incoming-call] ringtone prefetch fallback:', error?.message || error);
      }
    };

    void primeIncomingRingtone();
    incomingRingtoneRef.current = audio;

    return () => {
      cancelled = true;
      stopIncomingCallAlerts();
      incomingRingtoneRef.current = null;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [stopIncomingCallAlerts]);

  useEffect(() => {
    const shouldPlayIncomingAlerts = Boolean(incomingCall?.id) && !activeCall?.callId;
    if (shouldPlayIncomingAlerts) {
      startIncomingCallAlerts();
      return;
    }
    stopIncomingCallAlerts();
  }, [incomingCall?.id, activeCall?.callId, startIncomingCallAlerts, stopIncomingCallAlerts]);

  useEffect(() => {
    const incomingCallId = incomingCall?.id;
    if (!incomingCallId) return;
    if (activeCall?.callId) return;
    if (!modals.chat) return;
    if (incomingChatAutoClosedCallIdRef.current === incomingCallId) return;

    incomingChatAutoClosedCallIdRef.current = incomingCallId;
    closeModal('chat');
  }, [incomingCall?.id, activeCall?.callId, modals.chat, closeModal]);

  // If a call starts while chat is open (caller side), close chat so call controls
  // are never blocked by the modal layer.
  useEffect(() => {
    if (!activeCall?.callId) return;
    if (!modals.chat) return;
    closeModal('chat');
  }, [activeCall?.callId, modals.chat, closeModal]);

  const startCallSession = useCallback(
    async ({ calleeId, calleeName, callType, contextId }) => {
      if (!authUser?.uid || !calleeId || activeCall) return;

      const canStartCall = await ensureCallEligibility(calleeId);
      if (!canStartCall) return;

      try {
        const callerName = authUser.displayName || userProfile?.name || 'User';
        const { callId, channelName } = await initiateCall({
          callerId: authUser.uid,
          calleeId,
          callerName,
          calleeName,
          callType,
          contextId,
        });
        setActiveCall({
          callId,
          channelName,
          agoraUid: deriveAgoraUid(authUser.uid),
          otherPartyName: calleeName,
          otherPartyId: calleeId,
          isOutgoing: true,
          status: 'ringing',
        });
        upsertCallEligibility(calleeId, true);
      } catch (err) {
        if (isCallQuotaError(err)) {
          upsertCallEligibility(calleeId, false);
          return;
        }
        console.error('[handleInitiateCall] failed:', err);
        showToast({ type: 'error', title: 'Could not start call', message: err.message || '' });
      }
    },
    [authUser, userProfile, activeCall, initiateCall, ensureCallEligibility, upsertCallEligibility, isCallQuotaError, showToast]
  );

  const handleInitiateCall = useCallback(
    ({ calleeId, calleeName, callType, contextId }) => {
      if (!authUser?.uid || !calleeId || activeCall) return;
      setPendingCallRequest({
        calleeId,
        calleeName,
        callType,
        contextId,
      });
    },
    [authUser?.uid, activeCall]
  );

  const handleConfirmPendingCall = useCallback(async () => {
    const request = pendingCallRequest;
    if (!request) return;
    setPendingCallRequest(null);
    await startCallSession(request);
  }, [pendingCallRequest, startCallSession]);

  const handleCancelPendingCall = useCallback(() => {
    setPendingCallRequest(null);
  }, []);

  const handleAcceptCall = useCallback(
    async (call) => {
      if (!authUser?.uid) {
        showToast({
          type: 'error',
          title: 'Unable to answer call',
          message: 'Please sign in again and try answering the call.',
        });
        return;
      }
      if (activeCall) {
        showToast({
          type: 'info',
          title: 'Call already in progress',
          message: 'End the current call before answering another one.',
        });
        return;
      }
      if (!call?.id) {
        showToast({
          type: 'error',
          title: 'Unable to answer call',
          message: 'Call session could not be found.',
        });
        return;
      }
      if (isCallDisabled(call?.callerId)) {
        return;
      }
      try {
        stopIncomingCallAlerts();
        await updateCallStatus(call.id, 'active');
        setActiveCall({
          callId: call.id,
          channelName: call.channelName,
          agoraUid: deriveAgoraUid(authUser.uid),
          otherPartyName: call.callerName,
          otherPartyId: call.callerId,
          isOutgoing: false,
          status: 'active',
        });
      } catch (err) {
        if (isCallQuotaError(err)) {
          upsertCallEligibility(call?.callerId, false);
          return;
        }
        console.error('[handleAcceptCall] failed:', err);
        showToast({
          type: 'error',
          title: 'Could not answer call',
          message: err?.message || 'Please try again.',
        });
      }
    },
    [authUser, activeCall, isCallDisabled, stopIncomingCallAlerts, updateCallStatus, isCallQuotaError, showToast, upsertCallEligibility]
  );

  const handleDeclineCall = useCallback(
    async (call) => {
      if (!call?.id) {
        showToast({
          type: 'error',
          title: 'Unable to decline call',
          message: 'Call session could not be found.',
        });
        return;
      }
      try {
        stopIncomingCallAlerts();
        await updateCallStatus(call.id, 'rejected');
      } catch (err) {
        console.error('[handleDeclineCall] failed:', err);
        showToast({
          type: 'error',
          title: 'Could not decline call',
          message: err?.message || 'Please try again.',
        });
      }
    },
    [stopIncomingCallAlerts, updateCallStatus, showToast]
  );

  // Keep local call state in sync with Firestore status and close when terminal.
  useEffect(() => {
    if (!activeCall?.callId) return undefined;

    const subscribedCallId = activeCall.callId;
    const callRef = doc(db, 'calls', subscribedCallId);
    const unsubscribe = onSnapshot(
      callRef,
      (snap) => {
        if (!snap.exists()) {
          setActiveCall((prev) => (prev?.callId === subscribedCallId ? null : prev));
          notifyCallStatus(subscribedCallId, 'ended');
          return;
        }

        const data = snap.data() || {};
        const nextStatus = typeof data.status === 'string' ? data.status : null;
        if (!nextStatus) return;

        const otherPartyId = data.callerId === authUser?.uid ? data.calleeId : data.callerId;

        setActiveCall((prev) => {
          if (!prev || prev.callId !== subscribedCallId) return prev;
          if (prev.status === nextStatus) return prev;
          return { ...prev, status: nextStatus };
        });

        if (TERMINAL_CALL_STATUSES.has(nextStatus)) {
          if (otherPartyId) {
            ensureCallEligibility(otherPartyId, { force: true }).catch(() => {});
          }
          setActiveCall((prev) => (prev?.callId === subscribedCallId ? null : prev));
          notifyCallStatus(subscribedCallId, nextStatus);
        }
      },
      (err) => {
        console.warn('[call-status-listener] failed:', err);
      }
    );

    return () => unsubscribe();
  }, [activeCall?.callId, authUser?.uid, ensureCallEligibility, notifyCallStatus]);

  // Outgoing no-answer timeout should be based on signaling status, not local SDK state.
  useEffect(() => {
    if (!activeCall?.callId || !activeCall.isOutgoing) return undefined;
    if (activeCall.status !== 'ringing') return undefined;

    const timeout = setTimeout(async () => {
      try {
        await updateCallStatus(activeCall.callId, 'missed');
      } catch (err) {
        console.error('[outgoing-call-timeout] failed to mark missed:', err);
      }
    }, 30000);

    return () => clearTimeout(timeout);
  }, [activeCall?.callId, activeCall?.isOutgoing, activeCall?.status, updateCallStatus]);

  const handleCallClose = useCallback(
    (reason) => {
      stopIncomingCallAlerts();
      const closingCallId = activeCall?.callId;
      const closingOtherPartyId = activeCall?.otherPartyId;
      setActiveCall(null);
      if (closingOtherPartyId) {
        ensureCallEligibility(closingOtherPartyId, { force: true }).catch(() => {});
      }
      if (reason === 'ended' || reason === 'missed' || reason === 'rejected') {
        notifyCallStatus(closingCallId, reason);
      }
    },
    [activeCall?.callId, activeCall?.otherPartyId, ensureCallEligibility, notifyCallStatus, stopIncomingCallAlerts]
  );

  // Broker Onboarding & Re-engagement
  const {
    shouldShowHomeCard: shouldShowBrokerCard,
    shouldShowBrokerGuide,
    dismissHomeCard: handleDismissBrokerCard,
    markConverted: handleBrokerConverted,
    markOnboardingDeclined: handleBrokerOnboardingDeclined,
    markBrokerGuideCompleted,
    activateTrigger,
  } = useBrokerOnboarding(activeUserId, isBroker);

  // Auth Guard for protected actions
  const {
    requireAuth,
    showAuthModal,
    setShowAuthModal,
    pendingActionTitle,
    executePendingAction,
    clearPendingAction,
  } = useAuthGuard();

  // Mobile header scroll-to-hide for Home tab, hidden for other tabs
  // Use hysteresis so header hide/show feels stable with nested sticky controls.
  const HEADER_TOP_RESET = 8;
  const HEADER_HIDE_SCROLL_MIN = 40;
  const HEADER_HIDE_DOWN_THRESHOLD = 18;
  const HEADER_SHOW_UP_THRESHOLD = 18;
  const HEADER_DIRECTION_DELTA = 2;
  const HEADER_REVEAL_LOCK_MS = 180;
  const headerRef = useRef(null);
  const lastScrollY = useRef(0);
  const downScrollDistance = useRef(0);
  const upScrollDistance = useRef(0);
  const revealLockUntil = useRef(0);
  const [mobileHeaderVisible, setMobileHeaderVisible] = useState(true);
  const [mobileHeaderHeight, setMobileHeaderHeight] = useState(74);

  const handleHomeScroll = useCallback((e) => {
    const scrollTop = e.currentTarget?.scrollTop ?? e.target?.scrollTop ?? 0;
    const delta = scrollTop - lastScrollY.current;

    if (scrollTop <= HEADER_TOP_RESET) {
      if (!mobileHeaderVisible) {
        setMobileHeaderVisible(true);
      }
      lastScrollY.current = scrollTop;
      downScrollDistance.current = 0;
      upScrollDistance.current = 0;
      revealLockUntil.current = 0;
      return;
    }

    if (delta > HEADER_DIRECTION_DELTA) {
      downScrollDistance.current += delta;
      upScrollDistance.current = 0;

      if (
        mobileHeaderVisible
        && scrollTop > HEADER_HIDE_SCROLL_MIN
        && (
          downScrollDistance.current >= HEADER_HIDE_DOWN_THRESHOLD
          || scrollTop >= HEADER_HIDE_SCROLL_MIN + 36
        )
      ) {
        setMobileHeaderVisible(false);
        revealLockUntil.current = Date.now() + HEADER_REVEAL_LOCK_MS;
        downScrollDistance.current = 0;
      }
    } else if (delta < -HEADER_DIRECTION_DELTA) {
      if (Date.now() < revealLockUntil.current) {
        lastScrollY.current = scrollTop;
        return;
      }

      upScrollDistance.current += Math.abs(delta);
      downScrollDistance.current = 0;

      if (!mobileHeaderVisible && upScrollDistance.current >= HEADER_SHOW_UP_THRESHOLD) {
        setMobileHeaderVisible(true);
        upScrollDistance.current = 0;
      }
    }

    lastScrollY.current = scrollTop;
  }, [mobileHeaderVisible]);

  const showMobileHeader = activeTab === 'home' ? mobileHeaderVisible : false;

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const mobileQuery = window.matchMedia('(max-width: 1023px)');
    let rafId = null;

    const measureHeaderHeight = () => {
      if (!mobileQuery.matches) {
        setMobileHeaderHeight(74);
        return;
      }

      const measuredHeight = headerRef.current?.getBoundingClientRect().height;
      const nextHeight = Number.isFinite(measuredHeight) && measuredHeight > 0 ? measuredHeight : 74;
      setMobileHeaderHeight((prev) => (Math.abs(prev - nextHeight) > 0.5 ? nextHeight : prev));
    };

    const scheduleMeasure = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      rafId = window.requestAnimationFrame(measureHeaderHeight);
    };

    scheduleMeasure();

    let resizeObserver;
    if (typeof window.ResizeObserver !== 'undefined' && headerRef.current) {
      resizeObserver = new window.ResizeObserver(() => {
        scheduleMeasure();
      });
      resizeObserver.observe(headerRef.current);
    }

    const handleViewportChange = () => scheduleMeasure();
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', handleViewportChange);
    if (mobileQuery.addEventListener) {
      mobileQuery.addEventListener('change', handleViewportChange);
    } else {
      mobileQuery.addListener(handleViewportChange);
    }

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('orientationchange', handleViewportChange);
      if (mobileQuery.removeEventListener) {
        mobileQuery.removeEventListener('change', handleViewportChange);
      } else {
        mobileQuery.removeListener(handleViewportChange);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, []);

  // Reset mobile header when switching to home tab
  useEffect(() => {
    if (activeTab === 'home') {
      setMobileHeaderVisible(true);
      lastScrollY.current = 0;
      downScrollDistance.current = 0;
      upScrollDistance.current = 0;
      revealLockUntil.current = 0;
    }
  }, [activeTab]);

  // Keep header visible when marketplace controls change.
  useEffect(() => {
    setMobileHeaderVisible(true);
    lastScrollY.current = 0;
    downScrollDistance.current = 0;
    upScrollDistance.current = 0;
    revealLockUntil.current = 0;
  }, [activeMarket, filterStatus, searchQuery]);

  // When switching markets, also reset the filter so filter pills start fresh
  const handleMarketChange = useCallback((market) => {
    setActiveMarket(market);
    setFilterStatus('all');
  }, [setActiveMarket, setFilterStatus]);

  // PWA Install Prompt
  const {
    showInAppOverlay,
    inAppBrowserName,
    platform,
    showInstallBanner,
    triggerInstall,
    dismissInstallBanner,
    showIOSInstall,
    dismissIOSInstall,
    launchInstallFromProfile,
    showInstallModal,
    openInstallModal,
    dismissInstallModal,
    isInstallAlreadySatisfied,
    isInstallEngagementReached,
    markEngagement,
    resetInstallCooldownOnMilestone,
  } = usePWAInstall();

  // Loading states for form submissions
  const [postLoading, setPostLoading] = useState(false);
  const [bidLoading, setBidLoading] = useState(false);
  const [contractLoading, setContractLoading] = useState(false);

  // Pending contract data (after fee payment)
  const [pendingContractData, setPendingContractData] = useState(null);

  // Wallet removed - direct GCash payment flow

  // Admin: preserve last non-admin tab so "Back to App" returns users to context.
  const lastNonAdminTabRef = useRef('home');
  const installStatusToastRef = useRef({ key: '', shownAt: 0 });

  // Onboarding Guide Modal
  const [showOnboardingGuide, setShowOnboardingGuide] = useState(false);
  // null = not loaded yet for current user (prevents race-triggered auto-open)
  const [onboardingDismissedLocally, setOnboardingDismissedLocally] = useState(null);

  // Broker Onboarding Guide Modal
  const [showBrokerGuide, setShowBrokerGuide] = useState(false);

  // Legal Modal (for auth screens)
  const [legalModal, setLegalModal] = useState({ open: false, type: null });

  // Admin: Pending payments count
  const [pendingPaymentsCount, setPendingPaymentsCount] = useState(0);

  // Contracts state
  const [contracts, setContracts] = useState([]);
  const [, setContractsLoading] = useState(false);
  const [contractFilter, setContractFilter] = useState('all');

  // Toast notifications via context
  const [ratingTarget, setRatingTarget] = useState(null);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [savedSearches, setSavedSearches] = useState([]);
  const [savedRoutes, setSavedRoutes] = useState([]);

  useEffect(() => {
    if (activeTab !== 'admin') {
      lastNonAdminTabRef.current = activeTab;
    }
  }, [activeTab]);

  useEffect(() => {
    trackAnalyticsEvent('session_start', {
      initial_tab: activeTab,
      has_authenticated_user: !!authUser?.uid,
    });
    // Fire once per app load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === 'profile') {
      trackAnalyticsEvent('profile_open', {
        role: currentRole || 'shipper',
      });
    }
  }, [activeTab, currentRole]);

  const showInstallStatusToast = useCallback((key, title, message) => {
    const now = Date.now();
    const last = installStatusToastRef.current;
    if (last.key === key && now - last.shownAt < INSTALL_STATUS_TOAST_COOLDOWN_MS) {
      return;
    }
    installStatusToastRef.current = { key, shownAt: now };
    showToast({ title, message });
  }, [showToast]);

  const handleProfileInstallClick = useCallback(async () => {
    trackAnalyticsEvent('install_clicked', { source: 'profile_button' });
    const status = await launchInstallFromProfile();
    if (status === 'already_installed') {
      showInstallStatusToast(
        'already_installed',
        'Already installed',
        'GetGo is already installed on this device.'
      );
      return;
    }
    if (status === 'in_app_browser') {
      showInstallStatusToast(
        'in_app_browser',
        'Open in browser',
        'Open this page in Safari or Chrome to install GetGo.'
      );
      return;
    }
    if (status === 'not_available') {
      showInstallStatusToast(
        'not_available',
        'Install not available',
        'Install prompt is not available yet. Try again in a moment.'
      );
    }
  }, [launchInstallFromProfile, showInstallStatusToast]);

  const [installModalInstalling, setInstallModalInstalling] = useState(false);

  const handleInstallModalInstall = useCallback(async () => {
    setInstallModalInstalling(true);
    try {
      const status = await launchInstallFromProfile();
      if (status === 'prompt_shown') {
        return;
      }
      if (status === 'ios_sheet_opened') {
        dismissInstallModal();
        return;
      }
      if (status === 'in_app_browser') {
        dismissInstallModal();
        showInstallStatusToast(
          'in_app_browser',
          'Open in browser',
          'Open this page in Safari or Chrome to install GetGo.'
        );
        return;
      }
      if (status === 'already_installed') {
        dismissInstallModal();
        showInstallStatusToast('already_installed', 'Already installed', 'GetGo is already installed on this device.');
        return;
      }
      if (status === 'not_available') {
        showInstallStatusToast('not_available', 'Install not available', 'Your browser may not support app installation. Try Chrome.');
      }
    } finally {
      setInstallModalInstalling(false);
    }
  }, [launchInstallFromProfile, dismissInstallModal, showInstallStatusToast]);

  const handleDismissInstallBanner = useCallback(() => {
    dismissInstallBanner();
    showToast({
      title: 'Tip',
      message: 'I-tap ang profile mo para ma-install anytime.',
    });
  }, [dismissInstallBanner, showToast]);


  const getUserErrorMessage = (error, fallback) => {
    const code = String(error?.code || '').toLowerCase();
    const message = String(error?.message || '').toLowerCase();
    const reason = String(error?.details?.reason || '').toLowerCase();

    if (reason === 'missing-required-trucker-documents') {
      const missingDocs = Array.isArray(error?.details?.missingDocs)
        ? error.details.missingDocs
        : [];
      const labelByField = {
        driverLicenseCopy: 'Driver License Copy',
        ltoRegistrationCopy: 'LTO Certificate of Registration Copy',
      };
      const labels = missingDocs
        .map((item) => labelByField[item?.field] || item?.field)
        .filter(Boolean);
      if (labels.length > 0) {
        return `Required before signing: ${labels.join(', ')}.`;
      }
      return 'Driver License Copy and LTO Certificate of Registration Copy are required before signing this contract.';
    }
    if (reason === 'trucker-cancellation-limit-reached') {
      const blockUntil = error?.details?.blockUntil ? new Date(error.details.blockUntil) : null;
      if (blockUntil && !Number.isNaN(blockUntil.getTime())) {
        return `Contract signing is temporarily blocked due to frequent cancellations. Try again after ${blockUntil.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}.`;
      }
      return 'Contract signing is temporarily blocked due to frequent cancellations.';
    }
    if (reason === 'self-referral-not-allowed' || message.includes('self-referral')) {
      return 'You cannot use your own referral code. Use a referral code from a different broker.';
    }
    if (code.includes('platform-fee-cap-exceeded') || code.includes('resource-exhausted') || message.includes('exceed allowed cap')) {
      return 'Cannot accept this bid yet because the projected outstanding platform fees exceed the allowed cap.';
    }
    if (code.includes('payer-account-restricted') || message.includes('fee payer account is restricted')) {
      return 'Cannot accept this bid because the fee payer account is currently restricted.';
    }
    if (code.includes('failed-precondition')) {
      return 'This action cannot be completed in the current state. Please refresh and try again.';
    }
    if (code.includes('permission-denied') || message.includes('permission') || message.includes('unauthorized')) {
      return 'You do not have permission for this action. Please refresh and sign in again.';
    }
    if (code.includes('unavailable') || message.includes('network') || message.includes('failed to fetch')) {
      return 'Network issue detected. Please check your connection and try again.';
    }
    if (code.includes('deadline-exceeded') || message.includes('timeout')) {
      return 'Request timed out. Please try again.';
    }
    if (code.includes('not-found') || message.includes('not found')) {
      return 'The requested item is no longer available.';
    }
    if (code.includes('already-exists') || message.includes('already exists')) {
      return 'This action was already completed.';
    }
    return fallback;
  };

  const isNotificationRead = (notification) => notification?.isRead === true || notification?.read === true;

  // Handle socket notifications
  useEffect(() => {
    if (socketNotifications.length > 0) {
      const latestNotification = socketNotifications[0];
      const toastMessage = isChatNotificationType(latestNotification?.type)
        ? sanitizeMessage(latestNotification?.message || '')
        : latestNotification?.message;
      showToast({
        type: latestNotification.type,
        title: latestNotification.title,
        message: toastMessage,
      });
      // Clear the notification from socket state
      clearNotification(latestNotification.id);
    }
  }, [socketNotifications, clearNotification, showToast]);

  useEffect(() => {
    if (!referralAttributionEvent) return;

    if (referralAttributionEvent.status === 'success') {
      showToast({
        type: 'bid-accepted',
        title: 'Referral Linked',
        message: referralAttributionEvent.message || 'Referral code linked successfully.',
      });
    } else if (referralAttributionEvent.status === 'failed') {
      showToast({
        type: 'error',
        title: 'Referral Pending',
        message: referralAttributionEvent.message || 'Could not link referral code yet.',
      });
    }

    clearReferralAttributionEvent?.();
  }, [clearReferralAttributionEvent, referralAttributionEvent, showToast]);

  // Load saved marketplace artifacts by user scope
  useEffect(() => {
    const savedSearchesKey = getUserScopedKey(SAVED_SEARCHES_KEY_PREFIX, authUser?.uid);
    const savedRoutesKey = getUserScopedKey(SAVED_ROUTES_KEY_PREFIX, authUser?.uid);

    try {
      const searchesRaw = window.localStorage.getItem(savedSearchesKey);
      const routesRaw = window.localStorage.getItem(savedRoutesKey);
      setSavedSearches(searchesRaw ? JSON.parse(searchesRaw) : []);
      setSavedRoutes(routesRaw ? JSON.parse(routesRaw) : []);
    } catch (error) {
      console.error('Failed to load saved searches/routes:', error);
      setSavedSearches([]);
      setSavedRoutes([]);
    }
  }, [authUser?.uid]);

  useEffect(() => {
    const key = getUserScopedKey(SAVED_SEARCHES_KEY_PREFIX, authUser?.uid);
    window.localStorage.setItem(key, JSON.stringify(savedSearches.slice(0, 20)));
  }, [savedSearches, authUser?.uid]);

  useEffect(() => {
    const key = getUserScopedKey(SAVED_ROUTES_KEY_PREFIX, authUser?.uid);
    window.localStorage.setItem(key, JSON.stringify(savedRoutes.slice(0, 20)));
  }, [savedRoutes, authUser?.uid]);

  useEffect(() => {
    setOnboardingDismissedLocally(null);
    const key = getOnboardingDismissedKey(authUser?.uid);
    try {
      setOnboardingDismissedLocally(window.localStorage.getItem(key) === 'true');
    } catch {
      setOnboardingDismissedLocally(false);
    }
  }, [authUser?.uid]);

  // Subscribe pending payments count for admin users (real-time)
  useEffect(() => {
    if (!isAdmin) {
      setPendingPaymentsCount(0);
      return;
    }

    const paymentsQuery = query(
      collection(db, 'paymentSubmissions'),
      where('status', '==', 'manual_review')
    );

    const unsubscribe = onSnapshot(
      paymentsQuery,
      (snapshot) => {
        setPendingPaymentsCount(snapshot.size);
      },
      async (error) => {
        console.error('Error subscribing pending payments count:', error);
        try {
          const data = await api.admin.getPaymentStats();
          const pendingReview = Number(data?.pendingReview || data?.stats?.pendingReview || 0);
          setPendingPaymentsCount(pendingReview);
        } catch (fallbackError) {
          console.error('Fallback pending count fetch failed:', fallbackError);
        }
      }
    );

    return () => unsubscribe();
  }, [isAdmin]);

  // Broker Re-engagement Triggers
  // Trigger on first completed contract
  useEffect(() => {
    if (!authUser || isBroker || !activateTrigger) return;

    const completedContracts = contracts.filter(c => c.status === 'completed');
    if (completedContracts.length === 1) {
      activateTrigger('first_transaction');
    }
  }, [contracts, authUser, isBroker, activateTrigger]);

  // Load contracts function (can be called manually to refresh)
  const loadContracts = async () => {
    if (!activeUserId) {
      setContracts([]);
      return;
    }

    setContractsLoading(true);
    try {
      const response = await api.contracts.getAll();
      setContracts(sortEntitiesNewestFirst(response.contracts || [], {
        fallbackKeys: ['signedAt', 'completedAt', 'updatedAt'],
      }));
    } catch (error) {
      reportFirestoreListenerError('contracts (fallback fetch)', error);
      setContracts([]);
    } finally {
      setContractsLoading(false);
    }
  };

  // Subscribe contracts for current user (real-time)
  useEffect(() => {
    if (!activeUserId) {
      setContracts([]);
      setContractsLoading(false);
      return;
    }

    setContractsLoading(true);

    const contractsQuery = query(
      collection(db, 'contracts'),
      where('participantIds', 'array-contains', activeUserId)
    );

    const unsubscribe = onSnapshot(
      contractsQuery,
      (snapshot) => {
        const contractDocs = sortEntitiesNewestFirst(
          snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          })),
          { fallbackKeys: ['signedAt', 'completedAt', 'updatedAt'] }
        );
        setContracts(contractDocs);
        setContractsLoading(false);
      },
      async (error) => {
        reportFirestoreListenerError('contracts', error);
        if (isPermissionDeniedError(error)) {
          setContracts([]);
          setContractsLoading(false);
          return;
        }
        try {
          await loadContracts();
        } finally {
          setContractsLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, [activeUserId]);

  // Mark PWA engagement when a user signs in (fires once per uid).
  useEffect(() => {
    if (userProfile?.uid) {
      markEngagement();
    }
  }, [userProfile?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-show onboarding guide for first-time users (onboardingComplete === false).
  // Dep on userProfile?.uid so it fires as soon as the profile loads after login.
  useEffect(() => {
    if (onboardingDismissedLocally === null) return;
    if (userProfile && userProfile.onboardingComplete === false && onboardingDismissedLocally === false) {
      setShowOnboardingGuide(true);
    }
  }, [userProfile?.uid, userProfile?.onboardingComplete, onboardingDismissedLocally]); // eslint-disable-line react-hooks/exhaustive-deps

  // Guard against race: if dismissal is loaded as true, ensure modal is not left open.
  useEffect(() => {
    if (onboardingDismissedLocally === true && showOnboardingGuide) {
      setShowOnboardingGuide(false);
    }
  }, [onboardingDismissedLocally, showOnboardingGuide]);

  // Auto-show broker guide after a user activates broker (convertedToBroker && !brokerGuideCompleted)
  useEffect(() => {
    if (shouldShowBrokerGuide && !showBrokerGuide) {
      setShowBrokerGuide(true);
    }
  }, [shouldShowBrokerGuide]); // eslint-disable-line react-hooks/exhaustive-deps

  // Use anonymized preview data for non-auth users to keep Home vibrant and conversion-focused.
  const userRole = currentRole || 'shipper';
  const availableWorkspaces = useMemo(() => {
    if (!authUser) return [normalizeWorkspaceRole(userRole, 'shipper')];

    const next = [];
    if (userRole === 'shipper') next.push('shipper');
    if (userRole === 'trucker') next.push('trucker');
    if (isBroker) next.push('broker');

    const unique = Array.from(new Set(next.filter((role) => WORKSPACE_ROLES.includes(role))));
    return unique.length > 0 ? unique : [normalizeWorkspaceRole(userRole, 'shipper')];
  }, [authUser, userRole, isBroker]);
  const activeWorkspace = availableWorkspaces.includes(workspaceRole)
    ? workspaceRole
    : availableWorkspaces[0];
  const primaryWorkspace = userRole === 'trucker' ? 'trucker' : 'shipper';
  const homeWorkspace = availableWorkspaces.includes(primaryWorkspace)
    ? primaryWorkspace
    : availableWorkspaces[0];
  const activityPrimaryWorkspace = useMemo(() => {
    if (availableWorkspaces.includes(primaryWorkspace)) return primaryWorkspace;
    return availableWorkspaces[0];
  }, [availableWorkspaces, primaryWorkspace]);
  const activityWorkspaceOptions = useMemo(() => {
    const preferred = [
      activityPrimaryWorkspace,
      ...(isBroker && availableWorkspaces.includes('broker') ? ['broker'] : []),
    ];
    const filtered = Array.from(new Set(preferred)).filter((role) => availableWorkspaces.includes(role));
    return filtered.length > 0 ? filtered : [availableWorkspaces[0]];
  }, [activityPrimaryWorkspace, isBroker, availableWorkspaces]);
  const effectivePostingRole = resolveEffectivePostingRole(userProfile, userRole);
  const postingRole = activeWorkspace === 'broker'
    ? effectivePostingRole
    : (activeWorkspace === 'shipper' || activeWorkspace === 'trucker' ? activeWorkspace : null);
  const interactionRole = activeWorkspace === 'broker' ? userRole : activeWorkspace;

  useEffect(() => {
    if (!availableWorkspaces.includes(workspaceRole)) {
      setWorkspaceRole(availableWorkspaces[0]);
    }
  }, [availableWorkspaces, workspaceRole, setWorkspaceRole]);

  useEffect(() => {
    if (activeTab === 'home' && activeWorkspace !== homeWorkspace) {
      setWorkspaceRole(homeWorkspace);
    }
  }, [activeTab, activeWorkspace, homeWorkspace, setWorkspaceRole]);

  useEffect(() => {
    if (activeTab === 'activity' && !activityWorkspaceOptions.includes(activeWorkspace)) {
      setWorkspaceRole(activityWorkspaceOptions[0]);
    }
  }, [activeTab, activeWorkspace, activityWorkspaceOptions, setWorkspaceRole]);

  const isGuestUser = !authUser;
  const cargoListings = isGuestUser ? guestCargoListings : firebaseCargoListings;
  const truckListings = isGuestUser ? guestTruckListings : firebaseTruckListings;
  const allShipments = useMemo(
    () => (isGuestUser ? guestActiveShipments : (firebaseShipments || [])),
    [isGuestUser, firebaseShipments]
  );
  const activeShipments = useMemo(
    () => (isGuestUser ? guestActiveShipments : (firebaseActiveShipments || [])),
    [isGuestUser, firebaseActiveShipments]
  );
  const deliveredShipments = useMemo(
    () => (isGuestUser ? guestActiveShipments.filter((shipment) => shipment.status === 'delivered') : (firebaseDeliveredShipments || [])),
    [isGuestUser, firebaseDeliveredShipments]
  );
  const deliveredTripsAsTrucker = useMemo(() => {
    if (!authUser?.uid) return 0;
    const delivered = isGuestUser
      ? guestActiveShipments.filter((shipment) => shipment.status === 'delivered')
      : (firebaseDeliveredShipments || []);
    return delivered.filter((shipment) => shipment?.truckerId === authUser.uid).length;
  }, [authUser?.uid, isGuestUser, firebaseDeliveredShipments]);
  const userReputationRating = Number(truckerProfile?.rating ?? userProfile?.averageRating ?? userProfile?.rating ?? 0);
  const userCompletedTrips = Math.max(
    Number(truckerProfile?.totalTrips || 0),
    Number(userProfile?.tripsCompleted || 0),
    deliveredTripsAsTrucker
  );
  const matchWorkspaceForShipment = useCallback((shipment, workspace) => {
    if (workspace === 'broker') return true;
    if (!authUser?.uid) return workspace === userRole;
    if (workspace === 'shipper') return shipment?.shipperId === authUser.uid;
    if (workspace === 'trucker') return shipment?.truckerId === authUser.uid;
    return false;
  }, [authUser?.uid, userRole]);

  const workspaceConversations = useMemo(() => {
    if (!authUser?.uid || activeWorkspace === 'broker') return [];
    return sortEntitiesNewestFirst(
      conversations.filter((conversation) => (
        inferConversationPerspectiveRole(conversation, authUser.uid) === activeWorkspace
      )),
      { fallbackKeys: ['lastActivityAt'] }
    );
  }, [conversations, authUser?.uid, activeWorkspace]);

  const workspaceNotifications = useMemo(() => {
    const sorted = sortEntitiesNewestFirst(firebaseNotifications);
    return sorted.filter((notification) => {
      const inferredRole = inferNotificationWorkspaceRole(notification);
      if (activeWorkspace === 'broker') {
        if (inferredRole !== 'broker') return false;
      } else if (inferredRole && inferredRole !== activeWorkspace) {
        return false;
      }
      if (!isAdmin) {
        const notificationType = String(notification?.type || '').trim().toUpperCase();
        const hasContractRef = Boolean(notification?.data?.contractId);
        const contractStatus = normalizeBidStatus(
          notification?.data?.contractStatus
          || notification?.data?.status
        );
        if (notificationType === 'CONTRACT_CANCELLED' || (hasContractRef && contractStatus === 'cancelled')) {
          return false;
        }
      }
      return true;
    });
  }, [firebaseNotifications, activeWorkspace, isAdmin]);

  const unreadNotifications = useMemo(
    () => workspaceNotifications.filter((notification) => !isNotificationRead(notification)).length,
    [workspaceNotifications]
  );
  const unreadMessages = useMemo(
    () => workspaceConversations.reduce((total, conversation) => total + Number(conversation.unreadCount || 0), 0),
    [workspaceConversations]
  );
  const unreadBids = useMemo(
    () =>
      workspaceNotifications.filter((notification) => {
        const type = String(notification.type || '').toLowerCase();
        return !isNotificationRead(notification) && (type.includes('bid') || type === 'new_bid');
      }).length,
    [workspaceNotifications]
  );
  // Wallet removed - no balance tracking

  // Trigger on 5-star rating received
  useEffect(() => {
    if (!authUser || isBroker || !activateTrigger) return;

    if (userReputationRating >= 5.0 && userCompletedTrips >= 3) {
      activateTrigger('5_star_rating');
    }
  }, [authUser, isBroker, activateTrigger, userReputationRating, userCompletedTrips]);

  // Trigger on power user milestone
  useEffect(() => {
    if (!authUser || isBroker || !activateTrigger) return;

    if (userCompletedTrips >= 10) {
      activateTrigger('power_user_10_trips');
    }
  }, [authUser, isBroker, activateTrigger, userCompletedTrips]);

  // Create currentUser object for suspension banner and other features
  const currentUser = authUser && userProfile ? {
    id: authUser.uid,
    uid: authUser.uid,
    ...userProfile
  } : null;
  const isAccountSuspended = currentUser?.accountStatus === 'suspended' || currentUser?.isActive === false;

  const handleSuspendedAction = () => {
    showToast({
      type: 'error',
      title: 'Account Restricted',
      message: 'Your account currently has restrictions. Settle due fees or contact support to continue.',
    });
    setContractFilter('unpaid_fees');
    setActiveTab('contracts');
  };

  const roleScopedCargoListings = useMemo(() => {
    const scoped = cargoListings.filter((cargo) => {
      if (isGuestUser) return true;
      if (activeWorkspace === 'shipper') {
        return cargo.shipperId === authUser?.uid || cargo.userId === authUser?.uid;
      }
      if (activeWorkspace === 'trucker') {
        return true;
      }
      if (activeWorkspace === 'broker') {
        return isBroker;
      }
      return true;
    });
    return sortEntitiesNewestFirst(scoped, { fallbackKeys: ['postedAt'] });
  }, [cargoListings, isGuestUser, activeWorkspace, authUser?.uid, isBroker]);

  const roleScopedTruckListings = useMemo(() => {
    const scoped = truckListings.filter((truck) => {
      if (isGuestUser) return true;
      if (activeWorkspace === 'trucker') {
        return truck.truckerId === authUser?.uid || truck.userId === authUser?.uid;
      }
      if (activeWorkspace === 'shipper') {
        return true;
      }
      if (activeWorkspace === 'broker') {
        return isBroker;
      }
      return true;
    });
    return sortEntitiesNewestFirst(scoped, { fallbackKeys: ['postedAt'] });
  }, [truckListings, isGuestUser, activeWorkspace, authUser?.uid, isBroker]);

  const activeBidCountByListingId = useMemo(() => {
    const counts = new Map();
    ownerListingBids.forEach((bid) => {
      if (!isActiveBidStatus(bid.status)) return;
      const listingType = bid.cargoListingId ? 'cargo' : (bid.truckListingId ? 'truck' : '');
      const listingId = bid.cargoListingId || bid.truckListingId || bid.listingId;
      if (!listingId) return;
      const mapKey = `${listingType}:${listingId}`;
      counts.set(mapKey, (counts.get(mapKey) || 0) + 1);
    });
    return counts;
  }, [ownerListingBids]);

  const workspaceContracts = useMemo(() => {
    const scopedContracts = activeWorkspace === 'broker'
      ? contracts
      : contracts.filter((contract) => inferContractPerspectiveRole(contract, authUser?.uid) === activeWorkspace);
    const visibleContracts = isAdmin
      ? scopedContracts
      : scopedContracts.filter((contract) => normalizeBidStatus(contract?.status) !== 'cancelled');
    return sortEntitiesNewestFirst(visibleContracts, {
      fallbackKeys: ['signedAt', 'completedAt', 'updatedAt'],
    });
  }, [contracts, activeWorkspace, authUser?.uid, isAdmin]);

  const workspaceMyBids = useMemo(() => {
    if (!authUser?.uid || activeWorkspace === 'broker') return [];
    return sortEntitiesNewestFirst(
      myBids.filter((bid) => (
        inferBidPerspectiveRole(bid, authUser.uid) === activeWorkspace
        && isActiveBidStatus(bid.status)
      ))
    );
  }, [myBids, authUser?.uid, activeWorkspace]);

  const workspaceActiveShipments = useMemo(
    () => sortEntitiesNewestFirst(
      activeShipments.filter((shipment) => matchWorkspaceForShipment(shipment, activeWorkspace))
    ),
    [activeShipments, activeWorkspace, matchWorkspaceForShipment]
  );
  const activityBidsCount = useMemo(
    () => (activeWorkspace === 'broker' ? 0 : workspaceMyBids.length),
    [activeWorkspace, workspaceMyBids]
  );
  const activityContractsCount = useMemo(
    () => (activeWorkspace === 'broker' ? 0 : workspaceContracts.length),
    [activeWorkspace, workspaceContracts]
  );

  const workspaceDeliveredShipments = useMemo(
    () => sortEntitiesNewestFirst(
      deliveredShipments.filter((shipment) => matchWorkspaceForShipment(shipment, activeWorkspace))
    ),
    [deliveredShipments, activeWorkspace, matchWorkspaceForShipment]
  );
  const workspaceShipments = useMemo(
    () => sortEntitiesNewestFirst(
      allShipments.filter((shipment) => matchWorkspaceForShipment(shipment, activeWorkspace))
    ),
    [allShipments, activeWorkspace, matchWorkspaceForShipment]
  );

  // Counts for sidebar
  const openCargoCount = roleScopedCargoListings.filter((cargo) => canBidCargoStatus(cargo.status)).length;
  const availableTrucksCount = roleScopedTruckListings.filter((truck) => canBookTruckStatus(truck.status)).length;
  const activeShipmentsCount = workspaceActiveShipments.length;
  const pendingContractsCount = workspaceContracts.filter((contract) => contract.status === 'draft').length;
  const activeContractsCount = workspaceContracts.filter((contract) => ['signed', 'in_transit'].includes(contract.status)).length;

  // Filter listings
  const filteredCargoListings = useMemo(() => sortEntitiesNewestFirst(
    roleScopedCargoListings.filter((cargo) => {
      if (!matchesMarketplaceFilter(cargo.status, filterStatus)) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          cargo.shipper?.toLowerCase().includes(query) ||
          cargo.origin?.toLowerCase().includes(query) ||
          cargo.destination?.toLowerCase().includes(query) ||
          cargo.cargoType?.toLowerCase().includes(query)
        );
      }
      return true;
    }).map((cargo) => {
      const activeBidCount = activeBidCountByListingId.get(`cargo:${cargo.id}`);
      if (typeof activeBidCount !== 'number') return cargo;
      return { ...cargo, bidCount: activeBidCount };
    }),
    { fallbackKeys: ['postedAt'] }
  ), [roleScopedCargoListings, filterStatus, searchQuery, activeBidCountByListingId]);

  const filteredTruckListings = useMemo(() => sortEntitiesNewestFirst(
    roleScopedTruckListings.filter((truck) => {
      if (!matchesMarketplaceFilter(truck.status, filterStatus)) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          truck.trucker?.toLowerCase().includes(query) ||
          truck.origin?.toLowerCase().includes(query) ||
          truck.destination?.toLowerCase().includes(query) ||
          truck.vehicleType?.toLowerCase().includes(query)
        );
      }
      return true;
    }).map((truck) => {
      const activeBidCount = activeBidCountByListingId.get(`truck:${truck.id}`);
      if (typeof activeBidCount !== 'number') return truck;
      return { ...truck, bidCount: activeBidCount };
    }),
    { fallbackKeys: ['postedAt'] }
  ), [roleScopedTruckListings, filterStatus, searchQuery, activeBidCountByListingId]);

  const homeRoleKpis = useMemo(() => {
    if (activeWorkspace === 'shipper') {
      return [
        { id: 'active-cargo', label: 'Active Cargo', value: roleScopedCargoListings.filter((cargo) => canBidCargoStatus(cargo.status)).length },
        { id: 'open-bids', label: 'Open Bids', value: unreadBids },
        { id: 'contracted', label: 'Contracted', value: workspaceContracts.filter((contract) => ['signed', 'in_transit', 'completed'].includes(contract.status)).length },
      ];
    }
    if (activeWorkspace === 'trucker') {
      return [
        { id: 'available-trucks', label: 'Available Trucks', value: roleScopedTruckListings.filter((truck) => canBookTruckStatus(truck.status)).length },
        { id: 'active-bids', label: 'Active Bids', value: workspaceMyBids.length },
        { id: 'in-transit', label: 'In Transit', value: workspaceActiveShipments.filter((shipment) => ['picked_up', 'in_transit'].includes(shipment.status)).length },
      ];
    }
    const activeParties = new Set();
    workspaceContracts.forEach((contract) => {
      (contract.participantIds || []).forEach((participantId) => activeParties.add(participantId));
    });
    return [
      { id: 'managed-contracts', label: 'Managed Contracts', value: workspaceContracts.length },
      { id: 'active-parties', label: 'Active Parties', value: activeParties.size },
      { id: 'pending-actions', label: 'Pending Actions', value: pendingContractsCount + unreadNotifications },
    ];
  }, [
    activeWorkspace,
    roleScopedCargoListings,
    roleScopedTruckListings,
    unreadBids,
    workspaceContracts,
    workspaceMyBids,
    workspaceActiveShipments,
    pendingContractsCount,
    unreadNotifications,
  ]);


  const handleSaveCurrentSearch = () => {
    const normalizedQuery = String(searchQuery || '').trim();
    if (!normalizedQuery && filterStatus === 'all') {
      showToast({
        type: 'info',
        title: 'Nothing to save',
        message: 'Set a search term or filter before saving.',
      });
      return;
    }

    const isDuplicate = savedSearches.some((savedSearch) =>
      savedSearch.market === activeMarket
      && savedSearch.workspaceRole === activeWorkspace
      && savedSearch.filterStatus === filterStatus
      && String(savedSearch.searchQuery || '').trim().toLowerCase() === normalizedQuery.toLowerCase()
    );
    if (isDuplicate) {
      showToast({
        type: 'info',
        title: 'Already saved',
        message: 'This search preset already exists.',
      });
      return;
    }

    const nextSavedSearch = {
      id: `search-${Date.now()}`,
      market: activeMarket,
      workspaceRole: activeWorkspace,
      filterStatus,
      searchQuery: normalizedQuery,
      createdAt: Date.now(),
    };

    setSavedSearches((prev) => [nextSavedSearch, ...prev].slice(0, 20));
    showToast({
      type: 'success',
      title: 'Search Saved',
      message: 'You can now reapply this search in one tap.',
    });
  };

  const handleApplySavedSearch = (savedSearch) => {
    if (!savedSearch) return;
    if (savedSearch.workspaceRole && availableWorkspaces.includes(savedSearch.workspaceRole)) {
      setWorkspaceRole(savedSearch.workspaceRole);
    }
    setActiveMarket(savedSearch.market || 'cargo');
    setFilterStatus(savedSearch.filterStatus || 'all');
    setSearchQuery(savedSearch.searchQuery || '');
  };

  const handleDeleteSavedSearch = (savedSearchId) => {
    setSavedSearches((prev) => prev.filter((savedSearch) => savedSearch.id !== savedSearchId));
  };

  const handleSaveRoute = (routePreset) => {
    if (!routePreset?.origin || !routePreset?.destination) {
      return;
    }
    const exists = savedRoutes.some((savedRoute) =>
      savedRoute.origin?.toLowerCase() === routePreset.origin.toLowerCase()
      && savedRoute.destination?.toLowerCase() === routePreset.destination.toLowerCase()
      && (savedRoute.type || 'both') === (routePreset.type || 'both')
      && Number(savedRoute.maxDetourKm || 50) === Number(routePreset.maxDetourKm || 50)
    );
    if (exists) {
      showToast({
        type: 'info',
        title: 'Route Already Saved',
        message: 'This route preset already exists.',
      });
      return;
    }

    const nextRoute = {
      id: `route-${Date.now()}`,
      origin: routePreset.origin,
      destination: routePreset.destination,
      maxDetourKm: Number(routePreset.maxDetourKm || 50),
      type: routePreset.type || 'both',
      createdAt: Date.now(),
    };
    setSavedRoutes((prev) => [nextRoute, ...prev].slice(0, 20));
    showToast({
      type: 'success',
      title: 'Route Saved',
      message: 'Saved route added to Route Optimizer presets.',
    });
  };

  const handleDeleteSavedRoute = (routeId) => {
    setSavedRoutes((prev) => prev.filter((route) => route.id !== routeId));
  };

  const handleApplySavedRoute = (routePreset) => {
    if (!routePreset) return;
    showToast({
      type: 'info',
      title: 'Route Applied',
      message: `${routePreset.origin} -> ${routePreset.destination}`,
    });
  };

  // Get user initial for avatar
  const userInitial = userProfile?.name?.[0]?.toUpperCase() || authUser?.phoneNumber?.[0] || 'U';

  // Handlers
  const handlePostClick = () => {
    if (authUser && !postingRole) {
      showToast({
        type: 'error',
        title: 'Posting unavailable',
        message: 'Set your account role to shipper or trucker to post listings.',
      });
      return;
    }
    requireAuth(() => openModal('post'), 'Sign in to post a listing');
  };

  // Check ownership helper
  const isCargoOwner = (cargo) => {
    return authUser?.uid && (cargo.shipperId === authUser.uid || cargo.userId === authUser.uid);
  };

  const isTruckOwner = (truck) => {
    return authUser?.uid && (truck.truckerId === authUser.uid || truck.userId === authUser.uid);
  };

  const handleViewCargoDetails = (cargo) => {
    if (!authUser) {
      requireAuth(() => openModal('cargoDetails', cargo), 'Sign in to view full listing details');
      return;
    }

    // Route based on ownership and role
    if (isCargoOwner(cargo)) {
      // Owner views their cargo details
      openModal('cargoDetails', cargo);
    } else if (userRole === 'trucker') {
      // Trucker views details before bidding
      openModal('cargoDetails', cargo);
    } else {
      // Shipper viewing others' cargo
      openModal('cargoDetails', cargo);
    }
  };

  const handleViewTruckDetails = (truck) => {
    if (!authUser) {
      requireAuth(() => openModal('truckDetails', truck), 'Sign in to view full listing details');
      return;
    }

    // Route based on ownership and role
    if (isTruckOwner(truck)) {
      // Owner views their truck details
      openModal('truckDetails', truck);
    } else if (userRole === 'shipper') {
      // Shipper views details before booking
      openModal('truckDetails', truck);
    } else {
      // Trucker viewing others' trucks
      openModal('truckDetails', truck);
    }
  };

  const handleBidCargo = (cargo) => {
    requireAuth(() => {
      if (isAccountSuspended) {
        handleSuspendedAction();
        return;
      }
      openModal('bid', cargo);
    }, 'Sign in to place a bid');
  };

  const handleBookTruck = (truck) => {
    requireAuth(() => {
      if (isAccountSuspended) {
        handleSuspendedAction();
        return;
      }
      openModal('bid', truck);
    }, 'Sign in to book a truck');
  };

  const handleReferListing = (listing, listingType) => {
    requireAuth(() => {
      if (!isBroker) {
        showToast({
          type: 'error',
          title: 'Broker only',
          message: 'Only brokers can refer listings to attributed users.',
        });
        return;
      }

      const normalizedType = String(listingType || '').toLowerCase();
      if (!listing?.id || !['cargo', 'truck'].includes(normalizedType)) {
        showToast({
          type: 'error',
          title: 'Invalid listing',
          message: 'Listing details are incomplete. Please refresh and try again.',
        });
        return;
      }

      const listingOwnerId = listing.userId || listing.shipperId || listing.truckerId || null;
      if (listingOwnerId && listingOwnerId === authUser?.uid) {
        showToast({
          type: 'error',
          title: 'Own listing blocked',
          message: 'You cannot refer your own listing.',
        });
        return;
      }

      const isEligible = normalizedType === 'cargo'
        ? canBidCargoStatus(listing.status)
        : canBookTruckStatus(listing.status);
      if (!isEligible) {
        showToast({
          type: 'error',
          title: 'Listing unavailable',
          message: 'This listing is not eligible for referral.',
        });
        return;
      }

      openModal('referListing', {
        listing: {
          ...listing,
          status: normalizeListingStatus(listing.status),
        },
        listingType: normalizedType,
      });
    }, 'Sign in as a broker to refer listings');
  };

  // Edit handlers
  const handleEditCargo = (cargo) => {
    closeModal('cargoDetails');
    openModal('editCargo', cargo);
  };

  const handleEditTruck = (truck) => {
    closeModal('truckDetails');
    openModal('editTruck', truck);
  };

  const handleViewMap = (listing) => {
    if (!authUser) {
      requireAuth(() => openModal('map', listing), 'Sign in to view full route map');
      return;
    }

    openModal('map', listing);
  };

  const handleNotificationClick = () => {
    requireAuth(() => setActiveTab('notifications'), 'Sign in to view notifications');
  };

  const promptSignInForTab = (tab, title) => {
    requireAuth(() => setActiveTab(tab), title);
  };

  const handleTabChange = useCallback((nextTab) => {
    if (nextTab === 'activity' && activeWorkspace === 'broker' && activityPrimaryWorkspace !== 'broker') {
      setWorkspaceRole(activityPrimaryWorkspace);
    }
    setActiveTab(nextTab);
  }, [activeWorkspace, activityPrimaryWorkspace, setWorkspaceRole, setActiveTab]);

  const handleMobileTabChange = useCallback((nextTab) => {
    if (nextTab === 'activity' && !(authUser && userProfile)) {
      requireAuth(() => handleTabChange('activity'), 'Sign in to view activity');
      return;
    }
    handleTabChange(nextTab);
  }, [authUser, userProfile, requireAuth, handleTabChange]);

  const handleProfileClick = () => {
    requireAuth(() => setActiveTab('profile'), 'Sign in to view profile');
  };

  const handleBrokerClick = () => {
    requireAuth(() => {
      if (availableWorkspaces.includes('broker')) {
        setWorkspaceRole('broker');
      }
      setActiveTab('broker');
    }, 'Sign in to access broker dashboard');
  };

  const handleEditProfile = () => {
    requireAuth(() => setActiveTab('profile'), 'Sign in to edit profile');
  };

  const handleNotificationSettings = () => {
    requireAuth(() => setActiveTab('notifications'), 'Sign in to manage notifications');
  };

  const handleHelpSupport = () => {
    setActiveTab('help');
  };

  const markOnboardingDismissedLocally = () => {
    if (!authUser?.uid) return;
    const dismissedKey = getOnboardingDismissedKey(authUser.uid);
    try {
      window.localStorage.setItem(dismissedKey, 'true');
    } catch {
      // Ignore storage failures (e.g. restrictive privacy contexts).
    }
    setOnboardingDismissedLocally(true);
  };

  const handleOnboardingDismiss = async () => {
    setShowOnboardingGuide(false);
    openInstallModal();
    if (authUser?.uid) {
      markOnboardingDismissedLocally();
      if (userProfile?.onboardingComplete !== true) {
        try {
          await updateDoc(doc(db, 'users', authUser.uid), {
            onboardingDismissedAt: serverTimestamp(),
          });
        } catch (e) {
          const errorCode = e?.code || e?.message;
          if (errorCode !== 'permission-denied') {
            console.warn('Could not persist onboarding dismissal:', errorCode);
          }
        }
      }
    }
  };

  const handleOnboardingComplete = async () => {
    setShowOnboardingGuide(false);
    openInstallModal();
    if (authUser?.uid) {
      markOnboardingDismissedLocally();

      if (userProfile?.onboardingComplete === true) return;

      try {
        await updateDoc(doc(db, 'users', authUser.uid), {
          onboardingComplete: true,
          onboardingCompletedAt: serverTimestamp(),
        });
      } catch (e) {
        const errorCode = e?.code || e?.message;
        if (errorCode !== 'permission-denied') {
          console.warn('Could not persist onboarding completion:', errorCode);
        }
      }
    }
  };

  // Wallet removed - direct GCash payment only

  const handleLogout = async () => {
    if (logout) {
      await logout();
      // Reset to home tab and show auth modal with welcome message
      setActiveTab('home');
      clearPendingAction(); // Reset title to default "Sign in to continue"
      setShowAuthModal(true);
    }
  };

  const handleRouteOptimizerClick = () => {
    openModal('routeOptimizer');
  };

  const handleContractsClick = () => {
    requireAuth(() => setActiveTab('contracts'), 'Sign in to view contracts');
  };

  const handlePaymentReviewClick = () => {
    if (!isAdmin) return;
    if (activeTab !== 'admin') {
      lastNonAdminTabRef.current = activeTab;
    }
    setActiveTab('admin');
  };

  const handleBackFromAdmin = () => {
    const fallbackTab = lastNonAdminTabRef.current && lastNonAdminTabRef.current !== 'admin'
      ? lastNonAdminTabRef.current
      : 'home';
    setActiveTab(fallbackTab);
  };

  // Accept/Reject bid handlers
  const handleAcceptBid = async (bid, listing, listingType) => {
    try {
      // Use Firestore service for bid acceptance
      await acceptBid(bid.id, bid, listing, listingType);
      showToast({
        type: 'bid-accepted',
        title: 'Bid Accepted',
        message: `Bid accepted. Contract will be created automatically. The trucker will be notified to pay the platform fee.`,
      });
      // Close modal - data will refresh via Firestore real-time updates
      closeModal('cargoDetails');
      closeModal('truckDetails');
      // Do NOT open payment modal - trucker will pay
    } catch (error) {
      console.error('Error accepting bid:', error);
      showToast({
        type: 'error',
        title: 'Error',
        message: getUserErrorMessage(error, 'Failed to accept bid. Please try again.'),
      });
    }
  };

  const handleRejectBid = async (bid, listing, listingType) => {
    try {
      // Use Firestore service for bid rejection
      await rejectBid(bid.id, bid, listing, listingType);
      showToast({
        type: 'info',
        title: 'Bid Rejected',
        message: `You rejected the bid from ${bid.bidderName || 'the bidder'}`,
      });
    } catch (error) {
      console.error('Error rejecting bid:', error);
      showToast({
        type: 'error',
        title: 'Error',
        message: getUserErrorMessage(error, 'Failed to reject bid. Please try again.'),
      });
      throw error;
    }
  };

  const handleReopenListing = async (listingId, listingType) => {
    try {
      await reopenListing(listingId, listingType);
      showToast({
        type: 'success',
        title: 'Listing Reopened',
        message: 'The listing has been reopened for bidding',
      });
      // Close modal - data will refresh via Firestore real-time updates
      closeModal('cargoDetails');
      closeModal('truckDetails');
    } catch (error) {
      console.error('Error reopening listing:', error);
      showToast({
        type: 'error',
        title: 'Error',
        message: getUserErrorMessage(error, 'Failed to reopen listing. Please try again.'),
      });
      throw error;
    }
  };

  // Contract Creation Flow Handlers
  const handleCreateContract = async (bid, listing) => {
    try {
      setContractLoading(true);

      let contract = null;

      // First check if trigger-created contract already exists for this bid
      try {
        const existing = await api.contracts.getByBid(bid.id);
        if (existing?.contract) {
          contract = existing.contract;
          showToast({
            type: 'info',
            title: 'Contract Ready',
            message: 'This bid already has a contract. Opening it now.',
          });
          closeModal('cargoDetails');
          closeModal('truckDetails');
          await handleOpenContract(contract.id);
          return;
        }
      } catch (lookupError) {
        // No existing contract found; continue to create flow
      }

      // Create contract via API - will be in draft status
      try {
        const response = await api.contracts.create({
          bidId: bid.id,
        });
        contract = response.contract;
      } catch (createError) {
        if (
          createError?.code === 'already-exists'
          || String(createError?.message || '').toLowerCase().includes('already exists')
        ) {
          const existing = await api.contracts.getByBid(bid.id);
          if (existing?.contract) {
            contract = existing.contract;
          }
        } else {
          throw createError;
        }
      }

      if (!contract) {
        throw new Error('Unable to find or create contract for this bid');
      }

      // Show success message
      showToast({
        type: 'success',
        title: 'Contract Created',
        message: 'Contract created successfully. Please review and sign. Platform fee will be due 3 days after delivery confirmation.',
      });

      // Close the details modal and navigate to contracts view
      closeModal('cargoDetails');
      closeModal('truckDetails');
      setActiveTab('contracts');

    } catch (error) {
      console.error('Error creating contract:', error);
      showToast({
        type: 'error',
        title: 'Error',
        message: error.message || 'Failed to create contract',
      });
    } finally {
      setContractLoading(false);
    }
  };

  // Handler: Open platform fee payment modal for truckers
  const handlePayPlatformFee = async (data) => {
    const contractId = data?.contractId || data?.id || null;

    // Data can be: { bidId, contractId } or { bid, listing, platformFee }.
    // Some callers pass the full contract object; normalize that to contractId flow.
    if (contractId && !data?.bid) {
      // Fetch contract and bid data
      try {
        const contractDoc = await getDoc(doc(db, 'contracts', contractId));
        if (!contractDoc.exists()) {
          showToast({ type: 'error', message: 'Contract not found' });
          return;
        }

        const contract = { id: contractDoc.id, ...contractDoc.data() };
        const bidDoc = await getDoc(doc(db, 'bids', contract.bidId));

        if (!bidDoc.exists()) {
          showToast({ type: 'error', message: 'Bid not found' });
          return;
        }

        const bid = { id: bidDoc.id, ...bidDoc.data() };
        const platformFee = contract.platformFee;

        openModal('platformFee', { bid, contract, platformFee });
      } catch (error) {
        console.error('Error loading payment data:', error);
        showToast({ type: 'error', message: 'Failed to load payment information' });
      }
    } else {
      // Full data already provided
      openModal('platformFee', data);
    }
  };

  // Handler: Contract created after GCash payment approved
  const handleContractCreated = (data) => {
    closeModal('platformFee');
    setPendingContractData(null);

    showToast({
      type: 'success',
      title: 'Payment Verified!',
      message: 'Your platform fee payment has been verified.',
    });

    // Contract already exists, just marked as paid
    setActiveTab('home');
  };

  const isContractFullyExecuted = (contract) => {
    if (!contract) return false;
    if (contract.shipperSignature && contract.truckerSignature) return true;
    return contract.status === 'signed'
      || contract.status === 'in_transit'
      || contract.status === 'completed';
  };

  const isAlreadySignedContractError = (error) => {
    const code = String(error?.code || '').toLowerCase();
    const message = String(error?.message || '').toLowerCase();
    const isDuplicateCode = code.includes('already-exists') || code.includes('failed-precondition');
    const isDuplicateMessage = message.includes('already signed') || message.includes('already been signed');
    return isDuplicateCode && isDuplicateMessage;
  };

  // Handler: Sign contract
  const handleSignContract = async (contractId, signData = {}) => {
    setContractLoading(true);
    try {
      const response = await api.contracts.sign(contractId, signData || {});
      const resolvedContract = response?.contract
        ? { id: contractId, ...response.contract }
        : (await api.contracts.getById(contractId))?.contract || null;
      if (resolvedContract) {
        openModal('contract', resolvedContract);
      }
      const fullyExecuted = Boolean(response?.fullyExecuted || isContractFullyExecuted(resolvedContract));
      const alreadySigned = response?.alreadySigned === true;

      showToast({
        type: 'bid-accepted',
        title: fullyExecuted ? 'Contract Signed!' : (alreadySigned ? 'Signature Already Recorded' : 'Signature Recorded'),
        message: fullyExecuted
          ? 'Both parties signed. Shipment tracking is now active.'
          : (alreadySigned
            ? 'Your signature is already recorded. Waiting for the other party to sign.'
            : 'Waiting for the other party to sign.'),
      });
      if (fullyExecuted) {
        closeModal('contract');
        setActiveTab('tracking');
      }
    } catch (error) {
      if (isAlreadySignedContractError(error)) {
        let latestContract = null;
        try {
          latestContract = (await api.contracts.getById(contractId))?.contract || null;
          if (latestContract) {
            openModal('contract', latestContract);
          }
        } catch (refreshError) {
          console.error('Failed to refresh contract after duplicate sign attempt:', refreshError);
        }

        const fullyExecuted = isContractFullyExecuted(latestContract);
        showToast({
          type: 'info',
          title: fullyExecuted ? 'Already Signed' : 'Signature Already Recorded',
          message: fullyExecuted
            ? 'This contract is already fully signed. Shipment tracking is active.'
            : 'Your signature is already recorded. Waiting for the other party to sign.',
        });

        if (fullyExecuted) {
          closeModal('contract');
          setActiveTab('tracking');
        }
        return;
      }

      console.error('Error signing contract:', error);
      showToast({
        type: 'error',
        title: 'Error',
        message: getUserErrorMessage(error, 'Failed to sign contract. Please try again.'),
      });
    } finally {
      setContractLoading(false);
    }
  };

  const handleCancelContract = async (contractId, cancelPayload = {}) => {
    setContractLoading(true);
    try {
      await api.contracts.cancel(contractId, cancelPayload || {});
      showToast({
        type: 'success',
        title: 'Contract Cancelled',
        message: 'The contract was cancelled and participants were notified.',
      });
      closeModal('contract');
      setActiveTab('contracts');
    } catch (error) {
      console.error('Error cancelling contract:', error);
      showToast({
        type: 'error',
        title: 'Cancellation Failed',
        message: getUserErrorMessage(error, 'Failed to cancel contract. Please try again.'),
      });
    } finally {
      setContractLoading(false);
    }
  };

  const handleUploadTruckerDocument = async (docType, file) => {
    return uploadTruckerComplianceDocument(docType, file);
  };

  // Handler: Complete contract (delivery confirmation)
  const handleCompleteContract = async (contractId) => {
    setContractLoading(true);
    try {
      const response = await api.contracts.complete(contractId);
      showToast({
        type: 'bid-accepted',
        title: 'Delivery Confirmed!',
        message: 'Contract completed. Please rate your experience.',
      });
      closeModal('contract');
      const completedContract = response?.contract
        ? { id: contractId, ...response.contract }
        : null;
      const resolvedContract = completedContract || (await api.contracts.getById(contractId))?.contract;

      if (resolvedContract && authUser?.uid) {
        const otherUserId = resolvedContract.listingOwnerId === authUser.uid
          ? resolvedContract.bidderId
          : resolvedContract.listingOwnerId;
        const otherUserName = resolvedContract.listingOwnerId === authUser.uid
          ? (resolvedContract.bidderName || 'Counterparty')
          : (resolvedContract.listingOwnerName || 'Counterparty');

        if (otherUserId) {
          setRatingTarget({
            contract: resolvedContract,
            userToRate: {
              id: otherUserId,
              name: otherUserName,
            },
          });
        }
      }
    } catch (error) {
      console.error('Error completing contract:', error);
      showToast({
        type: 'error',
        title: 'Error',
        message: error.message || 'Failed to complete contract',
      });
    } finally {
      setContractLoading(false);
    }
  };

  const handleSubmitRating = async (ratingData) => {
    setRatingLoading(true);
    try {
      await api.ratings.submit(ratingData);
      setRatingTarget(null);
      showToast({
        type: 'success',
        title: 'Rating Submitted',
        message: 'Thanks for sharing feedback. Your reputation has been updated.',
      });
    } catch (error) {
      console.error('Error submitting rating:', error);
      const alreadyRated = error?.code === 'already-exists'
        || String(error?.message || '').toLowerCase().includes('already rated')
        || String(error?.message || '').toLowerCase().includes('already rated this contract');

      if (alreadyRated) {
        setRatingTarget(null);
        showToast({
          type: 'info',
          title: 'Already Rated',
          message: 'You have already rated this contract.',
        });
        return;
      }

      showToast({
        type: 'error',
        title: 'Rating Failed',
        message: error.message || 'Unable to submit rating right now.',
      });
    } finally {
      setRatingLoading(false);
    }
  };

  // Wallet handlers removed - using direct GCash payment

  // Handler: Open contract from notification
  const handleOpenContract = async (contractId) => {
    try {
      const response = await api.contracts.getById(contractId);
      if (response.contract) {
        if (!isAdmin && normalizeBidStatus(response.contract.status) === 'cancelled') {
          showToast({
            type: 'info',
            title: 'Contract Closed',
            message: 'This cancelled contract is no longer available in user views.',
          });
          return;
        }
        openModal('contract', response.contract);
      }
    } catch (error) {
      console.error('Error fetching contract:', error);
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to load contract',
      });
    }
  };

  // Handler: Activate broker - opens the guide modal which handles activation
  const handleActivateBroker = () => {
    setShowBrokerGuide(true);
  };

  // Handler: Broker guide modal - user completed activation inside the modal
  const handleBrokerGuideActivated = async (registerResult = null) => {
    const alreadyRegistered = registerResult?.alreadyRegistered === true;
    await handleBrokerConverted();
    showToast({
      type: 'success',
      title: alreadyRegistered ? 'Broker Already Active' : 'Broker Activated!',
      message: alreadyRegistered
        ? 'Your broker profile is already active. You can continue sharing your referral link.'
        : 'Start sharing your referral link to earn commissions.',
    });
  };

  // Handler: Broker guide dismissed (either declined enrollment or skipped guide)
  const handleBrokerGuideDismiss = () => {
    setShowBrokerGuide(false);
    if (isBroker) {
      // Already a broker but skipped the guide — mark it complete
      markBrokerGuideCompleted?.();
    } else {
      // Declined enrollment
      handleBrokerOnboardingDeclined?.();
    }
  };

  // Handler: Broker guide completed all steps
  const handleBrokerGuideComplete = () => {
    setShowBrokerGuide(false);
    markBrokerGuideCompleted?.();
    setActiveTab('broker');
  };

  const loadBidContext = async (bidId, notificationData = {}) => {
    if (!bidId) {
      throw new Error('Missing bid ID');
    }

    const bidDoc = await getDoc(doc(db, 'bids', bidId));
    if (!bidDoc.exists()) {
      throw new Error('Bid not found');
    }

    const bid = { id: bidDoc.id, ...bidDoc.data() };
    const listingType = resolveBidListingType(bid)
      || String(notificationData.listingType || '').toLowerCase()
      || (bid.cargoListingId ? 'cargo' : 'truck');
    const listingId = bid.cargoListingId || bid.truckListingId || bid.listingId || notificationData.listingId;
    const listingCollection = listingType === 'cargo' ? 'cargoListings' : 'truckListings';

    let listing = null;
    if (listingId) {
      const listingDoc = await getDoc(doc(db, listingCollection, listingId));
      if (listingDoc.exists()) {
        listing = { id: listingDoc.id, ...listingDoc.data() };
      }
    }

    if (!listing) {
      listing = {
        id: listingId || bid.listingId,
        origin: bid.origin,
        destination: bid.destination,
        userId: bid.listingOwnerId,
        userName: bid.listingOwnerName,
      };
    }

    if (listingType === 'cargo') {
      listing.shipper = listing.shipper || listing.userName || bid.listingOwnerName;
      listing.company = listing.company || listing.userName || bid.listingOwnerName;
      listing.status = normalizeListingStatus(listing.status);
    } else {
      listing.trucker = listing.trucker || listing.userName || bid.listingOwnerName;
      listing.status = normalizeListingStatus(listing.status);
      listing.uiStatus = listing.uiStatus || toTruckUiStatus(listing.status);
      listing.askingRate = listing.askingRate ?? listing.askingPrice;
    }

    return { bid, listing, listingType };
  };

  const handleOpenBidFromNotification = async (notification) => {
    const bidId = notification?.data?.bidId;
    const inferredWorkspace = inferNotificationWorkspaceRole(notification);
    if (inferredWorkspace && availableWorkspaces.includes(inferredWorkspace)) {
      setWorkspaceRole(inferredWorkspace);
    }
    if (!bidId) {
      setActiveTab('bids');
      return;
    }

    try {
      const { listing, listingType } = await loadBidContext(bidId, notification.data);
      setActiveTab('home');
      if (listingType === 'cargo') {
        openModal('cargoDetails', listing);
      } else {
        openModal('truckDetails', listing);
      }
    } catch (error) {
      console.error('Failed to open bid notification:', error);
      setActiveTab('bids');
      showToast({
        type: 'error',
        title: 'Unable to open bid',
        message: error.message || 'The bid may no longer be available.',
      });
    }
  };

  const handleOpenChatFromNotification = async (notification) => {
    const bidId = notification?.data?.bidId;
    const inferredWorkspace = inferNotificationWorkspaceRole(notification);
    if (inferredWorkspace && availableWorkspaces.includes(inferredWorkspace)) {
      setWorkspaceRole(inferredWorkspace);
    }
    if (!bidId) {
      setActiveTab('messages');
      return;
    }

    try {
      const { bid, listing, listingType } = await loadBidContext(bidId, notification.data);
      openModal('chat', { bid, listing, type: listingType, bidId: bid.id });
      setActiveTab('messages');
    } catch (error) {
      console.error('Failed to open chat notification:', error);
      setActiveTab('messages');
      showToast({
        type: 'error',
        title: 'Unable to open chat',
        message: error.message || 'The chat context is unavailable.',
      });
    }
  };

  const openListingByType = async (listingId, listingType) => {
    const normalizedType = String(listingType || '').toLowerCase();
    if (!listingId || !['cargo', 'truck'].includes(normalizedType)) {
      throw new Error('Invalid listing context');
    }

    const listingCollection = normalizedType === 'cargo' ? 'cargoListings' : 'truckListings';
    const listingDoc = await getDoc(doc(db, listingCollection, listingId));
    if (!listingDoc.exists()) {
      throw new Error('Listing not found');
    }

    const listing = { id: listingDoc.id, ...listingDoc.data() };
    listing.status = normalizeListingStatus(listing.status);
    if (normalizedType === 'cargo') {
      openModal('cargoDetails', listing);
      return;
    }

    listing.uiStatus = listing.uiStatus || toTruckUiStatus(listing.status);
    listing.askingRate = listing.askingRate ?? listing.askingPrice;
    openModal('truckDetails', listing);
  };

  const handleOpenActivityListing = async (listingItem) => {
    const listingId = listingItem?.listingId || listingItem?.id;
    const listingTypeRaw = listingItem?.listingType || listingItem?.type || 'cargo';
    const listingType = String(listingTypeRaw || '').toLowerCase();
    if (!listingId || !['cargo', 'truck'].includes(listingType)) {
      showToast({
        type: 'error',
        title: 'Unable to open listing',
        message: 'Listing details are unavailable.',
      });
      return;
    }

    try {
      await openListingByType(listingId, listingType);
      setActiveTab('home');
    } catch (error) {
      console.error('Failed to open activity listing:', error);
      showToast({
        type: 'error',
        title: 'Unable to open listing',
        message: error.message || 'The listing may no longer be available.',
      });
    }
  };

  const handleOpenListingFromNotification = async (notification) => {
    const listingId = notification?.data?.listingId;
    const listingType = notification?.data?.listingType;
    const referralId = notification?.data?.referralId;
    const inferredWorkspace = inferNotificationWorkspaceRole(notification);
    if (inferredWorkspace && availableWorkspaces.includes(inferredWorkspace)) {
      setWorkspaceRole(inferredWorkspace);
    }
    if (!listingId || !listingType) {
      setActiveTab('home');
      return;
    }

    try {
      if (referralId) {
        api.referrals.updateMyListingReferralState({
          referralId: String(referralId),
          action: 'opened',
        }).catch(() => {});
      }
      await openListingByType(listingId, listingType);
      setActiveTab('home');
    } catch (error) {
      console.error('Failed to open listing notification:', error);
      setActiveTab('home');
      showToast({
        type: 'error',
        title: 'Unable to open listing',
        message: error.message || 'The listing may no longer be available.',
      });
    }
  };

  const handleSidebarMarketChange = (market) => {
    setActiveMarket(market);
    setActiveTab('home');
  };

  // If admin dashboard is open, render it instead of main app shell.
  if (activeTab === 'admin') {
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950"><Loader2 className="size-6 animate-spin text-orange-500" /></div>}>
        <AdminDashboard onBackToApp={handleBackFromAdmin} />
      </Suspense>
    );
  }

  return (
    <div className="flex flex-col h-screen h-[100dvh] min-h-screen min-h-[100svh] overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <Header
        headerRef={headerRef}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
        unreadNotifications={unreadNotifications}
        unreadMessages={unreadMessages}
        userInitial={userInitial}
        currentRole={userRole}
        workspaceRole={activeWorkspace}
        availableWorkspaces={availableWorkspaces}
        onWorkspaceChange={setWorkspaceRole}
        isBroker={isBroker}
        isAdmin={isAdmin}
        onLogout={handleLogout}
        onNotificationClick={handleNotificationClick}
        onProfileClick={handleProfileClick}
        onBrokerClick={handleBrokerClick}
        onEditProfile={handleEditProfile}
        onNotificationSettings={handleNotificationSettings}
        onHelpSupport={handleHelpSupport}
        onAdminDashboard={handlePaymentReviewClick}
        user={{
          name: userProfile?.name || 'User',
          initial: userInitial,
          rating: userReputationRating,
          tripsCompleted: userCompletedTrips,
          avatarUrl: userProfile?.avatarUrl,
        }}
        mobileVisible={showMobileHeader}
      />

      <div className="flex flex-1 min-h-0">
        {/* Sidebar - Desktop only */}
        <Sidebar
          className="hidden lg:flex"
          currentRole={userRole}
          workspaceRole={activeWorkspace}
          availableWorkspaces={availableWorkspaces}
          onWorkspaceChange={setWorkspaceRole}
          activeMarket={activeMarket}
          onMarketChange={handleSidebarMarketChange}
          cargoCount={roleScopedCargoListings.length}
          truckCount={roleScopedTruckListings.length}
          openCargoCount={openCargoCount}
          availableTrucksCount={availableTrucksCount}
          activeShipmentsCount={activeShipmentsCount}
          pendingContractsCount={pendingContractsCount}
          activeContractsCount={activeContractsCount}
          isAdmin={isAdmin}
          pendingPaymentsCount={pendingPaymentsCount}
          onPostClick={handlePostClick}
          onRouteOptimizerClick={activeWorkspace === 'trucker' ? handleRouteOptimizerClick : undefined}
          onMyBidsClick={() => requireAuth(() => setActiveTab('bids'), 'Sign in to view your bids')}
          onContractsClick={handleContractsClick}
          onBrokerClick={handleBrokerClick}
          isBroker={isBroker}
          onPaymentReviewClick={isAdmin ? handlePaymentReviewClick : undefined}
        />

        {/* Main Content */}
        <Suspense
          fallback={(
            <main className="flex-1 p-4 lg:p-8 flex items-center justify-center">
              <Loader2 className="size-6 animate-spin text-orange-500" />
            </main>
          )}
        >
        {activeTab === 'home' && (
          <ErrorBoundary>
            <HomeView
              activeMarket={activeMarket}
              onMarketChange={handleMarketChange}
              cargoListings={filteredCargoListings}
              truckListings={filteredTruckListings}
              filterStatus={filterStatus}
              onFilterChange={setFilterStatus}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onViewCargoDetails={handleViewCargoDetails}
              onViewTruckDetails={handleViewTruckDetails}
              onBidCargo={handleBidCargo}
              onBookTruck={handleBookTruck}
              onViewMap={handleViewMap}
              onReferListing={handleReferListing}
              currentRole={userRole}
              workspaceRole={activeWorkspace}
              currentUserId={authUser?.uid}
              darkMode={darkMode}
              onRouteOptimizerClick={activeWorkspace === 'trucker' ? handleRouteOptimizerClick : undefined}
              currentUser={currentUser}
              savedSearches={savedSearches}
              onSaveCurrentSearch={handleSaveCurrentSearch}
              onApplySavedSearch={handleApplySavedSearch}
              onDeleteSavedSearch={handleDeleteSavedSearch}
              onNavigateToContracts={(filter) => {
                setContractFilter(filter || 'all');
                setActiveTab('contracts');
              }}
              isBroker={isBroker}
              shouldShowBrokerCard={shouldShowBrokerCard}
              onDismissBrokerCard={handleDismissBrokerCard}
              onActivateBroker={handleActivateBroker}
              onPostListing={handlePostClick}
              onScroll={handleHomeScroll}
              mobileHeaderVisible={showMobileHeader}
              mobileHeaderHeight={mobileHeaderHeight}
              roleKpis={homeRoleKpis}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'activity' && (
          <ErrorBoundary>
            <ActivityView
              currentUser={currentUser}
              currentRole={userRole}
              workspaceRole={activeWorkspace}
              workspaceOptions={activityWorkspaceOptions}
              onWorkspaceChange={setWorkspaceRole}
              darkMode={darkMode}
              onOpenChat={(bid, listing) => {
                openModal('chat', { bid, listing, type: resolveBidListingType(bid) || 'cargo', bidId: bid.id });
              }}
              onOpenContract={handleOpenContract}
              onBrowseMarketplace={() => {
                setActiveMarket(activeWorkspace === 'trucker' ? 'cargo' : 'trucks');
                setActiveTab('home');
              }}
              onCreateListing={handlePostClick}
              onOpenMessages={() => setActiveTab('messages')}
              onOpenListing={handleOpenActivityListing}
              onNavigateToContracts={(filter) => {
                setContractFilter(filter || 'all');
                setActiveTab('contracts');
              }}
              shipments={workspaceShipments}
              bidsCount={activityBidsCount}
              contractsCount={activityContractsCount}
              isBroker={isBroker}
              onToast={showToast}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'tracking' && (
          <ErrorBoundary>
            <TrackingView
              shipments={sortEntitiesNewestFirst(allShipments)}
              activeShipments={workspaceActiveShipments}
              deliveredShipments={workspaceDeliveredShipments}
              loading={false}
              currentRole={userRole}
              workspaceRole={activeWorkspace}
              currentUserId={authUser?.uid}
              darkMode={darkMode}
              onLocationUpdate={emitShipmentUpdate}
              onInitiateCall={authUser ? handleInitiateCall : null}
              onEnsureCallEligibility={authUser ? ensureCallEligibility : null}
              isCallDisabled={authUser ? isCallDisabled : null}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'notifications' && authUser && (
          <ErrorBoundary>
            <NotificationsView
              notifications={workspaceNotifications}
              loading={false}
              unreadCount={unreadNotifications}
              workspaceRole={activeWorkspace}
              currentUserId={authUser?.uid}
              onMarkAsRead={markNotificationRead}
              onMarkAllAsRead={markAllNotificationsRead}
              onOpenBid={handleOpenBidFromNotification}
              onOpenChat={handleOpenChatFromNotification}
              onOpenListing={handleOpenListingFromNotification}
              onOpenContract={handleOpenContract}
              onPayPlatformFee={handlePayPlatformFee}
              onBrowseMarketplace={() => setActiveTab('home')}
              onOpenActivity={() => handleTabChange('activity')}
              darkMode={darkMode}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'notifications' && !authUser && (
          <main className="flex-1 p-4 lg:p-8">
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Notifications
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Please sign in to view your notifications.
            </p>
            <button
              onClick={() => promptSignInForTab('notifications', 'Sign in to view notifications')}
              className="mt-4 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors"
            >
              Sign in
            </button>
          </main>
        )}

        {activeTab === 'profile' && (
          <ErrorBoundary>
            <ProfilePage
              onInstallApp={handleProfileInstallClick}
              showInstallAppButton={!isInstallAlreadySatisfied}
              onNavigateToActivity={() => handleTabChange('activity')}
            />
          </ErrorBoundary>
        )}
        {activeTab === 'help' && <ErrorBoundary><HelpSupportView onBack={() => setActiveTab('home')} onShowOnboardingGuide={() => setShowOnboardingGuide(true)} /></ErrorBoundary>}

        {activeTab === 'broker' && (
          <ErrorBoundary>
            <BrokerView
              authUser={authUser}
              isBroker={isBroker}
              brokerProfile={brokerProfile}
              onOpenBrokerActivity={() => {
                if (availableWorkspaces.includes('broker')) {
                  setWorkspaceRole('broker');
                }
                setActiveTab('activity');
              }}
              onBrokerRegistered={() => { void handleBrokerConverted(); }}
              onToast={showToast}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'bids' && authUser && (
          <ErrorBoundary>
            <BidsView
              currentUser={authUser}
              currentRole={activeWorkspace}
              workspaceRole={activeWorkspace}
              onOpenChat={(bid, listing) => {
                openModal('chat', { bid, listing, type: resolveBidListingType(bid) || 'cargo', bidId: bid.id });
              }}
              onBrowseMarketplace={() => {
                setActiveMarket(activeWorkspace === 'trucker' ? 'cargo' : 'trucks');
                setActiveTab('home');
              }}
              onCreateListing={handlePostClick}
              onOpenMessages={() => setActiveTab('messages')}
              darkMode={darkMode}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'bids' && !authUser && (
          <main className="flex-1 p-4 lg:p-8">
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-4">
              {activeWorkspace === 'trucker' ? 'My Bids' : 'My Bookings'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Please sign in to view your {activeWorkspace === 'trucker' ? 'bids' : 'bookings'}.
            </p>
            <button
              onClick={() => promptSignInForTab('bids', 'Sign in to view your bids')}
              className="mt-4 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors"
            >
              Sign in
            </button>
          </main>
        )}

        {activeTab === 'messages' && authUser && (
          <ErrorBoundary>
            <ChatView
              currentUser={authUser}
              workspaceRole={activeWorkspace}
              conversations={workspaceConversations}
              conversationsLoading={conversationsLoading}
              onOpenChat={(bid, listing, type) => {
                openModal('chat', { bid, listing, type, bidId: bid.id });
              }}
              onBrowseMarketplace={() => setActiveTab('home')}
              onCreateListing={handlePostClick}
              darkMode={darkMode}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'messages' && !authUser && (
          <main
            className="flex-1 bg-gray-50 dark:bg-gray-950 overflow-y-auto p-4 lg:p-8"
            style={{ paddingBottom: 'calc(100px + env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="mx-auto w-full max-w-4xl">
              <div className="mb-4 lg:mb-6">
                <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  Messages
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Please sign in to view your conversations.
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-center px-4 py-12">
                <div className="mx-auto mb-4 size-14 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <MessageSquare className="size-7 text-gray-400" />
                </div>
                <p className="text-sm lg:text-base font-medium text-gray-900 dark:text-gray-100 mb-1">
                  Sign in required
                </p>
                <p className="text-xs lg:text-sm text-gray-500 dark:text-gray-400 mb-5">
                  Access your chats, offers, and booking conversations.
                </p>
                <Button onClick={() => promptSignInForTab('messages', 'Sign in to view messages')}>
                  Sign in
                </Button>
              </div>
            </div>
          </main>
        )}

        {activeTab === 'contracts' && (
          <ErrorBoundary>
            <ContractsView
              darkMode={darkMode}
              currentUser={{ id: authUser?.uid, ...userProfile }}
              workspaceRole={activeWorkspace}
              isAdmin={isAdmin}
              onOpenContract={handleOpenContract}
              onBrowseMarketplace={() => setActiveTab('home')}
              onOpenActivity={() => handleTabChange('activity')}
              initialFilter={contractFilter}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'adminPayments' && isAdmin && (
          <ErrorBoundary>
            <AdminPaymentsView
              darkMode={darkMode}
              onVerifyContracts={() => setActiveTab('contractVerification')}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'contractVerification' && isAdmin && (
          <ErrorBoundary>
            <ContractVerificationView darkMode={darkMode} />
          </ErrorBoundary>
        )}

        {/* Fallback for invalid/unknown tabs */}
        {!['home', 'activity', 'tracking', 'notifications', 'profile', 'broker', 'bids', 'messages', 'contracts', 'adminPayments', 'contractVerification', 'help', 'admin'].includes(activeTab) && (
          <NotFoundView onGoHome={() => setActiveTab('home')} />
        )}
        </Suspense>
      </div>

      {/* Mobile Navigation */}
      <MobileNav
        activeTab={activeTab}
        onTabChange={handleMobileTabChange}
        onPostClick={handlePostClick}
        unreadMessages={unreadMessages}
        currentRole={activeWorkspace}
      />

      {/* Modals */}
      <ErrorBoundary>
      <Suspense fallback={null}>
      {modals.post && (
      <PostModal
        open={modals.post}
        onClose={() => closeModal('post')}
        currentRole={postingRole || 'shipper'}
        loading={postLoading}
        onSubmit={async (data) => {
          if (!authUser?.uid || !userProfile) {
            console.error('User not authenticated');
            return;
          }

          setPostLoading(true);
          try {
            if (!postingRole) {
              throw new Error('Only shipper or trucker accounts can post listings');
            }
            if (postingRole === 'shipper') {
              // Upload photos first (if any)
              const photoUrls = await uploadListingPhotos(authUser.uid, data.photos || [], 'cargo');

              // Create cargo listing
              const listingData = {
                origin: data.origin,
                destination: data.destination,
                originCoords: data.originCoords || null,
                destCoords: data.destCoords || null,
                originStreetAddress: data.originStreetAddress || '',
                destinationStreetAddress: data.destinationStreetAddress || '',
                cargoType: data.cargoType,
                weight: data.weight,
                weightUnit: data.unit || 'tons',
                vehicleNeeded: data.vehicleType,
                askingPrice: data.askingPrice,
                description: data.description,
                pickupDate: data.pickupDate,
                photos: photoUrls,
              };
              await createCargoListing(authUser.uid, userProfile, listingData);
            } else {
              // Upload photos first (if any)
              const photoUrls = await uploadListingPhotos(authUser.uid, data.photos || [], 'truck');

              // Create truck listing
              const listingData = {
                origin: data.origin,
                destination: data.destination,
                originCoords: data.originCoords || null,
                destCoords: data.destCoords || null,
                originStreetAddress: data.originStreetAddress || '',
                destinationStreetAddress: data.destinationStreetAddress || '',
                vehicleType: data.vehicleType,
                capacity: data.weight || 0,
                capacityUnit: data.unit || 'tons',
                askingPrice: data.askingPrice,
                description: data.description,
                availableDate: data.pickupDate,
                photos: photoUrls,
              };
              await createTruckListing(authUser.uid, userProfile, truckerProfile, listingData);
            }
            trackAnalyticsEvent('post_created', {
              role: postingRole,
              listing_type: postingRole === 'shipper' ? 'cargo' : 'truck',
            });
            markEngagement();
            resetInstallCooldownOnMilestone();
            closeModal('post');
          } catch (error) {
            console.error('Error creating listing:', error);
            showToast({
              type: 'error',
              title: 'Post failed',
              message: getUserErrorMessage(error, 'Unable to save listing. Please try again.'),
            });
          } finally {
            setPostLoading(false);
          }
        }}
      />
      )}

      {modals.bid && bidModalData && (
      <BidModal
        open={modals.bid}
        onClose={() => closeModal('bid')}
        listing={bidModalData}
        currentRole={interactionRole}
        isSuspended={isAccountSuspended}
        outstandingFees={Number(currentUser?.outstandingPlatformFees || currentUser?.outstandingFees || 0)}
        loading={bidLoading}
        onSubmit={async (data) => {
          const listing = bidModalData;
          if (!authUser?.uid || !userProfile || !listing) {
            console.error('Missing required data for bid');
            return;
          }

          if (isAccountSuspended) {
            closeModal('bid');
            handleSuspendedAction();
            return;
          }

          setBidLoading(true);
          try {
            // Validation checks
            if (!authUser || !authUser.uid) {
              console.error('User not authenticated');
              showToast({
                type: 'error',
                title: 'Authentication required',
                message: 'You must be logged in to place a bid.',
              });
              setBidLoading(false);
              return;
            }

            if (!userProfile) {
              console.error('User profile not loaded');
              showToast({
                type: 'error',
                title: 'Profile loading',
                message: 'Please wait for your profile to load.',
              });
              setBidLoading(false);
              return;
            }

            // Determine listing type based on presence of trucker field
            const normalizedListingType = String(listing.type || listing.listingType || '').toLowerCase();
            const listingType = ['cargo', 'truck'].includes(normalizedListingType)
              ? normalizedListingType
              : ((listing.trucker || listing.vehicleType || listing.capacity) ? 'truck' : 'cargo');

            // Ensure listing has required fields
            if (!listing.userId && !listing.shipperId && !listing.truckerId) {
              console.error('Listing missing owner ID:', listing);
              showToast({
                type: 'error',
                title: 'Bid unavailable',
                message: 'Cannot place bid: listing owner information is missing.',
              });
              setBidLoading(false);
              return;
            }

            const bidData = {
              price: data.amount,
              message: data.message || '',
              cargoType: data.cargoType || null,
              cargoWeight: data.cargoWeight || null,
            };
            await createBid(authUser.uid, userProfile, listing, listingType, bidData);

            // Emit socket event for instant notification to listing owner
            emitBid({
              listingId: listing.id,
              listingType,
              bidderId: authUser.uid,
              bidderName: userProfile?.name || 'Someone',
              amount: data.amount,
              message: bidData.message,
              cargoDescription: listing.cargoDescription || listing.cargoType,
              ownerId: listing.userId || listing.shipperId || listing.truckerId,
            });

            trackAnalyticsEvent('bid_submitted', {
              role: interactionRole || currentRole || 'shipper',
              listing_type: listingType,
            });
            markEngagement();
            resetInstallCooldownOnMilestone();
            closeModal('bid');
            showToast({
              type: 'success',
              title: 'Bid placed',
              message: 'Your bid has been submitted successfully.',
            });
          } catch (error) {
            console.error('Error creating bid:', error);
            console.error('Error details:', {
              code: error.code,
              message: error.message,
              stack: error.stack,
            });
            if (error.code === 'permission-denied' && isAccountSuspended) {
              closeModal('bid');
              handleSuspendedAction();
              return;
            }
            showToast({
              type: 'error',
              title: 'Bid failed',
              message: getUserErrorMessage(error, 'Unable to place bid. Please try again.'),
            });
          } finally {
            setBidLoading(false);
          }
        }}
      />
      )}

      {/* Map Modal */}
      {modals.map && mapModalData && (
        <FullMapModal
          listing={mapModalData}
          darkMode={darkMode}
          onClose={() => closeModal('map')}
        />
      )}

      {/* Cargo Details Modal */}
      {modals.cargoDetails && cargoDetailsData && (
      <CargoDetailsModal
        open={modals.cargoDetails}
        onClose={() => closeModal('cargoDetails')}
        cargo={cargoDetailsData}
        currentRole={interactionRole}
        isOwner={isCargoOwner(cargoDetailsData)}
        isBroker={isBroker}
        onEdit={handleEditCargo}
        onBid={(cargo) => {
          closeModal('cargoDetails');
          handleBidCargo(cargo);
        }}
        onRefer={(cargo) => {
          closeModal('cargoDetails');
          handleReferListing(cargo, 'cargo');
        }}
        canRefer={Boolean(
          isBroker
          && cargoDetailsData
          && !isCargoOwner(cargoDetailsData)
          && canBidCargoStatus(cargoDetailsData?.status)
        )}
        onOpenChat={(bid, listing) => {
          closeModal('cargoDetails');
          openModal('chat', { bid, listing, type: 'cargo', bidId: bid.id });
        }}
        onAcceptBid={handleAcceptBid}
        onRejectBid={handleRejectBid}
        onReopenListing={handleReopenListing}
        onCreateContract={(bid, listing) => {
          closeModal('cargoDetails');
          handleCreateContract(bid, listing);
        }}
        onOpenContract={handleOpenContract}
        userBidId={(() => {
          const cargo = cargoDetailsData;
          if (!cargo || !authUser || interactionRole !== 'trucker') return null;
          // Use the latest active user bid for this cargo to avoid cancelled/rejected contract links.
          const userBid = myBids.find(
            (bid) => bid.cargoListingId === cargo.id && isActiveBidStatus(bid.status)
          );
          return userBid?.id || null;
        })()}
        darkMode={darkMode}
      />
      )}

      {/* Truck Details Modal */}
      {modals.truckDetails && truckDetailsData && (
      <TruckDetailsModal
        open={modals.truckDetails}
        onClose={() => closeModal('truckDetails')}
        truck={truckDetailsData}
        currentRole={interactionRole}
        isOwner={isTruckOwner(truckDetailsData)}
        isBroker={isBroker}
        onEdit={handleEditTruck}
        onBook={(truck) => {
          closeModal('truckDetails');
          handleBookTruck(truck);
        }}
        onRefer={(truck) => {
          closeModal('truckDetails');
          handleReferListing(truck, 'truck');
        }}
        canRefer={Boolean(
          isBroker
          && truckDetailsData
          && !isTruckOwner(truckDetailsData)
          && canBookTruckStatus(truckDetailsData?.status)
        )}
        onOpenChat={(bid, listing) => {
          closeModal('truckDetails');
          openModal('chat', { bid, listing, type: 'truck', bidId: bid.id });
        }}
        onAcceptBid={handleAcceptBid}
        onRejectBid={handleRejectBid}
        onReopenListing={handleReopenListing}
        onCreateContract={(bid, listing) => {
          closeModal('truckDetails');
          handleCreateContract(bid, listing);
        }}
        onOpenContract={handleOpenContract}
        darkMode={darkMode}
      />
      )}

      {modals.referListing && referListingData && (
      <ReferListingModal
        open={modals.referListing}
        onClose={() => closeModal('referListing')}
        listing={referListingData?.listing || null}
        listingType={referListingData?.listingType || 'cargo'}
        onToast={showToast}
      />
      )}

      {/* Chat Modal */}
      {modals.chat && chatModalData && (
      <ChatModal
        open={modals.chat}
        onClose={() => closeModal('chat')}
        data={chatModalData}
        currentUser={authUser}
        onOpenContract={handleOpenContract}
        onInitiateCall={authUser ? handleInitiateCall : null}
        onEnsureCallEligibility={authUser ? ensureCallEligibility : null}
        isCallDisabled={authUser ? isCallDisabled : null}
      />
      )}

      {/* Route Optimizer Modal */}
      {modals.routeOptimizer && (
      <Suspense fallback={null}>
        <RouteOptimizerModal
          open={modals.routeOptimizer}
          onClose={() => closeModal('routeOptimizer')}
          initialOrigin={routeOptimizerData?.origin}
          initialDestination={routeOptimizerData?.destination}
          savedRoutes={savedRoutes}
          onSaveRoute={handleSaveRoute}
          onApplySavedRoute={handleApplySavedRoute}
          onDeleteSavedRoute={handleDeleteSavedRoute}
        />
      </Suspense>
      )}

      {/* My Bids Modal */}
      {modals.myBids && (
      <MyBidsModal
        open={modals.myBids}
        onClose={() => closeModal('myBids')}
        currentUser={authUser}
        currentRole={interactionRole}
        onOpenChat={(bid, listing) => {
          closeModal('myBids');
          openModal('chat', { bid, listing, type: resolveBidListingType(bid) || 'cargo', bidId: bid.id });
        }}
      />
      )}

      {/* GCash Payment Modal (replaces PlatformFeeModal) */}
      {modals.platformFee && platformFeeData && (
      <Suspense fallback={null}>
        <GCashPaymentModal
          open={modals.platformFee}
          onClose={() => {
            closeModal('platformFee');
            setPendingContractData(null);
          }}
          data={platformFeeData}
          onContractCreated={handleContractCreated}
        />
      </Suspense>
      )}

      {/* Contract Modal */}
      {modals.contract && contractModalData && (
      <Suspense fallback={null}>
        <ContractModal
          open={modals.contract}
          onClose={() => closeModal('contract')}
          contract={contractModalData}
          currentUser={{ id: authUser?.uid, ...userProfile }}
          truckerProfile={truckerProfile}
          truckerCompliance={truckerCompliance}
          onSign={handleSignContract}
          onCancel={handleCancelContract}
          onComplete={handleCompleteContract}
          onPayPlatformFee={handlePayPlatformFee}
          onUploadTruckerDocument={handleUploadTruckerDocument}
          loading={contractLoading}
        />
      </Suspense>
      )}

      {ratingTarget && (
      <RatingModal
        open={!!ratingTarget}
        onClose={() => setRatingTarget(null)}
        contract={ratingTarget?.contract}
        userToRate={ratingTarget?.userToRate}
        onSubmit={handleSubmitRating}
        loading={ratingLoading}
      />
      )}

      {/* Wallet Modal removed - using direct GCash payment */}

      {/* Edit Cargo Modal (uses PostModal in edit mode) */}
      {modals.editCargo && editCargoData && (
      <PostModal
        open={modals.editCargo}
        onClose={() => closeModal('editCargo')}
        currentRole="shipper"
        editMode={true}
        existingData={editCargoData}
        loading={postLoading}
        onSubmit={async (data) => {
          if (!data.id) {
            console.error('Missing listing ID for update');
            return;
          }

          setPostLoading(true);
          try {
            const updateData = {
              origin: data.origin,
              destination: data.destination,
              originStreetAddress: data.originStreetAddress || '',
              destinationStreetAddress: data.destinationStreetAddress || '',
              cargoType: data.cargoType,
              weight: parseFloat(data.weight) || 0,
              weightUnit: data.unit || 'tons',
              vehicleNeeded: data.vehicleType,
              askingPrice: parseFloat(data.askingPrice) || 0,
              description: data.description,
              pickupDate: data.pickupDate,
            };

            // Update coordinates if origin/destination changed
            if (data.originCoords) {
              updateData.originLat = data.originCoords.lat;
              updateData.originLng = data.originCoords.lng;
            }
            if (data.destCoords) {
              updateData.destLat = data.destCoords.lat;
              updateData.destLng = data.destCoords.lng;
            }

            await updateCargoListing(data.id, updateData);
            closeModal('editCargo');
          } catch (error) {
            console.error('Error updating cargo listing:', error);
            showToast({
              type: 'error',
              title: 'Update failed',
              message: getUserErrorMessage(error, 'Unable to update cargo listing. Please try again.'),
            });
          } finally {
            setPostLoading(false);
          }
        }}
      />
      )}

      {/* Edit Truck Modal (uses PostModal in edit mode) */}
      {modals.editTruck && editTruckData && (
      <PostModal
        open={modals.editTruck}
        onClose={() => closeModal('editTruck')}
        currentRole="trucker"
        editMode={true}
        existingData={editTruckData}
        loading={postLoading}
        onSubmit={async (data) => {
          if (!data.id) {
            console.error('Missing listing ID for update');
            return;
          }

          setPostLoading(true);
          try {
            const updateData = {
              origin: data.origin,
              destination: data.destination,
              originStreetAddress: data.originStreetAddress || '',
              destinationStreetAddress: data.destinationStreetAddress || '',
              vehicleType: data.vehicleType,
              capacity: parseFloat(data.weight) || 0,
              capacityUnit: data.unit || 'tons',
              askingPrice: parseFloat(data.askingPrice) || 0,
              description: data.description,
              availableDate: data.pickupDate,
            };

            // Update coordinates if origin/destination changed
            if (data.originCoords) {
              updateData.originLat = data.originCoords.lat;
              updateData.originLng = data.originCoords.lng;
            }
            if (data.destCoords) {
              updateData.destLat = data.destCoords.lat;
              updateData.destLng = data.destCoords.lng;
            }

            await updateTruckListing(data.id, updateData);
            closeModal('editTruck');
          } catch (error) {
            console.error('Error updating truck listing:', error);
            showToast({
              type: 'error',
              title: 'Update failed',
              message: getUserErrorMessage(error, 'Unable to update truck listing. Please try again.'),
            });
          } finally {
            setPostLoading(false);
          }
        }}
      />
      )}
      </Suspense>

      </ErrorBoundary>

      {/* Socket Connection Indicator (dev mode) */}
      {import.meta.env.DEV && (
        <div className={cn(
          "fixed bottom-4 left-4 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2",
          socketConnected
            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
        )}>
          <div className={cn(
            "size-2 rounded-full",
            socketConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
          )} />
          {socketConnected ? 'Socket Connected' : 'Socket Disconnected'}
        </div>
      )}

      {/* Auth Modal - shown when unauthenticated user tries protected action */}
      <AuthModal
        open={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={executePendingAction}
        title={pendingActionTitle}
        onOpenLegal={(type) => setLegalModal({ open: true, type })}
      />

      {/* Legal Modal - Privacy Policy / Terms of Service */}
      <LegalModal
        open={legalModal.open}
        onClose={() => setLegalModal({ open: false, type: null })}
        type={legalModal.type}
      />

      {/* Onboarding Guide Modal - shown on first login and re-accessible from Help & Support */}
      <OnboardingGuideModal
        open={showOnboardingGuide}
        onDismiss={handleOnboardingDismiss}
        onComplete={handleOnboardingComplete}
        userRole={currentRole || 'shipper'}
        userName={userProfile?.name || ''}
      />

      {/* Broker Onboarding Guide Modal - enrollment + step-by-step broker feature guide */}
      <BrokerOnboardingGuideModal
        open={showBrokerGuide}
        onClose={() => setShowBrokerGuide(false)}
        onDismiss={handleBrokerGuideDismiss}
        onComplete={handleBrokerGuideComplete}
        onActivated={handleBrokerGuideActivated}
        userRole={currentRole || 'shipper'}
        userName={userProfile?.name || ''}
        isBroker={isBroker}
      />

      {/* In-app browser redirect overlay */}
      {showInAppOverlay && (
        <InAppBrowserOverlay
          platform={platform}
          browserName={inAppBrowserName}
          onOpenBrowser={() => {
            if (platform === 'android') {
              const url = buildAndroidIntentUrl(window.location.href);
              if (url) window.location.href = url;
            } else if (platform === 'ios') {
              // On iOS, copy the link to clipboard so user can paste in Safari
              navigator.clipboard.writeText(window.location.href).then(() => {
                showToast({
                  title: 'Link copied!',
                  description: 'Paste it in Safari to open GetGo.',
                  variant: 'success',
                });
              }).catch(() => {
                showToast({
                  title: 'Could not copy link',
                  description: 'Please use the manual steps above.',
                  variant: 'warning',
                });
              });
            }
          }}
        />
      )}

      {/* Incoming call banner — shown when another user is calling */}
      {!activeCall && !modals.chat && (
        <IncomingCallBanner
          incomingCall={incomingCall}
          onAccept={handleAcceptCall}
          onDecline={handleDeclineCall}
          disableAccept={isCallDisabled(incomingCall?.callerId)}
        />
      )}

      {/* Active call overlay */}
      {activeCall && (
        <Suspense fallback={null}>
          <CallModal
            open={Boolean(activeCall)}
            callId={activeCall.callId}
            channelName={activeCall.channelName}
            agoraUid={activeCall.agoraUid}
            otherPartyName={activeCall.otherPartyName}
            isOutgoing={activeCall.isOutgoing}
            callStatus={activeCall.status}
            onUpdateStatus={updateCallStatus}
            onClose={handleCallClose}
          />
        </Suspense>
      )}

      <ConfirmDialog
        open={Boolean(pendingCallRequest)}
        title="Voice call"
        description="This call may be recorded."
        confirmLabel="Start call"
        cancelLabel="Cancel"
        onConfirm={handleConfirmPendingCall}
        onCancel={handleCancelPendingCall}
      />

      {/* PWA Install Prompt (Android/Desktop banner or iOS Safari instructions) */}
      <PWAInstallPrompt
        showInstallBanner={showInstallBanner}
        triggerInstall={triggerInstall}
        dismissInstallBanner={handleDismissInstallBanner}
        showIOSInstall={showIOSInstall}
        dismissIOSInstall={dismissIOSInstall}
        showInstallModal={showInstallModal}
        onInstallModalInstall={handleInstallModalInstall}
        onInstallModalDismiss={dismissInstallModal}
        installModalInstalling={installModalInstalling}
      />
    </div>
  );
}
