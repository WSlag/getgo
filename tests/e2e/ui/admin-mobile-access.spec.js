import { test, expect } from '../fixtures/auth.fixture.js';
import { generateTestUser, EMULATOR_PROJECT_ID } from '../utils/test-data.js';

const FIRESTORE_EMULATOR = 'http://127.0.0.1:8080';
const AUTH_EMULATOR = 'http://127.0.0.1:9099';

async function getEmulatorUidByPhone(phoneNumber) {
  const response = await fetch(
    `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/projects/${EMULATOR_PROJECT_ID}/accounts:lookup`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to lookup emulator user for ${phoneNumber}: ${response.status}`);
  }

  const data = await response.json();
  return data?.users?.[0]?.localId || null;
}

async function promoteUserToAdmin(uid) {
  const base = `${FIRESTORE_EMULATOR}/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`;
  const nowIso = new Date().toISOString();
  const url = `${base}/users/${uid}?updateMask.fieldPaths=isAdmin&updateMask.fieldPaths=role&updateMask.fieldPaths=updatedAt`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
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

    await page.goto('/#admin');
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
    await expect(page).not.toHaveURL(/#admin/);
    await expect(page.locator('header')).toBeVisible();
  });
});
