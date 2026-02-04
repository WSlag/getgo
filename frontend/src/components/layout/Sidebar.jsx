import { Ship, Package, Truck, Plus, CheckCircle, Route, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Sidebar({
  currentRole = 'shipper',
  onRoleChange,
  activeMarket = 'cargo',
  onMarketChange,
  cargoCount = 0,
  truckCount = 0,
  openCargoCount = 0,
  availableTrucksCount = 0,
  activeShipmentsCount = 0,
  onPostClick,
  onRouteOptimizerClick,
  className,
}) {
  return (
    <aside
      className={cn(
        "w-72 h-[calc(100vh-73px)] sticky top-[73px] bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 border-r border-gray-200/50 dark:border-gray-800 flex flex-col",
        className
      )}
    >
      {/* Role Selector */}
      <div className="border-b border-gray-200/50 dark:border-gray-800/50" style={{ padding: '35px 24px 35px 24px' }}>
        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide" style={{ marginBottom: '15px' }}>I am a</p>
        <div className="flex gap-2">
          <button
            onClick={() => onRoleChange?.('shipper')}
            className={cn(
              "flex-1 px-3 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 flex flex-col items-center justify-center",
              currentRole === 'shipper'
                ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40"
                : "bg-white/80 dark:bg-gray-800/80 text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 hover:shadow-md backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50"
            )}
            style={{ paddingTop: '15px', paddingBottom: '15px' }}
          >
            <Ship className="size-4 mb-1" />
            <span className="text-xs font-medium">Shipper</span>
          </button>
          <button
            onClick={() => onRoleChange?.('trucker')}
            className={cn(
              "flex-1 px-3 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 flex flex-col items-center justify-center",
              currentRole === 'trucker'
                ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40"
                : "bg-white/80 dark:bg-gray-800/80 text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 hover:shadow-md backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50"
            )}
            style={{ paddingTop: '15px', paddingBottom: '15px' }}
          >
            <Truck className="size-4 mb-1" />
            <span className="text-xs font-medium">Trucker</span>
          </button>
        </div>
      </div>

      {/* Browse Section */}
      <div className="border-b border-gray-200/50 dark:border-gray-800/50" style={{ padding: '24px' }}>
        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide" style={{ marginBottom: '10px' }}>Browse</p>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={() => onMarketChange?.('cargo')}
            className={cn(
              "w-full flex items-center gap-3 px-4 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 group",
              activeMarket === 'cargo'
                ? "bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 text-orange-600 dark:text-orange-400 hover:shadow-md"
                : "text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 hover:shadow-md"
            )}
            style={{ paddingTop: '10px', paddingBottom: '10px', paddingLeft: '16px', paddingRight: '16px' }}
          >
            <Package className="size-5" />
            <span className="font-medium flex-1 text-left">Cargo</span>
            <span className={cn(
              "text-xs px-2 py-0.5 rounded-full",
              activeMarket === 'cargo'
                ? "bg-orange-200/70 dark:bg-orange-800/40"
                : "bg-gray-200/70 dark:bg-gray-700"
            )}>
              {cargoCount}
            </span>
          </button>

          <button
            onClick={() => onMarketChange?.('trucks')}
            className={cn(
              "w-full flex items-center gap-3 px-4 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 group",
              activeMarket === 'trucks'
                ? "bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 text-blue-600 dark:text-blue-400 hover:shadow-md"
                : "text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 hover:shadow-md"
            )}
            style={{ paddingTop: '10px', paddingBottom: '10px', paddingLeft: '16px', paddingRight: '16px' }}
          >
            <Truck className="size-5" />
            <span className="font-medium flex-1 text-left">Trucks</span>
            <span className={cn(
              "text-xs px-2 py-0.5 rounded-full",
              activeMarket === 'trucks'
                ? "bg-blue-200/70 dark:bg-blue-800/40"
                : "bg-gray-200/70 dark:bg-gray-700"
            )}>
              {truckCount}
            </span>
          </button>
        </nav>
      </div>

      {/* Post Cargo Button */}
      <div style={{ padding: '24px' }}>
        <button
          onClick={onPostClick}
          className="w-full px-6 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 transition-all duration-300 hover:scale-105 active:scale-95 group"
          style={{ paddingTop: '15px', paddingBottom: '15px' }}
        >
          <div className="flex items-center justify-center gap-2">
            <Plus className="size-5 group-hover:rotate-90 transition-transform duration-300" />
            <span className="font-medium">{currentRole === 'shipper' ? 'Post Cargo' : 'Post Truck'}</span>
          </div>
        </button>

        {/* Route Optimizer - Truckers */}
        {currentRole === 'trucker' && onRouteOptimizerClick && (
          <button
            onClick={onRouteOptimizerClick}
            className="w-full mt-3 py-2.5 px-4 rounded-xl bg-white/80 dark:bg-gray-800/80 text-gray-600 dark:text-gray-300 text-sm font-medium hover:shadow-md transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center gap-2 border border-gray-200/50 dark:border-gray-700/50"
          >
            <Route className="size-4 text-purple-500" />
            <span>Route Optimizer</span>
          </button>
        )}
      </div>

      {/* Spacer to push Quick Stats to bottom */}
      <div className="flex-1" />

      {/* Quick Stats */}
      <div className="border-t border-gray-200/50 dark:border-gray-800/50 mt-auto" style={{ padding: '24px' }}>
        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide" style={{ marginBottom: '15px' }}>Quick Stats</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 hover:shadow-md transition-all duration-300 cursor-pointer group">
            <div className="size-10 rounded-lg bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg shadow-green-500/30">
              <CheckCircle className="size-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">Open Cargo</p>
              <p className="font-bold text-gray-900 dark:text-white">{openCargoCount}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 hover:shadow-md transition-all duration-300 cursor-pointer group">
            <div className="size-10 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Truck className="size-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">Available Trucks</p>
              <p className="font-bold text-gray-900 dark:text-white">{availableTrucksCount}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20 hover:shadow-md transition-all duration-300 cursor-pointer group">
            <div className="size-10 rounded-lg bg-gradient-to-br from-pink-400 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
              <Navigation className="size-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">Active Shipments</p>
              <p className="font-bold text-gray-900 dark:text-white">{activeShipmentsCount}</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
