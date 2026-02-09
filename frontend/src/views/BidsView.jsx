import React from 'react';
import { MapPin, Package, Truck, MessageSquare, Clock, Loader2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useMyBids } from '@/hooks/useBids';
import { sanitizeMessage } from '@/utils/messageUtils';

export function BidsView({
  currentUser,
  currentRole = 'trucker',
  onOpenChat,
  darkMode = false,
}) {
  const { bids, loading } = useMyBids(currentUser?.uid);
  const isMobile = useMediaQuery('(max-width: 1023px)');

  const formatPrice = (price) => {
    if (!price) return '---';
    return `₱${Number(price).toLocaleString()}`;
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    const now = Date.now();
    const time = timestamp instanceof Date ? timestamp.getTime() : timestamp;
    const diff = now - time;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      accepted: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    };
    return styles[status] || styles.pending;
  };

  const isTrucker = currentRole === 'trucker';
  const title = isTrucker ? 'My Bids' : 'My Bookings';
  const description = isTrucker
    ? 'View and manage your cargo bids'
    : 'View and manage your truck bookings';

  return (
    <main className={cn("flex-1 bg-gray-50 dark:bg-gray-950 overflow-y-auto")} style={{ padding: isMobile ? '20px' : '24px', paddingBottom: isMobile ? '100px' : '24px' }}>
      {/* Header */}
      <div style={{ marginBottom: isMobile ? '16px' : '24px' }}>
        <h2 style={{ fontSize: isMobile ? '20px' : '28px', fontWeight: 'bold', color: darkMode ? '#fff' : '#111827', marginBottom: '8px' }}>
          {title}
        </h2>
        <p style={{ fontSize: isMobile ? '13px' : '14px', color: '#6b7280' }}>
          {description}
        </p>
      </div>

      {/* Bids List */}
      {loading ? (
        <div className="flex items-center justify-center" style={{ paddingTop: '48px', paddingBottom: '48px' }}>
          <Loader2 className={cn(
            "size-8 animate-spin",
            isTrucker ? "text-emerald-500" : "text-violet-500"
          )} />
        </div>
      ) : bids.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center" style={{ paddingTop: '48px', paddingBottom: '48px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: darkMode ? '#1f2937' : '#f3f4f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px'
          }}>
            <FileText className="size-8 text-gray-400" />
          </div>
          <p style={{ fontSize: isMobile ? '15px' : '16px', fontWeight: '500', color: darkMode ? '#d1d5db' : '#4b5563', marginBottom: '4px' }}>
            No {isTrucker ? 'bids' : 'bookings'} yet
          </p>
          <p style={{ fontSize: isMobile ? '12px' : '14px', color: '#6b7280' }}>
            Your {isTrucker ? 'bids' : 'bookings'} will appear here
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '12px' : '16px' }}>
          {bids.map((bid) => {
            const Icon = bid.listingType === 'cargo' ? Package : Truck;

            return (
              <div
                key={bid.id}
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800" style={{ padding: isMobile ? '12px 16px' : '16px 20px' }}>
                  <div className="flex items-center" style={{ gap: isMobile ? '8px' : '12px' }}>
                    <div style={{
                      width: isMobile ? '36px' : '40px',
                      height: isMobile ? '36px' : '40px',
                      borderRadius: '50%',
                      background: bid.listingType === 'cargo'
                        ? 'linear-gradient(to bottom right, #fb923c, #ea580c)'
                        : 'linear-gradient(to bottom right, #3b82f6, #2563eb)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Icon style={{ width: isMobile ? '18px' : '20px', height: isMobile ? '18px' : '20px', color: '#fff' }} />
                    </div>
                    <div>
                      <p style={{ fontSize: isMobile ? '14px' : '15px', fontWeight: '600', color: darkMode ? '#fff' : '#111827' }}>
                        {bid.listingOwnerName || 'Unknown'}
                      </p>
                      <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#6b7280' }}>
                        <Clock style={{ width: '12px', height: '12px', display: 'inline', marginRight: '4px' }} />
                        {formatTimeAgo(bid.createdAt)}
                      </p>
                    </div>
                  </div>
                  <Badge className={getStatusBadge(bid.status)} style={{ padding: isMobile ? '4px 10px' : '6px 12px', fontSize: isMobile ? '10px' : '11px', textTransform: 'uppercase' }}>
                    {bid.status}
                  </Badge>
                </div>

                {/* Content */}
                <div style={{ padding: isMobile ? '12px 16px' : '16px 20px' }}>
                  {/* Route */}
                  <div className="flex items-center" style={{ gap: isMobile ? '8px' : '12px', marginBottom: isMobile ? '10px' : '12px' }}>
                    <div className="flex items-center" style={{ gap: '6px', flex: 1, minWidth: 0 }}>
                      <MapPin style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px', color: '#10b981', flexShrink: 0 }} />
                      <span style={{ fontSize: isMobile ? '13px' : '14px', color: darkMode ? '#d1d5db' : '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {bid.origin || '---'}
                      </span>
                    </div>
                    <span className="text-orange-500" style={{ fontSize: isMobile ? '14px' : '16px', flexShrink: 0 }}>→</span>
                    <div className="flex items-center" style={{ gap: '6px', flex: 1, minWidth: 0 }}>
                      <MapPin style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px', color: '#ef4444', flexShrink: 0 }} />
                      <span style={{ fontSize: isMobile ? '13px' : '14px', color: darkMode ? '#d1d5db' : '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {bid.destination || '---'}
                      </span>
                    </div>
                  </div>

                  {/* Your Bid */}
                  <div className="flex items-center justify-between" style={{ marginBottom: bid.message ? (isMobile ? '10px' : '12px') : 0 }}>
                    <span style={{ fontSize: isMobile ? '12px' : '13px', color: '#6b7280' }}>Your bid:</span>
                    <span style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: 'bold', color: '#10b981' }}>
                      {formatPrice(bid.price)}
                    </span>
                  </div>

                  {/* Message */}
                  {bid.message && (
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 rounded-lg" style={{ padding: isMobile ? '8px 10px' : '10px 12px', marginBottom: isMobile ? '10px' : '12px' }}>
                      <div className="flex items-start" style={{ gap: '6px' }}>
                        <MessageSquare style={{ width: '14px', height: '14px', color: '#10b981', marginTop: '2px', flexShrink: 0 }} />
                        <p style={{ fontSize: isMobile ? '12px' : '13px', color: '#059669', fontStyle: 'italic' }}>
                          "{sanitizeMessage(bid.message)}"
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Chat Button */}
                  <Button
                    variant="outline"
                    size={isMobile ? "sm" : "default"}
                    className="w-full gap-2"
                    onClick={() => {
                      const listingData = {
                        id: bid.listingId,
                        listingType: bid.listingType,
                        origin: bid.origin,
                        destination: bid.destination,
                        userId: bid.listingOwnerId,
                        userName: bid.listingOwnerName,
                        shipper: bid.listingOwnerName,
                        trucker: bid.listingOwnerName,
                      };
                      onOpenChat?.(bid, listingData);
                    }}
                  >
                    <MessageSquare className="size-4" />
                    View Chat
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

export default BidsView;
