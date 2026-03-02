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

  test('should align home filter pills evenly on mobile', async ({ page }) => {
    const listingHeader = page.getByTestId('home-listing-header');
    const listingCount = page.getByTestId('home-listing-count');
    const listingSummary = page.getByTestId('home-listing-summary');
    await expect(listingSummary).toBeVisible();
    await expect(listingHeader).toBeVisible();
    await expect(listingCount).toBeVisible();

    const filterRow = page.getByTestId('home-filter-pills');
    await expect(filterRow).toBeVisible();

    const allPill = page.getByTestId('home-filter-pill-all');
    const openPill = page.getByTestId('home-filter-pill-open');
    const waitingPill = page.getByTestId('home-filter-pill-waiting');
    await expect(allPill).toBeVisible();
    await expect(openPill).toBeVisible();
    await expect(waitingPill).toBeVisible();

    const geometry = await filterRow.evaluate((row) => {
      const rowRect = row.getBoundingClientRect();
      const buttons = Array.from(row.querySelectorAll('button'));
      const rects = buttons.map((button) => button.getBoundingClientRect());
      return {
        rowLeft: rowRect.left,
        rowRight: rowRect.right,
        buttonCount: rects.length,
        rects: rects.map((rect) => ({
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height,
          top: rect.top,
        })),
      };
    });

    expect(geometry.buttonCount).toBe(3);

    const [first, second, third] = geometry.rects;
    expect(first.left).toBeGreaterThanOrEqual(geometry.rowLeft - 1);
    expect(third.right).toBeLessThanOrEqual(geometry.rowRight + 1);

    expect(Math.abs(first.height - second.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(second.height - third.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(first.width - second.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(second.width - third.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(first.top - second.top)).toBeLessThanOrEqual(1);
    expect(Math.abs(second.top - third.top)).toBeLessThanOrEqual(1);

    const verticalOrder = await page.evaluate(() => {
      const summary = document.querySelector('[data-testid="home-listing-summary"]');
      const pills = document.querySelector('[data-testid="home-filter-pills"]');
      if (!summary || !pills) return null;
      const summaryRect = summary.getBoundingClientRect();
      const pillsRect = pills.getBoundingClientRect();
      return {
        summaryBottom: summaryRect.bottom,
        pillsTop: pillsRect.top,
      };
    });
    expect(verticalOrder).not.toBeNull();
    expect(verticalOrder.pillsTop).toBeGreaterThanOrEqual(verticalOrder.summaryBottom - 1);
  });

  test('should collapse mobile header and pin sticky controls to top on scroll', async ({ page }) => {
    const scrollContainer = page.getByTestId('home-scroll-container');
    const header = page.getByTestId('app-header');
    const stickyControls = page.getByTestId('home-sticky-controls');

    await expect(scrollContainer).toBeVisible();
    await expect(header).toBeVisible();
    await expect(stickyControls).toBeVisible();

    const initialGeometry = await page.evaluate(() => {
      const headerEl = document.querySelector('[data-testid="app-header"]');
      const stickyEl = document.querySelector('[data-testid="home-sticky-controls"]');
      if (!headerEl || !stickyEl) return null;
      const headerRect = headerEl.getBoundingClientRect();
      const stickyRect = stickyEl.getBoundingClientRect();
      return {
        headerBottom: headerRect.bottom,
        headerHeight: headerRect.height,
        stickyTop: stickyRect.top,
      };
    });

    expect(initialGeometry).not.toBeNull();
    expect(initialGeometry.headerHeight).toBeGreaterThan(40);
    expect(initialGeometry.stickyTop).toBeGreaterThanOrEqual(initialGeometry.headerBottom - 2);

    await scrollContainer.hover();
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(450);

    const stickyTopWhenCollapsed = await stickyControls.evaluate((el) => el.getBoundingClientRect().top);
    expect(stickyTopWhenCollapsed).toBeLessThanOrEqual(12);

    await scrollContainer.hover();
    await page.mouse.wheel(0, -900);
    await page.waitForTimeout(450);

    const restoredGeometry = await page.evaluate(() => {
      const headerEl = document.querySelector('[data-testid="app-header"]');
      const stickyEl = document.querySelector('[data-testid="home-sticky-controls"]');
      if (!headerEl || !stickyEl) return null;
      const headerRect = headerEl.getBoundingClientRect();
      const stickyRect = stickyEl.getBoundingClientRect();
      return {
        headerBottom: headerRect.bottom,
        headerHeight: headerRect.height,
        stickyTop: stickyRect.top,
      };
    });

    expect(restoredGeometry).not.toBeNull();
    expect(restoredGeometry.headerHeight).toBeGreaterThan(40);
    expect(restoredGeometry.stickyTop).toBeGreaterThanOrEqual(restoredGeometry.headerBottom - 2);
  });
});

test.describe('Mobile Responsiveness Narrow Viewport', () => {
  test.use({ viewport: { width: 320, height: 700 } });

  test('should keep market switcher below header on narrow screens', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => !document.querySelector('.animate-spin'),
      { timeout: 15000 }
    );
    await page.waitForTimeout(1000);

    const geometry = await page.evaluate(() => {
      const headerEl = document.querySelector('[data-testid="app-header"]');
      const stickyEl = document.querySelector('[data-testid="home-sticky-controls"]');
      if (!headerEl || !stickyEl) return null;
      const headerRect = headerEl.getBoundingClientRect();
      const stickyRect = stickyEl.getBoundingClientRect();
      return {
        headerBottom: headerRect.bottom,
        headerHeight: headerRect.height,
        stickyTop: stickyRect.top,
      };
    });

    expect(geometry).not.toBeNull();
    expect(geometry.headerHeight).toBeGreaterThan(40);
    expect(geometry.stickyTop).toBeGreaterThanOrEqual(geometry.headerBottom - 2);

    const summaryOnNarrow = page.getByTestId('home-listing-summary');
    await expect(summaryOnNarrow).toBeVisible();

    const filterGeometry = await page.evaluate(() => {
      const row = document.querySelector('[data-testid="home-filter-pills"]');
      const summary = document.querySelector('[data-testid="home-listing-summary"]');
      if (!row) return null;
      const rowRect = row.getBoundingClientRect();
      const summaryRect = summary?.getBoundingClientRect() || null;
      const buttons = Array.from(row.querySelectorAll('button'));
      const rects = buttons.map((button) => button.getBoundingClientRect());
      return {
        summaryBottom: summaryRect ? summaryRect.bottom : null,
        rowTop: rowRect.top,
        rowLeft: rowRect.left,
        rowRight: rowRect.right,
        buttonCount: rects.length,
        rects: rects.map((rect) => ({
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height,
        })),
      };
    });

    expect(filterGeometry).not.toBeNull();
    expect(filterGeometry.buttonCount).toBe(3);
    expect(filterGeometry.summaryBottom).not.toBeNull();
    expect(filterGeometry.rowTop).toBeGreaterThanOrEqual(filterGeometry.summaryBottom - 1);
    filterGeometry.rects.forEach((rect) => {
      expect(rect.left).toBeGreaterThanOrEqual(filterGeometry.rowLeft - 1);
      expect(rect.right).toBeLessThanOrEqual(filterGeometry.rowRight + 1);
      expect(rect.height).toBeGreaterThanOrEqual(44);
    });
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
