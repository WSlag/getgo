import { test as base } from '@playwright/test';
import { TEST_PHONE_NUMBERS, TEST_OTP_CODE, clearEmulatorData } from '../utils/test-data.js';

/**
 * Custom Playwright fixtures for authentication testing
 *
 * Provides:
 * - testPhoneNumbers: Pre-configured test phone numbers
 * - authHelper: Reusable authentication methods
 *
 * NOTE: The Karga app shows the marketplace to all users (guests + authenticated).
 * Login is handled via an AuthModal overlay, which is triggered when a user
 * attempts a protected action (like posting a listing). The phone input is
 * INSIDE this modal, not on a standalone login page.
 */
export const test = base.extend({
  // Provide test phone numbers to all tests
  testPhoneNumbers: async ({}, use) => {
    await use(TEST_PHONE_NUMBERS);
  },

  // Provide authentication helper methods
  authHelper: async ({ page }, use) => {
    const helper = {
      /**
       * Opens the AuthModal by triggering a protected action (post listing click),
       * then completes phone OTP login.
       * @param {string} phoneNumber - Phone number to login with (use testPhoneNumbers)
       */
      async login(phoneNumber) {
        // Clear browser storage first to remove stale Firebase auth tokens
        // This ensures each test starts fresh without cached credentials
        // from previous tests that may have been invalidated by clearEmulatorData()
        await page.goto('/');
        await page.evaluate(() => {
          try { localStorage.clear(); } catch (e) {}
          try { sessionStorage.clear(); } catch (e) {}
          // Clear indexedDB Firebase auth databases
          const dbNames = ['firebaseLocalStorageDb', 'firebase-heartbeat-database'];
          dbNames.forEach(name => {
            try { indexedDB.deleteDatabase(name); } catch (e) {}
          });
        });
        // Reload to apply storage clear
        await page.reload({ waitUntil: 'domcontentloaded' });

        // Wait for app to fully render (no spinner)
        await page.waitForFunction(
          () => !document.querySelector('.animate-spin'),
          { timeout: 20000 }
        );
        await page.waitForTimeout(1000);

        // The phone input is inside the AuthModal.
        // Trigger it by clicking the "Post" button (or any protected action).
        let phoneInput = await page.locator('input[type="tel"]').count();

        if (phoneInput === 0) {
          // Click the notification Bell in the header — it triggers requireAuth() which opens AuthModal
          // The Bell button is always visible and calls onNotificationClick -> requireAuth
          const bellButton = page.locator('header button').filter({
            has: page.locator('svg'), // Bell is an SVG icon button
          }).first();

          // Try the bell (first icon button in header right section)
          const headerButtons = page.locator('header button');
          const headerBtnCount = await headerButtons.count();

          // Click each header button until phone modal appears
          for (let i = 0; i < Math.min(headerBtnCount, 5); i++) {
            const btn = headerButtons.nth(i);
            const isVisible = await btn.isVisible().catch(() => false);
            if (!isVisible) continue;

            await btn.click();
            await page.waitForTimeout(800);
            phoneInput = await page.locator('input[type="tel"]').count();
            if (phoneInput > 0) break;

            // Close any non-auth dialog that opened
            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
          }
        }

        // If still not found, try clicking profile/activity in sidebar (protected actions)
        if (phoneInput === 0) {
          // Click "Profile" tab in sidebar (calls requireAuth -> opens AuthModal)
          const profileBtn = page.locator('[class*="sidebar"] button, aside button').filter({
            hasText: /profile|activity|contracts|bids/i,
          }).first();

          if (await profileBtn.count() > 0) {
            await profileBtn.click();
            await page.waitForTimeout(800);
            phoneInput = await page.locator('input[type="tel"]').count();
          }
        }

        // Wait for phone input to be visible inside the modal
        await page.waitForSelector('input[type="tel"]', { timeout: 15000 });

        // The phone number format: the modal shows "+63" prefix separately,
        // so the input only takes the last 10 digits (9171234567 format)
        // but test phone numbers are in +63917... format.
        // Strip the +63 prefix if present
        const localPhone = phoneNumber.startsWith('+63')
          ? phoneNumber.slice(3)   // "9171234567"
          : phoneNumber;

        await page.fill('input[type="tel"]', localPhone);

        // Click "Continue" button (the AuthModal uses "Continue" text for send OTP)
        const sendButton = page.locator('button').filter({
          hasText: /continue|send|next/i,
        }).first();
        await sendButton.click();

        // Wait for OTP input (AuthModal uses placeholder="000000" and maxLength=6)
        await page.waitForSelector(
          'input[placeholder="000000"], input[type="text"][maxlength="6"]',
          { timeout: 15000 }
        );

        // Fetch the actual OTP from the Firebase Auth Emulator REST API
        // The emulator stores sent verification codes at this endpoint
        let otpCode = TEST_OTP_CODE; // fallback
        try {
          const resp = await fetch(
            'http://127.0.0.1:9099/emulator/v1/projects/karga-ph/verificationCodes'
          );
          if (resp.ok) {
            const data = await resp.json();
            // data.verificationCodes is an array of { phoneNumber, sessionInfo, code }
            // Find the most recent entry for our phone number
            const e164Phone = phoneNumber.startsWith('+') ? phoneNumber : `+63${phoneNumber}`;
            const matching = (data.verificationCodes || [])
              .filter((v) => v.phoneNumber === e164Phone)
              .pop(); // get latest
            if (matching?.code) {
              otpCode = matching.code;
            }
          }
        } catch (e) {
          // Emulator not available or different version — use fallback
        }

        // Enter OTP code
        const otpInput = page.locator(
          'input[placeholder="000000"], input[type="text"][maxlength="6"]'
        ).first();
        await otpInput.fill(otpCode);

        // Click "Verify" button (the AuthModal uses "Verify" text)
        await page.waitForTimeout(300);
        const verifyButton = page.locator('button').filter({
          hasText: /^verify$|verify code/i,
        }).first();

        if (await verifyButton.count() > 0) {
          await verifyButton.click();
        }

        // Wait for either registration screen or authenticated shell.
        // Authenticated shell requires auth modal to be closed.
        await page.waitForFunction(
          () => {
            const headings = Array.from(document.querySelectorAll('h1'));
            const onRegistrationScreen = headings.some((h) =>
              String(h.textContent || '').includes('Complete Your Profile')
            );
            const hasMainHeader = !!document.querySelector('header');
            const authDialog = document.querySelector('[role="dialog"]');
            const authDialogVisible = !!authDialog && window.getComputedStyle(authDialog).display !== 'none';
            return onRegistrationScreen || (hasMainHeader && !authDialogVisible);
          },
          { timeout: 30000 }
        ).catch(() => {});
        // Also wait for loading spinner to disappear to avoid auth/profile race checks.
        await page.waitForFunction(
          () => !document.querySelector('.animate-spin'),
          { timeout: 20000 }
        ).catch(() => {});
        await page.waitForTimeout(500);
      },

      /**
       * Complete registration form
       * @param {Object} userData - User data (name, role, etc.)
       */
      async register(userData) {
        const { name, role = 'shipper', email } = userData;

        // Wait explicitly for registration form input.
        // New users can briefly see the main shell before this renders.
        const nameInput = page.locator('input[placeholder="Juan dela Cruz"]').first();
        const skipButton = page.locator('button').filter({ hasText: /skip for now/i }).first();
        let hasRegistrationForm = false;
        try {
          await page.waitForSelector('input[placeholder="Juan dela Cruz"]', {
            state: 'visible',
            timeout: 60000,
          });
          hasRegistrationForm = true;
        } catch {
          hasRegistrationForm = false;
        }

        if (!hasRegistrationForm) {
          // Already logged in or no registration needed
          return;
        }

        // Fill basic information - name input has placeholder="Juan dela Cruz"
        await nameInput.click();
        await nameInput.fill(name);

        if (email) {
          const emailInput = page.locator('input[type="email"], input[placeholder="you@example.com"]');
          if (await emailInput.count() > 0) {
            await emailInput.fill(email);
          }
        }

        // Select role using the role button UI (Shipper / Trucker buttons)
        // Default is 'shipper', only need to click if different
        if (role === 'trucker') {
          const truckerButton = page.locator('button').filter({ hasText: /^Trucker$/ }).first();
          if (await truckerButton.count() > 0) {
            await truckerButton.click();
            await page.waitForTimeout(300);
          }
        }
        // Note: RegisterScreen does NOT have broker role — broker is activated separately

        // Submit registration form with "Get Started" button
        const submitButton = page.locator('button[type="submit"]').filter({
          hasText: /get started|creating profile/i,
        }).first();

        // Fallback to any submit button
        const anySubmit = await submitButton.count() > 0
          ? submitButton
          : page.locator('button[type="submit"]').first();

        const submitDisabled = await anySubmit.isDisabled().catch(() => false);
        if (submitDisabled) {
          if (await skipButton.count() > 0 && await skipButton.isVisible().catch(() => false)) {
            await skipButton.click();
          }
        } else {
          await anySubmit.click();
        }

        // Wait for the RegisterScreen to disappear (app loads main view).
        // After "Get Started" is clicked and createUserProfile() succeeds, isNewUser becomes false
        // and App.jsx transitions from RegisterScreen to GetGoApp.
        // The BrokerOnboardingModal in RegisterScreen is not shown because the component unmounts.
        await page.waitForFunction(
          () => {
            // Check if RegisterScreen heading is still in the DOM
            const h1s = Array.from(document.querySelectorAll('h1'));
            const onRegScreen = h1s.some((h) => h.textContent.includes('Complete Your Profile'));
            return !onRegScreen && !!document.querySelector('header');
          },
          { timeout: 25000 }
        );

        // Handle any modal that might have appeared (BrokerOnboardingModal or other)
        const maybeLaterBtn = page.locator('button').filter({ hasText: /maybe later/i }).first();
        if (await maybeLaterBtn.count() > 0 && await maybeLaterBtn.isVisible().catch(() => false)) {
          await maybeLaterBtn.click();
          await page.waitForTimeout(500);
        }

        // Wait for app state to fully stabilize
        await page.waitForTimeout(1500);
      },

      /**
       * Logout from the application
       */
      async logout() {
        // The logout option is inside the ProfileDropdown in the header.
        // The avatar button (last header button) opens the dropdown.
        const allHeaderBtns = page.locator('header button');
        const headerBtnCount = await allHeaderBtns.count();

        if (headerBtnCount > 0) {
          // Click the last header button (avatar/profile)
          const avatarBtn = allHeaderBtns.last();
          const isVisible = await avatarBtn.isVisible().catch(() => false);
          if (isVisible) {
            await avatarBtn.click();
            await page.waitForTimeout(500);
          }
        }

        // Click Logout menu item - it's a DropdownMenuItem with text "Logout"
        const logoutMenuItem = page.locator('[role="menuitem"]').filter({
          hasText: /logout/i,
        }).first();

        if (await logoutMenuItem.count() > 0) {
          await logoutMenuItem.click();
          await page.waitForTimeout(1500);
          return;
        }

        // Fallback: any visible button/link with logout text
        const anyLogout = page.locator('button, a').filter({
          hasText: /logout|sign out/i,
        }).first();

        if (await anyLogout.count() > 0 && await anyLogout.isVisible().catch(() => false)) {
          await anyLogout.click();
          await page.waitForTimeout(1500);
        }
      },

      /**
       * Navigate to a tab in the app.
       * Handles the difference between desktop (Sidebar) and mobile (MobileNav) navigation.
       * On desktop (1280px viewport), the Sidebar is visible with buttons like
       * "My Contracts", "Broker Dashboard/Program", "Cargo", "Trucks".
       * Mobile nav tabs (Activity, Messages, Profile) are hidden on desktop — they are
       * navigated via the profile dropdown in the header instead.
       *
       * @param {string} tabName - Tab to navigate to (e.g., 'contracts', 'broker', 'messages', 'profile', 'activity')
       */
      async navigateTo(tabName) {
        const tabLower = tabName.toLowerCase();

        // For tabs that are only visible in MobileNav on mobile (hidden on desktop at 1280px):
        // Navigate via profile dropdown or header buttons
        if (tabLower === 'messages' || tabLower === 'chat') {
          // Messages tab is only in MobileNav (hidden on desktop)
          // Use JavaScript to trigger tab change directly
          await page.evaluate(() => {
            // Find the Messages button in MobileNav and force click it
            const buttons = document.querySelectorAll('nav button');
            for (const btn of buttons) {
              if (btn.textContent.includes('Messages')) {
                btn.click();
                return true;
              }
            }
            return false;
          });
          await page.waitForTimeout(1000);
          return;
        }

        if (tabLower === 'profile') {
          // Profile is in MobileNav (hidden on desktop) and in header profile dropdown
          // The Avatar button is the LAST button in the header
          const allHeaderBtns = page.locator('header button');
          const headerBtnCount = await allHeaderBtns.count();

          if (headerBtnCount > 0) {
            // The last button in header is the user avatar/initial button
            const avatarBtn = allHeaderBtns.last();
            const isVisible = await avatarBtn.isVisible().catch(() => false);
            if (isVisible) {
              await avatarBtn.click();
              await page.waitForTimeout(500);

              // Click "Edit Profile" in the dropdown (ProfileDropdown uses "Edit Profile")
              const profileLink = page.locator('[role="menuitem"], button, a').filter({
                hasText: /edit profile|profile/i,
              }).first();
              if (await profileLink.count() > 0 && await profileLink.isVisible().catch(() => false)) {
                await profileLink.click();
                await page.waitForTimeout(1000);
                return;
              }

              // Close dropdown
              await page.keyboard.press('Escape');
              await page.waitForTimeout(300);
            }
          }

          // Fallback: JS click on MobileNav Profile button
          await page.evaluate(() => {
            const buttons = document.querySelectorAll('nav button');
            for (const btn of buttons) {
              if (btn.textContent.trim() === 'Profile') {
                btn.click();
                return;
              }
            }
          });
          await page.waitForTimeout(1000);
          return;
        }

        if (tabLower === 'activity') {
          // Activity is only in MobileNav (hidden on desktop)
          await page.evaluate(() => {
            const buttons = document.querySelectorAll('nav button');
            for (const btn of buttons) {
              if (btn.textContent.includes('Activity')) {
                btn.click();
                return;
              }
            }
          });
          await page.waitForTimeout(1000);
          return;
        }

        // For Sidebar tabs (visible on desktop): My Contracts, Broker Dashboard/Program, Cargo, Trucks
        // Use visible element selector
        let pattern;
        if (tabLower === 'contracts') pattern = /my contracts/i;
        else if (tabLower === 'broker') pattern = /broker/i;
        else if (tabLower === 'cargo') pattern = /cargo/i;
        else if (tabLower === 'trucks') pattern = /trucks/i;
        else if (tabLower === 'bids') pattern = /my bids|my bookings/i;
        else pattern = new RegExp(tabName, 'i');

        // Find the visible sidebar/header button
        const navBtn = page.locator('aside button, header button').filter({ hasText: pattern }).first();
        if (await navBtn.count() > 0) {
          const isVisible = await navBtn.isVisible().catch(() => false);
          if (isVisible) {
            await navBtn.click();
            await page.waitForTimeout(1000);
            return;
          }
        }

        // Fallback: any visible button matching the pattern
        const anyBtn = page.locator('button').filter({ hasText: pattern });
        const count = await anyBtn.count();
        for (let i = 0; i < Math.min(count, 5); i++) {
          const btn = anyBtn.nth(i);
          const isVisible = await btn.isVisible().catch(() => false);
          if (isVisible) {
            await btn.click();
            await page.waitForTimeout(1000);
            return;
          }
        }
      },

      /**
       * Clear all emulator data (use in beforeEach for test isolation)
       */
      async clearEmulatorData() {
        await clearEmulatorData();
      },

      /**
       * Check if user is logged in
       * In this app, logged-in state means there's NO auth modal open
       * and the header shows a user initial/avatar.
       */
      async isLoggedIn() {
        const hasHeader = await page.locator('header').count() > 0;

        // Check we're not on the RegisterScreen
        const h1Text = await page.locator('h1').first().textContent().catch(() => '');
        const onRegScreen = h1Text.includes('Complete Your Profile');

        if (!hasHeader || onRegScreen) return false;

        // Confirm no visible auth modal is blocking.
        const visibleAuthInput = await page.locator(
          '[role="dialog"] input[placeholder="9171234567"], [role="dialog"] input[placeholder="000000"]'
        ).first().isVisible().catch(() => false);
        if (visibleAuthInput) return false;

        // Probe a protected action: bell opens notifications when logged in,
        // but opens AuthModal for guests.
        const bellButton = page.locator('header button[aria-label*="notification" i], header button[title*="notification" i]').first();
        if (!(await bellButton.isVisible().catch(() => false))) {
          return false;
        }

        await bellButton.click();
        await page.waitForTimeout(500);

        const authPromptOpened = await page.locator(
          '[role="dialog"] input[placeholder="9171234567"], [role="dialog"] input[placeholder="000000"]'
        ).first().isVisible().catch(() => false);

        if (authPromptOpened) {
          await page.keyboard.press('Escape').catch(() => {});
          return false;
        }

        return true;
      },
    };

    await use(helper);
  },
});

export { expect } from '@playwright/test';
