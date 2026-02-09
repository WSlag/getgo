/**
 * Address formatting utilities for Karga platform
 * Handles composition and parsing of pickup/delivery addresses
 * with backwards compatibility for city-only listings
 */

/**
 * Format full address for display
 * Handles backwards compatibility with city-only listings
 *
 * @param {string} city - City name (e.g., "Davao City")
 * @param {string} streetAddress - Street-level details (e.g., "123 Main St, Bldg A")
 * @returns {string} Full formatted address or city-only if no street address
 *
 * @example
 * formatFullAddress('Davao City', '123 Main St, Bldg A')
 * // Returns: "123 Main St, Bldg A, Davao City"
 *
 * formatFullAddress('Davao City', '')
 * // Returns: "Davao City"
 */
export function formatFullAddress(city, streetAddress) {
  if (!streetAddress || streetAddress.trim() === '') {
    return city;
  }
  return `${streetAddress}, ${city}`;
}

/**
 * Parse address data for display
 * Returns structured address components
 *
 * @param {Object|string} addressData - Address data (new format: object, old format: string)
 * @returns {Object} { fullAddress, city, street, hasStreet }
 *
 * @example
 * // New format (with street address)
 * parseAddress({ city: 'Davao City', streetAddress: '123 Main St' })
 * // Returns: {
 * //   fullAddress: '123 Main St, Davao City',
 * //   city: 'Davao City',
 * //   street: '123 Main St',
 * //   hasStreet: true
 * // }
 *
 * // Old format (city-only, backwards compatible)
 * parseAddress('Davao City')
 * // Returns: {
 * //   fullAddress: 'Davao City',
 * //   city: 'Davao City',
 * //   street: '',
 * //   hasStreet: false
 * // }
 */
export function parseAddress(addressData) {
  // New format: separate city and street fields
  if (addressData && typeof addressData === 'object' && addressData.city !== undefined) {
    const street = addressData.streetAddress || '';
    return {
      fullAddress: formatFullAddress(addressData.city, street),
      city: addressData.city,
      street: street,
      hasStreet: Boolean(street && street.trim() !== ''),
    };
  }

  // Old format: just city string (backwards compatibility)
  const cityString = typeof addressData === 'string' ? addressData : '';
  return {
    fullAddress: cityString,
    city: cityString,
    street: '',
    hasStreet: false,
  };
}

/**
 * Compose full address from city + street address
 * Backend-compatible version (same as formatFullAddress but explicit naming)
 *
 * @param {string} city - City name
 * @param {string} streetAddress - Street-level details
 * @returns {string} Full composed address
 */
export function composeFullAddress(city, streetAddress) {
  return formatFullAddress(city, streetAddress);
}
