import React, { useState } from 'react';
import { MapPin, Package, Truck, Clock, Navigation, Radio, ChevronRight, MapPinned } from 'lucide-react';
import { cn } from '@/lib/utils';
import TrackingMap from '@/components/maps/TrackingMap';
import api from '@/services/api';
import { getCoordinates, getCityNames } from '@/utils/cityCoordinates';

export function TrackingView({
  shipments = [],
  activeShipments = [],
  deliveredShipments = [],
  loading = false,
  currentRole = 'shipper',
  currentUserId = null,
  darkMode = false,
  className,
  onLocationUpdate = null, // Socket callback for instant notifications
}) {
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [showFullMap, setShowFullMap] = useState(false);
  const [updatingLocation, setUpdatingLocation] = useState(null);

  // Status colors and labels
  const statusConfig = {
    picked_up: { color: 'bg-blue-500', label: 'Picked Up', textColor: 'text-blue-500' },
    in_transit: { color: 'bg-orange-500', label: 'In Transit', textColor: 'text-orange-500' },
    delivered: { color: 'bg-green-500', label: 'Delivered', textColor: 'text-green-500' },
  };

  // Handle location update for truckers (via API)
  const handleUpdateLocation = async (shipment, city) => {
    if (!city) return;

    setUpdatingLocation(shipment.id);
    try {
      const coords = getCoordinates(city);

      // Call backend API to update location
      // The API handles progress calculation, status updates, and socket notifications
      const result = await api.shipments.updateLocation(shipment.id, {
        currentLat: coords.lat,
        currentLng: coords.lng,
        currentLocation: city,
      });

      console.log('Location updated successfully via API:', result);

      // Also emit socket event for instant UI update while API processes
      if (onLocationUpdate) {
        onLocationUpdate({
          shipmentId: shipment.id,
          shipperId: shipment.shipperId,
          truckerId: currentUserId,
          currentLocation: city,
          lat: coords.lat,
          lng: coords.lng,
          progress: result.shipment?.progress || shipment.progress,
          status: result.shipment?.status || shipment.status,
        });
      }
    } catch (error) {
      console.error('Error updating location:', error);
      alert('Failed to update location: ' + error.message);
    } finally {
      setUpdatingLocation(null);
    }
  };

  // Get cities for dropdown
  const cities = getCityNames();

  // Shipment card component
  const ShipmentCard = ({ shipment }) => {
    const status = statusConfig[shipment.status] || statusConfig.in_transit;
    const isTrucker = currentRole === 'trucker' && shipment.truckerId === currentUserId;

    return (
      <div
        className={cn(
          "bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300",
          selectedShipment?.id === shipment.id && "ring-2 ring-orange-500"
        )}
      >
        {/* Status Bar */}
        <div className={cn("h-1.5", status.color)} />

        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={cn("px-2 py-1 rounded-full text-xs font-medium", status.color, "text-white")}>
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
            <div className="text-right">
              <p className="text-sm text-gray-500 dark:text-gray-400">Progress</p>
              <p className={cn("text-lg font-bold", status.textColor)}>{shipment.progress}%</p>
            </div>
          </div>

          {/* Route */}
          <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
            <div className="flex items-center gap-2 flex-1">
              <div className="size-8 rounded-full bg-green-500 flex items-center justify-center">
                <MapPin className="size-4 text-white" />
              </div>
              <div className="text-sm">
                <p className="text-xs text-gray-500">From</p>
                <p className="font-medium text-gray-900 dark:text-white">{shipment.origin}</p>
              </div>
            </div>

            <Navigation className="size-4 text-orange-500" />

            <div className="flex items-center gap-2 flex-1">
              <div className="size-8 rounded-full bg-red-500 flex items-center justify-center">
                <MapPin className="size-4 text-white" />
              </div>
              <div className="text-sm">
                <p className="text-xs text-gray-500">To</p>
                <p className="font-medium text-gray-900 dark:text-white">{shipment.destination}</p>
              </div>
            </div>
          </div>

          {/* Current Location */}
          <div className="flex items-center gap-2 mb-4 p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-100 dark:border-orange-800/30">
            <Radio className="size-4 text-orange-500 animate-pulse" />
            <span className="text-sm text-orange-700 dark:text-orange-300">
              Current: <strong>{shipment.currentLocation?.name || 'Unknown'}</strong>
            </span>
            <span className="text-xs text-gray-500 ml-auto">{shipment.lastUpdate}</span>
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{shipment.origin}</span>
              <span>{shipment.destination}</span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500", status.color)}
                style={{ width: `${shipment.progress}%` }}
              />
            </div>
          </div>

          {/* Trucker Location Update */}
          {isTrucker && shipment.status !== 'delivered' && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/30">
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
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

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setSelectedShipment(shipment);
                setShowFullMap(true);
              }}
              className="flex-1 py-3 px-4 bg-gradient-to-r from-orange-400 to-orange-600 text-white rounded-xl font-medium hover:shadow-lg transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
            >
              <MapPinned className="size-4" />
              Track Live
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className={cn("flex-1 bg-gray-50 dark:bg-gray-950 overflow-y-auto", className)} style={{ padding: '32px 40px' }}>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Shipment Tracking
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          <span className="font-semibold text-orange-500">
            {activeShipments.length} active
          </span>
          {' '}{activeShipments.length === 1 ? 'shipment' : 'shipments'} in progress
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent" />
        </div>
      ) : activeShipments.length > 0 || deliveredShipments.length > 0 ? (
        <div className="space-y-8">
          {/* Active Shipments */}
          {activeShipments.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Radio className="size-5 text-orange-500 animate-pulse" />
                Active Shipments
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {activeShipments.map((shipment) => (
                  <ShipmentCard key={shipment.id} shipment={shipment} />
                ))}
              </div>
            </div>
          )}

          {/* Delivered Shipments */}
          {deliveredShipments.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Package className="size-5 text-green-500" />
                Delivered
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {deliveredShipments.map((shipment) => (
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
            Your shipments will appear here once you have an active delivery in progress.
          </p>
        </div>
      )}

      {/* Full Map Modal */}
      {showFullMap && selectedShipment && (
        <TrackingMap
          shipment={selectedShipment}
          darkMode={darkMode}
          showFull={true}
          onClose={() => {
            setShowFullMap(false);
            setSelectedShipment(null);
          }}
        />
      )}
    </main>
  );
}

export default TrackingView;
