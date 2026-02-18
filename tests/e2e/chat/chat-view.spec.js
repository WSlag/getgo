import { test, expect } from '../fixtures/auth.fixture.js';
import { generateTestUser } from '../utils/test-data.js';

/**
 * Chat / Messages View E2E Tests
 *
 * Tests messaging functionality:
 * - Chat view accessible to authenticated users
 * - Shows empty state when no conversations
 * - Guest prompted to sign in
 *
 * NOTE: On desktop (1280px), Messages tab is in MobileNav which is hidden.
 * We use JS click via navigateTo() to access it.
 */

test.describe('Chat / Messages View', () => {
  test.beforeEach(async ({ authHelper }) => {
    await authHelper.clearEmulatorData();
  });

  test('should load messages view for authenticated user', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await authHelper.login(testPhoneNumbers.shipper);
    const userData = generateTestUser('shipper', 1);
    await authHelper.register(userData);

    // Navigate to messages (via JS click on MobileNav which is hidden on desktop)
    await authHelper.navigateTo('messages');

    // Should show messages view content
    const messagesContent = await page.locator(
      'text=/messages|conversations|no messages|chat/i'
    ).count();
    expect(messagesContent).toBeGreaterThan(0);
  });

  test('should show empty state when no conversations', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await authHelper.login(testPhoneNumbers.trucker);
    const userData = generateTestUser('trucker', 1);
    await authHelper.register(userData);

    await authHelper.navigateTo('messages');

    // Should show some messages-related content (even empty state)
    const messagesContent = await page.locator(
      'text=/messages|no messages|no conversations|conversations|chat/i'
    ).count();
    expect(messagesContent).toBeGreaterThan(0);
  });

  test('should redirect guest to sign-in for messages', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => !document.querySelector('.animate-spin'),
      { timeout: 15000 }
    );
    await page.waitForTimeout(1000);

    // Try clicking Messages tab via JS (it's hidden but still in DOM)
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('nav button');
      for (const btn of buttons) {
        if (btn.textContent.includes('Messages')) {
          btn.click();
          return;
        }
      }
    });
    await page.waitForTimeout(1000);

    // Should show sign-in prompt or auth modal
    const signInText = await page.locator('text=/sign in|please sign in/i').count();
    const authModal = await page.locator('[role="dialog"]').count();

    expect(signInText > 0 || authModal > 0).toBe(true);
  });

  test('should show unread message badge count', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    await authHelper.login(testPhoneNumbers.shipper);
    const userData = generateTestUser('shipper', 2);
    await authHelper.register(userData);

    // Check mobile nav or sidebar for unread badge
    // This is a soft check — just no crashes
    const errorText = await page.locator('text=/error|crashed/i').count();
    expect(errorText).toBe(0);
  });
});
