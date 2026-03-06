import React from 'react';
import {
  Clock,
  Navigation,
  Truck,
  Calendar,
  Star,
  Edit,
  Loader2,
  MessageSquare,
  Check,
  X,
  FileText,
  RotateCcw,
  ArrowRight,
} from 'lucide-react';
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
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { canBookTruckStatus, toTruckUiStatus } from '@/utils/listingStatus';
import api from '@/services/api';

function formatPrice(price) {
  if (!price) return '---';
  return `PHP ${Number(price).toLocaleString()}`;
}

function formatTimeAgo(timestamp) {
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
}

function formatStatusLabel(status) {
  return String(status || 'available').replace(/_/g, ' ').toUpperCase();
}

function truckStatusBadgeVariant(status) {
  const normalized = String(status || '').toLowerCase();
  if (['available', 'open'].includes(normalized)) return 'gradient-green';
  if (['waiting', 'negotiating', 'pending'].includes(normalized)) return 'gradient-orange';
  if (['in_progress', 'in-progress', 'in_transit', 'contracted', 'booked', 'signed'].includes(normalized)) return 'gradient-purple';
  if (['delivered', 'completed'].includes(normalized)) return 'gradient-blue';
  if (['cancelled', 'offline', 'rejected'].includes(normalized)) return 'gradient-red';
  return 'secondary';
}

function bookingStatusBadgeVariant(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'pending') return 'warning';
  if (normalized === 'accepted') return 'success';
  if (normalized === 'rejected') return 'destructive';
  return 'secondary';
}

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
  onRefer,
  isBroker = false,
  canRefer = false,
  darkMode = false,
}) {
  const [processingBidId, setProcessingBidId] = React.useState(null);
  const [processingAction, setProcessingAction] = React.useState(null);
  const [bidContracts, setBidContracts] = React.useState({});
  const [confirmAction, setConfirmAction] = React.useState(null);

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

  const executeConfirmedAction = async () => {
    if (!confirmAction) return;
    const { type, bid } = confirmAction;
    setConfirmAction(null);
    if (type === 'accept') await handleAcceptBid(bid);
    if (type === 'reject') await handleRejectBid(bid);
  };

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
          if (response?.contract?.id) contractMap[acceptedBid.id] = response.contract.id;
        } catch {
          // Contract may not exist yet.
        }
      }));
      setBidContracts(contractMap);
    };

    fetchAcceptedBidContracts();
  }, [open, isOwner, fetchedBids]);

  if (!truck) return null;

  const displayStatus = truck.uiStatus || toTruckUiStatus(truck.status);
  const truckPhotos = truck.truckPhotos || [];

  const bookings = fetchedBids.map((bid) => ({
    id: bid.id,
    shipper: bid.bidderName,
    shipperId: bid.bidderId,
    amount: bid.price,
    cargoType: bid.cargoType,
    cargoWeight: bid.cargoWeight,
    status: bid.status,
    message: bid.message,
    createdAt: bid.createdAt,
    _original: bid,
  }));

  const canBookNow = !isOwner && currentRole === 'shipper' && canBookTruckStatus(truck.status);
  const canReopen = isOwner && truck.status === 'negotiating';
  const canReferListing = isBroker && !isOwner && canRefer && onRefer;
  const hasPrimaryFooterActions = canBookNow || canReopen || canReferListing;

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogBottomSheet className="max-w-2xl">
          <div className="space-y-5 p-4 lg:p-6">
            <DialogHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-info/10 text-info shadow-sm">
                    <Truck className="size-6" />
                  </div>
                  <div className="min-w-0">
                    <DialogTitle>Truck Details</DialogTitle>
                    <DialogDescription className="truncate">Posted {formatTimeAgo(truck.postedAt)}</DialogDescription>
                  </div>
                </div>
                {isOwner && (
                  <Button variant="outline" size="sm" onClick={() => onEdit?.(truck)} className="min-h-10 gap-2">
                    <Edit className="size-4" />
                    Edit Truck
                  </Button>
                )}
              </div>
            </DialogHeader>

            <section className="space-y-3 border-t border-border pt-4 lg:pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={truckStatusBadgeVariant(displayStatus)} className="uppercase tracking-wide">
                    {formatStatusLabel(displayStatus)}
                  </Badge>
                  {truck.vehicleType && (
                    <Badge variant="info" className="uppercase">
                      {truck.vehicleType}
                    </Badge>
                  )}
                </div>
                <div className="rounded-xl bg-primary px-4 py-2 text-xl font-bold text-primary-foreground shadow-sm shadow-primary/25">
                  {formatPrice(truck.askingRate)}
                </div>
              </div>
            </section>

            <section className="space-y-2 border-t border-border pt-4 lg:pt-5">
              <div className="flex items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                  {truck.trucker?.[0]?.toUpperCase() || 'T'}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-semibold text-foreground">{truck.trucker}</h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {truck.truckerRating > 0 && (
                      <span className="flex items-center gap-1">
                        <Star className="size-3.5 fill-warning text-warning" />
                        {truck.truckerRating.toFixed(1)}
                      </span>
                    )}
                    {truck.truckerTransactions > 0 && <span>{truck.truckerTransactions} trips</span>}
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-3 border-t border-border pt-4 lg:pt-5">
              <h4 className="text-sm font-medium text-foreground">Route</h4>
              <div className="rounded-xl border border-border bg-muted/60 p-3">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">From</p>
                    <p className="truncate text-sm font-medium text-foreground">{truck.origin}</p>
                  </div>
                  <div className="flex items-center gap-1 text-info">
                    <Navigation className="size-4" />
                    <ArrowRight className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">To</p>
                    <p className="truncate text-sm font-medium text-foreground">{truck.destination}</p>
                  </div>
                </div>
                {(truck.distance || truck.estimatedTime) && (
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    {truck.distance && (
                      <span className="flex items-center gap-1">
                        <Navigation className="size-3.5 text-info" />
                        {truck.distance}
                      </span>
                    )}
                    {truck.estimatedTime && (
                      <span className="flex items-center gap-1">
                        <Clock className="size-3.5 text-warning" />
                        {truck.estimatedTime}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-3 border-t border-border pt-4 lg:pt-5">
              <h4 className="text-sm font-medium text-foreground">Truck Details</h4>
              <div className="grid gap-3 lg:grid-cols-2">
                {truck.vehicleType && (
                  <div className="flex items-center gap-2">
                    <Truck className="size-4 text-info" />
                    <div>
                      <p className="text-xs text-muted-foreground">Vehicle Type</p>
                      <p className="text-sm font-medium text-foreground">{truck.vehicleType}</p>
                    </div>
                  </div>
                )}
                {truck.capacity && (
                  <div className="flex items-center gap-2">
                    <Truck className="size-4 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Capacity</p>
                      <p className="text-sm font-medium text-foreground">{truck.capacity}</p>
                    </div>
                  </div>
                )}
                {truck.plateNumber && (
                  <div className="flex items-center gap-2">
                    <div className="flex size-4 items-center justify-center text-xs font-semibold text-success">#</div>
                    <div>
                      <p className="text-xs text-muted-foreground">Plate Number</p>
                      <p className="font-mono text-sm font-medium text-foreground">{truck.plateNumber}</p>
                    </div>
                  </div>
                )}
                {truck.availableDate && (
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 text-success" />
                    <div>
                      <p className="text-xs text-muted-foreground">Available Date</p>
                      <p className="text-sm font-medium text-foreground">{truck.availableDate}</p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {truck.description && (
              <section className="space-y-2 border-t border-border pt-4 lg:pt-5">
                <h4 className="text-sm font-medium text-foreground">Description</h4>
                <p className="text-sm text-muted-foreground">{truck.description}</p>
              </section>
            )}

            {truckPhotos.length > 0 && (
              <section className="space-y-3 border-t border-border pt-4 lg:pt-5">
                <h4 className="text-sm font-medium text-foreground">Photos</h4>
                <div className="flex flex-wrap gap-2">
                  {truckPhotos.map((photo, idx) => (
                    <div key={idx} className="relative size-24 overflow-hidden rounded-xl border border-border">
                      <img
                        src={photo}
                        alt={`Truck ${idx + 1}`}
                        className="size-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {truck.originCoords && truck.destCoords && (
              <section className="space-y-3 border-t border-border pt-4 lg:pt-5">
                <h4 className="text-sm font-medium text-foreground">Route Map</h4>
                <RouteMap
                  origin={truck.origin}
                  destination={truck.destination}
                  originCoords={truck.originCoords}
                  destCoords={truck.destCoords}
                  darkMode={darkMode}
                  height="200px"
                />
              </section>
            )}

            {isOwner && (
              <section className="space-y-3 border-t border-border pt-4 lg:pt-5">
                <h4 className="text-sm font-medium text-foreground">
                  Booking Requests {!bidsLoading && `(${bookings.length})`}
                </h4>
                {bidsLoading ? (
                  <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin text-primary" />
                    Loading requests...
                  </div>
                ) : bookings.length > 0 ? (
                  <div className="space-y-3">
                    {bookings.map((booking, idx) => (
                      <div key={booking.id || idx} className="rounded-xl border border-border bg-muted/40 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                              {booking.shipper?.[0]?.toUpperCase() || 'S'}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">{booking.shipper}</p>
                              {booking.cargoType && (
                                <p className="truncate text-xs text-muted-foreground">{booking.cargoType}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-base font-semibold text-foreground">{formatPrice(booking.amount)}</p>
                            <Badge variant={bookingStatusBadgeVariant(booking.status)} className="mt-1 capitalize">
                              {String(booking.status || 'pending')}
                            </Badge>
                          </div>
                        </div>

                        {booking.message && (
                          <div className="mt-3 rounded-lg border border-border bg-background p-2.5">
                            <div className="flex items-start gap-2">
                              <MessageSquare className="mt-0.5 size-4 text-info" />
                              <p className="text-xs text-muted-foreground">"{sanitizeMessage(booking.message)}"</p>
                            </div>
                          </div>
                        )}

                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="min-h-10 flex-1 gap-2"
                            onClick={() => onOpenChat?.(booking._original, truck)}
                          >
                            <MessageSquare className="size-4" />
                            Chat
                          </Button>
                          {booking.status === 'pending' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="min-h-10 gap-2 border-success text-success hover:bg-success/10"
                                onClick={() => setConfirmAction({ type: 'accept', bid: booking._original })}
                                disabled={processingBidId === booking.id}
                              >
                                {processingBidId === booking.id && processingAction === 'accept'
                                  ? <Loader2 className="size-4 animate-spin" />
                                  : <Check className="size-4" />}
                                Accept
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="min-h-10 gap-2 border-destructive text-destructive hover:bg-destructive/10"
                                onClick={() => setConfirmAction({ type: 'reject', bid: booking._original })}
                                disabled={processingBidId === booking.id}
                              >
                                {processingBidId === booking.id && processingAction === 'reject'
                                  ? <Loader2 className="size-4 animate-spin" />
                                  : <X className="size-4" />}
                                Reject
                              </Button>
                            </>
                          )}
                          {booking.status === 'accepted' && (
                            <Button
                              variant="gradient"
                              size="sm"
                              className="min-h-10 flex-1 gap-2"
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
                  <p className="py-4 text-center text-sm text-muted-foreground">No booking requests yet</p>
                )}
              </section>
            )}
          </div>

          <div className="dialog-fixed-footer flex flex-wrap gap-2 border-t border-border bg-background p-4 lg:p-5">
            {canBookNow && (
              <Button
                variant="gradient"
                className="min-h-11 flex-1"
                onClick={() => onBook?.(truck)}
              >
                Book Now
              </Button>
            )}
            {canReopen && (
              <Button
                variant="outline"
                className="min-h-11 flex-1 gap-2 border-primary text-primary hover:bg-primary/10"
                onClick={() => onReopenListing?.(truck.id, 'truck')}
              >
                <RotateCcw className="size-4" />
                Reopen for Booking
              </Button>
            )}
            {canReferListing && (
              <Button
                variant="outline"
                className="min-h-11 flex-1 border-primary text-primary hover:bg-primary/10"
                onClick={() => onRefer?.(truck)}
              >
                Refer Listing
              </Button>
            )}
            <Button
              variant={hasPrimaryFooterActions ? 'outline' : 'ghost'}
              onClick={onClose}
              className={hasPrimaryFooterActions ? 'min-h-11 flex-1' : 'min-h-11 w-full'}
            >
              Close
            </Button>
          </div>
        </DialogBottomSheet>
      </Dialog>

      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.type === 'accept' ? 'Accept this booking?' : 'Reject this booking?'}
        description={
          confirmAction?.type === 'accept'
            ? 'Accepting this booking will create a contract with this shipper. Other pending bookings will remain open.'
            : 'This booking will be rejected and the shipper will be notified.'
        }
        confirmLabel={confirmAction?.type === 'accept' ? 'Accept Booking' : 'Reject Booking'}
        variant={confirmAction?.type === 'reject' ? 'destructive' : 'default'}
        onConfirm={executeConfirmedAction}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  );
}

export default TruckDetailsModal;
