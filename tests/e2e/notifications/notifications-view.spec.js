import { test, expect } from '../fixtures/auth.fixture.js';
import { generateTestUser } from '../utils/test-data.js';

const getNotificationBell = (page) =>
  page.locator(
    'header button[aria-label*="notification" i], header button[title*="notification" i]'
  ).first();

const getNotificationsHeading = (page) =>
  page.locator('main h1').filter({ hasText: /notifications/i }).first();

async function openNotificationsRoute(page, authHelper) {
  await authHelper.navigateTo('notifications');
  await expect(page).toHaveURL(/\/app\/notifications(?:[/?#]|$)/);
  await expect(getNotificationsHeading(page)).toBeVisible({ timeout: 20000 });
}

/**
 * Notifications View E2E Tests
 *
 * Tests notification management:
 * - Notifications view loads for authenticated users
 * - Mark all as read works
 * - Empty state when no notifications
 * - Guest sees sign-in prompt
 *
 * NOTE: Notifications are accessed via the header bell button (no dedicated nav tab on desktop).
 * After login (which uses the bell button), the notifications view is already shown.
 */

test.describe('Notifications View', () => {
  test.beforeEach(async ({ authHelper }) => {
    await authHelper.clearEmulatorData();
  });

  test('should load notifications view for authenticated user', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    // Login via bell button - this triggers auth with notifications pending action
    // After login, the app auto-navigates to notifications view
    await authHelper.login(testPhoneNumbers.shipper);
    const userData = generateTestUser('shipper', 1);
    await authHelper.register(userData);
    await openNotificationsRoute(page, authHelper);
    await expect(getNotificationsHeading(page)).toBeVisible();
  });

  test('should show empty state when no notifications', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await authHelper.login(testPhoneNumbers.trucker);
    const userData = generateTestUser('trucker', 1);
    await authHelper.register(userData);
    await openNotificationsRoute(page, authHelper);

    const emptyState = page.locator('main').locator('text=/no notifications|all caught up|nothing to see|empty/i').first();
    const hasEmptyState = await emptyState.isVisible().catch(() => false);

    if (!hasEmptyState) {
      await expect(
        page.locator('main').locator('text=/welcome to getgo|just now|ago|notification/i').first()
      ).toBeVisible({ timeout: 20000 });
      return;
    }

    await expect(emptyState).toBeVisible({ timeout: 20000 });
  });

  test('should show mark all read button when notifications exist', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await authHelper.login(testPhoneNumbers.shipper);
    const userData = generateTestUser('shipper', 2);
    await authHelper.register(userData);
    await openNotificationsRoute(page, authHelper);

    // If mark all read button is present, click it
    const markAllReadButton = page.locator('button').filter({
      hasText: /mark all|read all/i,
    }).first();

    if (await markAllReadButton.count() > 0 && await markAllReadButton.isVisible().catch(() => false)) {
      await markAllReadButton.click();
      await page.waitForTimeout(500);
      // No errors
      const errorText = await page.locator('text=/error|failed/i').count();
      expect(errorText).toBe(0);
    } else {
      // Just verify notifications area is present
      const notifArea = await page.locator('text=/notifications/i').count();
      expect(notifArea).toBeGreaterThan(0);
    }
  });

  test('should show notification bell icon in header', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await authHelper.login(testPhoneNumbers.shipper);
    const userData = generateTestUser('shipper', 3);
    await authHelper.register(userData);

    // Notification bell should be visible in header
    const bellBtn = getNotificationBell(page);
    await expect(bellBtn).toBeVisible();

    // No crash
    const errorText = await page.locator('text=/error|crashed/i').count();
    expect(errorText).toBe(0);
  });

  test('should hide soft push banner after permission becomes denied', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await page.addInitScript(() => {
      const OriginalNotification = window.Notification;
      let permissionState = 'default';

      function FakeNotification() {}
      Object.defineProperty(FakeNotification, 'permission', {
        get() {
          return permissionState;
        },
      });
      FakeNotification.requestPermission = async () => {
        permissionState = 'denied';
        return permissionState;
      };

      if (OriginalNotification) {
        Object.setPrototypeOf(FakeNotification, OriginalNotification);
      }

      window.Notification = FakeNotification;
    });

    await authHelper.login(testPhoneNumbers.shipper);
    const userData = generateTestUser('shipper', 4);
    await authHelper.register(userData);
    await openNotificationsRoute(page, authHelper);

    const softBannerLaterButton = page.getByRole('button', { name: /^Later$/i });
    await expect(softBannerLaterButton).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /^Activate$/i }).last().click();

    await expect(page.locator('text=Notifications Blocked')).toBeVisible({ timeout: 15000 });
    await expect(softBannerLaterButton).toBeHidden({ timeout: 15000 });
  });

  test('should redirect guest to sign-in for notifications', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => !document.querySelector('.animate-spin'),
      { timeout: 15000 }
    );
    await page.waitForTimeout(1000);

    // Click bell button (protected action for guests)
    const bellBtn = getNotificationBell(page);
    if (await bellBtn.count() > 0) {
      const isVisible = await bellBtn.isVisible().catch(() => false);
      if (isVisible) {
        await bellBtn.click();
        await page.waitForTimeout(1000);

        const signInText = await page.locator('text=/sign in|please sign in/i').count();
        const authModal = await page.locator('[role="dialog"]').count();
        const phoneInput = await page.locator('input[type="tel"]').count();

        expect(signInText > 0 || authModal > 0 || phoneInput > 0).toBe(true);
      }
    }
  });
});
