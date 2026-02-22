import { Filter, X, Radio, MapPin, Navigation, MapPinned, Route, ChevronRight, AlertCircle, BookmarkPlus, Bookmark, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CargoCard } from '@/components/cargo/CargoCard';
import { TruckCard } from '@/components/truck/TruckCard';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Button } from '@/components/ui/button';
import { canBidCargoStatus, canBookTruckStatus } from '@/utils/listingStatus';
import BrokerHomeCard from '@/components/broker/BrokerHomeCard';

export function HomeView({
  activeMarket = 'cargo',
  onMarketChange,
  cargoListings = [],
  truckListings = [],
  filterStatus = 'all',
  onFilterChange,
  searchQuery = '',
  onSearchChange,
  onViewCargoDetails,
  onViewTruckDetails,
  onBidCargo,
  onBookTruck,
  onContactShipper,
  onContactTrucker,
  onViewMap,
  onReferListing,
  currentRole = 'shipper',
  currentUserId = null,
  darkMode = false,
  className,
  activeShipments = [],
  onTrackLive,
  onRouteOptimizerClick,
  currentUser = null,
  onNavigateToContracts,
  savedSearches = [],
  onSaveCurrentSearch,
  onApplySavedSearch,
  onDeleteSavedSearch,
  isBroker = false,
  shouldShowBrokerCard = false,
  onDismissBrokerCard,
  onActivateBroker,
  onPostListing,
}) {
  const listings = activeMarket === 'cargo' ? cargoListings : truckListings;
  const listingCount = listings.length;
  const isAccountSuspended = currentUser?.accountStatus === 'suspended' || currentUser?.isActive === false;

  // Detect mobile screen for compact cards
  const isMobile = useMediaQuery('(max-width: 1023px)');

  const filterOptions = [
    { id: 'all', label: 'All' },
    { id: 'open', label: activeMarket === 'cargo' ? 'Open' : 'Available' },
    { id: 'waiting', label: activeMarket === 'cargo' ? 'Waiting' : 'In Transit' },
  ];

  // Status colors for shipment tracking
  const statusConfig = {
    pending_pickup: { color: 'bg-slate-500', label: 'Awaiting Pickup', textColor: 'text-slate-500' },
    picked_up: { color: 'bg-blue-500', label: 'Picked Up', textColor: 'text-blue-500' },
    in_transit: { color: 'bg-orange-500', label: 'In Transit', textColor: 'text-orange-500' },
    delivered: { color: 'bg-green-500', label: 'Delivered', textColor: 'text-green-500' },
  };
  const hasCurrentSearchPreset = Boolean(searchQuery?.trim()) || filterStatus !== 'all';

  return (
    <main className={cn("flex-1 bg-gray-50 dark:bg-gray-950 overflow-y-auto", className)} style={{ padding: isMobile ? '16px' : '24px', paddingBottom: isMobile ? 'calc(100px + env(safe-area-inset-bottom, 0px))' : '24px' }}>
      {/* Suspension Banner */}
      {isAccountSuspended && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white p-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <AlertCircle className="size-5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-sm">Account Suspended</p>
                <p className="text-xs opacity-90 truncate">
                  Outstanding fees: ₱{(currentUser.outstandingPlatformFees || currentUser.outstandingFees || 0).toLocaleString()}
                </p>
              </div>
            </div>
            <Button
              onClick={() => onNavigateToContracts?.('unpaid_fees')}
              className="bg-white text-red-600 hover:bg-gray-100 flex-shrink-0"
              size="sm"
            >
              Pay Fees
            </Button>
          </div>
        </div>
      )}

      {/* Mobile Market Switcher - only visible on mobile */}
      <div className="lg:hidden flex gap-2" style={{ marginBottom: '16px' }}>
        <button
          onClick={() => onMarketChange?.('cargo')}
          className={cn(
            "flex-1 rounded-full font-medium text-sm transition-all active:scale-95",
            activeMarket === 'cargo'
              ? "bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg shadow-orange-500/30"
              : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
          )}
          style={{ padding: '12px 16px' }}
        >
          {currentRole === 'shipper' && !isBroker ? 'My Cargo' : 'Cargo'}
        </button>
        <button
          onClick={() => onMarketChange?.('trucks')}
          className={cn(
            "flex-1 rounded-full font-medium text-sm transition-all active:scale-95",
            activeMarket === 'trucks'
              ? "bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-lg shadow-blue-500/30"
              : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
          )}
          style={{ padding: '12px 16px' }}
        >
          {currentRole === 'trucker' && !isBroker ? 'My Trucks' : 'Trucks'}
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative" style={{ marginBottom: isMobile ? '16px' : '24px' }}>
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder={activeMarket === 'cargo'
              ? "Search by shipper, route, or cargo type..."
              : "Search by trucker, route, or vehicle type..."}
            className={cn(
              "w-full rounded-full border border-gray-200 dark:border-gray-700",
              "bg-white dark:bg-gray-800 text-gray-900 dark:text-white",
              isMobile ? "text-sm" : "text-lg",
              "placeholder:text-gray-400 dark:placeholder:text-gray-500",
              isMobile ? "placeholder:text-sm" : "placeholder:text-lg",
              "focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500",
              "transition-all duration-200"
            )}
            style={{ padding: isMobile ? '12px 16px' : '15px 16px' }}
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange?.('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X className="size-5" />
            </button>
          )}
        </div>
      </div>

      {/* Saved Searches */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900" style={{ padding: isMobile ? '12px' : '16px', marginBottom: isMobile ? '12px' : '16px' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: '10px' }}>
          <div className="flex items-center gap-2">
            <Bookmark className="size-4 text-orange-500" />
            <p style={{ fontSize: isMobile ? '12px' : '13px', fontWeight: '600', color: darkMode ? '#d1d5db' : '#374151' }}>
              Saved Searches
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            disabled={!hasCurrentSearchPreset}
            onClick={() => onSaveCurrentSearch?.()}
          >
            <BookmarkPlus className="size-4" />
            Save Current
          </Button>
        </div>
        {savedSearches.length > 0 ? (
          <div className="flex flex-wrap" style={{ gap: '8px' }}>
            {savedSearches.map((savedSearch) => (
              <div
                key={savedSearch.id}
                className="flex items-center rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
                style={{ padding: '4px 10px', gap: '6px' }}
              >
                <button
                  type="button"
                  onClick={() => onApplySavedSearch?.(savedSearch)}
                  className="text-left"
                  style={{ fontSize: '12px', color: darkMode ? '#d1d5db' : '#374151' }}
                >
                  {savedSearch.market === 'trucks' ? 'Trucks' : 'Cargo'}: {savedSearch.searchQuery || 'All'} ({savedSearch.filterStatus || 'all'})
                </button>
                <button
                  type="button"
                  aria-label="Delete saved search"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteSavedSearch?.(savedSearch.id);
                  }}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: '12px', color: '#6b7280' }}>
            Save frequent search and filter combinations for one-tap reuse.
          </p>
        )}
      </div>

      {/* Shipment Tracking Section */}
      {activeShipments && activeShipments.length > 0 && (
        <div style={{ marginBottom: isMobile ? '24px' : '32px' }}>
          <div style={{ marginBottom: isMobile ? '12px' : '16px' }}>
            <h2 style={{
              fontWeight: 'bold',
              color: darkMode ? '#fff' : '#111827',
              fontSize: isMobile ? '16px' : '20px',
              marginBottom: '4px',
              lineHeight: '1.2'
            }}>
              Shipment Tracking
            </h2>
            <p style={{
              color: darkMode ? '#9ca3af' : '#6b7280',
              fontSize: isMobile ? '12px' : '14px'
            }}>
              <span style={{ fontWeight: '600', color: '#f97316' }}>
                {activeShipments.length} active
              </span>{' '}
              {activeShipments.length === 1 ? 'shipment' : 'shipments'} in progress
            </p>
          </div>

          {/* Active Shipments Section */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: isMobile ? '8px' : '12px'
          }}>
            <Radio className="text-orange-500 animate-pulse" style={{ width: isMobile ? '16px' : '20px', height: isMobile ? '16px' : '20px' }} />
            <h3 style={{
              fontWeight: '600',
              color: darkMode ? '#fff' : '#111827',
              fontSize: isMobile ? '14px' : '16px'
            }}>
              Active Shipments
            </h3>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: isMobile ? '12px' : '24px'
          }}>
            {activeShipments.map((shipment) => {
              const status = statusConfig[shipment.status] || statusConfig.in_transit;

              return (
                <div
                  key={shipment.id}
                  onClick={() => onTrackLive?.(shipment)}
                  style={{
                    backgroundColor: darkMode ? '#111827' : '#fff',
                    borderRadius: '16px',
                    border: `1px solid ${darkMode ? '#1f2937' : '#e5e7eb'}`,
                    overflow: 'hidden',
                    boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
                    cursor: 'pointer',
                    transition: 'all 0.3s'
                  }}
                >
                  {/* Status Bar */}
                  <div className={status.color} style={{ height: '4px' }} />

                  <div style={{ padding: isMobile ? '16px' : '24px' }}>
                    {/* Header */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      marginBottom: isMobile ? '12px' : '16px'
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span className={status.color} style={{
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            fontWeight: '500',
                            color: '#fff',
                            fontSize: isMobile ? '11px' : '12px'
                          }}>
                            {status.label}
                          </span>
                          <span style={{
                            color: darkMode ? '#9ca3af' : '#6b7280',
                            fontSize: isMobile ? '11px' : '12px'
                          }}>
                            #{shipment.trackingNumber}
                          </span>
                        </div>
                        <h3 style={{
                          fontWeight: '600',
                          color: darkMode ? '#fff' : '#111827',
                          fontSize: isMobile ? '14px' : '16px'
                        }}>
                          Cargo
                        </h3>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{
                          color: darkMode ? '#9ca3af' : '#6b7280',
                          fontSize: isMobile ? '11px' : '12px'
                        }}>Progress</p>
                        <p className={status.textColor} style={{
                          fontWeight: 'bold',
                          fontSize: isMobile ? '14px' : '16px'
                        }}>{shipment.progress || 0}%</p>
                      </div>
                    </div>

                    {/* Route */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: darkMode ? 'rgba(31, 41, 55, 0.5)' : '#f9fafb',
                      borderRadius: '12px',
                      gap: isMobile ? '8px' : '12px',
                      marginBottom: isMobile ? '12px' : '16px',
                      padding: isMobile ? '12px' : '16px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                        <div style={{
                          width: isMobile ? '24px' : '32px',
                          height: isMobile ? '24px' : '32px',
                          borderRadius: '50%',
                          backgroundColor: '#10b981',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <MapPin style={{ width: isMobile ? '12px' : '16px', height: isMobile ? '12px' : '16px', color: '#fff' }} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: '11px', color: '#6b7280' }}>From</p>
                          <p style={{
                            fontWeight: '500',
                            color: darkMode ? '#fff' : '#111827',
                            fontSize: isMobile ? '12px' : '14px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>{shipment.origin || 'Davao City'}</p>
                        </div>
                      </div>

                      <Navigation style={{
                        width: isMobile ? '12px' : '16px',
                        height: isMobile ? '12px' : '16px',
                        color: '#f97316',
                        flexShrink: 0
                      }} />

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                        <div style={{
                          width: isMobile ? '24px' : '32px',
                          height: isMobile ? '24px' : '32px',
                          borderRadius: '50%',
                          backgroundColor: '#ef4444',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <MapPin style={{ width: isMobile ? '12px' : '16px', height: isMobile ? '12px' : '16px', color: '#fff' }} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: '11px', color: '#6b7280' }}>To</p>
                          <p style={{
                            fontWeight: '500',
                            color: darkMode ? '#fff' : '#111827',
                            fontSize: isMobile ? '12px' : '14px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>{shipment.destination || 'Manila'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Current Location */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: darkMode ? 'rgba(234, 88, 12, 0.2)' : '#fff7ed',
                      borderRadius: '8px',
                      border: `1px solid ${darkMode ? 'rgba(234, 88, 12, 0.3)' : '#fed7aa'}`,
                      gap: '8px',
                      marginBottom: isMobile ? '12px' : '16px',
                      padding: isMobile ? '8px 12px' : '8px 12px'
                    }}>
                      <Radio className="animate-pulse" style={{
                        width: isMobile ? '12px' : '16px',
                        height: isMobile ? '12px' : '16px',
                        color: '#f97316',
                        flexShrink: 0
                      }} />
                      <span style={{
                        color: darkMode ? '#fdba74' : '#c2410c',
                        fontSize: isMobile ? '12px' : '14px',
                        flex: 1,
                        minWidth: 0
                      }}>
                        Current: <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {shipment.currentLocation?.name || shipment.currentLocation || 'Davao City'}
                        </strong>
                      </span>
                      <span style={{
                        color: '#6b7280',
                        fontSize: isMobile ? '11px' : '12px',
                        flexShrink: 0
                      }}>{shipment.lastUpdate || '2 hours ago'}</span>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ marginBottom: isMobile ? '12px' : '16px' }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        color: '#6b7280',
                        marginBottom: '4px',
                        fontSize: isMobile ? '11px' : '12px'
                      }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {shipment.origin || 'Davao City'}
                        </span>
                        <span style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginLeft: '8px'
                        }}>
                          {shipment.destination || 'Manila'}
                        </span>
                      </div>
                      <div style={{
                        backgroundColor: darkMode ? '#374151' : '#e5e7eb',
                        borderRadius: '9999px',
                        overflow: 'hidden',
                        height: isMobile ? '6px' : '8px'
                      }}>
                        <div
                          className={status.color}
                          style={{
                            width: `${shipment.progress || 0}%`,
                            height: '100%',
                            borderRadius: '9999px',
                            transition: 'all 0.5s'
                          }}
                        />
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      onClick={() => onTrackLive?.(shipment)}
                      style={{
                        width: '100%',
                        background: 'linear-gradient(to right, #fb923c, #ea580c)',
                        color: '#fff',
                        borderRadius: '12px',
                        fontWeight: '500',
                        padding: isMobile ? '10px 12px' : '12px 16px',
                        fontSize: isMobile ? '12px' : '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: isMobile ? '6px' : '8px',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.3s',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                      }}
                    >
                      <MapPinned style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px' }} />
                      Track Live
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Broker Home Card - Show for non-brokers when eligible */}
      {!isBroker && shouldShowBrokerCard && (
        <div style={{ marginBottom: isMobile ? '24px' : '32px' }}>
          <BrokerHomeCard
            onActivate={onActivateBroker}
            onDismiss={onDismissBrokerCard}
          />
        </div>
      )}

      {/* Route Optimizer Card - Mobile only, Trucker only */}
      {currentRole === 'trucker' && onRouteOptimizerClick && (
        <div className="lg:hidden" style={{ marginBottom: isMobile ? '24px' : '32px' }}>
          <button
            onClick={onRouteOptimizerClick}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              backgroundColor: darkMode ? '#1f1b2e' : '#fff',
              borderRadius: '14px',
              border: `1.5px dashed ${darkMode ? '#7c3aed' : '#8b5cf6'}`,
              padding: '16px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 2px 8px rgba(139, 92, 246, 0.12)',
              textAlign: 'left',
            }}
          >
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #f3e8ff, #ede9fe)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Route style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontWeight: '700',
                fontSize: '14px',
                color: darkMode ? '#fff' : '#111827',
                marginBottom: '2px',
              }}>
                Route Optimizer
              </p>
              <p style={{
                fontSize: '12px',
                color: darkMode ? '#9ca3af' : '#6b7280',
              }}>
                Find backloads &amp; optimize your route
              </p>
            </div>
            <ChevronRight style={{ width: '20px', height: '20px', color: '#8b5cf6', flexShrink: 0 }} />
          </button>
        </div>
      )}

      {/* Available Cargo/Trucks Header - Figma style */}
      <div style={{ marginBottom: isMobile ? '12px' : '16px' }}>
        <h2 className={cn(
          "font-bold text-gray-900 dark:text-white",
          isMobile ? "text-base" : "text-xl"
        )} style={{ marginBottom: '4px' }}>
          {activeMarket === 'cargo'
            ? (currentRole === 'shipper' && !isBroker ? 'My Cargo Posts' : 'Available Cargo')
            : (currentRole === 'trucker' && !isBroker ? 'My Truck Posts' : 'Available Trucks')}
        </h2>
        <p className={cn(
          "text-gray-600 dark:text-gray-400",
          isMobile ? "text-xs" : "text-sm"
        )}>
          <span className="font-semibold text-orange-500">
            {listingCount}{' '}
            {activeMarket === 'cargo'
              ? (currentRole === 'shipper' && !isBroker ? 'cargo posts' : 'cargo listings')
              : (currentRole === 'trucker' && !isBroker ? 'truck posts' : 'trucks')}
          </span>{' '}
          available
        </p>
      </div>

      {/* Filter Pills - Horizontal scroll on mobile */}
      <div className={cn(
        "flex",
        isMobile ? "overflow-x-auto pb-2 scrollbar-hide" : ""
      )} style={{ gap: isMobile ? '8px' : '12px', marginBottom: isMobile ? '16px' : '20px' }}>
        {filterOptions.map((option) => (
          <button
            key={option.id}
            onClick={() => onFilterChange?.(option.id)}
            className={cn(
              "rounded-xl font-medium transition-all duration-300 active:scale-95 whitespace-nowrap flex-shrink-0",
              isMobile ? "text-xs" : "text-sm hover:scale-105",
              filterStatus === option.id
                ? "bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg shadow-orange-500/30"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
            )}
            style={{ padding: isMobile ? '8px 16px' : '10px 24px' }}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Listings Grid - Compact on mobile (12px gap), full on desktop (32px gap) */}
      {listings.length > 0 ? (
        <div className={cn(
          "grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3",
          isMobile ? "gap-3" : "gap-8"
        )}>
          {activeMarket === 'cargo'
            ? listings.map((cargo) => (
                <CargoCard
                  key={cargo.id}
                  {...cargo}
                  compact={isMobile}
                  onViewDetails={() => onViewCargoDetails?.(cargo)}
                  onBid={() => onBidCargo?.(cargo)}
                  onContact={() => onContactShipper?.(cargo)}
                  onViewMap={() => onViewMap?.(cargo)}
                  canBid={currentRole === 'trucker' && !isAccountSuspended && canBidCargoStatus(cargo.status)}
                  isOwner={currentUserId && (cargo.shipperId === currentUserId || cargo.userId === currentUserId)}
                  canRefer={Boolean(
                    isBroker
                    && currentUserId
                    && cargo.userId !== currentUserId
                    && cargo.shipperId !== currentUserId
                    && canBidCargoStatus(cargo.status)
                  )}
                  onRefer={() => onReferListing?.(cargo, 'cargo')}
                  darkMode={darkMode}
                />
              ))
            : listings.map((truck) => (
                <TruckCard
                  key={truck.id}
                  {...truck}
                  compact={isMobile}
                  onViewDetails={() => onViewTruckDetails?.(truck)}
                  onBook={() => onBookTruck?.(truck)}
                  onContact={() => onContactTrucker?.(truck)}
                  onViewMap={() => onViewMap?.(truck)}
                  canBook={currentRole === 'shipper' && !isAccountSuspended && canBookTruckStatus(truck.status)}
                  isOwner={currentUserId && (truck.truckerId === currentUserId || truck.userId === currentUserId)}
                  canRefer={Boolean(
                    isBroker
                    && currentUserId
                    && truck.userId !== currentUserId
                    && truck.truckerId !== currentUserId
                    && canBookTruckStatus(truck.status)
                  )}
                  onRefer={() => onReferListing?.(truck, 'truck')}
                  darkMode={darkMode}
                />
              ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="size-16 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center mb-4 shadow-lg">
            <Filter className="size-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
            No {activeMarket === 'cargo' ? 'cargo' : 'trucks'} found
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
            {searchQuery
              ? `No ${activeMarket} found matching "${searchQuery}". Try a different search term.`
              : filterStatus !== 'all'
                ? `No ${activeMarket} with "${filterStatus}" status. Try changing the filter.`
                : `There are currently no ${activeMarket === 'cargo' ? 'cargo listings' : 'available trucks'}. Check back later!`}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            {(searchQuery || filterStatus !== 'all') && (
              <Button
                variant="outline"
                size={isMobile ? "sm" : "default"}
                onClick={() => {
                  onSearchChange?.('');
                  onFilterChange?.('all');
                }}
              >
                Clear Search & Filters
              </Button>
            )}
            <Button
              size={isMobile ? "sm" : "default"}
              onClick={onPostListing}
            >
              {currentRole === 'trucker' ? 'Post Truck' : 'Post Cargo'}
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}

export default HomeView;
