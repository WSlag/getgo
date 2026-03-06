import React, { useState } from 'react';
import { MapPin, Package, Truck, Star, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogBottomSheet,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

export function BidModal({
  open,
  onClose,
  listing,
  currentRole = 'trucker',
  onSubmit,
  isSuspended = false,
  outstandingFees = 0,
  loading = false,
}) {
  const [bidAmount, setBidAmount] = useState('');
  const [message, setMessage] = useState('');
  const [cargoType, setCargoType] = useState('');
  const [cargoWeight, setCargoWeight] = useState('');
  const [errors, setErrors] = useState({});

  const isCargo = listing?.type === 'cargo' || !listing?.trucker;
  const isShipper = currentRole === 'shipper';
  const normalizedOutstandingFees = Number(outstandingFees || 0);
  const showOutstandingReminder = currentRole === 'trucker' && !isSuspended && normalizedOutstandingFees > 0;

  const formatPrice = (price) => {
    if (!price) return '---';
    return `PHP ${Number(price).toLocaleString()}`;
  };

  const handleSubmit = () => {
    const newErrors = {};
    if (!bidAmount) newErrors.bidAmount = 'Bid amount is required';
    if (isShipper && !isCargo) {
      if (!cargoType) newErrors.cargoType = 'Cargo type is required';
      if (!cargoWeight) newErrors.cargoWeight = 'Cargo weight is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit?.({
      amount: Number(bidAmount),
      message,
      cargoType,
      cargoWeight: cargoWeight ? Number(cargoWeight) : undefined,
    });
  };

  const handleClose = () => {
    setBidAmount('');
    setMessage('');
    setCargoType('');
    setCargoWeight('');
    setErrors({});
    onClose?.();
  };

  if (!listing) return null;

  const listingAllowsBid = listing.status === 'open' || listing.status === 'waiting' || listing.status === 'available';
  const canPlaceBid = listingAllowsBid && !isSuspended;
  const anchorAmount = listing.askingPrice || listing.askingRate;

  const quickAmounts = [
    anchorAmount,
    Math.round((anchorAmount || 0) * 0.95),
    Math.round((anchorAmount || 0) * 0.9),
  ].filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogBottomSheet className="max-w-md">
        <div className="space-y-5 p-4 lg:p-6">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'flex size-12 shrink-0 items-center justify-center rounded-xl shadow-sm',
                  isCargo ? 'bg-success/10 text-success' : 'bg-info/10 text-info'
                )}
              >
                {isCargo ? <Package className="size-6" /> : <Truck className="size-6" />}
              </div>
              <div className="min-w-0">
                <DialogTitle className="truncate">{isCargo ? 'Place Your Bid' : 'Book This Truck'}</DialogTitle>
                <DialogDescription className="truncate">
                  {isCargo
                    ? `Bidding on ${listing.shipper}'s cargo`
                    : `Booking ${listing.trucker}'s truck`}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {!listingAllowsBid && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-medium">This listing is no longer accepting bids.</p>
                  <p className="text-xs">Status: {String(listing.status || '').toUpperCase()}</p>
                </div>
              </div>
            </div>
          )}

          {isSuspended && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              Account suspended. Pay outstanding fees to resume bidding.
            </div>
          )}

          {showOutstandingReminder && (
            <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
              <p className="font-medium text-warning">Reminder: Outstanding platform fees {formatPrice(normalizedOutstandingFees)}.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Settle unpaid fees now. Overdue unpaid fees after the 3-day window automatically suspend bidding.
              </p>
            </div>
          )}

          <section className="space-y-3 border-t border-border pt-4 lg:pt-5">
            <div className="rounded-xl border border-border bg-muted/50 p-3">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-medium text-foreground">{isCargo ? listing.shipper : listing.trucker}</p>
                  {!isCargo && listing.truckerRating > 0 && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Star className="size-3.5 fill-warning text-warning" />
                      {listing.truckerRating}
                    </div>
                  )}
                </div>
                <div className="shrink-0 rounded-xl bg-primary px-4 py-2 text-lg font-bold text-primary-foreground shadow-sm shadow-primary/25">
                  {formatPrice(anchorAmount)}
                </div>
              </div>

              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-success" />
                  <span className="font-medium text-foreground">{listing.origin}</span>
                </div>
                {listing.originStreetAddress ? (
                  <p className="pl-6 text-xs text-muted-foreground">{listing.originStreetAddress}</p>
                ) : null}

                <p className="pl-6 text-xs text-muted-foreground">{'->'}</p>

                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-destructive" />
                  <span className="font-medium text-foreground">{listing.destination}</span>
                </div>
                {listing.destinationStreetAddress ? (
                  <p className="pl-6 text-xs text-muted-foreground">{listing.destinationStreetAddress}</p>
                ) : null}
              </div>

              {isCargo && (
                <p className="mt-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{listing.weight} {listing.unit}</span>
                  {listing.cargoType ? ` - ${listing.cargoType}` : ''}
                </p>
              )}
            </div>
          </section>

          <section className="space-y-3 border-t border-border pt-4 lg:pt-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Your {isCargo ? 'Bid' : 'Offer'} Amount
              </label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder={anchorAmount || '0'}
                  value={bidAmount}
                  onChange={(e) => {
                    setBidAmount(e.target.value);
                    if (errors.bidAmount) setErrors((prev) => ({ ...prev, bidAmount: null }));
                  }}
                  className={cn('pr-14 text-lg font-semibold', errors.bidAmount && 'border-destructive')}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">PHP</span>
              </div>
              {errors.bidAmount && <p className="mt-1 text-xs text-destructive">{errors.bidAmount}</p>}

              <div className="mt-2 flex gap-2">
                {quickAmounts.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setBidAmount(String(amount))}
                    className={cn(
                      'min-h-11 flex-1 rounded-xl px-3 py-1 text-xs font-medium transition-colors',
                      bidAmount === String(amount)
                        ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
                        : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    {formatPrice(amount)}
                  </button>
                ))}
              </div>
            </div>

            {isShipper && !isCargo && (
              <div className="grid gap-3 lg:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Your Cargo Type</label>
                  <Input
                    placeholder="e.g., Electronics"
                    value={cargoType}
                    onChange={(e) => {
                      setCargoType(e.target.value);
                      if (errors.cargoType) setErrors((prev) => ({ ...prev, cargoType: null }));
                    }}
                    className={cn(errors.cargoType && 'border-destructive')}
                  />
                  {errors.cargoType && <p className="mt-1 text-xs text-destructive">{errors.cargoType}</p>}
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Weight (tons)</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={cargoWeight}
                    onChange={(e) => {
                      setCargoWeight(e.target.value);
                      if (errors.cargoWeight) setErrors((prev) => ({ ...prev, cargoWeight: null }));
                    }}
                    className={cn(errors.cargoWeight && 'border-destructive')}
                  />
                  {errors.cargoWeight && <p className="mt-1 text-xs text-destructive">{errors.cargoWeight}</p>}
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Message (Optional)</label>
              <Textarea
                placeholder="Add a note to your bid..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          </section>
        </div>

        <div className="dialog-fixed-footer flex gap-2 border-t border-border bg-background p-4 lg:p-5">
          <Button variant="ghost" onClick={handleClose} className="min-h-11 flex-1">
            Cancel
          </Button>
          <Button
            variant="gradient"
            onClick={handleSubmit}
            disabled={loading || !canPlaceBid}
            className="min-h-11 flex-1"
          >
            {loading ? 'Submitting...' : isSuspended ? 'Account Suspended' : !listingAllowsBid ? 'Bidding Closed' : `Submit ${isCargo ? 'Bid' : 'Offer'}`}
          </Button>
        </div>
      </DialogBottomSheet>
    </Dialog>
  );
}

export default BidModal;
