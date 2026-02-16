import { Ship, Package, Truck, Plus, CheckCircle, Route, Navigation, FileText, Shield, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Sidebar({
  currentRole = 'shipper',
  activeMarket = 'cargo',
  onMarketChange,
  cargoCount = 0,
  truckCount = 0,
  openCargoCount = 0,
  availableTrucksCount = 0,
  activeShipmentsCount = 0,
  myBidsCount = 0,
  pendingContractsCount = 0,
  activeContractsCount = 0,
  pendingPaymentsCount = 0,
  isAdmin = false,
  onPostClick,
  onRouteOptimizerClick,
  onMyBidsClick,
  onContractsClick,
  onBrokerClick,
  isBroker = false,
  onPaymentReviewClick,
  className,
}) {
  // Account type display configuration
  const accountConfig = {
    shipper: {
      icon: Ship,
      label: 'Shipper Account',
      bgGradient: 'from-blue-500 to-blue-600',
      shadowColor: 'shadow-blue-500/30',
      badgeBg: 'bg-blue-100 dark:bg-blue-900/50',
      badgeText: 'text-blue-600 dark:text-blue-400',
    },
    trucker: {
      icon: Truck,
      label: 'Trucker Account',
      bgGradient: 'from-emerald-500 to-emerald-600',
      shadowColor: 'shadow-emerald-500/30',
      badgeBg: 'bg-emerald-100 dark:bg-emerald-900/50',
      badgeText: 'text-emerald-600 dark:text-emerald-400',
    },
  };

  const config = accountConfig[currentRole] || accountConfig.shipper;
  const AccountIcon = config.icon;

  return (
    <aside
      className={cn(
        "w-72 h-[calc(100vh-73px)] sticky top-[73px] bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 border-r border-gray-200/50 dark:border-gray-800 flex flex-col",
        className
      )}
    >
      {/* Account Type Display (Read-only) */}
      <div className="border-b border-gray-200/50 dark:border-gray-800/50" style={{ padding: '24px' }}>
        <div className={cn(
          "flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br",
          config.bgGradient,
          "text-white shadow-lg",
          config.shadowColor
        )}>
          <div className="size-10 rounded-lg bg-white/20 flex items-center justify-center">
            <AccountIcon className="size-5" />
          </div>
          <div>
            <p className="text-xs text-white/70 uppercase tracking-wide">Logged in as</p>
            <p className="font-semibold">{config.label}</p>
          </div>
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

          {/* My Bids - For Truckers */}
          {currentRole === 'trucker' && (
            <button
              onClick={onMyBidsClick}
              className="w-full flex items-center gap-3 px-4 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 group text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 hover:shadow-md"
              style={{ paddingTop: '10px', paddingBottom: '10px', paddingLeft: '16px', paddingRight: '16px' }}
            >
              <FileText className="size-5 text-green-500" />
              <span className="font-medium flex-1 text-left">My Bids</span>
              {myBidsCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-200/70 dark:bg-green-800/40 text-green-700 dark:text-green-300">
                  {myBidsCount}
                </span>
              )}
            </button>
          )}

          {/* My Bookings - For Shippers */}
          {currentRole === 'shipper' && (
            <button
              onClick={onMyBidsClick}
              className="w-full flex items-center gap-3 px-4 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 group text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 hover:shadow-md"
              style={{ paddingTop: '10px', paddingBottom: '10px', paddingLeft: '16px', paddingRight: '16px' }}
            >
              <FileText className="size-5 text-purple-500" />
              <span className="font-medium flex-1 text-left">My Bookings</span>
              {myBidsCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-200/70 dark:bg-purple-800/40 text-purple-700 dark:text-purple-300">
                  {myBidsCount}
                </span>
              )}
            </button>
          )}

          {/* Contracts - For All Users */}
          <button
            onClick={onContractsClick}
            className="w-full flex items-center gap-3 px-4 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 group text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 hover:shadow-md"
            style={{ paddingTop: '10px', paddingBottom: '10px', paddingLeft: '16px', paddingRight: '16px' }}
          >
            <FileText className="size-5 text-indigo-500" />
            <span className="font-medium flex-1 text-left">My Contracts</span>
            {pendingContractsCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-200/70 dark:bg-yellow-800/40 text-yellow-700 dark:text-yellow-300 animate-pulse">
                {pendingContractsCount}
              </span>
            )}
            {pendingContractsCount === 0 && activeContractsCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-200/70 dark:bg-indigo-800/40 text-indigo-700 dark:text-indigo-300">
                {activeContractsCount}
              </span>
            )}
          </button>

          {/* Broker Hub */}
          <button
            onClick={onBrokerClick}
            className="w-full flex items-center gap-3 px-4 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 group text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 hover:shadow-md"
            style={{ paddingTop: '10px', paddingBottom: '10px', paddingLeft: '16px', paddingRight: '16px' }}
          >
            <Users className="size-5 text-emerald-500" />
            <span className="font-medium flex-1 text-left">{isBroker ? 'Broker Dashboard' : 'Broker Program'}</span>
          </button>

          {/* Admin Dashboard - Admin Only */}
          {isAdmin && onPaymentReviewClick && (
            <button
              onClick={onPaymentReviewClick}
              className="w-full flex items-center gap-3 px-4 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 group bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 text-amber-700 dark:text-amber-400 hover:shadow-md border border-amber-200/50 dark:border-amber-800/50"
              style={{ paddingTop: '10px', paddingBottom: '10px', paddingLeft: '16px', paddingRight: '16px' }}
            >
              <Shield className="size-5" />
              <span className="font-medium flex-1 text-left">Admin Dashboard</span>
              {pendingPaymentsCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-500 text-white animate-pulse">
                  {pendingPaymentsCount}
                </span>
              )}
            </button>
          )}
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
            className="w-full rounded-xl bg-white/80 dark:bg-gray-800/80 text-gray-600 dark:text-gray-300 font-medium hover:shadow-md transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center gap-2 border border-gray-200/50 dark:border-gray-700/50"
            style={{ marginTop: '12px', paddingTop: '12px', paddingBottom: '12px' }}
          >
            <Route className="size-5 text-purple-500" />
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
