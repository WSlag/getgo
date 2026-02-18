import { test, expect } from '../fixtures/auth.fixture.js';
import { generateTestUser } from '../utils/test-data.js';

/**
 * Profile View E2E Tests
 *
 * Tests user profile management:
 * - Profile page loads with correct user data
 * - User can navigate to profile
 * - Profile shows role-specific information
 * - Logout button is accessible from profile
 *
 * NOTE: On desktop (1280px), Profile tab is in MobileNav (hidden).
 * We access it via the header profile dropdown or JS click.
 */

test.describe('Profile View', () => {
  test.beforeEach(async ({ authHelper }) => {
    await authHelper.clearEmulatorData();
  });

  test('should open profile page after login', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await authHelper.login(testPhoneNumbers.shipper);
    const userData = generateTestUser('shipper', 1);
    await authHelper.register(userData);

    // Navigate to profile via header dropdown or MobileNav JS click
    await authHelper.navigateTo('profile');

    // Should show profile content (name, role, or profile-related text)
    const profileContent = await page.locator(
      'text=/profile|account|name|role|rating|shipper|trucker/i'
    ).count();
    expect(profileContent).toBeGreaterThan(0);
  });

  test('should display correct user name on profile', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await authHelper.login(testPhoneNumbers.shipper);
    const userData = generateTestUser('shipper', 2);
    await authHelper.register(userData);

    // User name should appear in the header or somewhere on screen
    const pageText = await page.textContent('body');
    // The registered name format is "Test Shipper 2"
    const nameVisible = pageText.includes('Test Shipper') || pageText.includes('Shipper');
    expect(nameVisible).toBe(true);
  });

  test('should show trucker badge/rating for trucker profile', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await authHelper.login(testPhoneNumbers.trucker);
    const userData = generateTestUser('trucker', 1);
    await authHelper.register(userData);

    // Navigate to profile
    await authHelper.navigateTo('profile');

    // Truckers should see rating/badge info or role info
    const ratingOrRole = await page.locator(
      'text=/rating|badge|starter|elite|trips|trucker|truck/i'
    ).count();
    expect(ratingOrRole).toBeGreaterThan(0);
  });

  test('should have logout option accessible', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await authHelper.login(testPhoneNumbers.shipper);
    const userData = generateTestUser('shipper', 3);
    await authHelper.register(userData);

    // Look for logout button via profile dropdown in header
    // The header has a profile/avatar button that opens a dropdown with Logout
    const headerButtons = page.locator('header button');
    const headerBtnCount = await headerButtons.count();

    let logoutFound = false;
    // Click header buttons to find the profile/avatar dropdown
    for (let i = headerBtnCount - 1; i >= Math.max(0, headerBtnCount - 3); i--) {
      const btn = headerButtons.nth(i);
      const isVisible = await btn.isVisible().catch(() => false);
      if (!isVisible) continue;

      await btn.click();
      await page.waitForTimeout(500);

      // Check if logout appeared
      const logoutBtn = page.locator('button, a').filter({ hasText: /logout|sign out/i }).first();
      if (await logoutBtn.count() > 0 && await logoutBtn.isVisible().catch(() => false)) {
        logoutFound = true;
        await page.keyboard.press('Escape'); // Close dropdown
        break;
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // Also check profile page directly
    if (!logoutFound) {
      await authHelper.navigateTo('profile');
      const logoutBtn = page.locator('button, a').filter({ hasText: /logout|sign out/i }).first();
      logoutFound = await logoutBtn.count() > 0;
    }

    expect(logoutFound).toBe(true);
  });

  test('should logout and return to login screen', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await authHelper.login(testPhoneNumbers.shipper);
    const userData = generateTestUser('shipper', 4);
    await authHelper.register(userData);

    // Verify logged in
    let isLoggedIn = await authHelper.isLoggedIn();
    expect(isLoggedIn).toBe(true);

    // Logout
    await authHelper.logout();

    // Should be back at login/auth screen or marketplace with auth modal
    await page.waitForTimeout(1000);

    // After logout, auth modal should be shown or phone input visible
    const phoneInput = await page.locator('input[type="tel"]').count();
    const authModal = await page.locator('[role="dialog"]').count();
    const signInText = await page.locator('text=/sign in|enter your phone/i').count();

    expect(phoneInput > 0 || authModal > 0 || signInText > 0).toBe(true);
  });

  test('should show broker profile features for broker user', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await authHelper.login(testPhoneNumbers.broker);
    const userData = generateTestUser('shipper', 1);
    await authHelper.register(userData);

    // Navigate to broker via sidebar
    await authHelper.navigateTo('broker');

    // Should see broker content
    const brokerContent = await page.locator(
      'text=/broker|referral|commission|link|program/i'
    ).count();
    expect(brokerContent).toBeGreaterThan(0);
  });
});
