import { test, expect } from '../fixtures/auth.fixture.js';
import { generateTestUser } from '../utils/test-data.js';

test.describe('Admin Mobile Access', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test.beforeEach(async ({ authHelper }) => {
    await authHelper.clearEmulatorData();
  });

  test('should not show Admin Dashboard entry in profile dropdown for non-admin users', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await authHelper.login(testPhoneNumbers.shipper);
    await authHelper.register(generateTestUser('shipper', 41));

    const headerButtons = page.locator('header button');
    await expect(headerButtons.last()).toBeVisible();
    await headerButtons.last().click();

    await expect(
      page.locator('[role="menuitem"]').filter({ hasText: /admin dashboard/i })
    ).toHaveCount(0);
  });

  test('should block #admin deep link for non-admin users', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await authHelper.login(testPhoneNumbers.shipper);
    await authHelper.register(generateTestUser('shipper', 42));

    await page.goto('/#admin');
    await page.waitForFunction(() => !document.querySelector('.animate-spin'), { timeout: 20000 }).catch(() => {});

    await expect(page.getByText(/access denied/i)).toBeVisible();
    await expect(page.getByText(/don't have permission/i)).toBeVisible();

    await page.getByRole('button', { name: /go back to app/i }).click();
    await expect(page.locator('header')).toBeVisible();
  });
});
