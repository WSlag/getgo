/**
 * Test Data Generators and Constants for E2E Tests
 */

// Firebase Auth Emulator accepts this OTP code for all test phone numbers
export const TEST_OTP_CODE = '123456';

/**
 * Pre-configured test phone numbers for different user roles
 * These work with Firebase Auth Emulator without sending real SMS
 */
export const TEST_PHONE_NUMBERS = {
  shipper: '+639171234567',
  trucker: '+639171234568',
  broker: '+639171234569',
  admin: '+639171234570',
};

/**
 * Generate test user data for registration
 */
export function generateTestUser(role = 'shipper', index = 0) {
  const timestamp = Date.now();

  const baseUser = {
    name: `Test ${role.charAt(0).toUpperCase() + role.slice(1)} ${index}`,
    email: `test-${role}-${index}-${timestamp}@example.com`,
    role: role,
  };

  // Role-specific fields
  if (role === 'trucker') {
    return {
      ...baseUser,
      truckType: 'Closed Van',
      truckCapacity: '10 tons',
      plateNumber: `ABC${1000 + index}`,
      licenseNumber: `N01-${index.toString().padStart(2, '0')}-${timestamp.toString().slice(-6)}`,
    };
  }

  if (role === 'broker') {
    return {
      ...baseUser,
      companyName: `Test Brokerage ${index}`,
      businessPermitNumber: `BP-${timestamp}-${index}`,
    };
  }

  return baseUser;
}

/**
 * Generate test cargo listing data
 */
export function generateCargoListing(overrides = {}) {
  const timestamp = Date.now();

  return {
    title: `Test Cargo ${timestamp}`,
    description: 'Test cargo listing for E2E testing',
    weight: '5 tons',
    pickupLocation: 'Manila',
    deliveryLocation: 'Cebu',
    pickupDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
    cargoType: 'General Goods',
    estimatedValue: '50000',
    ...overrides,
  };
}

/**
 * Generate test truck listing data
 */
export function generateTruckListing(overrides = {}) {
  const timestamp = Date.now();

  return {
    truckType: 'Closed Van',
    capacity: '10 tons',
    plateNumber: `XYZ${timestamp.toString().slice(-4)}`,
    availableFrom: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
    availableTo: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0], // Next week
    currentLocation: 'Manila',
    ratePerKm: '50',
    ...overrides,
  };
}

/**
 * Wait helper for dynamic content loading
 */
export async function waitForElement(page, selector, options = {}) {
  const { timeout = 10000, state = 'visible' } = options;
  await page.waitForSelector(selector, { timeout, state });
}

/**
 * Clear all emulator data (call between tests for isolation)
 */
export async function clearEmulatorData() {
  try {
    // Clear Auth emulator
    await fetch('http://127.0.0.1:9099/emulator/v1/projects/karga-ph/accounts', {
      method: 'DELETE',
    });

    // Clear Firestore emulator
    await fetch('http://127.0.0.1:8080/emulator/v1/projects/karga-ph/databases/(default)/documents', {
      method: 'DELETE',
    });

    console.log('✅ Emulator data cleared');
  } catch (error) {
    console.warn('⚠️ Failed to clear emulator data:', error.message);
  }
}
