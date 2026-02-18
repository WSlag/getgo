import React from 'react';
import { MapPin, Clock, Navigation, Truck, Calendar, Star, Edit, User, Loader2, MessageSquare, Check, X, FileText, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  Dialog,
  DialogBottomSheet,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RouteMap } from '@/components/maps';
import { useBidsForListing } from '@/hooks/useBids';
import { sanitizeMessage } from '@/utils/messageUtils';
import { canBookTruckStatus, toTruckUiStatus } from '@/utils/listingStatus';
import api from '@/services/api';

export function TruckDetailsModal({
  open,
  onClose,
  truck,
  currentRole = 'shipper',
  isOwner = false,
  onEdit,
  onBook,
  onOpenChat,
  onAcceptBid,
  onRejectBid,
  onCreateContract,
  onOpenContract,
  onReopenListing,
  darkMode = false,
}) {
  const isMobile = useMediaQuery('(max-width: 1023px)');
  const [processingBidId, setProcessingBidId] = React.useState(null);
  const [processingAction, setProcessingAction] = React.useState(null);
  const [bidContracts, setBidContracts] = React.useState({});

  const handleAcceptBid = async (bid) => {
    if (!onAcceptBid) return;
    setProcessingBidId(bid.id);
    setProcessingAction('accept');
    try {
      await onAcceptBid(bid, truck, 'truck');
    } finally {
      setProcessingBidId(null);
      setProcessingAction(null);
    }
  };

  const handleRejectBid = async (bid) => {
    if (!onRejectBid) return;
    setProcessingBidId(bid.id);
    setProcessingAction('reject');
    try {
      await onRejectBid(bid, truck, 'truck');
    } finally {
      setProcessingBidId(null);
      setProcessingAction(null);
    }
  };

  // Fetch booking requests (bids) for this truck when owner views the modal
  const { bids: fetchedBids, loading: bidsLoading } = useBidsForListing(
    isOwner && open ? truck?.id : null,
    'truck'
  );

  React.useEffect(() => {
    const fetchAcceptedBidContracts = async () => {
      if (!open || !isOwner || fetchedBids.length === 0) {
        setBidContracts({});
        return;
      }

      const acceptedBids = fetchedBids.filter((bid) => bid.status === 'accepted');
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
  }, [open, isOwner, fetchedBids]);

  if (!truck) return null;
  const displayStatus = truck.uiStatus || toTruckUiStatus(truck.status);

  const formatPrice = (price) => {
    if (!price) return '---';
    return `PHP ${Number(price).toLocaleString()}`;
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
    open: 'bg-gradient-to-br from-green-400 to-green-600 text-white shadow-lg',
    waiting: 'bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg',
    negotiating: 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white shadow-lg',
    'in-transit': 'bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg',
    'in-progress': 'bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-lg',
    booked: 'bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-lg',
    delivered: 'bg-gradient-to-br from-purple-400 to-purple-600 text-white shadow-lg',
    offline: 'bg-gradient-to-br from-gray-400 to-gray-600 text-white shadow-lg',
  };

  const statusLabels = {
    available: 'AVAILABLE',
    open: 'OPEN',
    waiting: 'WAITING',
    negotiating: 'NEGOTIATING',
    'in-transit': 'IN TRANSIT',
    'in-progress': 'IN PROGRESS',
    booked: 'BOOKED',
    delivered: 'DELIVERED',
    offline: 'OFFLINE',
  };

  const gradientColors = {
    available: 'bg-gradient-to-r from-purple-400 to-purple-600',
    open: 'bg-gradient-to-r from-orange-400 to-orange-600',
    waiting: 'bg-gradient-to-r from-yellow-400 to-orange-500',
    negotiating: 'bg-gradient-to-r from-yellow-400 to-yellow-600',
    'in-transit': 'bg-gradient-to-r from-orange-400 to-orange-600',
    'in-progress': 'bg-gradient-to-r from-blue-400 to-blue-600',
    booked: 'bg-gradient-to-r from-blue-400 to-blue-600',
    delivered: 'bg-gradient-to-r from-purple-400 to-purple-600',
    offline: 'bg-gradient-to-r from-gray-400 to-gray-600',
  };

  const currentGradient = gradientColors[displayStatus] || gradientColors.available;
  const truckPhotos = truck.truckPhotos || [];

  // Map fetched bids to booking display format (keep full bid data for chat)
  const bookings = fetchedBids.map(bid => ({
    id: bid.id,
    shipper: bid.bidderName,
    shipperId: bid.bidderId,
    amount: bid.price,
    cargoType: bid.cargoType,
    cargoWeight: bid.cargoWeight,
    status: bid.status,
    message: bid.message,
    createdAt: bid.createdAt,
    // Keep the full bid object for opening chat
    _original: bid,
  }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogBottomSheet className="max-w-2xl backdrop-blur-sm" hideCloseButton>
        <div style={{ padding: isMobile ? '16px' : '24px' }}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center" style={{ gap: isMobile ? '8px' : '12px' }}>
              <div style={{
                width: isMobile ? '40px' : '48px',
                height: isMobile ? '40px' : '48px',
                borderRadius: '12px',
                background: 'linear-gradient(to bottom right, #a78bfa, #8b5cf6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 10px 15px -3px rgba(139, 92, 246, 0.3)'
              }}>
                <Truck style={{ width: isMobile ? '20px' : '24px', height: isMobile ? '20px' : '24px', color: '#fff' }} />
              </div>
              <div>
                <DialogTitle style={{ fontSize: isMobile ? '16px' : '20px' }}>Truck Details</DialogTitle>
                <DialogDescription style={{ fontSize: isMobile ? '11px' : '14px', color: '#6b7280' }}>
                  Posted {formatTimeAgo(truck.postedAt)}
                </DialogDescription>
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
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700" style={{ paddingTop: isMobile ? '16px' : '20px', paddingBottom: isMobile ? '16px' : '20px' }}>
          <div className="flex items-center" style={{ gap: isMobile ? '6px' : '12px' }}>
            <Badge className={cn("uppercase tracking-wide", statusStyles[displayStatus] || statusStyles.available)} style={{ padding: isMobile ? '4px 10px' : '6px 12px', fontSize: isMobile ? '11px' : '12px' }}>
              {statusLabels[displayStatus] || 'AVAILABLE'}
            </Badge>
            {truck.vehicleType && (
              <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 uppercase" style={{ padding: isMobile ? '4px 10px' : '6px 12px', fontSize: isMobile ? '11px' : '12px' }}>
                {truck.vehicleType}
              </Badge>
            )}
          </div>
          <div className={cn("rounded-xl shadow-lg", currentGradient)} style={{ padding: isMobile ? '8px 16px' : '12px 20px' }}>
            <p style={{ fontSize: isMobile ? '18px' : '24px', fontWeight: 'bold', color: '#fff' }}>{formatPrice(truck.askingRate)}</p>
          </div>
        </div>

        {/* Trucker Info */}
        <div className="border-b border-gray-200 dark:border-gray-700" style={{ paddingTop: isMobile ? '16px' : '20px', paddingBottom: isMobile ? '16px' : '20px' }}>
          <div className="flex items-center" style={{ gap: isMobile ? '12px' : '16px' }}>
            <div style={{
              width: isMobile ? '48px' : '56px',
              height: isMobile ? '48px' : '56px',
              borderRadius: '50%',
              background: 'linear-gradient(to bottom right, #60a5fa, #2563eb)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: isMobile ? '18px' : '20px',
              fontWeight: 'bold',
              boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.3)'
            }}>
              {truck.trucker?.[0]?.toUpperCase() || 'T'}
            </div>
            <div>
              <h3 style={{ fontSize: isMobile ? '15px' : '18px', fontWeight: 'bold', color: darkMode ? '#fff' : '#111827' }}>
                {truck.trucker}
              </h3>
              <div className="flex items-center" style={{ gap: isMobile ? '8px' : '12px', fontSize: isMobile ? '12px' : '14px', color: '#6b7280' }}>
                {truck.truckerRating > 0 && (
                  <div className="flex items-center" style={{ gap: '4px' }}>
                    <Star style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px', color: '#eab308', fill: '#eab308' }} />
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
        <div className="border-b border-gray-200 dark:border-gray-700" style={{ paddingTop: isMobile ? '16px' : '20px', paddingBottom: isMobile ? '16px' : '20px' }}>
          <h4 style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: '600', color: darkMode ? '#d1d5db' : '#374151', marginBottom: isMobile ? '8px' : '12px' }}>Route</h4>
          <div className="flex items-center rounded-xl bg-gray-100 dark:bg-gray-800/60" style={{ gap: isMobile ? '8px' : '12px', padding: isMobile ? '12px' : '16px' }}>
            <div className="flex items-center flex-1" style={{ gap: isMobile ? '6px' : '8px', minWidth: 0 }}>
              <div style={{
                width: isMobile ? '32px' : '40px',
                height: isMobile ? '32px' : '40px',
                borderRadius: '50%',
                background: 'linear-gradient(to bottom right, #4ade80, #16a34a)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 10px 15px -3px rgba(22, 163, 74, 0.3)',
                flexShrink: 0
              }}>
                <MapPin style={{ width: isMobile ? '16px' : '20px', height: isMobile ? '16px' : '20px', color: '#fff' }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#6b7280' }}>From</p>
                <p style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: '500', color: darkMode ? '#fff' : '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{truck.origin}</p>
              </div>
            </div>

            <div className="flex flex-col items-center" style={{ gap: '4px', padding: isMobile ? '0 8px' : '0 16px', flexShrink: 0 }}>
              <Navigation style={{ width: isMobile ? '16px' : '20px', height: isMobile ? '16px' : '20px', color: '#a78bfa' }} />
              <div style={{ height: '2px', width: isMobile ? '48px' : '64px', background: 'linear-gradient(to right, #a78bfa, #8b5cf6)', borderRadius: '9999px' }} />
            </div>

            <div className="flex items-center flex-1" style={{ gap: isMobile ? '6px' : '8px', minWidth: 0 }}>
              <div style={{
                width: isMobile ? '32px' : '40px',
                height: isMobile ? '32px' : '40px',
                borderRadius: '50%',
                background: 'linear-gradient(to bottom right, #f87171, #dc2626)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 10px 15px -3px rgba(220, 38, 38, 0.3)',
                flexShrink: 0
              }}>
                <MapPin style={{ width: isMobile ? '16px' : '20px', height: isMobile ? '16px' : '20px', color: '#fff' }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#6b7280' }}>To</p>
                <p style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: '500', color: darkMode ? '#fff' : '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{truck.destination}</p>
              </div>
            </div>
          </div>

          {/* Distance & Time */}
          {(truck.distance || truck.estimatedTime) && (
            <div className="flex items-center" style={{ gap: isMobile ? '16px' : '24px', marginTop: isMobile ? '8px' : '12px', fontSize: isMobile ? '12px' : '14px', color: '#6b7280' }}>
              {truck.distance && (
                <div className="flex items-center" style={{ gap: '6px' }}>
                  <Navigation style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px', color: '#3b82f6' }} />
                  <span>{truck.distance}</span>
                </div>
              )}
              {truck.estimatedTime && (
                <div className="flex items-center" style={{ gap: '6px' }}>
                  <Clock style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px', color: '#a78bfa' }} />
                  <span>{truck.estimatedTime}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Truck Details */}
        <div className="border-b border-gray-200 dark:border-gray-700" style={{ paddingTop: isMobile ? '16px' : '20px', paddingBottom: isMobile ? '16px' : '20px' }}>
          <h4 style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: '600', color: darkMode ? '#d1d5db' : '#374151', marginBottom: isMobile ? '8px' : '12px' }}>Truck Details</h4>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '10px' : '16px' }}>
            {truck.vehicleType && (
              <div className="flex items-center" style={{ gap: isMobile ? '6px' : '8px' }}>
                <Truck style={{ width: isMobile ? '18px' : '20px', height: isMobile ? '18px' : '20px', color: '#a78bfa', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#6b7280' }}>Vehicle Type</p>
                  <p style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: '500', color: darkMode ? '#fff' : '#111827' }}>{truck.vehicleType}</p>
                </div>
              </div>
            )}
            {truck.capacity && (
              <div className="flex items-center" style={{ gap: isMobile ? '6px' : '8px' }}>
                <Truck style={{ width: isMobile ? '18px' : '20px', height: isMobile ? '18px' : '20px', color: '#3b82f6', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#6b7280' }}>Capacity</p>
                  <p style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: '500', color: darkMode ? '#fff' : '#111827' }}>{truck.capacity}</p>
                </div>
              </div>
            )}
            {truck.plateNumber && (
              <div className="flex items-center" style={{ gap: isMobile ? '6px' : '8px' }}>
                <div style={{
                  width: isMobile ? '18px' : '20px',
                  height: isMobile ? '18px' : '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10b981',
                  fontWeight: 'bold',
                  fontSize: isMobile ? '11px' : '12px',
                  flexShrink: 0
                }}>
                  #
                </div>
                <div>
                  <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#6b7280' }}>Plate Number</p>
                  <p style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: '500', fontFamily: 'monospace', color: darkMode ? '#fff' : '#111827' }}>{truck.plateNumber}</p>
                </div>
              </div>
            )}
            {truck.availableDate && (
              <div className="flex items-center" style={{ gap: isMobile ? '6px' : '8px' }}>
                <Calendar style={{ width: isMobile ? '18px' : '20px', height: isMobile ? '18px' : '20px', color: '#10b981', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#6b7280' }}>Available Date</p>
                  <p style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: '500', color: darkMode ? '#fff' : '#111827' }}>{truck.availableDate}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {truck.description && (
          <div className="border-b border-gray-200 dark:border-gray-700" style={{ paddingTop: isMobile ? '16px' : '20px', paddingBottom: isMobile ? '16px' : '20px' }}>
            <h4 style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: '600', color: darkMode ? '#d1d5db' : '#374151', marginBottom: isMobile ? '6px' : '8px' }}>Description</h4>
            <p style={{ fontSize: isMobile ? '13px' : '14px', color: '#6b7280', lineHeight: '1.6' }}>{truck.description}</p>
          </div>
        )}

        {/* Photos */}
        {truckPhotos.length > 0 && (
          <div className="border-b border-gray-200 dark:border-gray-700" style={{ paddingTop: isMobile ? '16px' : '20px', paddingBottom: isMobile ? '16px' : '20px' }}>
            <h4 style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: '600', color: darkMode ? '#d1d5db' : '#374151', marginBottom: isMobile ? '8px' : '12px' }}>Photos</h4>
            <div className="flex flex-wrap" style={{ gap: isMobile ? '8px' : '12px' }}>
              {truckPhotos.map((photo, idx) => (
                <div
                  key={idx}
                  className="relative rounded-xl overflow-hidden border-2 border-gray-200 dark:border-gray-700"
                  style={{ width: isMobile ? '80px' : '96px', height: isMobile ? '80px' : '96px' }}
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
          <div className="border-b border-gray-200 dark:border-gray-700" style={{ paddingTop: isMobile ? '16px' : '20px', paddingBottom: isMobile ? '16px' : '20px' }}>
            <h4 style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: '600', color: darkMode ? '#d1d5db' : '#374151', marginBottom: isMobile ? '8px' : '12px' }}>Route Map</h4>
            <RouteMap
              origin={truck.origin}
              destination={truck.destination}
              originCoords={truck.originCoords}
              destCoords={truck.destCoords}
              darkMode={darkMode}
              height={isMobile ? '160px' : '200px'}
            />
          </div>
        )}

        {/* Bookings Section - Only for owner */}
        {isOwner && (
          <div className="border-b border-gray-200 dark:border-gray-700" style={{ paddingTop: isMobile ? '16px' : '20px', paddingBottom: isMobile ? '16px' : '20px' }}>
            <h4 style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: '600', color: darkMode ? '#d1d5db' : '#374151', marginBottom: isMobile ? '8px' : '12px' }}>
              Booking Requests {!bidsLoading && `(${bookings.length})`}
            </h4>
            {bidsLoading ? (
              <div className="flex items-center justify-center" style={{ paddingTop: isMobile ? '16px' : '20px', paddingBottom: isMobile ? '16px' : '20px' }}>
                <Loader2 style={{ width: isMobile ? '20px' : '24px', height: isMobile ? '20px' : '24px', color: '#a78bfa' }} className="animate-spin" />
                <span style={{ marginLeft: '8px', fontSize: isMobile ? '12px' : '14px', color: '#6b7280' }}>Loading requests...</span>
              </div>
            ) : bookings.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '10px' : '12px' }}>
                {bookings.map((booking, idx) => (
                  <div
                    key={booking.id || idx}
                    className="rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700"
                    style={{ padding: isMobile ? '12px' : '16px' }}
                  >
                    <div className="flex items-center justify-between" style={{ marginBottom: isMobile ? '6px' : '8px' }}>
                      <div className="flex items-center" style={{ gap: isMobile ? '8px' : '12px' }}>
                        <div style={{
                          width: isMobile ? '36px' : '40px',
                          height: isMobile ? '36px' : '40px',
                          borderRadius: '50%',
                          background: 'linear-gradient(to bottom right, #fb923c, #ea580c)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontWeight: 'bold',
                          fontSize: isMobile ? '14px' : '16px'
                        }}>
                          {booking.shipper?.[0]?.toUpperCase() || 'S'}
                        </div>
                        <div>
                          <p style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: '500', color: darkMode ? '#fff' : '#111827' }}>{booking.shipper}</p>
                          {booking.cargoType && (
                            <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#6b7280' }}>{booking.cargoType}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex items-center" style={{ gap: isMobile ? '4px' : '8px' }}>
                        <p style={{ fontSize: isMobile ? '15px' : '18px', fontWeight: 'bold', color: '#10b981' }}>
                          {formatPrice(booking.amount)}
                        </p>
                        {booking.status === 'accepted' && (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" style={{ padding: isMobile ? '2px 6px' : '4px 8px', fontSize: isMobile ? '11px' : '12px' }}>
                            Accepted
                          </Badge>
                        )}
                        {booking.status === 'rejected' && (
                          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" style={{ padding: isMobile ? '2px 6px' : '4px 8px', fontSize: isMobile ? '11px' : '12px' }}>
                            Rejected
                          </Badge>
                        )}
                      </div>
                    </div>
                    {/* Booking Message - Sanitized */}
                    {booking.message && (
                      <div className="rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/30" style={{ marginTop: isMobile ? '6px' : '8px', padding: isMobile ? '8px' : '12px' }}>
                        <div className="flex items-start" style={{ gap: isMobile ? '4px' : '8px' }}>
                          <MessageSquare style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px', color: '#a78bfa', marginTop: '2px', flexShrink: 0 }} />
                          <p style={{ fontSize: isMobile ? '12px' : '13px', color: darkMode ? '#d1d5db' : '#374151', fontStyle: 'italic' }}>
                            "{sanitizeMessage(booking.message)}"
                          </p>
                        </div>
                      </div>
                    )}
                    {/* Action Buttons */}
                    <div className="flex" style={{ gap: isMobile ? '6px' : '8px', marginTop: isMobile ? '8px' : '12px' }}>
                      <Button
                        variant="outline"
                        size={isMobile ? "sm" : "default"}
                        className="flex-1 gap-2"
                        onClick={() => onOpenChat?.(booking._original, truck)}
                      >
                        <MessageSquare className="size-4" />
                        Chat
                      </Button>
                      {booking.status === 'pending' && (
                        <>
                          <Button
                            variant="outline"
                            size={isMobile ? "sm" : "default"}
                            className="gap-1 border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                            onClick={() => handleAcceptBid(booking._original)}
                            disabled={processingBidId === booking.id}
                          >
                            {processingBidId === booking.id && processingAction === 'accept' ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Check className="size-4" />
                            )}
                            Accept
                          </Button>
                          <Button
                            variant="outline"
                            size={isMobile ? "sm" : "default"}
                            className="gap-1 border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                            onClick={() => handleRejectBid(booking._original)}
                            disabled={processingBidId === booking.id}
                          >
                            {processingBidId === booking.id && processingAction === 'reject' ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <X className="size-4" />
                            )}
                            Reject
                          </Button>
                        </>
                      )}
                      {booking.status === 'accepted' && (
                        <Button
                          variant="gradient"
                          size={isMobile ? "sm" : "default"}
                          className="flex-1 gap-2"
                          onClick={() => {
                            const existingContractId = bidContracts[booking.id];
                            if (existingContractId && onOpenContract) {
                              onClose?.();
                              onOpenContract(existingContractId);
                              return;
                            }
                            onCreateContract?.(booking._original, truck);
                          }}
                        >
                          <FileText className="size-4" />
                          {bidContracts[booking.id] ? 'Open Contract' : 'Create Contract'}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: isMobile ? '12px' : '14px', color: '#6b7280', textAlign: 'center', paddingTop: isMobile ? '16px' : '20px', paddingBottom: isMobile ? '16px' : '20px' }}>
                No booking requests yet
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex" style={{ gap: isMobile ? '8px' : '12px', paddingTop: isMobile ? '16px' : '20px' }}>
          {!isOwner && currentRole === 'shipper' && canBookTruckStatus(truck.status) && (
            <Button
              variant="gradient"
              size={isMobile ? "default" : "lg"}
              className="flex-1"
              onClick={() => onBook?.(truck)}
            >
              Book Now
            </Button>
          )}
          {isOwner && truck.status === 'negotiating' && (
            <Button
              variant="outline"
              size={isMobile ? "default" : "lg"}
              className="flex-1 gap-2 border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20"
              onClick={() => onReopenListing?.(truck.id, 'truck')}
            >
              <RotateCcw className="size-4" />
              Reopen for Booking
            </Button>
          )}
          <Button
            variant="ghost"
            size={isMobile ? "default" : "lg"}
            onClick={onClose}
            className="w-full"
          >
            Close
          </Button>
        </div>
        </div>
      </DialogBottomSheet>
    </Dialog>
  );
}

export default TruckDetailsModal;

