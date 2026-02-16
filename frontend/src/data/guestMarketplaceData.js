import { getCoordinates } from '../utils/cityCoordinates';

const cargoRoutes = [
  { origin: 'Davao City', destination: 'Manila', distanceKm: 977, hours: 20 },
  { origin: 'Cebu City', destination: 'Cagayan de Oro', distanceKm: 255, hours: 6 },
  { origin: 'General Santos', destination: 'Iloilo City', distanceKm: 670, hours: 15 },
  { origin: 'Bacolod', destination: 'Quezon City', distanceKm: 692, hours: 14 },
  { origin: 'Tagum', destination: 'Butuan', distanceKm: 278, hours: 7 },
  { origin: 'Naga', destination: 'Calamba', distanceKm: 410, hours: 9 },
  { origin: 'Legazpi', destination: 'Pasig', distanceKm: 530, hours: 11 },
  { origin: 'Iligan', destination: 'Dumaguete', distanceKm: 365, hours: 9 },
  { origin: 'Zamboanga', destination: 'Cebu City', distanceKm: 880, hours: 19 },
  { origin: 'Angeles', destination: 'Puerto Princesa', distanceKm: 780, hours: 17 },
  { origin: 'Koronadal', destination: 'Cagayan de Oro', distanceKm: 420, hours: 10 },
  { origin: 'Sorsogon', destination: 'Makati', distanceKm: 560, hours: 12 },
];

const cargoProfilesByRegion = {
  luzon: [
    'Dela Cruz Trading Co.',
    'Garcia Food Distributors',
    'Ramos Builders Cargo',
    'Aquino Market Distribution',
    'Cruz Commodity Movers',
    'Lopez Goods Transport',
    'Santos Metro Freight',
    'Villanueva Luzon Supply',
  ],
  visayas: [
    'Reyes VisMin Cargo',
    'Flores Interisland Logistics',
    'Bautista Retail Freight',
    'Gonzales Island Distribution',
    'Mendoza Portside Cargo',
    'Rivera Visayas Trading',
    'Castillo Central Hub Movers',
    'Francisco Coastal Supply',
  ],
  mindanao: [
    'Santos Mindanao Freight',
    'Dela Pena Agro Transport',
    'Torres Southern Cargo',
    'Lim Frontier Logistics',
    'Navarro Harvest Movers',
    'Uy Regional Supply Chain',
    'Padilla Industrial Freight',
    'Domingo Cargo Solutions',
  ],
};

const cargoTypes = [
  'Retail Goods',
  'Dry Food',
  'Construction Materials',
  'Beverages',
  'Cold Chain Produce',
  'Industrial Parts',
  'Ecommerce Parcels',
  'Agricultural Inputs',
];

const vehicleNeeds = [
  '6-Wheeler',
  '10-Wheeler',
  'Wing Van',
  'Reefer Truck',
  'Forward Truck',
  'Trailer Truck',
];

const truckProfilesByRegion = {
  luzon: [
    'John Paul Dela Cruz',
    'Joshua Garcia',
    'Mark Anthony Reyes',
    'Christian Gonzales',
    'Adrian Aquino',
    'Jerome Rivera',
    'Daniel Lopez',
    'Kenneth Francisco',
  ],
  visayas: [
    'Ramon Bautista',
    'Joel Flores',
    'Michael Ramos',
    'Jericho Villanueva',
    'Ronel Castillo',
    'Jayson Mendoza',
    'Carlo Rivera',
    'Nikko Santos',
  ],
  mindanao: [
    'Arvin Navarro',
    'Noel Torres',
    'Angelo Padilla',
    'Rogelio Lim',
    'Jude Uy',
    'Bryan Domingo',
    'Marvin Dela Pena',
    'Ralph Sison',
  ],
};

const truckTypes = [
  'Wing Van',
  'Reefer',
  'Forward Truck',
  'Trailer',
  'Dropside',
  'Boom Truck',
];

const cargoStatuses = ['open', 'open', 'waiting', 'negotiating', 'open', 'waiting'];
const truckStatuses = ['available', 'available', 'in-transit', 'booked', 'available'];
const cargoDescriptions = [
  'Palletized dry goods, forklift loading available.',
  'Temperature-sensitive produce, early pickup preferred.',
  'Construction materials with weatherproof covering.',
  'Retail cartons for hub-to-hub delivery.',
  'Industrial spare parts with secure handling required.',
  'Mixed FMCG cargo, sealed and documented.',
  'Bulk packaging supplies for regional distribution.',
  'Food-grade products, careful stacking requested.',
];

const truckDescriptions = [
  'Clean unit, long-haul ready with verified documents.',
  'Experienced driver available for inter-island routes.',
  'Well-maintained fleet vehicle with tracking enabled.',
  'Flexible schedule for same-day and next-day dispatch.',
  'Suitable for palletized cargo and protected freight.',
  'Reliable route history with on-time delivery record.',
  'Ready for contract loads and recurring trips.',
  'Capacity optimized for provincial and metro lanes.',
];

const pad = (value) => String(value).padStart(3, '0');

const cityRegion = {
  Manila: 'luzon',
  'Quezon City': 'luzon',
  Pasig: 'luzon',
  Makati: 'luzon',
  Calamba: 'luzon',
  Naga: 'luzon',
  Legazpi: 'luzon',
  Angeles: 'luzon',
  Sorsogon: 'luzon',
  'Puerto Princesa': 'luzon',
  'Cebu City': 'visayas',
  Bacolod: 'visayas',
  'Iloilo City': 'visayas',
  Dumaguete: 'visayas',
  'Davao City': 'mindanao',
  'General Santos': 'mindanao',
  Tagum: 'mindanao',
  Iligan: 'mindanao',
  Zamboanga: 'mindanao',
  Koronadal: 'mindanao',
  'Cagayan de Oro': 'mindanao',
  Butuan: 'mindanao',
};

const getRegionForCity = (city) => cityRegion[city] || 'luzon';

const formatTimeAgo = (index) => {
  if (index % 6 === 0) return 'Just now';
  if (index % 6 <= 3) return `${(index % 6) + 1} hours ago`;
  return `${Math.floor(index / 6) + 1} days ago`;
};

const buildCargoListings = (count = 44) =>
  Array.from({ length: count }, (_, idx) => {
    const route = cargoRoutes[idx % cargoRoutes.length];
    const region = getRegionForCity(route.origin);
    const profiles = cargoProfilesByRegion[region];
    const profile = profiles[(idx * 3 + route.distanceKm) % profiles.length];
    const status = cargoStatuses[idx % cargoStatuses.length];
    const weightTons = 8 + (idx % 18);
    const basePrice = 42000 + route.distanceKm * 58 + (idx % 7) * 4200;
    const originCoords = getCoordinates(route.origin);
    const destCoords = getCoordinates(route.destination);

    return {
      id: `guest-cargo-${pad(idx + 1)}`,
      type: 'cargo',
      shipper: profile,
      company: profile,
      shipperId: `guest-shipper-${pad(idx + 1)}`,
      userId: `guest-shipper-${pad(idx + 1)}`,
      origin: route.origin,
      destination: route.destination,
      originCoords,
      destCoords,
      originLat: originCoords.lat,
      originLng: originCoords.lng,
      destLat: destCoords.lat,
      destLng: destCoords.lng,
      weight: weightTons,
      unit: 'tons',
      cargoType: cargoTypes[idx % cargoTypes.length],
      vehicleNeeded: vehicleNeeds[idx % vehicleNeeds.length],
      askingPrice: Math.round(basePrice / 1000) * 1000,
      status,
      distance: `${route.distanceKm} km`,
      estimatedTime: `${route.hours} hrs`,
      bidCount: status === 'open' ? (idx % 9) : (idx % 4),
      timeAgo: formatTimeAgo(idx),
      postedAt: Date.now() - idx * 3600000,
      description: cargoDescriptions[idx % cargoDescriptions.length],
      category: 'CARGO',
      pickupDate: 'Flexible',
      images: [],
      cargoPhotos: [],
    };
  });

const buildTruckListings = (count = 36) =>
  Array.from({ length: count }, (_, idx) => {
    const route = cargoRoutes[(idx + 3) % cargoRoutes.length];
    const region = getRegionForCity(route.origin);
    const profiles = truckProfilesByRegion[region];
    const trucker = profiles[(idx * 2 + route.hours) % profiles.length];
    const status = truckStatuses[idx % truckStatuses.length];
    const baseRate = 32000 + route.distanceKm * 46 + (idx % 5) * 3100;
    const originCoords = getCoordinates(route.origin);
    const destCoords = getCoordinates(route.destination);

    return {
      id: `guest-truck-${pad(idx + 1)}`,
      type: 'truck',
      trucker,
      truckerId: `guest-trucker-${pad(idx + 1)}`,
      userId: `guest-trucker-${pad(idx + 1)}`,
      truckerRating: 4.2 + ((idx % 7) * 0.1),
      truckerTransactions: 18 + idx * 3,
      origin: route.origin,
      destination: route.destination,
      originCoords,
      destCoords,
      originLat: originCoords.lat,
      originLng: originCoords.lng,
      destLat: destCoords.lat,
      destLng: destCoords.lng,
      vehicleType: truckTypes[idx % truckTypes.length],
      plateNumber: `LTO-${4200 + idx}`,
      capacity: `${10 + (idx % 20)} tons`,
      askingRate: Math.round(baseRate / 1000) * 1000,
      status,
      postedAt: Date.now() - idx * 2800000,
      distance: `${route.distanceKm} km`,
      estimatedTime: `${route.hours} hrs`,
      bidCount: idx % 6,
      availableDate: 'Today',
      description: truckDescriptions[idx % truckDescriptions.length],
      truckPhotos: [],
    };
  });

export const guestCargoListings = buildCargoListings();
export const guestTruckListings = buildTruckListings();

export const guestActiveShipments = [
  {
    id: 'guest-shipment-001',
    status: 'picked_up',
    trackingNumber: 'KRG-2401',
    progress: 36,
    origin: 'Davao City',
    destination: 'Manila',
    currentLocation: { name: 'Pagadian Transit Hub' },
    lastUpdate: '12 min ago',
  },
  {
    id: 'guest-shipment-002',
    status: 'in_transit',
    trackingNumber: 'KRG-2402',
    progress: 58,
    origin: 'Cebu City',
    destination: 'Iloilo City',
    currentLocation: { name: 'Guimaras Channel' },
    lastUpdate: '5 min ago',
  },
  {
    id: 'guest-shipment-003',
    status: 'in_transit',
    trackingNumber: 'KRG-2403',
    progress: 74,
    origin: 'General Santos',
    destination: 'Cagayan de Oro',
    currentLocation: { name: 'Malaybalay Bypass' },
    lastUpdate: '18 min ago',
  },
];
