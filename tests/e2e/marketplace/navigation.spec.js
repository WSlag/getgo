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
      pageContent.includes('GetGo')
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

  test('should open direct deep links for app routes', async ({ page }) => {
    const appRoutes = [
      '/app/home',
      '/app/tracking',
      '/app/activity',
      '/app/messages',
      '/app/notifications',
      '/app/profile',
      '/app/bids',
      '/app/broker',
      '/app/contracts',
      '/app/help',
      '/app/admin',
      '/app/admin-payments',
      '/app/contract-verification',
    ];

    for (const route of appRoutes) {
      await page.goto(route);
      await page.waitForFunction(() => !document.querySelector('.animate-spin'), { timeout: 20000 }).catch(() => {});
      await expect(page).toHaveURL(new RegExp(`${route.replace(/\//g, '\\/')}(?:\\?.*)?$`));

      const hasHeader = await page.locator('header').first().isVisible().catch(() => false);
      const hasAccessDenied = await page.getByText(/access denied/i).first().isVisible().catch(() => false);
      expect(hasHeader || hasAccessDenied).toBe(true);

      const fatalErrors = await page.locator('text=/fatal error|unhandled error|something went wrong/i').count();
      expect(fatalErrors).toBe(0);
    }
  });

  test('should preserve tab history on back navigation for authenticated users', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await authHelper.login(testPhoneNumbers.shipper);
    await authHelper.register(generateTestUser('shipper', 11));

    await page.goto('/app/home');
    await page.waitForFunction(() => !document.querySelector('.animate-spin'), { timeout: 20000 }).catch(() => {});

    await page.getByRole('button', { name: /^tracking$/i }).first().click();
    await expect(page).toHaveURL(/\/app\/tracking(?:\?.*)?$/);

    await page.getByRole('button', { name: /^activity$/i }).first().click();
    await expect(page).toHaveURL(/\/app\/activity(?:\?.*)?$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/app\/tracking(?:\?.*)?$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/app\/home(?:\?.*)?$/);
  });

  test('should canonicalize /app to /app/home without extra history entry', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => !document.querySelector('.animate-spin'), { timeout: 20000 }).catch(() => {});

    await page.goto('/app');
    await page.waitForFunction(() => !document.querySelector('.animate-spin'), { timeout: 20000 }).catch(() => {});
    await expect(page).toHaveURL(/\/app\/home(?:\?.*)?$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/(?:\?.*)?$/);
  });
});
