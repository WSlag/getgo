import React, { useState } from 'react';
import {
  FileText,
  MapPin,
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  Truck,
  Package,
  User,
  Phone,
  Mail,
  PenTool,
  AlertCircle,
} from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';

export function ContractModal({
  open,
  onClose,
  contract,
  currentUser,
  onSign,
  onComplete,
  loading = false,
}) {
  const [confirmSign, setConfirmSign] = useState(false);

  if (!contract) return null;

  const bid = contract.Bid || contract.bid;
  const listing = bid?.CargoListing || bid?.TruckListing || bid?.cargoListing || bid?.truckListing;
  const isCargo = !!(bid?.CargoListing || bid?.cargoListing);

  // Determine participants
  const listingOwner = isCargo
    ? (bid?.CargoListing?.shipper || bid?.cargoListing?.shipper)
    : (bid?.TruckListing?.trucker || bid?.truckListing?.trucker);
  const bidder = bid?.bidder;

  // Determine current user's role in this contract
  const isListingOwner = currentUser?.id === listing?.userId;
  const isBidder = currentUser?.id === bid?.bidderId;

  // For cargo listing: shipper=listing owner, trucker=bidder
  // For truck listing: trucker=listing owner, shipper=bidder
  const isShipper = isCargo ? isListingOwner : isBidder;
  const isTrucker = isCargo ? isBidder : isListingOwner;

  const hasUserSigned = isShipper ? !!contract.shipperSignature : !!contract.truckerSignature;
  const otherPartySigned = isShipper ? !!contract.truckerSignature : !!contract.shipperSignature;
  const fullyExecuted = contract.status === 'signed' || contract.status === 'completed';

  const formatPrice = (price) => {
    if (!price) return '---';
    return `₱${Number(price).toLocaleString()}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '---';
    return new Date(dateStr).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const statusStyles = {
    draft: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
    signed: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    completed: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    disputed: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    cancelled: 'bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300',
  };

  const handleSign = () => {
    if (!confirmSign) {
      setConfirmSign(true);
      return;
    }
    onSign?.(contract.id);
    setConfirmSign(false);
  };

  const handleClose = () => {
    setConfirmSign(false);
    onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto backdrop-blur-sm">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <FileText className="size-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl">Contract #{contract.contractNumber}</DialogTitle>
              <DialogDescription>
                {isCargo ? 'Cargo Transport Agreement' : 'Truck Booking Agreement'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Status Badge */}
        <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
          <Badge className={cn("uppercase tracking-wide", statusStyles[contract.status])} style={{ padding: '6px 12px', fontSize: '11px' }}>
            {contract.status}
          </Badge>
          <div className="text-right">
            <p className="text-xs text-gray-500">Contract Value</p>
            <p className="text-xl font-bold text-green-600 dark:text-green-400">
              {formatPrice(contract.agreedPrice)}
            </p>
          </div>
        </div>

        {/* Route Info */}
        <div className="py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-100 dark:bg-gray-800/60">
            <div className="flex items-center gap-2 flex-1">
              <MapPin className="size-5 text-green-500" />
              <span className="font-medium text-gray-900 dark:text-white">{listing?.origin}</span>
            </div>
            <span className="text-gray-400">→</span>
            <div className="flex items-center gap-2 flex-1">
              <MapPin className="size-5 text-red-500" />
              <span className="font-medium text-gray-900 dark:text-white">{listing?.destination}</span>
            </div>
          </div>
        </div>

        {/* Parties Involved */}
        <div className="py-4 border-b border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Parties</h4>

          {/* Shipper */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 mb-2">
            <div className="size-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
              <Package className="size-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500">Shipper</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {isCargo ? listingOwner?.name : bidder?.name}
              </p>
            </div>
            {(isCargo ? contract.shipperSignature : contract.truckerSignature) ? (
              <CheckCircle2 className="size-5 text-green-500" />
            ) : (
              <Clock className="size-5 text-yellow-500" />
            )}
          </div>

          {/* Trucker */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
            <div className="size-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
              <Truck className="size-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500">Trucker</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {isCargo ? bidder?.name : listingOwner?.name}
              </p>
            </div>
            {(isCargo ? contract.truckerSignature : contract.shipperSignature) ? (
              <CheckCircle2 className="size-5 text-green-500" />
            ) : (
              <Clock className="size-5 text-yellow-500" />
            )}
          </div>
        </div>

        {/* Contact Info - Only shown when contract is signed */}
        {fullyExecuted && (
          <div className="py-4 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Contact Information
            </h4>
            <div className="space-y-2">
              {/* Show other party's contact */}
              {!isListingOwner && listingOwner && !listingOwner.contactMasked && (
                <div className="flex items-center gap-3 p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
                  <Phone className="size-4 text-green-600" />
                  <span className="text-sm text-gray-900 dark:text-white">{listingOwner.phone}</span>
                </div>
              )}
              {!isBidder && bidder && !bidder.contactMasked && (
                <div className="flex items-center gap-3 p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
                  <Phone className="size-4 text-green-600" />
                  <span className="text-sm text-gray-900 dark:text-white">{bidder.phone}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Fee Breakdown */}
        <div className="py-4 border-b border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Financial Details</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Agreed Price</span>
              <span className="font-medium text-gray-900 dark:text-white">{formatPrice(contract.agreedPrice)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Platform Fee (3%)</span>
              <span className="font-medium text-red-600 dark:text-red-400">-{formatPrice(contract.platformFee)}</span>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
              <div className="flex justify-between text-sm font-bold">
                <span className="text-gray-900 dark:text-white">Net Amount</span>
                <span className="text-green-600 dark:text-green-400">
                  {formatPrice(Number(contract.agreedPrice) - Number(contract.platformFee))}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Terms */}
        {contract.terms && (
          <div className="py-4 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Terms</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">{contract.terms}</p>
          </div>
        )}

        {/* Shipment Tracking */}
        {contract.shipment && (
          <div className="py-4 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Shipment Tracking</h4>
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <div className="flex items-center gap-2">
                <Truck className="size-5 text-blue-600" />
                <span className="font-mono text-sm text-blue-700 dark:text-blue-300">
                  {contract.shipment.trackingNumber}
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Status: <span className="font-medium capitalize">{contract.shipment.status?.replace('_', ' ')}</span>
              </p>
              {contract.shipment.currentLocation && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Current Location: {contract.shipment.currentLocation}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Sign Confirmation Warning */}
        {confirmSign && (
          <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-start gap-3">
              <AlertCircle className="size-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-200">Confirm Signature</p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  By signing this contract, you agree to the terms and conditions. This action cannot be undone.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <DialogFooter className="gap-2 pt-4">
          {contract.status === 'draft' && !hasUserSigned && (
            <Button
              variant={confirmSign ? "destructive" : "gradient"}
              onClick={handleSign}
              disabled={loading}
              className="gap-2"
            >
              <PenTool className="size-4" />
              {loading ? 'Signing...' : confirmSign ? 'Confirm Signature' : 'Sign Contract'}
            </Button>
          )}

          {contract.status === 'draft' && hasUserSigned && !otherPartySigned && (
            <Badge variant="outline" className="text-sm py-2 px-4">
              <Clock className="size-4 mr-2" />
              Waiting for other party to sign
            </Badge>
          )}

          {contract.status === 'signed' && isListingOwner && (
            <Button
              variant="gradient"
              onClick={() => onComplete?.(contract.id)}
              disabled={loading}
              className="gap-2"
            >
              <CheckCircle2 className="size-4" />
              {loading ? 'Processing...' : 'Mark as Delivered'}
            </Button>
          )}

          {contract.status === 'completed' && (
            <Badge variant="outline" className="text-sm py-2 px-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300">
              <CheckCircle2 className="size-4 mr-2" />
              Contract Completed
            </Badge>
          )}

          <Button variant="ghost" onClick={handleClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ContractModal;
