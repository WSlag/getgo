// Philippine city coordinates for distance calculations
// Expanded to include all major cities and provincial capitals

export const cityCoordinates = {
  // National Capital Region (NCR)
  'Manila': { lat: 14.5995, lng: 120.9842 },
  'Quezon City': { lat: 14.6760, lng: 121.0437 },
  'Makati': { lat: 14.5547, lng: 121.0244 },
  'Pasig': { lat: 14.5764, lng: 121.0851 },
  'Taguig': { lat: 14.5176, lng: 121.0509 },
  'Parañaque': { lat: 14.4793, lng: 121.0198 },
  'Caloocan': { lat: 14.6488, lng: 120.9839 },
  'Las Piñas': { lat: 14.4445, lng: 120.9939 },
  'Muntinlupa': { lat: 14.4081, lng: 121.0415 },
  'Valenzuela': { lat: 14.7011, lng: 120.9830 },

  // Luzon - Region I (Ilocos)
  'Laoag City': { lat: 18.1978, lng: 120.5934 },
  'Vigan City': { lat: 17.5747, lng: 120.3869 },
  'San Fernando (La Union)': { lat: 16.6159, lng: 120.3209 },
  'Dagupan City': { lat: 16.0433, lng: 120.3333 },
  'Alaminos City': { lat: 16.1553, lng: 119.9807 },
  'Urdaneta City': { lat: 15.9764, lng: 120.5713 },

  // Luzon - Region II (Cagayan Valley)
  'Tuguegarao City': { lat: 17.6132, lng: 121.7270 },
  'Cauayan City': { lat: 16.9318, lng: 121.7731 },
  'Santiago City': { lat: 16.6892, lng: 121.5486 },
  'Ilagan City': { lat: 17.1485, lng: 121.8894 },

  // Luzon - Region III (Central Luzon)
  'San Fernando (Pampanga)': { lat: 15.0286, lng: 120.6937 },
  'Angeles City': { lat: 15.1450, lng: 120.5887 },
  'Olongapo City': { lat: 14.8292, lng: 120.2824 },
  'Malolos City': { lat: 14.8433, lng: 120.8114 },
  'Meycauayan': { lat: 14.7372, lng: 120.9608 },
  'Cabanatuan City': { lat: 15.4866, lng: 120.9669 },
  'Palayan City': { lat: 15.5360, lng: 121.0847 },
  'Tarlac City': { lat: 15.4755, lng: 120.5963 },
  'Balanga City': { lat: 14.6817, lng: 120.5360 },

  // Luzon - Region IV-A (CALABARZON)
  'Calamba City': { lat: 14.2118, lng: 121.1653 },
  'San Pablo City': { lat: 14.0685, lng: 121.3254 },
  'Santa Rosa City': { lat: 14.3122, lng: 121.1114 },
  'Biñan City': { lat: 14.3418, lng: 121.0811 },
  'Cabuyao': { lat: 14.2725, lng: 121.1250 },
  'Batangas City': { lat: 13.7565, lng: 121.0583 },
  'Lipa City': { lat: 13.9411, lng: 121.1625 },
  'Tanauan City': { lat: 14.0863, lng: 121.1470 },
  'Lucena City': { lat: 13.9373, lng: 121.6170 },
  'Tayabas City': { lat: 14.0275, lng: 121.5922 },
  'Antipolo City': { lat: 14.5860, lng: 121.1761 },
  'Cainta': { lat: 14.5796, lng: 121.1227 },
  'Taytay': { lat: 14.5578, lng: 121.1347 },
  'Bacoor City': { lat: 14.4624, lng: 120.9645 },
  'Imus City': { lat: 14.4297, lng: 120.9367 },
  'Dasmariñas City': { lat: 14.3294, lng: 120.9367 },
  'General Trias': { lat: 14.3869, lng: 120.8813 },
  'Cavite City': { lat: 14.4791, lng: 120.8970 },

  // Luzon - Region IV-B (MIMAROPA)
  'Calapan City': { lat: 13.4115, lng: 121.1803 },
  'Puerto Princesa City': { lat: 9.7392, lng: 118.7353 },

  // Luzon - Region V (Bicol)
  'Legazpi City': { lat: 13.1391, lng: 123.7438 },
  'Naga City': { lat: 13.6192, lng: 123.1814 },
  'Iriga City': { lat: 13.4213, lng: 123.4097 },
  'Ligao City': { lat: 13.2327, lng: 123.5289 },
  'Tabaco City': { lat: 13.3584, lng: 123.7337 },
  'Sorsogon City': { lat: 12.9742, lng: 124.0050 },
  'Masbate City': { lat: 12.3684, lng: 123.6204 },

  // Luzon - CAR (Cordillera)
  'Baguio City': { lat: 16.4023, lng: 120.5960 },
  'Tabuk City': { lat: 17.4189, lng: 121.4443 },

  // Visayas - Region VI (Western Visayas)
  'Iloilo City': { lat: 10.7202, lng: 122.5621 },
  'Bacolod City': { lat: 10.6407, lng: 122.9688 },
  'Roxas City': { lat: 11.5851, lng: 122.7511 },
  'Kabankalan City': { lat: 9.9904, lng: 122.8142 },
  'Silay City': { lat: 10.7981, lng: 122.9756 },
  'Talisay City (Negros)': { lat: 10.7344, lng: 122.9670 },
  'San Carlos City (Negros)': { lat: 10.4925, lng: 123.4108 },
  'Sagay City': { lat: 10.8944, lng: 123.4242 },
  'Cadiz City': { lat: 10.9567, lng: 123.3089 },
  'Escalante City': { lat: 10.8406, lng: 123.4983 },
  'Passi City': { lat: 11.1067, lng: 122.6422 },

  // Visayas - Region VII (Central Visayas)
  'Cebu City': { lat: 10.3157, lng: 123.8854 },
  'Mandaue City': { lat: 10.3236, lng: 123.9223 },
  'Lapu-Lapu City': { lat: 10.3103, lng: 123.9494 },
  'Talisay City (Cebu)': { lat: 10.2447, lng: 123.8494 },
  'Danao City': { lat: 10.5200, lng: 124.0289 },
  'Toledo City': { lat: 10.3775, lng: 123.6381 },
  'Carcar City': { lat: 10.1061, lng: 123.6403 },
  'Naga City (Cebu)': { lat: 10.2092, lng: 123.7589 },
  'Bogo City': { lat: 11.0522, lng: 124.0072 },
  'Tagbilaran City': { lat: 9.6500, lng: 123.8500 },
  'Dumaguete City': { lat: 9.3068, lng: 123.3054 },
  'Bais City': { lat: 9.5911, lng: 123.1156 },
  'Bayawan City': { lat: 9.3631, lng: 122.8022 },
  'Guihulngan City': { lat: 10.1147, lng: 123.2756 },
  'Tanjay City': { lat: 9.5161, lng: 123.1594 },
  'Canlaon City': { lat: 10.3833, lng: 123.1833 },

  // Visayas - Region VIII (Eastern Visayas)
  'Tacloban City': { lat: 11.2543, lng: 124.9634 },
  'Ormoc City': { lat: 11.0044, lng: 124.6075 },
  'Calbayog City': { lat: 12.0672, lng: 124.6042 },
  'Catbalogan City': { lat: 11.7753, lng: 124.8861 },
  'Maasin City': { lat: 10.1314, lng: 124.8478 },
  'Baybay City': { lat: 10.6783, lng: 124.8014 },

  // Mindanao - Region IX (Zamboanga Peninsula)
  'Zamboanga City': { lat: 6.9214, lng: 122.0790 },
  'Pagadian City': { lat: 7.8256, lng: 123.4372 },
  'Dipolog City': { lat: 8.5883, lng: 123.3408 },
  'Dapitan City': { lat: 8.6556, lng: 123.4244 },
  'Isabela City': { lat: 6.7042, lng: 121.9689 },

  // Mindanao - Region X (Northern Mindanao)
  'Cagayan de Oro': { lat: 8.4542, lng: 124.6319 },
  'Iligan City': { lat: 8.2280, lng: 124.2452 },
  'Malaybalay City': { lat: 8.1575, lng: 125.1275 },
  'Valencia City': { lat: 7.9069, lng: 125.0942 },
  'Oroquieta City': { lat: 8.4856, lng: 123.8042 },
  'Ozamiz City': { lat: 8.1481, lng: 123.8411 },
  'Tangub City': { lat: 8.0656, lng: 123.7514 },
  'Gingoog City': { lat: 8.8244, lng: 125.1011 },
  'El Salvador City': { lat: 8.5614, lng: 124.5208 },

  // Mindanao - Region XI (Davao)
  'Davao City': { lat: 7.0707, lng: 125.6087 },
  'Tagum City': { lat: 7.4478, lng: 125.8037 },
  'Digos City': { lat: 6.7496, lng: 125.3572 },
  'Panabo City': { lat: 7.3078, lng: 125.6844 },
  'Island Garden City of Samal': { lat: 7.0667, lng: 125.7167 },
  'Mati City': { lat: 6.9547, lng: 126.2167 },

  // Mindanao - Region XII (SOCCSKSARGEN)
  'General Santos': { lat: 6.1164, lng: 125.1716 },
  'Koronadal City': { lat: 6.5025, lng: 124.8461 },
  'Cotabato City': { lat: 7.2236, lng: 124.2464 },
  'Kidapawan City': { lat: 7.0083, lng: 125.0894 },
  'Tacurong City': { lat: 6.6928, lng: 124.6756 },

  // Mindanao - Region XIII (Caraga)
  'Butuan City': { lat: 8.9475, lng: 125.5406 },
  'Surigao City': { lat: 9.7844, lng: 125.4889 },
  'Bislig City': { lat: 8.2147, lng: 126.3164 },
  'Tandag City': { lat: 9.0781, lng: 126.1986 },
  'Cabadbaran City': { lat: 9.1233, lng: 125.5358 },
  'Bayugan City': { lat: 8.7133, lng: 125.7678 },

  // Mindanao - BARMM
  'Marawi City': { lat: 7.9986, lng: 124.2928 },
  'Lamitan City': { lat: 6.6494, lng: 122.1300 },
  'Jolo': { lat: 6.0522, lng: 121.0011 },
  'Bongao': { lat: 5.0292, lng: 119.7731 },
};

// List of all Philippine cities for dropdown/autocomplete
export const philippineCities = Object.keys(cityCoordinates).sort();

// Get coordinates for a city name (with fuzzy matching)
export const getCoordinates = (cityName) => {
  if (!cityName) return { lat: 12.8797, lng: 121.7740 }; // Center of Philippines

  // Exact match first
  if (cityCoordinates[cityName]) {
    return cityCoordinates[cityName];
  }

  // Fuzzy match - check if city name contains or is contained by any key
  const normalized = Object.keys(cityCoordinates).find(
    key => {
      const keyLower = key.toLowerCase();
      const nameLower = cityName.toLowerCase();
      return keyLower.includes(nameLower) ||
             nameLower.includes(keyLower) ||
             keyLower.split(' ')[0] === nameLower.split(' ')[0];
    }
  );

  return cityCoordinates[normalized] || { lat: 12.8797, lng: 121.7740 };
};

// Get all city names for dropdowns
export const getCityNames = () => philippineCities;

// Get cities by region
export const getCitiesByRegion = () => ({
  'NCR': ['Manila', 'Quezon City', 'Makati', 'Pasig', 'Taguig', 'Parañaque', 'Caloocan', 'Las Piñas', 'Muntinlupa', 'Valenzuela'],
  'Luzon North': ['Laoag City', 'Vigan City', 'San Fernando (La Union)', 'Dagupan City', 'Baguio City', 'Tuguegarao City'],
  'Central Luzon': ['San Fernando (Pampanga)', 'Angeles City', 'Olongapo City', 'Malolos City', 'Cabanatuan City', 'Tarlac City'],
  'CALABARZON': ['Calamba City', 'San Pablo City', 'Santa Rosa City', 'Batangas City', 'Lipa City', 'Lucena City', 'Antipolo City'],
  'Bicol': ['Legazpi City', 'Naga City', 'Sorsogon City', 'Masbate City'],
  'Western Visayas': ['Iloilo City', 'Bacolod City', 'Roxas City'],
  'Central Visayas': ['Cebu City', 'Mandaue City', 'Lapu-Lapu City', 'Tagbilaran City', 'Dumaguete City'],
  'Eastern Visayas': ['Tacloban City', 'Ormoc City', 'Calbayog City'],
  'Zamboanga Peninsula': ['Zamboanga City', 'Pagadian City', 'Dipolog City'],
  'Northern Mindanao': ['Cagayan de Oro', 'Iligan City', 'Malaybalay City', 'Ozamiz City'],
  'Davao Region': ['Davao City', 'Tagum City', 'Digos City', 'Panabo City', 'Mati City'],
  'SOCCSKSARGEN': ['General Santos', 'Koronadal City', 'Cotabato City', 'Kidapawan City'],
  'Caraga': ['Butuan City', 'Surigao City', 'Bislig City', 'Tandag City'],
});

// Calculate distance between two coordinates (Haversine formula)
export const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};
