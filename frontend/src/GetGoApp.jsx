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
import { ProfilePage } from '@/components/profile/ProfilePage';

// Modal Components
import { PostModal, BidModal, CargoDetailsModal, TruckDetailsModal, ChatModal, RouteOptimizerModal } from '@/components/modals';
import { FullMapModal } from '@/components/maps';
import AuthModal from '@/components/auth/AuthModal';

// Sample Data (fallback for demo)
const sampleCargoListings = [
  {
    id: 'C1',
    shipper: 'ABC Trading',
    shipperTransactions: 45,
    origin: 'Davao City',
    destination: 'Cebu City',
    originCoords: { lat: 7.0707, lng: 125.6087 },
    destCoords: { lat: 10.3157, lng: 123.8854 },
    weight: 12,
    unit: 'tons',
    cargoType: 'General Merchandise',
    vehicleNeeded: '10W Wing Van',
    askingPrice: 18000,
    description: 'Assorted dry goods, palletized. 24 pallets total, properly wrapped.',
    pickupDate: '2026-01-26',
    status: 'open',
    postedAt: Date.now() - 2 * 60 * 60 * 1000,
    cargoPhotos: [
      'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400',
      'https://images.unsplash.com/photo-1553413077-190dd305871c?w=400',
    ],
    bids: [
      { id: 'B1', bidder: 'Juan Trucking', amount: 17500 },
      { id: 'B2', bidder: 'Mindanao Haulers', amount: 19000 },
    ],
    distance: '408 km',
    estimatedTime: '5 days',
    gradientClass: 'bg-gradient-to-r from-orange-400 to-orange-600',
  },
  {
    id: 'C2',
    shipper: 'Fresh Farms Inc.',
    shipperTransactions: 12,
    origin: 'General Santos',
    destination: 'Davao City',
    originCoords: { lat: 6.1164, lng: 125.1716 },
    destCoords: { lat: 7.0707, lng: 125.6087 },
    weight: 8,
    unit: 'tons',
    cargoType: 'Fruits & Vegetables',
    vehicleNeeded: '6W Forward',
    askingPrice: 8500,
    description: 'Fresh bananas and mangoes. Temperature sensitive, need early morning delivery.',
    pickupDate: '2026-01-25',
    status: 'waiting',
    postedAt: Date.now() - 5 * 60 * 60 * 1000,
    cargoPhotos: [
      'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400',
    ],
    bids: [],
    distance: '117 km',
    estimatedTime: '5 days',
    gradientClass: 'bg-gradient-to-r from-yellow-400 to-orange-500',
  },
  {
    id: 'C3',
    shipper: 'BuildRight Construction',
    shipperTransactions: 67,
    origin: 'Cagayan de Oro',
    destination: 'Butuan City',
    originCoords: { lat: 8.4542, lng: 124.6319 },
    destCoords: { lat: 8.9475, lng: 125.5406 },
    weight: 12,
    unit: 'tons',
    cargoType: 'Construction Materials',
    vehicleNeeded: '6W Dropside',
    askingPrice: 12000,
    description: 'Steel bars and cement. Heavy items, need truck with crane or boom.',
    pickupDate: '2026-01-27',
    status: 'open',
    postedAt: Date.now() - 1 * 60 * 60 * 1000,
    cargoPhotos: [
      'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400',
    ],
    bids: [],
    distance: '134 km',
    estimatedTime: '4 days',
    gradientClass: 'bg-gradient-to-r from-blue-400 to-blue-600',
  },
];

const sampleTruckListings = [
  {
    id: 'T1',
    trucker: 'Heavy Haul PH',
    truckerRating: 4.7,
    truckerTransactions: 178,
    origin: 'Cagayan de Oro',
    destination: 'Davao City',
    originCoords: { lat: 8.4542, lng: 124.6319 },
    destCoords: { lat: 7.0707, lng: 125.6087 },
    vehicleType: '10W Flatbed',
    plateNumber: 'HHP 3456',
    capacity: '12-15 tons',
    askingRate: 15000,
    availableDate: '2026-01-27',
    description: 'Backload available, may crane for loading',
    status: 'available',
    postedAt: Date.now() - 3 * 60 * 60 * 1000,
    truckPhotos: [],
    distance: '250 km',
    estimatedTime: '6-8 hrs',
  },
  {
    id: 'T2',
    trucker: 'Quick Logistics',
    truckerRating: 4.9,
    truckerTransactions: 234,
    origin: 'Cebu City',
    destination: 'Davao City',
    originCoords: { lat: 10.3157, lng: 123.8854 },
    destCoords: { lat: 7.0707, lng: 125.6087 },
    vehicleType: '10W Wing Van',
    plateNumber: 'QL 9012',
    capacity: '12 tons',
    askingRate: 22000,
    availableDate: '2026-01-28',
    description: 'RORO via Liloan-Lipata, experienced route',
    status: 'available',
    postedAt: Date.now() - 1 * 60 * 60 * 1000,
    truckPhotos: [],
    distance: '408 km',
    estimatedTime: '14-16 hrs',
  },
];

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
  } = useAuth();

  // Firebase Data Hooks
  const { listings: firebaseCargoListings, loading: cargoLoading } = useCargoListings({ status: 'open' });
  const { listings: firebaseTruckListings, loading: truckLoading } = useTruckListings({ status: 'open' });
  const { notifications: firebaseNotifications, unreadCount: firebaseUnreadCount } = useNotifications(authUser?.uid);
  const { balance: firebaseWalletBalance } = useWallet(authUser?.uid);
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
  } = useAuthGuard();

  // Loading states for form submissions
  const [postLoading, setPostLoading] = useState(false);
  const [bidLoading, setBidLoading] = useState(false);

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

  // Use Firebase data with fallback to sample data
  const userRole = currentRole || 'shipper';
  const cargoListings = firebaseCargoListings.length > 0 ? firebaseCargoListings : sampleCargoListings;
  const truckListings = firebaseTruckListings.length > 0 ? firebaseTruckListings : sampleTruckListings;
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
  const handleRoleChange = (role) => {
    if (switchRole) {
      switchRole(role);
    }
  };

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

  const handleWalletClick = () => {
    requireAuth(() => openModal('wallet'), 'Sign in to view wallet');
  };

  const handleLogout = async () => {
    if (logout) {
      await logout();
    }
  };

  const handleRouteOptimizerClick = () => {
    openModal('routeOptimizer');
  };

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
      />

      <div className="flex min-h-[calc(100vh-73px)]">
        {/* Sidebar - Desktop only */}
        <Sidebar
          className="hidden lg:flex"
          currentRole={userRole}
          onRoleChange={handleRoleChange}
          activeMarket={activeMarket}
          onMarketChange={setActiveMarket}
          cargoCount={cargoListings.length}
          truckCount={truckListings.length}
          openCargoCount={openCargoCount}
          availableTrucksCount={availableTrucksCount}
          activeShipmentsCount={activeShipmentsCount}
          onPostClick={handlePostClick}
          onRouteOptimizerClick={userRole === 'trucker' ? handleRouteOptimizerClick : undefined}
          darkMode={darkMode}
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
              My Bids
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              View your bids here. (Integration pending)
            </p>
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
      </div>

      {/* Mobile Navigation */}
      <MobileNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onPostClick={handlePostClick}
        unreadMessages={0}
        unreadNotifications={unreadNotifications}
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
