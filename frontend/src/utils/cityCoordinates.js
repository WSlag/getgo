// Philippine city coordinates for distance calculations
export const cityCoordinates = {
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

// Get coordinates for a city name (with fuzzy matching)
export const getCoordinates = (cityName) => {
  if (!cityName) return { lat: 7.5, lng: 124.5 }; // Default center of Mindanao

  const normalized = Object.keys(cityCoordinates).find(
    key => key.toLowerCase().includes(cityName.toLowerCase()) ||
           cityName.toLowerCase().includes(key.toLowerCase().split(' ')[0])
  );
  return cityCoordinates[normalized] || { lat: 7.5, lng: 124.5 };
};

// Get all city names for dropdowns
export const getCityNames = () => Object.keys(cityCoordinates);
