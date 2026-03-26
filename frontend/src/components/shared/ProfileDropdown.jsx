import React from 'react';
import { UserCircle, Bell, Moon, Sun, HelpCircle, LogOut, ChevronRight, Star, Truck, Package, Users, ClipboardList, Shield } from 'lucide-react';
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
  workspaceRole = 'shipper',
  isBroker = false,
  isAdmin = false,
  darkMode = false,
  onToggleDarkMode,
  onMyActivity,
  onBrokerDashboard,
  onMyProfile,
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
    broker: {
      color: 'orange',
      bgGradient: 'from-orange-50 to-amber-100 dark:from-orange-950/30 dark:to-amber-900/30',
      badgeBg: 'bg-orange-100 dark:bg-orange-900/50',
      badgeText: 'text-orange-600 dark:text-orange-300',
      avatarBorder: 'border-orange-500',
      icon: Users,
      label: 'Broker Workspace',
    },
  };

  const displayRole = workspaceRole || currentRole;
  const config = roleConfig[displayRole] || roleConfig.shipper;
  const RoleIcon = config.icon;

  const menuItemClass = 'w-full rounded-xl px-3 py-3 cursor-pointer transition-colors hover:bg-orange-50 dark:hover:bg-gray-800 focus:bg-orange-50 dark:focus:bg-gray-800';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild className={className}>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[min(20rem,calc(100vw-1rem))] sm:w-64 max-h-[calc(100vh-96px)] overflow-x-hidden overflow-y-auto p-0 rounded-2xl border-0 bg-white dark:bg-gray-900"
        style={{ boxShadow: '0 20px 56px rgba(0,0,0,0.14), 0 4px 16px rgba(249,115,22,0.10)' }}
      >
        {/* Profile Header — orange gradient band */}
        <div
          className="relative overflow-hidden px-4 pt-5 pb-4"
          style={{ background: 'linear-gradient(135deg, #FF9A56 0%, #FF6B35 100%)' }}
        >
          {/* Decorative rings */}
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full border border-white/10 pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full border border-white/10 pointer-events-none" />

          <div className="relative z-10 flex flex-col items-center">
            {/* Avatar */}
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={name}
                className="size-16 rounded-full object-cover border-2 border-white/40 shadow-lg"
              />
            ) : (
              <div
                className="size-16 rounded-full border-2 border-white/40 flex items-center justify-center text-2xl font-bold text-white shadow-lg"
                style={{ background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(4px)' }}
              >
                {initial}
              </div>
            )}

            {/* Name */}
            <h3 className="mt-3 font-black text-white text-base leading-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
              {name}
            </h3>

            {/* Role badge */}
            <div className="mt-2 flex items-center gap-1.5 rounded-full bg-white/20 border border-white/30 px-3 py-1">
              <RoleIcon className="size-3 text-white" />
              <span className="text-[11px] font-semibold text-white">{config.label}</span>
            </div>

            {/* Rating & Stats */}
            <div className="mt-2 flex items-center gap-1.5 text-xs text-white/80">
              <Star className="size-3 fill-white text-white" />
              <span className="font-semibold text-white">{rating.toFixed(1)}</span>
              <span className="text-white/50">•</span>
              <span>{tripsCompleted} trips completed</span>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="p-2 pt-2">
          {/* My Activity */}
          <DropdownMenuItem onSelect={onMyActivity} className={menuItemClass}>
            <div className="flex w-full min-w-0 items-center gap-3">
              <div className="size-8 shrink-0 rounded-lg bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
                <ClipboardList className="size-4 text-orange-500" />
              </div>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-700 dark:text-gray-300">My Activity</span>
              <ChevronRight className="size-4 shrink-0 text-gray-300 dark:text-gray-600" />
            </div>
          </DropdownMenuItem>

          {/* Broker Dashboard */}
          <DropdownMenuItem onSelect={onBrokerDashboard} className={menuItemClass}>
            <div className="flex w-full min-w-0 items-center gap-3">
              <div className="size-8 shrink-0 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <Users className="size-4 text-gray-500 dark:text-gray-400" />
              </div>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-700 dark:text-gray-300">{isBroker ? 'Broker Dashboard' : 'Broker Program'}</span>
              <div className="flex items-center gap-2 shrink-0">
                {!isBroker && (
                  <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 text-[10px] font-bold">
                    Earn!
                  </span>
                )}
                <ChevronRight className="size-4 text-gray-300 dark:text-gray-600" />
              </div>
            </div>
          </DropdownMenuItem>

          {/* My Profile */}
          <DropdownMenuItem onSelect={onMyProfile} className={menuItemClass}>
            <div className="flex w-full min-w-0 items-center gap-3">
              <div className="size-8 shrink-0 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <UserCircle className="size-4 text-orange-600 dark:text-orange-400" />
              </div>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-700 dark:text-gray-300">My Profile</span>
              <ChevronRight className="size-4 shrink-0 text-gray-300 dark:text-gray-600" />
            </div>
          </DropdownMenuItem>

          {/* Notifications */}
          <DropdownMenuItem onSelect={onNotificationSettings} className={menuItemClass}>
            <div className="flex w-full min-w-0 items-center gap-3">
              <div className="size-8 shrink-0 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <Bell className="size-4 text-gray-500 dark:text-gray-400" />
              </div>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-700 dark:text-gray-300">Notifications</span>
              <ChevronRight className="size-4 shrink-0 text-gray-300 dark:text-gray-600" />
            </div>
          </DropdownMenuItem>

          {/* Dark Mode Toggle */}
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              onToggleDarkMode?.();
            }}
            className={menuItemClass}
          >
            <div className="flex w-full min-w-0 items-center gap-3">
              <div className="size-8 shrink-0 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                {darkMode ? (
                  <Sun className="size-4 text-amber-500" />
                ) : (
                  <Moon className="size-4 text-gray-500 dark:text-gray-400" />
                )}
              </div>
              <span className="min-w-0 flex-1 text-sm font-medium text-gray-700 dark:text-gray-300 text-left">Dark Mode</span>
              <Switch
                checked={darkMode}
                onCheckedChange={onToggleDarkMode}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                className="data-[state=checked]:bg-orange-500"
              />
            </div>
          </DropdownMenuItem>

          {/* Help & Support */}
          <DropdownMenuItem onSelect={onHelpSupport} className={menuItemClass}>
            <div className="flex w-full min-w-0 items-center gap-3">
              <div className="size-8 shrink-0 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <HelpCircle className="size-4 text-gray-500 dark:text-gray-400" />
              </div>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-700 dark:text-gray-300">Help & Support</span>
              <ChevronRight className="size-4 shrink-0 text-gray-300 dark:text-gray-600" />
            </div>
          </DropdownMenuItem>

          {/* Admin Dashboard (Mobile only) */}
          {isAdmin && (
            <DropdownMenuItem onSelect={onAdminDashboard} className={cn(menuItemClass, 'lg:hidden')}>
              <div className="flex w-full min-w-0 items-center gap-3">
                <div className="size-8 shrink-0 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                  <Shield className="size-4 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-amber-700 dark:text-amber-300">Admin Dashboard</span>
                <ChevronRight className="size-4 shrink-0 text-amber-400/60" />
              </div>
            </DropdownMenuItem>
          )}

          {/* Logout */}
          <div className="mt-1 pt-1 border-t border-gray-100 dark:border-gray-800">
            <DropdownMenuItem
              onSelect={onLogout}
              className="w-full rounded-xl px-3 py-3 cursor-pointer transition-colors hover:bg-red-50 dark:hover:bg-red-950/30 focus:bg-red-50 dark:focus:bg-red-950/30"
            >
              <div className="flex w-full min-w-0 items-center gap-3">
                <div className="size-8 shrink-0 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                  <LogOut className="size-4 text-red-500" />
                </div>
                <span className="text-sm font-semibold text-red-500 dark:text-red-400">Logout</span>
              </div>
            </DropdownMenuItem>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ProfileDropdown;
