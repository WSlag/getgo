import React from 'react';
import { MapPin, Package, Truck, DollarSign, MessageSquare, Clock, Loader2, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useMyBids } from '@/hooks/useBids';
import { sanitizeMessage } from '@/utils/messageUtils';

export function MyBidsModal({
  open,
  onClose,
  currentUser,
  currentRole = 'trucker',
  onOpenChat,
}) {
  const { bids, loading } = useMyBids(currentUser?.uid);

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
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent style={{ maxWidth: '600px', maxHeight: '85vh', overflow: 'hidden' }}>
        <DialogHeader>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: isTrucker
                ? 'linear-gradient(to bottom right, #34d399, #10b981)'
                : 'linear-gradient(to bottom right, #a78bfa, #7c3aed)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isTrucker
                ? '0 10px 15px -3px rgba(16, 185, 129, 0.3)'
                : '0 10px 15px -3px rgba(139, 92, 246, 0.3)'
            }}>
              <FileText style={{ width: '24px', height: '24px', color: 'white' }} />
            </div>
            <div>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Bids List */}
        <div style={{
          maxHeight: 'calc(85vh - 140px)',
          overflowY: 'auto',
          paddingRight: '8px',
        }}>
          {loading ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '48px 0',
            }}>
              <Loader2 style={{
                width: '32px',
                height: '32px',
                color: isTrucker ? '#10b981' : '#7c3aed',
                animation: 'spin 1s linear infinite'
              }} />
            </div>
          ) : bids.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '48px 0',
              textAlign: 'center',
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: '#f3f4f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}>
                <FileText style={{ width: '32px', height: '32px', color: '#9ca3af' }} />
              </div>
              <p style={{ color: '#4b5563', fontWeight: '500', marginBottom: '4px' }}>
                No {isTrucker ? 'bids' : 'bookings'} yet
              </p>
              <p style={{ fontSize: '14px', color: '#6b7280' }}>
                {isTrucker
                  ? 'Start bidding on cargo listings to see them here'
                  : 'Book trucks to see your bookings here'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {bids.map((bid) => (
                <div
                  key={bid.id}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    backgroundColor: '#f9fafb',
                    border: '1px solid #e5e7eb',
                  }}
                >
                  {/* Header - Listing Info */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        background: bid.cargoListingId
                          ? 'linear-gradient(to bottom right, #fb923c, #ea580c)'
                          : 'linear-gradient(to bottom right, #a78bfa, #7c3aed)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        {bid.cargoListingId ? (
                          <Package style={{ width: '20px', height: '20px', color: 'white' }} />
                        ) : (
                          <Truck style={{ width: '20px', height: '20px', color: 'white' }} />
                        )}
                      </div>
                      <div>
                        <p style={{ fontWeight: '600', color: '#111827', fontSize: '14px' }}>
                          {bid.listingOwnerName || 'Listing Owner'}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#6b7280' }}>
                          <Clock style={{ width: '12px', height: '12px' }} />
                          <span>{formatTimeAgo(bid.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <Badge className={getStatusBadge(bid.status)} style={{ padding: '4px 10px', fontSize: '11px', textTransform: 'uppercase' }}>
                      {bid.status || 'pending'}
                    </Badge>
                  </div>

                  {/* Route */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 12px',
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    marginBottom: '12px',
                    fontSize: '13px',
                  }}>
                    <MapPin style={{ width: '14px', height: '14px', color: '#22c55e', flexShrink: 0 }} />
                    <span style={{ color: '#374151' }}>{bid.origin || '---'}</span>
                    <span style={{ color: '#9ca3af' }}>→</span>
                    <MapPin style={{ width: '14px', height: '14px', color: '#ef4444', flexShrink: 0 }} />
                    <span style={{ color: '#374151' }}>{bid.destination || '---'}</span>
                  </div>

                  {/* Bid Amount */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <DollarSign style={{ width: '16px', height: '16px', color: '#10b981' }} />
                      <span style={{ fontSize: '13px', color: '#6b7280' }}>Your bid:</span>
                    </div>
                    <span style={{
                      fontWeight: '700',
                      fontSize: '18px',
                      color: '#10b981',
                    }}>
                      {formatPrice(bid.price)}
                    </span>
                  </div>

                  {/* Your Message */}
                  {bid.message && (
                    <div style={{
                      padding: '10px 12px',
                      backgroundColor: '#ecfdf5',
                      border: '1px solid #a7f3d0',
                      borderRadius: '8px',
                      marginBottom: '12px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <MessageSquare style={{ width: '14px', height: '14px', color: '#10b981', marginTop: '2px', flexShrink: 0 }} />
                        <p style={{ fontSize: '13px', color: '#065f46', fontStyle: 'italic' }}>
                          "{sanitizeMessage(bid.message)}"
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Chat Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    style={{ width: '100%', gap: '8px' }}
                    onClick={() => {
                      // Create a listing-like object for the chat modal
                      const listingData = {
                        id: bid.cargoListingId || bid.truckListingId,
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
                    <MessageSquare style={{ width: '16px', height: '16px' }} />
                    View Chat
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default MyBidsModal;
