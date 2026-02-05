import React from 'react';
import { MapPin, Clock, Navigation, Package, Calendar, Weight, Truck, Edit, Star, DollarSign, X, Loader2, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RouteMap } from '@/components/maps';
import { useBidsForListing } from '@/hooks/useBids';
import { sanitizeMessage } from '@/utils/messageUtils';

export function CargoDetailsModal({
  open,
  onClose,
  cargo,
  currentRole = 'shipper',
  isOwner = false,
  onEdit,
  onBid,
  onOpenChat,
  darkMode = false,
}) {
  // Fetch bids for this cargo when owner views the modal
  const { bids: fetchedBids, loading: bidsLoading } = useBidsForListing(
    isOwner && open ? cargo?.id : null,
    'cargo'
  );

  if (!cargo) return null;

  const formatPrice = (price) => {
    if (!price) return '---';
    if (typeof price === 'string' && price.startsWith('₱')) return price;
    return `₱${Number(price).toLocaleString()}`;
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    if (typeof timestamp === 'string') return timestamp;
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days} days ago`;
    if (hours > 0) return `${hours} hours ago`;
    if (minutes > 0) return `${minutes} minutes ago`;
    return 'Just now';
  };

  // Status badge styles
  const statusStyles = {
    open: 'bg-gradient-to-br from-green-400 to-green-600 text-white shadow-lg',
    waiting: 'bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg',
    'in-progress': 'bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-lg',
    delivered: 'bg-gradient-to-br from-purple-400 to-purple-600 text-white shadow-lg',
  };

  const gradientColors = {
    open: 'bg-gradient-to-r from-orange-400 to-orange-600',
    waiting: 'bg-gradient-to-r from-yellow-400 to-orange-500',
    'in-progress': 'bg-gradient-to-r from-blue-400 to-blue-600',
    delivered: 'bg-gradient-to-r from-purple-400 to-purple-600',
  };

  const currentGradient = cargo.gradientClass || gradientColors[cargo.status] || gradientColors.open;
  const displayPrice = cargo.price || cargo.askingPrice;
  const displayImages = cargo.images?.length > 0 ? cargo.images : cargo.cargoPhotos || [];
  const displayWeight = cargo.weight ? (cargo.unit && cargo.unit !== 'kg' ? `${cargo.weight} ${cargo.unit}` : `${cargo.weight} tons`) : '';

  // Map fetched bids to display format (keep full bid data for chat)
  const bids = fetchedBids.map(bid => ({
    id: bid.id,
    bidder: bid.bidderName,
    bidderId: bid.bidderId,
    amount: bid.price,
    rating: bid.bidderRating,
    status: bid.status,
    message: bid.message,
    createdAt: bid.createdAt,
    // Keep the full bid object for opening chat
    _original: bid,
  }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto backdrop-blur-sm">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
                <Package className="size-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl">Cargo Details</DialogTitle>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Posted {formatTimeAgo(cargo.postedAt)}
                </p>
              </div>
            </div>
            {isOwner && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit?.(cargo)}
                className="gap-2"
              >
                <Edit className="size-4" />
                Edit Cargo
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Status and Price Header */}
        <div className="flex items-center justify-between py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Badge className={cn("uppercase tracking-wide", statusStyles[cargo.status])} style={{ padding: '6px 12px', fontSize: '11px' }}>
              {cargo.status}
            </Badge>
            {cargo.cargoType && (
              <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 uppercase" style={{ padding: '6px 12px', fontSize: '11px' }}>
                {cargo.cargoType}
              </Badge>
            )}
          </div>
          <div className={cn("rounded-xl shadow-lg", currentGradient)} style={{ padding: '12px 20px' }}>
            <p className="text-2xl font-bold text-white">{formatPrice(displayPrice)}</p>
          </div>
        </div>

        {/* Shipper Info */}
        <div className="py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-1">
            {cargo.company || cargo.shipper}
          </h3>
          {cargo.shipperTransactions > 0 && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {cargo.shipperTransactions} successful transactions
            </p>
          )}
        </div>

        {/* Route Section */}
        <div className="py-4 border-b border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Route</h4>
          <div className="flex items-center rounded-xl bg-gray-100 dark:bg-gray-800/60" style={{ gap: '12px', padding: '16px' }}>
            <div className="flex items-center gap-2 flex-1">
              <div className="size-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg shadow-green-500/30">
                <MapPin className="size-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-gray-500">From</p>
                <p className="font-medium text-gray-900 dark:text-white">{cargo.origin}</p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-1 px-4">
              <Navigation className="size-5 text-orange-500" />
              <div className="h-0.5 w-16 bg-gradient-to-r from-orange-400 to-orange-600 rounded-full" />
            </div>

            <div className="flex items-center gap-2 flex-1">
              <div className="size-10 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/30">
                <MapPin className="size-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-gray-500">To</p>
                <p className="font-medium text-gray-900 dark:text-white">{cargo.destination}</p>
              </div>
            </div>
          </div>

          {/* Distance & Time */}
          <div className="flex items-center gap-6 mt-3 text-sm text-gray-600 dark:text-gray-400">
            {cargo.distance && (
              <div className="flex items-center gap-1.5">
                <Navigation className="size-4 text-blue-500" />
                <span>{cargo.distance}</span>
              </div>
            )}
            {(cargo.estimatedTime || cargo.time) && (
              <div className="flex items-center gap-1.5">
                <Clock className="size-4 text-purple-500" />
                <span>{cargo.estimatedTime || cargo.time}</span>
              </div>
            )}
          </div>
        </div>

        {/* Cargo Details */}
        <div className="py-4 border-b border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Cargo Details</h4>
          <div className="grid grid-cols-2 gap-4">
            {displayWeight && (
              <div className="flex items-center gap-2">
                <Weight className="size-5 text-orange-500" />
                <div>
                  <p className="text-xs text-gray-500">Weight</p>
                  <p className="font-medium text-gray-900 dark:text-white">{displayWeight}</p>
                </div>
              </div>
            )}
            {cargo.vehicleNeeded && (
              <div className="flex items-center gap-2">
                <Truck className="size-5 text-blue-500" />
                <div>
                  <p className="text-xs text-gray-500">Vehicle Needed</p>
                  <p className="font-medium text-gray-900 dark:text-white">{cargo.vehicleNeeded}</p>
                </div>
              </div>
            )}
            {cargo.pickupDate && (
              <div className="flex items-center gap-2">
                <Calendar className="size-5 text-green-500" />
                <div>
                  <p className="text-xs text-gray-500">Pickup Date</p>
                  <p className="font-medium text-gray-900 dark:text-white">{cargo.pickupDate}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {cargo.description && (
          <div className="py-4 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Description</h4>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{cargo.description}</p>
          </div>
        )}

        {/* Photos */}
        {displayImages.length > 0 && (
          <div className="py-4 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Photos</h4>
            <div className="flex gap-3 flex-wrap">
              {displayImages.map((image, idx) => (
                <div
                  key={idx}
                  className="relative size-24 rounded-xl overflow-hidden border-2 border-gray-200 dark:border-gray-700"
                >
                  <img
                    src={image}
                    alt={`Cargo ${idx + 1}`}
                    className="size-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Map Preview */}
        {cargo.originCoords && cargo.destCoords && (
          <div className="py-4 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Route Map</h4>
            <RouteMap
              origin={cargo.origin}
              destination={cargo.destination}
              originCoords={cargo.originCoords}
              destCoords={cargo.destCoords}
              darkMode={darkMode}
              height="200px"
            />
          </div>
        )}

        {/* Bids Section - Only for owner */}
        {isOwner && (
          <div className="py-4 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Bids Received {!bidsLoading && `(${bids.length})`}
            </h4>
            {bidsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="size-6 text-orange-500 animate-spin" />
                <span className="ml-2 text-sm text-gray-500">Loading bids...</span>
              </div>
            ) : bids.length > 0 ? (
              <div className="space-y-3">
                {bids.map((bid, idx) => (
                  <div
                    key={bid.id || idx}
                    className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold">
                          {bid.bidder?.[0]?.toUpperCase() || 'T'}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{bid.bidder}</p>
                          {bid.rating && (
                            <div className="flex items-center gap-1 text-sm text-gray-500">
                              <Star className="size-3 text-yellow-500 fill-yellow-500" />
                              <span>{bid.rating}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg text-green-600 dark:text-green-400">
                          {formatPrice(bid.amount)}
                        </p>
                      </div>
                    </div>
                    {/* Bid Message - Sanitized */}
                    {bid.message && (
                      <div className="mt-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30">
                        <div className="flex items-start gap-2">
                          <MessageSquare className="size-4 text-blue-500 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                            "{sanitizeMessage(bid.message)}"
                          </p>
                        </div>
                      </div>
                    )}
                    {/* Chat Button */}
                    <div className="flex gap-2 mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-2"
                        onClick={() => onOpenChat?.(bid._original, cargo)}
                      >
                        <MessageSquare className="size-4" />
                        Chat
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                No bids received yet
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          {!isOwner && currentRole === 'trucker' && (
            <Button
              variant="gradient"
              className="flex-1"
              onClick={() => onBid?.(cargo)}
            >
              <DollarSign className="size-4 mr-2" />
              Place Bid
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={onClose}
            className={cn(!isOwner && currentRole === 'trucker' ? '' : 'flex-1')}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CargoDetailsModal;
