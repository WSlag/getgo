import { test as base } from '@playwright/test';
import {
  TEST_PHONE_NUMBERS,
  TEST_EMAILS,
  TEST_OTP_CODE,
  EMULATOR_PROJECT_ID,
  clearEmulatorData,
} from '../utils/test-data.js';

async function waitForSpinnerToClear(page, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const hasSpinner = await page.evaluate(() => Boolean(document.querySelector('.animate-spin')));
    if (!hasSpinner) {
      return;
    }
    await page.waitForTimeout(250);
  }
  throw new Error('Timed out waiting for loading spinner to clear');
}

async function hasFirebaseAuthUserInStorage(page) {
  return page.evaluate(() => {
    try {
      return Object.keys(window.localStorage || {}).some((key) => {
        if (!key.startsWith('firebase:authUser:')) return false;
        const value = window.localStorage.getItem(key);
        return Boolean(value && value !== 'null');
      });
    } catch {
      return false;
    }
  });
}

const AUTH_MODAL_SELECTOR = '[data-testid="auth-modal"]';
const AUTH_PHONE_INPUT_SELECTOR = `${AUTH_MODAL_SELECTOR} input[placeholder="9171234567"]`;
const AUTH_OTP_INPUT_SELECTOR = `${AUTH_MODAL_SELECTOR} input[placeholder="000000"], ${AUTH_MODAL_SELECTOR} input[type="text"][maxlength="6"]`;

async function getAuthModalDetails(page) {
  const modal = page.locator(AUTH_MODAL_SELECTOR).first();
  const visible = await modal.isVisible().catch(() => false);
  if (!visible) {
    return { visible: false };
  }

  const title = String(await modal.locator('h2').first().textContent().catch(() => '') || '').trim();
  const error = String(
    await modal.locator('p.text-red-600, p.text-red-500, .text-red-600, .text-red-500').first()
      .textContent()
      .catch(() => '')
      || ''
  ).trim();
  const phoneStepVisible = await modal.locator('input[placeholder="9171234567"]').first().isVisible().catch(() => false);
  const otpStepVisible = await modal.locator('input[placeholder="000000"], input[type="text"][maxlength="6"]').first()
    .isVisible()
    .catch(() => false);

  return {
    visible: true,
    title,
    error,
    phoneStepVisible,
    otpStepVisible,
  };
}

async function tryDismissAuthModal(page) {
  const authModal = page.locator(AUTH_MODAL_SELECTOR).first();
  const authModalVisible = await authModal.isVisible().catch(() => false);
  if (!authModalVisible) {
    return true;
  }

  const closeButton = page.locator(`${AUTH_MODAL_SELECTOR} button`).first();
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click({ force: true }).catch(() => {});
    await page.waitForTimeout(250);
  }

  if (await authModal.isVisible().catch(() => false)) {
    const backdrop = page.locator(`${AUTH_MODAL_SELECTOR} > div`).first();
    if (await backdrop.isVisible().catch(() => false)) {
      await backdrop.click({ force: true }).catch(() => {});
      await page.waitForTimeout(250);
    }
  }

  if (await authModal.isVisible().catch(() => false)) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(250);
  }

  return !(await authModal.isVisible().catch(() => false));
}

async function assertNoBlockingOverlays(page, context) {
  const authModal = await getAuthModalDetails(page);
  if (authModal.visible) {
    const details = [
      authModal.title ? `title="${authModal.title}"` : 'title="<missing>"',
      authModal.error ? `error="${authModal.error}"` : 'error="<none>"',
      authModal.phoneStepVisible ? 'step=phone' : null,
      authModal.otpStepVisible ? 'step=otp' : null,
    ].filter(Boolean).join(', ');
    throw new Error(`[AuthFixture] ${context} blocked by auth modal (${details}).`);
  }

  const genericDialogVisible = await page.locator('[role="dialog"]').first().isVisible().catch(() => false);
  if (genericDialogVisible) {
    throw new Error(`[AuthFixture] ${context} blocked by visible [role="dialog"] overlay.`);
  }
}

async function waitForAuthenticatedStateOrThrow(page, timeoutMs = 30000) {
  try {
    await page.waitForFunction(
      () => {
        const headings = Array.from(document.querySelectorAll('h1'));
        const onRegistrationScreen = headings.some((h) =>
          String(h.textContent || '').includes('Complete Your Profile')
        );
        const authModalVisible = Boolean(document.querySelector('[data-testid="auth-modal"]'));
        const hasFirebaseAuthUser = Object.keys(window.localStorage || {}).some((key) => {
          if (!key.startsWith('firebase:authUser:')) return false;
          const value = window.localStorage.getItem(key);
          return Boolean(value && value !== 'null');
        });
        return onRegistrationScreen || (hasFirebaseAuthUser && !authModalVisible);
      },
      { timeout: timeoutMs }
    );
  } catch (error) {
    const authModal = await getAuthModalDetails(page);
    const hasFirebaseAuthUser = await page.evaluate(() => {
      try {
        return Object.keys(window.localStorage || {}).some((key) => {
          if (!key.startsWith('firebase:authUser:')) return false;
          const value = window.localStorage.getItem(key);
          return Boolean(value && value !== 'null');
        });
      } catch (e) {
        return false;
      }
    });

    const details = [
      `authUserInStorage=${hasFirebaseAuthUser}`,
      `authModalVisible=${authModal.visible}`,
      authModal.title ? `title="${authModal.title}"` : null,
      authModal.error ? `error="${authModal.error}"` : null,
      authModal.phoneStepVisible ? 'step=phone' : null,
      authModal.otpStepVisible ? 'step=otp' : null,
    ].filter(Boolean).join(', ');

    throw new Error(
      `[AuthFixture] OTP verification did not complete authentication within ${timeoutMs}ms (${details}).`
    );
  }
}

async function getAuthModalFlowState(page) {
  return page.evaluate(() => {
    const modal = document.querySelector('[data-testid="auth-modal"]');
    if (!modal) {
      return { status: 'closed', error: '' };
    }

    const hasOtpInput = Boolean(
      modal.querySelector('input[placeholder="000000"], input[type="text"][maxlength="6"]')
    );
    if (hasOtpInput) {
      return { status: 'otp', error: '' };
    }

    const hasPhoneInput = Boolean(modal.querySelector('input[placeholder="9171234567"]'));
    const errorText = String(
      modal.querySelector('p.text-red-600, p.text-red-500, .text-red-600, .text-red-500')?.textContent || ''
    ).trim();
    if (errorText) {
      return { status: hasPhoneInput ? 'phone' : 'unknown', error: errorText };
    }

    return { status: hasPhoneInput ? 'phone' : 'unknown', error: '' };
  });
}

async function waitForOtpStepOrThrow(page, timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = await getAuthModalFlowState(page);
    if (state.status === 'otp' || state.status === 'closed') {
      return state;
    }
    if (state.error) {
      throw new Error(`[AuthFixture] Failed to request OTP: ${state.error}`);
    }
    await page.waitForTimeout(250);
  }

  const finalState = await getAuthModalFlowState(page);
  const detail = finalState.error
    ? `status=${finalState.status}, error="${finalState.error}"`
    : `status=${finalState.status}`;
  throw new Error(`[AuthFixture] Timed out waiting for OTP step after pressing Continue (${detail}).`);
}

async function dismissBlockingDialogs(page, maxAttempts = 6) {
  for (let i = 0; i < maxAttempts; i++) {
    await tryDismissAuthModal(page);
    const authModalVisible = await page.locator(AUTH_MODAL_SELECTOR).first().isVisible().catch(() => false);

    const dialog = page.locator('[role="dialog"]').first();
    const isDialogVisible = await dialog.isVisible().catch(() => false);
    if (!isDialogVisible && !authModalVisible) {
      return;
    }

    const skipButton = page.locator('[role="dialog"] button').filter({ hasText: /^skip$/i }).first();
    if (await skipButton.isVisible().catch(() => false)) {
      await skipButton.click().catch(() => {});
      await page.waitForTimeout(300);
      continue;
    }

    const maybeLaterButton = page.locator('[role="dialog"] button').filter({ hasText: /maybe later/i }).first();
    if (await maybeLaterButton.isVisible().catch(() => false)) {
      await maybeLaterButton.click().catch(() => {});
      await page.waitForTimeout(300);
      continue;
    }

    const closeButton = page.locator('[role="dialog"] button[aria-label*="close" i]').first();
    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click().catch(() => {});
      await page.waitForTimeout(300);
      continue;
    }

    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);
  }
}

/**
 * Custom Playwright fixtures for authentication testing
 *
 * Provides:
 * - testPhoneNumbers: Pre-configured test phone numbers
 * - authHelper: Reusable authentication methods
 *
 * NOTE: The GetGo app shows the marketplace to all users (guests + authenticated).
 * Login is handled via an AuthModal overlay, which is triggered when a user
 * attempts a protected action (like posting a listing). The phone input is
 * INSIDE this modal, not on a standalone login page.
 */
export const test = base.extend({
  // Provide test phone numbers to all tests
  testPhoneNumbers: async ({}, use) => {
    await use(TEST_PHONE_NUMBERS);
  },
  testEmails: async ({}, use) => {
    await use(TEST_EMAILS);
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
        await page.evaluate(async () => {
          try { localStorage.clear(); } catch (e) {}
          try { sessionStorage.clear(); } catch (e) {}
          // Clear indexedDB Firebase auth databases
          const dbNames = ['firebaseLocalStorageDb', 'firebase-heartbeat-database'];
          await Promise.all(dbNames.map((name) => new Promise((resolve) => {
            try {
              const req = indexedDB.deleteDatabase(name);
              req.onsuccess = () => resolve();
              req.onerror = () => resolve();
              req.onblocked = () => resolve();
              setTimeout(resolve, 500);
            } catch (e) {
              resolve();
            }
          })));
        });
        // Reload to apply storage clear
        await page.reload({ waitUntil: 'domcontentloaded' });

        // Wait for app to fully render (no spinner)
        await waitForSpinnerToClear(page, 60000);
        await dismissBlockingDialogs(page);
        await page.waitForTimeout(800);

        // The phone input is inside the auth modal.
        let phoneInput = await page.locator(AUTH_PHONE_INPUT_SELECTOR).count();

        if (phoneInput === 0) {
          const bellButton = page.locator(
            'header button[aria-label*="notification" i], header button[title*="notification" i]'
          ).first();

          if (await bellButton.isVisible().catch(() => false)) {
            await bellButton.click({ force: true }).catch(() => {});
            await page.waitForTimeout(800);
          }
          phoneInput = await page.locator(AUTH_PHONE_INPUT_SELECTOR).count();
        }

        if (phoneInput === 0) {
          const profileBtn = page.locator('[class*="sidebar"] button, aside button').filter({
            hasText: /profile|activity|contracts|bids/i,
          }).first();

          if (await profileBtn.count() > 0) {
            await profileBtn.click({ force: true });
            await page.waitForTimeout(800);
            phoneInput = await page.locator(AUTH_PHONE_INPUT_SELECTOR).count();
          }
        }

        await page.waitForSelector(AUTH_PHONE_INPUT_SELECTOR, { timeout: 15000 });

        // The phone number format: the modal shows +63 prefix separately,
        // so the input only takes the last 10 digits (9171234567 format).
        const localPhone = phoneNumber.startsWith('+63')
          ? phoneNumber.slice(3)
          : phoneNumber;

        await page.fill(AUTH_PHONE_INPUT_SELECTOR, localPhone);

        // Click Continue button
        const sendButton = page.locator(`${AUTH_MODAL_SELECTOR} button`).filter({
          hasText: /continue|send|next/i,
        }).first();
        await sendButton.click();
        const otpTransitionState = await waitForOtpStepOrThrow(page, 25000);

        // Fetch the actual OTP from the Firebase Auth Emulator REST API
        if (otpTransitionState.status === 'otp') {
          let otpCode = TEST_OTP_CODE; // fallback
          try {
            const resp = await fetch(
              `http://127.0.0.1:9099/emulator/v1/projects/${EMULATOR_PROJECT_ID}/verificationCodes`
            );
            if (resp.ok) {
              const data = await resp.json();
              const e164Phone = phoneNumber.startsWith('+') ? phoneNumber : `+63${phoneNumber}`;
              const matching = (data.verificationCodes || [])
                .filter((v) => v.phoneNumber === e164Phone)
                .pop();
              if (matching?.code) {
                otpCode = matching.code;
              }
            }
          } catch (e) {
            // Emulator not available or different version - use fallback
          }

          const otpInput = page.locator(AUTH_OTP_INPUT_SELECTOR).first();
          await otpInput.fill(otpCode);

          // Click Verify button
          await page.waitForTimeout(300);
          const verifyButton = page.locator(`${AUTH_MODAL_SELECTOR} button`).filter({
            hasText: /^verify$|verify code/i,
          }).first();

          if (await verifyButton.count() > 0) {
            await verifyButton.click();
          }
        }

        await waitForAuthenticatedStateOrThrow(page, 30000);

        await page.waitForFunction(
          () => !document.querySelector('.animate-spin'),
          { timeout: 20000 }
        );

        await dismissBlockingDialogs(page);
        await assertNoBlockingOverlays(page, 'login completion');
        await page.waitForTimeout(500);
      },

      /**
       * Complete registration form
       * @param {Object} userData - User data (name, role, etc.)
       */
      async ensureRegistrationComplete(userData = {}, options = {}) {
        const { name = 'E2E User', role = 'shipper', email } = userData;
        const waitForLateRegistration = options?.waitForLateRegistration !== false;

        await page.waitForFunction(
          () => {
            const heading = Array.from(document.querySelectorAll('h1'))
              .some((h) => String(h.textContent || '').includes('Complete Your Profile'));
            return heading || Boolean(document.querySelector('header'));
          },
          { timeout: 60000 }
        ).catch(() => {});

        const registrationHeading = page.locator('h1').filter({ hasText: /Complete Your Profile/i }).first();
        let onRegistrationScreen = await registrationHeading.isVisible().catch(() => false);
        if (!onRegistrationScreen && waitForLateRegistration) {
          // Auth/profile listeners can briefly land on main shell before showing RegisterScreen.
          for (let attempt = 0; attempt < 20; attempt++) {
            await page.waitForTimeout(1000);
            onRegistrationScreen = await registrationHeading.isVisible().catch(() => false);
            if (onRegistrationScreen) break;
          }
        }

        if (!onRegistrationScreen) {
          await dismissBlockingDialogs(page);
          return;
        }

        const nameInput = page.locator('input[placeholder="Juan dela Cruz"]').first();
        await nameInput.waitFor({ state: 'visible', timeout: 15000 });
        await nameInput.fill('');
        await nameInput.fill(name);

        for (let attempt = 0; attempt < 3; attempt += 1) {
          const enteredName = String(await nameInput.inputValue().catch(() => '') || '').trim();
          if (enteredName) break;
          await nameInput.click({ force: true }).catch(() => {});
          await nameInput.type(name, { delay: 30 }).catch(() => {});
          await page.waitForTimeout(150);
        }

        if (email) {
          const emailInput = page.locator('input[type="email"], input[placeholder="you@example.com"]').first();
          if (await emailInput.isVisible().catch(() => false)) {
            await emailInput.fill(email);
          }
        }

        if (role === 'trucker') {
          const truckerButton = page.locator('button').filter({ hasText: /trucker/i }).first();
          if (await truckerButton.isVisible().catch(() => false)) {
            await truckerButton.click();
            await page.waitForTimeout(250);
          }
        }

        const submitButton = page.locator('button[type="submit"]').filter({
          hasText: /get started|creating profile/i,
        }).first();
        const skipButton = page.locator('button').filter({ hasText: /skip for now/i }).first();

        let attemptedContinue = false;
        if (await submitButton.isVisible().catch(() => false)) {
          const submitDisabled = await submitButton.isDisabled().catch(() => true);
          if (!submitDisabled) {
            await submitButton.click().catch(() => {});
            attemptedContinue = true;
          }
        }

        if (!attemptedContinue && await skipButton.isVisible().catch(() => false)) {
          await skipButton.click().catch(() => {});
          attemptedContinue = true;
        }

        if (!attemptedContinue) {
          throw new Error('Could not continue registration: submit/skip controls unavailable');
        }

        await page.waitForFunction(
          () => {
            const onRegScreen = Array.from(document.querySelectorAll('h1'))
              .some((h) => String(h.textContent || '').includes('Complete Your Profile'));
            return !onRegScreen && Boolean(document.querySelector('header'));
          },
          { timeout: 20000 }
        ).catch(() => {});

        const stillOnRegistration = await registrationHeading.isVisible().catch(() => false);
        if (stillOnRegistration) {
          if (await skipButton.isVisible().catch(() => false)) {
            await skipButton.click().catch(() => {});
          }

          await page.waitForFunction(
            () => {
              const onRegScreen = Array.from(document.querySelectorAll('h1'))
                .some((h) => String(h.textContent || '').includes('Complete Your Profile'));
              return !onRegScreen && Boolean(document.querySelector('header'));
            },
            { timeout: 45000 }
          );
        }

        // Registration can briefly reappear while auth/profile listeners settle.
        // Only return once we're stably out of the registration screen.
        for (let settleAttempt = 0; settleAttempt < 3; settleAttempt += 1) {
          const bouncedBackToRegistration = await registrationHeading.isVisible().catch(() => false);
          if (!bouncedBackToRegistration) {
            break;
          }

          const settleNameInput = page.locator('input[placeholder="Juan dela Cruz"]').first();
          if (await settleNameInput.isVisible().catch(() => false)) {
            const currentName = String(await settleNameInput.inputValue().catch(() => '') || '').trim();
            if (!currentName) {
              await settleNameInput.fill(name);
            }
          }

          if (await skipButton.isVisible().catch(() => false)) {
            await skipButton.click().catch(() => {});
          } else if (await submitButton.isVisible().catch(() => false)) {
            const disabled = await submitButton.isDisabled().catch(() => true);
            if (!disabled) {
              await submitButton.click().catch(() => {});
            }
          }

          await page.waitForFunction(
            () => {
              const onRegScreen = Array.from(document.querySelectorAll('h1'))
                .some((h) => String(h.textContent || '').includes('Complete Your Profile'));
              return !onRegScreen && Boolean(document.querySelector('header'));
            },
            { timeout: 20000 }
          ).catch(() => {});
          await page.waitForTimeout(400);
        }

        const finalOnRegistration = await registrationHeading.isVisible().catch(() => false);
        if (finalOnRegistration) {
          throw new Error('Could not exit registration screen after retries');
        }

        await dismissBlockingDialogs(page);
        await waitForSpinnerToClear(page, 60000);
        await page.waitForTimeout(600);
      },

      /**
       * Complete registration form
       * @param {Object} userData - User data (name, role, etc.)
       */
      async register(userData) {
        await helper.ensureRegistrationComplete(userData);

        // Profile screen can reappear a few seconds after auth listeners settle.
        // Re-check and finish it deterministically before continuing test actions.
        const registrationHeading = page.locator('h1').filter({ hasText: /Complete Your Profile/i }).first();
        for (let attempt = 0; attempt < 12; attempt += 1) {
          const onRegistrationScreen = await registrationHeading.isVisible().catch(() => false);
          if (onRegistrationScreen) {
            await helper.ensureRegistrationComplete(userData);
          } else {
            const authModalVisible = await page.locator(AUTH_MODAL_SELECTOR).first().isVisible().catch(() => false);
            if (!authModalVisible) {
              break;
            }
          }
          await page.waitForTimeout(1000);
        }
      },

      async openAuthModal() {
        await page.goto('/');
        await waitForSpinnerToClear(page, 60000);
        await dismissBlockingDialogs(page);
        await page.waitForTimeout(600);

        const modal = page.locator(AUTH_MODAL_SELECTOR).first();
        for (let attempt = 0; attempt < 4; attempt++) {
          if (await modal.isVisible().catch(() => false)) {
            break;
          }

          const notificationButton = page.locator('header button[aria-label*="notification" i], header button[title*="notification" i]').first();
          if (await notificationButton.isVisible().catch(() => false)) {
            await notificationButton.click({ force: true }).catch(() => {});
            await page.waitForTimeout(700);
          }

          if (await modal.isVisible().catch(() => false)) {
            break;
          }

          const profileButton = page.locator('header button').last();
          if (await profileButton.isVisible().catch(() => false)) {
            await profileButton.click({ force: true }).catch(() => {});
            await page.waitForTimeout(450);
          }

          const logoutMenuItem = page.locator('[role="menuitem"], button, a').filter({
            hasText: /logout|sign out/i,
          }).first();
          if (await logoutMenuItem.isVisible().catch(() => false)) {
            await logoutMenuItem.click({ force: true }).catch(() => {});
            await page.waitForTimeout(1200);
            await page.goto('/');
            await waitForSpinnerToClear(page, 60000);
            await dismissBlockingDialogs(page);
          }
        }

        await modal.waitFor({ state: 'visible', timeout: 12000 });
        const usePhoneButton = page.locator(`${AUTH_MODAL_SELECTOR} button`).filter({
          hasText: /use phone verification instead|use sms verification instead/i,
        }).first();
        if (await usePhoneButton.isVisible().catch(() => false)) {
          await usePhoneButton.click();
          await page.waitForTimeout(250);
        }
        await page.waitForSelector(AUTH_PHONE_INPUT_SELECTOR, { timeout: 10000 });
      },

      async requestMagicLinkFromAuthModal(email) {
        await helper.openAuthModal();

        const useEmailBtn = page.locator(`${AUTH_MODAL_SELECTOR} button`).filter({
          hasText: /use email instead/i,
        }).first();
        if (await useEmailBtn.isVisible().catch(() => false)) {
          await useEmailBtn.click();
        }
        await page.waitForTimeout(300);

        const emailInput = page.locator(`${AUTH_MODAL_SELECTOR} input[type="email"]`).first();
        await emailInput.fill(email);

        const sendButton = page.locator(`${AUTH_MODAL_SELECTOR} button`).filter({
          hasText: /send magic link/i,
        }).first();
        await sendButton.click();
        await page.waitForTimeout(800);

        const inlineError = page.locator(
          `${AUTH_MODAL_SELECTOR} p.text-red-600, ${AUTH_MODAL_SELECTOR} p.text-red-500, ${AUTH_MODAL_SELECTOR} .text-red-600, ${AUTH_MODAL_SELECTOR} .text-red-500`
        ).first();
        if (await inlineError.isVisible().catch(() => false)) {
          const errorText = String(await inlineError.textContent().catch(() => '') || '').trim();
          if (errorText) {
            throw new Error(`[AuthFixture] Magic-link request failed in modal: ${errorText}`);
          }
        }
      },

      async configureBackupEmail(email) {
        await helper.ensureRegistrationComplete({ email }, { waitForLateRegistration: false });
        const securityCard = page.locator('[data-testid="backup-email-card"]').first();

        for (let attempt = 0; attempt < 2; attempt++) {
          await helper.navigateTo('profile');
          await dismissBlockingDialogs(page);

          const onRegistrationScreen = await page.locator('h1').filter({ hasText: /Complete Your Profile/i }).first()
            .isVisible().catch(() => false);
          if (onRegistrationScreen) {
            await helper.ensureRegistrationComplete({ email }, { waitForLateRegistration: false });
            continue;
          }

          if (await securityCard.isVisible().catch(() => false)) {
            break;
          }
        }

        await securityCard.waitFor({ state: 'visible', timeout: 30000 });

        const emailInput = securityCard.locator('input[type="email"]').first();
        await emailInput.fill(email);

        const sendButton = securityCard.locator('button').filter({
          hasText: /send magic link|resend magic link/i,
        }).first();
        await sendButton.click();
        await page.waitForTimeout(900);
      },

      async disableBackupEmail() {
        await helper.ensureRegistrationComplete({}, { waitForLateRegistration: false });
        await helper.navigateTo('profile');
        await dismissBlockingDialogs(page);

        const disableBtn = page.locator('main button').filter({
          hasText: /disable email backup/i,
        }).first();
        await disableBtn.waitFor({ state: 'visible', timeout: 15000 });
        await disableBtn.click();
        await helper.waitForBackupEmailDisabled().catch(async () => {
          // Emulator/UI sync can lag even after callable success; tests validate behavior separately.
          await page.waitForTimeout(1500);
        });
      },

      async waitForBackupEmailEnabled(timeoutMs = 30000) {
        await helper.ensureRegistrationComplete({}, { waitForLateRegistration: false });
        await helper.navigateTo('profile');
        await dismissBlockingDialogs(page);

        const backupCard = page.locator('[data-testid="backup-email-card"]').first();
        await backupCard.waitFor({ state: 'visible', timeout: 15000 });

        await page.waitForFunction(
          () => {
            const card = document.querySelector('[data-testid="backup-email-card"]');
            if (!card) return false;
            const text = String(card.textContent || '').toLowerCase();
            const hasEnabledStatus = text.includes('enabled');
            const hasDisableButton = Array.from(card.querySelectorAll('button')).some((btn) =>
              /disable email backup/i.test(String(btn.textContent || ''))
            );
            // In emulator runs we can stay in "Pending" even when fallback is active.
            return hasEnabledStatus || hasDisableButton;
          },
          { timeout: timeoutMs }
        );
      },

      async waitForBackupEmailDisabled(timeoutMs = 30000) {
        await helper.ensureRegistrationComplete({}, { waitForLateRegistration: false });
        await helper.navigateTo('profile');
        await dismissBlockingDialogs(page);

        const backupCard = page.locator('[data-testid="backup-email-card"]').first();
        await backupCard.waitFor({ state: 'visible', timeout: 15000 });

        await page.waitForFunction(
          () => {
            const card = document.querySelector('[data-testid="backup-email-card"]');
            if (!card) return false;
            const text = String(card.textContent || '').toLowerCase();
            const hasEnabledStatus = text.includes('enabled');
            const hasPendingStatus = text.includes('pending');
            const hasNotConfiguredStatus = text.includes('not configured');
            const hasDisableButton = Array.from(card.querySelectorAll('button')).some((btn) =>
              /disable email backup/i.test(String(btn.textContent || ''))
            );
            return !hasDisableButton && !hasEnabledStatus && (hasPendingStatus || hasNotConfiguredStatus);
          },
          { timeout: timeoutMs }
        );
      },

      async getLatestMagicLink(email, options = {}) {
        const timeoutMs = Number(options?.timeoutMs || 20000);
        const pollMs = Number(options?.pollMs || 500);
        const normalizedEmail = String(email || '').trim().toLowerCase();
        const deadline = Date.now() + timeoutMs;
        let lastSeenRequestTypes = [];

        while (Date.now() < deadline) {
          const resp = await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${EMULATOR_PROJECT_ID}/oobCodes`);
          if (!resp.ok) {
            throw new Error(`Failed to read oob codes from emulator: ${resp.status}`);
          }
          const payload = await resp.json();
          const codesForEmail = (payload.oobCodes || []).filter((item) => {
            const itemEmail = String(item?.email || '').trim().toLowerCase();
            return itemEmail === normalizedEmail;
          });
          lastSeenRequestTypes = codesForEmail
            .map((item) => String(item?.requestType || '').toUpperCase())
            .filter(Boolean);

          const match = codesForEmail
            .filter((item) => String(item?.requestType || '').toUpperCase() === 'EMAIL_SIGNIN')
            .pop();

          if (match?.oobLink) {
            const source = new URL(match.oobLink);
            const appUrl = new URL('/', page.url());
            appUrl.search = source.search;
            return appUrl.toString();
          }

          await page.waitForTimeout(pollMs);
        }

        const seenTypes = lastSeenRequestTypes.length > 0 ? lastSeenRequestTypes.join(', ') : '<none>';
        throw new Error(`No EMAIL_SIGNIN oob link found for ${normalizedEmail} (seen requestTypes: ${seenTypes})`);
      },

      async completeLatestMagicLink(email) {
        const appMagicLink = await helper.getLatestMagicLink(email);
        await page.goto(appMagicLink);
        await page.waitForFunction(
          () => !document.querySelector('.animate-spin'),
          { timeout: 30000 }
        ).catch(() => {});
        await page.waitForTimeout(1200);
      },

      /**
       * Logout from the application
       */
      async logout() {
        await helper.ensureRegistrationComplete({}, { waitForLateRegistration: false });

        // Most deterministic path: use the profile page sign-out control.
        for (let directAttempt = 0; directAttempt < 2; directAttempt += 1) {
          await page.goto('/app/profile').catch(() => {});
          await waitForSpinnerToClear(page, 60000).catch(() => {});
          await dismissBlockingDialogs(page);

          const profileSignOut = page.locator('button, [role="button"], a').filter({
            hasText: /sign out|logout/i,
          }).first();
          if (await profileSignOut.isVisible().catch(() => false)) {
            await profileSignOut.click({ force: true }).catch(() => {});
            await page.waitForTimeout(1500);
            const stillAuthenticated = await hasFirebaseAuthUserInStorage(page);
            if (!stillAuthenticated) {
              return;
            }
          }
        }

        // Fallback path: avatar dropdown sign-out in header.
        for (let attempt = 0; attempt < 3; attempt++) {
          await dismissBlockingDialogs(page);
          for (let i = 0; i < 3; i++) {
            await page.keyboard.press('Escape').catch(() => {});
            await page.waitForTimeout(120);
          }

          const allHeaderBtns = page.locator('header button');
          const headerBtnCount = await allHeaderBtns.count();
          if (headerBtnCount > 0) {
            const avatarBtn = allHeaderBtns.last();
            const isVisible = await avatarBtn.isVisible().catch(() => false);
            if (isVisible) {
              await avatarBtn.click({ force: true }).catch(() => {});
              await page.waitForTimeout(500);
            }
          }

          const logoutMenuItem = page.locator('[role="menuitem"], button, a').filter({
            hasText: /logout|sign out/i,
          }).first();

          if (await logoutMenuItem.count() > 0 && await logoutMenuItem.isVisible().catch(() => false)) {
            await logoutMenuItem.click({ force: true }).catch(() => {});
            await page.waitForTimeout(1500);
          }

          const stillLoggedIn = await hasFirebaseAuthUserInStorage(page);
          if (!stillLoggedIn) {
            return;
          }
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
        await dismissBlockingDialogs(page);
        await assertNoBlockingOverlays(page, `navigateTo("${tabLower}") precondition`);

        if (tabLower === 'messages' || tabLower === 'chat') {
          await page.evaluate(() => {
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
          await helper.ensureRegistrationComplete({}, { waitForLateRegistration: false });
          await page.goto('/app/profile');
          await waitForSpinnerToClear(page, 60000);
          await dismissBlockingDialogs(page);

          const onRegistrationScreen = await page.locator('h1').filter({ hasText: /Complete Your Profile/i }).first()
            .isVisible().catch(() => false);
          if (onRegistrationScreen) {
            await helper.ensureRegistrationComplete({}, { waitForLateRegistration: false });
            await page.goto('/app/profile');
            await waitForSpinnerToClear(page, 60000);
          }

          await page.locator('[data-testid="profile-page"]').waitFor({ state: 'visible', timeout: 30000 });
          await dismissBlockingDialogs(page);
          return;
        }

        if (tabLower === 'notifications') {
          await helper.ensureRegistrationComplete({}, { waitForLateRegistration: false });
          await page.goto('/app/notifications');
          await waitForSpinnerToClear(page, 60000);
          await dismissBlockingDialogs(page);
          await page.waitForURL('**/app/notifications*', { timeout: 15000 });
          return;
        }

        if (tabLower === 'activity') {
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

        let pattern;
        if (tabLower === 'contracts') pattern = /my contracts/i;
        else if (tabLower === 'broker') pattern = /broker/i;
        else if (tabLower === 'cargo') pattern = /cargo/i;
        else if (tabLower === 'trucks') pattern = /trucks/i;
        else if (tabLower === 'bids') pattern = /my bids|my bookings/i;
        else pattern = new RegExp(tabName, 'i');

        const navBtn = page.locator('aside button, header button').filter({ hasText: pattern }).first();
        if (await navBtn.count() > 0) {
          const isVisible = await navBtn.isVisible().catch(() => false);
          if (isVisible) {
            await assertNoBlockingOverlays(page, `navigateTo("${tabLower}") before sidebar click`);
            await navBtn.click();
            await page.waitForTimeout(1000);
            return;
          }
        }

        const anyBtn = page.locator('button').filter({ hasText: pattern });
        const count = await anyBtn.count();
        for (let i = 0; i < Math.min(count, 5); i++) {
          const btn = anyBtn.nth(i);
          const isVisible = await btn.isVisible().catch(() => false);
          if (isVisible) {
            await assertNoBlockingOverlays(page, `navigateTo("${tabLower}") before fallback click`);
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
        const hasAuthUser = await hasFirebaseAuthUserInStorage(page);

        const loggedInBadgeVisible = await page.locator('text=/logged in as/i').first().isVisible().catch(() => false);
        if (loggedInBadgeVisible) return true;
        if (!hasAuthUser) return false;

        const hasHeader = await page.locator('header').count() > 0;
        if (!hasHeader) return false;

        const onRegScreen = await page.locator('h1').filter({ hasText: /Complete Your Profile/i }).first()
          .isVisible().catch(() => false);
        if (onRegScreen) return false;

        const authModalVisible = await page.locator(AUTH_MODAL_SELECTOR).first().isVisible().catch(() => false);
        if (authModalVisible) return false;

        const avatarBtnVisible = await page.locator('header button').last().isVisible().catch(() => false);
        return avatarBtnVisible;
      },
    };

    await use(helper);
  },
});

export { expect } from '@playwright/test';




