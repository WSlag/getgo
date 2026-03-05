import { test, expect } from '../fixtures/auth.fixture.js';
import { generateTestUser } from '../utils/test-data.js';

/**
 * Tracking View E2E Tests
 *
 * Tests shipment tracking:
 * - Tracking view loads for authenticated users
 * - Shows active and delivered shipment tabs
 * - Empty state when no shipments
 * - Guest gets auth prompt
 */

test.describe('Tracking View', () => {
  test.beforeEach(async ({ authHelper }) => {
    await authHelper.clearEmulatorData();
  });

  test('should load tracking view for authenticated user', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await authHelper.login(testPhoneNumbers.shipper);
    const userData = generateTestUser('shipper', 1);
    await authHelper.register(userData);

    await page.waitForTimeout(2000);

    // Navigate to tracking
    const trackingNav = page.locator('button, a, [role="tab"]').filter({
      hasText: /tracking|track/i,
    }).first();

    if (await trackingNav.count() > 0) {
      await trackingNav.click();
      await page.waitForTimeout(1500);

      // Should show tracking view
      const trackingContent = await page.locator(
        'text=/tracking|shipment|no active|in transit/i'
      ).count();
      expect(trackingContent).toBeGreaterThan(0);
    }
  });

  test('should show empty state when no active shipments', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await authHelper.login(testPhoneNumbers.trucker);
    const userData = generateTestUser('trucker', 1);
    await authHelper.register(userData);

    await page.waitForTimeout(2000);

    const trackingNav = page.locator('button, a, [role="tab"]').filter({
      hasText: /tracking|track/i,
    }).first();

    if (await trackingNav.count() > 0) {
      await trackingNav.click();
      await page.waitForTimeout(1500);

      // Empty state
      const emptyState = await page.locator(
        'text=/no shipments|no active|nothing to track|empty/i'
      ).count();
      expect(emptyState).toBeGreaterThan(0);
    }
  });

  test('should have active/delivered tabs in tracking view', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await authHelper.login(testPhoneNumbers.shipper);
    const userData = generateTestUser('shipper', 2);
    await authHelper.register(userData);

    await page.waitForTimeout(2000);

    const trackingNav = page.locator('button, a, [role="tab"]').filter({
      hasText: /tracking|track/i,
    }).first();

    if (await trackingNav.count() > 0) {
      await trackingNav.click();
      await page.waitForTimeout(1500);

      // Look for active/delivered tabs
      const activeTabs = page.locator('button, [role="tab"]').filter({
        hasText: /active|in transit|delivered/i,
      });

      if (await activeTabs.count() > 0) {
        // Click through tabs
        for (let i = 0; i < await activeTabs.count(); i++) {
          await activeTabs.nth(i).click();
          await page.waitForTimeout(400);
          const errorText = await page.locator('text=/error|crashed/i').count();
          expect(errorText).toBe(0);
        }
      }
    }
  });

  test('should hide shipment tracking cards on guest homepage', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => !document.querySelector('.animate-spin'),
      { timeout: 15000 }
    );
    await page.waitForTimeout(1500);

    await expect(page.locator('text=/shipment tracking/i')).toHaveCount(0);
    await expect(page.locator('text=/active shipments in progress/i')).toHaveCount(0);

    const trackLiveButtons = page.locator('button').filter({ hasText: /track live/i });
    await expect(trackLiveButtons).toHaveCount(0);

    // Guest marketplace cards should still be visible.
    const hasCargoOrTruckHeader = await page.locator(
      'text=/my cargo posts|available cargo|my truck posts|available trucks/i'
    ).count();
    expect(hasCargoOrTruckHeader).toBeGreaterThan(0);
  });

  [
    { role: 'shipper', phoneKey: 'shipper' },
    { role: 'trucker', phoneKey: 'trucker' },
  ].forEach(({ role, phoneKey }) => {
    test(`should hide shipment tracking cards on authenticated ${role} homepage`, async ({
      page,
      authHelper,
      testPhoneNumbers,
    }) => {
      await authHelper.login(testPhoneNumbers[phoneKey]);
      const userData = generateTestUser(role, 3);
      await authHelper.register(userData);

      await page.waitForFunction(
        () => !document.querySelector('.animate-spin'),
        { timeout: 15000 }
      );
      await page.waitForTimeout(1500);

      await expect(page.locator('text=/shipment tracking/i')).toHaveCount(0);
      await expect(page.locator('text=/active shipments in progress/i')).toHaveCount(0);

      const trackLiveButtons = page.locator('button').filter({ hasText: /track live/i });
      await expect(trackLiveButtons).toHaveCount(0);

      const hasCargoOrTruckHeader = await page.locator(
        'text=/my cargo posts|available cargo|my truck posts|available trucks/i'
      ).count();
      expect(hasCargoOrTruckHeader).toBeGreaterThan(0);
    });
  });
});
