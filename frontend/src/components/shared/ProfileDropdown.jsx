import React from 'react';
import { User, Bell, Moon, Sun, HelpCircle, LogOut, ChevronRight, Star, Truck, Package } from 'lucide-react';
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
  darkMode = false,
  onToggleDarkMode,
  onEditProfile,
  onNotificationSettings,
  onHelpSupport,
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild className={className}>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-64 p-0 rounded-2xl overflow-hidden shadow-xl border-0 bg-white dark:bg-gray-900"
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
              <span>•</span>
              <span>{tripsCompleted} trips completed</span>
            </div>
          </div>
        </div>

        <DropdownMenuSeparator className="m-0" />

        {/* Menu Items */}
        <div className="p-2">
          {/* Edit Profile */}
          <DropdownMenuItem
            onSelect={onEditProfile}
            className="flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-gray-100 dark:focus:bg-gray-800"
          >
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <User className="size-4 text-gray-600 dark:text-gray-400" />
              </div>
              <span className="text-sm text-gray-700 dark:text-gray-300">Edit Profile</span>
            </div>
            <ChevronRight className="size-4 text-gray-400" />
          </DropdownMenuItem>

          {/* Notification Settings */}
          <DropdownMenuItem
            onSelect={onNotificationSettings}
            className="flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-gray-100 dark:focus:bg-gray-800"
          >
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <Bell className="size-4 text-gray-600 dark:text-gray-400" />
              </div>
              <span className="text-sm text-gray-700 dark:text-gray-300">Notifications</span>
            </div>
            <ChevronRight className="size-4 text-gray-400" />
          </DropdownMenuItem>

          {/* Dark Mode Toggle */}
          <div
            onClick={(e) => {
              e.preventDefault();
              onToggleDarkMode?.();
            }}
            className="flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                {darkMode ? (
                  <Sun className="size-4 text-amber-500" />
                ) : (
                  <Moon className="size-4 text-gray-600 dark:text-gray-400" />
                )}
              </div>
              <span className="text-sm text-gray-700 dark:text-gray-300">Dark Mode</span>
            </div>
            <Switch
              checked={darkMode}
              onCheckedChange={onToggleDarkMode}
              className="data-[state=checked]:bg-orange-500"
            />
          </div>

          {/* Help & Support */}
          <DropdownMenuItem
            onSelect={onHelpSupport}
            className="flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-gray-100 dark:focus:bg-gray-800"
          >
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <HelpCircle className="size-4 text-gray-600 dark:text-gray-400" />
              </div>
              <span className="text-sm text-gray-700 dark:text-gray-300">Help & Support</span>
            </div>
            <ChevronRight className="size-4 text-gray-400" />
          </DropdownMenuItem>
        </div>

        <DropdownMenuSeparator className="m-0" />

        {/* Logout */}
        <div className="p-2">
          <DropdownMenuItem
            onSelect={onLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40 focus:bg-red-100 dark:focus:bg-red-900/40"
          >
            <div className="size-8 rounded-lg bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
              <LogOut className="size-4 text-red-500" />
            </div>
            <span className="text-sm font-medium text-red-600 dark:text-red-400">Logout</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ProfileDropdown;
