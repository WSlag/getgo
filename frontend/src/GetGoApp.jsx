/**
 * GetGo App - Refactored UI with new design system
 * This is the new main app component that uses the enhanced UI components
 * while preserving all existing Firebase functionality
 */

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

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

// Layout Components
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';

// View Components
import { HomeView } from '@/views/HomeView';

// Modal Components
import { PostModal, BidModal } from '@/components/modals';

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
    openModal('post');
  };

  const handleViewCargoDetails = (cargo) => {
    openModal('cargoDetails', cargo);
  };

  const handleViewTruckDetails = (truck) => {
    openModal('truckDetails', truck);
  };

  const handleBidCargo = (cargo) => {
    openModal('bid', cargo);
  };

  const handleBookTruck = (truck) => {
    openModal('bid', truck);
  };

  const handleContactShipper = (cargo) => {
    openModal('chat', { listing: cargo, type: 'cargo' });
  };

  const handleContactTrucker = (truck) => {
    openModal('chat', { listing: truck, type: 'truck' });
  };

  const handleViewMap = (listing) => {
    openModal('map', listing);
  };

  const handleNotificationClick = () => {
    openModal('notifications');
  };

  const handleProfileClick = () => {
    setActiveTab('profile');
  };

  const handleWalletClick = () => {
    openModal('wallet');
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
            darkMode={darkMode}
          />
        )}

        {activeTab === 'tracking' && (
          <main className="flex-1 p-4 lg:p-8">
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Shipment Tracking
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Track your active shipments here. (Integration with existing tracking view pending)
            </p>
          </main>
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

        {activeTab === 'profile' && (
          <main className="flex-1 p-4 lg:p-8">
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Profile
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Manage your profile here. (Integration pending)
            </p>
          </main>
        )}

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
        onSubmit={(data) => {
          console.log('Post submitted:', data);
          // TODO: Integrate with firestoreService
          closeModal('post');
        }}
      />

      <BidModal
        open={modals.bid}
        onClose={() => closeModal('bid')}
        listing={getModalData('bid')}
        currentRole={userRole}
        onSubmit={(data) => {
          console.log('Bid submitted:', data);
          // TODO: Integrate with firestoreService
          closeModal('bid');
        }}
      />
    </div>
  );
}
