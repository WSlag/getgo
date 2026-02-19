/**
 * Routing Service - OpenRouteService API Integration
 * Provides real road routes, distances, and durations
 *
 * Calls are proxied through a Firebase Cloud Function to avoid CORS restrictions.
 */

import { getAppCheckHeaders } from './appCheckService';

const functionsRegion = import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || 'asia-southeast1';
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
const emulatorHost = import.meta.env.VITE_FIREBASE_EMULATOR_HOST || '127.0.0.1';
const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';
const configuredRouteProxyUrl = import.meta.env.VITE_ROUTE_PROXY_URL;

const ROUTE_PROXY_URL = configuredRouteProxyUrl ||
  (projectId
    ? (useEmulator
      ? `http://${emulatorHost}:5001/${projectId}/${functionsRegion}/getRoute`
      : `https://${functionsRegion}-${projectId}.cloudfunctions.net/getRoute`)
    : null);

// Simple in-memory cache for routes
const routeCache = new Map();
const inFlightRequests = new Map();

/**
 * Generate cache key for a route
 */
const getCacheKey = (origin, destination) => {
  // Validate coordinates exist
  if (!origin || !destination ||
      typeof origin.lat !== 'number' || typeof origin.lng !== 'number' ||
      typeof destination.lat !== 'number' || typeof destination.lng !== 'number') {
    throw new Error('Invalid coordinates provided to getCacheKey');
  }
  return `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}-${destination.lat.toFixed(4)},${destination.lng.toFixed(4)}`;
};

/**
 * Decode OpenRouteService encoded polyline
 * ORS uses a modified polyline encoding with precision 5
 */
const decodePolyline = (encoded) => {
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += deltaLat;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += deltaLng;

    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
};

/**
 * Fetch route from OpenRouteService
 * @param {Object} origin - { lat, lng }
 * @param {Object} destination - { lat, lng }
 * @returns {Promise<Object>} Route data with coordinates, distance, and duration
 */
export const fetchRoute = async (origin, destination) => {
  // Validate coordinates
  if (!origin || !destination ||
      typeof origin.lat !== 'number' || typeof origin.lng !== 'number' ||
      typeof destination.lat !== 'number' || typeof destination.lng !== 'number') {
    throw new Error('Invalid coordinates: origin and destination must have valid lat/lng numbers');
  }

  // Check cache first
  const cacheKey = getCacheKey(origin, destination);
  if (routeCache.has(cacheKey)) {
    return routeCache.get(cacheKey);
  }

  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  const requestPromise = (async () => {
    const cacheFallbackAndReturn = () => {
      const fallbackRoute = getFallbackRoute(origin, destination);
      routeCache.set(cacheKey, fallbackRoute);
      return fallbackRoute;
    };

    try {
      if (!ROUTE_PROXY_URL) {
        return cacheFallbackAndReturn();
      }

      const appCheckHeaders = await getAppCheckHeaders();
      const response = await fetch(ROUTE_PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...appCheckHeaders,
        },
        body: JSON.stringify({
          coordinates: [
            [origin.lng, origin.lat],
            [destination.lng, destination.lat]
          ],
          format: 'json',
          instructions: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        // Only log non-404 errors (404s are expected for invalid routes/API issues)
        if (response.status !== 404) {
          console.error('OpenRouteService error:', errorData);
        }
        return cacheFallbackAndReturn();
      }

      const data = await response.json();

      if (!data.routes || data.routes.length === 0) {
        return cacheFallbackAndReturn();
      }

      const route = data.routes[0];
      const coordinates = decodePolyline(route.geometry);

      const result = {
        coordinates, // Array of [lat, lng] for Leaflet Polyline
        distance: Math.round(route.summary.distance / 1000), // Convert to km
        duration: Math.round(route.summary.duration / 60), // Convert to minutes
        isRealRoute: true,
      };

      // Cache the result
      routeCache.set(cacheKey, result);

      return result;
    } catch (error) {
      console.error('Failed to fetch route:', error);
      return cacheFallbackAndReturn();
    }
  })();

  inFlightRequests.set(cacheKey, requestPromise);

  try {
    return await requestPromise;
  } finally {
    inFlightRequests.delete(cacheKey);
  }
};

/**
 * Fallback to straight line when API is unavailable
 */
const getFallbackRoute = (origin, destination) => {
  const distance = calculateHaversineDistance(
    origin.lat, origin.lng,
    destination.lat, destination.lng
  );

  return {
    coordinates: [
      [origin.lat, origin.lng],
      [destination.lat, destination.lng]
    ],
    distance,
    duration: Math.round(distance / 50 * 60), // Estimate 50 km/h average
    isRealRoute: false,
  };
};

/**
 * Calculate straight-line distance using Haversine formula
 */
const calculateHaversineDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

/**
 * Format duration for display
 * @param {number} minutes - Duration in minutes
 * @returns {string} Formatted duration string
 */
export const formatDuration = (minutes) => {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}m`;
};

/**
 * Clear the route cache
 */
export const clearRouteCache = () => {
  routeCache.clear();
  inFlightRequests.clear();
};

/**
 * Get cache statistics
 */
export const getCacheStats = () => ({
  size: routeCache.size,
  inFlight: inFlightRequests.size,
});
