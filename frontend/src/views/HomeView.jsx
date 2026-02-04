import { Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CargoCard } from '@/components/cargo/CargoCard';
import { TruckCard } from '@/components/truck/TruckCard';

export function HomeView({
  activeMarket = 'cargo',
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
  darkMode = false,
  className,
}) {
  const listings = activeMarket === 'cargo' ? cargoListings : truckListings;
  const listingCount = listings.length;

  const filterOptions = [
    { id: 'all', label: 'All' },
    { id: 'open', label: activeMarket === 'cargo' ? 'Open' : 'Available' },
    { id: 'waiting', label: activeMarket === 'cargo' ? 'Waiting' : 'In Transit' },
  ];

  return (
    <main className={cn("flex-1 bg-gray-50 dark:bg-gray-950 overflow-y-auto", className)} style={{ padding: '32px 40px' }}>
      {/* Page Header - Figma style */}
      <div className="flex items-center justify-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white" style={{ marginBottom: '8px' }}>
            {activeMarket === 'cargo' ? 'Available Cargo' : 'Available Trucks'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-base">
            <span className="font-semibold text-orange-500">
              {listingCount} {activeMarket === 'cargo' ? 'cargo listings' : 'trucks'}
            </span>{' '}
            available
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex" style={{ gap: '12px' }}>
          {filterOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => onFilterChange?.(option.id)}
              className={cn(
                "rounded-xl font-medium text-sm transition-all duration-300 hover:scale-105 active:scale-95",
                filterStatus === option.id
                  ? "bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg shadow-orange-500/30"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
              )}
              style={{ padding: '10px 24px' }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Listings Grid */}
      {listings.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
          {activeMarket === 'cargo'
            ? listings.map((cargo) => (
                <CargoCard
                  key={cargo.id}
                  {...cargo}
                  onViewDetails={() => onViewCargoDetails?.(cargo)}
                  onBid={() => onBidCargo?.(cargo)}
                  onContact={() => onContactShipper?.(cargo)}
                  onViewMap={() => onViewMap?.(cargo)}
                  canBid={currentRole === 'trucker'}
                  darkMode={darkMode}
                />
              ))
            : listings.map((truck) => (
                <TruckCard
                  key={truck.id}
                  {...truck}
                  onViewDetails={() => onViewTruckDetails?.(truck)}
                  onBook={() => onBookTruck?.(truck)}
                  onContact={() => onContactTrucker?.(truck)}
                  onViewMap={() => onViewMap?.(truck)}
                  canBook={currentRole === 'shipper'}
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
            {filterStatus !== 'all'
              ? `No ${activeMarket} with "${filterStatus}" status. Try changing the filter.`
              : `There are currently no ${activeMarket === 'cargo' ? 'cargo listings' : 'available trucks'}. Check back later!`}
          </p>
        </div>
      )}
    </main>
  );
}

export default HomeView;
