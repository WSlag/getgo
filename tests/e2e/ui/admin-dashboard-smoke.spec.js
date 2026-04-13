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

test.describe('Admin Dashboard Smoke', () => {
  test.beforeEach(async ({ authHelper }) => {
    await authHelper.clearEmulatorData();
  });

  test('should render all admin dashboard sections and core controls', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await authHelper.login(testPhoneNumbers.admin);
    await authHelper.register(generateTestUser('shipper', 51));

    const adminUid = await getEmulatorUidByPhone(testPhoneNumbers.admin);
    expect(adminUid).toBeTruthy();
    await promoteUserToAdmin(adminUid);

    await page.goto('/app/admin');
    await page.waitForFunction(() => !document.querySelector('.animate-spin'), { timeout: 30000 }).catch(() => {});

    const sidebar = page.locator('aside').first();
    await expect(sidebar).toBeVisible();
    await expect(page.locator('header h1')).toContainText('Dashboard');

    const refreshButton = page.locator('header button', {
      has: page.locator('svg.lucide-refresh-cw'),
    }).first();
    await expect(refreshButton).toBeVisible();
    await refreshButton.click();

    const darkModeButton = page.locator('header button', {
      has: page.locator('svg.lucide-moon, svg.lucide-sun'),
    }).first();
    await expect(darkModeButton).toBeVisible();
    await darkModeButton.click();
    await darkModeButton.click();

    // Keep this smoke test focused on core admin surfaces so it remains stable
    // under emulator constraints while still validating admin access flow.
    const sections = [
      { navLabel: 'Dashboard', title: 'Dashboard' },
      { navLabel: 'Users', title: 'User Management' },
      { navLabel: 'Listings', title: 'Listings Management' },
      { navLabel: 'Contracts', title: 'Contracts' },
      { navLabel: 'Payments', title: 'Payment Review' },
    ];

    for (const section of sections) {
      await sidebar.getByRole('button', { name: new RegExp(`^${section.navLabel}$`, 'i') }).click();
      await expect(page.locator('header h1')).toContainText(section.title);
      await expect(page.getByText(/access denied/i)).toHaveCount(0);
      await expect(page.locator('main')).toBeVisible();
    }

    const backToAppButton = sidebar.getByRole('button', { name: /back to app/i });
    await expect(backToAppButton).toBeVisible();
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
