import { useState, useEffect, useRef, useLayoutEffect, useId, useCallback } from 'react';
import { Filter, X, Route, ChevronRight, AlertCircle, BookmarkPlus, Bookmark, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CargoCard } from '@/components/cargo/CargoCard';
import { TruckCard } from '@/components/truck/TruckCard';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Button } from '@/components/ui/button';
import { canBidCargoStatus, canBookTruckStatus } from '@/utils/listingStatus';
import BrokerHomeCard from '@/components/broker/BrokerHomeCard';
import { getWorkspaceLabel } from '@/utils/workspace';
import { HeroCarousel } from '@/components/HeroCarousel';
import { trackAnalyticsEvent } from '@/services/analyticsService';

const ITEMS_PER_PAGE = 20;
const MOBILE_STICKY_CONTROLS_MIN_HEIGHT = 132;
const MOBILE_BOTTOM_CONTENT_GAP = 24;
const MOBILE_NAV_FALLBACK_HEIGHT = 96;
const HOME_INFINITE_SCROLL_DEFAULT = import.meta.env.VITE_ENABLE_HOME_INFINITE_SCROLL !== 'false';

function buildPaginationSessionId() {
  const timestamp = Date.now().toString(36);
  const entropy = Math.random().toString(36).slice(2, 8);
  return `${timestamp}-${entropy}`;
}

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
  mobileNavHeight = MOBILE_NAV_FALLBACK_HEIGHT,
  roleKpis = [],
}) {
  const activeWorkspace = workspaceRole || currentRole;
  const listings = activeMarket === 'cargo' ? cargoListings : truckListings;
  const listingCount = listings.length;
  const isAccountSuspended = currentUser?.accountStatus === 'suspended' || currentUser?.isActive === false;
  const resolvedMobileHeaderHeight = Number.isFinite(mobileHeaderHeight) ? mobileHeaderHeight : 74;
  const resolvedMobileNavHeight = Number.isFinite(mobileNavHeight) && mobileNavHeight > 0
    ? mobileNavHeight
    : MOBILE_NAV_FALLBACK_HEIGHT;

  // Pagination: show ITEMS_PER_PAGE at a time with "Load More"
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [controlsHeight, setControlsHeight] = useState(MOBILE_STICKY_CONTROLS_MIN_HEIGHT);
  const [observerSupported, setObserverSupported] = useState(
    () => typeof window !== 'undefined' && 'IntersectionObserver' in window
  );
  const visibleListings = listings.slice(0, visibleCount);
  const hasMore = visibleCount < listings.length;
  const hasSearchQuery = Boolean(searchQuery?.trim());
  const paginationEligible = listingCount > ITEMS_PER_PAGE;

  const scrollContainerRef = useRef(null);
  const stickyControlsRef = useRef(null);
  const loadMoreSentinelRef = useRef(null);
  const paginationSessionRef = useRef(null);
  const pendingLoadSourceRef = useRef(null);
  const previousVisibleCountRef = useRef(ITEMS_PER_PAGE);
  const listingCountRef = useRef(listingCount);
  const searchInputId = useId();

  // Detect mobile screen for compact cards
  const isMobile = useMediaQuery('(max-width: 1023px)');
  const shouldAutoLoadMore = isMobile && HOME_INFINITE_SCROLL_DEFAULT;
  const showManualLoadMore = !shouldAutoLoadMore || !observerSupported;
  const trackPaginationEvent = useCallback((eventName, params = {}) => {
    trackAnalyticsEvent(eventName, {
      market: activeMarket,
      workspace_role: activeWorkspace,
      is_mobile: isMobile,
      filter_status: filterStatus,
      has_search_query: hasSearchQuery,
      ...params,
    });
  }, [activeMarket, activeWorkspace, isMobile, filterStatus, hasSearchQuery]);

  const handleLoadMore = useCallback((source = 'manual') => {
    pendingLoadSourceRef.current = source;
    setVisibleCount((prev) => Math.min(prev + ITEMS_PER_PAGE, listings.length));
  }, [listings.length]);

  // Reset visible count and scroll position when market or filter changes
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
    previousVisibleCountRef.current = ITEMS_PER_PAGE;
    pendingLoadSourceRef.current = null;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [activeMarket, filterStatus, searchQuery]);

  useEffect(() => {
    listingCountRef.current = listingCount;
    const session = paginationSessionRef.current;
    if (!session) return;
    session.latestTotal = listingCount;
    session.reachedEnd = session.maxVisible >= listingCount;
  }, [listingCount]);

  useEffect(() => {
    if (!paginationEligible) {
      paginationSessionRef.current = null;
      return undefined;
    }

    const sessionId = buildPaginationSessionId();
    const startedAtMs = Date.now();
    const totalAtStart = listingCountRef.current;
    const initialVisible = Math.min(ITEMS_PER_PAGE, totalAtStart);

    paginationSessionRef.current = {
      sessionId,
      startedAtMs,
      initialTotal: totalAtStart,
      latestTotal: totalAtStart,
      autoLoads: 0,
      manualLoads: 0,
      maxVisible: initialVisible,
      maxPageDepth: Math.max(1, Math.ceil(initialVisible / ITEMS_PER_PAGE)),
      reachedEnd: initialVisible >= totalAtStart,
    };

    trackPaginationEvent('home_pagination_session_start', {
      session_id: sessionId,
      total_listings: totalAtStart,
      auto_mode_enabled: shouldAutoLoadMore,
    });

    return () => {
      const session = paginationSessionRef.current;
      if (!session || session.sessionId !== sessionId) return;

      const durationMs = Math.max(0, Date.now() - session.startedAtMs);
      const totalListings = Math.max(session.initialTotal, session.latestTotal || 0);
      const firstPageDropoff = totalListings > ITEMS_PER_PAGE && session.maxVisible <= ITEMS_PER_PAGE;

      trackPaginationEvent('home_pagination_session_end', {
        session_id: session.sessionId,
        total_listings: totalListings,
        max_visible: session.maxVisible,
        max_page_depth: session.maxPageDepth,
        auto_load_count: session.autoLoads,
        manual_load_count: session.manualLoads,
        reached_end: session.reachedEnd,
        first_page_dropoff: firstPageDropoff,
        duration_ms: durationMs,
      });

      if (firstPageDropoff) {
        trackPaginationEvent('home_pagination_first_page_dropoff', {
          session_id: session.sessionId,
          total_listings: totalListings,
          duration_ms: durationMs,
        });
      }

      paginationSessionRef.current = null;
    };
  }, [
    paginationEligible,
    activeMarket,
    activeWorkspace,
    filterStatus,
    hasSearchQuery,
    isMobile,
    shouldAutoLoadMore,
    trackPaginationEvent,
  ]);

  useEffect(() => {
    const previousCount = previousVisibleCountRef.current;
    if (visibleCount <= previousCount) {
      previousVisibleCountRef.current = visibleCount;
      if (visibleCount < previousCount) {
        pendingLoadSourceRef.current = null;
      }
      return;
    }

    const source = pendingLoadSourceRef.current || (showManualLoadMore ? 'manual' : 'auto');
    pendingLoadSourceRef.current = null;
    previousVisibleCountRef.current = visibleCount;

    const pageDepth = Math.max(1, Math.ceil(visibleCount / ITEMS_PER_PAGE));
    const session = paginationSessionRef.current;
    if (session) {
      if (source === 'auto') {
        session.autoLoads += 1;
      } else {
        session.manualLoads += 1;
      }
      session.maxVisible = Math.max(session.maxVisible, visibleCount);
      session.maxPageDepth = Math.max(session.maxPageDepth, pageDepth);
      session.latestTotal = listingCount;
      session.reachedEnd = visibleCount >= listingCount;
    }

    trackPaginationEvent('home_pagination_load_more', {
      session_id: session?.sessionId || 'no_session',
      source,
      loaded_count: visibleCount,
      total_listings: listingCount,
      page_depth: pageDepth,
      has_more: visibleCount < listingCount,
    });
  }, [visibleCount, listingCount, showManualLoadMore, trackPaginationEvent]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setObserverSupported(false);
      return;
    }
    setObserverSupported('IntersectionObserver' in window);
  }, []);

  useEffect(() => {
    if (!hasMore || showManualLoadMore || typeof window === 'undefined') return undefined;
    const root = scrollContainerRef.current;
    const target = loadMoreSentinelRef.current;
    if (!root || !target) return undefined;

    let didTrigger = false;
    const observer = new window.IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting || didTrigger) return;
        didTrigger = true;
        handleLoadMore('auto');
      },
      {
        root,
        rootMargin: '0px 0px 220px 0px',
        threshold: 0.01,
      }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, showManualLoadMore, visibleCount, handleLoadMore]);

  // Keep mobile spacer aligned with actual sticky controls height.
  // Re-measure aggressively on viewport/layout changes to avoid stale spacer values.
  useLayoutEffect(() => {
    if (!isMobile || typeof window === 'undefined') {
      setControlsHeight((prev) => (prev !== MOBILE_STICKY_CONTROLS_MIN_HEIGHT ? MOBILE_STICKY_CONTROLS_MIN_HEIGHT : prev));
      return undefined;
    }

    let rafId = null;
    let resizeObserver = null;
    const timeoutIds = [];

    const measureStickyControlsHeight = () => {
      const measuredHeight = stickyControlsRef.current?.getBoundingClientRect()?.height;

      if (!Number.isFinite(measuredHeight) || measuredHeight <= 0) {
        setControlsHeight((prev) => (prev < MOBILE_STICKY_CONTROLS_MIN_HEIGHT ? MOBILE_STICKY_CONTROLS_MIN_HEIGHT : prev));
        return;
      }

      const nextHeight = Math.max(MOBILE_STICKY_CONTROLS_MIN_HEIGHT, Math.ceil(measuredHeight));
      setControlsHeight((prev) => (Math.abs(prev - nextHeight) > 0.5 ? nextHeight : prev));
    };

    const scheduleMeasure = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      rafId = window.requestAnimationFrame(measureStickyControlsHeight);
    };

    scheduleMeasure();
    timeoutIds.push(window.setTimeout(scheduleMeasure, 120));
    timeoutIds.push(window.setTimeout(scheduleMeasure, 420));

    if (typeof window.ResizeObserver !== 'undefined' && stickyControlsRef.current) {
      resizeObserver = new window.ResizeObserver(() => {
        scheduleMeasure();
      });
      resizeObserver.observe(stickyControlsRef.current);
    }

    window.addEventListener('resize', scheduleMeasure);
    window.addEventListener('orientationchange', scheduleMeasure);

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      timeoutIds.forEach((id) => window.clearTimeout(id));
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener('resize', scheduleMeasure);
      window.removeEventListener('orientationchange', scheduleMeasure);
    };
  }, [isMobile, activeMarket, activeWorkspace, isBroker, searchQuery, mobileHeaderVisible, resolvedMobileHeaderHeight]);

  const filterOptions = [
    { id: 'all', label: 'All' },
    { id: 'open', label: activeMarket === 'cargo' ? 'Open' : 'Available' },
    { id: 'waiting', label: activeMarket === 'cargo' ? 'Waiting' : 'In Transit' },
  ];

  const hasCurrentSearchPreset = Boolean(searchQuery?.trim()) || filterStatus !== 'all';
  const showSavedSearchesCard = !isMobile || savedSearches.length > 0 || hasCurrentSearchPreset;
  const mobileStickyPaddingTop = 8;
  const listingHeaderTitle = activeMarket === 'cargo'
    ? (activeWorkspace === 'shipper' ? 'My Cargo Posts' : 'Available Cargo')
    : (activeWorkspace === 'trucker' ? 'My Truck Posts' : 'Available Trucks');
  const listingCountLabel = activeMarket === 'cargo'
    ? (activeWorkspace === 'shipper' ? 'cargo posts' : 'cargo listings')
    : (activeWorkspace === 'trucker' ? 'truck posts' : 'trucks');
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
        paddingBottom: isMobile ? `${Math.ceil(resolvedMobileNavHeight + MOBILE_BOTTOM_CONTENT_GAP)}px` : '24px',
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
          padding: isMobile ? `${mobileStickyPaddingTop}px 16px 16px` : '0',
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
            {activeWorkspace === 'broker' ? 'Cargo' : currentRole === 'trucker' ? 'Find Cargo' : 'My Cargo'}
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
            {activeWorkspace === 'broker' ? 'Trucks' : currentRole === 'trucker' ? 'My Trucks' : 'Find Truck'}
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative" style={{ marginBottom: isMobile ? '0' : '24px' }}>
          <label htmlFor={searchInputId} className="sr-only">
            Search marketplace listings
          </label>
          <div className="relative">
            <input
              id={searchInputId}
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
                type="button"
                onClick={() => onSearchChange?.('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-label="Clear search text"
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
      {/* Hero Carousel */}
      <HeroCarousel isMobile={isMobile} onEarnAsBrokerClick={onActivateBroker} />
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900" style={{ padding: isMobile ? '12px' : '16px', marginBottom: isMobile ? '12px' : '16px' }}>
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
          )} data-testid="home-listings-grid">
            {activeMarket === 'cargo'
              ? visibleListings.map((cargo) => (
                  <CargoCard
                    key={cargo.id}
                    {...cargo}
                    compact={isMobile}
                    onViewDetails={() => onViewCargoDetails?.(cargo)}
                    onBid={() => onBidCargo?.(cargo)}
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
            <div className="mt-6 mb-2" data-testid="home-pagination-controls">
              {showManualLoadMore ? (
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() => handleLoadMore('manual')}
                    className="gap-2"
                  >
                    Load More
                    <span className="text-xs text-muted-foreground">
                      ({visibleCount} of {listings.length})
                    </span>
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div ref={loadMoreSentinelRef} data-testid="home-infinite-sentinel" className="h-px w-full" />
                  <p className="text-xs text-gray-500 dark:text-gray-400" aria-live="polite">
                    {visibleCount} of {listings.length} loaded. Scroll for more.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleLoadMore('manual')}
                    className="gap-2"
                  >
                    Load More
                    <span className="text-xs text-muted-foreground">
                      ({visibleCount} of {listings.length})
                    </span>
                  </Button>
                </div>
              )}
            </div>
          )}
          {!hasMore && listings.length > ITEMS_PER_PAGE && (
            <div className="flex justify-center mt-4 mb-2" data-testid="home-pagination-end">
              <p className="text-xs text-gray-500 dark:text-gray-400" aria-live="polite">
                You're all caught up ({listings.length} total).
              </p>
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
