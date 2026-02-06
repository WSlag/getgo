/**
 * GetGo App - Refactored UI with new design system
 * This is the new main app component that uses the enhanced UI components
 * while preserving all existing Firebase functionality
 */

import React, { useState, useEffect } from 'react';
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
  markNotificationRead,
  markAllNotificationsRead,
} from './services/firestoreService';

// Hooks
import { useAuth } from './contexts/AuthContext';
import { useCargoListings } from './hooks/useCargoListings';
import { useTruckListings } from './hooks/useTruckListings';
import { useNotifications } from './hooks/useNotifications';
import { useWallet } from './hooks/useWallet';
import { useShipments } from './hooks/useShipments';
import { useTheme } from './hooks/useTheme';
import { useMarketplace } from './hooks/useMarketplace';
import { useModals } from './hooks/useModals';
import { useSocket } from './hooks/useSocket';
import { useAuthGuard } from './hooks/useAuthGuard';

// Layout Components
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';

// View Components
import { HomeView } from '@/views/HomeView';
import { TrackingView } from '@/views/TrackingView';
import { AdminPaymentsView } from '@/views/AdminPaymentsView';
import { ProfilePage } from '@/components/profile/ProfilePage';
import { AdminDashboard } from '@/views/admin/AdminDashboard';

// Modal Components
import { PostModal, BidModal, CargoDetailsModal, TruckDetailsModal, ChatModal, RouteOptimizerModal, MyBidsModal, PlatformFeeModal, ContractModal, NotificationsModal, WalletModal } from '@/components/modals';
import { FullMapModal } from '@/components/maps';
import AuthModal from '@/components/auth/AuthModal';

// API
import api from './services/api';

export default function GetGoApp() {
  // Firebase Auth
  const {
    authUser,
    userProfile,
    shipperProfile,
    truckerProfile,
    currentRole,
    switchRole,
    logout,
    isAdmin,
  } = useAuth();

  // Firebase Data Hooks - fetch ALL listings, filter in view layer
  const { listings: firebaseCargoListings, loading: cargoLoading } = useCargoListings();
  const { listings: firebaseTruckListings, loading: truckLoading } = useTruckListings();
  const { notifications: firebaseNotifications, unreadCount: firebaseUnreadCount } = useNotifications(authUser?.uid);
  const { balance: firebaseWalletBalance, transactions: firebaseWalletTransactions, loading: walletLoading } = useWallet(authUser?.uid);
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

  // Auth Guard for protected actions
  const {
    requireAuth,
    showAuthModal,
    setShowAuthModal,
    pendingActionTitle,
    executePendingAction,
    clearPendingAction,
  } = useAuthGuard();

  // Loading states for form submissions
  const [postLoading, setPostLoading] = useState(false);
  const [bidLoading, setBidLoading] = useState(false);
  const [contractLoading, setContractLoading] = useState(false);

  // Pending contract data (after fee payment)
  const [pendingContractData, setPendingContractData] = useState(null);

  // Admin: Dashboard view state
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);

  // Admin: Pending payments count
  const [pendingPaymentsCount, setPendingPaymentsCount] = useState(0);

  // Toast notification state for real-time events
  const [toasts, setToasts] = useState([]);

  // Show toast notification
  const showToast = (toast) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, ...toast }]);
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

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

  // Fetch pending payments count for admin users
  useEffect(() => {
    if (!isAdmin) {
      setPendingPaymentsCount(0);
      return;
    }

    const fetchPendingCount = async () => {
      try {
        const data = await api.admin.getPaymentStats();
        setPendingPaymentsCount(data.stats?.pendingReview || 0);
      } catch (error) {
        console.error('Error fetching pending payments count:', error);
      }
    };

    fetchPendingCount();
    // Refresh every 30 seconds
    const interval = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  // Use Firebase data directly - no sample data fallback
  const userRole = currentRole || 'shipper';
  const cargoListings = firebaseCargoListings;
  const truckListings = firebaseTruckListings;
  const activeShipments = firebaseActiveShipments || [];
  const unreadNotifications = firebaseUnreadCount || 0;
  const walletBalance = firebaseWalletBalance || 0;

  // Counts for sidebar
  const openCargoCount = cargoListings.filter(c => c.status === 'open').length;
  const availableTrucksCount = truckListings.filter(t => t.status === 'available' || t.status === 'open').length;
  const activeShipmentsCount = activeShipments.length;

  // Filter listings
  const filteredCargoListings = cargoListings.filter(cargo => {
    if (filterStatus !== 'all' && cargo.status !== filterStatus) return false;
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
    const truckStatus = truck.status === 'available' ? 'open' : truck.status;
    if (filterStatus !== 'all' && truckStatus !== filterStatus) return false;
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
    requireAuth(() => openModal('bid', cargo), 'Sign in to place a bid');
  };

  const handleBookTruck = (truck) => {
    requireAuth(() => openModal('bid', truck), 'Sign in to book a truck');
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

  const handleContactShipper = (cargo) => {
    requireAuth(() => openModal('chat', { listing: cargo, type: 'cargo' }), 'Sign in to contact shipper');
  };

  const handleContactTrucker = (truck) => {
    requireAuth(() => openModal('chat', { listing: truck, type: 'truck' }), 'Sign in to contact trucker');
  };

  const handleViewMap = (listing) => {
    openModal('map', listing);
  };

  const handleNotificationClick = () => {
    requireAuth(() => openModal('notifications'), 'Sign in to view notifications');
  };

  const handleProfileClick = () => {
    requireAuth(() => setActiveTab('profile'), 'Sign in to view profile');
  };

  const handleEditProfile = () => {
    requireAuth(() => setActiveTab('profile'), 'Sign in to edit profile');
  };

  const handleNotificationSettings = () => {
    requireAuth(() => openModal('notifications'), 'Sign in to manage notifications');
  };

  const handleHelpSupport = () => {
    // Could open a help modal or redirect to support page
    window.open('mailto:support@getgo.ph', '_blank');
  };

  const handleWalletClick = () => {
    requireAuth(() => openModal('wallet'), 'Sign in to view wallet');
  };

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

  const handlePaymentReviewClick = () => {
    setShowAdminDashboard(true);
  };

  const handleBackFromAdmin = () => {
    setShowAdminDashboard(false);
  };

  // Accept/Reject bid handlers
  const handleAcceptBid = async (bid, listing, listingType) => {
    try {
      // Use Firestore service for bid acceptance
      await acceptBid(bid.id, bid, listing, listingType);
      showToast({
        type: 'bid-accepted',
        title: 'Bid Accepted',
        message: `You accepted ${bid.bidderName || 'the bid'} for ₱${bid.price?.toLocaleString()}`,
      });
      // Close modal - data will refresh via Firestore real-time updates
      closeModal('cargoDetails');
      closeModal('truckDetails');
    } catch (error) {
      console.error('Error accepting bid:', error);
      showToast({
        type: 'error',
        title: 'Error',
        message: error.message || 'Failed to accept bid',
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
        message: error.message || 'Failed to reject bid',
      });
      throw error;
    }
  };

  // Contract Creation Flow Handlers
  const handleCreateContract = async (bid, listing) => {
    const platformFee = Math.round(bid.price * 0.05); // 5%

    // Store bid/listing for after payment
    setPendingContractData({ bid, listing, platformFee });

    // Open platform fee payment modal
    openModal('platformFee', { bid, listing, platformFee });
  };

  // Handler: After fee is paid, create the contract
  const handleFeePaymentComplete = async (bidId, feeAmount) => {
    if (!pendingContractData) return;

    const { bid, listing } = pendingContractData;

    try {
      // First pay the platform fee
      await api.wallet.payPlatformFee(bidId, feeAmount);

      // Then create the contract
      const response = await api.contracts.create({
        bidId: bid.id,
        declaredCargoValue: (listing.askingPrice || bid.price) * 2,
      });

      showToast({
        type: 'bid-accepted',
        title: 'Contract Created',
        message: `Contract #${response.contract.contractNumber} ready for signing`,
      });

      closeModal('platformFee');
      setPendingContractData(null);

      // Open contract modal for signing
      openModal('contract', response.contract);
    } catch (error) {
      console.error('Error creating contract:', error);
      showToast({
        type: 'error',
        title: 'Error',
        message: error.message || 'Failed to create contract',
      });
      throw error;
    }
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
      await api.contracts.complete(contractId);
      showToast({
        type: 'bid-accepted',
        title: 'Delivery Confirmed!',
        message: 'Contract completed. Please rate your experience.',
      });
      closeModal('contract');
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

  // Handler: Open wallet top-up (from platform fee modal)
  const handleTopUpFromFee = () => {
    closeModal('platformFee');
    openModal('wallet');
  };

  // Handler: Wallet top-up
  const handleWalletTopUp = async (amount, method) => {
    try {
      const response = await api.wallet.topUp({ amount, method });
      showToast({
        type: 'bid-accepted',
        title: 'Top Up Successful',
        message: `Added ₱${amount.toLocaleString()} to your wallet`,
      });
      return response;
    } catch (error) {
      console.error('Top-up error:', error);
      throw error;
    }
  };

  // Handler: Wallet payout
  const handleWalletPayout = async (amount, method) => {
    try {
      const response = await api.wallet.payout({ amount, method });
      showToast({
        type: 'bid-accepted',
        title: 'Payout Requested',
        message: `Payout of ₱${amount.toLocaleString()} is being processed`,
      });
      return response;
    } catch (error) {
      console.error('Payout error:', error);
      throw error;
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
        walletBalance={walletBalance}
        currentRole={userRole}
        onLogout={handleLogout}
        onWalletClick={handleWalletClick}
        onNotificationClick={handleNotificationClick}
        onProfileClick={handleProfileClick}
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

      <div className="flex min-h-[calc(100vh-73px)]">
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
          isAdmin={isAdmin}
          pendingPaymentsCount={pendingPaymentsCount}
          onPostClick={handlePostClick}
          onRouteOptimizerClick={userRole === 'trucker' ? handleRouteOptimizerClick : undefined}
          onMyBidsClick={() => requireAuth(() => openModal('myBids'), 'Sign in to view your bids')}
          onPaymentReviewClick={isAdmin ? handlePaymentReviewClick : undefined}
        />

        {/* Main Content */}
        {activeTab === 'home' && (
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
            currentRole={userRole}
            currentUserId={authUser?.uid}
            darkMode={darkMode}
          />
        )}

        {activeTab === 'tracking' && (
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
        )}

        {activeTab === 'notifications' && (
          <main className="flex-1 p-4 lg:p-8">
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Notifications
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              View your notifications here. (Integration pending)
            </p>
          </main>
        )}

        {activeTab === 'profile' && <ProfilePage />}

        {activeTab === 'bids' && (
          <main className="flex-1 p-4 lg:p-8">
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-4">
              {userRole === 'trucker' ? 'My Bids' : 'My Bookings'}
            </h2>
            {authUser ? (
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Click below to view and manage your {userRole === 'trucker' ? 'cargo bids' : 'truck bookings'}.
              </p>
            ) : (
              <p className="text-gray-600 dark:text-gray-400">
                Please sign in to view your {userRole === 'trucker' ? 'bids' : 'bookings'}.
              </p>
            )}
            {authUser && (
              <button
                onClick={() => openModal('myBids')}
                className="px-6 py-3 bg-gradient-to-r from-orange-400 to-orange-600 text-white font-medium rounded-xl shadow-lg shadow-orange-500/30 hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-300"
              >
                View {userRole === 'trucker' ? 'My Bids' : 'My Bookings'}
              </button>
            )}
          </main>
        )}

        {activeTab === 'chat' && (
          <main className="flex-1 p-4 lg:p-8">
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Messages
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              View your conversations here. (Integration pending)
            </p>
          </main>
        )}

        {activeTab === 'adminPayments' && isAdmin && (
          <AdminPaymentsView darkMode={darkMode} />
        )}
      </div>

      {/* Mobile Navigation */}
      <MobileNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onPostClick={handlePostClick}
        unreadMessages={0}
        unreadBids={0}
        unreadNotifications={unreadNotifications}
        currentRole={userRole}
      />

      {/* Modals */}
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
              console.log('Cargo listing created successfully');
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
              console.log('Truck listing created successfully');
            }
            closeModal('post');
          } catch (error) {
            console.error('Error creating listing:', error);
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
        loading={bidLoading}
        onSubmit={async (data) => {
          const listing = getModalData('bid');
          if (!authUser?.uid || !userProfile || !listing) {
            console.error('Missing required data for bid');
            return;
          }

          setBidLoading(true);
          try {
            // Determine listing type based on presence of trucker field
            const listingType = listing.trucker ? 'truck' : 'cargo';

            const bidData = {
              price: data.amount,
              message: data.message || '',
              cargoType: data.cargoType || null,
              cargoWeight: data.cargoWeight || null,
            };

            await createBid(authUser.uid, userProfile, listing, listingType, bidData);
            console.log('Bid created successfully');

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

            closeModal('bid');
          } catch (error) {
            console.error('Error creating bid:', error);
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
        onEdit={handleEditCargo}
        onBid={(cargo) => {
          closeModal('cargoDetails');
          openModal('bid', cargo);
        }}
        onOpenChat={(bid, listing) => {
          closeModal('cargoDetails');
          openModal('chat', { bid, listing, type: 'cargo', bidId: bid.id });
        }}
        onAcceptBid={handleAcceptBid}
        onRejectBid={handleRejectBid}
        onCreateContract={(bid, listing) => {
          closeModal('cargoDetails');
          handleCreateContract(bid, listing);
        }}
        darkMode={darkMode}
      />

      {/* Truck Details Modal */}
      <TruckDetailsModal
        open={modals.truckDetails}
        onClose={() => closeModal('truckDetails')}
        truck={getModalData('truckDetails')}
        currentRole={userRole}
        isOwner={getModalData('truckDetails') && isTruckOwner(getModalData('truckDetails'))}
        onEdit={handleEditTruck}
        onBook={(truck) => {
          closeModal('truckDetails');
          openModal('bid', truck);
        }}
        onOpenChat={(bid, listing) => {
          closeModal('truckDetails');
          openModal('chat', { bid, listing, type: 'truck', bidId: bid.id });
        }}
        onAcceptBid={handleAcceptBid}
        onRejectBid={handleRejectBid}
        onCreateContract={(bid, listing) => {
          closeModal('truckDetails');
          handleCreateContract(bid, listing);
        }}
        darkMode={darkMode}
      />

      {/* Chat Modal */}
      <ChatModal
        open={modals.chat}
        onClose={() => closeModal('chat')}
        data={getModalData('chat')}
        currentUser={authUser}
      />

      {/* Route Optimizer Modal */}
      <RouteOptimizerModal
        open={modals.routeOptimizer}
        onClose={() => closeModal('routeOptimizer')}
        initialOrigin={getModalData('routeOptimizer')?.origin}
        initialDestination={getModalData('routeOptimizer')?.destination}
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

      {/* Platform Fee Modal */}
      <PlatformFeeModal
        open={modals.platformFee}
        onClose={() => closeModal('platformFee')}
        data={getModalData('platformFee')}
        walletBalance={walletBalance}
        onPaymentComplete={handleFeePaymentComplete}
        onTopUp={handleTopUpFromFee}
        loading={contractLoading}
      />

      {/* Contract Modal */}
      <ContractModal
        open={modals.contract}
        onClose={() => closeModal('contract')}
        contract={getModalData('contract')}
        currentUser={{ id: authUser?.uid, ...userProfile }}
        onSign={handleSignContract}
        onComplete={handleCompleteContract}
        loading={contractLoading}
      />

      {/* Notifications Modal */}
      <NotificationsModal
        open={modals.notifications}
        onClose={() => closeModal('notifications')}
        notifications={firebaseNotifications}
        loading={false}
        onMarkAsRead={markNotificationRead}
        onMarkAllAsRead={markAllNotificationsRead}
        currentUserId={authUser?.uid}
      />

      {/* Wallet Modal */}
      <WalletModal
        open={modals.wallet}
        onClose={() => closeModal('wallet')}
        walletBalance={walletBalance}
        transactions={firebaseWalletTransactions || []}
        loading={walletLoading}
        onTopUp={handleWalletTopUp}
        onPayout={handleWalletPayout}
      />

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
            console.log('Cargo listing updated successfully');
            closeModal('editCargo');
          } catch (error) {
            console.error('Error updating cargo listing:', error);
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
            console.log('Truck listing updated successfully');
            closeModal('editTruck');
          } catch (error) {
            console.error('Error updating truck listing:', error);
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
    </div>
  );
}
