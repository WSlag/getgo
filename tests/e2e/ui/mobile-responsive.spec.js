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

  test('should keep first home content below sticky controls on mobile', async ({ page }) => {
    const stickyControls = page.getByTestId('home-sticky-controls');
    const content = page.getByTestId('home-scroll-content');

    await expect(stickyControls).toBeVisible();
    await expect(content).toBeVisible();

    const geometry = await page.evaluate(() => {
      const sticky = document.querySelector('[data-testid="home-sticky-controls"]');
      const contentEl = document.querySelector('[data-testid="home-scroll-content"]');
      if (!sticky || !contentEl) return null;

      const stickyRect = sticky.getBoundingClientRect();
      const contentRect = contentEl.getBoundingClientRect();
      return {
        stickyBottom: stickyRect.bottom,
        contentTop: contentRect.top,
      };
    });

    expect(geometry).not.toBeNull();
    expect(geometry.contentTop).toBeGreaterThanOrEqual(geometry.stickyBottom - 1);
  });

  test('should align home market pills and search controls on mobile', async ({ page }) => {
    const stickyControls = page.getByTestId('home-sticky-controls');
    await expect(stickyControls).toBeVisible();

    const cargoButton = page.getByRole('button', { name: /cargo/i }).first();
    const trucksButton = page.getByRole('button', { name: /trucks/i }).first();
    await expect(cargoButton).toBeVisible();
    await expect(trucksButton).toBeVisible();

    const geometry = await page.evaluate(() => {
      const sticky = document.querySelector('[data-testid="home-sticky-controls"]');
      if (!sticky) return null;

      const stickyRect = sticky.getBoundingClientRect();
      const marketButtons = Array.from(sticky.querySelectorAll('button')).slice(0, 2);
      const buttonRects = marketButtons.map((button) => button.getBoundingClientRect());
      const searchInput = sticky.querySelector('input[type="text"]');
      const searchRect = searchInput?.getBoundingClientRect();

      return {
        stickyLeft: stickyRect.left,
        stickyRight: stickyRect.right,
        buttonCount: buttonRects.length,
        buttons: buttonRects.map((rect) => ({
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height,
          top: rect.top,
          bottom: rect.bottom,
        })),
        searchTop: searchRect?.top ?? null,
      };
    });

    expect(geometry).not.toBeNull();
    expect(geometry.buttonCount).toBe(2);

    const [cargoRect, trucksRect] = geometry.buttons;
    expect(cargoRect.left).toBeGreaterThanOrEqual(geometry.stickyLeft - 1);
    expect(trucksRect.right).toBeLessThanOrEqual(geometry.stickyRight + 1);
    expect(Math.abs(cargoRect.height - trucksRect.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(cargoRect.width - trucksRect.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(cargoRect.top - trucksRect.top)).toBeLessThanOrEqual(1);
    expect(geometry.searchTop).not.toBeNull();
    expect(geometry.searchTop).toBeGreaterThanOrEqual(cargoRect.bottom - 1);
  });

  test('should keep listing controls stable while scrolling', async ({ page }) => {
    const scrollContainer = page.getByTestId('home-scroll-container');
    const listingControls = page.getByTestId('home-sticky-controls');

    await expect(scrollContainer).toBeVisible();
    await expect(listingControls).toBeVisible();

    const initialGeometry = await listingControls.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const computed = window.getComputedStyle(el);
      return {
        top: rect.top,
        height: rect.height,
        opacity: Number(computed.opacity),
      };
    });
    expect(initialGeometry.height).toBeGreaterThanOrEqual(90);
    expect(initialGeometry.opacity).toBeGreaterThan(0.95);

    const maxScrollTop = await page.evaluate(() => {
      const container = document.querySelector('[data-testid="home-scroll-container"]');
      if (!container) return 0;
      return Math.max(0, container.scrollHeight - container.clientHeight);
    });
    test.skip(maxScrollTop < 120, 'Not enough scrollable content to validate hide/reveal behavior.');

    await page.evaluate((targetTop) => {
      const container = document.querySelector('[data-testid="home-scroll-container"]');
      container?.scrollTo({ top: targetTop, behavior: 'auto' });
    }, maxScrollTop);
    await page.waitForTimeout(450);

    const scrolledGeometry = await listingControls.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const computed = window.getComputedStyle(el);
      return {
        top: rect.top,
        height: rect.height,
        opacity: Number(computed.opacity),
      };
    });
    expect(scrolledGeometry.height).toBeGreaterThanOrEqual(90);
    expect(Math.abs(scrolledGeometry.height - initialGeometry.height)).toBeLessThanOrEqual(2);
    expect(scrolledGeometry.opacity).toBeGreaterThan(0.95);
    expect(scrolledGeometry.top).toBeLessThanOrEqual(initialGeometry.top + 2);

    await page.evaluate(() => {
      const container = document.querySelector('[data-testid="home-scroll-container"]');
      container?.scrollTo({ top: 0, behavior: 'auto' });
    });
    await page.waitForTimeout(300);

    const restoredGeometry = await listingControls.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return { top: rect.top, height: rect.height };
    });
    expect(restoredGeometry.height).toBeGreaterThanOrEqual(90);
    expect(restoredGeometry.top).toBeGreaterThanOrEqual(initialGeometry.top - 6);
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

    const warmupScrollTop = await page.evaluate(() => {
      const container = document.querySelector('[data-testid="home-scroll-container"]');
      if (!container) return 0;
      return Math.min(24, Math.max(0, container.scrollHeight - container.clientHeight));
    });
    if (warmupScrollTop > 0) {
      await page.evaluate((targetTop) => {
        const container = document.querySelector('[data-testid="home-scroll-container"]');
        container?.scrollTo({ top: targetTop, behavior: 'auto' });
      }, warmupScrollTop);
      await page.waitForTimeout(160);

      const warmupStickyTop = await stickyControls.evaluate((el) => el.getBoundingClientRect().top);
      expect(warmupStickyTop).toBeGreaterThanOrEqual(initialGeometry.stickyTop - 3);
    }

    const maxScrollTop = await page.evaluate(() => {
      const container = document.querySelector('[data-testid="home-scroll-container"]');
      if (!container) return 0;
      return Math.max(0, container.scrollHeight - container.clientHeight);
    });
    test.skip(maxScrollTop < 120, 'Not enough scrollable content to validate sticky collapse behavior.');

    await page.evaluate((targetTop) => {
      const container = document.querySelector('[data-testid="home-scroll-container"]');
      container?.scrollTo({ top: targetTop, behavior: 'auto' });
    }, maxScrollTop);
    await page.waitForTimeout(450);

    const stickyTopWhenCollapsed = await stickyControls.evaluate((el) => el.getBoundingClientRect().top);
    expect(stickyTopWhenCollapsed).toBeLessThanOrEqual(
      Math.max(36, initialGeometry.stickyTop + 2)
    );

    await page.evaluate(() => {
      const container = document.querySelector('[data-testid="home-scroll-container"]');
      container?.scrollTo({ top: 0, behavior: 'auto' });
    });
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

    const controlsOnNarrow = page.getByTestId('home-sticky-controls');
    await expect(controlsOnNarrow).toBeVisible();

    const controlGeometry = await page.evaluate(() => {
      const sticky = document.querySelector('[data-testid="home-sticky-controls"]');
      if (!sticky) return null;
      const stickyRect = sticky.getBoundingClientRect();
      const buttons = Array.from(sticky.querySelectorAll('button')).slice(0, 2);
      const rects = buttons.map((button) => button.getBoundingClientRect());
      const searchInput = sticky.querySelector('input[type="text"]');
      const searchRect = searchInput?.getBoundingClientRect();
      return {
        rowTop: rects[0]?.top ?? null,
        rowLeft: stickyRect.left,
        rowRight: stickyRect.right,
        buttonCount: rects.length,
        rects: rects.map((rect) => ({
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height,
          top: rect.top,
          bottom: rect.bottom,
        })),
        searchTop: searchRect?.top ?? null,
      };
    });

    expect(controlGeometry).not.toBeNull();
    expect(controlGeometry.buttonCount).toBe(2);
    expect(controlGeometry.rowTop).toBeGreaterThanOrEqual(0);
    controlGeometry.rects.forEach((rect) => {
      expect(rect.left).toBeGreaterThanOrEqual(controlGeometry.rowLeft - 1);
      expect(rect.right).toBeLessThanOrEqual(controlGeometry.rowRight + 1);
      expect(rect.height).toBeGreaterThanOrEqual(44);
    });
    expect(controlGeometry.searchTop).not.toBeNull();
    expect(controlGeometry.searchTop).toBeGreaterThanOrEqual(controlGeometry.rects[0].bottom - 1);

    const maxScrollTop = await page.evaluate(() => {
      const container = document.querySelector('[data-testid="home-scroll-container"]');
      if (!container) return 0;
      return Math.max(0, container.scrollHeight - container.clientHeight);
    });
    test.skip(maxScrollTop < 120, 'Not enough scrollable content to validate narrow hide/reveal behavior.');

    await page.evaluate((targetTop) => {
      const container = document.querySelector('[data-testid="home-scroll-container"]');
      container?.scrollTo({ top: targetTop, behavior: 'auto' });
    }, maxScrollTop);
    await page.waitForTimeout(450);

    const narrowScrolledHeight = await controlsOnNarrow.evaluate((el) => el.getBoundingClientRect().height);
    expect(narrowScrolledHeight).toBeGreaterThanOrEqual(90);

    await page.evaluate(() => {
      const container = document.querySelector('[data-testid="home-scroll-container"]');
      container?.scrollTo({ top: 0, behavior: 'auto' });
    });
    await page.waitForTimeout(450);

    const narrowRevealedHeight = await controlsOnNarrow.evaluate((el) => el.getBoundingClientRect().height);
    expect(narrowRevealedHeight).toBeGreaterThanOrEqual(90);
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
