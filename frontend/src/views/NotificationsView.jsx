import React from 'react';
import { Bell, Clock, FileText, MessageSquare, Package, Wallet, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';

function isNotificationRead(notification) {
  return notification?.isRead === true || notification?.read === true;
}

function formatTime(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function NotificationsView({
  notifications = [],
  loading = false,
  unreadCount = 0,
  onMarkAsRead,
  onMarkAllAsRead,
  currentUserId,
  onOpenBid,
  onOpenChat,
  onOpenListing,
  onOpenContract,
  onPayPlatformFee,
  darkMode = false,
}) {
  const isMobile = useMediaQuery('(max-width: 1023px)');

  const handleMarkRead = (notification) => {
    if (!currentUserId || !notification?.id || isNotificationRead(notification)) {
      return;
    }
    onMarkAsRead?.(currentUserId, notification.id);
  };

  return (
    <main className="flex-1 bg-gray-50 dark:bg-gray-950 overflow-y-auto" style={{ padding: isMobile ? '16px' : '24px', paddingBottom: isMobile ? 'calc(100px + env(safe-area-inset-bottom, 0px))' : '24px' }}>
      {/* Header */}
      <div style={{ marginBottom: isMobile ? '24px' : '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div className="size-12 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
            <Bell className="size-6 text-white" />
          </div>
          <div>
            <h1 style={{
              fontWeight: 'bold',
              color: darkMode ? '#fff' : '#111827',
              fontSize: isMobile ? '20px' : '24px',
              marginBottom: '4px',
              lineHeight: '1.2'
            }}>Notifications</h1>
            <p style={{
              color: darkMode ? '#9ca3af' : '#6b7280',
              fontSize: isMobile ? '12px' : '14px'
            }}>
              {unreadCount > 0 ? `${unreadCount} unread updates` : 'All caught up'}
            </p>
          </div>
        </div>
        {unreadCount > 0 && currentUserId && (
          <Button variant="outline" onClick={() => onMarkAllAsRead?.(currentUserId)} size={isMobile ? "sm" : "default"}>
            Mark all read
          </Button>
        )}
      </div>

      {loading ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-center text-gray-500" style={{ padding: isMobile ? '48px 16px' : '64px 24px' }}>
          Loading notifications...
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-center" style={{ padding: isMobile ? '48px 16px' : '64px 24px' }}>
          <Bell className="mx-auto size-10 text-gray-400" />
          <p style={{ marginTop: '8px', color: '#6b7280' }}>No notifications yet.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: isMobile ? '12px' : '16px' }}>
          {notifications.map((notification) => {
            const unread = !isNotificationRead(notification);
            const normalizedType = String(notification.type || '').toUpperCase();
            const hasBid = !!notification.data?.bidId;
            const hasContract = !!notification.data?.contractId;
            const hasListing = !!notification.data?.listingId;
            const isPaymentType = normalizedType.includes('PLATFORM_FEE') || normalizedType === 'ACCOUNT_SUSPENDED';
            const isChatRequest = normalizedType === 'CHAT_REQUEST';

            return (
              <div
                key={notification.id}
                className={cn(
                  'rounded-xl border bg-white dark:bg-gray-900 cursor-pointer transition-all hover:shadow-lg',
                  unread
                    ? 'border-orange-200 dark:border-orange-700 shadow-sm'
                    : 'border-gray-200 dark:border-gray-800'
                )}
                style={{ padding: isMobile ? '16px' : '20px' }}
                onClick={() => handleMarkRead(notification)}
              >
                <div className="flex items-start justify-between" style={{ gap: isMobile ? '12px' : '16px' }}>
                  <div className="min-w-0 flex-1">
                    <p style={{ fontWeight: unread ? '700' : '600', color: darkMode ? '#fff' : '#111827', fontSize: isMobile ? '14px' : '16px' }}>
                      {notification.title || 'Notification'}
                    </p>
                    <p style={{ marginTop: '4px', fontSize: isMobile ? '13px' : '14px', color: '#4b5563', lineHeight: '1.5' }}>
                      {notification.message || ''}
                    </p>
                    <div className="flex items-center gap-1" style={{ marginTop: isMobile ? '8px' : '12px', fontSize: isMobile ? '11px' : '12px', color: '#6b7280' }}>
                      <Clock className="size-3" />
                      <span>{notification.time || formatTime(notification.createdAt)}</span>
                    </div>
                  </div>
                  {unread && <span className="size-2 rounded-full bg-orange-500 flex-shrink-0 mt-1" />}
                </div>

                <div className="flex flex-wrap gap-2" style={{ marginTop: isMobile ? '12px' : '16px' }}>
                  {hasBid && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleMarkRead(notification);
                        onOpenBid?.(notification);
                      }}
                    >
                      <Package className="size-4" />
                      Open Bid
                    </Button>
                  )}
                  {hasBid && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleMarkRead(notification);
                        onOpenChat?.(notification);
                      }}
                    >
                      <MessageSquare className="size-4" />
                      Open Chat
                    </Button>
                  )}
                  {hasContract && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleMarkRead(notification);
                        onOpenContract?.(notification.data.contractId);
                      }}
                    >
                      <FileText className="size-4" />
                      Open Contract
                    </Button>
                  )}
                  {isPaymentType && hasContract && (
                    <Button
                      size="sm"
                      variant="default"
                      className="gap-1"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleMarkRead(notification);
                        onPayPlatformFee?.({ contractId: notification.data.contractId });
                      }}
                    >
                      <Wallet className="size-4" />
                      Pay Now
                    </Button>
                  )}
                  {isChatRequest && hasListing && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleMarkRead(notification);
                        onOpenListing?.(notification);
                      }}
                    >
                      <MapPin className="size-4" />
                      Open Listing
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

export default NotificationsView;
