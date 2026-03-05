import React from 'react';
import { User, Bell, Moon, Sun, HelpCircle, LogOut, ChevronRight, Star, Truck, Package, Users, ClipboardList, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';

export function ProfileDropdown({
  user = {},
  currentRole = 'shipper',
  isBroker = false,
  isAdmin = false,
  darkMode = false,
  onToggleDarkMode,
  onMyActivity,
  onBrokerDashboard,
  onEditProfile,
  onNotificationSettings,
  onHelpSupport,
  onAdminDashboard,
  onLogout,
  children,
  className,
}) {
  const {
    name = 'User',
    initial = 'U',
    rating = 0,
    tripsCompleted = 0,
    avatarUrl,
  } = user;

  // Role-specific styling
  const roleConfig = {
    shipper: {
      color: 'blue',
      bgGradient: 'from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30',
      badgeBg: 'bg-blue-100 dark:bg-blue-900/50',
      badgeText: 'text-blue-600 dark:text-blue-400',
      avatarBorder: 'border-blue-500',
      icon: Package,
      label: 'Shipper Account',
    },
    trucker: {
      color: 'emerald',
      bgGradient: 'from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/30',
      badgeBg: 'bg-emerald-100 dark:bg-emerald-900/50',
      badgeText: 'text-emerald-600 dark:text-emerald-400',
      avatarBorder: 'border-emerald-500',
      icon: Truck,
      label: 'Trucker Account',
    },
  };

  const config = roleConfig[currentRole] || roleConfig.shipper;
  const RoleIcon = config.icon;
  const menuItemClass = 'w-full rounded-xl px-3 py-2.5 cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-gray-100 dark:focus:bg-gray-800';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild className={className}>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[min(20rem,calc(100vw-1rem))] sm:w-64 max-h-[calc(100vh-96px)] overflow-x-hidden overflow-y-auto p-0 rounded-2xl shadow-xl border-0 bg-white dark:bg-gray-900"
      >
        {/* Profile Header */}
        <div className={cn("px-4 pt-5 pb-4 bg-gradient-to-br", config.bgGradient)}>
          {/* Avatar */}
          <div className="flex flex-col items-center">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={name}
                className={cn(
                  "size-16 rounded-full border-3 object-cover",
                  config.avatarBorder
                )}
              />
            ) : (
              <div
                className={cn(
                  "size-16 rounded-full border-3 flex items-center justify-center text-2xl font-semibold",
                  config.avatarBorder,
                  currentRole === 'trucker'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-blue-500 text-white'
                )}
              >
                {initial}
              </div>
            )}

            {/* Name */}
            <h3 className="mt-3 font-semibold text-gray-900 dark:text-white">
              {name}
            </h3>

            {/* Account Type Badge */}
            <div
              className={cn(
                "mt-2 px-3 py-1 rounded-full flex items-center gap-1.5 text-xs font-medium",
                config.badgeBg,
                config.badgeText
              )}
            >
              <RoleIcon className="size-3.5" />
              {config.label}
            </div>

            {/* Rating & Stats */}
            <div className="mt-2 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <Star className="size-3.5 fill-amber-400 text-amber-400" />
              <span className="font-medium">{rating.toFixed(1)}</span>
              <span>{'\u2022'}</span>
              <span>{tripsCompleted} trips completed</span>
            </div>
          </div>
        </div>

        <DropdownMenuSeparator className="m-0" />

        {/* Menu Items */}
        <div className="p-2">
          {/* My Activity */}
          <DropdownMenuItem
            onSelect={onMyActivity}
            className={menuItemClass}
          >
            <div className="flex w-full min-w-0 items-center gap-3">
              <div className="size-8 shrink-0 rounded-lg bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center">
                <ClipboardList className="size-4 text-orange-600 dark:text-orange-400" />
              </div>
              <span className="min-w-0 flex-1 truncate text-sm text-gray-700 dark:text-gray-300">My Activity</span>
              <ChevronRight className="size-4 shrink-0 text-gray-400" />
            </div>
          </DropdownMenuItem>

          {/* Broker Dashboard */}
          <DropdownMenuItem
            onSelect={onBrokerDashboard}
            className={menuItemClass}
          >
            <div className="flex w-full min-w-0 items-center gap-3">
              <div className="size-8 shrink-0 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <Users className="size-4 text-gray-600 dark:text-gray-400" />
              </div>
              <span className="min-w-0 flex-1 truncate text-sm text-gray-700 dark:text-gray-300">{isBroker ? 'Broker Dashboard' : 'Broker Program'}</span>
              <div className="flex items-center gap-2 shrink-0">
                {!isBroker && (
                  <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 text-xs font-medium">
                    Earn Extra!
                  </span>
                )}
                <ChevronRight className="size-4 text-gray-400" />
              </div>
            </div>
          </DropdownMenuItem>

          {/* Edit Profile */}
          <DropdownMenuItem
            onSelect={onEditProfile}
            className={menuItemClass}
          >
            <div className="flex w-full min-w-0 items-center gap-3">
              <div className="size-8 shrink-0 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <User className="size-4 text-gray-600 dark:text-gray-400" />
              </div>
              <span className="min-w-0 flex-1 truncate text-sm text-gray-700 dark:text-gray-300">Edit Profile</span>
              <ChevronRight className="size-4 shrink-0 text-gray-400" />
            </div>
          </DropdownMenuItem>

          {/* Notification Settings */}
          <DropdownMenuItem
            onSelect={onNotificationSettings}
            className={menuItemClass}
          >
            <div className="flex w-full min-w-0 items-center gap-3">
              <div className="size-8 shrink-0 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <Bell className="size-4 text-gray-600 dark:text-gray-400" />
              </div>
              <span className="min-w-0 flex-1 truncate text-sm text-gray-700 dark:text-gray-300">Notifications</span>
              <ChevronRight className="size-4 shrink-0 text-gray-400" />
            </div>
          </DropdownMenuItem>

          {/* Dark Mode Toggle */}
          <button
            type="button"
            onClick={() => onToggleDarkMode?.()}
            className={menuItemClass}
          >
            <div className="flex w-full min-w-0 items-center gap-3">
              <div className="size-8 shrink-0 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                {darkMode ? (
                  <Sun className="size-4 text-amber-500" />
                ) : (
                  <Moon className="size-4 text-gray-600 dark:text-gray-400" />
                )}
              </div>
              <span className="min-w-0 flex-1 text-sm text-gray-700 dark:text-gray-300 text-left">Dark Mode</span>
              <Switch
                checked={darkMode}
                onCheckedChange={onToggleDarkMode}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="data-[state=checked]:bg-orange-500"
              />
            </div>
          </button>

          {/* Help & Support */}
          <DropdownMenuItem
            onSelect={onHelpSupport}
            className={menuItemClass}
          >
            <div className="flex w-full min-w-0 items-center gap-3">
              <div className="size-8 shrink-0 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <HelpCircle className="size-4 text-gray-600 dark:text-gray-400" />
              </div>
              <span className="min-w-0 flex-1 truncate text-sm text-gray-700 dark:text-gray-300">Help & Support</span>
              <ChevronRight className="size-4 shrink-0 text-gray-400" />
            </div>
          </DropdownMenuItem>

          {/* Admin Dashboard (Mobile only) */}
          {isAdmin && (
            <DropdownMenuItem
              onSelect={onAdminDashboard}
              className={cn(menuItemClass, 'lg:hidden')}
            >
              <div className="flex w-full min-w-0 items-center gap-3">
                <div className="size-8 shrink-0 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                  <Shield className="size-4 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="min-w-0 flex-1 truncate text-sm text-amber-700 dark:text-amber-300">Admin Dashboard</span>
                <ChevronRight className="size-4 shrink-0 text-amber-500/80" />
              </div>
            </DropdownMenuItem>
          )}
        </div>

        <DropdownMenuSeparator className="m-0" />

        {/* Logout */}
        <div className="p-2">
          <DropdownMenuItem
            onSelect={onLogout}
            className="w-full rounded-xl px-3 py-2.5 cursor-pointer bg-red-50 dark:bg-red-950/30 transition-colors hover:bg-red-100 dark:hover:bg-red-900/40 focus:bg-red-100 dark:focus:bg-red-900/40"
          >
            <div className="flex w-full min-w-0 items-center gap-3">
              <div className="size-8 shrink-0 rounded-lg bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                <LogOut className="size-4 text-red-500" />
              </div>
              <span className="text-sm font-medium text-red-600 dark:text-red-400">Logout</span>
            </div>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ProfileDropdown;

