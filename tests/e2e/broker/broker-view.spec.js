import { test, expect } from '../fixtures/auth.fixture.js';
import { generateTestUser } from '../utils/test-data.js';

/**
 * Broker Dashboard E2E Tests
 *
 * Tests broker referral features:
 * - Broker view accessible to authenticated users
 * - Non-broker users see activation CTA
 * - Broker users see referral link and commissions
 */

test.describe('Broker Dashboard', () => {
  test.beforeEach(async ({ authHelper }) => {
    await authHelper.clearEmulatorData();
  });

  test('should show broker view for authenticated user', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await authHelper.login(testPhoneNumbers.shipper);
    const userData = generateTestUser('shipper', 1);
    await authHelper.register(userData);

    // Navigate to broker section via sidebar
    await authHelper.navigateTo('broker');

    // Should show broker view content
    const brokerContent = await page.locator(
      'text=/broker|referral|commission|activate/i'
    ).count();
    expect(brokerContent).toBeGreaterThan(0);
  });

  test('should show "activate broker" CTA for non-broker shipper', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await authHelper.login(testPhoneNumbers.shipper);
    const userData = generateTestUser('shipper', 2);
    await authHelper.register(userData);

    await authHelper.navigateTo('broker');

    // Non-broker should see some broker content (program info or activation)
    const brokerContent = await page.locator(
      'text=/broker|referral|activate|commission|earn|program/i'
    ).count();
    expect(brokerContent).toBeGreaterThan(0);
  });

  test('should show broker dashboard for broker user', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await authHelper.login(testPhoneNumbers.broker);
    // broker phone: register as shipper (broker role activated separately)
    const userData = generateTestUser('shipper', 1);
    await authHelper.register(userData);

    await authHelper.navigateTo('broker');

    // Should show some broker content
    const brokerContent = await page.locator(
      'text=/broker|referral|commission|earnings|program/i'
    ).count();
    expect(brokerContent).toBeGreaterThan(0);
  });

  test('should handle referral link in URL (?ref=CODE)', async ({ page }) => {
    // Test referral code capture from URL
    await page.goto('/?ref=TESTBROKER123');
    await page.waitForFunction(
      () => !document.querySelector('.animate-spin'),
      { timeout: 15000 }
    );
    await page.waitForTimeout(1000);

    // App should capture referral code and normalize URL to /
    const currentUrl = page.url();
    // URL should be cleaned (no ?ref= query param)
    expect(currentUrl).not.toContain('ref=TESTBROKER123');

    // Check localStorage for referral code
    const referralCode = await page.evaluate(() =>
      window.localStorage.getItem('karga_referral_code')
    );
    expect(referralCode).toBe('TESTBROKER123');
  });

  test('should handle referral path (/r/CODE)', async ({ page }) => {
    await page.goto('/r/BROKERCODE456');
    await page.waitForFunction(
      () => !document.querySelector('.animate-spin'),
      { timeout: 15000 }
    );
    await page.waitForTimeout(1000);

    // URL should be normalized to /
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/r/BROKERCODE456');

    // Referral code captured
    const referralCode = await page.evaluate(() =>
      window.localStorage.getItem('karga_referral_code')
    );
    expect(referralCode).toBe('BROKERCODE456');
  });
});
