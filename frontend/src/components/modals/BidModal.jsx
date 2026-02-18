import React, { useState } from 'react';
import { MessageSquare, MapPin, Package, Truck, Star } from 'lucide-react';
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
  loading = false,
}) {
  const [bidAmount, setBidAmount] = useState('');
  const [message, setMessage] = useState('');
  const [cargoType, setCargoType] = useState('');
  const [cargoWeight, setCargoWeight] = useState('');
  const [errors, setErrors] = useState({});
  const isMobile = useMediaQuery('(max-width: 1023px)');

  const isCargo = listing?.type === 'cargo' || !listing?.trucker;
  const isShipper = currentRole === 'shipper';

  const formatPrice = (price) => {
    if (!price) return '---';
    return `PHP ${Number(price).toLocaleString()}`;
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

  // Prevent bidding on non-open listings and suspended accounts
  const listingAllowsBid = listing.status === 'open' || listing.status === 'waiting' || listing.status === 'available';
  const canPlaceBid = listingAllowsBid && !isSuspended;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogBottomSheet className="max-w-md backdrop-blur-sm" hideCloseButton>
        <div style={{ padding: isMobile ? '16px' : '24px', paddingBottom: 0 }}>
          <DialogHeader>
            <div className="flex items-center" style={{ gap: isMobile ? '8px' : '12px' }}>
              <div style={{
                width: isMobile ? '40px' : '48px',
                height: isMobile ? '40px' : '48px',
                borderRadius: '12px',
                background: isCargo
                  ? 'linear-gradient(to bottom right, #4ade80, #16a34a)'
                  : 'linear-gradient(to bottom right, #60a5fa, #2563eb)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isCargo
                  ? '0 10px 15px -3px rgba(22, 163, 74, 0.3)'
                  : '0 10px 15px -3px rgba(37, 99, 235, 0.3)',
                flexShrink: 0
              }}>
                {isCargo ? (
                  <Package style={{ width: isMobile ? '20px' : '24px', height: isMobile ? '20px' : '24px', color: '#fff' }} />
                ) : (
                  <Truck style={{ width: isMobile ? '20px' : '24px', height: isMobile ? '20px' : '24px', color: '#fff' }} />
                )}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <DialogTitle style={{ fontSize: isMobile ? '16px' : '20px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {isCargo ? 'Place Your Bid' : 'Book This Truck'}
                </DialogTitle>
                <DialogDescription style={{ fontSize: isMobile ? '12px' : '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {isCargo
                    ? `Bidding on ${listing.shipper}'s cargo`
                    : `Booking ${listing.trucker}'s truck`}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Warning Banner for Non-Open Listings */}
          {!listingAllowsBid && (
            <div className="border-b border-gray-200 dark:border-gray-700" style={{ paddingTop: isMobile ? '16px' : '20px', paddingBottom: isMobile ? '16px' : '20px', marginTop: isMobile ? '12px' : '16px' }}>
              <div className="rounded-lg bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30 border-2 border-red-200 dark:border-red-800" style={{ padding: isMobile ? '12px' : '16px' }}>
                <p style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: '600', color: '#b91c1c' }} className="dark:text-red-400">
                  Warning: This listing is no longer accepting bids
                </p>
                <p style={{ fontSize: isMobile ? '11px' : '12px', marginTop: '4px', color: '#dc2626' }} className="dark:text-red-500">
                  Status: {listing.status?.toUpperCase()}
                </p>
              </div>
            </div>
          )}

          {isSuspended && (
            <div className="border-b border-gray-200 dark:border-gray-700" style={{ paddingTop: isMobile ? '16px' : '20px', paddingBottom: isMobile ? '16px' : '20px' }}>
              <div className="rounded-lg bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30 border-2 border-red-200 dark:border-red-800" style={{ padding: isMobile ? '12px' : '16px' }}>
                <p style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: '600', color: '#b91c1c' }} className="dark:text-red-400">
                  Account suspended. Pay outstanding fees to resume bidding.
                </p>
              </div>
            </div>
          )}

          {/* Listing Summary */}
          <div className="border-b border-gray-200 dark:border-gray-700" style={{ paddingTop: isMobile ? '16px' : '20px', paddingBottom: isMobile ? '16px' : '20px' }}>
            <div className="rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-850" style={{ padding: isMobile ? '12px' : '16px' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: isMobile ? '8px' : '12px' }}>
                <div>
                  <p style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: '600' }} className="text-gray-900 dark:text-white">
                    {isCargo ? listing.shipper : listing.trucker}
                  </p>
                  {!isCargo && listing.truckerRating > 0 && (
                    <div className="flex items-center text-gray-600 dark:text-gray-400" style={{ gap: '4px', fontSize: isMobile ? '12px' : '14px', marginTop: '2px' }}>
                      <Star style={{ width: isMobile ? '12px' : '14px', height: isMobile ? '12px' : '14px', color: '#eab308', fill: '#eab308' }} />
                      <span>{listing.truckerRating}</span>
                    </div>
                  )}
                </div>
                <Badge variant="gradient-orange" style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: 'bold', padding: isMobile ? '6px 12px' : '8px 16px' }}>
                  {formatPrice(listing.askingPrice || listing.askingRate)}
                </Badge>
              </div>

              <div style={{ fontSize: isMobile ? '12px' : '14px' }} className="text-gray-600 dark:text-gray-400">
                <div className="flex items-center" style={{ gap: isMobile ? '6px' : '8px', marginBottom: '4px' }}>
                  <MapPin style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px', color: '#10b981' }} />
                  <span style={{ fontWeight: '500' }}>{listing.origin}</span>
                </div>
                {listing.originStreetAddress && (
                  <p style={{ fontSize: isMobile ? '11px' : '12px', marginLeft: isMobile ? '20px' : '24px', marginBottom: isMobile ? '6px' : '8px', color: '#9ca3af' }}>
                    {listing.originStreetAddress}
                  </p>
                )}

                <div className="flex items-center justify-center" style={{ gap: '4px', margin: isMobile ? '4px 0' : '8px 0' }}>
                  <span className="text-gray-300 dark:text-gray-600">{'->'}</span>
                </div>

                <div className="flex items-center" style={{ gap: isMobile ? '6px' : '8px', marginBottom: '4px' }}>
                  <MapPin style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px', color: '#ef4444' }} />
                  <span style={{ fontWeight: '500' }}>{listing.destination}</span>
                </div>
                {listing.destinationStreetAddress && (
                  <p style={{ fontSize: isMobile ? '11px' : '12px', marginLeft: isMobile ? '20px' : '24px', color: '#9ca3af' }}>
                    {listing.destinationStreetAddress}
                  </p>
                )}
              </div>

              {isCargo && (
                <div style={{ marginTop: isMobile ? '6px' : '8px', fontSize: isMobile ? '12px' : '14px' }} className="text-gray-600 dark:text-gray-400">
                  <span style={{ fontWeight: '500' }}>{listing.weight} {listing.unit}</span>
                  {listing.cargoType && <span> - {listing.cargoType}</span>}
                </div>
              )}
            </div>
          </div>

          {/* Bid Form */}
          <div style={{ paddingTop: isMobile ? '16px' : '20px', paddingBottom: isMobile ? '16px' : '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '12px' : '16px' }}>
              {/* Bid Amount */}
              <div>
                <label style={{ fontSize: isMobile ? '11px' : '12px', fontWeight: '500', marginBottom: '6px', display: 'block' }} className="text-gray-700 dark:text-gray-300">
                  Your {isCargo ? 'Bid' : 'Offer'} Amount
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder={listing.askingPrice || listing.askingRate || '0'}
                    value={bidAmount}
                    onChange={(e) => {
                      setBidAmount(e.target.value);
                      if (errors.bidAmount) setErrors(prev => ({ ...prev, bidAmount: null }));
                    }}
                    className={cn("text-lg font-semibold", errors.bidAmount && "border-red-500")}
                    style={{ fontSize: isMobile ? '16px' : '18px' }}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                    PHP
                  </span>
                </div>
                {errors.bidAmount && <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#ef4444', marginTop: '4px' }}>{errors.bidAmount}</p>}

                {/* Quick bid buttons */}
                <div className="flex" style={{ gap: isMobile ? '6px' : '8px', marginTop: isMobile ? '6px' : '8px' }}>
                  {[
                    listing.askingPrice || listing.askingRate,
                    Math.round((listing.askingPrice || listing.askingRate) * 0.95),
                    Math.round((listing.askingPrice || listing.askingRate) * 0.9),
                  ].filter(Boolean).map((amount, idx) => (
                    <button
                      key={idx}
                      onClick={() => setBidAmount(String(amount))}
                      className={cn(
                        "flex-1 rounded-lg font-medium transition-all duration-300 hover:scale-105 active:scale-95",
                        bidAmount === String(amount)
                          ? "bg-gradient-to-br from-orange-100 to-orange-200 text-orange-700 dark:from-orange-900/30 dark:to-orange-800/30 dark:text-orange-400 shadow-sm"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                      )}
                      style={{ padding: isMobile ? '6px 8px' : '8px 10px', fontSize: isMobile ? '11px' : '12px' }}
                    >
                      {formatPrice(amount)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cargo Details - For shipper booking truck */}
              {isShipper && !isCargo && (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '10px' : '12px' }}>
                  <div>
                    <label style={{ fontSize: isMobile ? '11px' : '12px', fontWeight: '500', marginBottom: '6px', display: 'block' }} className="text-gray-700 dark:text-gray-300">
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
                      style={{ fontSize: isMobile ? '13px' : '14px' }}
                    />
                    {errors.cargoType && <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#ef4444', marginTop: '4px' }}>{errors.cargoType}</p>}
                  </div>
                  <div>
                    <label style={{ fontSize: isMobile ? '11px' : '12px', fontWeight: '500', marginBottom: '6px', display: 'block' }} className="text-gray-700 dark:text-gray-300">
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
                      style={{ fontSize: isMobile ? '13px' : '14px' }}
                    />
                    {errors.cargoWeight && <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#ef4444', marginTop: '4px' }}>{errors.cargoWeight}</p>}
                  </div>
                </div>
              )}

              {/* Message */}
              <div>
                <label style={{ fontSize: isMobile ? '11px' : '12px', fontWeight: '500', marginBottom: '6px', display: 'block' }} className="text-gray-700 dark:text-gray-300">
                  Message (Optional)
                </label>
                <Textarea
                  placeholder="Add a note to your bid..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="min-h-[60px]"
                  style={{ fontSize: isMobile ? '13px' : '14px' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Fixed Action Buttons - Outside scrollable area */}
        <div className="dialog-fixed-footer flex-shrink-0 border-t border-gray-200 dark:border-gray-700 bg-background flex gap-3" style={{ padding: isMobile ? '16px' : '20px' }}>
          <Button
            variant="ghost"
            size={isMobile ? "default" : "lg"}
            onClick={handleClose}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            variant="gradient"
            size={isMobile ? "default" : "lg"}
            onClick={handleSubmit}
            disabled={loading || !canPlaceBid}
            className="flex-1"
          >
            {loading ? 'Submitting...' : isSuspended ? 'Account Suspended' : !listingAllowsBid ? 'Bidding Closed' : `Submit ${isCargo ? 'Bid' : 'Offer'}`}
          </Button>
        </div>
      </DialogBottomSheet>
    </Dialog>
  );
}

export default BidModal;

