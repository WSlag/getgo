import { Home, TrendingUp, Bell, User, Moon, Sun, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Logo } from '@/components/shared/Logo';

export function Header({
  activeTab = 'home',
  onTabChange,
  darkMode = false,
  onToggleDarkMode,
  unreadNotifications = 0,
  userInitial = 'U',
  walletBalance,
  currentRole = 'shipper',
  onLogout,
  onWalletClick,
  onNotificationClick,
  onProfileClick,
}) {
  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'tracking', label: 'Tracking', icon: TrendingUp },
    { id: 'notifications', label: 'Alerts', icon: Bell, badge: unreadNotifications },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 dark:bg-gray-900/70 border-b border-gray-200/50 dark:border-gray-800/50">
      <div style={{ padding: '16px 24px' }}>
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Logo className="hidden sm:flex" />
          <Logo className="sm:hidden" showText={false} size="sm" />

          {/* Navigation - Desktop */}
          <nav className="hidden lg:flex items-center gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === 'notifications' && onNotificationClick) {
                      onNotificationClick();
                    } else if (item.id === 'profile' && onProfileClick) {
                      onProfileClick();
                    } else if (onTabChange) {
                      onTabChange(item.id);
                    }
                  }}
                  className={cn(
                    "group relative rounded-xl transition-all duration-300 hover:scale-105 active:scale-95",
                    isActive
                      ? "bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40"
                      : "bg-white/50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 hover:shadow-md backdrop-blur-sm"
                  )}
                  style={{ paddingTop: '10px', paddingBottom: '10px', paddingLeft: '20px', paddingRight: '20px' }}
                >
                  <div className="flex items-center gap-2 relative">
                    <Icon className="size-4" />
                    <span className="font-medium text-sm">{item.label}</span>
                    {item.badge > 0 && (
                      <Badge className="absolute -top-2 -right-2 size-5 flex items-center justify-center p-0 bg-red-500 text-white text-xs border-2 border-white dark:border-gray-900">
                        {item.badge > 9 ? '9+' : item.badge}
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            {/* Wallet - Trucker only */}
            {currentRole === 'trucker' && walletBalance !== undefined && (
              <button
                onClick={onWalletClick}
                className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-white/50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-800 hover:shadow-md transition-all duration-300 hover:scale-105 active:scale-95 backdrop-blur-sm"
              >
                <Wallet className="size-4 text-green-600" />
                <span className="font-semibold text-sm text-green-600">
                  ₱{walletBalance?.toLocaleString() || '0'}
                </span>
              </button>
            )}

            {/* Dark Mode Toggle */}
            <button
              onClick={onToggleDarkMode}
              className="size-8 rounded-lg bg-white/50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-800 flex items-center justify-center transition-all duration-300 hover:shadow-md hover:scale-105 active:scale-95 backdrop-blur-sm"
            >
              {darkMode ? (
                <Sun className="size-5 text-amber-500" />
              ) : (
                <Moon className="size-5 text-gray-700 dark:text-gray-400" />
              )}
            </button>

            {/* User Avatar */}
            <div
              onClick={onProfileClick}
              className="size-8 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-sm font-medium shadow-lg shadow-purple-500/30 cursor-pointer hover:scale-105 transition-transform"
            >
              <span>{userInitial}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
