import React, { useState, useMemo } from 'react';
import { Bell, Package, Truck, MessageSquare, MapPin, Star, FileText, Loader2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
    return notifications.filter(n => !n.read && !n.isRead).length;
  }, [notifications]);

  const handleNotificationClick = (notification) => {
    // Mark as read
    if (!notification.read && !notification.isRead && onMarkAsRead) {
      onMarkAsRead(currentUserId, notification.id);
    }

    // Handle platform fee payment notifications
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

    // Handle contract notifications - navigate to contract modal
    if (
      (notification.type === 'CONTRACT_READY' ||
       notification.type === 'CONTRACT_CREATED') &&
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto backdrop-blur-sm">
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
                <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '2px' }}>
                  Stay updated on your activity
                </p>
              </div>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                style={{
                  padding: '8px 12px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#f97316',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                Mark all as read
              </button>
            )}
          </div>
        </DialogHeader>

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 pt-2">
          {filterTabs.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              style={{
                padding: '8px 16px',
                borderRadius: '9999px',
                fontSize: '14px',
                fontWeight: '500',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s',
                backgroundColor: activeFilter === filter ? '#f97316' : '#f3f4f6',
                color: activeFilter === filter ? '#ffffff' : '#4b5563',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Notifications List */}
        <div className="max-h-[calc(90vh-280px)] overflow-y-auto pr-2">
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
              <Loader2 style={{ width: '32px', height: '32px', color: '#f97316', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', textAlign: 'center' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                <Bell style={{ width: '32px', height: '32px', color: '#9ca3af' }} />
              </div>
              <p style={{ color: '#4b5563', fontWeight: '500', marginBottom: '4px' }}>
                No notifications yet
              </p>
              <p style={{ fontSize: '14px', color: '#6b7280' }}>
                {activeFilter === 'All'
                  ? "You'll be notified about important updates here"
                  : `No ${activeFilter.toLowerCase()} notifications`}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredNotifications.map((notification) => {
                const IconComponent = getIcon(notification.type);
                const iconBg = getColors(notification.type);
                const isUnread = !notification.read && !notification.isRead;

                return (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    style={{
                      padding: '16px',
                      borderRadius: '12px',
                      border: isUnread ? '1px solid #fed7aa' : '1px solid #e5e7eb',
                      backgroundColor: isUnread ? '#fff7ed' : '#f9fafb',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '12px',
                        background: iconBg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <IconComponent style={{ width: '20px', height: '20px', color: 'white' }} />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: '600', color: '#111827', fontSize: '14px', margin: 0 }}>
                              {notification.data?.senderName || notification.title || 'Notification'}
                            </p>
                            <p style={{ fontSize: '14px', color: '#4b5563', marginTop: '2px' }}>
                              {getNotificationMessage(notification)}
                            </p>
                          </div>
                          {isUnread && (
                            <span style={{ width: '10px', height: '10px', backgroundColor: '#f97316', borderRadius: '50%', flexShrink: 0, marginTop: '6px' }} />
                          )}
                        </div>

                        {notification.route && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', padding: '8px', backgroundColor: 'white', borderRadius: '8px', fontSize: '12px' }}>
                            <MapPin style={{ width: '12px', height: '12px', color: '#22c55e', flexShrink: 0 }} />
                            <span style={{ color: '#6b7280' }}>{notification.route}</span>
                          </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#6b7280' }}>
                            <Clock style={{ width: '12px', height: '12px' }} />
                            <span>{notification.time || formatTimeAgo(notification.createdAt)}</span>
                          </div>
                          {notification.amount && (
                            <span style={{ fontWeight: '700', fontSize: '14px', color: '#ea580c' }}>
                              ₱{Number(notification.amount).toLocaleString()}
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
        <div style={{ display: 'flex', gap: '12px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
          <Button variant="ghost" onClick={onClose} style={{ flex: 1 }}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default NotificationsModal;
