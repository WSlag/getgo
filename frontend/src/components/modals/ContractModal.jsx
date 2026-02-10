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
  Info,
  User,
  Phone,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PesoIcon } from '@/components/ui/PesoIcon';
import {
  Dialog,
  DialogBottomSheet,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export function ContractModal({
  open,
  onClose,
  contract,
  currentUser,
  onSign,
  onComplete,
  onPayPlatformFee,
  loading = false,
  darkMode = false,
}) {
  const [confirmSign, setConfirmSign] = useState(false);
  const [showFullTerms, setShowFullTerms] = useState(false);
  const [acknowledgedLiability, setAcknowledgedLiability] = useState(false);
  const isMobile = useMediaQuery('(max-width: 1023px)');

  if (!contract) return null;

  const bid = contract.Bid || contract.bid;
  const listing = bid?.CargoListing || bid?.TruckListing || bid?.cargoListing || bid?.truckListing;

  // Use contract's direct fields for reliability
  const isCargo = contract.listingType === 'cargo';

  // Determine participants
  const listingOwner = isCargo
    ? (bid?.CargoListing?.shipper || bid?.cargoListing?.shipper)
    : (bid?.TruckListing?.trucker || bid?.truckListing?.trucker);
  const bidder = bid?.bidder;

  // Determine current user's role in this contract
  // Use contract's direct fields for reliability
  const isListingOwner = currentUser?.id === contract.listingOwnerId;
  const isBidder = currentUser?.id === contract.bidderId;

  // For cargo listing: shipper=listing owner, trucker=bidder
  // For truck listing: trucker=listing owner, shipper=bidder
  const isShipper = isCargo ? isListingOwner : isBidder;
  const isTrucker = isCargo ? isBidder : isListingOwner;

  const shipperInfo = isCargo ? listingOwner : bidder;
  const truckerInfo = isCargo ? bidder : listingOwner;

  const hasUserSigned = isShipper ? !!contract.shipperSignature : !!contract.truckerSignature;
  const otherPartySigned = isShipper ? !!contract.truckerSignature : !!contract.shipperSignature;
  const fullyExecuted = contract.status === 'signed' || contract.status === 'completed' || contract.status === 'in_transit';

  // Debug logging (can be removed after verification)
  console.log('ContractModal Debug:', {
    contractId: contract.id,
    currentUserId: currentUser?.id,
    listingOwnerId: contract.listingOwnerId,
    bidderId: contract.bidderId,
    isCargo,
    isListingOwner,
    isBidder,
    isShipper,
    hasUserSigned,
    otherPartySigned,
    shipperSig: contract.shipperSignature,
    truckerSig: contract.truckerSignature,
  });

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
    try {
      let date;
      // Handle Firestore Timestamp objects (direct from Firestore)
      if (dateStr.toDate && typeof dateStr.toDate === 'function') {
        date = dateStr.toDate();
      }
      // Handle Firestore Timestamp objects (from Cloud Functions - serialized as {_seconds, _nanoseconds})
      else if (dateStr._seconds !== undefined) {
        date = new Date(dateStr._seconds * 1000);
      }
      // Handle ISO strings or timestamps
      else {
        date = new Date(dateStr);
      }

      if (isNaN(date.getTime())) {
        console.warn('Invalid date:', dateStr);
        return '---';
      }

      return date.toLocaleString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      console.error('Error formatting date:', error, dateStr);
      return '---';
    }
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
      <DialogBottomSheet className="max-w-2xl backdrop-blur-sm" style={{ padding: isMobile ? '16px 24px' : undefined }}>
        <DialogHeader>
          <div className="flex items-center" style={{ gap: isMobile ? '8px' : '12px' }}>
            <div style={{
              width: isMobile ? '40px' : '48px',
              height: isMobile ? '40px' : '48px',
              borderRadius: '12px',
              background: 'linear-gradient(to bottom right, #818cf8, #4f46e5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.3)'
            }}>
              <FileText style={{ width: isMobile ? '20px' : '24px', height: isMobile ? '20px' : '24px', color: '#fff' }} />
            </div>
            <div>
              <DialogTitle style={{ fontSize: isMobile ? '16px' : '20px' }}>Contract #{contract.contractNumber}</DialogTitle>
              <DialogDescription style={{ fontSize: isMobile ? '11px' : '14px' }}>
                Karga Freight Transportation Agreement
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Status Badge */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700" style={{ paddingTop: isMobile ? '12px' : '16px', paddingBottom: isMobile ? '12px' : '16px' }}>
          <Badge className={cn("uppercase tracking-wide", statusStyles[contract.status])} style={{ padding: isMobile ? '4px 10px' : '6px 12px', fontSize: isMobile ? '9px' : '11px' }}>
            {contract.status?.replace('_', ' ')}
          </Badge>
          <div className="text-right">
            <p style={{ fontSize: isMobile ? '9px' : '10px', color: '#6b7280' }}>Contract Value</p>
            <p style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: 'bold', color: '#10b981' }}>
              {formatPrice(contract.agreedPrice)}
            </p>
          </div>
        </div>

        {/* Route Info */}
        <div className="border-b border-gray-200 dark:border-gray-700" style={{ paddingTop: isMobile ? '12px' : '16px', paddingBottom: isMobile ? '12px' : '16px' }}>
          <h4 style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: '600', color: darkMode ? '#d1d5db' : '#374151', marginBottom: isMobile ? '8px' : '12px' }} className="flex items-center" style={{ gap: '6px' }}>
            <MapPin style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px' }} /> Route Information
          </h4>
          <div className="flex items-center rounded-xl bg-gray-100 dark:bg-gray-800/60" style={{ gap: isMobile ? '8px' : '12px', padding: isMobile ? '10px' : '12px' }}>
            <div className="flex items-center flex-1" style={{ gap: isMobile ? '6px' : '8px', minWidth: 0 }}>
              <MapPin style={{ width: isMobile ? '18px' : '20px', height: isMobile ? '18px' : '20px', color: '#10b981', flexShrink: 0 }} />
              <div className="flex-1" style={{ minWidth: 0 }}>
                <p style={{ fontSize: isMobile ? '9px' : '10px', color: '#6b7280' }}>Pickup</p>
                <span style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: '500', color: darkMode ? '#fff' : '#111827', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {contract.pickupAddress || listing?.origin}
                </span>
                {contract.pickupStreetAddress && (
                  <p style={{ fontSize: isMobile ? '9px' : '10px', color: '#6b7280', marginTop: '2px' }}>{contract.pickupCity}</p>
                )}
              </div>
            </div>
            <span style={{ fontSize: isMobile ? '14px' : '16px', color: '#9ca3af', flexShrink: 0 }}>→</span>
            <div className="flex items-center flex-1" style={{ gap: isMobile ? '6px' : '8px', minWidth: 0 }}>
              <MapPin style={{ width: isMobile ? '18px' : '20px', height: isMobile ? '18px' : '20px', color: '#ef4444', flexShrink: 0 }} />
              <div className="flex-1" style={{ minWidth: 0 }}>
                <p style={{ fontSize: isMobile ? '9px' : '10px', color: '#6b7280' }}>Delivery</p>
                <span style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: '500', color: darkMode ? '#fff' : '#111827', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {contract.deliveryAddress || listing?.destination}
                </span>
                {contract.deliveryStreetAddress && (
                  <p style={{ fontSize: isMobile ? '9px' : '10px', color: '#6b7280', marginTop: '2px' }}>{contract.deliveryCity}</p>
                )}
              </div>
            </div>
          </div>
          {contract.pickupDate && (
            <div className="flex items-center" style={{ marginTop: isMobile ? '6px' : '8px', gap: isMobile ? '8px' : '12px', fontSize: isMobile ? '12px' : '14px', color: '#6b7280', flexWrap: 'wrap' }}>
              <Calendar style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px', flexShrink: 0 }} />
              <span>Pickup: {formatDate(contract.pickupDate)}</span>
              {contract.expectedDeliveryDate && (
                <span>Expected Delivery: {formatDate(contract.expectedDeliveryDate)}</span>
              )}
            </div>
          )}
        </div>

        {/* Cargo Details */}
        <div className="border-b border-gray-200 dark:border-gray-700" style={{ paddingTop: isMobile ? '12px' : '16px', paddingBottom: isMobile ? '12px' : '16px' }}>
          <h4 style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: '600', color: darkMode ? '#d1d5db' : '#374151', marginBottom: isMobile ? '8px' : '12px' }} className="flex items-center" style={{ gap: '6px' }}>
            <Package style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px' }} /> Cargo Information
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '8px' : '12px' }}>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50" style={{ padding: isMobile ? '10px' : '12px' }}>
              <p style={{ fontSize: isMobile ? '9px' : '10px', color: '#6b7280' }}>Cargo Type</p>
              <p style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: '500', color: darkMode ? '#fff' : '#111827' }}>{contract.cargoType || listing?.cargoType || 'General'}</p>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50" style={{ padding: isMobile ? '10px' : '12px' }}>
              <p style={{ fontSize: isMobile ? '9px' : '10px', color: '#6b7280' }}>Weight</p>
              <p style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: '500', color: darkMode ? '#fff' : '#111827' }}>
                {contract.cargoWeight || listing?.weight || '---'} {contract.cargoWeightUnit || listing?.weightUnit || 'tons'}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50" style={{ padding: isMobile ? '10px' : '12px' }}>
              <p style={{ fontSize: isMobile ? '9px' : '10px', color: '#6b7280' }}>Vehicle Type</p>
              <p style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: '500', color: darkMode ? '#fff' : '#111827' }}>{contract.vehicleType || listing?.vehicleNeeded || listing?.vehicleType || '---'}</p>
            </div>
            <div className="rounded-lg bg-orange-50 dark:bg-orange-900/20" style={{ padding: isMobile ? '10px' : '12px' }}>
              <p style={{ fontSize: isMobile ? '9px' : '10px', color: '#ea580c' }}>Declared Value (Max Liability)</p>
              <p style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: 'bold', color: '#c2410c' }}>{formatPrice(declaredValue)}</p>
            </div>
          </div>
          {contract.cargoDescription && (
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50" style={{ marginTop: isMobile ? '8px' : '12px', padding: isMobile ? '10px' : '12px' }}>
              <p style={{ fontSize: isMobile ? '9px' : '10px', color: '#6b7280' }}>Description</p>
              <p style={{ fontSize: isMobile ? '12px' : '13px', color: darkMode ? '#d1d5db' : '#374151' }}>{contract.cargoDescription}</p>
            </div>
          )}
          {contract.specialInstructions && (
            <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20" style={{ marginTop: isMobile ? '6px' : '8px', padding: isMobile ? '10px' : '12px' }}>
              <p style={{ fontSize: isMobile ? '9px' : '10px', color: '#ca8a04' }}>Special Instructions</p>
              <p style={{ fontSize: isMobile ? '12px' : '13px', color: '#a16207' }}>{contract.specialInstructions}</p>
            </div>
          )}
        </div>

        {/* Parties Involved */}
        <div className="border-b border-gray-200 dark:border-gray-700" style={{ paddingTop: isMobile ? '12px' : '16px', paddingBottom: isMobile ? '12px' : '16px' }}>
          <h4 style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: '600', color: darkMode ? '#d1d5db' : '#374151', marginBottom: isMobile ? '8px' : '12px' }} className="flex items-center" style={{ gap: '6px' }}>
            <User style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px' }} /> Contract Parties
          </h4>

          {/* Shipper */}
          <div className="flex items-center rounded-lg bg-gray-50 dark:bg-gray-800/50" style={{ gap: isMobile ? '8px' : '12px', padding: isMobile ? '10px' : '12px', marginBottom: isMobile ? '6px' : '8px' }}>
            <div style={{
              width: isMobile ? '36px' : '40px',
              height: isMobile ? '36px' : '40px',
              borderRadius: '50%',
              background: 'linear-gradient(to bottom right, #fb923c, #ea580c)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Package style={{ width: isMobile ? '18px' : '20px', height: isMobile ? '18px' : '20px', color: '#fff' }} />
            </div>
            <div className="flex-1" style={{ minWidth: 0 }}>
              <p style={{ fontSize: isMobile ? '9px' : '10px', color: '#6b7280' }}>Shipper (First Party)</p>
              <p style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: '500', color: darkMode ? '#fff' : '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shipperInfo?.name}</p>
              {fullyExecuted && shipperInfo?.phone && (
                <p style={{ fontSize: isMobile ? '9px' : '10px', color: '#6b7280', marginTop: '4px' }} className="flex items-center" style={{ gap: '4px' }}>
                  <Phone style={{ width: '12px', height: '12px' }} /> {shipperInfo.phone}
                </p>
              )}
            </div>
            <div className="text-right" style={{ flexShrink: 0 }}>
              {contract.shipperSignature ? (
                <div className="flex items-center text-green-600" style={{ gap: isMobile ? '4px' : '6px' }}>
                  <CheckCircle2 style={{ width: isMobile ? '18px' : '20px', height: isMobile ? '18px' : '20px' }} />
                  <div style={{ fontSize: isMobile ? '9px' : '10px' }}>
                    <p>Signed</p>
                    <p className="text-gray-400">{formatDateTime(contract.shipperSignedAt)}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center text-yellow-600" style={{ gap: '4px' }}>
                  <Clock style={{ width: isMobile ? '18px' : '20px', height: isMobile ? '18px' : '20px' }} />
                  <span style={{ fontSize: isMobile ? '9px' : '10px' }}>Pending</span>
                </div>
              )}
            </div>
          </div>

          {/* Trucker */}
          <div className="flex items-center rounded-lg bg-gray-50 dark:bg-gray-800/50" style={{ gap: isMobile ? '8px' : '12px', padding: isMobile ? '10px' : '12px' }}>
            <div style={{
              width: isMobile ? '36px' : '40px',
              height: isMobile ? '36px' : '40px',
              borderRadius: '50%',
              background: 'linear-gradient(to bottom right, #60a5fa, #2563eb)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Truck style={{ width: isMobile ? '18px' : '20px', height: isMobile ? '18px' : '20px', color: '#fff' }} />
            </div>
            <div className="flex-1" style={{ minWidth: 0 }}>
              <p style={{ fontSize: isMobile ? '9px' : '10px', color: '#6b7280' }}>Trucker (Second Party)</p>
              <p style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: '500', color: darkMode ? '#fff' : '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{truckerInfo?.name}</p>
              {fullyExecuted && truckerInfo?.phone && (
                <p style={{ fontSize: isMobile ? '9px' : '10px', color: '#6b7280', marginTop: '4px' }} className="flex items-center" style={{ gap: '4px' }}>
                  <Phone style={{ width: '12px', height: '12px' }} /> {truckerInfo.phone}
                </p>
              )}
              {contract.vehiclePlateNumber && (
                <p style={{ fontSize: isMobile ? '9px' : '10px', color: '#6b7280' }}>Plate: {contract.vehiclePlateNumber}</p>
              )}
            </div>
            <div className="text-right" style={{ flexShrink: 0 }}>
              {contract.truckerSignature ? (
                <div className="flex items-center text-green-600" style={{ gap: isMobile ? '4px' : '6px' }}>
                  <CheckCircle2 style={{ width: isMobile ? '18px' : '20px', height: isMobile ? '18px' : '20px' }} />
                  <div style={{ fontSize: isMobile ? '9px' : '10px' }}>
                    <p>Signed</p>
                    <p className="text-gray-400">{formatDateTime(contract.truckerSignedAt)}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center text-yellow-600" style={{ gap: '4px' }}>
                  <Clock style={{ width: isMobile ? '18px' : '20px', height: isMobile ? '18px' : '20px' }} />
                  <span style={{ fontSize: isMobile ? '9px' : '10px' }}>Pending</span>
                </div>
              )}
            </div>
          </div>

          {/* Platform Disclaimer */}
          <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800" style={{ marginTop: isMobile ? '8px' : '12px', padding: isMobile ? '8px' : '12px' }}>
            <p style={{ fontSize: isMobile ? '10px' : '11px', color: '#1d4ed8' }} className="flex items-center" style={{ gap: '4px' }}>
              <Info style={{ width: '12px', height: '12px', flexShrink: 0 }} />
              <span><strong>Karga</strong> is a technology platform facilitating this connection. Karga is NOT a party to this contract.</span>
            </p>
          </div>
        </div>

        {/* Financial Details */}
        <div className="border-b border-gray-200 dark:border-gray-700" style={{ paddingTop: isMobile ? '12px' : '16px', paddingBottom: isMobile ? '12px' : '16px' }}>
          <h4 style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: '600', color: darkMode ? '#d1d5db' : '#374151', marginBottom: isMobile ? '8px' : '12px' }} className="flex items-center" style={{ gap: '6px' }}>
            <PesoIcon style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px' }} /> Financial Terms
          </h4>
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50" style={{ padding: isMobile ? '10px' : '12px' }}>
            <div className="flex justify-between" style={{ fontSize: isMobile ? '12px' : '13px', marginBottom: isMobile ? '6px' : '8px' }}>
              <span style={{ color: '#6b7280' }}>Agreed Freight Rate</span>
              <span style={{ fontWeight: '500', color: darkMode ? '#fff' : '#111827' }}>{formatPrice(contract.agreedPrice)}</span>
            </div>
            <div className="flex justify-between" style={{ fontSize: isMobile ? '12px' : '13px', marginBottom: isMobile ? '6px' : '8px' }}>
              <span style={{ color: '#6b7280' }}>Platform Service Fee (5%)</span>
              <span style={{ fontWeight: '500', color: '#dc2626' }}>-{formatPrice(contract.platformFee)}</span>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700" style={{ paddingTop: isMobile ? '6px' : '8px', marginTop: isMobile ? '6px' : '8px' }}>
              <div className="flex justify-between" style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: 'bold' }}>
                <span style={{ color: darkMode ? '#fff' : '#111827' }}>Net to Trucker</span>
                <span style={{ color: '#10b981' }}>{formatPrice(netAmount)}</span>
              </div>
            </div>
          </div>
          <p style={{ fontSize: isMobile ? '10px' : '11px', color: '#6b7280', marginTop: isMobile ? '6px' : '8px' }} className="flex items-center" style={{ gap: '4px' }}>
            <Shield style={{ width: '12px', height: '12px' }} />
            Payment held in escrow until delivery confirmation
          </p>
        </div>

        {/* Platform Fee Payment Section - For Truckers Only */}
        {!contract.platformFeePaid && isTrucker && (
          <div className="border-b border-gray-200 dark:border-gray-700" style={{ paddingTop: isMobile ? '12px' : '16px', paddingBottom: isMobile ? '12px' : '16px' }}>
            <div className={cn(
              "rounded-lg border",
              contract.platformFeeStatus === 'overdue'
                ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                : "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800"
            )} style={{ padding: isMobile ? '12px' : '16px' }}>
              <div className="flex items-start" style={{ gap: isMobile ? '8px' : '12px' }}>
                <AlertCircle style={{
                  width: isMobile ? '18px' : '20px',
                  height: isMobile ? '18px' : '20px',
                  color: contract.platformFeeStatus === 'overdue' ? '#dc2626' : '#ea580c',
                  marginTop: '2px',
                  flexShrink: 0
                }} />
                <div className="flex-1">
                  <p style={{
                    fontSize: isMobile ? '13px' : '14px',
                    fontWeight: '600',
                    color: contract.platformFeeStatus === 'overdue' ? '#991b1b' : '#92400e'
                  }}>
                    {contract.platformFeeStatus === 'overdue' ? 'Platform Fee OVERDUE' : 'Platform Fee Payment Required'}
                  </p>
                  <p style={{
                    fontSize: isMobile ? '12px' : '13px',
                    color: contract.platformFeeStatus === 'overdue' ? '#991b1b' : '#a16207',
                    marginTop: '4px'
                  }}>
                    Amount: <strong>{formatPrice(contract.platformFee)}</strong>
                    {contract.platformFeeDueDate && (
                      <span> • Due: {formatDate(contract.platformFeeDueDate)}</span>
                    )}
                  </p>
                  {contract.platformFeeStatus === 'overdue' && (
                    <p style={{
                      fontSize: isMobile ? '11px' : '12px',
                      color: '#991b1b',
                      marginTop: '4px',
                      fontWeight: '500'
                    }}>
                      ⚠️ Your account may be suspended. Pay immediately to avoid restrictions.
                    </p>
                  )}
                  <Button
                    variant="gradient"
                    size={isMobile ? "sm" : "default"}
                    onClick={() => onPayPlatformFee?.(contract)}
                    disabled={loading}
                    className="gap-2 mt-3"
                    style={{ width: '100%' }}
                  >
                    <PesoIcon className="size-4" />
                    Pay Platform Fee Now
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Key Terms Summary */}
        <div className="border-b border-gray-200 dark:border-gray-700" style={{ paddingTop: isMobile ? '12px' : '16px', paddingBottom: isMobile ? '12px' : '16px' }}>
          <h4 style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: '600', color: darkMode ? '#d1d5db' : '#374151', marginBottom: isMobile ? '8px' : '12px' }} className="flex items-center" style={{ gap: '6px' }}>
            <Scale style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px' }} /> Key Contract Terms
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '8px' : '12px' }}>
            {/* Liability */}
            <div className="rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800" style={{ padding: isMobile ? '10px' : '12px' }}>
              <div className="flex items-start" style={{ gap: isMobile ? '6px' : '8px' }}>
                <Shield style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px', color: '#ea580c', marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: isMobile ? '12px' : '13px', fontWeight: '500', color: '#c2410c' }}>Liability Limitation</p>
                  <p style={{ fontSize: isMobile ? '10px' : '11px', color: '#c2410c', marginTop: '4px' }}>
                    Maximum trucker liability for loss/damage is limited to the <strong>Declared Value of {formatPrice(declaredValue)}</strong>.
                    Trucker exercises extraordinary diligence per Philippine Civil Code.
                  </p>
                </div>
              </div>
            </div>

            {/* Exceptions */}
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50" style={{ padding: isMobile ? '10px' : '12px' }}>
              <p style={{ fontSize: isMobile ? '12px' : '13px', fontWeight: '500', color: darkMode ? '#d1d5db' : '#374151', marginBottom: isMobile ? '4px' : '6px' }}>Liability Exceptions</p>
              <ul style={{ fontSize: isMobile ? '10px' : '11px', color: '#6b7280', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <li>• Force majeure (natural disasters, war, government action)</li>
                <li>• Shipper's fault (improper packaging, inaccurate declaration)</li>
                <li>• Inherent defect or natural deterioration of goods</li>
              </ul>
            </div>

            {/* Dispute Resolution */}
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50" style={{ padding: isMobile ? '10px' : '12px' }}>
              <div className="flex items-start" style={{ gap: isMobile ? '6px' : '8px' }}>
                <Gavel style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px', color: '#6b7280', marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: isMobile ? '12px' : '13px', fontWeight: '500', color: darkMode ? '#d1d5db' : '#374151' }}>Dispute Resolution</p>
                  <p style={{ fontSize: isMobile ? '10px' : '11px', color: '#6b7280', marginTop: '4px' }}>
                    Negotiation (7 days) → Mediation (14 days) → Binding Arbitration per RA 9285
                  </p>
                </div>
              </div>
            </div>

            {/* Governing Law */}
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50" style={{ padding: isMobile ? '10px' : '12px' }}>
              <p style={{ fontSize: isMobile ? '10px' : '11px', color: '#6b7280' }}>
                <strong>Governing Law:</strong> Republic of the Philippines (Civil Code, E-Commerce Act RA 8792, Data Privacy Act RA 10173)
              </p>
            </div>
          </div>

          {/* Full Terms Toggle */}
          <button
            onClick={() => setShowFullTerms(!showFullTerms)}
            className="flex items-center text-indigo-600 dark:text-indigo-400 hover:underline"
            style={{ marginTop: isMobile ? '8px' : '12px', gap: isMobile ? '4px' : '6px', fontSize: isMobile ? '12px' : '13px' }}
          >
            <ScrollText style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px' }} />
            {showFullTerms ? 'Hide' : 'View'} Full Contract Terms
            {showFullTerms ? <ChevronUp style={{ width: '14px', height: '14px' }} /> : <ChevronDown style={{ width: '14px', height: '14px' }} />}
          </button>

          {showFullTerms && (
            <div className="rounded-lg bg-gray-100 dark:bg-gray-800 max-h-60 overflow-y-auto" style={{ marginTop: isMobile ? '8px' : '12px', padding: isMobile ? '12px' : '16px' }}>
              <pre style={{ fontSize: isMobile ? '10px' : '11px', color: darkMode ? '#d1d5db' : '#374151', whiteSpace: 'pre-wrap', fontFamily: 'sans-serif' }}>
                {contract.terms}
              </pre>
            </div>
          )}
        </div>

        {/* Shipment Tracking */}
        {contract.shipment && (
          <div className="border-b border-gray-200 dark:border-gray-700" style={{ paddingTop: isMobile ? '12px' : '16px', paddingBottom: isMobile ? '12px' : '16px' }}>
            <h4 style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: '600', color: darkMode ? '#d1d5db' : '#374151', marginBottom: isMobile ? '6px' : '8px' }} className="flex items-center" style={{ gap: '6px' }}>
              <Truck style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px' }} /> Shipment Tracking
            </h4>
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20" style={{ padding: isMobile ? '10px' : '12px' }}>
              <div className="flex items-center" style={{ gap: isMobile ? '6px' : '8px' }}>
                <Truck style={{ width: isMobile ? '18px' : '20px', height: isMobile ? '18px' : '20px', color: '#2563eb' }} />
                <span style={{ fontFamily: 'monospace', fontSize: isMobile ? '12px' : '13px', color: '#1d4ed8' }}>
                  {contract.shipment.trackingNumber}
                </span>
              </div>
              <p style={{ fontSize: isMobile ? '12px' : '13px', color: '#6b7280', marginTop: '4px' }}>
                Status: <span style={{ fontWeight: '500', textTransform: 'capitalize' }}>{contract.shipment.status?.replace('_', ' ')}</span>
              </p>
              {contract.shipment.currentLocation && (
                <p style={{ fontSize: isMobile ? '12px' : '13px', color: '#6b7280' }}>
                  Current Location: {contract.shipment.currentLocation}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Sign Confirmation */}
        {confirmSign && contract.status === 'draft' && !hasUserSigned && (
          <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800" style={{ padding: isMobile ? '12px' : '16px' }}>
            <div className="flex items-start" style={{ gap: isMobile ? '8px' : '12px' }}>
              <AlertCircle style={{ width: isMobile ? '18px' : '20px', height: isMobile ? '18px' : '20px', color: '#ca8a04', marginTop: '2px', flexShrink: 0 }} />
              <div className="flex-1">
                <p style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: '500', color: '#92400e' }}>Confirm Your Signature</p>
                <p style={{ fontSize: isMobile ? '12px' : '13px', color: '#a16207', marginTop: '4px' }}>
                  By signing this contract, you agree to all terms and conditions. This action creates a legally binding agreement.
                </p>

                <label className="flex items-start cursor-pointer" style={{ gap: isMobile ? '6px' : '8px', marginTop: isMobile ? '8px' : '12px' }}>
                  <input
                    type="checkbox"
                    checked={acknowledgedLiability}
                    onChange={(e) => setAcknowledgedLiability(e.target.checked)}
                    className="mt-1 rounded border-yellow-400"
                  />
                  <span style={{ fontSize: isMobile ? '11px' : '12px', color: '#92400e' }}>
                    I acknowledge that the maximum liability for cargo loss/damage is limited to <strong>{formatPrice(declaredValue)}</strong> and I have read and agree to all contract terms.
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <DialogFooter style={{ gap: isMobile ? '8px' : '12px', paddingTop: isMobile ? '12px' : '16px' }}>
          {contract.status === 'draft' && !hasUserSigned && (
            <Button
              variant={confirmSign ? "destructive" : "gradient"}
              size={isMobile ? "default" : "lg"}
              onClick={handleSign}
              disabled={loading || (confirmSign && !acknowledgedLiability)}
              className="gap-2 flex-1"
            >
              <PenTool className="size-4" />
              {loading ? 'Signing...' : confirmSign ? 'Confirm & Sign Contract' : 'Sign Contract'}
            </Button>
          )}

          {contract.status === 'draft' && hasUserSigned && !otherPartySigned && (
            <Badge variant="outline" style={{ fontSize: isMobile ? '12px' : '13px', padding: isMobile ? '6px 12px' : '8px 16px' }}>
              <Clock className="size-4 mr-2" />
              Waiting for other party to sign
            </Badge>
          )}

          {(contract.status === 'signed' || contract.status === 'in_transit') && isShipper && (
            <Button
              variant="gradient"
              size={isMobile ? "default" : "lg"}
              onClick={() => onComplete?.(contract.id)}
              disabled={loading}
              className="gap-2 flex-1"
            >
              <CheckCircle2 className="size-4" />
              {loading ? 'Processing...' : 'Confirm Delivery Received'}
            </Button>
          )}

          {contract.status === 'completed' && (
            <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300" style={{ fontSize: isMobile ? '12px' : '13px', padding: isMobile ? '6px 12px' : '8px 16px' }}>
              <CheckCircle2 className="size-4 mr-2" />
              Contract Completed
            </Badge>
          )}

          <Button variant="ghost" size={isMobile ? "default" : "lg"} onClick={handleClose} className="w-full">
            Close
          </Button>
        </DialogFooter>
      </DialogBottomSheet>
    </Dialog>
  );
}

export default ContractModal;
