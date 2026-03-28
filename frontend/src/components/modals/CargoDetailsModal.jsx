import React from 'react';
import { MapPin, Clock, Navigation, Package, Calendar, Weight, Truck, Edit, Star, X, Loader2, MessageSquare, Check, FileText, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PesoIcon } from '@/components/ui/PesoIcon';
import {
  Dialog,
  DialogBottomSheet,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useBidsForListing } from '@/hooks/useBids';
import { sanitizeMessage } from '@/utils/messageUtils';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import api from '@/services/api';
import { canBidCargoStatus } from '@/utils/listingStatus';
import { canOpenBidChat, isActiveBidStatus, normalizeBidStatus } from '@/utils/bidStatus';
import { formatListingPostedAge, formatListingScheduleDate } from '@/utils/listingDateFormatting';

const LazyRouteMap = React.lazy(() => import('@/components/maps/RouteMap'));

export function CargoDetailsModal({
  open,
  onClose,
  cargo,
  currentRole = 'shipper',
  isOwner = false,
  onEdit,
  onBid,
  onOpenChat,
  onAcceptBid,
  onCreateContract,
  onReopenListing,
  onOpenContract,
  onRefer,
  userBidId,
  isBroker = false,
  canRefer = false,
  onViewProfile,
  darkMode = false,
}) {
  const [processingBidId, setProcessingBidId] = React.useState(null);
  const [processingAction, setProcessingAction] = React.useState(null);
  const [contractId, setContractId] = React.useState(null);
  const [contractStatus, setContractStatus] = React.useState(null);
  const [loadingContract, setLoadingContract] = React.useState(false);
  const [bidContracts, setBidContracts] = React.useState({});
  const [confirmAction, setConfirmAction] = React.useState(null); // { bid }
  const [showRouteMap, setShowRouteMap] = React.useState(false);
  const [isPhotoViewerOpen, setIsPhotoViewerOpen] = React.useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = React.useState(0);
  const isMobile = useMediaQuery('(max-width: 1023px)');

  const handleAcceptBid = async (bid) => {
    if (!onAcceptBid) return;
    setProcessingBidId(bid.id);
    setProcessingAction('accept');
    try {
      await onAcceptBid(bid, cargo, 'cargo');
    } finally {
      setProcessingBidId(null);
      setProcessingAction(null);
    }
  };

  const requestConfirmAction = (bid) => {
    setConfirmAction({ bid });
  };

  const executeConfirmedAction = async () => {
    if (!confirmAction) return;
    const { bid } = confirmAction;
    setConfirmAction(null);
    await handleAcceptBid(bid);
  };

  // Fetch contract for trucker's bid when they view the modal
  React.useEffect(() => {
    const fetchContractForBid = async () => {
      if (!open || currentRole !== 'trucker' || !userBidId) {
        setContractId(null);
        setContractStatus(null);
        return;
      }

      try {
        setLoadingContract(true);
        const response = await api.contracts.getByBid(userBidId);
        if (response.contract) {
          setContractId(response.contract.id);
          setContractStatus(normalizeBidStatus(response.contract.status));
        } else {
          setContractId(null);
          setContractStatus(null);
        }
      } catch (error) {
        // Contract doesn't exist yet - this is normal
        setContractId(null);
        setContractStatus(null);
      } finally {
        setLoadingContract(false);
      }
    };

    fetchContractForBid();
  }, [open, currentRole, userBidId]);

  // Fetch bids for this cargo when owner views the modal
  const { bids: fetchedBids, loading: bidsLoading } = useBidsForListing(
    isOwner && open ? cargo?.id : null,
    'cargo'
  );
  const activeFetchedBids = React.useMemo(
    () => fetchedBids.filter((bid) => isActiveBidStatus(bid.status)),
    [fetchedBids]
  );
  const hasAcceptedLifecycleBid = React.useMemo(
    () => fetchedBids.some((bid) => {
      const status = normalizeBidStatus(bid.status);
      return status === 'accepted' || status === 'contracted';
    }),
    [fetchedBids]
  );

  React.useEffect(() => {
    const fetchAcceptedBidContracts = async () => {
      if (!open || !isOwner || activeFetchedBids.length === 0) {
        setBidContracts({});
        return;
      }

      const acceptedBids = activeFetchedBids.filter((bid) => bid.status === 'accepted');
      if (acceptedBids.length === 0) {
        setBidContracts({});
        return;
      }

      const contractMap = {};
      await Promise.all(acceptedBids.map(async (acceptedBid) => {
        try {
          const response = await api.contracts.getByBid(acceptedBid.id);
          if (response?.contract?.id) {
            contractMap[acceptedBid.id] = response.contract.id;
          }
        } catch (error) {
          // Contract may not exist yet.
        }
      }));
      setBidContracts(contractMap);
    };

    fetchAcceptedBidContracts();
  }, [open, isOwner, activeFetchedBids]);

  React.useEffect(() => {
    if (!open) {
      setShowRouteMap(false);
      setIsPhotoViewerOpen(false);
      setSelectedPhotoIndex(0);
    }
  }, [open, cargo?.id]);

  React.useEffect(() => {
    if (!isPhotoViewerOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setIsPhotoViewerOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isPhotoViewerOpen]);

  if (!cargo) return null;

  const formatPrice = (price) => {
    if (!price) return '---';
    if (typeof price === 'string' && price.startsWith('PHP ')) return price;
    return `PHP ${Number(price).toLocaleString()}`;
  };

  // Status badge styles
  const statusStyles = {
    open: 'bg-gradient-to-br from-green-400 to-green-600 text-white shadow-lg',
    waiting: 'bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg',
    negotiating: 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white shadow-lg',
    'in-progress': 'bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-lg',
    delivered: 'bg-gradient-to-br from-purple-400 to-purple-600 text-white shadow-lg',
  };

  const gradientColors = {
    open: 'bg-gradient-to-r from-orange-400 to-orange-600',
    waiting: 'bg-gradient-to-r from-yellow-400 to-orange-500',
    negotiating: 'bg-gradient-to-r from-yellow-400 to-yellow-600',
    'in-progress': 'bg-gradient-to-r from-blue-400 to-blue-600',
    delivered: 'bg-gradient-to-r from-purple-400 to-purple-600',
  };

  const currentGradient = cargo.gradientClass || gradientColors[cargo.status] || gradientColors.open;
  const displayPrice = cargo.price || cargo.askingPrice;
  const displayImages = cargo.images?.length > 0 ? cargo.images : cargo.cargoPhotos || [];
  const selectedPhoto = displayImages[selectedPhotoIndex] || displayImages[0] || null;
  const displayWeight = cargo.weight ? (cargo.unit && cargo.unit !== 'kg' ? `${cargo.weight} ${cargo.unit}` : `${cargo.weight} tons`) : '';
  const postedAtDisplay = cargo.postedAtDisplay || formatListingPostedAge(cargo.postedAt, cargo.timeAgo);
  const pickupDateDisplay = cargo.pickupDateDisplay || formatListingScheduleDate(cargo.pickupDate);
  const canReopen = isOwner
    && cargo.status === 'negotiating'
    && !bidsLoading
    && !hasAcceptedLifecycleBid;
  const canShowContractButton = currentRole === 'trucker'
    && Boolean(contractId && onOpenContract)
    && normalizeBidStatus(contractStatus) !== 'cancelled';

  // Map fetched bids to display format (keep full bid data for chat)
  const bids = activeFetchedBids.map((bid) => ({
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
    <>
    <Dialog open={open} onOpenChange={onClose}>
      <DialogBottomSheet
        className="max-w-2xl backdrop-blur-sm"
        onEscapeKeyDown={(event) => {
          if (isPhotoViewerOpen) {
            event.preventDefault();
          }
        }}
      >
        <div style={{ padding: isMobile ? '16px' : '24px' }}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center" style={{ gap: isMobile ? '8px' : '12px' }}>
              <div style={{
                width: isMobile ? '40px' : '48px',
                height: isMobile ? '40px' : '48px',
                borderRadius: '12px',
                background: 'linear-gradient(to bottom right, #fb923c, #ea580c)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 10px 15px -3px rgba(234, 88, 12, 0.3)'
              }}>
                <Package style={{ width: isMobile ? '20px' : '24px', height: isMobile ? '20px' : '24px', color: '#fff' }} />
              </div>
              <div>
                <DialogTitle style={{ fontSize: isMobile ? '16px' : '20px' }}>Cargo Details</DialogTitle>
                <DialogDescription style={{ fontSize: isMobile ? '11px' : '14px', color: '#6b7280' }}>
                  Posted {postedAtDisplay}
                </DialogDescription>
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
        <div className="border-b border-gray-200 dark:border-gray-700" style={{ paddingTop: isMobile ? '16px' : '20px', paddingBottom: isMobile ? '16px' : '20px', marginTop: isMobile ? '12px' : '16px' }}>
          {isMobile ? (
            <>
              <div className="flex flex-wrap items-center" style={{ gap: '6px', marginBottom: '10px' }}>
                <Badge className={cn("uppercase tracking-wide", statusStyles[cargo.status])} style={{ padding: '4px 10px', fontSize: '11px' }}>
                  {cargo.status}
                </Badge>
                {cargo.cargoType && (
                  <Badge className="!whitespace-normal bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 uppercase" style={{ padding: '4px 10px', fontSize: '11px' }}>
                    {cargo.cargoType}
                  </Badge>
                )}
              </div>
              <div className="flex justify-end">
                <div className={cn("rounded-xl shadow-lg", currentGradient)} style={{ padding: '8px 16px' }}>
                  <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>{formatPrice(displayPrice)}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-start justify-between">
              <div className="flex min-w-0 flex-1 flex-wrap items-center" style={{ gap: '12px' }}>
                <Badge className={cn("shrink-0 uppercase tracking-wide", statusStyles[cargo.status])} style={{ padding: '6px 12px', fontSize: '12px' }}>
                  {cargo.status}
                </Badge>
                {cargo.cargoType && (
                  <Badge className="shrink-0 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 uppercase" style={{ padding: '6px 12px', fontSize: '12px' }}>
                    {cargo.cargoType}
                  </Badge>
                )}
              </div>
              <div className={cn("shrink-0 ml-3 rounded-xl shadow-lg", currentGradient)} style={{ padding: '12px 20px' }}>
                <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff' }}>{formatPrice(displayPrice)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Shipper Info */}
        <div
          className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700"
          style={{ paddingTop: isMobile ? '16px' : '20px', paddingBottom: isMobile ? '16px' : '20px' }}
        >
          <div>
            <h3 style={{ fontWeight: 'bold', fontSize: isMobile ? '15px' : '18px', color: darkMode ? '#fff' : '#111827', marginBottom: '4px' }}>
              {cargo.company || cargo.shipper}
            </h3>
            {cargo.shipperTransactions > 0 && (
              <p style={{ fontSize: isMobile ? '12px' : '14px', color: '#6b7280' }}>
                {cargo.shipperTransactions} successful transactions
              </p>
            )}
          </div>

          {!isOwner && (cargo.userId || cargo.shipperId) && (
            <button
              type="button"
              onClick={() => onViewProfile?.(cargo.userId || cargo.shipperId)}
              className="shrink-0 rounded-xl shadow-lg bg-gradient-to-r from-blue-400 to-blue-600 text-white font-bold"
              style={{ padding: isMobile ? '8px 16px' : '12px 20px', fontSize: isMobile ? '13px' : '14px', whiteSpace: 'nowrap' }}
            >
              View Profile
            </button>
          )}
        </div>

        {/* Route Section */}
        <div className="border-b border-gray-200 dark:border-gray-700" style={{ paddingTop: isMobile ? '16px' : '20px', paddingBottom: isMobile ? '16px' : '20px' }}>
          <h4 style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: '600', color: '#374151', marginBottom: isMobile ? '8px' : '12px' }}>Route</h4>
          <div className="flex items-center rounded-xl bg-gray-100 dark:bg-gray-800/60" style={{ gap: isMobile ? '6px' : '12px', padding: isMobile ? '10px' : '16px' }}>
            <div className="flex items-center flex-1 min-w-0" style={{ gap: isMobile ? '6px' : '8px' }}>
              <div style={{
                width: isMobile ? '32px' : '40px',
                height: isMobile ? '32px' : '40px',
                borderRadius: '50%',
                background: 'linear-gradient(to bottom right, #34d399, #10b981)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.3)',
                flexShrink: 0
              }}>
                <MapPin style={{ width: isMobile ? '16px' : '20px', height: isMobile ? '16px' : '20px', color: '#fff' }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: '11px', color: '#6b7280' }}>From</p>
                <p style={{ fontWeight: '500', fontSize: isMobile ? '13px' : '14px', color: darkMode ? '#fff' : '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cargo.origin}</p>
              </div>
            </div>

            <div className="flex flex-col items-center" style={{ gap: '4px', padding: isMobile ? '0 6px' : '0 16px', flexShrink: 0 }}>
              <Navigation style={{ width: isMobile ? '16px' : '20px', height: isMobile ? '16px' : '20px', color: '#f97316' }} />
              <div style={{ height: '2px', width: isMobile ? '40px' : '64px', background: 'linear-gradient(to right, #fb923c, #ea580c)', borderRadius: '9999px' }} />
            </div>

            <div className="flex items-center flex-1 min-w-0" style={{ gap: isMobile ? '6px' : '8px' }}>
              <div style={{
                width: isMobile ? '32px' : '40px',
                height: isMobile ? '32px' : '40px',
                borderRadius: '50%',
                background: 'linear-gradient(to bottom right, #f87171, #ef4444)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 10px 15px -3px rgba(239, 68, 68, 0.3)',
                flexShrink: 0
              }}>
                <MapPin style={{ width: isMobile ? '16px' : '20px', height: isMobile ? '16px' : '20px', color: '#fff' }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: '11px', color: '#6b7280' }}>To</p>
                <p style={{ fontWeight: '500', fontSize: isMobile ? '13px' : '14px', color: darkMode ? '#fff' : '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cargo.destination}</p>
              </div>
            </div>
          </div>

          {/* Distance & Time */}
          <div className="flex items-center" style={{ gap: isMobile ? '16px' : '24px', marginTop: isMobile ? '8px' : '12px', fontSize: isMobile ? '12px' : '14px', color: '#6b7280' }}>
            {cargo.distance && (
              <div className="flex items-center" style={{ gap: '6px' }}>
                <Navigation style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px', color: '#3b82f6' }} />
                <span>{cargo.distance}</span>
              </div>
            )}
            {(cargo.estimatedTime || cargo.time) && (
              <div className="flex items-center" style={{ gap: '6px' }}>
                <Clock style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px', color: '#a855f7' }} />
                <span>{cargo.estimatedTime || cargo.time}</span>
              </div>
            )}
          </div>
        </div>

        {/* Cargo Details */}
        <div className="border-b border-gray-200 dark:border-gray-700" style={{ paddingTop: isMobile ? '16px' : '20px', paddingBottom: isMobile ? '16px' : '20px' }}>
          <h4 style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: '600', color: '#374151', marginBottom: isMobile ? '8px' : '12px' }}>Cargo Details</h4>
          <div className="grid grid-cols-2" style={{ gap: isMobile ? '12px' : '16px' }}>
            {displayWeight && (
              <div className="flex items-center" style={{ gap: isMobile ? '6px' : '8px' }}>
                <Weight style={{ width: isMobile ? '18px' : '20px', height: isMobile ? '18px' : '20px', color: '#f97316' }} />
                <div>
                  <p style={{ fontSize: '11px', color: '#6b7280' }}>Weight</p>
                  <p style={{ fontWeight: '500', fontSize: isMobile ? '13px' : '14px', color: darkMode ? '#fff' : '#111827' }}>{displayWeight}</p>
                </div>
              </div>
            )}
            {cargo.vehicleNeeded && (
              <div className="flex items-center" style={{ gap: isMobile ? '6px' : '8px' }}>
                <Truck style={{ width: isMobile ? '18px' : '20px', height: isMobile ? '18px' : '20px', color: '#3b82f6' }} />
                <div>
                  <p style={{ fontSize: '11px', color: '#6b7280' }}>Vehicle Needed</p>
                  <p style={{ fontWeight: '500', fontSize: isMobile ? '13px' : '14px', color: darkMode ? '#fff' : '#111827' }}>{cargo.vehicleNeeded}</p>
                </div>
              </div>
            )}
            {pickupDateDisplay && (
              <div className="flex items-center" style={{ gap: isMobile ? '6px' : '8px' }}>
                <Calendar style={{ width: isMobile ? '18px' : '20px', height: isMobile ? '18px' : '20px', color: '#10b981' }} />
                <div>
                  <p style={{ fontSize: '11px', color: '#6b7280' }}>Pickup Date</p>
                  <p style={{ fontWeight: '500', fontSize: isMobile ? '13px' : '14px', color: darkMode ? '#fff' : '#111827' }}>{pickupDateDisplay}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {cargo.description && (
          <div className="border-b border-gray-200 dark:border-gray-700" style={{ paddingTop: isMobile ? '16px' : '20px', paddingBottom: isMobile ? '16px' : '20px' }}>
            <h4 style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Description</h4>
            <p style={{ fontSize: isMobile ? '13px' : '14px', color: '#6b7280', lineHeight: '1.5' }}>{cargo.description}</p>
          </div>
        )}

        {/* Photos */}
        {displayImages.length > 0 && (
          <div className="border-b border-gray-200 dark:border-gray-700" style={{ paddingTop: isMobile ? '16px' : '20px', paddingBottom: isMobile ? '16px' : '20px' }}>
            <h4 style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: '600', color: '#374151', marginBottom: isMobile ? '8px' : '12px' }}>Photos</h4>
            <div className="flex gap-3 flex-wrap">
              {displayImages.map((image, idx) => (
                <button
                  type="button"
                  key={idx}
                  data-testid="cargo-details-photo-thumb"
                  className="relative size-24 rounded-xl overflow-hidden border-2 border-gray-200 dark:border-gray-700 p-0 bg-transparent cursor-pointer"
                  onClick={() => {
                    setSelectedPhotoIndex(idx);
                    setIsPhotoViewerOpen(true);
                  }}
                  aria-label={`View cargo photo ${idx + 1}`}
                >
                  <img
                    src={image}
                    alt={`Cargo ${idx + 1}`}
                    className="size-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Map Preview */}
        {cargo.originCoords && cargo.destCoords && (
          <div className="border-b border-gray-200 dark:border-gray-700" style={{ paddingTop: isMobile ? '16px' : '20px', paddingBottom: isMobile ? '16px' : '20px' }}>
            <h4 style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: '600', color: '#374151', marginBottom: isMobile ? '8px' : '12px' }}>Route Map</h4>
            {!showRouteMap ? (
              <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40" style={{ padding: isMobile ? '12px' : '16px' }}>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Interactive map loads on demand.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setShowRouteMap(true)}
                >
                  View Route Map
                </Button>
              </div>
            ) : (
              <React.Suspense fallback={
                <div className="rounded-xl bg-gray-100 dark:bg-gray-800/60 flex items-center justify-center" style={{ height: '200px' }}>
                  <Loader2 className="size-5 animate-spin text-orange-500" />
                  <span className="ml-2 text-sm text-gray-600 dark:text-gray-300">Loading map...</span>
                </div>
              }>
                <LazyRouteMap
                  origin={cargo.origin}
                  destination={cargo.destination}
                  originCoords={cargo.originCoords}
                  destCoords={cargo.destCoords}
                  darkMode={darkMode}
                  height="200px"
                />
              </React.Suspense>
            )}
          </div>
        )}

        {/* Bids Section - Only for owner */}
        {isOwner && (
          <div className="border-b border-gray-200 dark:border-gray-700" style={{ paddingTop: isMobile ? '16px' : '20px', paddingBottom: isMobile ? '16px' : '20px' }}>
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
                      <div className="text-right flex items-center gap-2">
                        <p className="font-bold text-lg text-green-600 dark:text-green-400">
                          {formatPrice(bid.amount)}
                        </p>
                        {bid.status === 'accepted' && (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                            Accepted
                          </Badge>
                        )}
                        {bid.status === 'rejected' && (
                          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                            Rejected
                          </Badge>
                        )}
                        {bid.status === 'cancelled' && (
                          <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                            Cancelled
                          </Badge>
                        )}
                        {bid.status === 'contracted' && (
                          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            Contracted
                          </Badge>
                        )}
                        {bid.status === 'withdrawn' && (
                          <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                            Withdrawn
                          </Badge>
                        )}
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
                    {/* Action Buttons */}
                    <div className="flex gap-2 mt-3">
                      {canOpenBidChat(bid.status) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-2 border-transparent bg-gradient-to-br from-[#F8A347] to-[#F06A00] text-[#FFFFFF] hover:from-[#F9B35E] hover:to-[#E55D00] hover:text-[#FFFFFF]"
                          onClick={() => onOpenChat?.(bid._original, cargo)}
                        >
                          <MessageSquare className="size-4" />
                          Chat
                        </Button>
                      )}
                      {bid.status === 'pending' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                          onClick={() => requestConfirmAction(bid._original)}
                          disabled={processingBidId === bid.id}
                        >
                          {processingBidId === bid.id && processingAction === 'accept' ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Check className="size-4" />
                          )}
                          Accept
                        </Button>
                      )}
                      {bid.status === 'accepted' && (
                        <Button
                          variant="gradient"
                          size="sm"
                          className="flex-1 gap-2"
                          onClick={() => {
                            const existingContractId = bidContracts[bid.id];
                            if (existingContractId && onOpenContract) {
                              onClose?.();
                              onOpenContract(existingContractId);
                              return;
                            }
                            onCreateContract?.(bid._original, cargo);
                          }}
                        >
                          <FileText className="size-4" />
                          {bidContracts[bid.id] ? 'Open Contract' : 'Create Contract'}
                        </Button>
                      )}
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
        <div style={{ paddingTop: isMobile ? '16px' : '20px' }}>
          {(!isOwner && currentRole === 'trucker' && canBidCargoStatus(cargo.status)) ||
           canReopen ? (
            <div className="flex gap-3 mb-3">
              {!isOwner && currentRole === 'trucker' && canBidCargoStatus(cargo.status) && (
                <Button
                  variant="gradient"
                  className="flex-1"
                  onClick={() => onBid?.(cargo)}
                >
                  <PesoIcon className="size-4 mr-2" />
                  Place Bid
                </Button>
              )}
              {canReopen && (
                <Button
                  variant="outline"
                  className="flex-1 gap-2 border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                  onClick={() => onReopenListing?.(cargo.id, 'cargo')}
                >
                  <RotateCcw className="size-4" />
                  Reopen for Bidding
                </Button>
              )}
            </div>
          ) : null}

          {/* View Contract Button - Only for truckers with contract */}
          {canShowContractButton && (
            <Button
              variant="gradient"
              onClick={() => {
                onClose();
                onOpenContract(contractId);
              }}
              className="w-full gap-2 mb-3"
            >
              <FileText className="size-4" />
              View Contract
            </Button>
          )}

          {/* Loading state for contract check */}
          {currentRole === 'trucker' && loadingContract && !contractId && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
              <Loader2 style={{ width: '16px', height: '16px', color: '#9ca3af', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '6px' }}>Checking for contract...</span>
            </div>
          )}

          {isBroker && !isOwner && canRefer && onRefer && (
            <Button
              variant="outline"
              onClick={() => onRefer?.(cargo)}
              className="w-full gap-2 mb-3 border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20"
            >
              Refer Listing
            </Button>
          )}

          <Button
            variant="ghost"
            onClick={onClose}
            className="w-full"
          >
            Close
          </Button>
        </div>
        </div>
      </DialogBottomSheet>
    </Dialog>

    {isPhotoViewerOpen && selectedPhoto && (
      <div
        className="fixed inset-0 z-[120] bg-black/90 flex items-center justify-center p-4 pointer-events-auto"
        data-testid="cargo-details-photo-viewer"
        role="dialog"
        aria-modal="true"
        aria-label="Cargo photo viewer"
        onClick={() => setIsPhotoViewerOpen(false)}
      >
        <div className="relative flex items-center justify-center pointer-events-auto" onClick={(event) => event.stopPropagation()}>
          <img
            src={selectedPhoto}
            alt={`Cargo photo ${selectedPhotoIndex + 1}`}
            className="max-w-[96vw] max-h-[90vh] rounded-xl object-contain shadow-2xl"
          />
          <button
            type="button"
            onClick={() => setIsPhotoViewerOpen(false)}
            className="absolute top-3 right-3 size-10 rounded-full bg-black/65 hover:bg-black/80 flex items-center justify-center pointer-events-auto"
            aria-label="Close photo viewer"
          >
            <X className="size-5 text-white" />
          </button>
        </div>
      </div>
    )}

    <ConfirmDialog
      open={!!confirmAction}
      title="Accept this bid?"
      description="Accepting this bid will create a contract with this trucker. Other pending bids will remain open."
      confirmLabel="Accept Bid"
      variant="default"
      onConfirm={executeConfirmedAction}
      onCancel={() => setConfirmAction(null)}
    />
    </>
  );
}

export default CargoDetailsModal;
