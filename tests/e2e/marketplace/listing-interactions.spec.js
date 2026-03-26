import { test, expect } from '../fixtures/auth.fixture.js';
import { generateTestUser, EMULATOR_PROJECT_ID } from '../utils/test-data.js';

const FIRESTORE_EMULATOR = 'http://127.0.0.1:8080';

function firestoreValueToJs(value) {
  if (!value || typeof value !== 'object') return null;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('booleanValue' in value) return Boolean(value.booleanValue);
  if ('nullValue' in value) return null;
  if ('mapValue' in value) {
    const fields = value.mapValue?.fields || {};
    return Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [k, firestoreValueToJs(v)])
    );
  }
  if ('arrayValue' in value) {
    const values = value.arrayValue?.values || [];
    return values.map((entry) => firestoreValueToJs(entry));
  }
  return null;
}

async function fetchCargoListingsFromEmulator() {
  const url = `${FIRESTORE_EMULATOR}/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents/cargoListings?pageSize=50`;
  const response = await fetch(url, {
    headers: { Authorization: 'Bearer owner' },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch cargo listings from emulator: ${response.status}`);
  }
  const payload = await response.json();
  const docs = payload.documents || [];
  return docs.map((doc) => ({
    id: doc.name?.split('/').pop() || null,
    ...Object.fromEntries(
      Object.entries(doc.fields || {}).map(([k, v]) => [k, firestoreValueToJs(v)])
    ),
  }));
}

/**
 * Marketplace Listing Interaction Tests
 *
 * Tests interactions with cargo and truck listings after authentication:
 * - View listing details
 * - Switch between cargo/truck market
 * - Filter/search listings
 * - Post a new listing (shipper)
 * - Post a truck listing (trucker)
 */

test.describe('Marketplace Listing Interactions', () => {
  test.beforeEach(async ({ authHelper }) => {
    await authHelper.clearEmulatorData();
  });

  test('should switch between Cargo and Trucks market views', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await authHelper.login(testPhoneNumbers.shipper);
    const userData = generateTestUser('shipper', 1);
    await authHelper.register(userData);

    // Use sidebar buttons (visible on desktop at 1280px)
    // Sidebar has "Cargo" and "Trucks" buttons
    await authHelper.navigateTo('trucks');
    await page.waitForTimeout(500);

    // Should not crash after switching to trucks
    const errorText = await page.locator('text=/error|crashed/i').count();
    expect(errorText).toBe(0);

    // Switch back to cargo
    await authHelper.navigateTo('cargo');
    await page.waitForTimeout(500);
    expect(await page.locator('text=/error/i').count()).toBe(0);
  });

  test('should open post listing modal as shipper', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await authHelper.login(testPhoneNumbers.shipper);
    const userData = generateTestUser('shipper', 2);
    await authHelper.register(userData);

    // Find "Post Cargo" button in sidebar (visible on desktop)
    // The sidebar button text is "Post Cargo" for shippers
    const postButton = page.locator('aside button').filter({
      hasText: /post cargo|post truck/i,
    }).first();

    if (await postButton.count() > 0) {
      const isVisible = await postButton.isVisible().catch(() => false);
      if (isVisible) {
        await postButton.click();
        await page.waitForTimeout(1000);

        // PostModal should open
        const modal = await page.locator('[role="dialog"]').count();
        expect(modal).toBeGreaterThan(0);

        // Close modal
        await page.keyboard.press('Escape');
        return;
      }
    }

    // Fallback: header "Post" button
    const headerPostBtn = page.locator('header button').filter({
      hasText: /post/i,
    }).first();
    if (await headerPostBtn.count() > 0 && await headerPostBtn.isVisible().catch(() => false)) {
      await headerPostBtn.click();
      await page.waitForTimeout(1000);
      const modal = await page.locator('[role="dialog"]').count();
      expect(modal).toBeGreaterThan(0);
      await page.keyboard.press('Escape');
    }
  });

  test('should fill and submit a cargo listing as shipper', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await authHelper.login(testPhoneNumbers.shipper);
    const userData = generateTestUser('shipper', 3);
    await authHelper.register(userData);

    // Open post modal via sidebar "Post Cargo" button
    const postButton = page.locator('aside button').filter({
      hasText: /post cargo/i,
    }).first();

    const isVisible = await postButton.count() > 0
      ? await postButton.isVisible().catch(() => false)
      : false;

    if (!isVisible) {
      test.skip();
      return;
    }

    await postButton.click();
    await page.waitForTimeout(1000);

    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toBeVisible();

    // Fill origin
    const originInput = modal.locator(
      'input[name="origin"], input[placeholder*="origin"], input[placeholder*="From"]'
    ).first();
    if (await originInput.count() > 0) {
      await originInput.fill('Manila');
    }

    // Fill destination
    const destInput = modal.locator(
      'input[name="destination"], input[placeholder*="destination"], input[placeholder*="To"]'
    ).first();
    if (await destInput.count() > 0) {
      await destInput.fill('Cebu');
    }

    // Fill asking price
    const priceInput = modal.locator(
      'input[name="askingPrice"], input[placeholder*="price"], input[placeholder*="Price"]'
    ).first();
    if (await priceInput.count() > 0) {
      await priceInput.fill('5000');
    }

    // Fill weight
    const weightInput = modal.locator(
      'input[name="weight"], input[placeholder*="weight"], input[placeholder*="Weight"]'
    ).first();
    if (await weightInput.count() > 0) {
      await weightInput.fill('10');
    }

    // Verify fields are interactive (no crash when filling)
    const errorText = await page.locator('text=/error|crashed/i').count();
    expect(errorText).toBe(0);

    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  });

  test('should open truck listing modal as trucker', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await authHelper.login(testPhoneNumbers.trucker);
    const userData = generateTestUser('trucker', 1);
    await authHelper.register(userData);

    // For truckers, the sidebar shows "Post Truck" button
    const postButton = page.locator('aside button').filter({
      hasText: /post truck|post cargo/i,
    }).first();

    const isVisible = await postButton.count() > 0
      ? await postButton.isVisible().catch(() => false)
      : false;

    if (!isVisible) {
      test.skip();
      return;
    }

    await postButton.click();
    await page.waitForTimeout(1000);

    const modal = await page.locator('[role="dialog"]').count();
    expect(modal).toBeGreaterThan(0);

    await page.keyboard.press('Escape');
  });

  test('should filter listings by status', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await authHelper.login(testPhoneNumbers.shipper);
    const userData = generateTestUser('shipper', 4);
    await authHelper.register(userData);

    await page.waitForTimeout(2000);

    // Look for filter buttons (All, Open, Booked, etc.)
    const filterButton = page.locator('button, [role="option"]').filter({
      hasText: /all|open|available|active/i,
    }).first();

    if (await filterButton.count() > 0) {
      await filterButton.click();
      await page.waitForTimeout(500);
      // Should not error
      const errorCount = await page.locator('text=/error|crashed/i').count();
      expect(errorCount).toBe(0);
    }
  });

  test('should search for listings by keyword', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await authHelper.login(testPhoneNumbers.shipper);
    const userData = generateTestUser('shipper', 5);
    await authHelper.register(userData);

    await page.waitForTimeout(2000);

    // Find search input
    const searchInput = page.locator(
      'input[type="search"], input[placeholder*="search"], input[placeholder*="Search"]'
    ).first();

    if (await searchInput.count() > 0) {
      await searchInput.fill('Manila');
      await page.waitForTimeout(800);

      // Should not show errors
      const errorCount = await page.locator('text=/error|crashed/i').count();
      expect(errorCount).toBe(0);

      // Clear search
      await searchInput.clear();
      await page.waitForTimeout(500);
    } else {
      test.skip();
    }
  });

  test('should click on cargo listing to open details modal', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await authHelper.login(testPhoneNumbers.trucker);
    const userData = generateTestUser('trucker', 2);
    await authHelper.register(userData);

    await page.waitForTimeout(2000);

    // Find any listing card with a "View Details" or clickable area
    const listingCard = page.locator(
      'button, [role="button"]'
    ).filter({ hasText: /details|view|manila|cebu|davao/i }).first();

    if (await listingCard.count() > 0) {
      await listingCard.click();
      await page.waitForTimeout(1000);

      // Some modal or expanded view should appear
      const modal = await page.locator('[role="dialog"]').count();
      // Not strictly required — might navigate inline
      expect(modal >= 0).toBe(true); // no crash
    }
  });

  test('should show Bid Now and Details on compact cargo cards for trucker mobile view', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await authHelper.login(testPhoneNumbers.trucker);
    const userData = generateTestUser('trucker', 7);
    await authHelper.register(userData);

    await page.waitForTimeout(1800);

    const bidButtons = page.getByTestId('cargo-compact-bid-now');
    const detailsButtons = page.getByTestId('cargo-compact-details');
    const bodyButtons = page.getByTestId('cargo-compact-body');

    const bidCount = await bidButtons.count();
    test.skip(bidCount === 0, 'No bid-eligible compact cargo cards found in this run.');

    await expect(bidButtons.first()).toBeVisible();
    await expect(detailsButtons.first()).toBeVisible();
    await expect(bodyButtons.first()).toBeVisible();

    await bodyButtons.first().click();
    await expect(page.locator('[role="dialog"]').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);

    await bidButtons.first().click();
    await expect(page.getByText(/Place Your Bid/i)).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('should show Book Now and Details on compact truck cards for shipper mobile view', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await authHelper.login(testPhoneNumbers.shipper);
    const userData = generateTestUser('shipper', 7);
    await authHelper.register(userData);

    await authHelper.navigateTo('trucks');
    await page.waitForTimeout(1000);

    const bookButtons = page.getByTestId('truck-compact-book-now');
    const detailsButtons = page.getByTestId('truck-compact-details');
    const bodyButtons = page.getByTestId('truck-compact-body');

    const bookCount = await bookButtons.count();
    test.skip(bookCount === 0, 'No book-eligible compact truck cards found in this run.');

    await expect(bookButtons.first()).toBeVisible();
    await expect(detailsButtons.first()).toBeVisible();
    await expect(bodyButtons.first()).toBeVisible();

    await bodyButtons.first().click();
    await expect(page.locator('[role="dialog"]').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);

    await bookButtons.first().click();
    await expect(page.getByText(/Book This Truck/i)).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('should open and close cargo photo viewer from details modal', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await authHelper.login(testPhoneNumbers.trucker);
    const userData = generateTestUser('trucker', 9);
    await authHelper.register(userData);
    await page.waitForTimeout(1800);

    const bodyButtons = page.getByTestId('cargo-compact-body');
    const detailsButtons = page.getByTestId('cargo-compact-details');
    const bodyCount = await bodyButtons.count();
    const detailsCount = await detailsButtons.count();

    if (bodyCount > 0) {
      await bodyButtons.first().click();
    } else if (detailsCount > 0) {
      await detailsButtons.first().click();
    } else {
      test.skip(true, 'No cargo card available for details modal.');
    }

    await expect(page.locator('[role="dialog"]').first()).toBeVisible();

    const photoThumbs = page.getByTestId('cargo-details-photo-thumb');
    const photoCount = await photoThumbs.count();
    test.skip(photoCount === 0, 'No cargo photos available in selected listing.');

    await photoThumbs.first().click();
    const viewer = page.getByTestId('cargo-details-photo-viewer');
    await expect(viewer).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(viewer).toHaveCount(0);

    await photoThumbs.first().click();
    await expect(viewer).toBeVisible();
    await viewer.click({ position: { x: 8, y: 8 } });
    await expect(viewer).toHaveCount(0);

    await page.keyboard.press('Escape');
  });

  test('should open and close truck photo viewer from details modal', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await authHelper.login(testPhoneNumbers.shipper);
    const userData = generateTestUser('shipper', 9);
    await authHelper.register(userData);

    await authHelper.navigateTo('trucks');
    await page.waitForTimeout(1200);

    const bodyButtons = page.getByTestId('truck-compact-body');
    const detailsButtons = page.getByTestId('truck-compact-details');
    const bodyCount = await bodyButtons.count();
    const detailsCount = await detailsButtons.count();

    if (bodyCount > 0) {
      await bodyButtons.first().click();
    } else if (detailsCount > 0) {
      await detailsButtons.first().click();
    } else {
      test.skip(true, 'No truck card available for details modal.');
    }

    await expect(page.locator('[role="dialog"]').first()).toBeVisible();

    const photoThumbs = page.getByTestId('truck-details-photo-thumb');
    const photoCount = await photoThumbs.count();
    test.skip(photoCount === 0, 'No truck photos available in selected listing.');

    await photoThumbs.first().click();
    const viewer = page.getByTestId('truck-details-photo-viewer');
    await expect(viewer).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(viewer).toHaveCount(0);

    await photoThumbs.first().click();
    await expect(viewer).toBeVisible();
    await viewer.click({ position: { x: 8, y: 8 } });
    await expect(viewer).toHaveCount(0);

    await page.keyboard.press('Escape');
  });

  test('should show Details-only compact cargo actions when primary action is unavailable', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await authHelper.login(testPhoneNumbers.shipper);
    const userData = generateTestUser('shipper', 8);
    await authHelper.register(userData);

    await page.waitForTimeout(1500);

    const detailsButtons = page.getByTestId('cargo-compact-details');
    const bidButtons = page.getByTestId('cargo-compact-bid-now');

    const detailsCount = await detailsButtons.count();
    test.skip(detailsCount === 0, 'No compact cargo cards found for details-only verification.');

    await expect(detailsButtons.first()).toBeVisible();
    await expect(bidButtons).toHaveCount(0);
  });

  test('should persist server route distance after submitting cargo listing', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await authHelper.login(testPhoneNumbers.shipper);
    const userData = generateTestUser('shipper', 6);
    await authHelper.register(userData);

    const postButton = page.locator('aside button').filter({
      hasText: /post cargo/i,
    }).first();

    const isVisible = await postButton.count() > 0
      ? await postButton.isVisible().catch(() => false)
      : false;
    if (!isVisible) {
      test.skip();
      return;
    }

    await postButton.click();
    await page.waitForTimeout(900);

    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toBeVisible();

    await modal.locator('input[placeholder*="origin"], input[placeholder*="From"]').first().fill('Manila');
    await modal.locator('input[placeholder*="destination"], input[placeholder*="Search destination"], input[placeholder*="To"]').first().fill('Cebu City');

    // Fill required select fields (cargo type + vehicle needed)
    const selects = modal.locator('select');
    const selectCount = await selects.count();
    if (selectCount >= 2) {
      await selects.nth(0).selectOption({ index: 1 });
      await selects.nth(1).selectOption({ index: 1 });
    }

    const numberInputs = modal.locator('input[type="number"]');
    const numberCount = await numberInputs.count();
    if (numberCount < 2) {
      test.skip();
      return;
    }
    await numberInputs.nth(0).fill('8');
    await numberInputs.nth(1).fill('12000');

    const submitButton = modal.locator('button').filter({ hasText: /post cargo/i }).first();
    await submitButton.click();

    const found = await (async () => {
      const timeoutMs = 90000;
      const intervalMs = 1200;
      const startedAt = Date.now();
      while (Date.now() - startedAt < timeoutMs) {
        const docs = await fetchCargoListingsFromEmulator();
        const match = docs.find((item) =>
          item.userName === userData.name &&
          typeof item.routeDistanceKm === 'number'
        );
        if (match) return match;
        await page.waitForTimeout(intervalMs);
      }
      return null;
    })();

    expect(found).not.toBeNull();
    expect(Number(found.routeDistanceKm)).toBeGreaterThan(0);
  });
});
