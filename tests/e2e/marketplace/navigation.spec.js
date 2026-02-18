import { test, expect } from '../fixtures/auth.fixture.js';
import { generateTestUser } from '../utils/test-data.js';

/**
 * Marketplace Navigation E2E Tests
 *
 * Tests navigation and basic marketplace functionality
 */

test.describe('Marketplace Navigation', () => {
  test.beforeEach(async ({ authHelper }) => {
    await authHelper.clearEmulatorData();
  });

  test('should navigate marketplace as guest user', async ({ page }) => {
    await page.goto('/');

    // Check if landing page or marketplace preview is visible
    const pageContent = await page.textContent('body');

    // Should see some indication of marketplace functionality
    expect(
      pageContent.includes('cargo') ||
      pageContent.includes('truck') ||
      pageContent.includes('shipper') ||
      pageContent.includes('marketplace') ||
      pageContent.includes('Karga')
    ).toBe(true);
  });

  test('should access marketplace after login and registration', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    // Complete auth flow
    await authHelper.login(testPhoneNumbers.shipper);
    const userData = generateTestUser('shipper', 1);
    await authHelper.register(userData);

    // Should be logged in
    const isLoggedIn = await authHelper.isLoggedIn();
    expect(isLoggedIn).toBe(true);

    // Wait for app to fully load
    await page.waitForTimeout(2000);

    // Look for common marketplace elements
    const hasNavigation = await page.locator('nav, [role="navigation"], .sidebar, .header').count();
    expect(hasNavigation).toBeGreaterThan(0);
  });

  test('should switch between cargo and truck views (if applicable)', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    // Login as shipper
    await authHelper.login(testPhoneNumbers.shipper);
    const userData = generateTestUser('shipper', 1);
    await authHelper.register(userData);

    // Use navigateTo which properly uses sidebar visible buttons
    await authHelper.navigateTo('trucks');
    await page.waitForTimeout(500);

    // Should not crash after switching to trucks
    const errorAfterTruck = await page.locator('text=/error|crashed/i').count();
    expect(errorAfterTruck).toBe(0);

    await authHelper.navigateTo('cargo');
    await page.waitForTimeout(500);

    // Test passed if no errors
    const errorAfterCargo = await page.locator('text=/error|crashed/i').count();
    expect(errorAfterCargo).toBe(0);
  });
});
