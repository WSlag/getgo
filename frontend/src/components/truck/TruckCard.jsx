import React, { useState } from 'react';
import { MapPin, Clock, Navigation, ChevronDown, ChevronUp, Truck, Star, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

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
  postedAt,
  truckPhotos = [],
  onViewDetails,
  onContact,
  onBook,
  onViewMap,
  canBook = true,
  darkMode = false,
  distance,
  estimatedTime,
  className,
}) {
  const [expanded, setExpanded] = useState(false);

  const statusConfig = {
    available: {
      variant: 'gradient-green',
      label: 'AVAILABLE',
    },
    'in-transit': {
      variant: 'gradient-orange',
      label: 'IN TRANSIT',
    },
    booked: {
      variant: 'gradient-blue',
      label: 'BOOKED',
    },
    offline: {
      variant: 'secondary',
      label: 'OFFLINE',
    },
  };

  const currentStatus = statusConfig[status] || statusConfig.available;

  // Blue/purple gradient for trucks
  const gradientClasses = [
    'from-blue-400 to-blue-600',
    'from-purple-400 to-purple-600',
    'from-indigo-400 to-indigo-600',
    'from-cyan-400 to-cyan-600',
    'from-teal-400 to-teal-600',
  ];
  const gradientClass = gradientClasses[id?.charCodeAt(0) % gradientClasses.length] || gradientClasses[0];

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

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  return (
    <div
      className={cn(
        "group relative bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 hover:scale-[1.02] hover:-translate-y-1 border border-gray-200/50 dark:border-gray-800/50",
        className
      )}
    >
      {/* Gradient Accent Bar */}
      <div className={cn("h-1.5 bg-gradient-to-r", gradientClass)} />

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant={currentStatus.variant} className="px-3 py-1 text-xs tracking-wide shadow-lg">
                {currentStatus.label}
              </Badge>
              <Badge variant="info" className="px-3 py-1 text-xs uppercase">
                {vehicleType || 'TRUCK'}
              </Badge>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatTimeAgo(postedAt)}
              </span>
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-1">
              {trucker}
            </h3>
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
              {truckerRating > 0 && (
                <div className="flex items-center gap-1">
                  <Star className="size-4 text-yellow-500 fill-yellow-500" />
                  <span>{truckerRating.toFixed(1)}</span>
                </div>
              )}
              {capacity && (
                <>
                  <span className="text-gray-300 dark:text-gray-600">|</span>
                  <span>{capacity}</span>
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

          {/* Rate Badge */}
          <div className={cn("px-4 py-3 rounded-xl bg-gradient-to-br shadow-lg", gradientClass)}>
            <p className="text-xl lg:text-2xl font-bold text-white">
              {formatPrice(askingRate)}
            </p>
          </div>
        </div>

        {/* Route */}
        <div className="flex items-center gap-3 mb-4 p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-850 rounded-xl">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="size-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30 flex-shrink-0">
              <MapPin className="size-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 dark:text-gray-400">From</p>
              <p className="font-medium text-gray-900 dark:text-white truncate">{origin}</p>
            </div>
          </div>

          <div className="flex flex-col items-center gap-1 px-3 flex-shrink-0">
            <Truck className="size-4 text-blue-500 animate-pulse" />
            <div className="h-0.5 w-12 bg-gradient-to-r from-blue-400 to-blue-600 rounded-full" />
          </div>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="size-8 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30 flex-shrink-0">
              <MapPin className="size-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 dark:text-gray-400">To</p>
              <p className="font-medium text-gray-900 dark:text-white truncate">{destination}</p>
            </div>
          </div>
        </div>

        {/* Details Row */}
        <div className="flex items-center gap-4 mb-4 text-sm text-gray-600 dark:text-gray-400 flex-wrap">
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

        {/* Description - Expandable */}
        {description && (
          <div className="mb-4">
            <p className={cn(
              "text-sm text-gray-600 dark:text-gray-400 leading-relaxed",
              !expanded && "line-clamp-2"
            )}>
              {description}
            </p>
            {description.length > 100 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-blue-500 hover:text-blue-600 mt-1 flex items-center gap-1"
              >
                {expanded ? (
                  <>
                    Show less <ChevronUp className="size-3" />
                  </>
                ) : (
                  <>
                    Show more <ChevronDown className="size-3" />
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Photos */}
        {truckPhotos.length > 0 && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2 -mx-1 px-1">
            {truckPhotos.slice(0, 4).map((photo, idx) => (
              <div
                key={idx}
                className="relative size-16 lg:size-20 rounded-xl overflow-hidden group/img border-2 border-gray-200 dark:border-gray-700 hover:border-blue-400 transition-all duration-300 flex-shrink-0 cursor-pointer"
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
              <div className="size-16 lg:size-20 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm font-medium flex-shrink-0">
                +{truckPhotos.length - 4}
              </div>
            )}
          </div>
        )}

        {/* Map Preview */}
        {originCoords && destCoords && (
          <div
            className="relative h-32 lg:h-40 rounded-xl overflow-hidden bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 mb-4 cursor-pointer group/map"
            onClick={onViewMap}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Truck className="size-10 lg:size-12 text-blue-400 mx-auto mb-2 animate-bounce" />
                <p className="text-sm text-gray-600 dark:text-gray-400">View Route</p>
              </div>
            </div>
            <div className="absolute bottom-4 right-4">
              <button className="px-4 py-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg text-sm font-medium text-blue-600 hover:bg-white transition-all duration-300 hover:scale-105">
                View Map
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex gap-2">
          <button
            onClick={onViewDetails}
            className={cn(
              "flex-1 py-3 px-4 rounded-xl text-white shadow-lg font-medium",
              "hover:shadow-xl transition-all duration-300 hover:scale-105 active:scale-95",
              `bg-gradient-to-r ${gradientClass}`
            )}
          >
            View Details
          </button>
          {canBook && onBook && (
            <button
              onClick={onBook}
              className="py-3 px-4 rounded-xl bg-gradient-to-br from-purple-100 to-purple-200 text-purple-700 hover:from-purple-200 hover:to-purple-300 transition-all duration-300 hover:scale-105 active:scale-95 font-medium dark:from-purple-900/50 dark:to-purple-800/50 dark:text-purple-300"
            >
              Book Now
            </button>
          )}
          {onContact && (
            <button
              onClick={onContact}
              className="py-3 px-4 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 text-gray-700 hover:from-gray-200 hover:to-gray-300 transition-all duration-300 hover:scale-105 active:scale-95 font-medium dark:from-gray-700 dark:to-gray-800 dark:text-gray-200"
            >
              Contact
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default TruckCard;
