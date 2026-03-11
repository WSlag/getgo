import { cn } from '@/lib/utils';
import {
  Moon,
  Sun,
  Bell,
  RefreshCw,
  Search,
} from 'lucide-react';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { AdminMenuButton } from './AdminSidebar';

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
  return (
    <header
      className={cn(
        'sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl',
        'border-b border-gray-200/50 dark:border-gray-800/50',
        className
      )}
    >
      <div className="px-4 py-3 lg:px-6 lg:py-5">
        <div className="flex items-center gap-3 lg:gap-4">
          {/* Mobile Menu Button */}
          <AdminMenuButton onClick={onMenuClick} className="lg:hidden" />

          {/* Title Section */}
          <div className="flex-1 min-w-0">
            <h1 className="truncate text-lg font-bold text-gray-900 dark:text-white lg:text-[22px]">
              {title}
            </h1>
            {subtitle ? (
              <p className="hidden text-sm text-gray-500 dark:text-gray-400 sm:block">
                {subtitle}
              </p>
            ) : null}
          </div>

          {/* Search (optional) */}
          {searchable && (
            <div className="hidden md:block relative w-64 lg:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 z-10 size-4 text-slate-400" />
              <AppInput
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full"
                inputClassName="pl-10"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Custom actions */}
            {actions}

            {/* Refresh Button */}
            {onRefresh && (
              <AppButton
                onClick={onRefresh}
                disabled={refreshing}
                variant="secondary"
                size="icon"
                className="shrink-0"
                aria-label="Refresh"
              >
                <RefreshCw className={cn('size-5', refreshing && 'animate-spin')} />
              </AppButton>
            )}

            {/* Dark Mode Toggle */}
            <AppButton
              onClick={onToggleDarkMode}
              variant="secondary"
              size="icon"
              className="shrink-0"
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </AppButton>

            {/* Notifications */}
            <AppButton
              variant="secondary"
              size="icon"
              className="relative shrink-0"
              aria-label="Notifications"
            >
              <Bell className="size-5" />
              {notifications > 0 && (
                <span className="absolute -top-1 -right-1 size-5 flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold">
                  {notifications > 9 ? '9+' : notifications}
                </span>
              )}
            </AppButton>

            {/* User Profile */}
            {userProfile && (
              <div className="hidden sm:flex items-center gap-3 pl-3 border-l border-slate-200 dark:border-slate-700">
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
      </div>
    </header>
  );
}

export default AdminHeader;
