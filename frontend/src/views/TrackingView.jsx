import React, { useMemo, useState, useEffect } from 'react';
import { MapPin, Package, Truck, Navigation, Radio, MapPinned, CheckCircle2, Calendar, User, PhoneCall } from 'lucide-react';
import { CallButton } from '@/components/call/CallButton';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import TrackingMap from '@/components/maps/TrackingMap';
import api from '@/services/api';
import { getCoordinates, getCityNames } from '@/utils/cityCoordinates';
import { getWorkspaceLabel } from '@/utils/workspace';

const statusConfig = {
  pending_pickup: { color: 'bg-slate-500', label: 'Awaiting Pickup', textColor: 'text-slate-500' },
  picked_up: { color: 'bg-blue-500', label: 'Picked Up', textColor: 'text-blue-500' },
  in_transit: { color: 'bg-orange-500', label: 'In Transit', textColor: 'text-orange-500' },
  delivered: { color: 'bg-green-500', label: 'Delivered', textColor: 'text-green-500' },
};

const statusProgress = {
  pending_pickup: 0,
  picked_up: 1,
  in_transit: 2,
  delivered: 3,
};

const trackerSteps = [
  { key: 'picked_up', label: 'Pick Up' },
  { key: 'in_transit', label: 'In Transit' },
  { key: 'delivered', label: 'Delivered' },
];

function ShipmentStatusTracker({ status, darkMode = false }) {
  const progress = statusProgress[status] || 0;

  return (
    <div style={{ marginBottom: '14px' }}>
      {progress === 0 && (
        <p className={cn('text-xs font-medium mb-2', darkMode ? 'text-slate-300' : 'text-slate-600')}>
          Awaiting pickup confirmation
        </p>
      )}
      <div className="grid grid-cols-3 gap-2">
        {trackerSteps.map((step, index) => {
          const stepNo = index + 1;
          const isComplete = progress > stepNo;
          const isCurrent = progress === stepNo;

          return (
            <div key={step.key} className="text-center">
              <div
                className={cn(
                  'mx-auto size-8 rounded-full border-2 flex items-center justify-center text-xs font-bold',
                  isComplete && 'bg-green-500 border-green-500 text-white',
                  isCurrent && !isComplete && 'bg-orange-500 border-orange-500 text-white',
                  !isComplete && !isCurrent && (darkMode ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-white border-gray-300 text-gray-500')
                )}
              >
                {isComplete ? <CheckCircle2 className="size-4" /> : stepNo}
              </div>
              <p
                className={cn(
                  'mt-1 text-[11px] font-medium',
                  isComplete || isCurrent
                    ? (darkMode ? 'text-white' : 'text-gray-900')
                    : (darkMode ? 'text-gray-400' : 'text-gray-500')
                )}
              >
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TrackingView({
  shipments = [],
  loading = false,
  currentRole = 'shipper',
  workspaceRole = currentRole,
  currentUserId = null,
  darkMode = false,
  className,
  onLocationUpdate = null,
  onInitiateCall = null,
  onEnsureCallEligibility = null,
  isCallDisabled = null,
}) {
  const isMobile = useMediaQuery('(max-width: 1023px)');
  const [selectedShipmentId, setSelectedShipmentId] = useState(null);
  const [showFullMap, setShowFullMap] = useState(false);
  const [updatingLocation, setUpdatingLocation] = useState(null);
  const [statusActionKey, setStatusActionKey] = useState(null);
  const activeWorkspace = workspaceRole || currentRole;

  const selectedShipment = useMemo(() => {
    if (!selectedShipmentId) return null;
    return shipments.find((shipment) => shipment.id === selectedShipmentId) || null;
  }, [selectedShipmentId, shipments]);

  const cities = getCityNames();

  const isAssignedTrucker = (shipment) => {
    if (shipment?.truckerId && currentUserId) {
      return shipment.truckerId === currentUserId;
    }
    return activeWorkspace === 'trucker';
  };

  const isAssignedShipper = (shipment) => {
    if (shipment?.shipperId && currentUserId) {
      return shipment.shipperId === currentUserId;
    }
    return activeWorkspace === 'shipper';
  };

  const roleScopedShipments = useMemo(() => {
    if (activeWorkspace === 'broker') return shipments;
    return shipments.filter((shipment) => {
      if (activeWorkspace === 'shipper') {
        if (shipment?.shipperId && currentUserId) {
          return shipment.shipperId === currentUserId;
        }
        return true;
      }
      if (activeWorkspace === 'trucker') {
        if (shipment?.truckerId && currentUserId) {
          return shipment.truckerId === currentUserId;
        }
        return true;
      }
      return false;
    });
  }, [shipments, activeWorkspace, currentUserId]);

  const scopedActiveShipments = useMemo(
    () => roleScopedShipments.filter((shipment) => shipment.status !== 'delivered'),
    [roleScopedShipments]
  );
  const scopedDeliveredShipments = useMemo(
    () => roleScopedShipments.filter((shipment) => shipment.status === 'delivered'),
    [roleScopedShipments]
  );

  const canPickUp = (shipment) => (
    isAssignedTrucker(shipment) && shipment.status === 'pending_pickup'
  );

  const canDeliver = (shipment) => (
    isAssignedShipper(shipment) && ['picked_up', 'in_transit'].includes(shipment.status)
  );

  const canUpdateLocation = (shipment) => (
    isAssignedTrucker(shipment) && ['picked_up', 'in_transit'].includes(shipment.status)
  );

  const isActionLoading = (shipmentId, action) => statusActionKey === `${shipmentId}:${action}`;

  const handleUpdateLocation = async (shipment, city) => {
    if (!city || !canUpdateLocation(shipment)) return;

    setUpdatingLocation(shipment.id);
    try {
      const coords = getCoordinates(city);
      const result = await api.shipments.updateLocation(shipment.id, {
        currentLat: coords.lat,
        currentLng: coords.lng,
        currentLocation: city,
      });

      if (onLocationUpdate) {
        onLocationUpdate({
          shipmentId: shipment.id,
          shipperId: shipment.shipperId,
          truckerId: shipment.truckerId || currentUserId,
          currentLocation: city,
          lat: coords.lat,
          lng: coords.lng,
          progress: result.shipment?.progress || shipment.progress,
          status: result.shipment?.status || shipment.status,
        });
      }
    } catch (error) {
      console.error('Error updating location:', error);
      alert(`Failed to update location: ${error.message}`);
    } finally {
      setUpdatingLocation(null);
    }
  };

  const handlePickUp = async (shipment) => {
    if (!shipment?.id || !canPickUp(shipment)) return;
    setStatusActionKey(`${shipment.id}:pickup`);
    try {
      await api.shipments.updateStatus(shipment.id, 'picked_up');
    } catch (error) {
      console.error('Error updating pickup status:', error);
      alert(`Failed to update pickup status: ${error.message}`);
    } finally {
      setStatusActionKey(null);
    }
  };

  const handleDeliver = async (shipment) => {
    if (!shipment?.contractId || !canDeliver(shipment)) return;
    setStatusActionKey(`${shipment.id}:deliver`);
    try {
      await api.contracts.complete(shipment.contractId);
    } catch (error) {
      console.error('Error confirming delivery:', error);
      alert(`Failed to confirm delivery: ${error.message}`);
    } finally {
      setStatusActionKey(null);
    }
  };

  const formatDate = (date) => {
    if (!date) return null;
    const d = date instanceof Date ? date : new Date(date?.seconds ? date.seconds * 1000 : date);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  useEffect(() => {
    if (typeof onEnsureCallEligibility !== 'function') return;

    const counterpartIds = new Set();
    roleScopedShipments.forEach((shipment) => {
      const shipmentAssignedTrucker = shipment?.truckerId && currentUserId
        ? shipment.truckerId === currentUserId
        : activeWorkspace === 'trucker';
      const counterpartId = shipmentAssignedTrucker
        ? shipment.shipperId
        : shipment.truckerId;
      if (counterpartId && shipment.status !== 'delivered') {
        counterpartIds.add(counterpartId);
      }
    });

    counterpartIds.forEach((counterpartId) => {
      Promise.resolve(onEnsureCallEligibility(counterpartId)).catch(() => {});
    });
  }, [roleScopedShipments, onEnsureCallEligibility, currentUserId, activeWorkspace]);

  const ShipmentCard = ({ shipment }) => {
    const status = statusConfig[shipment.status] || statusConfig.in_transit;
    const canPickUpShipment = canPickUp(shipment);
    const canDeliverShipment = canDeliver(shipment);
    const canUpdateLocationShipment = canUpdateLocation(shipment);
    const pickupLoading = isActionLoading(shipment.id, 'pickup');
    const deliverLoading = isActionLoading(shipment.id, 'deliver');

    // Determine the other call party (the one who is NOT the current user)
    const callOtherPartyId = isAssignedTrucker(shipment)
      ? shipment.shipperId
      : shipment.truckerId;
    const callOtherPartyName = isAssignedTrucker(shipment)
      ? (shipment.shipperName || 'Shipper')
      : (shipment.truckerName || 'Trucker');
    const canCallShipment = Boolean(
      onInitiateCall && callOtherPartyId && shipment.status !== 'delivered'
    );
    const callActionDisabled = Boolean(
      !callOtherPartyId
      || (typeof isCallDisabled === 'function' && isCallDisabled(callOtherPartyId))
    );

    return (
      <div
        className={cn(
          'bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300',
          selectedShipmentId === shipment.id && 'ring-2 ring-orange-500'
        )}
      >
        <div className={cn('h-1.5', status.color)} />

        <div style={{ padding: isMobile ? '16px' : '24px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: isMobile ? '16px' : '20px',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span className={cn('px-2 py-1 rounded-full text-xs font-medium', status.color, 'text-white')}>
                  {status.label}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  #{shipment.trackingNumber}
                </span>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {shipment.cargoDescription || 'Cargo'}
              </h3>
            </div>
            <div className="text-right" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
              {canCallShipment && (
                <CallButton
                  onCall={() => onInitiateCall({
                    calleeId: callOtherPartyId,
                    calleeName: callOtherPartyName,
                    callType: 'monitoring',
                    contextId: shipment.id,
                  })}
                  disabled={callActionDisabled}
                  title={`Call ${callOtherPartyName}`}
                />
              )}
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Progress</p>
                <p className={cn('text-lg font-bold', status.textColor)}>{shipment.progress || 0}%</p>
              </div>
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '8px' : '12px',
            marginBottom: isMobile ? '16px' : '20px',
            padding: isMobile ? '12px' : '14px',
            backgroundColor: darkMode ? 'rgba(31, 41, 55, 0.5)' : 'rgb(249, 250, 251)',
            borderRadius: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
              <div className="size-8 rounded-full bg-green-500 flex items-center justify-center">
                <MapPin className="size-4 text-white" />
              </div>
              <div className="text-sm">
                <p className="text-xs text-gray-500">From</p>
                <p className="font-medium text-gray-900 dark:text-white">{shipment.origin}</p>
              </div>
            </div>

            <Navigation className="size-4 text-orange-500" />

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
              <div className="size-8 rounded-full bg-red-500 flex items-center justify-center">
                <MapPin className="size-4 text-white" />
              </div>
              <div className="text-sm">
                <p className="text-xs text-gray-500">To</p>
                <p className="font-medium text-gray-900 dark:text-white">{shipment.destination}</p>
              </div>
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: isMobile ? '16px' : '20px',
            padding: '10px',
            backgroundColor: darkMode ? 'rgba(234, 88, 12, 0.1)' : 'rgb(255, 247, 237)',
            borderRadius: '8px',
            border: darkMode ? '1px solid rgba(234, 88, 12, 0.3)' : '1px solid rgb(254, 215, 170)',
          }}>
            <Radio className="size-4 text-orange-500 animate-pulse" />
            <span className="text-sm text-orange-700 dark:text-orange-300">
              Current: <strong>{shipment.currentLocation?.name || shipment.currentLocation || 'Unknown'}</strong>
            </span>
            <span className="text-xs text-gray-500 ml-auto">{shipment.lastUpdate}</span>
          </div>

          <ShipmentStatusTracker status={shipment.status} darkMode={darkMode} />

          <div style={{ marginBottom: isMobile ? '16px' : '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }} className="text-xs text-gray-500">
              <span>{shipment.origin}</span>
              <span>{shipment.destination}</span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', status.color)}
                style={{ width: `${shipment.progress || 0}%` }}
              />
            </div>
          </div>

          {canUpdateLocationShipment && (
            <div style={{
              marginBottom: isMobile ? '16px' : '20px',
              padding: isMobile ? '12px' : '14px',
              backgroundColor: darkMode ? 'rgba(59, 130, 246, 0.1)' : 'rgb(239, 246, 255)',
              borderRadius: '12px',
              border: darkMode ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgb(191, 219, 254)',
            }}>
              <p style={{ fontSize: '14px', fontWeight: '500', marginBottom: '10px' }} className="text-blue-700 dark:text-blue-300">
                Update Current Location
              </p>
              <select
                className="w-full p-2 rounded-lg border border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-800 text-sm"
                onChange={(e) => handleUpdateLocation(shipment, e.target.value)}
                disabled={updatingLocation === shipment.id}
                defaultValue=""
              >
                <option value="" disabled>
                  {updatingLocation === shipment.id ? 'Updating...' : 'Select your current city'}
                </option>
                {cities.map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
          )}

          {/* Contract Details */}
          <div style={{
            marginBottom: isMobile ? '16px' : '20px',
            padding: isMobile ? '12px' : '14px',
            background: darkMode ? 'rgba(255,255,255,0.04)' : '#f9fafb',
            borderRadius: '12px',
            border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
          }}>
            {/* Parties */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div>
                <p style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <User style={{ width: '10px', height: '10px' }} /> Shipper
                </p>
                <p style={{ fontSize: isMobile ? '12px' : '13px', fontWeight: '600', color: darkMode ? '#f3f4f6' : '#111827' }}>
                  {shipment.shipperName || '—'}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <Truck style={{ width: '10px', height: '10px' }} /> Trucker
                </p>
                <p style={{ fontSize: isMobile ? '12px' : '13px', fontWeight: '600', color: darkMode ? '#f3f4f6' : '#111827' }}>
                  {shipment.truckerName || '—'}
                </p>
              </div>
            </div>

            {/* Dates + Plate */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
              {formatDate(shipment.pickupDate) && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '3px 8px', borderRadius: '999px', background: darkMode ? '#1f2937' : '#fff', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, color: darkMode ? '#d1d5db' : '#374151' }}>
                  <Calendar style={{ width: '10px', height: '10px', color: '#f97316' }} />
                  Pickup: {formatDate(shipment.pickupDate)}
                </span>
              )}
              {formatDate(shipment.expectedDeliveryDate) && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '3px 8px', borderRadius: '999px', background: darkMode ? '#1f2937' : '#fff', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, color: darkMode ? '#d1d5db' : '#374151' }}>
                  <Calendar style={{ width: '10px', height: '10px', color: '#10b981' }} />
                  Est. Delivery: {formatDate(shipment.expectedDeliveryDate)}
                </span>
              )}
              {shipment.vehiclePlateNumber && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '3px 8px', borderRadius: '999px', background: darkMode ? '#1f2937' : '#fff', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, color: darkMode ? '#d1d5db' : '#374151' }}>
                  <Truck style={{ width: '10px', height: '10px', color: '#6b7280' }} />
                  {shipment.vehiclePlateNumber}
                </span>
              )}
            </div>

            {/* Agreed price */}
            {shipment.agreedPrice > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ fontSize: '11px', color: '#9ca3af' }}>Contract Value</p>
                <p style={{ fontSize: isMobile ? '14px' : '15px', fontWeight: '700', color: '#f97316', fontFamily: 'Outfit, sans-serif' }}>
                  PHP {Number(shipment.agreedPrice).toLocaleString()}
                </p>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {canPickUpShipment && (
              <button
                onClick={() => handlePickUp(shipment)}
                disabled={pickupLoading}
                className="flex-1 min-w-[120px] py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all duration-300"
              >
                {pickupLoading ? 'Updating...' : 'Pick Up'}
              </button>
            )}

            {canDeliverShipment && (
              <button
                onClick={() => handleDeliver(shipment)}
                disabled={deliverLoading}
                className="flex-1 min-w-[120px] py-3 px-4 bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all duration-300"
              >
                {deliverLoading ? 'Processing...' : 'Delivered'}
              </button>
            )}

            <button
              onClick={() => {
                setSelectedShipmentId(shipment.id);
                setShowFullMap(true);
              }}
              style={{ padding: '14px 16px', fontSize: '15px', fontWeight: 'bold' }}
              className="flex-1 min-w-[140px] bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
            >
              <MapPinned className="size-4" />
              Track Live
            </button>
          </div>
        </div>
      </div>
    );
  };

  const selectedActionLoading = selectedShipment
    ? (isActionLoading(selectedShipment.id, 'pickup')
      ? 'pickup'
      : (isActionLoading(selectedShipment.id, 'deliver') ? 'deliver' : null))
    : null;

  return (
    <main
      className={cn('flex-1 bg-gray-50 dark:bg-gray-950 overflow-y-auto', className)}
      style={{
        padding: isMobile ? '16px' : '24px',
        paddingBottom: isMobile ? 'calc(100px + env(safe-area-inset-bottom, 0px))' : '24px',
      }}
    >
      <div style={{ marginBottom: isMobile ? '24px' : '32px' }}>
        <h1 style={{
          fontWeight: 'bold',
          color: darkMode ? '#fff' : '#111827',
          fontSize: isMobile ? '20px' : '24px',
          marginBottom: '8px',
          lineHeight: '1.2',
        }}>
          Shipment Tracking
        </h1>
        <p style={{ color: darkMode ? '#9ca3af' : '#6b7280', fontSize: isMobile ? '14px' : '16px' }}>
          <span style={{ fontWeight: '600', color: '#f97316' }}>
            {scopedActiveShipments.length} active
          </span>
          {' '}{scopedActiveShipments.length === 1 ? 'shipment' : 'shipments'} in progress for {getWorkspaceLabel(activeWorkspace)} workspace
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent" />
        </div>
      ) : scopedActiveShipments.length > 0 || scopedDeliveredShipments.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '24px' : '32px' }}>
          {scopedActiveShipments.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: isMobile ? '12px' : '16px' }}>
                <Radio className="text-orange-500 animate-pulse" style={{ width: isMobile ? '16px' : '20px', height: isMobile ? '16px' : '20px' }} />
                <h2 style={{ fontWeight: '600', color: darkMode ? '#fff' : '#111827', fontSize: isMobile ? '16px' : '18px' }}>
                  Active Shipments
                </h2>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(350px, 1fr))',
                gap: isMobile ? '12px' : '24px',
              }}>
                {scopedActiveShipments.map((shipment) => (
                  <ShipmentCard key={shipment.id} shipment={shipment} />
                ))}
              </div>
            </div>
          )}

          {scopedDeliveredShipments.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: isMobile ? '12px' : '16px' }}>
                <Package className="text-green-500" style={{ width: isMobile ? '16px' : '20px', height: isMobile ? '16px' : '20px' }} />
                <h2 style={{ fontWeight: '600', color: darkMode ? '#fff' : '#111827', fontSize: isMobile ? '16px' : '18px' }}>
                  Delivered
                </h2>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(350px, 1fr))',
                gap: isMobile ? '12px' : '24px',
              }}>
                {scopedDeliveredShipments.map((shipment) => (
                  <ShipmentCard key={shipment.id} shipment={shipment} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="size-16 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center mb-4 shadow-lg">
            <Truck className="size-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
            No active shipments
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
            Your shipments will appear here once you have an active delivery in progress. Accept a bid and sign a contract to get started.
          </p>
        </div>
      )}

      {showFullMap && selectedShipment && (
        <TrackingMap
          shipment={selectedShipment}
          darkMode={darkMode}
          showFull={true}
          canPickUp={canPickUp(selectedShipment)}
          canDeliver={canDeliver(selectedShipment)}
          onPickUp={() => handlePickUp(selectedShipment)}
          onDeliver={() => handleDeliver(selectedShipment)}
          actionLoading={selectedActionLoading}
          onClose={() => {
            setShowFullMap(false);
            setSelectedShipmentId(null);
          }}
        />
      )}
    </main>
  );
}

export default TrackingView;
