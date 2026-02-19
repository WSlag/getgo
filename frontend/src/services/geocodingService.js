/**
 * Geocoding Service - Cloud Function Proxy Integration
 * Uses backend proxy to keep provider credentials out of client bundles.
 */

import { getAppCheckHeaders } from './appCheckService';

const functionsRegion = import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || 'asia-southeast1';
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
const emulatorHost = import.meta.env.VITE_FIREBASE_EMULATOR_HOST || '127.0.0.1';
const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';
const configuredGeocodeProxyUrl = import.meta.env.VITE_GEOCODE_PROXY_URL;

const GEOCODE_PROXY_URL = configuredGeocodeProxyUrl ||
  (projectId
    ? (useEmulator
      ? `http://${emulatorHost}:5001/${projectId}/${functionsRegion}/geocode`
      : `https://${functionsRegion}-${projectId}.cloudfunctions.net/geocode`)
    : null);

const geocodeCache = new Map();

function mapFeature(feature) {
  return {
    id: feature.properties?.id || feature.properties?.gid || `${feature.properties?.label || 'loc'}`,
    name: feature.properties?.name || feature.properties?.label || '',
    label: feature.properties?.label || feature.properties?.name || '',
    region: feature.properties?.region || '',
    county: feature.properties?.county || '',
    locality: feature.properties?.locality || '',
    lat: feature.geometry?.coordinates?.[1],
    lng: feature.geometry?.coordinates?.[0],
    type: feature.properties?.layer || '',
  };
}

async function requestGeocode(endpoint, params) {
  if (!GEOCODE_PROXY_URL) return null;

  const query = new URLSearchParams({ endpoint });
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    query.set(key, String(value));
  });

  const appCheckHeaders = await getAppCheckHeaders();
  const response = await fetch(`${GEOCODE_PROXY_URL}?${query.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...appCheckHeaders,
    },
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

export const searchAddress = async (query, options = {}) => {
  if (!query || query.trim().length < 2) return [];

  const cacheKey = `search:${query.toLowerCase()}`;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  try {
    const payload = {
      text: query,
      'boundary.country': 'PH',
      size: options.limit || 5,
      'focus.point.lat': options.focusLat || '12.8797',
      'focus.point.lon': options.focusLng || '121.7740',
    };
    const data = await requestGeocode('search', payload);
    const results = (data?.features || []).map(mapFeature);
    geocodeCache.set(cacheKey, results);
    return results;
  } catch (error) {
    console.error('Geocoding search failed:', error);
    return [];
  }
};

export const reverseGeocode = async (lat, lng) => {
  const cacheKey = `reverse:${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  try {
    const payload = {
      'point.lat': lat,
      'point.lon': lng,
      size: 1,
    };
    const data = await requestGeocode('reverse', payload);
    if (!data?.features || data.features.length === 0) return null;
    const result = mapFeature(data.features[0]);
    geocodeCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Reverse geocoding failed:', error);
    return null;
  }
};

export const autocomplete = async (query, options = {}) => {
  if (!query || query.trim().length < 2) return [];

  const cacheKey = `auto:${query.toLowerCase()}`;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  try {
    const payload = {
      text: query,
      'boundary.country': 'PH',
      size: options.limit || 5,
      layers: 'locality,county,region,address',
      'focus.point.lat': '12.8797',
      'focus.point.lon': '121.7740',
    };
    const data = await requestGeocode('autocomplete', payload);
    const results = (data?.features || []).map(mapFeature);
    geocodeCache.set(cacheKey, results);
    return results;
  } catch (error) {
    console.error('Autocomplete failed:', error);
    return [];
  }
};

export const clearGeocodingCache = () => {
  geocodeCache.clear();
};

export const isGeocodingAvailable = () => !!GEOCODE_PROXY_URL;
