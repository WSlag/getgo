import { Filter, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CargoCard } from '@/components/cargo/CargoCard';
import { TruckCard } from '@/components/truck/TruckCard';
import { useMediaQuery } from '@/hooks/useMediaQuery';

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
  currentRole = 'shipper',
  currentUserId = null,
  darkMode = false,
  className,
}) {
  const listings = activeMarket === 'cargo' ? cargoListings : truckListings;
  const listingCount = listings.length;

  // Detect mobile screen for compact cards
  const isMobile = useMediaQuery('(max-width: 1023px)');

  const filterOptions = [
    { id: 'all', label: 'All' },
    { id: 'open', label: activeMarket === 'cargo' ? 'Open' : 'Available' },
    { id: 'waiting', label: activeMarket === 'cargo' ? 'Waiting' : 'In Transit' },
  ];

  return (
    <main className={cn("flex-1 bg-gray-50 dark:bg-gray-950 overflow-y-auto", className)} style={{ padding: isMobile ? '16px 14px' : '32px' }}>
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
          Cargo
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
          Trucks
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

      {/* Page Header - Figma style */}
      <div className={cn(
        isMobile ? "flex flex-col gap-4" : "flex items-center justify-between"
      )} style={{ marginBottom: isMobile ? '20px' : '32px' }}>
        <div>
          <h1 className={cn(
            "font-bold text-gray-900 dark:text-white",
            isMobile ? "text-lg" : "text-2xl"
          )} style={{ marginBottom: '4px' }}>
            {activeMarket === 'cargo' ? 'Available Cargo' : 'Available Trucks'}
          </h1>
          <p className={cn(
            "text-gray-600 dark:text-gray-400",
            isMobile ? "text-sm" : "text-base"
          )}>
            <span className="font-semibold text-orange-500">
              {listingCount} {activeMarket === 'cargo' ? 'cargo listings' : 'trucks'}
            </span>{' '}
            available
          </p>
        </div>

        {/* Filter Pills - Horizontal scroll on mobile */}
        <div className={cn(
          "flex",
          isMobile ? "overflow-x-auto pb-2 -mx-3.5 px-3.5 scrollbar-hide" : ""
        )} style={{ gap: isMobile ? '8px' : '12px' }}>
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
                  canBid={currentRole === 'trucker'}
                  isOwner={currentUserId && (cargo.shipperId === currentUserId || cargo.userId === currentUserId)}
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
                  canBook={currentRole === 'shipper'}
                  isOwner={currentUserId && (truck.truckerId === currentUserId || truck.userId === currentUserId)}
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
        </div>
      )}
    </main>
  );
}

export default HomeView;
