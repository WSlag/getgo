import React, { useState } from 'react';
import {
  FileText,
  MapPin,
  Calendar,
  CheckCircle2,
  Clock,
  Truck,
  Package,
  PenTool,
  AlertCircle,
  Shield,
  Scale,
  Gavel,
  ScrollText,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Info,
  User,
  Phone,
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
  const [showFullTerms, setShowFullTerms] = useState(false);
  const [acknowledgedLiability, setAcknowledgedLiability] = useState(false);

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

  const shipperInfo = isCargo ? listingOwner : bidder;
  const truckerInfo = isCargo ? bidder : listingOwner;

  const hasUserSigned = isShipper ? !!contract.shipperSignature : !!contract.truckerSignature;
  const otherPartySigned = isShipper ? !!contract.truckerSignature : !!contract.shipperSignature;
  const fullyExecuted = contract.status === 'signed' || contract.status === 'completed' || contract.status === 'in_transit';

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

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '---';
    return new Date(dateStr).toLocaleString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const statusStyles = {
    draft: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
    signed: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    in_transit: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    completed: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    disputed: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    cancelled: 'bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300',
  };

  const handleSign = () => {
    if (!confirmSign) {
      setConfirmSign(true);
      return;
    }
    if (!acknowledgedLiability && contract.status === 'draft') {
      return;
    }
    onSign?.(contract.id);
    setConfirmSign(false);
    setAcknowledgedLiability(false);
  };

  const handleClose = () => {
    setConfirmSign(false);
    setAcknowledgedLiability(false);
    setShowFullTerms(false);
    onClose?.();
  };

  const declaredValue = contract.declaredCargoValue || 100000;
  const netAmount = Number(contract.agreedPrice) - Number(contract.platformFee);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto backdrop-blur-sm">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <FileText className="size-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl">Contract #{contract.contractNumber}</DialogTitle>
              <DialogDescription>
                Karga Freight Transportation Agreement
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Status Badge */}
        <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
          <Badge className={cn("uppercase tracking-wide", statusStyles[contract.status])} style={{ padding: '6px 12px', fontSize: '11px' }}>
            {contract.status?.replace('_', ' ')}
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
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <MapPin className="size-4" /> Route Information
          </h4>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-100 dark:bg-gray-800/60">
            <div className="flex items-center gap-2 flex-1">
              <MapPin className="size-5 text-green-500" />
              <div>
                <p className="text-xs text-gray-500">Pickup</p>
                <span className="font-medium text-gray-900 dark:text-white">{contract.pickupAddress || listing?.origin}</span>
              </div>
            </div>
            <span className="text-gray-400">→</span>
            <div className="flex items-center gap-2 flex-1">
              <MapPin className="size-5 text-red-500" />
              <div>
                <p className="text-xs text-gray-500">Delivery</p>
                <span className="font-medium text-gray-900 dark:text-white">{contract.deliveryAddress || listing?.destination}</span>
              </div>
            </div>
          </div>
          {contract.pickupDate && (
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Calendar className="size-4" />
              <span>Pickup: {formatDate(contract.pickupDate)}</span>
              {contract.expectedDeliveryDate && (
                <span className="ml-4">Expected Delivery: {formatDate(contract.expectedDeliveryDate)}</span>
              )}
            </div>
          )}
        </div>

        {/* Cargo Details */}
        <div className="py-4 border-b border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Package className="size-4" /> Cargo Information
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
              <p className="text-xs text-gray-500">Cargo Type</p>
              <p className="font-medium text-gray-900 dark:text-white">{contract.cargoType || listing?.cargoType || 'General'}</p>
            </div>
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
              <p className="text-xs text-gray-500">Weight</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {contract.cargoWeight || listing?.weight || '---'} {contract.cargoWeightUnit || listing?.weightUnit || 'tons'}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
              <p className="text-xs text-gray-500">Vehicle Type</p>
              <p className="font-medium text-gray-900 dark:text-white">{contract.vehicleType || listing?.vehicleNeeded || listing?.vehicleType || '---'}</p>
            </div>
            <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20">
              <p className="text-xs text-orange-600 dark:text-orange-400">Declared Value (Max Liability)</p>
              <p className="font-bold text-orange-700 dark:text-orange-300">{formatPrice(declaredValue)}</p>
            </div>
          </div>
          {contract.cargoDescription && (
            <div className="mt-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
              <p className="text-xs text-gray-500">Description</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{contract.cargoDescription}</p>
            </div>
          )}
          {contract.specialInstructions && (
            <div className="mt-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
              <p className="text-xs text-yellow-600 dark:text-yellow-400">Special Instructions</p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">{contract.specialInstructions}</p>
            </div>
          )}
        </div>

        {/* Parties Involved */}
        <div className="py-4 border-b border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <User className="size-4" /> Contract Parties
          </h4>

          {/* Shipper */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 mb-2">
            <div className="size-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
              <Package className="size-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500">Shipper (First Party)</p>
              <p className="font-medium text-gray-900 dark:text-white">{shipperInfo?.name}</p>
              {fullyExecuted && shipperInfo?.phone && (
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                  <Phone className="size-3" /> {shipperInfo.phone}
                </p>
              )}
            </div>
            <div className="text-right">
              {contract.shipperSignature ? (
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="size-5" />
                  <div className="text-xs">
                    <p>Signed</p>
                    <p className="text-gray-400">{formatDateTime(contract.shipperSignedAt)}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-yellow-600">
                  <Clock className="size-5" />
                  <span className="text-xs">Pending</span>
                </div>
              )}
            </div>
          </div>

          {/* Trucker */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
            <div className="size-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
              <Truck className="size-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500">Trucker (Second Party)</p>
              <p className="font-medium text-gray-900 dark:text-white">{truckerInfo?.name}</p>
              {fullyExecuted && truckerInfo?.phone && (
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                  <Phone className="size-3" /> {truckerInfo.phone}
                </p>
              )}
              {contract.vehiclePlateNumber && (
                <p className="text-xs text-gray-500">Plate: {contract.vehiclePlateNumber}</p>
              )}
            </div>
            <div className="text-right">
              {contract.truckerSignature ? (
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="size-5" />
                  <div className="text-xs">
                    <p>Signed</p>
                    <p className="text-gray-400">{formatDateTime(contract.truckerSignedAt)}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-yellow-600">
                  <Clock className="size-5" />
                  <span className="text-xs">Pending</span>
                </div>
              )}
            </div>
          </div>

          {/* Platform Disclaimer */}
          <div className="mt-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-1">
              <Info className="size-3" />
              <strong>Karga</strong> is a technology platform facilitating this connection. Karga is NOT a party to this contract.
            </p>
          </div>
        </div>

        {/* Financial Details */}
        <div className="py-4 border-b border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <DollarSign className="size-4" /> Financial Terms
          </h4>
          <div className="space-y-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Agreed Freight Rate</span>
              <span className="font-medium text-gray-900 dark:text-white">{formatPrice(contract.agreedPrice)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Platform Service Fee (5%)</span>
              <span className="font-medium text-red-600 dark:text-red-400">-{formatPrice(contract.platformFee)}</span>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
              <div className="flex justify-between text-sm font-bold">
                <span className="text-gray-900 dark:text-white">Net to Trucker</span>
                <span className="text-green-600 dark:text-green-400">{formatPrice(netAmount)}</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
            <Shield className="size-3" />
            Payment held in escrow until delivery confirmation
          </p>
        </div>

        {/* Key Terms Summary */}
        <div className="py-4 border-b border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Scale className="size-4" /> Key Contract Terms
          </h4>

          <div className="space-y-3">
            {/* Liability */}
            <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
              <div className="flex items-start gap-2">
                <Shield className="size-4 text-orange-600 mt-0.5" />
                <div>
                  <p className="font-medium text-orange-800 dark:text-orange-200 text-sm">Liability Limitation</p>
                  <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                    Maximum trucker liability for loss/damage is limited to the <strong>Declared Value of {formatPrice(declaredValue)}</strong>.
                    Trucker exercises extraordinary diligence per Philippine Civil Code.
                  </p>
                </div>
              </div>
            </div>

            {/* Exceptions */}
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
              <p className="font-medium text-gray-700 dark:text-gray-300 text-sm mb-2">Liability Exceptions</p>
              <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Force majeure (natural disasters, war, government action)</li>
                <li>• Shipper's fault (improper packaging, inaccurate declaration)</li>
                <li>• Inherent defect or natural deterioration of goods</li>
              </ul>
            </div>

            {/* Dispute Resolution */}
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
              <div className="flex items-start gap-2">
                <Gavel className="size-4 text-gray-600 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-700 dark:text-gray-300 text-sm">Dispute Resolution</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Negotiation (7 days) → Mediation (14 days) → Binding Arbitration per RA 9285
                  </p>
                </div>
              </div>
            </div>

            {/* Governing Law */}
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                <strong>Governing Law:</strong> Republic of the Philippines (Civil Code, E-Commerce Act RA 8792, Data Privacy Act RA 10173)
              </p>
            </div>
          </div>

          {/* Full Terms Toggle */}
          <button
            onClick={() => setShowFullTerms(!showFullTerms)}
            className="mt-3 flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            <ScrollText className="size-4" />
            {showFullTerms ? 'Hide' : 'View'} Full Contract Terms
            {showFullTerms ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>

          {showFullTerms && (
            <div className="mt-3 p-4 rounded-lg bg-gray-100 dark:bg-gray-800 max-h-60 overflow-y-auto">
              <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans">
                {contract.terms}
              </pre>
            </div>
          )}
        </div>

        {/* Shipment Tracking */}
        {contract.shipment && (
          <div className="py-4 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <Truck className="size-4" /> Shipment Tracking
            </h4>
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

        {/* Sign Confirmation */}
        {confirmSign && contract.status === 'draft' && !hasUserSigned && (
          <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-start gap-3">
              <AlertCircle className="size-5 text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-yellow-800 dark:text-yellow-200">Confirm Your Signature</p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  By signing this contract, you agree to all terms and conditions. This action creates a legally binding agreement.
                </p>

                <label className="flex items-start gap-2 mt-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acknowledgedLiability}
                    onChange={(e) => setAcknowledgedLiability(e.target.checked)}
                    className="mt-1 rounded border-yellow-400"
                  />
                  <span className="text-sm text-yellow-800 dark:text-yellow-200">
                    I acknowledge that the maximum liability for cargo loss/damage is limited to <strong>{formatPrice(declaredValue)}</strong> and I have read and agree to all contract terms.
                  </span>
                </label>
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
              disabled={loading || (confirmSign && !acknowledgedLiability)}
              className="gap-2"
            >
              <PenTool className="size-4" />
              {loading ? 'Signing...' : confirmSign ? 'Confirm & Sign Contract' : 'Sign Contract'}
            </Button>
          )}

          {contract.status === 'draft' && hasUserSigned && !otherPartySigned && (
            <Badge variant="outline" className="text-sm py-2 px-4">
              <Clock className="size-4 mr-2" />
              Waiting for other party to sign
            </Badge>
          )}

          {(contract.status === 'signed' || contract.status === 'in_transit') && isShipper && (
            <Button
              variant="gradient"
              onClick={() => onComplete?.(contract.id)}
              disabled={loading}
              className="gap-2"
            >
              <CheckCircle2 className="size-4" />
              {loading ? 'Processing...' : 'Confirm Delivery Received'}
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
