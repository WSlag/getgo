import { test, expect } from '../fixtures/auth.fixture.js';
import { EMULATOR_PROJECT_ID, generateTestUser } from '../utils/test-data.js';

/**
 * Authentication Flow E2E Tests
 *
 * Tests the complete auth journey:
 * 1. Open AuthModal via protected action (notification bell click)
 * 2. Phone OTP login
 * 3. User registration (new users only)
 * 4. Logout
 *
 * All tests run against Firebase Auth Emulator (no production impact)
 *
 * IMPORTANT: The GetGo app does NOT have a standalone login page.
 * Authentication is handled via an AuthModal overlay triggered by
 * protected actions (e.g., clicking Notifications, Post, Profile, etc.)
 */

test.describe('Authentication Flow', () => {
  // Clear emulator data before each test for isolation
  test.beforeEach(async ({ authHelper }) => {
    await authHelper.clearEmulatorData();
  });

  test('should complete full auth flow: login → register → logout', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    // Step 1: Login (opens AuthModal via protected action click)
    await authHelper.login(testPhoneNumbers.shipper);

    // Step 2: Complete registration (if new user)
    const userData = generateTestUser('shipper', 1);
    await authHelper.register(userData);

    // Step 3: Verify main app loaded
    const isLoggedIn = await authHelper.isLoggedIn();
    expect(isLoggedIn).toBe(true);

    // Verify we're in the main app (header visible)
    await expect(page.locator('header')).toBeVisible();

    // Step 4: Logout
    await authHelper.logout();

    // Verify logout completed (auth modal should re-appear or we're back to guest state)
    await page.waitForTimeout(1000);
    // After logout, the app shows the marketplace with auth modal
    // Just verify no errors
    const errorText = await page.locator('text=/crashed|unhandled error/i').count();
    expect(errorText).toBe(0);
  });

  test('should allow trucker registration with vehicle details', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    // Login with phone OTP
    await authHelper.login(testPhoneNumbers.trucker);

    // Register as trucker
    const truckerData = generateTestUser('trucker', 1);
    await authHelper.register(truckerData);

    // Verify logged in
    const isLoggedIn = await authHelper.isLoggedIn();
    expect(isLoggedIn).toBe(true);
  });

  test('should show auth modal when guest clicks notification bell', async ({
    page,
    authHelper,
  }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => !document.querySelector('.animate-spin'),
      { timeout: 20000 }
    );
    await page.waitForTimeout(1000);

    // Click header buttons to find one that triggers auth
    // Home/Tracking don't require auth; Bell/Profile do
    const headerBtns = page.locator('header button');
    const headerBtnCount = await headerBtns.count();

    let authTriggered = false;
    for (let i = 0; i < headerBtnCount; i++) {
      const btn = headerBtns.nth(i);
      const isVisible = await btn.isVisible().catch(() => false);
      if (!isVisible) continue;

      await btn.click();
      await page.waitForTimeout(800);

      // Check if auth modal appeared
      const phoneInput = await page.locator('input[type="tel"]').count();
      const authModal = await page.locator('[role="dialog"]').count();
      const signInText = await page.locator('text=/sign in|continue/i').count();

      if (phoneInput > 0 || authModal > 0 || signInText > 0) {
        authTriggered = true;
        break;
      }

      // Close any dropdown that opened without triggering auth
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // At least one protected button should trigger auth
    expect(authTriggered).toBe(true);
  });

  test('should display app in guest mode without authentication', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => !document.querySelector('.animate-spin'),
      { timeout: 20000 }
    );
    await page.waitForTimeout(1500);

    // App should show marketplace content to guests
    const header = await page.locator('header').count();
    expect(header).toBeGreaterThan(0);

    // Should have navigation
    const nav = await page.locator('nav, header').count();
    expect(nav).toBeGreaterThan(0);

    // Should show listing content (guest preview data)
    const bodyText = await page.textContent('body');
    expect(bodyText.length).toBeGreaterThan(100);

    // No errors
    const errorText = await page.locator('text=/crashed|fatal error/i').count();
    expect(errorText).toBe(0);
  });

  test('should allow broker registration flow', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    // Login with broker phone number
    await authHelper.login(testPhoneNumbers.broker);

    // Register with shipper role (broker is activated separately, not during registration)
    const brokerData = generateTestUser('shipper', 3);
    await authHelper.register(brokerData);

    // Verify logged in
    const isLoggedIn = await authHelper.isLoggedIn();
    expect(isLoggedIn).toBe(true);
  });

  test('should allow email magic-link fallback sign-in after linking', async ({
    authHelper,
    testPhoneNumbers,
    testEmails,
  }) => {
    test.slow();

    await authHelper.login(testPhoneNumbers.shipper);
    await authHelper.register({
      name: 'Magic Link User',
      role: 'shipper',
      email: testEmails.shipper,
    });

    await authHelper.configureBackupEmail(testEmails.shipper);
    await authHelper.completeLatestMagicLink(testEmails.shipper);
    await authHelper.waitForBackupEmailEnabled();

    await authHelper.logout();
    await authHelper.requestMagicLinkFromAuthModal(testEmails.shipper);
    await authHelper.completeLatestMagicLink(testEmails.shipper);

    const isLoggedIn = await authHelper.isLoggedIn();
    expect(isLoggedIn).toBe(true);
  });

  test('should block new magic-link sends after disabling email fallback', async ({
    authHelper,
    testPhoneNumbers,
    testEmails,
  }) => {
    test.slow();

    await authHelper.login(testPhoneNumbers.trucker);
    await authHelper.register({
      name: 'Disable Magic Link User',
      role: 'trucker',
      email: testEmails.trucker,
    });

    await authHelper.configureBackupEmail(testEmails.trucker);
    await authHelper.completeLatestMagicLink(testEmails.trucker);
    await authHelper.waitForBackupEmailEnabled();
    await authHelper.disableBackupEmail();
    await authHelper.logout();

    const getEmailSignInCodeCount = async (targetEmail) => {
      const response = await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${EMULATOR_PROJECT_ID}/oobCodes`);
      const payload = await response.json();
      const normalizedEmail = String(targetEmail || '').trim().toLowerCase();
      const codes = Array.isArray(payload?.oobCodes) ? payload.oobCodes : [];
      return codes.filter((code) => (
        String(code?.email || '').trim().toLowerCase() === normalizedEmail
        && String(code?.requestType || '').toUpperCase() === 'EMAIL_SIGNIN'
      )).length;
    };

    const countBefore = await getEmailSignInCodeCount(testEmails.trucker);

    await authHelper.requestMagicLinkFromAuthModal(testEmails.trucker);
    await new Promise((resolve) => setTimeout(resolve, 700));

    const countAfter = await getEmailSignInCodeCount(testEmails.trucker);

    expect(countAfter).toBe(countBefore);
  });

  test('should fail safely on invalid email magic-link callback', async ({ page }) => {
    await page.goto('/?mode=signIn&oobCode=INVALID-CODE&apiKey=fake-api-key');
    await page.waitForFunction(
      () => !document.querySelector('.animate-spin'),
      { timeout: 20000 }
    ).catch(() => {});
    await page.waitForTimeout(1000);

    const hasHeader = await page.locator('header').count();
    const hasFatalError = await page.locator('text=/fatal|crashed|unhandled error/i').count();
    expect(hasHeader).toBeGreaterThan(0);
    expect(hasFatalError).toBe(0);
  });
});
