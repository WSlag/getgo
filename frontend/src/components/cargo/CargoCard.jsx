import React from 'react';
import { MapPin, Clock, Navigation, Gavel } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { RouteMap } from '@/components/maps';

export function CargoCard({
  id,
  shipper,
  company,
  shipperTransactions = 0,
  origin,
  destination,
  originCoords,
  destCoords,
  weight,
  unit = 'kg',
  cargoType,
  vehicleNeeded,
  askingPrice,
  price,
  description,
  pickupDate,
  status = 'open',
  postedAt,
  timeAgo,
  cargoPhotos = [],
  images = [],
  bids = [],
  bidCount = 0,
  onViewDetails,
  onContact,
  onBid,
  onViewMap,
  onRefer,
  canBid = true,
  canRefer = false,
  isOwner = false,
  darkMode = false,
  distance,
  estimatedTime,
  time,
  category = 'CARGO',
  gradientClass,
  className,
  compact = false, // New prop for condensed mobile view
}) {
  // Status badge styles - Figma gradient style with shadows
  const statusStyles = {
    open: 'bg-gradient-to-br from-green-400 to-green-600 text-white shadow-lg',
    waiting: 'bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg',
    negotiating: 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white shadow-lg',
    'in-progress': 'bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-lg',
    delivered: 'bg-gradient-to-br from-purple-400 to-purple-600 text-white shadow-lg',
  };

  // Gradient classes for price pill and buttons based on status
  const gradientColors = {
    open: 'bg-gradient-to-r from-orange-400 to-orange-600',
    waiting: 'bg-gradient-to-r from-yellow-400 to-orange-500',
    negotiating: 'bg-gradient-to-r from-yellow-400 to-yellow-600',
    'in-progress': 'bg-gradient-to-r from-blue-400 to-blue-600',
    delivered: 'bg-gradient-to-r from-purple-400 to-purple-600',
  };

  const formatPrice = (priceValue) => {
    if (!priceValue) return '---';
    if (typeof priceValue === 'string' && priceValue.startsWith('₱')) return priceValue;
    return `₱${Number(priceValue).toLocaleString()}`;
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

  // Support both naming conventions
  const displayCompany = company || shipper;
  const displayPrice = price || askingPrice;
  const displayTimeAgo = timeAgo || formatTimeAgo(postedAt);
  const displayTime = time || estimatedTime;
  const displayImages = images.length > 0 ? images : cargoPhotos;
  const displayWeight = weight ? (unit && unit !== 'kg' ? `${weight} ${unit}` : `${weight} tons`) : '';
  const currentGradient = gradientClass || gradientColors[status] || gradientColors.open;

  // Compact status badge styles for mobile
  const compactStatusStyles = {
    open: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
    waiting: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
    negotiating: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
    'in-progress': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
    delivered: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400',
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

        <div style={{ padding: '16px 20px' }}>
          {/* Row 1: Status Badge + Price */}
          <div className="flex items-center justify-between mb-2">
            <Badge
              className={cn("uppercase tracking-wide text-[10px] font-semibold px-2 py-0.5", compactStatusStyles[status] || compactStatusStyles.open)}
            >
              {status === 'negotiating' ? 'NEGOTIATING' : status.toUpperCase()}
            </Badge>
            <div className={cn("rounded-lg", currentGradient)} style={{ padding: '4px 14px' }}>
              <span className="text-sm font-bold text-white">{formatPrice(displayPrice)}</span>
            </div>
          </div>

          {/* Row 2: Company + Weight */}
          <div className="flex items-center gap-2 mb-2">
            <span className="font-semibold text-gray-900 dark:text-white text-sm truncate">{displayCompany}</span>
            {displayWeight && (
              <>
                <span className="text-gray-400">•</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">{displayWeight}</span>
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
              {displayTime && <span>• {displayTime}</span>}
              {bidCount > 0 && (
                <span className="text-orange-600 dark:text-orange-400 font-semibold">• {bidCount} {bidCount === 1 ? 'bid' : 'bids'}</span>
              )}
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
              <Badge className={cn("uppercase tracking-wide", statusStyles[status])} style={{ padding: '5px 10px', fontSize: '10px' }}>
                {status}
              </Badge>
              <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 uppercase" style={{ padding: '5px 10px', fontSize: '10px' }}>
                {category}
              </Badge>
              <span className="text-xs text-gray-500">{displayTimeAgo}</span>
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white text-base" style={{ marginBottom: '4px' }}>{displayCompany}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{displayWeight}</p>
          </div>
          <div className={cn("rounded-xl shadow-lg", currentGradient)} style={{ padding: '10px 15px' }}>
            <p className="text-2xl font-bold text-white">{formatPrice(displayPrice)}</p>
          </div>
        </div>

        {/* Bid Count Indicator - Only for owner */}
        {isOwner && bidCount > 0 && (
          <div
            className="flex items-center gap-2 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-xl cursor-pointer hover:from-green-100 hover:to-emerald-100 dark:hover:from-green-900/30 dark:hover:to-emerald-900/30 transition-all"
            style={{ padding: '12px 16px', marginBottom: '16px' }}
            onClick={onViewDetails}
          >
            <div className="size-8 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg shadow-green-500/30">
              <Gavel className="size-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-green-700 dark:text-green-400">
                {bidCount} {bidCount === 1 ? 'Bid' : 'Bids'} Received
              </p>
              <p className="text-xs text-green-600 dark:text-green-500">Click to view details</p>
            </div>
            <div className="size-6 rounded-full bg-green-500 flex items-center justify-center animate-pulse">
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
          {displayTime && (
            <div className="flex items-center gap-1.5">
              <Clock className="size-4 text-purple-500" />
              <span>{displayTime}</span>
            </div>
          )}
        </div>

        {/* Description */}
        {description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed" style={{ marginBottom: '16px' }}>{description}</p>
        )}

        {/* Images - Figma style larger with hover overlay */}
        {displayImages.length > 0 && (
          <div className="flex" style={{ gap: '8px', marginBottom: '16px' }}>
            {displayImages.slice(0, 4).map((image, idx) => (
              <div
                key={idx}
                className="relative size-16 rounded-xl overflow-hidden group/img border-2 border-gray-200 dark:border-gray-700 hover:border-orange-400 transition-all duration-300 cursor-pointer"
                onClick={() => onViewDetails?.()}
              >
                <img
                  src={image}
                  alt={`Cargo ${idx + 1}`}
                  className="size-full object-cover group-hover/img:scale-110 transition-transform duration-300"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity duration-300" />
              </div>
            ))}
            {displayImages.length > 4 && (
              <div className="size-16 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 text-xs font-medium border-2 border-gray-200 dark:border-gray-700">
                +{displayImages.length - 4}
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

        {/* Bids Info */}
        {bids.length > 0 && (
          <div className="flex items-center justify-between bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-100 dark:border-orange-800/30" style={{ marginBottom: '16px', padding: '8px 12px' }}>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {bids.length} bid{bids.length > 1 ? 's' : ''}
            </span>
            <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">
              Lowest: {formatPrice(Math.min(...bids.map(b => b.amount)))}
            </span>
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
          ) : canBid ? (
            // Trucker sees Bid button + Details
            <>
              <button
                onClick={onBid}
                className={cn(
                  "flex-1 rounded-xl text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 font-medium",
                  "bg-gradient-to-r from-green-400 to-green-600"
                )}
                style={{ padding: '14px 20px' }}
              >
                Bid Now
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
            // Shipper viewing others' cargo sees View Details
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

export default CargoCard;
