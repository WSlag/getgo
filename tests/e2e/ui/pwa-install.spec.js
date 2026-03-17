import { test, expect } from '../fixtures/auth.fixture.js';
import { generateTestUser } from '../utils/test-data.js';

async function dispatchInstallPromptEvent(page, outcome = 'dismissed') {
  await page.evaluate((promptOutcome) => {
    window.__pwaPromptCalled = 0;
    const event = new Event('beforeinstallprompt');
    event.prompt = () => {
      window.__pwaPromptCalled = (window.__pwaPromptCalled || 0) + 1;
    };
    event.userChoice = Promise.resolve({ outcome: promptOutcome });
    window.dispatchEvent(event);
  }, outcome);
}

test.describe('PWA Install UX', () => {
  test.beforeEach(async ({ authHelper }) => {
    await authHelper.clearEmulatorData();
  });

  test('should open installPWA modal and handle install CTA click', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('karga.pwa.installModalPending', 'true');
      localStorage.removeItem('karga.pwa.installAccepted');
      localStorage.removeItem('karga.pwa.installModalDismissedAt');
    });

    await page.goto('/');

    const installModal = page.getByRole('dialog').filter({ hasText: /Install GetGo/i }).first();
    await expect(installModal).toBeVisible();
    await expect(installModal.getByRole('button', { name: /E-install/i })).toBeVisible();

    await dispatchInstallPromptEvent(page, 'dismissed');
    await installModal.getByRole('button', { name: /E-install/i }).click();

    const promptCount = await page.evaluate(() => window.__pwaPromptCalled || 0);
    expect(promptCount).toBeGreaterThan(0);
    await expect(installModal).toBeHidden();
  });

  test('should show Install App button on profile and trigger install prompt', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await authHelper.login(testPhoneNumbers.shipper);
    const userData = generateTestUser('shipper', 31);
    await authHelper.register(userData);

    await page.evaluate(() => {
      localStorage.setItem('karga.pwa.engagementReached', 'true');
      localStorage.removeItem('karga.pwa.installAccepted');
    });
    await page.reload();

    await authHelper.navigateTo('profile');

    const installAppButton = page.getByRole('button', { name: /E-install ang App/i });
    await expect(installAppButton).toBeVisible();

    await dispatchInstallPromptEvent(page, 'accepted');
    await installAppButton.click();

    const promptCount = await page.evaluate(() => window.__pwaPromptCalled || 0);
    expect(promptCount).toBeGreaterThan(0);
  });
});
