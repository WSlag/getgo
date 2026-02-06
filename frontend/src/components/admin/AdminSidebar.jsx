import React from 'react';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  Truck,
  CreditCard,
  DollarSign,
  AlertTriangle,
  Link2,
  Star,
  Settings,
  ArrowLeft,
  X,
  Menu,
} from 'lucide-react';

const navItems = [
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'listings', label: 'Listings', icon: Package },
  { id: 'contracts', label: 'Contracts', icon: FileText },
  { id: 'shipments', label: 'Shipments', icon: Truck },
  { id: 'payments', label: 'Payments', icon: CreditCard, badge: 'pendingPayments' },
  { id: 'financial', label: 'Financial', icon: DollarSign },
  { id: 'disputes', label: 'Disputes', icon: AlertTriangle, badge: 'openDisputes' },
  { id: 'referrals', label: 'Referrals', icon: Link2 },
  { id: 'ratings', label: 'Ratings', icon: Star },
];

export function AdminSidebar({
  activeSection,
  onSectionChange,
  onBackToApp,
  badges = {},
  isOpen,
  onClose,
  className,
}) {
  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-40',
          'w-72 h-screen',
          'bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800',
          'flex flex-col',
          'transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          className
        )}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
                <LayoutDashboard className="size-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-gray-900 dark:text-white">GetGo Admin</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">Management Console</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="size-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const badgeCount = item.badge ? badges[item.badge] : null;
              const isActive = activeSection === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSectionChange(item.id);
                    onClose?.();
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-gradient-to-r from-orange-400 to-orange-600 text-white shadow-lg shadow-orange-500/30'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                  )}
                >
                  <Icon className={cn('size-5', isActive && 'text-white')} />
                  <span className="flex-1 text-left">{item.label}</span>
                  {badgeCount > 0 && (
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-full text-xs font-bold',
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                      )}
                    >
                      {badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="my-4 border-t border-gray-200 dark:border-gray-800" />

          {/* Settings */}
          <button
            onClick={() => {
              onSectionChange('settings');
              onClose?.();
            }}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200',
              activeSection === 'settings'
                ? 'bg-gradient-to-r from-orange-400 to-orange-600 text-white shadow-lg shadow-orange-500/30'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
            )}
          >
            <Settings className="size-5" />
            <span className="flex-1 text-left">Settings</span>
          </button>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={onBackToApp}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-all duration-200"
          >
            <ArrowLeft className="size-5" />
            <span>Back to App</span>
          </button>
        </div>
      </aside>
    </>
  );
}

// Mobile menu button component
export function AdminMenuButton({ onClick, className }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'lg:hidden p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm',
        'hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors',
        className
      )}
    >
      <Menu className="size-5 text-gray-600 dark:text-gray-400" />
    </button>
  );
}

export default AdminSidebar;
