import React, { useState, useMemo } from 'react';
import { Bell, Package, Truck, MessageSquare, MapPin, Star, FileText, Loader2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const notificationIcons = {
  bid: Package,
  message: MessageSquare,
  shipment: MapPin,
  rating: Star,
  contract: FileText,
  truck: Truck,
  default: Bell,
};

const notificationColors = {
  bid: 'linear-gradient(to bottom right, #fb923c, #ea580c)',
  message: 'linear-gradient(to bottom right, #60a5fa, #2563eb)',
  shipment: 'linear-gradient(to bottom right, #4ade80, #16a34a)',
  rating: 'linear-gradient(to bottom right, #facc15, #ca8a04)',
  contract: 'linear-gradient(to bottom right, #c084fc, #9333ea)',
  truck: 'linear-gradient(to bottom right, #818cf8, #4f46e5)',
  default: 'linear-gradient(to bottom right, #9ca3af, #4b5563)',
};

const filterTabs = ['All', 'Bids', 'Contracts', 'Messages', 'Shipments'];
const isRead = (notification) => notification?.isRead === true || notification?.read === true;

export function NotificationsModal({
  open,
  onClose,
  notifications = [],
  loading = false,
  onMarkAsRead,
  onMarkAllAsRead,
  currentUserId,
  onOpenContract,
  onPayPlatformFee,
}) {
  const [activeFilter, setActiveFilter] = useState('All');

  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'All') return notifications;

    const filterMap = {
      'Bids': ['bid', 'bid_accepted', 'bid_rejected', 'new_bid'],
      'Contracts': ['contract', 'contract_ready', 'contract_created', 'contract_signed'],
      'Messages': ['message', 'chat', 'new_message'],
      'Shipments': ['shipment', 'delivery', 'tracking', 'pickup', 'delivered'],
    };

    const types = filterMap[activeFilter] || [];
    return notifications.filter(n => types.some(t => n.type?.toLowerCase().includes(t)));
  }, [notifications, activeFilter]);

  const unreadCount = useMemo(() => {
    return notifications.filter((notification) => !isRead(notification)).length;
  }, [notifications]);

  const handleNotificationClick = (notification) => {
    // Mark as read
    if (!isRead(notification) && onMarkAsRead) {
      onMarkAsRead(currentUserId, notification.id);
    }

    // Handle platform fee payment notifications (priority - show payment modal)
    if (
      (notification.type === 'PLATFORM_FEE_OUTSTANDING' ||
       notification.type === 'PLATFORM_FEE_REMINDER' ||
       notification.type === 'ACCOUNT_SUSPENDED') &&
      notification.data?.contractId &&
      onPayPlatformFee
    ) {
      onClose(); // Close notifications modal
      onPayPlatformFee({ contractId: notification.data.contractId }); // Open payment modal
      return;
    }

    // Handle all contract-related notifications - navigate to contract modal
    const contractNotificationTypes = [
      'CONTRACT_READY',
      'CONTRACT_CREATED',
      'CONTRACT_SIGNED',
      'SHIPMENT_UPDATE',
      'contract',
      'contract_ready',
      'contract_created',
      'contract_signed'
    ];

    if (
      contractNotificationTypes.includes(notification.type) &&
      notification.data?.contractId &&
      onOpenContract
    ) {
      onClose(); // Close notifications modal
      onOpenContract(notification.data.contractId); // Open contract modal
    }
  };

  const handleMarkAllRead = () => {
    if (onMarkAllAsRead && currentUserId) {
      onMarkAllAsRead(currentUserId);
    }
  };

  const getIcon = (type) => {
    const normalizedType = type?.toLowerCase() || 'default';
    for (const [key, Icon] of Object.entries(notificationIcons)) {
      if (normalizedType.includes(key)) return Icon;
    }
    return Bell;
  };

  const getColors = (type) => {
    const normalizedType = type?.toLowerCase() || 'default';
    for (const [key, color] of Object.entries(notificationColors)) {
      if (normalizedType.includes(key)) return color;
    }
    return notificationColors.default;
  };

  const formatTimeAgo = (date) => {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    const now = new Date();
    const diff = now - d;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  };

  // Extract clean message from notification
  const getNotificationMessage = (notification) => {
    const msg = notification.message || notification.body || '';

    // If message has format "SenderName: "actual message"", extract just the message
    const match = msg.match(/^[^:]+:\s*"(.+)"$/);
    if (match) {
      return match[1];
    }

    // If message has format "User: "content"", extract just the content
    const userMatch = msg.match(/^User:\s*"(.+)"$/);
    if (userMatch) {
      return userMatch[1];
    }

    return msg;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden backdrop-blur-sm">
        <DialogHeader>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'linear-gradient(to bottom right, #fb923c, #ea580c)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 10px 15px -3px rgba(249, 115, 22, 0.3)',
              }}>
                <Bell style={{ width: '24px', height: '24px', color: 'white' }} />
              </div>
              <div>
                <DialogTitle style={{ fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Notifications
                  {unreadCount > 0 && (
                    <span style={{
                      padding: '2px 8px',
                      fontSize: '12px',
                      fontWeight: '600',
                      backgroundColor: '#f97316',
                      color: 'white',
                      borderRadius: '9999px',
                    }}>
                      {unreadCount}
                    </span>
                  )}
                </DialogTitle>
                <DialogDescription style={{ fontSize: '14px', color: '#6b7280', marginTop: '2px' }}>
                  Stay updated on your activity
                </DialogDescription>
              </div>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="px-3 py-2 text-sm font-medium text-orange-500 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-300 bg-transparent border-none rounded-lg cursor-pointer transition-colors"
              >
                Mark all as read
              </button>
            )}
          </div>
        </DialogHeader>

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 pt-2 scrollbar-none">
          {filterTabs.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 border-none cursor-pointer flex-shrink-0',
                activeFilter === filter
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
              )}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Notifications List */}
        <div className="overflow-y-auto pr-1" style={{ maxHeight: 'calc(90vh - 280px)' }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-8 text-orange-500 animate-spin" />
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="size-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                <Bell className="size-8 text-gray-400 dark:text-gray-500" />
              </div>
              <p className="font-medium text-gray-600 dark:text-gray-400 mb-1">
                No notifications yet
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                {activeFilter === 'All'
                  ? "You'll be notified about important updates here"
                  : `No ${activeFilter.toLowerCase()} notifications`}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredNotifications.map((notification) => {
                const IconComponent = getIcon(notification.type);
                const iconBg = getColors(notification.type);
                const isUnread = !isRead(notification);

                return (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      'rounded-xl border p-4 cursor-pointer transition-all duration-200 hover:shadow-sm',
                      isUnread
                        ? 'bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800/50'
                        : 'bg-gray-50 border-gray-200 dark:bg-gray-800/50 dark:border-gray-700'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="size-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: iconBg }}
                      >
                        <IconComponent className="size-5 text-white" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-gray-900 dark:text-white leading-snug">
                              {notification.data?.senderName || notification.title || 'Notification'}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 break-words leading-snug">
                              {getNotificationMessage(notification)}
                            </p>
                          </div>
                          {isUnread && (
                            <span className="size-2.5 rounded-full bg-orange-500 flex-shrink-0 mt-1.5" />
                          )}
                        </div>

                        {notification.route && (
                          <div className="flex items-center gap-2 mt-2 px-2 py-1.5 bg-white dark:bg-gray-900 rounded-lg">
                            <MapPin className="size-3 text-green-500 flex-shrink-0" />
                            <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{notification.route}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                            <Clock className="size-3" />
                            <span>{notification.time || formatTimeAgo(notification.createdAt)}</span>
                          </div>
                          {notification.amount && (
                            <span className="font-bold text-sm text-orange-600 dark:text-orange-400">
                              PHP {Number(notification.amount).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default NotificationsModal;
