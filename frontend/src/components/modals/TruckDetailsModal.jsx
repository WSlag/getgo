import React from 'react';
import { MapPin, Clock, Navigation, Truck, Calendar, Star, Edit, DollarSign, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RouteMap } from '@/components/maps';

export function TruckDetailsModal({
  open,
  onClose,
  truck,
  currentRole = 'shipper',
  isOwner = false,
  onEdit,
  onBook,
  darkMode = false,
}) {
  const isMobile = !useMediaQuery('(min-width: 640px)');

  if (!truck) return null;

  const formatPrice = (price) => {
    if (!price) return '---';
    return `₱${Number(price).toLocaleString()}`;
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '';
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
    available: 'bg-gradient-to-br from-green-400 to-green-600 text-white shadow-lg',
    'in-transit': 'bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg',
    booked: 'bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-lg',
    offline: 'bg-gradient-to-br from-gray-400 to-gray-600 text-white shadow-lg',
  };

  const statusLabels = {
    available: 'AVAILABLE',
    'in-transit': 'IN TRANSIT',
    booked: 'BOOKED',
    offline: 'OFFLINE',
  };

  const gradientColors = {
    available: 'bg-gradient-to-r from-purple-400 to-purple-600',
    'in-transit': 'bg-gradient-to-r from-orange-400 to-orange-600',
    booked: 'bg-gradient-to-r from-blue-400 to-blue-600',
    offline: 'bg-gradient-to-r from-gray-400 to-gray-600',
  };

  const currentGradient = gradientColors[truck.status] || gradientColors.available;
  const truckPhotos = truck.truckPhotos || [];
  const bookings = truck.bookings || [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto backdrop-blur-sm">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                <Truck className="size-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl">Truck Details</DialogTitle>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Posted {formatTimeAgo(truck.postedAt)}
                </p>
              </div>
            </div>
            {isOwner && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit?.(truck)}
                className="gap-2"
              >
                <Edit className="size-4" />
                Edit Truck
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Status and Price Header */}
        <div className="flex items-center justify-between py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Badge className={cn("uppercase tracking-wide", statusStyles[truck.status] || statusStyles.available)} style={{ padding: '6px 12px', fontSize: '11px' }}>
              {statusLabels[truck.status] || 'AVAILABLE'}
            </Badge>
            {truck.vehicleType && (
              <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 uppercase" style={{ padding: '6px 12px', fontSize: '11px' }}>
                {truck.vehicleType}
              </Badge>
            )}
          </div>
          <div className={cn("rounded-xl shadow-lg", currentGradient)} style={{ padding: '12px 20px' }}>
            <p className="text-2xl font-bold text-white">{formatPrice(truck.askingRate)}</p>
          </div>
        </div>

        {/* Trucker Info */}
        <div className="py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="size-14 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xl font-bold shadow-lg">
              {truck.trucker?.[0]?.toUpperCase() || 'T'}
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                {truck.trucker}
              </h3>
              <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                {truck.truckerRating > 0 && (
                  <div className="flex items-center gap-1">
                    <Star className="size-4 text-yellow-500 fill-yellow-500" />
                    <span>{truck.truckerRating.toFixed(1)}</span>
                  </div>
                )}
                {truck.truckerTransactions > 0 && (
                  <>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <span>{truck.truckerTransactions} trips</span>
                  </>
                )}
              </div>
            </div>
          </div>
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
                <p className="font-medium text-gray-900 dark:text-white">{truck.origin}</p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-1 px-4">
              <Navigation className="size-5 text-purple-500" />
              <div className="h-0.5 w-16 bg-gradient-to-r from-purple-400 to-purple-600 rounded-full" />
            </div>

            <div className="flex items-center gap-2 flex-1">
              <div className="size-10 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/30">
                <MapPin className="size-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-gray-500">To</p>
                <p className="font-medium text-gray-900 dark:text-white">{truck.destination}</p>
              </div>
            </div>
          </div>

          {/* Distance & Time */}
          <div className="flex items-center gap-6 mt-3 text-sm text-gray-600 dark:text-gray-400">
            {truck.distance && (
              <div className="flex items-center gap-1.5">
                <Navigation className="size-4 text-blue-500" />
                <span>{truck.distance}</span>
              </div>
            )}
            {truck.estimatedTime && (
              <div className="flex items-center gap-1.5">
                <Clock className="size-4 text-purple-500" />
                <span>{truck.estimatedTime}</span>
              </div>
            )}
          </div>
        </div>

        {/* Truck Details */}
        <div className="py-4 border-b border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Truck Details</h4>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
            {truck.vehicleType && (
              <div className="flex items-center gap-2">
                <Truck className="size-5 text-purple-500" />
                <div>
                  <p className="text-xs text-gray-500">Vehicle Type</p>
                  <p className="font-medium text-gray-900 dark:text-white">{truck.vehicleType}</p>
                </div>
              </div>
            )}
            {truck.capacity && (
              <div className="flex items-center gap-2">
                <Truck className="size-5 text-blue-500" />
                <div>
                  <p className="text-xs text-gray-500">Capacity</p>
                  <p className="font-medium text-gray-900 dark:text-white">{truck.capacity}</p>
                </div>
              </div>
            )}
            {truck.plateNumber && (
              <div className="flex items-center gap-2">
                <div className="size-5 flex items-center justify-center text-green-500 font-bold text-xs">
                  #
                </div>
                <div>
                  <p className="text-xs text-gray-500">Plate Number</p>
                  <p className="font-medium font-mono text-gray-900 dark:text-white">{truck.plateNumber}</p>
                </div>
              </div>
            )}
            {truck.availableDate && (
              <div className="flex items-center gap-2">
                <Calendar className="size-5 text-green-500" />
                <div>
                  <p className="text-xs text-gray-500">Available Date</p>
                  <p className="font-medium text-gray-900 dark:text-white">{truck.availableDate}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {truck.description && (
          <div className="py-4 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Description</h4>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{truck.description}</p>
          </div>
        )}

        {/* Photos */}
        {truckPhotos.length > 0 && (
          <div className="py-4 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Photos</h4>
            <div className="flex gap-3 flex-wrap">
              {truckPhotos.map((photo, idx) => (
                <div
                  key={idx}
                  className="relative size-24 rounded-xl overflow-hidden border-2 border-gray-200 dark:border-gray-700"
                >
                  <img
                    src={photo}
                    alt={`Truck ${idx + 1}`}
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
        {truck.originCoords && truck.destCoords && (
          <div className="py-4 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Route Map</h4>
            <RouteMap
              origin={truck.origin}
              destination={truck.destination}
              originCoords={truck.originCoords}
              destCoords={truck.destCoords}
              darkMode={darkMode}
              height="200px"
            />
          </div>
        )}

        {/* Bookings Section - Only for owner */}
        {isOwner && bookings.length > 0 && (
          <div className="py-4 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Booking Requests ({bookings.length})
            </h4>
            <div className="space-y-2">
              {bookings.map((booking, idx) => (
                <div
                  key={booking.id || idx}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold">
                      {booking.shipper?.[0]?.toUpperCase() || 'S'}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{booking.shipper}</p>
                      {booking.cargoType && (
                        <p className="text-sm text-gray-500">{booking.cargoType}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg text-green-600 dark:text-green-400">
                      {formatPrice(booking.amount)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          {!isOwner && currentRole === 'shipper' && (
            <Button
              variant="gradient"
              className="flex-1"
              onClick={() => onBook?.(truck)}
            >
              Book Now
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={onClose}
            className={cn(!isOwner && currentRole === 'shipper' ? '' : 'flex-1')}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TruckDetailsModal;
