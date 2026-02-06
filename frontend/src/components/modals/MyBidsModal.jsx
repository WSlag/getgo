import React from 'react';
import { MapPin, Package, Truck, MessageSquare, Clock, Loader2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PesoIcon } from '@/components/ui/PesoIcon';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto backdrop-blur-sm">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn(
              "size-12 rounded-xl flex items-center justify-center shadow-lg",
              isTrucker
                ? "bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/30"
                : "bg-gradient-to-br from-violet-400 to-violet-600 shadow-violet-500/30"
            )}>
              <FileText className="size-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl">{title}</DialogTitle>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {description}
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Bids List */}
        <div className="max-h-[calc(90vh-180px)] overflow-y-auto pr-2">
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
            <div className="space-y-3">
              {bids.map((bid) => (
                <div
                  key={bid.id}
                  className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700"
                >
                  {/* Header - Listing Info */}
                  <div className="flex items-start justify-between mb-3">
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
                    <Badge className={cn("uppercase text-[11px] px-2.5 py-1", getStatusBadge(bid.status))}>
                      {bid.status || 'pending'}
                    </Badge>
                  </div>

                  {/* Route */}
                  <div className="flex items-center gap-2 p-3 bg-white dark:bg-gray-800 rounded-lg mb-3 text-sm">
                    <MapPin className="size-3.5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300">{bid.origin || '---'}</span>
                    <span className="text-gray-400">→</span>
                    <MapPin className="size-3.5 text-red-500 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300">{bid.destination || '---'}</span>
                  </div>

                  {/* Bid Amount */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      <PesoIcon className="size-4 text-emerald-500" />
                      <span className="text-sm text-gray-500 dark:text-gray-400">Your bid:</span>
                    </div>
                    <span className="font-bold text-lg text-emerald-600 dark:text-emerald-400">
                      {formatPrice(bid.price)}
                    </span>
                  </div>

                  {/* Your Message */}
                  {bid.message && (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 rounded-lg mb-3">
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
        <div className="flex gap-3 pt-4">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default MyBidsModal;
