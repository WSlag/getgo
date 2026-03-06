import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Filter, X, Route, ChevronRight, AlertCircle, BookmarkPlus, Bookmark, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CargoCard } from '@/components/cargo/CargoCard';
import { TruckCard } from '@/components/truck/TruckCard';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Button } from '@/components/ui/button';
import { canBidCargoStatus, canBookTruckStatus } from '@/utils/listingStatus';
import BrokerHomeCard from '@/components/broker/BrokerHomeCard';
import { getWorkspaceLabel } from '@/utils/workspace';

const ITEMS_PER_PAGE = 20;

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
  workspaceRole = 'shipper',
  currentUserId = null,
  darkMode = false,
  className,
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
  onScroll,
  mobileHeaderVisible = true,
  mobileHeaderHeight = 74,
  roleKpis = [],
}) {
  const activeWorkspace = workspaceRole || currentRole;
  const listings = activeMarket === 'cargo' ? cargoListings : truckListings;
  const listingCount = listings.length;
  const isAccountSuspended = currentUser?.accountStatus === 'suspended' || currentUser?.isActive === false;

  // Pagination: show ITEMS_PER_PAGE at a time with "Load More"
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [controlsHeight, setControlsHeight] = useState(110);
  const visibleListings = listings.slice(0, visibleCount);
  const hasMore = visibleCount < listings.length;

  const scrollContainerRef = useRef(null);
  const stickyControlsRef = useRef(null);

  // Detect mobile screen for compact cards
  const isMobile = useMediaQuery('(max-width: 1023px)');

  // Reset visible count and scroll position when market or filter changes
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [activeMarket, filterStatus, searchQuery]);

  // Keep mobile spacer aligned with actual sticky controls height.
  // Measure on mount and viewport/layout changes, not on scroll.
  useLayoutEffect(() => {
    if (!isMobile || typeof window === 'undefined') {
      return undefined;
    }

    let rafId = null;

    const measureStickyControlsHeight = () => {
      const measuredHeight = stickyControlsRef.current?.getBoundingClientRect()?.height;
      if (!Number.isFinite(measuredHeight) || measuredHeight <= 0) return;

      const nextHeight = Math.ceil(measuredHeight);
      setControlsHeight((prev) => (Math.abs(prev - nextHeight) > 0.5 ? nextHeight : prev));
    };

    const scheduleMeasure = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      rafId = window.requestAnimationFrame(measureStickyControlsHeight);
    };

    scheduleMeasure();
    window.addEventListener('resize', scheduleMeasure);
    window.addEventListener('orientationchange', scheduleMeasure);

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener('resize', scheduleMeasure);
      window.removeEventListener('orientationchange', scheduleMeasure);
    };
  }, [isMobile, activeMarket, activeWorkspace, isBroker, searchQuery]);

  const filterOptions = [
    { id: 'all', label: 'All' },
    { id: 'open', label: activeMarket === 'cargo' ? 'Open' : 'Available' },
    { id: 'waiting', label: activeMarket === 'cargo' ? 'Waiting' : 'In Transit' },
  ];

  const hasCurrentSearchPreset = Boolean(searchQuery?.trim()) || filterStatus !== 'all';
  const showSavedSearchesCard = !isMobile || savedSearches.length > 0 || hasCurrentSearchPreset;
  const mobileStickyPaddingTop = 8;
  const resolvedMobileHeaderHeight = Number.isFinite(mobileHeaderHeight) ? mobileHeaderHeight : 74;
  const listingHeaderTitle = activeMarket === 'cargo'
    ? (activeWorkspace === 'shipper' && !isBroker ? 'My Cargo Posts' : 'Available Cargo')
    : (activeWorkspace === 'trucker' && !isBroker ? 'My Truck Posts' : 'Available Trucks');
  const listingCountLabel = activeMarket === 'cargo'
    ? (activeWorkspace === 'shipper' && !isBroker ? 'cargo posts' : 'cargo listings')
    : (activeWorkspace === 'trucker' && !isBroker ? 'truck posts' : 'trucks');
  const workspaceLabel = getWorkspaceLabel(activeWorkspace);
  const handleHomeScroll = (e) => {
    onScroll?.(e);
  };

  return (
    <main
      ref={scrollContainerRef}
      data-testid="home-scroll-container"
      className={cn("flex-1 bg-gray-50 dark:bg-gray-950 overflow-y-auto", className)}
      style={{
        padding: isMobile ? '0' : '24px',
        paddingTop: isMobile ? '0' : '24px',
        paddingBottom: isMobile ? 'calc(100px + env(safe-area-inset-bottom, 0px))' : '24px',
        overscrollBehaviorY: 'contain',
      }}
      onScroll={handleHomeScroll}
    >
      {/* Restriction Banner */}
      {isAccountSuspended && (
        <div
          className="fixed left-0 right-0 z-[60] bg-red-600 text-white"
          style={{ top: 0, paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <div className="flex w-full flex-col gap-2 px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-3 lg:px-6">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <AlertCircle className="size-5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-sm">Account Restricted</p>
                <p className="text-xs opacity-90">
                  Outstanding fees: ₱{(currentUser.outstandingPlatformFees || currentUser.outstandingFees || 0).toLocaleString()}
                </p>
              </div>
            </div>
            <Button
              onClick={() => onNavigateToContracts?.('unpaid_fees')}
              variant="gradient"
              className="h-10 w-full rounded-full px-4 text-sm font-semibold text-white shadow-md shadow-orange-900/30 sm:w-auto sm:min-w-[124px] sm:flex-shrink-0 sm:px-5"
              aria-label="Pay outstanding fees"
            >
              Pay Fees
            </Button>
          </div>
        </div>
      )}

      <div
        ref={stickyControlsRef}
        data-testid="home-sticky-controls"
        className={cn(
          "lg:relative lg:z-auto",
          "max-lg:fixed max-lg:left-0 max-lg:right-0 max-lg:z-40 max-lg:bg-gray-50 max-lg:dark:bg-gray-950"
        )}
        style={{
          padding: isMobile ? `${mobileStickyPaddingTop}px 16px 0` : '0',
          top: isMobile ? `${mobileHeaderVisible ? resolvedMobileHeaderHeight : 0}px` : undefined,
          transition: isMobile ? 'top 300ms ease-out' : undefined,
          overflowAnchor: 'none',
        }}
      >
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
            {activeWorkspace === 'shipper' && !isBroker ? 'My Cargo' : 'Cargo'}
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
            {activeWorkspace === 'trucker' && !isBroker ? 'My Trucks' : 'Trucks'}
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

      </div>

      {/* Spacer: reserves constant space for fixed header + controls on mobile so content is never hidden behind them */}
      {isMobile && (
        <div
          data-testid="home-fixed-spacer"
          style={{
            height: `${resolvedMobileHeaderHeight + controlsHeight}px`,
            flexShrink: 0,
            overflowAnchor: 'none',
          }}
        />
      )}

      {/* Scrollable Content */}
      <div data-testid="home-scroll-content" style={{ padding: isMobile ? '8px 16px 0' : '0' }}>
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900" style={{ padding: isMobile ? '12px' : '16px', marginBottom: isMobile ? '12px' : '16px' }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Workspace</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">{workspaceLabel}</p>
          </div>
        </div>
        {roleKpis.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-3">
            {roleKpis.map((kpi) => (
              <div key={kpi.id} className="rounded-lg bg-gray-50 dark:bg-gray-800/70" style={{ padding: isMobile ? '8px 10px' : '10px 12px' }}>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{kpi.label}</p>
                <p className="text-base font-bold text-gray-900 dark:text-white">{Number(kpi.value || 0).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Saved Searches */}
      {showSavedSearchesCard && (
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
                  {savedSearch.workspaceRole ? `${savedSearch.workspaceRole.toUpperCase()} · ` : ''}{savedSearch.market === 'trucks' ? 'Trucks' : 'Cargo'}: {savedSearch.searchQuery || 'All'} ({savedSearch.filterStatus || 'all'})
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
          !isMobile ? (
            <p style={{ fontSize: '12px', color: '#6b7280' }}>
              Save frequent search and filter combinations for one-tap reuse.
            </p>
          ) : null
        )}
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
      {activeWorkspace === 'trucker' && onRouteOptimizerClick && (
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
      {!isMobile && (
      <div style={{ marginBottom: '16px' }}>
        <h2 className={cn(
          "font-bold text-gray-900 dark:text-white text-xl"
        )} style={{ marginBottom: '4px' }}>
          {listingHeaderTitle}
        </h2>
        <p className={cn(
          "text-gray-600 dark:text-gray-400 text-sm"
        )}>
          <span className="font-semibold text-orange-500">
            {listingCount} {listingCountLabel}
          </span>{' '}
          available
        </p>
      </div>
      )}

      {/* Filter Pills */}
      {!isMobile && (
      <div
        data-testid="home-filter-pills"
        className="flex gap-3 mb-5"
      >
        {filterOptions.map((option) => (
          <button
            key={option.id}
            data-testid={`home-filter-pill-${option.id}`}
            onClick={() => onFilterChange?.(option.id)}
            className={cn(
              "rounded-xl font-medium transition-all duration-300 active:scale-95 min-h-11 border flex items-center justify-center text-center",
              "whitespace-nowrap text-sm px-6 py-2.5 hover:scale-105",
              filterStatus === option.id
                ? "bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg shadow-orange-500/30 border-transparent"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      )}

      {/* Listings Grid - Compact on mobile (12px gap), full on desktop (32px gap) */}
      {listings.length > 0 ? (
        <>
          <div className={cn(
            "grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3",
            isMobile ? "gap-2" : "gap-8"
          )}>
            {activeMarket === 'cargo'
              ? visibleListings.map((cargo) => (
                  <CargoCard
                    key={cargo.id}
                    {...cargo}
                    compact={isMobile}
                    onViewDetails={() => onViewCargoDetails?.(cargo)}
                    onBid={() => onBidCargo?.(cargo)}
                    onContact={() => onContactShipper?.(cargo)}
                    onViewMap={() => onViewMap?.(cargo)}
                    canBid={activeWorkspace === 'trucker' && !isAccountSuspended && canBidCargoStatus(cargo.status)}
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
              : visibleListings.map((truck) => (
                  <TruckCard
                    key={truck.id}
                    {...truck}
                    compact={isMobile}
                    onViewDetails={() => onViewTruckDetails?.(truck)}
                    onBook={() => onBookTruck?.(truck)}
                    onContact={() => onContactTrucker?.(truck)}
                    onViewMap={() => onViewMap?.(truck)}
                    canBook={activeWorkspace === 'shipper' && !isAccountSuspended && canBookTruckStatus(truck.status)}
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
          {hasMore && (
            <div className="flex justify-center mt-6">
              <Button
                variant="outline"
                onClick={() => setVisibleCount(prev => prev + ITEMS_PER_PAGE)}
                className="gap-2"
              >
                Load More
                <span className="text-xs text-muted-foreground">
                  ({visibleCount} of {listings.length})
                </span>
              </Button>
            </div>
          )}
        </>
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
                : `There are currently no ${activeMarket === 'cargo' ? 'cargo listings' : 'available trucks'} for ${workspaceLabel} workspace.`}
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
              {activeWorkspace === 'trucker' ? 'Post Truck' : 'Post Cargo'}
            </Button>
          </div>
        </div>
      )}
      </div>
    </main>
  );
}

export default HomeView;
