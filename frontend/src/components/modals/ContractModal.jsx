import React, { useEffect, useState } from 'react';
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
  Upload,
  XCircle,
} from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { useMediaQuery } from '@/hooks/useMediaQuery';

const TRUCKER_CANCELLATION_REASON_OPTIONS = [
  { value: 'vehicle_breakdown', label: 'Vehicle breakdown' },
  { value: 'emergency_health', label: 'Emergency/Health' },
  { value: 'route_safety_risk', label: 'Route/Safety risk' },
  { value: 'schedule_conflict', label: 'Schedule conflict' },
  { value: 'payment_terms_issue', label: 'Payment/Terms issue' },
  { value: 'other', label: 'Other' },
];

export function ContractModal({
  open,
  onClose,
  contract,
  currentUser,
  truckerProfile,
  truckerCompliance,
  onSign,
  onCancel,
  onComplete,
  onPayPlatformFee,
  onUploadTruckerDocument,
  loading = false,
  darkMode = false,
}) {
  const [confirmSign, setConfirmSign] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showFullTerms, setShowFullTerms] = useState(false);
  const [acknowledgedLiability, setAcknowledgedLiability] = useState(false);
  const [cancelReasonCode, setCancelReasonCode] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [truckPlateNumber, setTruckPlateNumber] = useState('');
  const [uploadingDocType, setUploadingDocType] = useState('');
  const isMobile = useMediaQuery('(max-width: 1023px)');

  useEffect(() => {
    setTruckPlateNumber(contract?.vehiclePlateNumber || '');
    setCancelReasonCode('');
    setCancelError('');
    setConfirmCancel(false);
  }, [contract?.id, contract?.vehiclePlateNumber]);

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
  const docsRequiredOnSigning = truckerCompliance?.docsRequiredOnSigning !== false;
  const hasDriverCopy = Boolean(truckerProfile?.driverLicenseCopy?.url);
  const hasLtoCopy = Boolean(truckerProfile?.ltoRegistrationCopy?.url);
  const missingRequiredDocs = [];
  if (docsRequiredOnSigning && !hasDriverCopy) missingRequiredDocs.push('Driver License Copy');
  if (docsRequiredOnSigning && !hasLtoCopy) missingRequiredDocs.push('LTO Certificate of Registration Copy');
  const requiresPlateInput = isTrucker && !contract.vehiclePlateNumber;
  const canCancelContract = isTrucker && ['draft', 'signed'].includes(String(contract.status || '').toLowerCase());

  const formatPrice = (price) => {
    if (!price) return '---';
    return `PHP ${Number(price).toLocaleString()}`;
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
    const signPayload = {};
    if (requiresPlateInput && truckPlateNumber.trim()) {
      signPayload.truckPlateNumber = truckPlateNumber.trim();
    }
    onSign?.(contract.id, signPayload);
    setConfirmSign(false);
    setAcknowledgedLiability(false);
  };

  const handleCancelContract = () => {
    if (!cancelReasonCode) {
      setCancelError('Please select a cancellation reason.');
      return;
    }
    onCancel?.(contract.id, { reasonCode: cancelReasonCode });
    setConfirmCancel(false);
    setCancelReasonCode('');
    setCancelError('');
  };

  const handleUploadDoc = async (docType, event) => {
    const file = event?.target?.files?.[0];
    if (!file || !onUploadTruckerDocument) return;
    try {
      setUploadingDocType(docType);
      await onUploadTruckerDocument(docType, file);
    } finally {
      setUploadingDocType('');
      if (event?.target) {
        event.target.value = '';
      }
    }
  };

  const handleClose = () => {
    setConfirmSign(false);
    setConfirmCancel(false);
    setCancelReasonCode('');
    setCancelError('');
    setAcknowledgedLiability(false);
    setShowFullTerms(false);
    setTruckPlateNumber(contract?.vehiclePlateNumber || '');
    onClose?.();
  };

  const hasDeclaredCargoValue = Number(contract.declaredCargoValue) > 0;
  const liabilityCap = hasDeclaredCargoValue ? Number(contract.declaredCargoValue) : 100000;
  const liabilityCapLabel = hasDeclaredCargoValue
    ? `Declared Value of ${formatPrice(liabilityCap)}`
    : `default cap of ${formatPrice(liabilityCap)} (no declared value)`;
  const netAmount = Number(contract.agreedPrice) - Number(contract.platformFee);
  const formatPercent = (percent) =>
    Number(percent).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  const configuredFeePercent = Number(contract.platformFeePercentage);
  const effectiveFeePercent = Number(contract.agreedPrice) > 0
    ? (Number(contract.platformFee || 0) / Number(contract.agreedPrice)) * 100
    : null;
  const feePercentForLabel = Number.isFinite(configuredFeePercent) && configuredFeePercent >= 0
    ? configuredFeePercent
    : (Number.isFinite(effectiveFeePercent) ? effectiveFeePercent : null);
  const platformFeeLabel = feePercentForLabel === null
    ? 'Platform Service Fee'
    : `Platform Service Fee (${formatPercent(feePercentForLabel)}%)`;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogBottomSheet className="max-w-2xl backdrop-blur-sm">
        <div style={{ padding: isMobile ? '16px' : '24px' }}>
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
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700" style={{ paddingTop: isMobile ? '16px' : '20px', paddingBottom: isMobile ? '16px' : '20px', marginTop: isMobile ? '12px' : '16px' }}>
          <Badge className={cn("uppercase tracking-wide", statusStyles[contract.status])} style={{ padding: isMobile ? '4px 10px' : '6px 12px', fontSize: isMobile ? '11px' : '12px' }}>
            {contract.status?.replace('_', ' ')}
          </Badge>
          <div className="text-right">
            <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#6b7280' }}>Contract Value</p>
            <p style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: 'bold', color: '#10b981' }}>
              {formatPrice(contract.agreedPrice)}
            </p>
          </div>
        </div>


        {/* Route Info */}
        <div className="border-b border-gray-200 dark:border-gray-700" style={{ paddingTop: isMobile ? '16px' : '20px', paddingBottom: isMobile ? '16px' : '20px' }}>
          <h4 style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: '600', color: darkMode ? '#d1d5db' : '#374151', marginBottom: isMobile ? '8px' : '12px' }} className="flex items-center gap-1.5">
            <MapPin style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px' }} /> Route Information
          </h4>
          <div className="flex items-center rounded-xl bg-gray-100 dark:bg-gray-800/60" style={{ gap: isMobile ? '8px' : '12px', padding: isMobile ? '10px' : '12px' }}>
            <div className="flex items-center flex-1" style={{ gap: isMobile ? '6px' : '8px', minWidth: 0 }}>
              <MapPin style={{ width: isMobile ? '18px' : '20px', height: isMobile ? '18px' : '20px', color: '#10b981', flexShrink: 0 }} />
              <div className="flex-1" style={{ minWidth: 0 }}>
                <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#6b7280' }}>Pickup</p>
                <span style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: '500', color: darkMode ? '#fff' : '#111827', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {contract.pickupAddress || listing?.origin}
                </span>
                {contract.pickupStreetAddress && (
                  <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#6b7280', marginTop: '2px' }}>{contract.pickupCity}</p>
                )}
              </div>
            </div>
            <span style={{ fontSize: isMobile ? '14px' : '16px', color: '#9ca3af', flexShrink: 0 }}>{'->'}</span>
            <div className="flex items-center flex-1" style={{ gap: isMobile ? '6px' : '8px', minWidth: 0 }}>
              <MapPin style={{ width: isMobile ? '18px' : '20px', height: isMobile ? '18px' : '20px', color: '#ef4444', flexShrink: 0 }} />
              <div className="flex-1" style={{ minWidth: 0 }}>
                <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#6b7280' }}>Delivery</p>
                <span style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: '500', color: darkMode ? '#fff' : '#111827', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {contract.deliveryAddress || listing?.destination}
                </span>
                {contract.deliveryStreetAddress && (
                  <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#6b7280', marginTop: '2px' }}>{contract.deliveryCity}</p>
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
        <div className="border-b border-gray-200 dark:border-gray-700" style={{ paddingTop: isMobile ? '16px' : '20px', paddingBottom: isMobile ? '16px' : '20px' }}>
          <h4 style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: '600', color: darkMode ? '#d1d5db' : '#374151', marginBottom: isMobile ? '8px' : '12px' }} className="flex items-center gap-1.5">
            <Package style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px' }} /> Cargo Information
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '8px' : '12px' }}>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50" style={{ padding: isMobile ? '10px' : '12px' }}>
              <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#6b7280' }}>Cargo Type</p>
              <p style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: '500', color: darkMode ? '#fff' : '#111827' }}>{contract.cargoType || listing?.cargoType || 'General'}</p>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50" style={{ padding: isMobile ? '10px' : '12px' }}>
              <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#6b7280' }}>Weight</p>
              <p style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: '500', color: darkMode ? '#fff' : '#111827' }}>
                {contract.cargoWeight || listing?.weight || '---'} {contract.cargoWeightUnit || listing?.weightUnit || 'tons'}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50" style={{ padding: isMobile ? '10px' : '12px' }}>
              <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#6b7280' }}>Vehicle Type</p>
              <p style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: '500', color: darkMode ? '#fff' : '#111827' }}>{contract.vehicleType || listing?.vehicleNeeded || listing?.vehicleType || '---'}</p>
            </div>
            <div className="rounded-lg bg-orange-50 dark:bg-orange-900/20" style={{ padding: isMobile ? '10px' : '12px' }}>
              <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#ea580c' }}>
                {hasDeclaredCargoValue ? 'Declared Value (Max Liability)' : 'Default Liability Cap (No Declared Value)'}
              </p>
              <p style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: 'bold', color: '#c2410c' }}>{formatPrice(liabilityCap)}</p>
            </div>
          </div>
          {contract.cargoDescription && (
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50" style={{ marginTop: isMobile ? '8px' : '12px', padding: isMobile ? '10px' : '12px' }}>
              <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#6b7280' }}>Description</p>
              <p style={{ fontSize: isMobile ? '12px' : '13px', color: darkMode ? '#d1d5db' : '#374151' }}>{contract.cargoDescription}</p>
            </div>
          )}
          {contract.specialInstructions && (
            <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20" style={{ marginTop: isMobile ? '6px' : '8px', padding: isMobile ? '10px' : '12px' }}>
              <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#ca8a04' }}>Special Instructions</p>
              <p style={{ fontSize: isMobile ? '12px' : '13px', color: '#a16207' }}>{contract.specialInstructions}</p>
            </div>
          )}
        </div>

        {/* Parties Involved */}
        <div className="border-b border-gray-200 dark:border-gray-700" style={{ paddingTop: isMobile ? '16px' : '20px', paddingBottom: isMobile ? '16px' : '20px' }}>
          <h4 style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: '600', color: darkMode ? '#d1d5db' : '#374151', marginBottom: isMobile ? '8px' : '12px' }} className="flex items-center gap-1.5">
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
              <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#6b7280' }}>Shipper (First Party)</p>
              <p style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: '500', color: darkMode ? '#fff' : '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shipperInfo?.name}</p>
              {shipperInfo?.phone && (
                <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#6b7280', marginTop: '4px' }} className="flex items-center gap-1">
                  <Phone style={{ width: '12px', height: '12px' }} /> {shipperInfo.phone}
                </p>
              )}
            </div>
            <div className="text-right" style={{ flexShrink: 0 }}>
              {contract.shipperSignature ? (
                <div className="flex items-center text-green-600" style={{ gap: isMobile ? '4px' : '6px' }}>
                  <CheckCircle2 style={{ width: isMobile ? '18px' : '20px', height: isMobile ? '18px' : '20px' }} />
                  <div style={{ fontSize: isMobile ? '11px' : '12px' }}>
                    <p>Signed</p>
                    <p className="text-gray-400">{formatDateTime(contract.shipperSignedAt)}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center text-yellow-600" style={{ gap: '4px' }}>
                  <Clock style={{ width: isMobile ? '18px' : '20px', height: isMobile ? '18px' : '20px' }} />
                  <span style={{ fontSize: isMobile ? '11px' : '12px' }}>Pending</span>
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
              <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#6b7280' }}>Trucker (Second Party)</p>
              <p style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: '500', color: darkMode ? '#fff' : '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{truckerInfo?.name}</p>
              {truckerInfo?.phone && (
                <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#6b7280', marginTop: '4px' }} className="flex items-center gap-1">
                  <Phone style={{ width: '12px', height: '12px' }} /> {truckerInfo.phone}
                </p>
              )}
              {contract.vehiclePlateNumber && (
                <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#6b7280' }}>Plate: {contract.vehiclePlateNumber}</p>
              )}
            </div>
            <div className="text-right" style={{ flexShrink: 0 }}>
              {contract.truckerSignature ? (
                <div className="flex items-center text-green-600" style={{ gap: isMobile ? '4px' : '6px' }}>
                  <CheckCircle2 style={{ width: isMobile ? '18px' : '20px', height: isMobile ? '18px' : '20px' }} />
                  <div style={{ fontSize: isMobile ? '11px' : '12px' }}>
                    <p>Signed</p>
                    <p className="text-gray-400">{formatDateTime(contract.truckerSignedAt)}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center text-yellow-600" style={{ gap: '4px' }}>
                  <Clock style={{ width: isMobile ? '18px' : '20px', height: isMobile ? '18px' : '20px' }} />
                  <span style={{ fontSize: isMobile ? '11px' : '12px' }}>Pending</span>
                </div>
              )}
            </div>
          </div>

          {/* Platform Disclaimer */}
          <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800" style={{ marginTop: isMobile ? '8px' : '12px', padding: isMobile ? '8px' : '12px' }}>
            <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#1d4ed8' }} className="flex items-center gap-1">
              <Info style={{ width: '12px', height: '12px', flexShrink: 0 }} />
              <span><strong>Karga</strong> is a technology platform facilitating this connection. Karga is NOT a party to this contract.</span>
            </p>
          </div>
        </div>

        {/* Financial Details */}
        <div className="border-b border-gray-200 dark:border-gray-700" style={{ paddingTop: isMobile ? '16px' : '20px', paddingBottom: isMobile ? '16px' : '20px' }}>
          <h4 style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: '600', color: darkMode ? '#d1d5db' : '#374151', marginBottom: isMobile ? '8px' : '12px' }} className="flex items-center gap-1.5">
            <PesoIcon style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px' }} /> Financial Terms
          </h4>
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50" style={{ padding: isMobile ? '10px' : '12px' }}>
            <div className="flex justify-between" style={{ fontSize: isMobile ? '12px' : '13px', marginBottom: isMobile ? '6px' : '8px' }}>
              <span style={{ color: '#6b7280' }}>Agreed Freight Rate</span>
              <span style={{ fontWeight: '500', color: darkMode ? '#fff' : '#111827' }}>{formatPrice(contract.agreedPrice)}</span>
            </div>
            {/* Platform Service Fee - Only visible to Trucker */}
            {isTrucker && (
              <div className="flex justify-between" style={{ fontSize: isMobile ? '12px' : '13px', marginBottom: isMobile ? '6px' : '8px' }}>
                <span style={{ color: '#6b7280' }}>{platformFeeLabel}</span>
                <span style={{ fontWeight: '500', color: '#dc2626' }}>-{formatPrice(contract.platformFee)}</span>
              </div>
            )}
            {/* Net to Trucker - Only visible to Trucker */}
            {isTrucker && (
              <div className="border-t border-gray-200 dark:border-gray-700" style={{ paddingTop: isMobile ? '6px' : '8px', marginTop: isMobile ? '6px' : '8px' }}>
                <div className="flex justify-between" style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: 'bold' }}>
                  <span style={{ color: darkMode ? '#fff' : '#111827' }}>Net to Trucker</span>
                  <span style={{ color: '#10b981' }}>{formatPrice(netAmount)}</span>
                </div>
              </div>
            )}
          </div>
          <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#6b7280', marginTop: isMobile ? '6px' : '8px' }} className="flex items-center gap-1">
            <Shield style={{ width: '12px', height: '12px' }} />
            Platform service fee is paid by the trucker via GCash. Freight payment is settled directly between shipper and trucker.
          </p>
        </div>

        {/* Platform Fee Payment Section - For Truckers Only */}
        {!contract.platformFeePaid && isTrucker && (
          <div className="border-b border-gray-200 dark:border-gray-700" style={{ paddingTop: isMobile ? '16px' : '20px', paddingBottom: isMobile ? '16px' : '20px' }}>
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
                      <span> - Due: {formatDate(contract.platformFeeDueDate)}</span>
                    )}
                  </p>
                  {contract.platformFeeStatus === 'overdue' && (
                    <p style={{
                      fontSize: isMobile ? '11px' : '12px',
                      color: '#991b1b',
                      marginTop: '4px',
                      fontWeight: '500'
                    }}>
                      Warning: New job creation and contract signing may be restricted if unpaid debt reaches PHP 15,000.
                    </p>
                  )}
                  <Button
                    variant="gradient"
                    size={isMobile ? "sm" : "default"}
                    onClick={() => onPayPlatformFee?.({ contractId: contract.id })}
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
        <div className="border-b border-gray-200 dark:border-gray-700" style={{ paddingTop: isMobile ? '16px' : '20px', paddingBottom: isMobile ? '16px' : '20px' }}>
          <h4 style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: '600', color: darkMode ? '#d1d5db' : '#374151', marginBottom: isMobile ? '8px' : '12px' }} className="flex items-center gap-1.5">
            <Scale style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px' }} /> Key Contract Terms
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '8px' : '12px' }}>
            {/* Liability */}
            <div className="rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800" style={{ padding: isMobile ? '10px' : '12px' }}>
              <div className="flex items-start" style={{ gap: isMobile ? '6px' : '8px' }}>
                <Shield style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px', color: '#ea580c', marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: isMobile ? '12px' : '13px', fontWeight: '500', color: '#c2410c' }}>Liability Limitation</p>
                  <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#c2410c', marginTop: '4px' }}>
                    Maximum trucker liability for loss/damage is limited to the <strong>{liabilityCapLabel}</strong>.
                    For cargo above PHP 100,000, full value declaration before pickup is recommended.
                  </p>
                </div>
              </div>
            </div>

            {/* Exceptions */}
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50" style={{ padding: isMobile ? '10px' : '12px' }}>
              <p style={{ fontSize: isMobile ? '12px' : '13px', fontWeight: '500', color: darkMode ? '#d1d5db' : '#374151', marginBottom: isMobile ? '4px' : '6px' }}>Liability Exceptions</p>
              <ul style={{ fontSize: isMobile ? '11px' : '12px', color: '#6b7280', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <li>- Cap may not apply to gross negligence, willful misconduct, fraud, theft, or illegal acts.</li>
                <li>- Carrier is not liable for force majeure, shipper fault, or inherent defect of goods.</li>
                <li>- Claims cover direct and documented loss, supported by delivery records and proof of value.</li>
              </ul>
            </div>

            {/* Dispute Resolution */}
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50" style={{ padding: isMobile ? '10px' : '12px' }}>
              <div className="flex items-start" style={{ gap: isMobile ? '6px' : '8px' }}>
                <Gavel style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px', color: '#6b7280', marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: isMobile ? '12px' : '13px', fontWeight: '500', color: darkMode ? '#d1d5db' : '#374151' }}>Dispute Resolution</p>
                  <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#6b7280', marginTop: '4px' }}>
                    Negotiation (7 days) to Mediation (14 days) to Binding Arbitration per RA 9285
                  </p>
                </div>
              </div>
            </div>

            {/* Governing Law */}
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50" style={{ padding: isMobile ? '10px' : '12px' }}>
              <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#6b7280' }}>
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
              <pre style={{ fontSize: isMobile ? '11px' : '12px', color: darkMode ? '#d1d5db' : '#374151', whiteSpace: 'pre-wrap', fontFamily: 'sans-serif' }}>
                {contract.terms}
              </pre>
            </div>
          )}
        </div>

        {/* Shipment Tracking */}
        {contract.shipment && (
          <div className="border-b border-gray-200 dark:border-gray-700" style={{ paddingTop: isMobile ? '16px' : '20px', paddingBottom: isMobile ? '16px' : '20px' }}>
            <h4 style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: '600', color: darkMode ? '#d1d5db' : '#374151', marginBottom: isMobile ? '6px' : '8px' }} className="flex items-center gap-1.5">
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

        {contract.status === 'cancelled' && (
          <div className="border-b border-gray-200 dark:border-gray-700" style={{ paddingTop: isMobile ? '16px' : '20px', paddingBottom: isMobile ? '16px' : '20px' }}>
            <h4 style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: '600', color: darkMode ? '#d1d5db' : '#374151', marginBottom: isMobile ? '8px' : '10px' }} className="flex items-center gap-1.5">
              <XCircle style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px' }} />
              Cancellation Details
            </h4>
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800" style={{ padding: isMobile ? '10px' : '12px' }}>
              <p style={{ fontSize: isMobile ? '12px' : '13px', color: '#7f1d1d' }}>
                Reason: <strong>{contract.cancellationReason || 'Not provided'}</strong>
              </p>
              {contract.cancelledByRole && (
                <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#991b1b', marginTop: '4px', textTransform: 'capitalize' }}>
                  Cancelled by: {contract.cancelledByRole}
                </p>
              )}
            </div>
          </div>
        )}

        {isTrucker && (
          <div className="border-b border-gray-200 dark:border-gray-700" style={{ paddingTop: isMobile ? '16px' : '20px', paddingBottom: isMobile ? '16px' : '20px' }}>
            <h4 style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: '600', color: darkMode ? '#d1d5db' : '#374151', marginBottom: isMobile ? '8px' : '10px' }} className="flex items-center gap-1.5">
              <FileText style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px' }} />
              Trucker Documents
            </h4>
            {docsRequiredOnSigning && missingRequiredDocs.length > 0 && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800" style={{ padding: isMobile ? '10px' : '12px', marginBottom: '10px' }}>
                <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#92400e' }}>
                  Required before signing: {missingRequiredDocs.join(', ')}
                </p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Driver License */}
              <div className="flex items-center justify-between rounded-xl border border-gray-100 dark:border-gray-700/60 bg-gray-50 dark:bg-gray-800/50" style={{ padding: isMobile ? '10px 12px' : '12px 14px' }}>
                <div className="flex items-center" style={{ gap: '10px', minWidth: 0 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '10px', flexShrink: 0,
                    background: hasDriverCopy ? 'linear-gradient(135deg, #bbf7d0, #86efac)' : 'linear-gradient(135deg, #fed7aa, #fdba74)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Upload style={{ width: 16, height: 16, color: hasDriverCopy ? '#16a34a' : '#ea580c' }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: isMobile ? '12px' : '13px', fontWeight: '600', color: darkMode ? '#fff' : '#111827' }}>Driver License Copy</p>
                    <p style={{ fontSize: isMobile ? '11px' : '12px', color: hasDriverCopy ? '#16a34a' : '#9ca3af', marginTop: '1px' }}>
                      {hasDriverCopy ? '✓ Uploaded' : 'Not yet uploaded'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center" style={{ gap: '8px', flexShrink: 0 }}>
                  {hasDriverCopy && (
                    <a
                      href={truckerProfile?.driverLicenseCopy?.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: '12px', fontWeight: '600', color: '#f97316',
                        textDecoration: 'none', padding: '5px 10px',
                        borderRadius: '8px', border: '1.5px solid #fed7aa',
                        background: '#fff7ed',
                      }}
                    >
                      View
                    </a>
                  )}
                  <label className="cursor-pointer" style={{ opacity: uploadingDocType === 'driver_license' ? 0.7 : 1 }}>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(event) => handleUploadDoc('driver_license', event)}
                      disabled={loading || uploadingDocType === 'driver_license'}
                    />
                    <span
                      className="inline-flex items-center"
                      style={{
                        gap: '5px', padding: '6px 12px', borderRadius: '9px',
                        fontSize: '12px', fontWeight: '700', color: '#fff',
                        background: uploadingDocType === 'driver_license'
                          ? '#fdba74'
                          : 'linear-gradient(135deg, #FF9A56 0%, #FF6B35 100%)',
                        boxShadow: uploadingDocType === 'driver_license' ? 'none' : '0 2px 8px rgba(249,115,22,0.35)',
                        fontFamily: 'Outfit, sans-serif',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Upload style={{ width: 12, height: 12 }} />
                      {uploadingDocType === 'driver_license' ? 'Uploading...' : (hasDriverCopy ? 'Replace' : 'Upload')}
                    </span>
                  </label>
                </div>
              </div>

              {/* LTO Registration */}
              <div className="flex items-center justify-between rounded-xl border border-gray-100 dark:border-gray-700/60 bg-gray-50 dark:bg-gray-800/50" style={{ padding: isMobile ? '10px 12px' : '12px 14px' }}>
                <div className="flex items-center" style={{ gap: '10px', minWidth: 0 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '10px', flexShrink: 0,
                    background: hasLtoCopy ? 'linear-gradient(135deg, #bbf7d0, #86efac)' : 'linear-gradient(135deg, #fed7aa, #fdba74)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Upload style={{ width: 16, height: 16, color: hasLtoCopy ? '#16a34a' : '#ea580c' }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: isMobile ? '12px' : '13px', fontWeight: '600', color: darkMode ? '#fff' : '#111827' }}>LTO Registration Copy</p>
                    <p style={{ fontSize: isMobile ? '11px' : '12px', color: hasLtoCopy ? '#16a34a' : '#9ca3af', marginTop: '1px' }}>
                      {hasLtoCopy ? '✓ Uploaded' : 'Not yet uploaded'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center" style={{ gap: '8px', flexShrink: 0 }}>
                  {hasLtoCopy && (
                    <a
                      href={truckerProfile?.ltoRegistrationCopy?.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: '12px', fontWeight: '600', color: '#f97316',
                        textDecoration: 'none', padding: '5px 10px',
                        borderRadius: '8px', border: '1.5px solid #fed7aa',
                        background: '#fff7ed',
                      }}
                    >
                      View
                    </a>
                  )}
                  <label className="cursor-pointer" style={{ opacity: uploadingDocType === 'lto_registration' ? 0.7 : 1 }}>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(event) => handleUploadDoc('lto_registration', event)}
                      disabled={loading || uploadingDocType === 'lto_registration'}
                    />
                    <span
                      className="inline-flex items-center"
                      style={{
                        gap: '5px', padding: '6px 12px', borderRadius: '9px',
                        fontSize: '12px', fontWeight: '700', color: '#fff',
                        background: uploadingDocType === 'lto_registration'
                          ? '#fdba74'
                          : 'linear-gradient(135deg, #FF9A56 0%, #FF6B35 100%)',
                        boxShadow: uploadingDocType === 'lto_registration' ? 'none' : '0 2px 8px rgba(249,115,22,0.35)',
                        fontFamily: 'Outfit, sans-serif',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Upload style={{ width: 12, height: 12 }} />
                      {uploadingDocType === 'lto_registration' ? 'Uploading...' : (hasLtoCopy ? 'Replace' : 'Upload')}
                    </span>
                  </label>
                </div>
              </div>
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

                {requiresPlateInput && (
                  <div style={{ marginTop: isMobile ? '8px' : '12px' }}>
                    <label className="text-xs font-medium text-yellow-900 dark:text-yellow-300">
                      Truck Plate Number (required)
                    </label>
                    <Input
                      type="text"
                      value={truckPlateNumber}
                      onChange={(e) => setTruckPlateNumber(e.target.value)}
                      placeholder="Enter truck plate number"
                      className="mt-1 bg-white"
                    />
                  </div>
                )}

                <label className="flex items-start cursor-pointer" style={{ gap: isMobile ? '6px' : '8px', marginTop: isMobile ? '8px' : '12px' }}>
                  <input
                    type="checkbox"
                    checked={acknowledgedLiability}
                    onChange={(e) => setAcknowledgedLiability(e.target.checked)}
                    className="mt-1 rounded border-yellow-400"
                  />
                  <span style={{ fontSize: isMobile ? '11px' : '12px', color: '#92400e' }}>
                    I acknowledge that maximum liability is based on <strong>{liabilityCapLabel}</strong>, with exceptions for gross negligence, willful misconduct, fraud, theft, and illegal acts.
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}

        </div>

        {/* Action Buttons */}
        <div className="dialog-fixed-footer border-t border-gray-200 dark:border-gray-700 bg-background flex flex-col" style={{ gap: isMobile ? '8px' : '12px', padding: isMobile ? '16px' : '20px' }}>
          {contract.status === 'draft' && !hasUserSigned && (
            <Button
              variant={confirmSign ? "destructive" : "gradient"}
              size={isMobile ? "default" : "lg"}
              onClick={handleSign}
              disabled={loading || (confirmSign && (!acknowledgedLiability || (requiresPlateInput && !truckPlateNumber.trim())))}
              className="gap-2 w-full"
            >
              <PenTool className="size-4" />
              {loading ? 'Signing...' : confirmSign ? 'Confirm & Sign Contract' : 'Sign Contract'}
            </Button>
          )}

          {canCancelContract && !confirmCancel && (
            <Button
              variant="outline"
              size={isMobile ? "default" : "lg"}
              onClick={() => setConfirmCancel(true)}
              disabled={loading}
              className="gap-2 w-full border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400"
            >
              <XCircle className="size-4" />
              Cancel Contract
            </Button>
          )}

          {canCancelContract && confirmCancel && (
            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20" style={{ padding: isMobile ? '10px' : '12px' }}>
              <p style={{ fontSize: isMobile ? '12px' : '13px', color: '#991b1b', fontWeight: 600, marginBottom: '8px' }}>
                Select cancellation reason
              </p>
              <select
                value={cancelReasonCode}
                onChange={(e) => {
                  setCancelReasonCode(e.target.value);
                  setCancelError('');
                }}
                className="w-full rounded-md border border-red-300 bg-white px-3 py-2 text-sm"
                disabled={loading}
              >
                <option value="">Select reason...</option>
                {TRUCKER_CANCELLATION_REASON_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {cancelError && (
                <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#b91c1c', marginTop: '6px' }}>{cancelError}</p>
              )}
              <div className="flex gap-2" style={{ marginTop: '10px' }}>
                <Button
                  type="button"
                  variant="destructive"
                  className="flex-1"
                  onClick={handleCancelContract}
                  disabled={loading || !cancelReasonCode}
                >
                  {loading ? 'Cancelling...' : 'Confirm Cancel'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1"
                  onClick={() => {
                    setConfirmCancel(false);
                    setCancelReasonCode('');
                    setCancelError('');
                  }}
                  disabled={loading}
                >
                  Keep Contract
                </Button>
              </div>
            </div>
          )}

          {contract.status === 'draft' && hasUserSigned && !otherPartySigned && (
            <Badge variant="outline" className="self-center" style={{ fontSize: isMobile ? '12px' : '13px', padding: isMobile ? '6px 12px' : '8px 16px' }}>
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
              className="gap-2 w-full"
            >
              <CheckCircle2 className="size-4" />
              {loading ? 'Processing...' : 'Confirm Delivery Received'}
            </Button>
          )}

          {contract.status === 'completed' && (
            <Badge variant="outline" className="self-center bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300" style={{ fontSize: isMobile ? '12px' : '13px', padding: isMobile ? '6px 12px' : '8px 16px' }}>
              <CheckCircle2 className="size-4 mr-2" />
              Contract Completed
            </Badge>
          )}

          <Button variant="ghost" size={isMobile ? "default" : "lg"} onClick={handleClose} className="w-full">
            Close
          </Button>
        </div>
      </DialogBottomSheet>
    </Dialog>
  );
}

export default ContractModal;
