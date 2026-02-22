/**
 * GetGo App - Refactored UI with new design system
 * This is the new main app component that uses the enhanced UI components
 * while preserving all existing Firebase functionality
 */

import React, { useMemo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

// Firestore Service
import {
  createCargoListing,
  updateCargoListing,
  createTruckListing,
  updateTruckListing,
  createBid,
  uploadListingPhotos,
  acceptBid,
  rejectBid,
  reopenListing,
  markNotificationRead,
  markAllNotificationsRead,
} from './services/firestoreService';

// Firebase
import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from './firebase';

// Hooks
import { useAuth } from './contexts/AuthContext';
import { useCargoListings } from './hooks/useCargoListings';
import { useTruckListings } from './hooks/useTruckListings';
import { useNotifications } from './hooks/useNotifications';
import { useMyBids } from './hooks/useBids';
import { useConversations } from './hooks/useConversations';
// Wallet removed - using direct GCash payment
import { useShipments } from './hooks/useShipments';
import { useTheme } from './hooks/useTheme';
import { useMarketplace } from './hooks/useMarketplace';
import { useModals } from './hooks/useModals';
import { useSocket } from './hooks/useSocket';
import { useAuthGuard } from './hooks/useAuthGuard';
import { useBrokerOnboarding } from './hooks/useBrokerOnboarding';
import { usePWAInstall } from './hooks/usePWAInstall';
import { InAppBrowserOverlay } from '@/components/shared/InAppBrowserOverlay';
import { PWAInstallPrompt } from '@/components/shared/PWAInstallPrompt';
import { buildAndroidIntentUrl } from './utils/browserDetect';

// Layout Components
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import ErrorBoundary from '@/components/shared/ErrorBoundary';

// View Components
import { HomeView } from '@/views/HomeView';
import { TrackingView } from '@/views/TrackingView';
import { AdminPaymentsView } from '@/views/AdminPaymentsView';
import { ContractVerificationView } from '@/views/ContractVerificationView';
import { ContractsView } from '@/views/ContractsView';
import { BidsView } from '@/views/BidsView';
import { ChatView } from '@/views/ChatView';
import { BrokerView } from '@/views/BrokerView';
import { NotificationsView } from '@/views/NotificationsView';
import { ProfilePage } from '@/components/profile/ProfilePage';
import { AdminDashboard } from '@/views/admin/AdminDashboard';
import ActivityView from '@/views/ActivityView';

// Modal Components
import { PostModal, BidModal, CargoDetailsModal, TruckDetailsModal, ChatModal, RouteOptimizerModal, MyBidsModal, ContractModal, RatingModal } from '@/components/modals';
import { GCashPaymentModal } from '@/components/modals/GCashPaymentModal';
import ReferListingModal from '@/components/broker/ReferListingModal';
import { FullMapModal } from '@/components/maps';
import AuthModal from '@/components/auth/AuthModal';
import { OnboardingGuideModal } from '@/components/modals/OnboardingGuideModal';

// API
import api from './services/api';
import { guestCargoListings, guestTruckListings, guestActiveShipments } from '@/data/guestMarketplaceData';
import { canBidCargoStatus, canBookTruckStatus, matchesMarketplaceFilter, normalizeListingStatus, toTruckUiStatus } from '@/utils/listingStatus';

const SAVED_SEARCHES_KEY_PREFIX = 'karga.savedSearches.v1';
const SAVED_ROUTES_KEY_PREFIX = 'karga.savedRoutes.v1';

function getUserScopedKey(prefix, uid) {
  return `${prefix}:${uid || 'guest'}`;
}

export default function GetGoApp() {
  // Firebase Auth
  const {
    authUser,
    userProfile,
    shipperProfile,
    truckerProfile,
    currentRole,
    brokerProfile,
    isBroker,
    switchRole,
    logout,
    isAdmin,
  } = useAuth();

  // Firebase Data Hooks - fetch ALL listings, filter in view layer
  // Pass authUser so hooks only subscribe when authenticated (avoids permission errors)
  const { listings: firebaseCargoListings, loading: cargoLoading } = useCargoListings({ authUser });
  const { listings: firebaseTruckListings, loading: truckLoading } = useTruckListings({ authUser });
  const { notifications: firebaseNotifications, unreadCount: firebaseUnreadCount } = useNotifications(authUser?.uid);
  const { bids: myBids } = useMyBids(authUser?.uid);
  const { conversations } = useConversations(authUser?.uid);
  // Wallet removed - using direct GCash payment for platform fees
  const { activeShipments: firebaseActiveShipments } = useShipments(authUser?.uid);

  // Custom Hooks for UI State
  const { darkMode, toggleDarkMode } = useTheme();
  const {
    activeTab,
    setActiveTab,
    activeMarket,
    setActiveMarket,
    filterStatus,
    setFilterStatus,
    searchQuery,
    setSearchQuery,
  } = useMarketplace();
  const { modals, openModal, closeModal, getModalData } = useModals();

  // Socket.io for instant notifications
  const {
    isConnected: socketConnected,
    notifications: socketNotifications,
    emitBid,
    emitShipmentUpdate,
    clearNotification,
  } = useSocket(authUser?.uid);

  // Broker Onboarding & Re-engagement
  const {
    shouldShowHomeCard: shouldShowBrokerCard,
    dismissHomeCard: handleDismissBrokerCard,
    markConverted: handleBrokerConverted,
    activateTrigger,
  } = useBrokerOnboarding(authUser?.uid, isBroker);

  // Auth Guard for protected actions
  const {
    requireAuth,
    showAuthModal,
    setShowAuthModal,
    pendingActionTitle,
    executePendingAction,
    clearPendingAction,
  } = useAuthGuard();

  // PWA Install Prompt
  const {
    showInAppOverlay,
    dismissInAppOverlay,
    inAppBrowserName,
    platform,
    showInstallBanner,
    triggerInstall,
    dismissInstallBanner,
    showIOSInstall,
    dismissIOSInstall,
    markEngagement,
  } = usePWAInstall();

  // Loading states for form submissions
  const [postLoading, setPostLoading] = useState(false);
  const [bidLoading, setBidLoading] = useState(false);
  const [contractLoading, setContractLoading] = useState(false);

  // Pending contract data (after fee payment)
  const [pendingContractData, setPendingContractData] = useState(null);

  // Wallet removed - direct GCash payment flow

  // Admin: Dashboard view state
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);

  // Onboarding Guide Modal
  const [showOnboardingGuide, setShowOnboardingGuide] = useState(false);

  // Admin: Pending payments count
  const [pendingPaymentsCount, setPendingPaymentsCount] = useState(0);

  // Contracts state
  const [contracts, setContracts] = useState([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [contractFilter, setContractFilter] = useState('all');
  const [activityInitialMode, setActivityInitialMode] = useState('my');

  // Toast notification state for real-time events
  const [toasts, setToasts] = useState([]);
  const [ratingTarget, setRatingTarget] = useState(null);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [savedSearches, setSavedSearches] = useState([]);
  const [savedRoutes, setSavedRoutes] = useState([]);

  useEffect(() => {
    if (activeTab !== 'activity' && activityInitialMode !== 'my') {
      setActivityInitialMode('my');
    }
  }, [activeTab, activityInitialMode]);

  // Show toast notification
  const showToast = (toast) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, ...toast }]);
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const getUserErrorMessage = (error, fallback) => {
    const code = String(error?.code || '').toLowerCase();
    const message = String(error?.message || '').toLowerCase();

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
      showToast({
        type: latestNotification.type,
        title: latestNotification.title,
        message: latestNotification.message,
      });
      // Clear the notification from socket state
      clearNotification(latestNotification.id);
    }
  }, [socketNotifications, clearNotification]);

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

  // Trigger on 5-star rating received
  useEffect(() => {
    if (!authUser || isBroker || !userProfile || !activateTrigger) return;

    if (userProfile.rating >= 5.0 && userProfile.tripsCompleted >= 3) {
      activateTrigger('5_star_rating');
    }
  }, [userProfile, authUser, isBroker, activateTrigger]);

  // Trigger on power user milestone
  useEffect(() => {
    if (!authUser || isBroker || !userProfile || !activateTrigger) return;

    if (userProfile.tripsCompleted >= 10) {
      activateTrigger('power_user_10_trips');
    }
  }, [userProfile, authUser, isBroker, activateTrigger]);

  // Load contracts function (can be called manually to refresh)
  const loadContracts = async () => {
    if (!authUser?.uid) {
      setContracts([]);
      return;
    }

    setContractsLoading(true);
    try {
      const response = await api.contracts.getAll();
      setContracts(response.contracts || []);
    } catch (error) {
      console.error('Error fetching contracts:', error);
      setContracts([]);
    } finally {
      setContractsLoading(false);
    }
  };

  // Subscribe contracts for current user (real-time)
  useEffect(() => {
    if (!authUser?.uid) {
      setContracts([]);
      setContractsLoading(false);
      return;
    }

    setContractsLoading(true);

    const contractsQuery = query(
      collection(db, 'contracts'),
      where('participantIds', 'array-contains', authUser.uid)
    );

    const unsubscribe = onSnapshot(
      contractsQuery,
      (snapshot) => {
        const contractDocs = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })).sort((a, b) => {
          const aTime = a.createdAt?._seconds || 0;
          const bTime = b.createdAt?._seconds || 0;
          return bTime - aTime;
        });
        setContracts(contractDocs);
        setContractsLoading(false);
      },
      async (error) => {
        console.error('Error subscribing contracts:', error);
        try {
          await loadContracts();
        } finally {
          setContractsLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, [authUser?.uid]);

  // Mark PWA engagement when a user signs in (fires once per uid).
  useEffect(() => {
    if (userProfile?.uid) {
      markEngagement();
    }
  }, [userProfile?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-show onboarding guide for first-time users (onboardingComplete === false).
  // Dep on userProfile?.uid so it fires as soon as the profile loads after login.
  useEffect(() => {
    if (userProfile && userProfile.onboardingComplete === false) {
      setShowOnboardingGuide(true);
    }
  }, [userProfile?.uid, userProfile?.onboardingComplete]); // eslint-disable-line react-hooks/exhaustive-deps

  // Use anonymized preview data for non-auth users to keep Home vibrant and conversion-focused.
  const userRole = currentRole || 'shipper';
  const isGuestUser = !authUser;
  const cargoListings = isGuestUser ? guestCargoListings : firebaseCargoListings;
  const truckListings = isGuestUser ? guestTruckListings : firebaseTruckListings;
  const activeShipments = isGuestUser ? guestActiveShipments : (firebaseActiveShipments || []);
  const unreadNotifications = firebaseUnreadCount || 0;
  const unreadMessages = useMemo(
    () => conversations.reduce((total, conversation) => total + Number(conversation.unreadCount || 0), 0),
    [conversations]
  );
  const unreadBids = useMemo(
    () =>
      firebaseNotifications.filter((notification) => {
        const type = String(notification.type || '').toLowerCase();
        return !isNotificationRead(notification) && (type.includes('bid') || type === 'new_bid');
      }).length,
    [firebaseNotifications]
  );
  // Wallet removed - no balance tracking

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
      title: 'Account Suspended',
      message: 'Pay your outstanding platform fees to resume bidding and booking.',
    });
    setContractFilter('unpaid_fees');
    setActiveTab('contracts');
  };

  // Counts for sidebar
  const openCargoCount = cargoListings.filter(c => canBidCargoStatus(c.status)).length;
  const availableTrucksCount = truckListings.filter(t => canBookTruckStatus(t.status)).length;
  const activeShipmentsCount = activeShipments.length;
  const pendingContractsCount = contracts.filter(c => c.status === 'draft').length;
  const activeContractsCount = contracts.filter(c => c.status === 'signed' || c.status === 'in_transit').length;

  // Activity badge (combined bids + contracts)
  const activityBadge = useMemo(
    () => unreadBids + pendingContractsCount,
    [unreadBids, pendingContractsCount]
  );

  // Filter listings
  const filteredCargoListings = cargoListings.filter(cargo => {
    // Shippers only see their own cargo; truckers/brokers/guests see all
    if (!isGuestUser && userRole === 'shipper' && !isBroker) {
      if (!(cargo.shipperId === authUser.uid || cargo.userId === authUser.uid)) return false;
    }
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
  });

  const filteredTruckListings = truckListings.filter(truck => {
    // Truckers only see their own truck(s); shippers/brokers/guests see all
    if (!isGuestUser && userRole === 'trucker' && !isBroker) {
      if (!(truck.truckerId === authUser.uid || truck.userId === authUser.uid)) return false;
    }
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
  });

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

  const handleRequestListingChat = async (listing, listingType) => {
    if (!listing?.id) {
      showToast({
        type: 'error',
        title: 'Unable to request chat',
        message: 'Listing information is incomplete.',
      });
      return;
    }

    try {
      await api.listings.requestChat({
        listingId: listing.id,
        listingType,
        note: `Interested in discussing ${listing.origin || 'origin'} -> ${listing.destination || 'destination'}.`,
      });
      showToast({
        type: 'success',
        title: 'Chat Request Sent',
        message: 'The listing owner has been notified. You can bid anytime.',
      });
    } catch (error) {
      console.error('Failed to request chat:', error);
      showToast({
        type: 'error',
        title: 'Request failed',
        message: getUserErrorMessage(error, 'Could not send chat request. Please try again.'),
      });
    }
  };

  const handleContactShipper = (cargo) => {
    requireAuth(() => handleRequestListingChat(cargo, 'cargo'), 'Sign in to request chat');
  };

  const handleContactTrucker = (truck) => {
    requireAuth(() => handleRequestListingChat(truck, 'truck'), 'Sign in to request chat');
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

  const handleProfileClick = () => {
    requireAuth(() => setActiveTab('profile'), 'Sign in to view profile');
  };

  const handleBrokerClick = () => {
    requireAuth(() => setActiveTab('broker'), 'Sign in to access broker dashboard');
  };

  const handleEditProfile = () => {
    requireAuth(() => setActiveTab('profile'), 'Sign in to edit profile');
  };

  const handleNotificationSettings = () => {
    requireAuth(() => setActiveTab('notifications'), 'Sign in to manage notifications');
  };

  const handleHelpSupport = () => {
    setShowOnboardingGuide(true);
  };

  const handleOnboardingClose = async () => {
    setShowOnboardingGuide(false);
    if (authUser?.uid) {
      try {
        await updateDoc(doc(db, 'users', authUser.uid), {
          onboardingComplete: true,
          updatedAt: serverTimestamp(),
        });
      } catch (e) {
        console.warn('Could not persist onboarding completion:', e?.code || e?.message);
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
    setShowAdminDashboard(true);
  };

  const handleBackFromAdmin = () => {
    setShowAdminDashboard(false);
  };

  const handleTrackLive = () => {
    if (!authUser) {
      requireAuth(() => setActiveTab('tracking'), 'Sign in to track shipments live');
      return;
    }

    setActiveTab('tracking');
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
      throw error;
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
        message: 'Contract created successfully. Please review and sign. Platform fee will be due 3 days after pickup.',
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
    // Data can be: { bidId, contractId } or { bid, listing, platformFee }
    if (data.contractId && !data.bid) {
      // Fetch contract and bid data
      try {
        const contractDoc = await getDoc(doc(db, 'contracts', data.contractId));
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

  // Handler: Sign contract
  const handleSignContract = async (contractId) => {
    setContractLoading(true);
    try {
      const response = await api.contracts.sign(contractId);
      showToast({
        type: 'bid-accepted',
        title: response.fullyExecuted ? 'Contract Signed!' : 'Signature Recorded',
        message: response.fullyExecuted
          ? 'Both parties signed. Shipment tracking is now active.'
          : 'Waiting for the other party to sign.',
      });
      if (response.fullyExecuted) {
        closeModal('contract');
        setActiveTab('tracking');
      }
    } catch (error) {
      console.error('Error signing contract:', error);
      showToast({
        type: 'error',
        title: 'Error',
        message: error.message || 'Failed to sign contract',
      });
    } finally {
      setContractLoading(false);
    }
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

  // Handler: Activate broker
  const handleActivateBroker = async () => {
    try {
      await api.broker.register();
      await handleBrokerConverted();
      showToast({
        type: 'success',
        title: 'Broker Activated!',
        message: 'Start sharing your referral link to earn commissions.',
      });
      setActiveTab('broker'); // Navigate to broker dashboard
    } catch (error) {
      console.error('Broker activation error:', error);
      showToast({
        type: 'error',
        title: 'Activation Failed',
        message: error.message || 'Could not activate broker features.',
      });
    }
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
    const listingType = bid.listingType || notificationData.listingType || (bid.cargoListingId ? 'cargo' : 'truck');
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
    if (!bidId) {
      setActiveTab('chat');
      return;
    }

    try {
      const { bid, listing, listingType } = await loadBidContext(bidId, notification.data);
      openModal('chat', { bid, listing, type: listingType, bidId: bid.id });
      setActiveTab('chat');
    } catch (error) {
      console.error('Failed to open chat notification:', error);
      setActiveTab('chat');
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

  const handleOpenListingFromNotification = async (notification) => {
    const listingId = notification?.data?.listingId;
    const listingType = notification?.data?.listingType;
    if (!listingId || !listingType) {
      setActiveTab('home');
      return;
    }

    try {
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

  const handleOpenListingFromReferral = async (referralItem) => {
    const listingId = referralItem?.listingId;
    const listingType = referralItem?.listingType;
    if (!listingId || !listingType) {
      showToast({
        type: 'error',
        title: 'Invalid referral',
        message: 'Listing details are unavailable for this referral.',
      });
      return;
    }

    try {
      await openListingByType(listingId, listingType);
      setActiveTab('home');
    } catch (error) {
      console.error('Failed to open referred listing:', error);
      showToast({
        type: 'error',
        title: 'Unable to open listing',
        message: error.message || 'The listing may no longer be available.',
      });
    }
  };

  // If admin dashboard is open, render it instead of main app
  if (showAdminDashboard && isAdmin) {
    return <AdminDashboard onBackToApp={handleBackFromAdmin} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
        unreadNotifications={unreadNotifications}
        userInitial={userInitial}
        currentRole={userRole}
        isBroker={isBroker}
        onLogout={handleLogout}
        onNotificationClick={handleNotificationClick}
        onProfileClick={handleProfileClick}
        onBrokerClick={handleBrokerClick}
        onEditProfile={handleEditProfile}
        onNotificationSettings={handleNotificationSettings}
        onHelpSupport={handleHelpSupport}
        user={{
          name: userProfile?.name || 'User',
          initial: userInitial,
          rating: userProfile?.rating || 0,
          tripsCompleted: userProfile?.tripsCompleted || 0,
          avatarUrl: userProfile?.avatarUrl,
        }}
      />

      <div className="flex h-[calc(100vh-73px)]">
        {/* Sidebar - Desktop only */}
        <Sidebar
          className="hidden lg:flex"
          currentRole={userRole}
          activeMarket={activeMarket}
          onMarketChange={setActiveMarket}
          cargoCount={cargoListings.length}
          truckCount={truckListings.length}
          openCargoCount={openCargoCount}
          availableTrucksCount={availableTrucksCount}
          activeShipmentsCount={activeShipmentsCount}
          pendingContractsCount={pendingContractsCount}
          activeContractsCount={activeContractsCount}
          isAdmin={isAdmin}
          pendingPaymentsCount={pendingPaymentsCount}
          onPostClick={handlePostClick}
          onRouteOptimizerClick={userRole === 'trucker' ? handleRouteOptimizerClick : undefined}
          onMyBidsClick={() => requireAuth(() => setActiveTab('bids'), 'Sign in to view your bids')}
          onContractsClick={handleContractsClick}
          onBrokerClick={handleBrokerClick}
          isBroker={isBroker}
          onPaymentReviewClick={isAdmin ? handlePaymentReviewClick : undefined}
        />

        {/* Main Content */}
        {activeTab === 'home' && (
          <ErrorBoundary>
            <HomeView
              activeMarket={activeMarket}
              onMarketChange={setActiveMarket}
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
              onContactShipper={handleContactShipper}
              onContactTrucker={handleContactTrucker}
              onViewMap={handleViewMap}
              onReferListing={handleReferListing}
              currentRole={userRole}
              currentUserId={authUser?.uid}
              darkMode={darkMode}
              activeShipments={activeShipments.filter(s => s.status !== 'delivered')}
              onTrackLive={handleTrackLive}
              onRouteOptimizerClick={userRole === 'trucker' ? handleRouteOptimizerClick : undefined}
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
            />
          </ErrorBoundary>
        )}

        {activeTab === 'activity' && (
          <ErrorBoundary>
            <ActivityView
              currentUser={currentUser}
              currentRole={userRole}
              darkMode={darkMode}
              onOpenChat={(bid, listing) => {
                openModal('chat', { bid, listing, type: bid.listingType, bidId: bid.id });
              }}
              onOpenContract={handleOpenContract}
              onBrowseMarketplace={() => {
                setActiveMarket(userRole === 'trucker' ? 'cargo' : 'trucks');
                setActiveTab('home');
              }}
              onCreateListing={handlePostClick}
              onOpenMessages={() => setActiveTab('messages')}
              onOpenListing={handleOpenListingFromReferral}
              unreadBids={unreadBids}
              pendingContractsCount={pendingContractsCount}
              isBroker={isBroker}
              initialMode={activityInitialMode}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'tracking' && (
          <ErrorBoundary>
            <TrackingView
              shipments={activeShipments}
              activeShipments={activeShipments.filter(s => s.status !== 'delivered')}
              deliveredShipments={activeShipments.filter(s => s.status === 'delivered')}
              loading={false}
              currentRole={userRole}
              currentUserId={authUser?.uid}
              darkMode={darkMode}
              onLocationUpdate={emitShipmentUpdate}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'notifications' && authUser && (
          <ErrorBoundary>
            <NotificationsView
              notifications={firebaseNotifications}
              loading={false}
              unreadCount={unreadNotifications}
              currentUserId={authUser?.uid}
              onMarkAsRead={markNotificationRead}
              onMarkAllAsRead={markAllNotificationsRead}
              onOpenBid={handleOpenBidFromNotification}
              onOpenChat={handleOpenChatFromNotification}
              onOpenListing={handleOpenListingFromNotification}
              onOpenContract={handleOpenContract}
              onPayPlatformFee={handlePayPlatformFee}
              onBrowseMarketplace={() => setActiveTab('home')}
              onOpenActivity={() => setActiveTab('activity')}
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

        {activeTab === 'profile' && <ErrorBoundary><ProfilePage /></ErrorBoundary>}

        {activeTab === 'broker' && (
          <ErrorBoundary>
            <BrokerView
              authUser={authUser}
              isBroker={isBroker}
              brokerProfile={brokerProfile}
              onOpenBrokerActivity={() => {
                setActivityInitialMode('broker');
                setActiveTab('activity');
              }}
              onBrokerRegistered={() => {
                showToast({
                  type: 'success',
                  title: 'Broker Activated',
                  message: 'You can now share your referral link and request payouts.',
                });
              }}
              onToast={showToast}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'bids' && authUser && (
          <ErrorBoundary>
            <BidsView
              currentUser={authUser}
              currentRole={userRole}
              onOpenChat={(bid, listing) => {
                openModal('chat', { bid, listing, type: bid.listingType, bidId: bid.id });
              }}
              onBrowseMarketplace={() => {
                setActiveMarket(userRole === 'trucker' ? 'cargo' : 'trucks');
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
              {userRole === 'trucker' ? 'My Bids' : 'My Bookings'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Please sign in to view your {userRole === 'trucker' ? 'bids' : 'bookings'}.
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
          <main className="flex-1 p-4 lg:p-8">
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Messages
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Please sign in to view your conversations.
            </p>
            <button
              onClick={() => promptSignInForTab('messages', 'Sign in to view messages')}
              className="mt-4 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors"
            >
              Sign in
            </button>
          </main>
        )}

        {activeTab === 'contracts' && (
          <ErrorBoundary>
            <ContractsView
              darkMode={darkMode}
              currentUser={{ id: authUser?.uid, ...userProfile }}
              onOpenContract={handleOpenContract}
              onBrowseMarketplace={() => setActiveTab('home')}
              onOpenActivity={() => setActiveTab('activity')}
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
      </div>

      {/* Mobile Navigation */}
      <MobileNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onPostClick={handlePostClick}
        unreadMessages={unreadMessages}
        activityBadge={activityBadge}
        currentRole={userRole}
      />

      {/* Modals */}
      <ErrorBoundary>
      <PostModal
        open={modals.post}
        onClose={() => closeModal('post')}
        currentRole={userRole}
        loading={postLoading}
        onSubmit={async (data) => {
          if (!authUser?.uid || !userProfile) {
            console.error('User not authenticated');
            return;
          }

          setPostLoading(true);
          try {
            if (userRole === 'shipper') {
              // Upload photos first (if any)
              const photoUrls = await uploadListingPhotos(authUser.uid, data.photos || [], 'cargo');

              // Create cargo listing
              const listingData = {
                origin: data.origin,
                destination: data.destination,
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
            markEngagement();
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

      <BidModal
        open={modals.bid}
        onClose={() => closeModal('bid')}
        listing={getModalData('bid')}
        currentRole={userRole}
        isSuspended={isAccountSuspended}
        loading={bidLoading}
        onSubmit={async (data) => {
          const listing = getModalData('bid');
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
            const listingType = listing.trucker ? 'truck' : 'cargo';

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
              message: data.message,
              cargoDescription: listing.cargoDescription || listing.cargoType,
              ownerId: listing.userId || listing.shipperId || listing.truckerId,
            });

            markEngagement();
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

      {/* Map Modal */}
      {modals.map && getModalData('map') && (
        <FullMapModal
          listing={getModalData('map')}
          darkMode={darkMode}
          onClose={() => closeModal('map')}
        />
      )}

      {/* Cargo Details Modal */}
      <CargoDetailsModal
        open={modals.cargoDetails}
        onClose={() => closeModal('cargoDetails')}
        cargo={getModalData('cargoDetails')}
        currentRole={userRole}
        isOwner={getModalData('cargoDetails') && isCargoOwner(getModalData('cargoDetails'))}
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
          && getModalData('cargoDetails')
          && !isCargoOwner(getModalData('cargoDetails'))
          && canBidCargoStatus(getModalData('cargoDetails')?.status)
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
          const cargo = getModalData('cargoDetails');
          if (!cargo || !authUser || userRole !== 'trucker') return null;
          // Find user's bid for this cargo from myBids
          const userBid = myBids.find(bid => bid.cargoListingId === cargo.id);
          return userBid?.id || null;
        })()}
        darkMode={darkMode}
      />

      {/* Truck Details Modal */}
      <TruckDetailsModal
        open={modals.truckDetails}
        onClose={() => closeModal('truckDetails')}
        truck={getModalData('truckDetails')}
        currentRole={userRole}
        isOwner={getModalData('truckDetails') && isTruckOwner(getModalData('truckDetails'))}
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
          && getModalData('truckDetails')
          && !isTruckOwner(getModalData('truckDetails'))
          && canBookTruckStatus(getModalData('truckDetails')?.status)
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

      <ReferListingModal
        open={modals.referListing}
        onClose={() => closeModal('referListing')}
        listing={getModalData('referListing')?.listing || null}
        listingType={getModalData('referListing')?.listingType || 'cargo'}
        onToast={showToast}
      />

      {/* Chat Modal */}
      <ChatModal
        open={modals.chat}
        onClose={() => closeModal('chat')}
        data={getModalData('chat')}
        currentUser={authUser}
        onOpenContract={handleOpenContract}
      />

      {/* Route Optimizer Modal */}
      <RouteOptimizerModal
        open={modals.routeOptimizer}
        onClose={() => closeModal('routeOptimizer')}
        initialOrigin={getModalData('routeOptimizer')?.origin}
        initialDestination={getModalData('routeOptimizer')?.destination}
        savedRoutes={savedRoutes}
        onSaveRoute={handleSaveRoute}
        onApplySavedRoute={handleApplySavedRoute}
        onDeleteSavedRoute={handleDeleteSavedRoute}
      />

      {/* My Bids Modal */}
      <MyBidsModal
        open={modals.myBids}
        onClose={() => closeModal('myBids')}
        currentUser={authUser}
        currentRole={userRole}
        onOpenChat={(bid, listing) => {
          closeModal('myBids');
          openModal('chat', { bid, listing, type: bid.listingType, bidId: bid.id });
        }}
      />

      {/* GCash Payment Modal (replaces PlatformFeeModal) */}
      <GCashPaymentModal
        open={modals.platformFee}
        onClose={() => {
          closeModal('platformFee');
          setPendingContractData(null);
        }}
        data={getModalData('platformFee')}
        onContractCreated={handleContractCreated}
      />

      {/* Contract Modal */}
      <ContractModal
        open={modals.contract}
        onClose={() => closeModal('contract')}
        contract={getModalData('contract')}
        currentUser={{ id: authUser?.uid, ...userProfile }}
        onSign={handleSignContract}
        onComplete={handleCompleteContract}
        onPayPlatformFee={handlePayPlatformFee}
        loading={contractLoading}
      />

      <RatingModal
        open={!!ratingTarget}
        onClose={() => setRatingTarget(null)}
        contract={ratingTarget?.contract}
        userToRate={ratingTarget?.userToRate}
        onSubmit={handleSubmitRating}
        loading={ratingLoading}
      />

      {/* Wallet Modal removed - using direct GCash payment */}

      {/* Edit Cargo Modal (uses PostModal in edit mode) */}
      <PostModal
        open={modals.editCargo}
        onClose={() => closeModal('editCargo')}
        currentRole="shipper"
        editMode={true}
        existingData={getModalData('editCargo')}
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

      {/* Edit Truck Modal (uses PostModal in edit mode) */}
      <PostModal
        open={modals.editTruck}
        onClose={() => closeModal('editTruck')}
        currentRole="trucker"
        editMode={true}
        existingData={getModalData('editTruck')}
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

      {/* Toast Notifications for Real-Time Events */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "flex items-start gap-3 p-4 rounded-xl shadow-lg border backdrop-blur-sm animate-in slide-in-from-right-5 duration-300",
              toast.type === 'bid' && "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
              toast.type === 'bid-accepted' && "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
              toast.type === 'message' && "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800",
              toast.type === 'tracking' && "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800",
              !['bid', 'bid-accepted', 'message', 'tracking'].includes(toast.type) && "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
            )}
          >
            <div className={cn(
              "size-8 rounded-full flex items-center justify-center flex-shrink-0",
              toast.type === 'bid' && "bg-green-500",
              toast.type === 'bid-accepted' && "bg-blue-500",
              toast.type === 'message' && "bg-purple-500",
              toast.type === 'tracking' && "bg-orange-500",
              !['bid', 'bid-accepted', 'message', 'tracking'].includes(toast.type) && "bg-gray-500"
            )}>
              {toast.type === 'bid' && <span className="text-white text-sm">₱</span>}
              {toast.type === 'bid-accepted' && <span className="text-white text-sm">✓</span>}
              {toast.type === 'message' && <span className="text-white text-sm">💬</span>}
              {toast.type === 'tracking' && <span className="text-white text-sm">📍</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-900 dark:text-white">
                {toast.title}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                {toast.message}
              </p>
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              ×
            </button>
          </div>
        ))}
      </div>
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
      />

      {/* Onboarding Guide Modal - shown on first login and re-accessible from Help & Support */}
      <OnboardingGuideModal
        open={showOnboardingGuide}
        onClose={handleOnboardingClose}
        userRole={currentRole || 'shipper'}
        userName={userProfile?.name || ''}
      />

      {/* In-app browser redirect overlay (Facebook, Instagram, etc.) */}
      {showInAppOverlay && (
        <InAppBrowserOverlay
          platform={platform}
          browserName={inAppBrowserName}
          onOpenBrowser={() => {
            const url = buildAndroidIntentUrl(window.location.href);
            if (url) window.location.href = url;
          }}
          onDismiss={dismissInAppOverlay}
        />
      )}

      {/* PWA Install Prompt (Android/Desktop banner or iOS Safari instructions) */}
      <PWAInstallPrompt
        showInstallBanner={showInstallBanner}
        triggerInstall={triggerInstall}
        dismissInstallBanner={dismissInstallBanner}
        showIOSInstall={showIOSInstall}
        dismissIOSInstall={dismissIOSInstall}
      />
    </div>
  );
}
