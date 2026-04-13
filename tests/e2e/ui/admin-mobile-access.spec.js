import { test, expect } from '../fixtures/auth.fixture.js';
import { generateTestUser, EMULATOR_PROJECT_ID } from '../utils/test-data.js';

const FIRESTORE_EMULATOR = 'http://127.0.0.1:8080';

async function getEmulatorUidByPhone(phoneNumber) {
  const response = await fetch(
    `${FIRESTORE_EMULATOR}/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents/users?pageSize=500`,
    {
      headers: {
        Authorization: 'Bearer owner',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to lookup emulator user for ${phoneNumber}: ${response.status}`);
  }

  const data = await response.json();
  const normalizedPhone = String(phoneNumber || '').trim();
  const match = (data?.documents || []).find((doc) => {
    const candidate = String(doc?.fields?.phone?.stringValue || '').trim();
    return candidate === normalizedPhone;
  });
  return match?.name?.split('/').pop() || null;
}

async function promoteUserToAdmin(uid) {
  const base = `${FIRESTORE_EMULATOR}/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`;
  const nowIso = new Date().toISOString();
  const url = `${base}/users/${uid}?updateMask.fieldPaths=isAdmin&updateMask.fieldPaths=role&updateMask.fieldPaths=updatedAt`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer owner',
    },
    body: JSON.stringify({
      fields: {
        isAdmin: { booleanValue: true },
        role: { stringValue: 'admin' },
        updatedAt: { timestampValue: nowIso },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Failed to promote emulator user ${uid} to admin: ${response.status} ${body}`);
  }
}

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

  test('should block /app/admin deep link for non-admin users', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await authHelper.login(testPhoneNumbers.shipper);
    await authHelper.register(generateTestUser('shipper', 42));

    await page.goto('/app/admin');
    await page.waitForFunction(() => !document.querySelector('.animate-spin'), { timeout: 20000 }).catch(() => {});

    await expect(page.getByText(/access denied/i)).toBeVisible();
    await expect(page.getByText(/don't have permission/i)).toBeVisible();

    await page.getByRole('button', { name: /go back to app/i }).click();
    await expect(page.locator('header')).toBeVisible();
  });

  test('should keep Back to App visible and tappable in admin mobile drawer', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await authHelper.login(testPhoneNumbers.admin);
    await authHelper.register(generateTestUser('shipper', 43));

    const adminUid = await getEmulatorUidByPhone(testPhoneNumbers.admin);
    expect(adminUid).toBeTruthy();
    await promoteUserToAdmin(adminUid);

    await page.goto('/app/admin');
    await page.waitForFunction(() => !document.querySelector('.animate-spin'), { timeout: 20000 }).catch(() => {});

    const menuButton = page.locator('header button', {
      has: page.locator('svg.lucide-menu'),
    }).first();
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    const sidebar = page.locator('aside').filter({ hasText: /GetGo Admin/i }).first();
    await expect(sidebar).toBeVisible();

    const navScroller = sidebar.locator('nav').first();
    await navScroller.evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });

    const backToAppButton = sidebar.getByRole('button', { name: /back to app/i });
    await expect(backToAppButton).toBeVisible();

    const box = await backToAppButton.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      const viewport = page.viewportSize();
      expect(box.y).toBeGreaterThanOrEqual(0);
      if (viewport) {
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
      }
    }

    await backToAppButton.click();
    await expect(page).not.toHaveURL(/\/app\/admin(?:\/)?$/);

    await expect
      .poll(async () => {
        const hasHeader = await page.locator('header').first().isVisible().catch(() => false);
        const retryingProfile = await page.getByText(/retrying profile load/i).first().isVisible().catch(() => false);
        const hasFatalFallback = await page.getByText(/something went wrong|fatal error|unhandled error/i).count();
        if (hasFatalFallback > 0) return false;
        return hasHeader || retryingProfile;
      }, { timeout: 15000 })
      .toBe(true);
  });
});
