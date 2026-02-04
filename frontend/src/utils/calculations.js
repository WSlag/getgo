import { getCoordinates } from './cityCoordinates';

// Calculate distance between two points using Haversine formula
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

// Calculate total route distance from waypoints array
export const calculateTotalRouteDistance = (waypoints) => {
  let total = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    total += calculateDistance(
      waypoints[i].lat, waypoints[i].lng,
      waypoints[i + 1].lat, waypoints[i + 1].lng
    );
  }
  return total;
};

// Find backload opportunities along a trucker's route
export const findBackloadOpportunities = (truckerRoute, cargoListings, maxDetourKm = 50) => {
  const opportunities = [];

  cargoListings.forEach(cargo => {
    if (cargo.status !== 'open') return;

    const cargoOrigin = cargo.originCoords;
    const cargoDest = cargo.destCoords;

    // Check if cargo origin is near trucker's route
    const detourToPickup = calculateDistance(
      truckerRoute.destCoords.lat, truckerRoute.destCoords.lng,
      cargoOrigin.lat, cargoOrigin.lng
    );

    // Check if cargo destination is near trucker's final destination
    const detourFromDelivery = calculateDistance(
      cargoDest.lat, cargoDest.lng,
      truckerRoute.originCoords.lat, truckerRoute.originCoords.lng
    );

    const totalDetour = detourToPickup + detourFromDelivery;

    if (totalDetour <= maxDetourKm) {
      opportunities.push({
        ...cargo,
        detourKm: totalDetour,
        savings: Math.round((1 - totalDetour / (cargo.distance || 100)) * 40),
        matchScore: Math.round(100 - (totalDetour / maxDetourKm) * 100)
      });
    }
  });

  return opportunities.sort((a, b) => b.matchScore - a.matchScore);
};

// Fuel rates by vehicle type (km per liter)
const fuelRates = {
  'Multicab': 8,
  'L300': 7,
  'H100': 7,
  '4W': 6,
  '6W': 4,
  '10W': 3,
  '12W': 2.5,
  'Prime Mover': 2,
};

// Estimate fuel cost for a trip
export const estimateFuelCost = (distanceKm, vehicleType, fuelPricePerLiter = 65) => {
  let kmPerLiter = 5; // default

  Object.keys(fuelRates).forEach(key => {
    if (vehicleType && vehicleType.includes(key)) {
      kmPerLiter = fuelRates[key];
    }
  });

  const litersNeeded = distanceKm / kmPerLiter;
  return Math.round(litersNeeded * fuelPricePerLiter);
};

// Calculate route efficiency score
export const calculateRouteEfficiency = (earnings, distanceKm, vehicleType) => {
  const fuelCost = estimateFuelCost(distanceKm, vehicleType);
  const netEarnings = earnings - fuelCost;
  const earningsPerKm = netEarnings / distanceKm;

  // Score based on earnings per km (good is > 15 PHP/km)
  const score = Math.min(100, Math.round((earningsPerKm / 20) * 100));
  return { score, fuelCost, netEarnings, earningsPerKm: earningsPerKm.toFixed(2) };
};

// Route Optimization Algorithm (Nearest Neighbor TSP approximation)
export const optimizeRoute = (waypoints) => {
  if (waypoints.length <= 2) return { route: waypoints, totalDistance: 0, savings: 0 };

  const visited = [waypoints[0]];
  const unvisited = waypoints.slice(1);
  let totalDistance = 0;

  while (unvisited.length > 0) {
    const current = visited[visited.length - 1];
    let nearestIdx = 0;
    let nearestDist = Infinity;

    unvisited.forEach((point, idx) => {
      const dist = calculateDistance(current.lat, current.lng, point.lat, point.lng);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = idx;
      }
    });

    totalDistance += nearestDist;
    visited.push(unvisited[nearestIdx]);
    unvisited.splice(nearestIdx, 1);
  }

  // Calculate original distance (sequential)
  let originalDistance = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    originalDistance += calculateDistance(
      waypoints[i].lat, waypoints[i].lng,
      waypoints[i + 1].lat, waypoints[i + 1].lng
    );
  }

  const savings = Math.max(0, originalDistance - totalDistance);
  const savingsPercent = originalDistance > 0 ? Math.round((savings / originalDistance) * 100) : 0;

  return { route: visited, totalDistance, originalDistance, savings, savingsPercent };
};

// Find matching backloads for a route
export const findBackloadMatches = (origin, destination, listings) => {
  const originCoords = getCoordinates(origin);
  const destCoords = getCoordinates(destination);

  return listings.filter(listing => {
    const listingOrigin = getCoordinates(listing.origin);
    const listingDest = getCoordinates(listing.destination);

    const originToListingOrigin = calculateDistance(originCoords.lat, originCoords.lng, listingOrigin.lat, listingOrigin.lng);
    const listingDestToFinalDest = calculateDistance(listingDest.lat, listingDest.lng, destCoords.lat, destCoords.lng);
    const directDistance = calculateDistance(originCoords.lat, originCoords.lng, destCoords.lat, destCoords.lng);

    const isAlongRoute = (originToListingOrigin < 100) && (listingDestToFinalDest < directDistance);

    return isAlongRoute && listing.status === 'open';
  }).map(listing => {
    const listingOrigin = getCoordinates(listing.origin);
    const listingDest = getCoordinates(listing.destination);
    const detourDistance = calculateDistance(originCoords.lat, originCoords.lng, listingOrigin.lat, listingOrigin.lng) +
      calculateDistance(listingOrigin.lat, listingOrigin.lng, listingDest.lat, listingDest.lng);

    return {
      ...listing,
      detourKm: Math.round(detourDistance),
      matchScore: Math.round(100 - (detourDistance / 10)),
    };
  }).sort((a, b) => b.matchScore - a.matchScore).slice(0, 5);
};

// Calculate fuel savings
export const calculateFuelSavings = (distanceSaved, fuelPricePerLiter = 65, kmPerLiter = 4) => {
  const litersSaved = distanceSaved / kmPerLiter;
  return Math.round(litersSaved * fuelPricePerLiter);
};

// Estimate trip duration
export const estimateDuration = (distanceKm, avgSpeedKmh = 50) => {
  const hours = distanceKm / avgSpeedKmh;
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  return `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m`;
};

// Contact masking utility (hide phone numbers, emails, FB links)
export const maskContact = (text) => {
  if (!text) return text;
  let masked = text.replace(/(\+?63|0)?[\s-]?(9\d{2})[\s-]?(\d{3})[\s-]?(\d{4})/g, '[Hidden]');
  masked = masked.replace(/(facebook\.com|fb\.com|messenger\.com|m\.me|FB:|Messenger:)[\/\w\-\.\s]*/gi, '[Hidden]');
  masked = masked.replace(/[\w\.-]+@[\w\.-]+\.\w+/g, '[Hidden]');
  return masked;
};
