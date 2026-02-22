import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { X, MapPinned, MapPin, Navigation, Radio, Loader2, CheckCircle2 } from 'lucide-react';
import { fetchRoute, formatDuration } from '../../services/routingService';

const createIcon = (color, size = 24) => L.divIcon({
  className: 'custom-marker',
  html: `<div style="
    width: ${size}px;
    height: ${size}px;
    background: ${color};
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 3px 8px rgba(0,0,0,0.4);
  "></div>`,
  iconSize: [size, size],
  iconAnchor: [size / 2, size / 2],
});

const createTruckIcon = (color) => L.divIcon({
  className: 'truck-marker',
  html: `
    <div style="position: relative; width: 40px; height: 40px;">
      <div style="
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 40px;
        height: 40px;
        background: ${color};
        border-radius: 50%;
        opacity: 0.3;
        animation: pulse-ring 1.5s infinite;
      "></div>
      <div style="
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 32px;
        height: 32px;
        background: ${color};
        border: 3px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        box-shadow: 0 3px 10px rgba(0,0,0,0.4);
      ">&#128666;</div>
    </div>
    <style>
      @keyframes pulse-ring {
        0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.5; }
        50% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.2; }
        100% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.5; }
      }
    </style>
  `,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

const originIcon = createIcon('#22c55e', 20);
const destIcon = createIcon('#ef4444', 20);

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

const FitBounds = ({ coordinates }) => {
  const map = useMap();
  useEffect(() => {
    if (coordinates && coordinates.length > 0) {
      const bounds = L.latLngBounds(coordinates);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, coordinates]);
  return null;
};

function ShipmentStatusTracker({ status, darkMode = false }) {
  const progress = statusProgress[status] || 0;

  return (
    <div>
      {progress === 0 && (
        <p className={`text-xs font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
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
                className={[
                  'mx-auto size-8 rounded-full border-2 flex items-center justify-center text-xs font-bold',
                  isComplete ? 'bg-green-500 border-green-500 text-white' : '',
                  isCurrent && !isComplete ? 'bg-orange-500 border-orange-500 text-white' : '',
                  !isComplete && !isCurrent
                    ? (darkMode ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-white border-gray-300 text-gray-500')
                    : '',
                ].join(' ').trim()}
              >
                {isComplete ? <CheckCircle2 className="size-4" /> : stepNo}
              </div>
              <p
                className={[
                  'mt-1 text-[11px] font-medium',
                  isComplete || isCurrent
                    ? (darkMode ? 'text-white' : 'text-gray-900')
                    : (darkMode ? 'text-gray-400' : 'text-gray-500'),
                ].join(' ')}
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

export default function TrackingMap({
  shipment,
  darkMode = false,
  showFull = false,
  onClose,
  canPickUp = false,
  canDeliver = false,
  onPickUp = null,
  onDeliver = null,
  actionLoading = null,
}) {
  const [routeData, setRouteData] = useState(null);
  const [loading, setLoading] = useState(true);

  const safeProgress = Number(shipment?.progress || 0);
  const currentLocationName = shipment?.currentLocation?.name || shipment?.currentLocation || 'Unknown';

  const hasValidCoordinates =
    Number.isFinite(shipment?.originCoords?.lat) &&
    Number.isFinite(shipment?.originCoords?.lng) &&
    Number.isFinite(shipment?.destCoords?.lat) &&
    Number.isFinite(shipment?.destCoords?.lng) &&
    Number.isFinite(shipment?.currentLocation?.lat) &&
    Number.isFinite(shipment?.currentLocation?.lng);

  const statusColors = {
    pending_pickup: { color: '#64748b', label: 'Awaiting Pickup', pulse: false },
    picked_up: { color: '#3b82f6', label: 'Picked Up', pulse: true },
    in_transit: { color: '#f59e0b', label: 'In Transit', pulse: true },
    delivered: { color: '#22c55e', label: 'Delivered', pulse: false },
  };
  const currentStatus = statusColors[shipment.status] || statusColors.in_transit;
  const truckIcon = createTruckIcon(currentStatus.color);

  useEffect(() => {
    if (!hasValidCoordinates) {
      setLoading(false);
      setRouteData(null);
      return;
    }

    const loadRoute = async () => {
      setLoading(true);
      try {
        const data = await fetchRoute(shipment.originCoords, shipment.destCoords);
        setRouteData(data);
      } catch (error) {
        console.error('Failed to load route:', error);
        setRouteData({
          coordinates: [
            [shipment.originCoords.lat, shipment.originCoords.lng],
            [shipment.destCoords.lat, shipment.destCoords.lng],
          ],
          distance: 0,
          duration: 0,
          isRealRoute: false,
        });
      } finally {
        setLoading(false);
      }
    };

    loadRoute();
  }, [shipment.originCoords, shipment.destCoords, hasValidCoordinates]);

  const getRouteSegments = () => {
    if (!routeData || !routeData.coordinates || routeData.coordinates.length < 2) {
      return {
        completedRoute: [
          [shipment.originCoords.lat, shipment.originCoords.lng],
          [shipment.currentLocation.lat, shipment.currentLocation.lng],
        ],
        remainingRoute: [
          [shipment.currentLocation.lat, shipment.currentLocation.lng],
          [shipment.destCoords.lat, shipment.destCoords.lng],
        ],
      };
    }

    const totalPoints = routeData.coordinates.length;
    const splitIndex = Math.floor((safeProgress / 100) * totalPoints);

    const completedRoute = routeData.coordinates.slice(0, splitIndex + 1);
    const remainingRoute = routeData.coordinates.slice(splitIndex);

    if (completedRoute.length > 0) {
      completedRoute.push([shipment.currentLocation.lat, shipment.currentLocation.lng]);
    }
    if (remainingRoute.length > 0) {
      remainingRoute.unshift([shipment.currentLocation.lat, shipment.currentLocation.lng]);
    }

    return { completedRoute, remainingRoute };
  };

  const { completedRoute, remainingRoute } = getRouteSegments();

  const lightTiles = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const darkTiles = 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png';

  const theme = {
    bgCard: darkMode ? 'bg-gray-800' : 'bg-white',
    bgSecondary: darkMode ? 'bg-gray-700' : 'bg-gray-100',
    text: darkMode ? 'text-white' : 'text-gray-900',
    textSecondary: darkMode ? 'text-gray-400' : 'text-gray-600',
    textMuted: darkMode ? 'text-gray-500' : 'text-gray-400',
    border: darkMode ? 'border-gray-700' : 'border-gray-200',
  };

  useEffect(() => {
    if (showFull) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
    return undefined;
  }, [showFull]);

  const allCoordinates = routeData?.coordinates || [
    [shipment.originCoords.lat, shipment.originCoords.lng],
    [shipment.currentLocation.lat, shipment.currentLocation.lng],
    [shipment.destCoords.lat, shipment.destCoords.lng],
  ];

  if (!hasValidCoordinates) {
    const ErrorContent = () => (
      <div className={`${theme.bgCard} rounded-xl border ${theme.border} p-6 text-center`}>
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 mb-4">
          <MapPinned className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>
        <h3 className={`text-lg font-semibold ${theme.text} mb-2`}>
          Location Data Unavailable
        </h3>
        <p className={theme.textSecondary}>
          This shipment is missing coordinate information and cannot be tracked on the map.
          Please contact support if this issue persists.
        </p>
        {showFull && (
          <button
            onClick={onClose}
            className="mt-4 px-6 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition"
          >
            Close
          </button>
        )}
      </div>
    );

    if (showFull) {
      return (
        <div className="tracking-live-overlay fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <ErrorContent />
          </div>
        </div>
      );
    }
    return <ErrorContent />;
  }

  if (showFull) {
    return (
      <div className="tracking-live-overlay fixed inset-0 bg-black/60 z-[80] flex flex-col">
        <div className={`${theme.bgCard} p-4 flex justify-between items-center shadow-lg shrink-0`}>
          <div>
            <h2 className={`font-bold ${theme.text} flex items-center gap-2`}>
              <MapPinned className="text-amber-500" /> Live Tracking
            </h2>
            <p className={theme.textSecondary}>{shipment.origin}{' -> '}{shipment.destination}</p>
          </div>
          <button
            onClick={onClose}
            className={`${theme.bgSecondary} p-2 rounded-full hover:opacity-80 transition`}
          >
            <X size={24} className={theme.textSecondary} />
          </button>
        </div>

        <div className="relative flex-1 min-h-0">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-[1000]">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center gap-3 shadow-lg">
                <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
                <span className={theme.text}>Loading route...</span>
              </div>
            </div>
          )}

          <MapContainer
            center={[shipment.currentLocation.lat, shipment.currentLocation.lng]}
            zoom={8}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
          >
            <TileLayer
              url={darkMode ? darkTiles : lightTiles}
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            <FitBounds coordinates={allCoordinates} />

            <Polyline
              positions={completedRoute}
              pathOptions={{
                color: '#22c55e',
                weight: 5,
                opacity: 0.9,
              }}
            />

            <Polyline
              positions={remainingRoute}
              pathOptions={{
                color: '#6b7280',
                weight: 4,
                dashArray: '10, 6',
                opacity: 0.7,
              }}
            />

            <Marker position={[shipment.originCoords.lat, shipment.originCoords.lng]} icon={originIcon}>
              <Popup>
                <div className="font-semibold text-green-600">Origin</div>
                <div>{shipment.origin}</div>
              </Popup>
            </Marker>

            <Marker position={[shipment.currentLocation.lat, shipment.currentLocation.lng]} icon={truckIcon}>
              <Popup>
                <div className="font-semibold" style={{ color: currentStatus.color }}>
                  {currentStatus.label}
                </div>
                <div>{currentLocationName}</div>
              </Popup>
            </Marker>

            <Marker position={[shipment.destCoords.lat, shipment.destCoords.lng]} icon={destIcon}>
              <Popup>
                <div className="font-semibold text-red-600">Destination</div>
                <div>{shipment.destination}</div>
              </Popup>
            </Marker>
          </MapContainer>
        </div>

        <div
          className={`${theme.bgCard} p-4 space-y-3 max-h-[48vh] overflow-y-auto shrink-0`}
          style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{ backgroundColor: `${currentStatus.color}20` }}
            >
              {currentStatus.pulse && (
                <Radio size={14} style={{ color: currentStatus.color }} className="animate-pulse" />
              )}
              <span className="font-semibold text-sm" style={{ color: currentStatus.color }}>
                {currentStatus.label}
              </span>
            </div>
            <span className={theme.textMuted}>Updated {shipment.lastUpdate}</span>
            {routeData?.isRealRoute && (
              <span className="text-xs text-green-500 ml-auto">Road route</span>
            )}
          </div>

          <ShipmentStatusTracker status={shipment.status} darkMode={darkMode} />

          {routeData && (
            <div className="grid grid-cols-3 gap-2">
              <div className={`${theme.bgSecondary} rounded-lg p-2 text-center`}>
                <p className="text-lg font-bold text-amber-500">{routeData.distance} km</p>
                <p className={`text-xs ${theme.textMuted}`}>Total Distance</p>
              </div>
              <div className={`${theme.bgSecondary} rounded-lg p-2 text-center`}>
                <p className="text-lg font-bold text-blue-500">{formatDuration(routeData.duration)}</p>
                <p className={`text-xs ${theme.textMuted}`}>Est. Duration</p>
              </div>
              <div className={`${theme.bgSecondary} rounded-lg p-2 text-center`}>
                <p className="text-lg font-bold text-green-500">{safeProgress}%</p>
                <p className={`text-xs ${theme.textMuted}`}>Complete</p>
              </div>
            </div>
          )}

          <div>
            <div className={`flex justify-between text-xs ${theme.textMuted} mb-1`}>
              <span>{shipment.origin}</span>
              <span>{safeProgress}%</span>
              <span>{shipment.destination}</span>
            </div>
            <div className={`h-3 ${theme.bgSecondary} rounded-full overflow-hidden`}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${safeProgress}%`, backgroundColor: currentStatus.color }}
              />
            </div>
          </div>

          <div className={`${darkMode ? 'bg-amber-900/20 border-amber-800' : 'bg-amber-50 border-amber-200'} border rounded-lg p-3`}>
            <p className={`text-sm ${darkMode ? 'text-amber-300' : 'text-amber-800'}`}>
              <MapPin size={14} className="inline mr-1" />
              <strong>Current:</strong> {currentLocationName}
            </p>
          </div>

          {(canPickUp || canDeliver) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {canPickUp && (
                <button
                  onClick={onPickUp}
                  disabled={actionLoading === 'pickup'}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold text-center transition"
                >
                  {actionLoading === 'pickup' ? 'Updating...' : 'Pick Up'}
                </button>
              )}
              {canDeliver && (
                <button
                  onClick={onDeliver}
                  disabled={actionLoading === 'deliver'}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold text-center transition"
                >
                  {actionLoading === 'deliver' ? 'Processing...' : 'Delivered'}
                </button>
              )}
            </div>
          )}

          <a
            href={`https://www.google.com/maps/dir/${shipment.originCoords.lat},${shipment.originCoords.lng}/${shipment.destCoords.lat},${shipment.destCoords.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-center transition"
          >
            <Navigation size={18} className="inline mr-2" /> Open in Google Maps
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={`${theme.bgCard} rounded-xl border ${theme.border} p-3 shadow-sm`}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className={`font-semibold ${theme.text}`}>{shipment.cargo}</p>
          <p className={`text-xs ${theme.textMuted}`}>{shipment.origin}{' -> '}{shipment.destination}</p>
        </div>
        <div
          className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
          style={{ backgroundColor: `${currentStatus.color}20`, color: currentStatus.color }}
        >
          {currentStatus.pulse && <Radio size={10} className="animate-pulse" />}
          {currentStatus.label}
        </div>
      </div>

      <div className="mini-map-container h-24 rounded-lg overflow-hidden mb-2" style={{ isolation: 'isolate', position: 'relative', zIndex: 0 }}>
        <MapContainer
          center={[shipment.currentLocation.lat, shipment.currentLocation.lng]}
          zoom={7}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          dragging={false}
          scrollWheelZoom={false}
          doubleClickZoom={false}
          touchZoom={false}
          attributionControl={false}
        >
          <TileLayer url={darkMode ? darkTiles : lightTiles} />

          <Polyline
            positions={completedRoute}
            pathOptions={{ color: '#22c55e', weight: 3 }}
          />

          <Polyline
            positions={remainingRoute}
            pathOptions={{ color: '#6b7280', weight: 2, dashArray: '6, 4' }}
          />

          <Marker position={[shipment.originCoords.lat, shipment.originCoords.lng]} icon={createIcon('#22c55e', 14)} />
          <Marker position={[shipment.currentLocation.lat, shipment.currentLocation.lng]} icon={truckIcon} />
          <Marker position={[shipment.destCoords.lat, shipment.destCoords.lng]} icon={createIcon('#ef4444', 14)} />
        </MapContainer>
      </div>

      <div className={`h-2 ${theme.bgSecondary} rounded-full overflow-hidden mb-2`}>
        <div
          className="h-full rounded-full"
          style={{ width: `${safeProgress}%`, backgroundColor: currentStatus.color }}
        />
      </div>

      <div className={`flex justify-between items-center text-xs ${theme.textMuted}`}>
        <span>{currentLocationName}</span>
        <span className="text-blue-500 font-medium">
          ETA: {typeof shipment.eta === 'string' ? shipment.eta : '--'}
        </span>
      </div>
    </div>
  );
}
