import React from 'react';
import { Bell, Clock, FileText, MessageSquare, Package, Wallet, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { isChatNotificationType, sanitizeMessage } from '@/utils/messageUtils';
import { getWorkspaceLabel } from '@/utils/workspace';

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
  workspaceRole = 'shipper',
  onMarkAsRead,
  onMarkAllAsRead,
  currentUserId,
  onOpenBid,
  onOpenChat,
  onOpenListing,
  onOpenContract,
  onPayPlatformFee,
  onBrowseMarketplace,
  onOpenActivity,
  darkMode = false,
  pushPermission = 'unsupported',
  isPushRegistered = false,
  onEnablePush,
}) {
  const isMobile = useMediaQuery('(max-width: 1023px)');
  const workspaceLabel = getWorkspaceLabel(workspaceRole);

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
              {unreadCount > 0 ? `${unreadCount} unread updates` : 'All caught up'} in {workspaceLabel} workspace
            </p>
          </div>
        </div>
        {unreadCount > 0 && currentUserId && (
          <Button variant="outline" onClick={() => onMarkAllAsRead?.(currentUserId)} size={isMobile ? "sm" : "default"}>
            Mark all read
          </Button>
        )}
      </div>

      {/* Push notification opt-in card — hidden once push is active or unsupported */}
      {pushPermission === 'default' && !isPushRegistered && (
        <div className="mb-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 flex items-start gap-3">
          <span className="text-orange-500 mt-0.5 shrink-0" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800 mb-0.5">I-aktibo ang Push Notifications</p>
            <p className="text-xs text-gray-600 leading-snug">
              Matanggap ang mga alerto kahit sarado ang app — para sa bids, mensahe, at shipment updates.
            </p>
            <button
              onClick={onEnablePush}
              className="mt-2 text-xs font-semibold bg-orange-500 text-white rounded-lg px-3 py-1.5 hover:bg-orange-600 active:bg-orange-700 transition-colors"
            >
              I-aktibo
            </button>
          </div>
        </div>
      )}
      {pushPermission === 'denied' && (
        <div className="mb-4 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 flex items-start gap-3">
          <span className="text-yellow-600 mt-0.5 shrink-0" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800 mb-0.5">Notifications Blocked</p>
            <p className="text-xs text-gray-600 leading-snug">
              I-allow ang notifications sa settings ng iyong browser para matanggap ang mga push alerts.
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-center text-gray-500" style={{ padding: isMobile ? '48px 16px' : '64px 24px' }}>
          Loading notifications...
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-center" style={{ padding: isMobile ? '48px 16px' : '64px 24px' }}>
          <Bell className="mx-auto size-10 text-gray-400" />
          <p style={{ marginTop: '8px', color: '#6b7280' }}>No notifications in {workspaceLabel} workspace.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-2" style={{ marginTop: '16px' }}>
            <Button size={isMobile ? "sm" : "default"} variant="outline" onClick={onBrowseMarketplace}>
              Browse Listings
            </Button>
            <Button size={isMobile ? "sm" : "default"} onClick={onOpenActivity}>
              Open Activity
            </Button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: isMobile ? '12px' : '16px' }}>
          {notifications.map((notification) => {
            const unread = !isNotificationRead(notification);
            const normalizedType = String(notification.type || '').toUpperCase();
            const hasBid = !!notification.data?.bidId;
            const hasContract = !!notification.data?.contractId;
            const hasListing = !!notification.data?.listingId;
            const actionRequired = String(notification.data?.actionRequired || '').toUpperCase();
            const isPaymentType = (
              actionRequired === 'PAY_PLATFORM_FEE'
              || normalizedType.includes('PLATFORM_FEE')
            );
            const isBrokerListingReferral = normalizedType === 'BROKER_LISTING_REFERRAL';
            const canOpenListing = hasListing && isBrokerListingReferral;
            const notificationMessage = isChatNotificationType(notification.type)
              ? sanitizeMessage(notification.message || '')
              : (notification.message || '');

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
                      {sanitizeMessage(notification.title || 'Notification')}
                    </p>
                    <p style={{ marginTop: '4px', fontSize: isMobile ? '13px' : '14px', color: '#4b5563', lineHeight: '1.5' }}>
                      {notificationMessage}
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
                  {canOpenListing && (
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
                      {isBrokerListingReferral ? 'View Listing' : 'Open Listing'}
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
