import React from 'react';
import { MapPin, Clock, Navigation, Star, Calendar, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { RouteMap } from '@/components/maps';

export function TruckCard({
  id,
  trucker,
  truckerRating = 0,
  truckerTransactions = 0,
  origin,
  destination,
  originCoords,
  destCoords,
  vehicleType,
  plateNumber,
  capacity,
  askingRate,
  availableDate,
  description,
  status = 'available',
  uiStatus,
  postedAt,
  truckPhotos = [],
  bidCount = 0,
  onViewDetails,
  onContact,
  onBook,
  onViewMap,
  onRefer,
  canBook = true,
  canRefer = false,
  isOwner = false,
  darkMode = false,
  distance,
  estimatedTime,
  className,
  compact = false, // New prop for condensed mobile view
}) {
  const displayStatus = uiStatus || status;

  // Status badge styles - Figma gradient style with shadows (matching CargoCard)
  const statusStyles = {
    available: 'bg-gradient-to-br from-green-400 to-green-600 text-white shadow-lg',
    'in-transit': 'bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg',
    booked: 'bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-lg',
    offline: 'bg-gradient-to-br from-gray-400 to-gray-600 text-white shadow-lg',
  };

  // Status labels
  const statusLabels = {
    available: 'AVAILABLE',
    'in-transit': 'IN TRANSIT',
    booked: 'BOOKED',
    offline: 'OFFLINE',
  };

  // Gradient colors for price pill and buttons based on status (matching CargoCard pattern)
  const gradientColors = {
    available: 'bg-gradient-to-r from-purple-400 to-purple-600',
    'in-transit': 'bg-gradient-to-r from-orange-400 to-orange-600',
    booked: 'bg-gradient-to-r from-blue-400 to-blue-600',
    offline: 'bg-gradient-to-r from-gray-400 to-gray-600',
  };

  const currentGradient = gradientColors[displayStatus] || gradientColors.available;

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

  // Format capacity display
  const displayCapacity = capacity ? `${capacity}` : '';

  // Compact status badge styles for mobile
  const compactStatusStyles = {
    available: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
    open: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
    'in-transit': 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
    booked: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
    offline: 'bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-400',
  };

  // Compact card variant for mobile - ~100px height
  if (compact) {
    return (
      <div
        className={cn(
          "group relative bg-white dark:bg-gray-900 rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 active:scale-[0.98] border border-gray-200/50 dark:border-gray-800/50 cursor-pointer",
          className
        )}
        onClick={onViewDetails}
      >
        {/* Gradient Accent Bar */}
        <div className={cn("h-1", currentGradient)} />

        <div style={{ padding: '16px' }}>
          {/* Row 1: Status Badge + Vehicle Type + Rate */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
                  <Badge
                    className={cn("uppercase tracking-wide text-[10px] font-semibold px-2 py-0.5", compactStatusStyles[displayStatus] || compactStatusStyles.available)}
                  >
                    {statusLabels[displayStatus] || 'AVAILABLE'}
                  </Badge>
              {vehicleType && (
                <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 uppercase text-[10px] px-2 py-0.5">
                  {vehicleType}
                </Badge>
              )}
            </div>
            <div className={cn("rounded-lg px-3 py-1", currentGradient)}>
              <span className="text-sm font-bold text-white">{formatPrice(askingRate)}</span>
            </div>
          </div>

          {/* Row 2: Trucker + Capacity + Rating */}
          <div className="flex items-center gap-2 mb-2">
            <span className="font-semibold text-gray-900 dark:text-white text-sm truncate">{trucker}</span>
            {displayCapacity && (
              <>
                <span className="text-gray-400">•</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">{displayCapacity}</span>
              </>
            )}
            {truckerRating > 0 && (
              <>
                <span className="text-gray-400">•</span>
                <span className="text-sm text-yellow-600 dark:text-yellow-400 flex items-center gap-0.5">
                  <Star className="size-3 fill-yellow-500 text-yellow-500" />
                  {truckerRating.toFixed(1)}
                </span>
              </>
            )}
          </div>

          {/* Row 3: Route + Metrics */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <div className="size-2 rounded-full bg-green-500 flex-shrink-0" />
              <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{origin}</span>
              <span className="text-orange-500 flex-shrink-0">→</span>
              <div className="size-2 rounded-full bg-red-500 flex-shrink-0" />
              <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{destination}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">
              {distance && <span>{distance}</span>}
              {estimatedTime && <span>• {estimatedTime}</span>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Full card view (original)
  return (
    <div
      className={cn(
        "group relative bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 hover:scale-[1.02] hover:-translate-y-1 border border-gray-200/50 dark:border-gray-800/50",
        className
      )}
    >
      {/* Gradient Accent Bar - Figma style solid gradient */}
      <div className={cn("h-1.5", currentGradient)} />

      <div style={{ padding: '24px' }}>
        {/* Header Row - Status badges and Price */}
        <div className="flex items-start justify-between" style={{ marginBottom: '16px' }}>
          <div className="flex-1">
            <div className="flex items-center" style={{ gap: '8px', marginBottom: '8px' }}>
              <Badge className={cn("uppercase tracking-wide", statusStyles[displayStatus] || statusStyles.available)} style={{ padding: '5px 10px', fontSize: '10px' }}>
                {statusLabels[displayStatus] || 'AVAILABLE'}
              </Badge>
              <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 uppercase" style={{ padding: '5px 10px', fontSize: '10px' }}>
                {vehicleType || 'TRUCK'}
              </Badge>
              <span className="text-xs text-gray-500">{formatTimeAgo(postedAt)}</span>
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white text-base" style={{ marginBottom: '4px' }}>{trucker}</h3>
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400" style={{ gap: '8px' }}>
              {truckerRating > 0 && (
                <div className="flex items-center gap-1">
                  <Star className="size-4 text-yellow-500 fill-yellow-500" />
                  <span>{truckerRating.toFixed(1)}</span>
                </div>
              )}
              {displayCapacity && (
                <>
                  {truckerRating > 0 && <span className="text-gray-300 dark:text-gray-600">|</span>}
                  <span>{displayCapacity}</span>
                </>
              )}
              {plateNumber && (
                <>
                  <span className="text-gray-300 dark:text-gray-600">|</span>
                  <span className="font-mono text-xs">{plateNumber}</span>
                </>
              )}
            </div>
          </div>
          <div className={cn("rounded-xl shadow-lg", currentGradient)} style={{ padding: '10px 15px' }}>
            <p className="text-2xl font-bold text-white">{formatPrice(askingRate)}</p>
          </div>
        </div>

        {/* Booking Request Count Indicator - Only for owner */}
        {isOwner && bidCount > 0 && (
          <div
            className="flex items-center gap-2 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800 rounded-xl cursor-pointer hover:from-purple-100 hover:to-indigo-100 dark:hover:from-purple-900/30 dark:hover:to-indigo-900/30 transition-all"
            style={{ padding: '12px 16px', marginBottom: '16px' }}
            onClick={onViewDetails}
          >
            <div className="size-8 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
              <Users className="size-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-purple-700 dark:text-purple-400">
                {bidCount} Booking {bidCount === 1 ? 'Request' : 'Requests'}
              </p>
              <p className="text-xs text-purple-600 dark:text-purple-500">Click to view details</p>
            </div>
            <div className="size-6 rounded-full bg-purple-500 flex items-center justify-center animate-pulse">
              <span className="text-white text-xs font-bold">{bidCount}</span>
            </div>
          </div>
        )}

        {/* Route Section - Figma style with visible gray background */}
        <div className="flex items-center rounded-xl bg-gray-100 dark:bg-gray-800/60" style={{ gap: '12px', marginBottom: '16px', padding: '16px' }}>
          <div className="flex items-center gap-2 flex-1">
            <div className="size-8 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg shadow-green-500/30">
              <MapPin className="size-4 text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-500">From</p>
              <p className="font-medium text-sm text-gray-900 dark:text-white">{origin}</p>
            </div>
          </div>

          <div className="flex flex-col items-center gap-1 px-3">
            <Navigation className="size-4 text-orange-500 animate-pulse" />
            <div className="h-0.5 w-12 bg-gradient-to-r from-orange-400 to-orange-600 rounded-full" />
          </div>

          <div className="flex items-center gap-2 flex-1">
            <div className="size-8 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/30">
              <MapPin className="size-4 text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-500">To</p>
              <p className="font-medium text-sm text-gray-900 dark:text-white">{destination}</p>
            </div>
          </div>
        </div>

        {/* Distance & Time Details - Figma colored icons */}
        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400" style={{ gap: '16px', marginBottom: '16px' }}>
          {distance && (
            <div className="flex items-center gap-1.5">
              <Navigation className="size-4 text-blue-500" />
              <span>{distance}</span>
            </div>
          )}
          {estimatedTime && (
            <div className="flex items-center gap-1.5">
              <Clock className="size-4 text-purple-500" />
              <span>{estimatedTime}</span>
            </div>
          )}
          {availableDate && (
            <div className="flex items-center gap-1.5">
              <Calendar className="size-4 text-green-500" />
              <span>Available: {availableDate}</span>
            </div>
          )}
        </div>

        {/* Description */}
        {description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed" style={{ marginBottom: '16px' }}>{description}</p>
        )}

        {/* Images - Figma style larger with hover overlay */}
        {truckPhotos.length > 0 && (
          <div className="flex" style={{ gap: '8px', marginBottom: '16px' }}>
            {truckPhotos.slice(0, 4).map((photo, idx) => (
              <div
                key={idx}
                className="relative size-16 rounded-xl overflow-hidden group/img border-2 border-gray-200 dark:border-gray-700 hover:border-purple-400 transition-all duration-300 cursor-pointer"
                onClick={() => onViewDetails?.()}
              >
                <img
                  src={photo}
                  alt={`Truck ${idx + 1}`}
                  className="size-full object-cover group-hover/img:scale-110 transition-transform duration-300"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity duration-300" />
              </div>
            ))}
            {truckPhotos.length > 4 && (
              <div className="size-16 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 text-xs font-medium border-2 border-gray-200 dark:border-gray-700">
                +{truckPhotos.length - 4}
              </div>
            )}
          </div>
        )}

        {/* Map Preview - Interactive RouteMap */}
        {originCoords && destCoords ? (
          <div style={{ marginBottom: '16px' }}>
            <RouteMap
              origin={origin}
              destination={destination}
              originCoords={originCoords}
              destCoords={destCoords}
              darkMode={darkMode}
              onClick={onViewMap}
              height="140px"
            />
          </div>
        ) : (
          <div
            className="relative rounded-xl overflow-hidden bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 cursor-pointer"
            style={{ height: '140px', marginBottom: '16px' }}
            onClick={onViewMap}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <MapPin className="size-12 text-blue-400 mx-auto mb-2 animate-bounce" />
                <p className="text-sm text-gray-600 dark:text-gray-400">Interactive Map</p>
              </div>
            </div>
            <div className="absolute bottom-4 right-4">
              <button className="px-4 py-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-white dark:hover:bg-gray-800 transition-all duration-300 hover:scale-105">
                View Map
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons - Role-based rendering */}
        <div className="flex" style={{ gap: '12px' }}>
          {isOwner ? (
            // Owner sees View Details button
            <button
              onClick={onViewDetails}
              className={cn(
                "flex-1 rounded-xl text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 font-medium",
                currentGradient
              )}
              style={{ padding: '14px 20px' }}
            >
              View Details
            </button>
          ) : canBook ? (
            // Shipper sees Book button + Details
            <>
              <button
                onClick={onBook}
                className={cn(
                  "flex-1 rounded-xl text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 font-medium",
                  "bg-gradient-to-r from-blue-400 to-blue-600"
                )}
                style={{ padding: '14px 20px' }}
              >
                Book Now
              </button>
              <button
                onClick={onViewDetails}
                className="rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 text-gray-700 dark:text-gray-200 hover:from-gray-200 hover:to-gray-300 dark:hover:from-gray-600 dark:hover:to-gray-700 transition-all duration-300 hover:scale-105 active:scale-95 font-medium"
                style={{ padding: '14px 20px' }}
              >
                Details
              </button>
              {canRefer && onRefer && (
                <button
                  onClick={onRefer}
                  className="rounded-xl bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900/40 dark:to-orange-800/40 text-orange-700 dark:text-orange-200 hover:from-orange-200 hover:to-orange-300 dark:hover:from-orange-800/60 dark:hover:to-orange-700/60 transition-all duration-300 hover:scale-105 active:scale-95 font-medium"
                  style={{ padding: '14px 20px' }}
                >
                  Refer
                </button>
              )}
            </>
          ) : (
            // Trucker viewing others' trucks sees View Details
            <>
              <button
                onClick={onViewDetails}
                className={cn(
                  "flex-1 rounded-xl text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 font-medium",
                  currentGradient
                )}
                style={{ padding: '14px 20px' }}
              >
                View Details
              </button>
              {onContact && (
                <button
                  onClick={onContact}
                  className="rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 text-gray-700 dark:text-gray-200 hover:from-gray-200 hover:to-gray-300 dark:hover:from-gray-600 dark:hover:to-gray-700 transition-all duration-300 hover:scale-105 active:scale-95 font-medium"
                  style={{ padding: '14px 20px' }}
                >
                  Request Chat
                </button>
              )}
              {canRefer && onRefer && (
                <button
                  onClick={onRefer}
                  className="rounded-xl bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900/40 dark:to-orange-800/40 text-orange-700 dark:text-orange-200 hover:from-orange-200 hover:to-orange-300 dark:hover:from-orange-800/60 dark:hover:to-orange-700/60 transition-all duration-300 hover:scale-105 active:scale-95 font-medium"
                  style={{ padding: '14px 20px' }}
                >
                  Refer
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default TruckCard;
