import React, { useState } from 'react';
import { DollarSign, MessageSquare, MapPin, Package, Truck, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
  loading = false,
}) {
  const [bidAmount, setBidAmount] = useState('');
  const [message, setMessage] = useState('');
  const [cargoType, setCargoType] = useState('');
  const [cargoWeight, setCargoWeight] = useState('');
  const [errors, setErrors] = useState({});

  const isCargo = listing?.type === 'cargo' || !listing?.trucker;
  const isShipper = currentRole === 'shipper';

  const formatPrice = (price) => {
    if (!price) return '---';
    return `₱${Number(price).toLocaleString()}`;
  };

  const handleSubmit = () => {
    const newErrors = {};
    if (!bidAmount) newErrors.bidAmount = 'Bid amount is required';
    if (isShipper && isCargo === false) {
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md backdrop-blur-sm">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn(
              "size-12 rounded-xl flex items-center justify-center shadow-lg",
              isCargo
                ? "bg-gradient-to-br from-green-400 to-green-600 shadow-green-500/30"
                : "bg-gradient-to-br from-blue-400 to-blue-600 shadow-blue-500/30"
            )}>
              {isCargo ? (
                <Package className="size-6 text-white" />
              ) : (
                <Truck className="size-6 text-white" />
              )}
            </div>
            <div>
              <DialogTitle>
                {isCargo ? 'Place Your Bid' : 'Book This Truck'}
              </DialogTitle>
              <DialogDescription>
                {isCargo
                  ? `Bidding on ${listing.shipper}'s cargo`
                  : `Booking ${listing.trucker}'s truck`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Listing Summary */}
        <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-850 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">
                {isCargo ? listing.shipper : listing.trucker}
              </p>
              {!isCargo && listing.truckerRating > 0 && (
                <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                  <Star className="size-3 text-yellow-500 fill-yellow-500" />
                  <span>{listing.truckerRating}</span>
                </div>
              )}
            </div>
            <Badge variant="gradient-orange" className="text-lg font-bold px-3 py-1">
              {formatPrice(listing.askingPrice || listing.askingRate)}
            </Badge>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <MapPin className="size-4 text-green-500" />
            <span>{listing.origin}</span>
            <span className="text-gray-300 dark:text-gray-600">→</span>
            <MapPin className="size-4 text-red-500" />
            <span>{listing.destination}</span>
          </div>

          {isCargo && (
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">{listing.weight} {listing.unit}</span>
              {listing.cargoType && <span> • {listing.cargoType}</span>}
            </div>
          )}
        </div>

        <div className="space-y-4 py-2">
          {/* Bid Amount */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
              Your {isCargo ? 'Bid' : 'Offer'} Amount
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-green-500" />
              <Input
                type="number"
                placeholder={listing.askingPrice || listing.askingRate || '0'}
                value={bidAmount}
                onChange={(e) => {
                  setBidAmount(e.target.value);
                  if (errors.bidAmount) setErrors(prev => ({ ...prev, bidAmount: null }));
                }}
                className={cn("pl-10 text-lg font-semibold", errors.bidAmount && "border-red-500")}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                PHP
              </span>
            </div>
            {errors.bidAmount && <p className="text-xs text-red-500 mt-1">{errors.bidAmount}</p>}

            {/* Quick bid buttons */}
            <div className="flex gap-2 mt-2">
              {[
                listing.askingPrice || listing.askingRate,
                Math.round((listing.askingPrice || listing.askingRate) * 0.95),
                Math.round((listing.askingPrice || listing.askingRate) * 0.9),
              ].filter(Boolean).map((amount, idx) => (
                <button
                  key={idx}
                  onClick={() => setBidAmount(String(amount))}
                  className={cn(
                    "flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all duration-300 hover:scale-105 active:scale-95",
                    bidAmount === String(amount)
                      ? "bg-gradient-to-br from-orange-100 to-orange-200 text-orange-700 dark:from-orange-900/30 dark:to-orange-800/30 dark:text-orange-400 shadow-sm"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  )}
                >
                  {formatPrice(amount)}
                </button>
              ))}
            </div>
          </div>

          {/* Cargo Details - For shipper booking truck */}
          {isShipper && !isCargo && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                  Your Cargo Type
                </label>
                <Input
                  placeholder="e.g., Electronics"
                  value={cargoType}
                  onChange={(e) => {
                    setCargoType(e.target.value);
                    if (errors.cargoType) setErrors(prev => ({ ...prev, cargoType: null }));
                  }}
                  className={errors.cargoType && "border-red-500"}
                />
                {errors.cargoType && <p className="text-xs text-red-500 mt-1">{errors.cargoType}</p>}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                  Weight (tons)
                </label>
                <Input
                  type="number"
                  placeholder="0"
                  value={cargoWeight}
                  onChange={(e) => {
                    setCargoWeight(e.target.value);
                    if (errors.cargoWeight) setErrors(prev => ({ ...prev, cargoWeight: null }));
                  }}
                  className={errors.cargoWeight && "border-red-500"}
                />
                {errors.cargoWeight && <p className="text-xs text-red-500 mt-1">{errors.cargoWeight}</p>}
              </div>
            </div>
          )}

          {/* Message */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
              Message (Optional)
            </label>
            <Textarea
              placeholder="Add a note to your bid..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[60px]"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="gradient"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Submitting...' : `Submit ${isCargo ? 'Bid' : 'Offer'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default BidModal;
