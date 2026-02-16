import React from 'react';
import { Home, MessageSquare, Plus, ClipboardList, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export function MobileNav({
  activeTab = 'home',
  onTabChange,
  onPostClick,
  unreadMessages = 0,
  activityBadge = 0, // Combined bids + contracts count
  currentRole = 'shipper', // 'shipper' or 'trucker'
  className,
}) {
  // Streamlined 5-item navigation
  // [Home] [Activity] [+ Post] [Messages] [Profile]
  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'activity', label: 'Activity', icon: ClipboardList, badge: activityBadge },
    { id: 'post', label: 'Post', icon: Plus, isAction: true },
    { id: 'messages', label: 'Messages', icon: MessageSquare, badge: unreadMessages },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-t border-gray-200/50 dark:border-gray-800/50 px-2 pb-safe lg:hidden",
        className
      )}
    >
      <div className="flex items-center justify-around" style={{ paddingTop: '8px', paddingBottom: '8px' }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          if (item.isAction) {
            // Post button - special styling with Figma polish
            return (
              <button
                key={item.id}
                onClick={onPostClick}
                className="relative flex flex-col items-center justify-center group"
                style={{ marginTop: '-18px' }}
              >
                <div className="size-14 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/40 hover:shadow-xl hover:shadow-orange-500/50 hover:scale-105 active:scale-95 transition-all duration-300">
                  <Icon className="size-6 text-white group-hover:rotate-90 transition-transform duration-300" />
                </div>
                <span className="text-[10px] font-medium text-orange-600 dark:text-orange-400" style={{ marginTop: '4px' }}>
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
                "flex flex-col items-center justify-center rounded-xl transition-all duration-300 relative hover:scale-105 active:scale-95",
                isActive
                  ? "text-orange-600 dark:text-orange-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              )}
              style={{ padding: '8px 12px' }}
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
