/**
 * Listings & Route Optimization Cloud Functions
 * Handles backload matching and popular routes
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Haversine formula to calculate distance between two coordinates (in km)
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Philippine city coordinates for lookup
const cityCoordinates = {
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
};

function getCoordinates(cityName) {
  if (!cityName) return { lat: 7.5, lng: 124.5 };
  const normalized = Object.keys(cityCoordinates).find(
    key => key.toLowerCase().includes(cityName.toLowerCase()) ||
      cityName.toLowerCase().includes(key.toLowerCase().split(' ')[0])
  );
  return cityCoordinates[normalized] || { lat: 7.5, lng: 124.5 };
}

/**
 * Find Backload Opportunities
 * Finds cargo listings near trucker's destination
 */
exports.findBackloadOpportunities = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { origin, destination, originLat, originLng, destLat, destLng, maxDetourKm = 50 } = data;

  if (!origin || !destination) {
    throw new functions.https.HttpsError('invalid-argument', 'Origin and destination are required');
  }

  const db = admin.firestore();

  // Use provided coordinates or look them up
  const destCoords = destLat && destLng
    ? { lat: destLat, lng: destLng }
    : getCoordinates(destination);

  // Get open cargo listings
  const listingsSnap = await db.collection('cargoListings')
    .where('status', '==', 'open')
    .limit(100)
    .get();

  const matches = [];

  listingsSnap.docs.forEach(doc => {
    const listing = { id: doc.id, ...doc.data() };

    // Calculate distance from listing origin to trucker's destination
    const listingOriginCoords = listing.originLat && listing.originLng
      ? { lat: listing.originLat, lng: listing.originLng }
      : getCoordinates(listing.origin);

    const distance = calculateDistance(
      destCoords.lat,
      destCoords.lng,
      listingOriginCoords.lat,
      listingOriginCoords.lng
    );

    // If listing origin is within detour range of trucker's destination
    if (distance <= maxDetourKm) {
      matches.push({
        ...listing,
        originDistance: Math.round(distance),
        matchScore: 100 - (distance / maxDetourKm) * 100, // Higher score for closer matches
      });
    }
  });

  // Sort by match score (distance)
  matches.sort((a, b) => b.matchScore - a.matchScore);

  return {
    matches: matches.slice(0, 20), // Return top 20 matches
    total: matches.length,
  };
});

/**
 * Get Popular Routes
 * Returns frequently traveled routes based on completed contracts
 */
exports.getPopularRoutes = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const db = admin.firestore();

  // Get completed contracts
  const contractsSnap = await db.collection('contracts')
    .where('status', 'in', ['signed', 'completed'])
    .limit(500)
    .get();

  // Count routes
  const routeCounts = {};

  contractsSnap.docs.forEach(doc => {
    const contract = doc.data();
    const route = `${contract.pickupAddress} → ${contract.deliveryAddress}`;

    if (routeCounts[route]) {
      routeCounts[route].count++;
      routeCounts[route].totalPrice += contract.agreedPrice || 0;
    } else {
      routeCounts[route] = {
        origin: contract.pickupAddress,
        destination: contract.deliveryAddress,
        count: 1,
        totalPrice: contract.agreedPrice || 0,
      };
    }
  });

  // Convert to array and calculate average price
  const routes = Object.entries(routeCounts).map(([route, data]) => ({
    route,
    origin: data.origin,
    destination: data.destination,
    count: data.count,
    averagePrice: Math.round(data.totalPrice / data.count),
  }));

  // Sort by frequency
  routes.sort((a, b) => b.count - a.count);

  return {
    routes: routes.slice(0, 20), // Top 20 popular routes
  };
});
