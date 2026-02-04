import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { X, Route, Navigation } from 'lucide-react';

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

// Calculate distance between two points (Haversine formula)
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c);
};

// Component to fit bounds when coordinates change
const FitBounds = ({ bounds }) => {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, bounds]);
  return null;
};

export default function FullMapModal({ listing, darkMode = false, onClose }) {
  const distance = calculateDistance(
    listing.originCoords.lat, listing.originCoords.lng,
    listing.destCoords.lat, listing.destCoords.lng
  );

  const bounds = L.latLngBounds(
    [listing.originCoords.lat, listing.originCoords.lng],
    [listing.destCoords.lat, listing.destCoords.lng]
  );

  const routeLine = [
    [listing.originCoords.lat, listing.originCoords.lng],
    [listing.destCoords.lat, listing.destCoords.lng]
  ];

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
      <div className={`${theme.bgCard} p-4 flex justify-between items-center shadow-lg`}>
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
          <FitBounds bounds={bounds} />

          {/* Route line */}
          <Polyline
            positions={routeLine}
            pathOptions={{
              color: '#f59e0b',
              weight: 5,
              dashArray: '12, 8',
              opacity: 0.9
            }}
          />

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
      <div className={`${theme.bgCard} p-4 space-y-3`}>
        <div className="grid grid-cols-3 gap-3">
          <div className={`${theme.bgSecondary} rounded-xl p-3 text-center`}>
            <p className="text-2xl font-bold text-amber-500">{distance} km</p>
            <p className={`text-xs ${theme.textMuted}`}>Distance</p>
          </div>
          <div className={`${theme.bgSecondary} rounded-xl p-3 text-center`}>
            <p className="text-2xl font-bold text-blue-500">{Math.round(distance / 50)}h</p>
            <p className={`text-xs ${theme.textMuted}`}>Est. Time</p>
          </div>
          <div className={`${theme.bgSecondary} rounded-xl p-3 text-center`}>
            <p className="text-2xl font-bold text-green-500">
              ₱{listing.askingPrice ? (listing.askingPrice / distance).toFixed(0) : '—'}
            </p>
            <p className={`text-xs ${theme.textMuted}`}>Per KM</p>
          </div>
        </div>

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
