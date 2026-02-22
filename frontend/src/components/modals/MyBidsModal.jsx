import React from 'react';
import { MapPin, Package, Truck, MessageSquare, Clock, Loader2, FileText, CalendarDays, Tag, Car } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PesoIcon } from '@/components/ui/PesoIcon';
import {
  Dialog,
  DialogBottomSheet,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useMyBids } from '@/hooks/useBids';
import { sanitizeMessage } from '@/utils/messageUtils';
import { useMediaQuery } from '@/hooks/useMediaQuery';

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
    return `PHP ${Number(price).toLocaleString()}`;
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
  const isMobile = useMediaQuery('(max-width: 1023px)');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogBottomSheet className="max-w-2xl backdrop-blur-sm">
        <div style={{ padding: isMobile ? '16px' : '24px' }}>
        <DialogHeader>
          <div className="flex items-center" style={{ gap: isMobile ? '8px' : '12px' }}>
            <div style={{
              width: isMobile ? '40px' : '48px',
              height: isMobile ? '40px' : '48px',
              borderRadius: '12px',
              background: isTrucker
                ? 'linear-gradient(to bottom right, #34d399, #10b981)'
                : 'linear-gradient(to bottom right, #a78bfa, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isTrucker
                ? '0 10px 15px -3px rgba(16, 185, 129, 0.3)'
                : '0 10px 15px -3px rgba(139, 92, 246, 0.3)'
            }}>
              <FileText style={{ width: isMobile ? '20px' : '24px', height: isMobile ? '20px' : '24px', color: '#fff' }} />
            </div>
            <div>
              <DialogTitle style={{ fontSize: isMobile ? '16px' : '20px' }}>{title}</DialogTitle>
              <p style={{ fontSize: isMobile ? '12px' : '14px', color: '#6b7280' }}>
                {description}
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Bids List */}
        <div className="max-h-[calc(90vh-180px)] overflow-y-auto pr-2" style={{ marginTop: isMobile ? '16px' : '20px' }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className={cn(
                "size-8 animate-spin",
                isTrucker ? "text-emerald-500" : "text-violet-500"
              )} />
            </div>
          ) : bids.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="size-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                <FileText className="size-8 text-gray-400" />
              </div>
              <p className="text-gray-600 dark:text-gray-300 font-medium mb-1">
                No {isTrucker ? 'bids' : 'bookings'} yet
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isTrucker
                  ? 'Start bidding on cargo listings to see them here'
                  : 'Book trucks to see your bookings here'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '12px' : '16px' }}>
              {bids.map((bid) => (
                <div
                  key={bid.id}
                  className="rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700"
                  style={{ padding: isMobile ? '14px' : '16px' }}
                >
                  {/* Header - Listing Info */}
                  <div className="flex items-start justify-between" style={{ marginBottom: isMobile ? '10px' : '12px' }}>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "size-10 rounded-xl flex items-center justify-center",
                        bid.cargoListingId
                          ? "bg-gradient-to-br from-orange-400 to-orange-600"
                          : "bg-gradient-to-br from-violet-400 to-violet-600"
                      )}>
                        {bid.cargoListingId ? (
                          <Package className="size-5 text-white" />
                        ) : (
                          <Truck className="size-5 text-white" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white text-sm">
                          {bid.listingOwnerName || 'Listing Owner'}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                          <Clock className="size-3" />
                          <span>{formatTimeAgo(bid.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge className={cn("uppercase text-[11px] px-2.5 py-1", getStatusBadge(bid.status))}>
                        {bid.status || 'pending'}
                      </Badge>
                      {bid.listingStatus && (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 capitalize">
                          Listing: {bid.listingStatus}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Route */}
                  <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg text-sm" style={{ padding: isMobile ? '10px' : '12px', marginBottom: isMobile ? '10px' : '12px' }}>
                    <MapPin className="size-3.5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300">{bid.origin || '---'}</span>
                    <span className="text-gray-400">{'->'}</span>
                    <MapPin className="size-3.5 text-red-500 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300">{bid.destination || '---'}</span>
                  </div>

                  {/* Listing Details */}
                  <div className="grid grid-cols-2 gap-2 text-xs" style={{ marginBottom: isMobile ? '10px' : '12px' }}>
                    {/* Cargo details */}
                    {bid.cargoListingId && (
                      <>
                        {(bid.weight || bid.unit) && (
                          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                            <Package className="size-3 flex-shrink-0 text-orange-400" />
                            <span>{bid.weight ? `${Number(bid.weight).toLocaleString()} ${bid.unit || 'kg'}` : '---'}</span>
                          </div>
                        )}
                        {bid.cargoType && (
                          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                            <Tag className="size-3 flex-shrink-0 text-orange-400" />
                            <span className="truncate">{bid.cargoType}</span>
                          </div>
                        )}
                        {bid.vehicleNeeded && (
                          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                            <Truck className="size-3 flex-shrink-0 text-orange-400" />
                            <span className="truncate">{bid.vehicleNeeded}</span>
                          </div>
                        )}
                        {bid.pickupDate && (
                          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                            <CalendarDays className="size-3 flex-shrink-0 text-orange-400" />
                            <span>{bid.pickupDate}</span>
                          </div>
                        )}
                      </>
                    )}
                    {/* Truck details */}
                    {bid.truckListingId && (
                      <>
                        {bid.vehicleType && (
                          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                            <Car className="size-3 flex-shrink-0 text-violet-400" />
                            <span className="truncate">{bid.vehicleType}</span>
                          </div>
                        )}
                        {bid.plateNumber && (
                          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                            <Tag className="size-3 flex-shrink-0 text-violet-400" />
                            <span>{bid.plateNumber}</span>
                          </div>
                        )}
                        {bid.capacity && (
                          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                            <Package className="size-3 flex-shrink-0 text-violet-400" />
                            <span>{Number(bid.capacity).toLocaleString()} kg cap.</span>
                          </div>
                        )}
                        {bid.availableDate && (
                          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                            <CalendarDays className="size-3 flex-shrink-0 text-violet-400" />
                            <span>{bid.availableDate}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Bid Amount */}
                  <div className="flex items-center justify-between" style={{ marginBottom: isMobile ? '10px' : '12px' }}>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <PesoIcon className="size-4 text-emerald-500" />
                        <span className="text-sm text-gray-500 dark:text-gray-400">Your bid:</span>
                      </div>
                      {(bid.askingPrice || bid.askingRate) && (
                        <span className="text-xs text-gray-400 dark:text-gray-500 pl-5">
                          Asking: {formatPrice(bid.askingPrice || bid.askingRate)}
                        </span>
                      )}
                    </div>
                    <span className="font-bold text-lg text-emerald-600 dark:text-emerald-400">
                      {formatPrice(bid.price)}
                    </span>
                  </div>

                  {/* Your Message */}
                  {bid.message && (
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 rounded-lg" style={{ padding: isMobile ? '10px' : '12px', marginBottom: isMobile ? '10px' : '12px' }}>
                      <div className="flex items-start gap-2">
                        <MessageSquare className="size-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-emerald-700 dark:text-emerald-300 italic">
                          "{sanitizeMessage(bid.message)}"
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Chat Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => {
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
                    <MessageSquare className="size-4" />
                    View Chat
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ paddingTop: isMobile ? '16px' : '20px' }}>
          <Button variant="ghost" onClick={onClose} className="w-full">
            Close
          </Button>
        </div>
        </div>
      </DialogBottomSheet>
    </Dialog>
  );
}

export default MyBidsModal;
