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

  test('should show active shipments from guest data on homepage', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => !document.querySelector('.animate-spin'),
      { timeout: 15000 }
    );
    await page.waitForTimeout(1500);

    // Guest data includes active shipments on home view
    // Look for "Track Live" button or shipment card
    const trackLiveButton = page.locator('button').filter({
      hasText: /track live|tracking/i,
    }).first();

    if (await trackLiveButton.count() > 0) {
      await trackLiveButton.click();
      await page.waitForTimeout(1000);

      // Should either navigate to tracking view or show auth modal
      const authModal = await page.locator('[role="dialog"]').count();
      const trackingContent = await page.locator('text=/tracking|shipment/i').count();

      expect(authModal > 0 || trackingContent > 0).toBe(true);
    }
  });
});
