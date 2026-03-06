import React from 'react';
import {
  Clock,
  Navigation,
  Package,
  Calendar,
  Weight,
  Truck,
  Edit,
  Star,
  X,
  Loader2,
  MessageSquare,
  Check,
  FileText,
  RotateCcw,
  ArrowRight,
} from 'lucide-react';
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
import { RouteMap } from '@/components/maps';
import { useBidsForListing } from '@/hooks/useBids';
import { sanitizeMessage } from '@/utils/messageUtils';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import api from '@/services/api';
import { canBidCargoStatus } from '@/utils/listingStatus';

function formatPrice(price) {
  if (!price) return '---';
  if (typeof price === 'string' && price.startsWith('PHP ')) return price;
  return `PHP ${Number(price).toLocaleString()}`;
}

function formatTimeAgo(timestamp) {
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
}

function formatStatusLabel(status) {
  return String(status || 'open').replace(/_/g, ' ').toUpperCase();
}

function cargoStatusBadgeVariant(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'open') return 'gradient-green';
  if (['waiting', 'negotiating', 'pending'].includes(normalized)) return 'gradient-orange';
  if (['in_progress', 'in-progress', 'in_transit', 'contracted', 'signed'].includes(normalized)) return 'gradient-purple';
  if (['delivered', 'completed'].includes(normalized)) return 'gradient-blue';
  if (['cancelled', 'offline', 'rejected'].includes(normalized)) return 'gradient-red';
  return 'secondary';
}

function bidStatusBadgeVariant(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'pending') return 'warning';
  if (normalized === 'accepted') return 'success';
  if (normalized === 'rejected') return 'destructive';
  return 'secondary';
}

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
  onRejectBid,
  onCreateContract,
  onReopenListing,
  onOpenContract,
  onRefer,
  userBidId,
  isBroker = false,
  canRefer = false,
  darkMode = false,
}) {
  const [processingBidId, setProcessingBidId] = React.useState(null);
  const [processingAction, setProcessingAction] = React.useState(null);
  const [contractId, setContractId] = React.useState(null);
  const [loadingContract, setLoadingContract] = React.useState(false);
  const [bidContracts, setBidContracts] = React.useState({});
  const [confirmAction, setConfirmAction] = React.useState(null); // { type: 'accept'|'reject', bid }

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

  const handleRejectBid = async (bid) => {
    if (!onRejectBid) return;
    setProcessingBidId(bid.id);
    setProcessingAction('reject');
    try {
      await onRejectBid(bid, cargo, 'cargo');
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

  React.useEffect(() => {
    const fetchContractForBid = async () => {
      if (!open || currentRole !== 'trucker' || !userBidId) {
        setContractId(null);
        return;
      }

      try {
        setLoadingContract(true);
        const response = await api.contracts.getByBid(userBidId);
        if (response.contract) setContractId(response.contract.id);
      } catch {
        setContractId(null);
      } finally {
        setLoadingContract(false);
      }
    };

    fetchContractForBid();
  }, [open, currentRole, userBidId]);

  const { bids: fetchedBids, loading: bidsLoading } = useBidsForListing(
    isOwner && open ? cargo?.id : null,
    'cargo'
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

  if (!cargo) return null;

  const displayPrice = cargo.price || cargo.askingPrice;
  const displayImages = cargo.images?.length > 0 ? cargo.images : cargo.cargoPhotos || [];
  const displayWeight = cargo.weight ? (cargo.unit && cargo.unit !== 'kg' ? `${cargo.weight} ${cargo.unit}` : `${cargo.weight} tons`) : '';

  const bids = fetchedBids.map((bid) => ({
    id: bid.id,
    bidder: bid.bidderName,
    bidderId: bid.bidderId,
    amount: bid.price,
    rating: bid.bidderRating,
    status: bid.status,
    message: bid.message,
    createdAt: bid.createdAt,
    _original: bid,
  }));

  const canPlaceBid = !isOwner && currentRole === 'trucker' && canBidCargoStatus(cargo.status);
  const canReopen = isOwner && cargo.status === 'negotiating';
  const canReferListing = isBroker && !isOwner && canRefer && onRefer;
  const hasFooterPrimaryActions = canPlaceBid || canReopen || canReferListing || (currentRole === 'trucker' && contractId && onOpenContract);

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogBottomSheet className="max-w-2xl">
          <div className="space-y-5 p-4 lg:p-6">
            <DialogHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
                    <Package className="size-6" />
                  </div>
                  <div className="min-w-0">
                    <DialogTitle>Cargo Details</DialogTitle>
                    <DialogDescription className="truncate">Posted {formatTimeAgo(cargo.postedAt)}</DialogDescription>
                  </div>
                </div>
                {isOwner && (
                  <Button variant="outline" size="sm" onClick={() => onEdit?.(cargo)} className="min-h-10 gap-2">
                    <Edit className="size-4" />
                    Edit Cargo
                  </Button>
                )}
              </div>
            </DialogHeader>

            <section className="space-y-3 border-t border-border pt-4 lg:pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={cargoStatusBadgeVariant(cargo.status)} className="uppercase tracking-wide">
                    {formatStatusLabel(cargo.status)}
                  </Badge>
                  {cargo.cargoType && (
                    <Badge variant="info" className="uppercase">
                      {cargo.cargoType}
                    </Badge>
                  )}
                </div>
                <div className="rounded-xl bg-primary px-4 py-2 text-xl font-bold text-primary-foreground shadow-sm shadow-primary/25">
                  {formatPrice(displayPrice)}
                </div>
              </div>
            </section>

            <section className="space-y-1 border-t border-border pt-4 lg:pt-5">
              <h3 className="text-lg font-semibold text-foreground">{cargo.company || cargo.shipper}</h3>
              {cargo.shipperTransactions > 0 && (
                <p className="text-sm text-muted-foreground">{cargo.shipperTransactions} successful transactions</p>
              )}
            </section>

            <section className="space-y-3 border-t border-border pt-4 lg:pt-5">
              <h4 className="text-sm font-medium text-foreground">Route</h4>
              <div className="rounded-xl border border-border bg-muted/60 p-3">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">From</p>
                    <p className="truncate text-sm font-medium text-foreground">{cargo.origin}</p>
                  </div>
                  <div className="flex items-center gap-1 text-primary">
                    <Navigation className="size-4" />
                    <ArrowRight className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">To</p>
                    <p className="truncate text-sm font-medium text-foreground">{cargo.destination}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  {cargo.distance && (
                    <span className="flex items-center gap-1">
                      <Navigation className="size-3.5 text-info" />
                      {cargo.distance}
                    </span>
                  )}
                  {(cargo.estimatedTime || cargo.time) && (
                    <span className="flex items-center gap-1">
                      <Clock className="size-3.5 text-warning" />
                      {cargo.estimatedTime || cargo.time}
                    </span>
                  )}
                </div>
              </div>
            </section>

            <section className="space-y-3 border-t border-border pt-4 lg:pt-5">
              <h4 className="text-sm font-medium text-foreground">Cargo Details</h4>
              <div className="grid gap-3 lg:grid-cols-2">
                {displayWeight && (
                  <div className="flex items-center gap-2">
                    <Weight className="size-4 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Weight</p>
                      <p className="text-sm font-medium text-foreground">{displayWeight}</p>
                    </div>
                  </div>
                )}
                {cargo.vehicleNeeded && (
                  <div className="flex items-center gap-2">
                    <Truck className="size-4 text-info" />
                    <div>
                      <p className="text-xs text-muted-foreground">Vehicle Needed</p>
                      <p className="text-sm font-medium text-foreground">{cargo.vehicleNeeded}</p>
                    </div>
                  </div>
                )}
                {cargo.pickupDate && (
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 text-success" />
                    <div>
                      <p className="text-xs text-muted-foreground">Pickup Date</p>
                      <p className="text-sm font-medium text-foreground">{cargo.pickupDate}</p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {cargo.description && (
              <section className="space-y-2 border-t border-border pt-4 lg:pt-5">
                <h4 className="text-sm font-medium text-foreground">Description</h4>
                <p className="text-sm text-muted-foreground">{cargo.description}</p>
              </section>
            )}

            {displayImages.length > 0 && (
              <section className="space-y-3 border-t border-border pt-4 lg:pt-5">
                <h4 className="text-sm font-medium text-foreground">Photos</h4>
                <div className="flex flex-wrap gap-2">
                  {displayImages.map((image, idx) => (
                    <div key={idx} className="relative size-24 overflow-hidden rounded-xl border border-border">
                      <img
                        src={image}
                        alt={`Cargo ${idx + 1}`}
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

            {cargo.originCoords && cargo.destCoords && (
              <section className="space-y-3 border-t border-border pt-4 lg:pt-5">
                <h4 className="text-sm font-medium text-foreground">Route Map</h4>
                <RouteMap
                  origin={cargo.origin}
                  destination={cargo.destination}
                  originCoords={cargo.originCoords}
                  destCoords={cargo.destCoords}
                  darkMode={darkMode}
                  height="200px"
                />
              </section>
            )}

            {isOwner && (
              <section className="space-y-3 border-t border-border pt-4 lg:pt-5">
                <h4 className="text-sm font-medium text-foreground">
                  Bids Received {!bidsLoading && `(${bids.length})`}
                </h4>
                {bidsLoading ? (
                  <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin text-primary" />
                    Loading bids...
                  </div>
                ) : bids.length > 0 ? (
                  <div className="space-y-3">
                    {bids.map((bid, idx) => (
                      <div key={bid.id || idx} className="rounded-xl border border-border bg-muted/40 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-info/15 text-info">
                              {bid.bidder?.[0]?.toUpperCase() || 'T'}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">{bid.bidder}</p>
                              {bid.rating ? (
                                <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                                  <Star className="size-3.5 fill-warning text-warning" />
                                  {bid.rating}
                                </div>
                              ) : null}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-base font-semibold text-foreground">{formatPrice(bid.amount)}</p>
                            <Badge variant={bidStatusBadgeVariant(bid.status)} className="mt-1 capitalize">
                              {String(bid.status || 'pending')}
                            </Badge>
                          </div>
                        </div>

                        {bid.message && (
                          <div className="mt-3 rounded-lg border border-border bg-background p-2.5">
                            <div className="flex items-start gap-2">
                              <MessageSquare className="mt-0.5 size-4 text-info" />
                              <p className="text-xs text-muted-foreground">"{sanitizeMessage(bid.message)}"</p>
                            </div>
                          </div>
                        )}

                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="min-h-10 flex-1 gap-2"
                            onClick={() => onOpenChat?.(bid._original, cargo)}
                          >
                            <MessageSquare className="size-4" />
                            Chat
                          </Button>
                          {bid.status === 'pending' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="min-h-10 gap-2 border-success text-success hover:bg-success/10"
                                onClick={() => setConfirmAction({ type: 'accept', bid: bid._original })}
                                disabled={processingBidId === bid.id}
                              >
                                {processingBidId === bid.id && processingAction === 'accept'
                                  ? <Loader2 className="size-4 animate-spin" />
                                  : <Check className="size-4" />}
                                Accept
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="min-h-10 gap-2 border-destructive text-destructive hover:bg-destructive/10"
                                onClick={() => setConfirmAction({ type: 'reject', bid: bid._original })}
                                disabled={processingBidId === bid.id}
                              >
                                {processingBidId === bid.id && processingAction === 'reject'
                                  ? <Loader2 className="size-4 animate-spin" />
                                  : <X className="size-4" />}
                                Reject
                              </Button>
                            </>
                          )}
                          {bid.status === 'accepted' && (
                            <Button
                              variant="gradient"
                              size="sm"
                              className="min-h-10 flex-1 gap-2"
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
                  <p className="py-4 text-center text-sm text-muted-foreground">No bids received yet</p>
                )}
              </section>
            )}
          </div>

          <div className="dialog-fixed-footer flex flex-wrap gap-2 border-t border-border bg-background p-4 lg:p-5">
            {canPlaceBid && (
              <Button variant="gradient" className="min-h-11 flex-1" onClick={() => onBid?.(cargo)}>
                <PesoIcon className="mr-2 size-4" />
                Place Bid
              </Button>
            )}

            {canReopen && (
              <Button
                variant="outline"
                className="min-h-11 flex-1 gap-2 border-primary text-primary hover:bg-primary/10"
                onClick={() => onReopenListing?.(cargo.id, 'cargo')}
              >
                <RotateCcw className="size-4" />
                Reopen for Bidding
              </Button>
            )}

            {currentRole === 'trucker' && contractId && onOpenContract && (
              <Button
                variant="gradient"
                className="min-h-11 flex-1 gap-2"
                onClick={() => {
                  onClose?.();
                  onOpenContract(contractId);
                }}
              >
                <FileText className="size-4" />
                View Contract
              </Button>
            )}

            {currentRole === 'trucker' && loadingContract && !contractId && (
              <div className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Checking for contract...
              </div>
            )}

            {canReferListing && (
              <Button
                variant="outline"
                onClick={() => onRefer?.(cargo)}
                className="min-h-11 flex-1 border-primary text-primary hover:bg-primary/10"
              >
                Refer Listing
              </Button>
            )}

            <Button
              variant={hasFooterPrimaryActions ? 'outline' : 'ghost'}
              onClick={onClose}
              className={hasFooterPrimaryActions ? 'min-h-11 flex-1' : 'min-h-11 w-full'}
            >
              Close
            </Button>
          </div>
        </DialogBottomSheet>
      </Dialog>

      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.type === 'accept' ? 'Accept this bid?' : 'Reject this bid?'}
        description={
          confirmAction?.type === 'accept'
            ? 'Accepting this bid will create a contract with this trucker. Other pending bids will remain open.'
            : 'This bid will be rejected and the trucker will be notified.'
        }
        confirmLabel={confirmAction?.type === 'accept' ? 'Accept Bid' : 'Reject Bid'}
        variant={confirmAction?.type === 'reject' ? 'destructive' : 'default'}
        onConfirm={executeConfirmedAction}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  );
}

export default CargoDetailsModal;
