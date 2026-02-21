import React from 'react';
import { cn } from '@/lib/utils';
import {
  Moon,
  Sun,
  Bell,
  RefreshCw,
  Search,
} from 'lucide-react';
import { AdminMenuButton } from './AdminSidebar';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export function AdminHeader({
  title,
  subtitle,
  darkMode,
  onToggleDarkMode,
  onRefresh,
  refreshing,
  onMenuClick,
  userProfile,
  notifications = 0,
  searchable,
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search...',
  actions,
  className,
}) {
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  return (
    <header
      className={cn(
        'sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl',
        'border-b border-gray-200/50 dark:border-gray-800/50',
        className
      )}
      style={{ padding: isDesktop ? '20px 40px' : '12px 16px' }}
    >
      <div className="flex items-center gap-4">
        {/* Mobile Menu Button */}
        <AdminMenuButton onClick={onMenuClick} className="lg:hidden" />

        {/* Title Section */}
        <div className="flex-1 min-w-0">
          <h1 className="text-lg lg:text-2xl font-bold text-gray-900 dark:text-white truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
              {subtitle}
            </p>
          )}
        </div>

        {/* Search (optional) */}
        {searchable && (
          <div className="hidden md:block relative w-64 lg:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className={cn(
                'w-full pl-10 pr-4 py-2 rounded-xl',
                'bg-gray-100 dark:bg-gray-800',
                'border border-transparent focus:border-orange-500',
                'text-gray-900 dark:text-white placeholder:text-gray-400',
                'focus:ring-2 focus:ring-orange-500/20 focus:outline-none',
                'transition-all duration-200'
              )}
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Custom actions */}
          {actions}

          {/* Refresh Button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className={cn(
                'p-2.5 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95',
                'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700',
                'text-gray-600 dark:text-gray-400',
                refreshing && 'cursor-not-allowed'
              )}
            >
              <RefreshCw className={cn('size-5', refreshing && 'animate-spin')} />
            </button>
          )}

          {/* Dark Mode Toggle */}
          <button
            onClick={onToggleDarkMode}
            className={cn(
              'p-2.5 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95',
              'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700',
              'text-gray-600 dark:text-gray-400'
            )}
          >
            {darkMode ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </button>

          {/* Notifications */}
          <button
            className={cn(
              'relative p-2.5 rounded-xl transition-all duration-200',
              'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700',
              'text-gray-600 dark:text-gray-400'
            )}
          >
            <Bell className="size-5" />
            {notifications > 0 && (
              <span className="absolute -top-1 -right-1 size-5 flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold">
                {notifications > 9 ? '9+' : notifications}
              </span>
            )}
          </button>

          {/* User Profile */}
          {userProfile && (
            <div className="hidden sm:flex items-center gap-3 pl-3 border-l border-gray-200 dark:border-gray-700">
              <div className="size-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-sm">
                {userProfile.name?.charAt(0)?.toUpperCase() || 'A'}
              </div>
              <div className="hidden lg:block">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {userProfile.name || 'Admin'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Administrator
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default AdminHeader;
