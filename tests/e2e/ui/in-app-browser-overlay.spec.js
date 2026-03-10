import { test, expect } from '@playwright/test';

const ANDROID_FACEBOOK_UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A.230805.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/442.0.0.35.119;]';
const IOS_FACEBOOK_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/450.0.0.0.55;FBBV/000000000]';

test.describe('In-app browser overlay', () => {
  test.describe('Android Facebook WebView', () => {
    test.use({
      userAgent: ANDROID_FACEBOOK_UA,
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });

    test('shows Android professional overlay layout with CTA and two steps', async ({ page }) => {
      await page.goto('/');

      const overlay = page.getByTestId('inapp-overlay');
      await expect(overlay).toBeVisible();
      await expect(page.getByTestId('inapp-card')).toBeVisible();
      await expect(page.getByTestId('inapp-title')).toHaveText(/open in google/i);
      await expect(page.getByTestId('inapp-primary-cta')).toBeVisible();
      await expect(page.getByTestId('inapp-steps').locator('li')).toHaveCount(2);
      await expect(page.getByTestId('inapp-ios-copy')).toHaveCount(0);

      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1
      );
      expect(hasHorizontalOverflow).toBe(false);
    });
  });

  test.describe('iOS Facebook WebView', () => {
    test.use({
      userAgent: IOS_FACEBOOK_UA,
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3,
    });

    test('shows iOS professional overlay layout with copy action and two steps', async ({ page }) => {
      await page.goto('/');

      const overlay = page.getByTestId('inapp-overlay');
      await expect(overlay).toBeVisible();
      await expect(page.getByTestId('inapp-card')).toBeVisible();
      await expect(page.getByTestId('inapp-title')).toHaveText(/open in safari/i);
      await expect(page.getByTestId('inapp-ios-copy')).toBeVisible();
      await expect(page.getByTestId('inapp-steps').locator('li')).toHaveCount(2);
      await expect(page.getByTestId('inapp-primary-cta')).toHaveCount(0);

      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1
      );
      expect(hasHorizontalOverflow).toBe(false);
    });
  });
});
