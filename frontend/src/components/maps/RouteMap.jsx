import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Maximize2, Loader2 } from 'lucide-react';
import { fetchRoute, formatDuration } from '../../services/routingService';

// Fix for default marker icons in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom marker icons
const createIcon = (color) => L.divIcon({
  className: 'custom-marker',
  html: `<div style="
    width: 24px;
    height: 24px;
    background: ${color};
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const originIcon = createIcon('#22c55e');
const destIcon = createIcon('#ef4444');

// Component to fit bounds when coordinates change
const FitBounds = ({ bounds }) => {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [map, bounds]);
  return null;
};

export default function RouteMap({
  origin,
  destination,
  originCoords,
  destCoords,
  darkMode = false,
  onClick,
  height = '112px'
}) {
  const [routeData, setRouteData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch route when coordinates change
  useEffect(() => {
    let cancelled = false;

    const loadRoute = async () => {
      setLoading(true);
      try {
        const data = await fetchRoute(originCoords, destCoords);
        if (!cancelled) {
          setRouteData(data);
        }
      } catch (error) {
        console.error('Failed to load route:', error);
        // Fallback to straight line
        if (!cancelled) {
          setRouteData({
            coordinates: [
              [originCoords.lat, originCoords.lng],
              [destCoords.lat, destCoords.lng]
            ],
            distance: 0,
            duration: 0,
            isRealRoute: false,
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadRoute();

    return () => {
      cancelled = true;
    };
  }, [originCoords.lat, originCoords.lng, destCoords.lat, destCoords.lng]);

  const bounds = L.latLngBounds(
    [originCoords.lat, originCoords.lng],
    [destCoords.lat, destCoords.lng]
  );

  // Tile layer URLs
  const lightTiles = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const darkTiles = 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png';

  return (
    <div
      className={`mini-map-container relative rounded-xl overflow-hidden cursor-pointer group border ${
        darkMode ? 'border-gray-700' : 'border-gray-200'
      }`}
      style={{ height, isolation: 'isolate', position: 'relative', zIndex: 0 }}
      onClick={onClick}
    >
      <MapContainer
        center={[(originCoords.lat + destCoords.lat) / 2, (originCoords.lng + destCoords.lng) / 2]}
        zoom={6}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        attributionControl={false}
      >
        <TileLayer url={darkMode ? darkTiles : lightTiles} />
        <FitBounds bounds={bounds} />

        {/* Route line - now uses real road route when available */}
        {routeData && (
          <Polyline
            positions={routeData.coordinates}
            pathOptions={{
              color: routeData.isRealRoute ? '#f59e0b' : '#f59e0b',
              weight: 4,
              dashArray: routeData.isRealRoute ? null : '10, 6', // Solid line for real routes
              opacity: 0.9
            }}
          />
        )}

        {/* Origin marker */}
        <Marker position={[originCoords.lat, originCoords.lng]} icon={originIcon} />

        {/* Destination marker */}
        <Marker position={[destCoords.lat, destCoords.lng]} icon={destIcon} />
      </MapContainer>

      {/* Loading indicator */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-[1000]">
          <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
        </div>
      )}

      {/* Distance badge */}
      {routeData && !loading && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] pointer-events-none">
          <div className="bg-amber-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
            {routeData.distance} km
          </div>
        </div>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center opacity-0 group-hover:opacity-100 z-[1000]">
        <span className="bg-white text-gray-900 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 shadow-lg">
          <Maximize2 size={12} /> View Map
        </span>
      </div>
    </div>
  );
}
