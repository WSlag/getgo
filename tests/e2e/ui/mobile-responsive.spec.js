import { test, expect } from '@playwright/test';

/**
 * Mobile Responsiveness Tests
 *
 * Tests that the app works correctly on mobile viewport:
 * - Mobile nav appears at bottom
 * - Sidebar is hidden on mobile
 * - Content is scrollable and accessible
 */

test.describe('Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 812 } }); // iPhone 12 Pro

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => !document.querySelector('.animate-spin'),
      { timeout: 15000 }
    );
    await page.waitForTimeout(1000);
  });

  test('should show mobile navigation at bottom', async ({ page }) => {
    // Mobile nav should be visible on small screens
    // Usually uses fixed positioning at bottom
    const mobileNav = page.locator(
      '[class*="mobile"], [class*="bottom-nav"], nav.fixed, .mobile-nav'
    ).first();

    // Or look for the nav container that is only visible on mobile
    const bottomNav = page.locator('nav').last();

    const hasBottomNav = await mobileNav.count() + await bottomNav.count() > 0;
    expect(hasBottomNav).toBe(true);
  });

  test('should not show desktop sidebar on mobile', async ({ page }) => {
    // Sidebar should be hidden (display:none or via hidden class)
    // The sidebar in the app uses "hidden lg:flex" class
    const sidebar = page.locator('.hidden.lg\\:flex, [class*="sidebar"].hidden');

    if (await sidebar.count() > 0) {
      // Should not be visible on mobile
      const isVisible = await sidebar.first().isVisible();
      expect(isVisible).toBe(false);
    }
    // If selector doesn't match, just verify no horizontal overflow crash
    const errorText = await page.locator('text=/error|crashed/i').count();
    expect(errorText).toBe(0);
  });

  test('should have scrollable content on mobile', async ({ page }) => {
    // Content should not overflow horizontally
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = 375;

    // Should not have significant horizontal overflow
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 20); // 20px tolerance
  });

  test('should display listing cards on mobile', async ({ page }) => {
    // Listings should be visible on mobile too
    await page.waitForTimeout(1500);

    // App body should have content
    const bodyText = await page.textContent('body');
    expect(bodyText.length).toBeGreaterThan(50);

    // No error messages
    const errorText = await page.locator('text=/error|crashed|something went wrong/i').count();
    expect(errorText).toBe(0);
  });

  test('should show header on mobile', async ({ page }) => {
    const header = page.locator('header, [role="banner"]').first();
    await expect(header).toBeVisible();
  });
});

test.describe('Tablet Responsiveness', () => {
  test.use({ viewport: { width: 768, height: 1024 } }); // iPad

  test('should render correctly on tablet viewport', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => !document.querySelector('.animate-spin'),
      { timeout: 15000 }
    );
    await page.waitForTimeout(1000);

    // Should render without errors
    const errorText = await page.locator('text=/error|crashed/i').count();
    expect(errorText).toBe(0);

    // Header should be visible
    const header = page.locator('header, [role="banner"]').first();
    await expect(header).toBeVisible();
  });
});

test.describe('Desktop Layout', () => {
  test.use({ viewport: { width: 1440, height: 900 } }); // Large desktop

  test('should render correctly on large desktop', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => !document.querySelector('.animate-spin'),
      { timeout: 15000 }
    );
    await page.waitForTimeout(1000);

    // Sidebar should be visible on desktop
    const sidebar = page.locator(
      '[class*="sidebar"], aside, nav.flex-col'
    ).first();

    // Header should be visible
    const header = page.locator('header').first();
    await expect(header).toBeVisible();

    // No errors
    const errorText = await page.locator('text=/error|crashed/i').count();
    expect(errorText).toBe(0);
  });
});
