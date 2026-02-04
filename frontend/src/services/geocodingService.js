/**
 * Geocoding Service - OpenRouteService API Integration
 * Provides address search (geocoding) and reverse geocoding
 */

const ORS_API_KEY = import.meta.env.VITE_OPENROUTE_API_KEY;
const ORS_BASE_URL = 'https://api.openrouteservice.org';

// Cache for geocoding results
const geocodeCache = new Map();

/**
 * Search for addresses/places (forward geocoding)
 * @param {string} query - Search text
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Array of location results
 */
export const searchAddress = async (query, options = {}) => {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const cacheKey = `search:${query.toLowerCase()}`;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  // If no API key, return empty (will fall back to city list)
  if (!ORS_API_KEY) {
    console.warn('OpenRouteService API key not configured. Address search unavailable.');
    return [];
  }

  try {
    const params = new URLSearchParams({
      api_key: ORS_API_KEY,
      text: query,
      'boundary.country': 'PH', // Limit to Philippines
      size: options.limit || 5,
    });

    // Focus results around Philippines center
    if (options.focusLat && options.focusLng) {
      params.append('focus.point.lat', options.focusLat);
      params.append('focus.point.lon', options.focusLng);
    } else {
      // Default focus: Central Philippines
      params.append('focus.point.lat', '12.8797');
      params.append('focus.point.lon', '121.7740');
    }

    const response = await fetch(`${ORS_BASE_URL}/geocode/search?${params}`);

    if (!response.ok) {
      console.error('Geocoding error:', response.status);
      return [];
    }

    const data = await response.json();

    const results = data.features?.map(feature => ({
      id: feature.properties.id || feature.properties.gid,
      name: feature.properties.name,
      label: feature.properties.label,
      region: feature.properties.region,
      county: feature.properties.county,
      locality: feature.properties.locality,
      lat: feature.geometry.coordinates[1],
      lng: feature.geometry.coordinates[0],
      type: feature.properties.layer, // venue, address, locality, region, etc.
    })) || [];

    // Cache results
    geocodeCache.set(cacheKey, results);

    return results;
  } catch (error) {
    console.error('Geocoding search failed:', error);
    return [];
  }
};

/**
 * Get address from coordinates (reverse geocoding)
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<Object|null>} Location details or null
 */
export const reverseGeocode = async (lat, lng) => {
  const cacheKey = `reverse:${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  if (!ORS_API_KEY) {
    console.warn('OpenRouteService API key not configured. Reverse geocoding unavailable.');
    return null;
  }

  try {
    const params = new URLSearchParams({
      api_key: ORS_API_KEY,
      'point.lat': lat,
      'point.lon': lng,
      size: 1,
    });

    const response = await fetch(`${ORS_BASE_URL}/geocode/reverse?${params}`);

    if (!response.ok) {
      console.error('Reverse geocoding error:', response.status);
      return null;
    }

    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      return null;
    }

    const feature = data.features[0];
    const result = {
      name: feature.properties.name,
      label: feature.properties.label,
      locality: feature.properties.locality,
      region: feature.properties.region,
      county: feature.properties.county,
      lat: feature.geometry.coordinates[1],
      lng: feature.geometry.coordinates[0],
    };

    geocodeCache.set(cacheKey, result);

    return result;
  } catch (error) {
    console.error('Reverse geocoding failed:', error);
    return null;
  }
};

/**
 * Autocomplete suggestions for address input
 * @param {string} query - Partial address text
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Array of suggestions
 */
export const autocomplete = async (query, options = {}) => {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const cacheKey = `auto:${query.toLowerCase()}`;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  if (!ORS_API_KEY) {
    return [];
  }

  try {
    const params = new URLSearchParams({
      api_key: ORS_API_KEY,
      text: query,
      'boundary.country': 'PH',
      size: options.limit || 5,
      layers: 'locality,county,region,address', // Focus on relevant layers
    });

    // Focus around Philippines
    params.append('focus.point.lat', '12.8797');
    params.append('focus.point.lon', '121.7740');

    const response = await fetch(`${ORS_BASE_URL}/geocode/autocomplete?${params}`);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();

    const results = data.features?.map(feature => ({
      id: feature.properties.id || feature.properties.gid,
      name: feature.properties.name,
      label: feature.properties.label,
      region: feature.properties.region,
      lat: feature.geometry.coordinates[1],
      lng: feature.geometry.coordinates[0],
      type: feature.properties.layer,
    })) || [];

    geocodeCache.set(cacheKey, results);

    return results;
  } catch (error) {
    console.error('Autocomplete failed:', error);
    return [];
  }
};

/**
 * Clear the geocoding cache
 */
export const clearGeocodingCache = () => {
  geocodeCache.clear();
};

/**
 * Check if geocoding API is available
 */
export const isGeocodingAvailable = () => {
  return !!ORS_API_KEY;
};
