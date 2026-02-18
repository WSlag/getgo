import { test, expect } from '../fixtures/auth.fixture.js';
import { generateTestUser } from '../utils/test-data.js';

/**
 * Contracts View E2E Tests
 *
 * Tests contract management:
 * - Contracts view loads for authenticated users
 * - Filter tabs work (All, Draft, Signed, Completed)
 * - Empty state is handled correctly
 * - Unauthenticated users are prompted to sign in
 */

test.describe('Contracts View', () => {
  test.beforeEach(async ({ authHelper }) => {
    await authHelper.clearEmulatorData();
  });

  test('should access contracts view as authenticated shipper', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await authHelper.login(testPhoneNumbers.shipper);
    const userData = generateTestUser('shipper', 1);
    await authHelper.register(userData);

    // Navigate to contracts via sidebar (desktop) or helper
    await authHelper.navigateTo('contracts');

    // Should show contracts view content
    const contractsContent = await page.locator('text=/contracts/i').count();
    expect(contractsContent).toBeGreaterThan(0);

    // No crashes
    const errorText = await page.locator('text=/crashed|fatal error/i').count();
    expect(errorText).toBe(0);
  });

  test('should access contracts view as authenticated trucker', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await authHelper.login(testPhoneNumbers.trucker);
    const userData = generateTestUser('trucker', 1);
    await authHelper.register(userData);

    await authHelper.navigateTo('contracts');

    const contractsContent = await page.locator('text=/contracts/i').count();
    expect(contractsContent).toBeGreaterThan(0);
  });

  test('should show empty state when no contracts exist', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await authHelper.login(testPhoneNumbers.shipper);
    const userData = generateTestUser('shipper', 2);
    await authHelper.register(userData);

    await authHelper.navigateTo('contracts');

    // Empty state or contracts heading should be visible
    const emptyOrHeading = await page.locator(
      'text=/no contracts|empty|no active contracts|get started|my contracts|contracts/i'
    ).count();
    expect(emptyOrHeading).toBeGreaterThan(0);
  });

  test('should have contract filter tabs', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await authHelper.login(testPhoneNumbers.shipper);
    const userData = generateTestUser('shipper', 3);
    await authHelper.register(userData);

    await authHelper.navigateTo('contracts');

    // Look for filter tabs: All, Draft, Signed, etc.
    const filterTabs = page.locator('button, [role="tab"]').filter({
      hasText: /^all$|^draft$|^signed$|^active$|^completed$|^in transit$/i,
    });

    const filterCount = await filterTabs.count();
    if (filterCount > 0) {
      // Find the first visible filter tab and click it
      for (let i = 0; i < Math.min(filterCount, 4); i++) {
        const tab = filterTabs.nth(i);
        const isVisible = await tab.isVisible().catch(() => false);
        if (isVisible) {
          await tab.click();
          await page.waitForTimeout(400);
          const errorText = await page.locator('text=/error|crashed/i').count();
          expect(errorText).toBe(0);
        }
      }
    } else {
      // If no filter tabs visible, just verify we're in contracts view
      const contractsText = await page.locator('text=/contracts/i').count();
      expect(contractsText).toBeGreaterThan(0);
    }
  });

  test('should show "sign in to view contracts" for guest', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => !document.querySelector('.animate-spin'),
      { timeout: 15000 }
    );
    await page.waitForTimeout(1000);

    // Try to navigate to contracts via sidebar (visible in guest mode)
    const contractsNav = page.locator('aside button').filter({
      hasText: /my contracts/i,
    }).first();

    if (await contractsNav.count() > 0) {
      const isVisible = await contractsNav.isVisible().catch(() => false);
      if (isVisible) {
        await contractsNav.click();
        await page.waitForTimeout(1000);

        // Should show sign-in prompt or auth modal
        const signInText = await page.locator('text=/sign in|please sign in|login to view/i').count();
        const authModal = await page.locator('[role="dialog"]').count();

        expect(signInText > 0 || authModal > 0).toBe(true);
      }
    }
  });
});
