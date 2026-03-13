const DEFAULT_COORDS = Object.freeze({ lat: 7.5, lng: 124.5 });

const CITY_COORDINATES = Object.freeze({
  'Davao City': { lat: 7.0707, lng: 125.6087 },
  'Cebu City': { lat: 10.3157, lng: 123.8854 },
  'General Santos': { lat: 6.1164, lng: 125.1716 },
  'Cagayan de Oro': { lat: 8.4542, lng: 124.6319 },
  'Manila': { lat: 14.5995, lng: 120.9842 },
  'Zamboanga City': { lat: 6.9214, lng: 122.0790 },
  'Butuan City': { lat: 8.9475, lng: 125.5406 },
  'Tagum City': { lat: 7.4478, lng: 125.8037 },
  'Digos City': { lat: 6.7496, lng: 125.3572 },
  'Cotabato City': { lat: 7.2236, lng: 124.2464 },
  'Iligan City': { lat: 8.2280, lng: 124.2452 },
  'Tacloban City': { lat: 11.2543, lng: 124.9634 },
  'Iloilo City': { lat: 10.7202, lng: 122.5621 },
  'Bacolod City': { lat: 10.6407, lng: 122.9688 },
});

function parseCoordinate(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isValidLatitude(value) {
  return typeof value === 'number' && value >= -90 && value <= 90;
}

function isValidLongitude(value) {
  return typeof value === 'number' && value >= -180 && value <= 180;
}

function isValidLatLng(lat, lng) {
  return isValidLatitude(lat) && isValidLongitude(lng);
}

function roundCoord(value, precision = 6) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(precision));
}

function normalizeCoordinatePair(lat, lng, precision = 6) {
  const parsedLat = parseCoordinate(lat);
  const parsedLng = parseCoordinate(lng);
  if (!isValidLatLng(parsedLat, parsedLng)) {
    return null;
  }
  return {
    lat: roundCoord(parsedLat, precision),
    lng: roundCoord(parsedLng, precision),
  };
}

function getCoordinatesByName(cityName, fallback = DEFAULT_COORDS) {
  if (!cityName || typeof cityName !== 'string') {
    return { ...fallback };
  }

  const normalized = Object.keys(CITY_COORDINATES).find((key) => {
    const keyLower = key.toLowerCase();
    const cityLower = cityName.toLowerCase();
    return (
      keyLower.includes(cityLower) ||
      cityLower.includes(keyLower) ||
      cityLower.includes(keyLower.split(' ')[0])
    );
  });

  return normalized ? { ...CITY_COORDINATES[normalized] } : { ...fallback };
}

function resolveCoordinatePair({ lat, lng, name, fallback = DEFAULT_COORDS } = {}) {
  const direct = normalizeCoordinatePair(lat, lng);
  if (direct) {
    return direct;
  }

  const byName = getCoordinatesByName(name, fallback);
  return {
    lat: roundCoord(byName.lat),
    lng: roundCoord(byName.lng),
  };
}

function calculateHaversineDistanceKm(lat1, lng1, lat2, lng2) {
  const c1 = normalizeCoordinatePair(lat1, lng1);
  const c2 = normalizeCoordinatePair(lat2, lng2);
  if (!c1 || !c2) return 0;

  const R = 6371;
  const dLat = (c2.lat - c1.lat) * Math.PI / 180;
  const dLng = (c2.lng - c1.lng) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(c1.lat * Math.PI / 180) * Math.cos(c2.lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toWholeKm(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.round(num));
}

function clampPercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  if (num < 0) return 0;
  if (num > 100) return 100;
  return Math.round(num);
}

function computeProgressTowardDestination({
  origin,
  destination,
  current,
  previousProgress = 0,
}) {
  const prev = clampPercent(previousProgress);
  const originCoords = normalizeCoordinatePair(origin?.lat, origin?.lng);
  const destCoords = normalizeCoordinatePair(destination?.lat, destination?.lng);
  const currentCoords = normalizeCoordinatePair(current?.lat, current?.lng);

  if (!originCoords || !destCoords || !currentCoords) {
    return prev;
  }

  const totalDistance = calculateHaversineDistanceKm(
    originCoords.lat,
    originCoords.lng,
    destCoords.lat,
    destCoords.lng
  );

  if (totalDistance <= 0) {
    return prev;
  }

  const distanceToDestination = calculateHaversineDistanceKm(
    currentCoords.lat,
    currentCoords.lng,
    destCoords.lat,
    destCoords.lng
  );

  const computed = clampPercent((1 - (distanceToDestination / totalDistance)) * 100);
  return Math.max(prev, computed);
}

module.exports = {
  DEFAULT_COORDS,
  CITY_COORDINATES,
  parseCoordinate,
  isValidLatitude,
  isValidLongitude,
  isValidLatLng,
  normalizeCoordinatePair,
  getCoordinatesByName,
  resolveCoordinatePair,
  calculateHaversineDistanceKm,
  toWholeKm,
  clampPercent,
  computeProgressTowardDestination,
};
