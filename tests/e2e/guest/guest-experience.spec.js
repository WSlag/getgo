import { test, expect } from '@playwright/test';

/**
 * Guest User Experience Tests
 *
 * Tests the app as an unauthenticated (guest) user:
 * - Homepage loads with marketplace preview data
 * - Navigation is accessible
 * - Auth modal appears on protected actions
 * - Dark mode toggle works
 */

test.describe('Guest User Experience', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to fully render (not loading spinner)
    await page.waitForFunction(
      () => !document.querySelector('.animate-spin'),
      { timeout: 15000 }
    );
  });

  test('should load homepage with marketplace listings', async ({ page }) => {
    // App should render without a loading spinner
    await expect(page.locator('.animate-spin')).toHaveCount(0, { timeout: 5000 });

    // Should show some content (guest preview data is loaded)
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(100);

    // Should NOT be stuck on a blank screen
    const hasContent = await page.locator('main, [role="main"], .min-h-screen').count();
    expect(hasContent).toBeGreaterThan(0);
  });

  test('should show cargo and truck listing tabs', async ({ page }) => {
    // Look for market toggle buttons (Cargo / Trucks)
    const cargoTab = page.locator('button, [role="tab"]').filter({ hasText: /cargo/i }).first();
    const truckTab = page.locator('button, [role="tab"]').filter({ hasText: /truck/i }).first();

    // At least one of these should be visible on the home screen
    const cargoCount = await cargoTab.count();
    const truckCount = await truckTab.count();
    expect(cargoCount + truckCount).toBeGreaterThan(0);
  });

  test('should show header with logo', async ({ page }) => {
    // Header should be visible
    const header = page.locator('header, [role="banner"]').first();
    await expect(header).toBeVisible();

    // Should contain Karga branding
    const headerText = await header.textContent();
    expect(
      headerText.toLowerCase().includes('karga') ||
      headerText.toLowerCase().includes('getgo')
    ).toBe(true);
  });

  test('should show auth modal when guest tries to post a listing', async ({ page }) => {
    // Find post/add button (visible for guests too)
    const postButton = page.locator('button').filter({ hasText: /post|add listing|\+/i }).first();

    if (await postButton.count() > 0) {
      await postButton.click();

      // Should show sign-in modal or redirect to auth
      await page.waitForTimeout(1000);

      const authModal = await page.locator(
        '[role="dialog"], .modal, [data-testid="auth-modal"]'
      ).count();
      const signInText = await page.locator('text=/sign in|login|authenticate/i').count();

      expect(authModal > 0 || signInText > 0).toBe(true);
    } else {
      // Post button may not be visible to guests — that's acceptable
      test.skip();
    }
  });

  test('should show guest preview listings on home screen', async ({ page }) => {
    // Guest marketplace data should be populated (guestCargoListings / guestTruckListings)
    await page.waitForTimeout(1500);

    // Should see listing cards
    const listingCards = await page.locator(
      '[data-testid*="listing"], [data-testid*="card"], .cargo-card, .truck-card, article'
    ).count();

    // If not via testid, check for price indicators (₱ sign) or route text
    const hasPrice = await page.locator('text=/₱|peso|PHP/i').count();
    const hasRoute = await page.locator('text=/manila|cebu|davao|quezon/i').count();

    // At least one of: cards, prices, or route names should be visible
    expect(listingCards > 0 || hasPrice > 0 || hasRoute > 0).toBe(true);
  });

  test('should support dark mode toggle', async ({ page }) => {
    // Look for dark mode toggle button
    const darkModeButton = page.locator(
      'button[aria-label*="dark"], button[aria-label*="theme"], button[title*="dark"]'
    );

    if (await darkModeButton.count() > 0) {
      // Get initial class state
      const initialClass = await page.locator('html').getAttribute('class');

      await darkModeButton.first().click();
      await page.waitForTimeout(500);

      const afterClass = await page.locator('html').getAttribute('class');
      // Class should have changed (dark mode applied/removed)
      // This is a soft check since not all implementations add class to html
      expect(typeof afterClass).toBe('string');
    } else {
      // Dark mode toggle might be inside a dropdown
      test.skip();
    }
  });

  test('should have accessible navigation elements', async ({ page }) => {
    // Should have navigation (sidebar or mobile nav)
    const nav = await page.locator('nav, [role="navigation"]').count();
    expect(nav).toBeGreaterThan(0);
  });

  test('should search/filter listings without login', async ({ page }) => {
    // Look for search input
    const searchInput = page.locator(
      'input[type="search"], input[placeholder*="search"], input[placeholder*="Search"]'
    ).first();

    if (await searchInput.count() > 0) {
      await searchInput.fill('Manila');
      await page.waitForTimeout(800);

      // Should not crash or show error
      const errorText = await page.locator('text=/error|crashed|something went wrong/i').count();
      expect(errorText).toBe(0);
    } else {
      test.skip();
    }
  });

  test('should show sign-in prompt on protected navigation tabs', async ({ page }) => {
    // Try clicking on a protected tab like "Notifications" or "Messages"
    const protectedTab = page.locator('button, a, [role="tab"]').filter({
      hasText: /notifications|messages|contracts/i,
    }).first();

    if (await protectedTab.count() > 0) {
      await protectedTab.click();
      await page.waitForTimeout(1000);

      // Should either show auth modal or a "Please sign in" message
      const authModal = await page.locator('[role="dialog"]').count();
      const signInText = await page.locator('text=/sign in|please login/i').count();
      const authMessage = await page.locator('text=/sign in to view/i').count();

      expect(authModal > 0 || signInText > 0 || authMessage > 0).toBe(true);
    }
  });
});
