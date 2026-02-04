import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { X, Route, Navigation, Loader2 } from 'lucide-react';
import { fetchRoute, formatDuration } from '../../services/routingService';

// Custom marker icons
const createIcon = (color, size = 24) => L.divIcon({
  className: 'custom-marker',
  html: `<div style="
    width: ${size}px;
    height: ${size}px;
    background: ${color};
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 3px 8px rgba(0,0,0,0.4);
    animation: pulse 2s infinite;
  "></div>
  <style>
    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.1); opacity: 0.8; }
    }
  </style>`,
  iconSize: [size, size],
  iconAnchor: [size/2, size/2],
});

const originIcon = createIcon('#22c55e', 28);
const destIcon = createIcon('#ef4444', 28);

// Component to fit bounds to route
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

export default function FullMapModal({ listing, darkMode = false, onClose }) {
  const [routeData, setRouteData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch route on mount
  useEffect(() => {
    const loadRoute = async () => {
      setLoading(true);
      try {
        const data = await fetchRoute(listing.originCoords, listing.destCoords);
        setRouteData(data);
      } catch (error) {
        console.error('Failed to load route:', error);
        // Fallback
        setRouteData({
          coordinates: [
            [listing.originCoords.lat, listing.originCoords.lng],
            [listing.destCoords.lat, listing.destCoords.lng]
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
  }, [listing.originCoords, listing.destCoords]);

  // Tile layer URLs
  const lightTiles = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const darkTiles = 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png';

  const theme = {
    bgCard: darkMode ? 'bg-gray-800' : 'bg-white',
    bgSecondary: darkMode ? 'bg-gray-700' : 'bg-gray-100',
    text: darkMode ? 'text-white' : 'text-gray-900',
    textSecondary: darkMode ? 'text-gray-400' : 'text-gray-600',
    textMuted: darkMode ? 'text-gray-500' : 'text-gray-400',
  };

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex flex-col">
      {/* Header */}
      <div className={`${theme.bgCard} flex justify-between items-center shadow-lg`} style={{ padding: '16px 24px' }}>
        <div>
          <h2 className={`font-bold ${theme.text} flex items-center gap-2`}>
            <Route className="text-amber-500" /> Route Details
          </h2>
          <p className={theme.textSecondary}>{listing.origin} → {listing.destination}</p>
        </div>
        <button
          onClick={onClose}
          className={`${theme.bgSecondary} p-2 rounded-full hover:opacity-80 transition`}
        >
          <X size={24} className={theme.textSecondary} />
        </button>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-[1000]">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center gap-3 shadow-lg">
              <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
              <span className={theme.text}>Loading route...</span>
            </div>
          </div>
        )}

        <MapContainer
          center={[(listing.originCoords.lat + listing.destCoords.lat) / 2, (listing.originCoords.lng + listing.destCoords.lng) / 2]}
          zoom={7}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
        >
          <TileLayer
            url={darkMode ? darkTiles : lightTiles}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />

          {/* Fit bounds to route */}
          {routeData && <FitBounds coordinates={routeData.coordinates} />}

          {/* Route line - solid for real routes, dashed for fallback */}
          {routeData && (
            <Polyline
              positions={routeData.coordinates}
              pathOptions={{
                color: '#f59e0b',
                weight: 5,
                dashArray: routeData.isRealRoute ? null : '12, 8',
                opacity: 0.9
              }}
            />
          )}

          {/* Origin marker */}
          <Marker position={[listing.originCoords.lat, listing.originCoords.lng]} icon={originIcon}>
            <Popup>
              <div className="font-semibold text-green-600">Origin</div>
              <div>{listing.origin}</div>
            </Popup>
          </Marker>

          {/* Destination marker */}
          <Marker position={[listing.destCoords.lat, listing.destCoords.lng]} icon={destIcon}>
            <Popup>
              <div className="font-semibold text-red-600">Destination</div>
              <div>{listing.destination}</div>
            </Popup>
          </Marker>
        </MapContainer>
      </div>

      {/* Stats Panel */}
      <div className={`${theme.bgCard} space-y-3`} style={{ padding: '16px 24px' }}>
        <div className="grid grid-cols-3 gap-3">
          <div className={`${theme.bgSecondary} rounded-xl p-3 text-center`}>
            <p className="text-2xl font-bold text-amber-500">
              {routeData ? routeData.distance : '—'} km
            </p>
            <p className={`text-xs ${theme.textMuted}`}>
              {routeData?.isRealRoute ? 'Road Distance' : 'Distance'}
            </p>
          </div>
          <div className={`${theme.bgSecondary} rounded-xl p-3 text-center`}>
            <p className="text-2xl font-bold text-blue-500">
              {routeData ? formatDuration(routeData.duration) : '—'}
            </p>
            <p className={`text-xs ${theme.textMuted}`}>
              {routeData?.isRealRoute ? 'Est. Drive Time' : 'Est. Time'}
            </p>
          </div>
          <div className={`${theme.bgSecondary} rounded-xl p-3 text-center`}>
            <p className="text-2xl font-bold text-green-500">
              {listing.askingPrice && routeData?.distance
                ? `₱${(listing.askingPrice / routeData.distance).toFixed(0)}`
                : '—'}
            </p>
            <p className={`text-xs ${theme.textMuted}`}>Per KM</p>
          </div>
        </div>

        {/* Route type indicator */}
        {routeData && !routeData.isRealRoute && (
          <p className={`text-xs ${theme.textMuted} text-center`}>
            Showing estimated straight-line distance. Add API key for accurate road routes.
          </p>
        )}

        <a
          href={`https://www.google.com/maps/dir/${listing.originCoords.lat},${listing.originCoords.lng}/${listing.destCoords.lat},${listing.destCoords.lng}`}
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
