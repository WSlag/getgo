import React from 'react';
import { Home, Package, MessageSquare, TrendingUp, User, Plus, Bell, ClipboardList, Map } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export function MobileNav({
  activeTab = 'home',
  onTabChange,
  onPostClick,
  unreadMessages = 0,
  unreadNotifications = 0,
  unreadBids = 0,
  currentRole = 'shipper', // 'shipper' or 'trucker'
  className,
}) {
  // Account-specific navigation items
  // Shipper: Home, Bookings, Post, Chat, Track
  // Trucker: Home, My Bids, Post, Chat, Routes
  const shipperNavItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'bids', label: 'Bookings', icon: ClipboardList, badge: unreadBids },
    { id: 'post', label: 'Post', icon: Plus, isAction: true },
    { id: 'chat', label: 'Chat', icon: MessageSquare, badge: unreadMessages },
    { id: 'tracking', label: 'Track', icon: TrendingUp },
  ];

  const truckerNavItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'bids', label: 'My Bids', icon: Package, badge: unreadBids },
    { id: 'post', label: 'Post', icon: Plus, isAction: true },
    { id: 'chat', label: 'Chat', icon: MessageSquare, badge: unreadMessages },
    { id: 'tracking', label: 'Routes', icon: Map },
  ];

  const navItems = currentRole === 'trucker' ? truckerNavItems : shipperNavItems;

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-t border-gray-200/50 dark:border-gray-800/50 px-2 pb-safe lg:hidden",
        className
      )}
    >
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          if (item.isAction) {
            // Post button - special styling with Figma polish
            return (
              <button
                key={item.id}
                onClick={onPostClick}
                className="relative -mt-6 flex flex-col items-center justify-center group"
              >
                <div className="size-14 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/40 hover:shadow-xl hover:shadow-orange-500/50 hover:scale-105 active:scale-95 transition-all duration-300">
                  <Icon className="size-6 text-white group-hover:rotate-90 transition-transform duration-300" />
                </div>
                <span className="text-[10px] font-medium text-orange-600 dark:text-orange-400 mt-1">
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => onTabChange?.(item.id)}
              className={cn(
                "flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all duration-300 relative hover:scale-105 active:scale-95",
                isActive
                  ? "text-orange-600 dark:text-orange-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              )}
            >
              <div className="relative">
                <Icon className={cn("size-5 mb-1 transition-transform duration-300", isActive && "scale-110")} />
                {item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 size-4 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white dark:border-gray-900">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>
              <span className={cn("text-[10px] font-medium transition-all duration-300", isActive && "font-semibold")}>
                {item.label}
              </span>
              {isActive && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-gradient-to-r from-orange-400 to-orange-600 shadow-sm shadow-orange-500/50" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default MobileNav;
