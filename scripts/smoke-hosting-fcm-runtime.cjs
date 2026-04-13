#!/usr/bin/env node

const { chromium } = require('@playwright/test');

const FCM_REGISTRATIONS_PATTERN = /https:\/\/fcmregistrations\.googleapis\.com\/v1\/projects\/karga-ph\/registrations/i;
const BAD_FCM_STATUSES = new Set([400, 401]);

function getArgValue(flag, defaultValue = '') {
  const index = process.argv.indexOf(flag);
  if (index === -1) return defaultValue;
  if (index + 1 >= process.argv.length) return defaultValue;
  return String(process.argv[index + 1] || defaultValue);
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePhone(rawPhone) {
  const digits = String(rawPhone || '').replace(/\D/g, '');
  if (digits.startsWith('63')) return digits.slice(2);
  if (digits.startsWith('0')) return digits.slice(1);
  return digits;
}

function isRecaptchaChallengeError(message) {
  const value = String(message || '').toLowerCase();
  return value.includes('recaptcha') || value.includes('otp step did not appear');
}

async function hasAuthenticatedSession(page) {
  return page.evaluate(() => {
    try {
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (!key || !key.startsWith('firebase:authUser:')) continue;
        const value = window.localStorage.getItem(key);
        if (typeof value === 'string' && value !== 'null' && value.includes('"uid"')) {
          return true;
        }
      }
    } catch {
      // Ignore storage access issues.
    }
    return false;
  }).catch(() => false);
}

async function waitForManualAuth(page, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const [isAuthed, pathname] = await Promise.all([
      hasAuthenticatedSession(page),
      page.evaluate(() => window.location.pathname).catch(() => ''),
    ]);

    if (isAuthed || String(pathname || '').startsWith('/app/')) {
      return { ready: true };
    }

    await delay(1000);
  }

  return {
    ready: false,
    reason: `Timed out waiting for manual auth after ${timeoutMs}ms.`,
  };
}

async function dismissBlockingDialogs(page, attempts = 6) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const dialog = page.locator('[role="dialog"]').first();
    const visible = await dialog.isVisible().catch(() => false);
    if (!visible) return;

    const skipButton = page.locator('[role="dialog"] button').filter({ hasText: /^skip$/i }).first();
    if (await skipButton.isVisible().catch(() => false)) {
      await skipButton.click().catch(() => {});
      await delay(250);
      continue;
    }

    const maybeLaterButton = page.locator('[role="dialog"] button').filter({ hasText: /maybe later/i }).first();
    if (await maybeLaterButton.isVisible().catch(() => false)) {
      await maybeLaterButton.click().catch(() => {});
      await delay(250);
      continue;
    }

    const closeButton = page.locator('[role="dialog"] button[aria-label*="close" i]').first();
    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click().catch(() => {});
      await delay(250);
      continue;
    }

    await page.keyboard.press('Escape').catch(() => {});
    await delay(250);
  }
}

async function waitForSpinnerToClear(page, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const hasSpinner = await page.evaluate(() => Boolean(document.querySelector('.animate-spin'))).catch(() => false);
    if (!hasSpinner) return;
    await delay(200);
  }
}

async function openAuthModal(page) {
  const modal = page.locator('[data-testid="auth-modal"]').first();
  if (await modal.isVisible().catch(() => false)) {
    return;
  }

  const protectedActionButton = page
    .locator('button')
    .filter({ hasText: /request chat|post cargo|post truck|my contracts|my bookings|notifications/i })
    .first();

  if (await protectedActionButton.isVisible().catch(() => false)) {
    await protectedActionButton.click({ force: true }).catch(() => {});
    await delay(700);
  }

  if (await modal.isVisible().catch(() => false)) {
    return;
  }

  const bellButton = page
    .locator('header button[aria-label*="notification" i], header button[title*="notification" i]')
    .first();

  if (await bellButton.isVisible().catch(() => false)) {
    await bellButton.click({ force: true }).catch(() => {});
    await delay(600);
  }

  if (!(await modal.isVisible().catch(() => false))) {
    const headerButtons = page.locator('header button');
    const count = await headerButtons.count();
    if (count > 0) {
      await headerButtons.last().click({ force: true }).catch(() => {});
      await delay(600);
    }
  }

  await modal.waitFor({ state: 'visible', timeout: 15000 });
}

async function waitForOtpStep(page, timeoutMs = 20000) {
  const start = Date.now();
  const otpInput = page
    .locator(
      '[data-testid="auth-modal"] input[placeholder="000000"], [data-testid="auth-modal"] input[maxlength="6"]'
    )
    .first();

  while (Date.now() - start < timeoutMs) {
    if (await otpInput.isVisible().catch(() => false)) {
      return { ready: true };
    }

    const errorText = await page
      .locator('[data-testid="auth-modal"] [role="alert"]')
      .allTextContents()
      .catch(() => []);
    if (errorText.length > 0) {
      return { ready: false, reason: errorText.join(' | ') };
    }

    const sendingVisible = await page
      .locator('[data-testid="auth-modal"] button')
      .filter({ hasText: /sending/i })
      .first()
      .isVisible()
      .catch(() => false);
    if (sendingVisible && Date.now() - start > 10000) {
      return {
        ready: false,
        reason:
          'OTP step did not appear and auth remained in "Sending..." state. This is commonly a reCAPTCHA interactive challenge in headless mode.',
      };
    }

    await delay(250);
  }

  return { ready: false, reason: `Timed out waiting for OTP step after ${timeoutMs}ms.` };
}

async function signInWithTestPhone(page, phone, otp) {
  await openAuthModal(page);

  const usePhoneButton = page
    .locator('[data-testid="auth-modal"] button')
    .filter({ hasText: /use phone verification instead|use sms verification instead/i })
    .first();

  if (await usePhoneButton.isVisible().catch(() => false)) {
    await usePhoneButton.click();
    await delay(250);
  }

  const phoneInput = page.locator('[data-testid="auth-modal"] input[placeholder="9171234567"]').first();
  await phoneInput.waitFor({ state: 'visible', timeout: 15000 });
  await phoneInput.fill(normalizePhone(phone));

  const continueButton = page
    .locator('[data-testid="auth-modal"] button')
    .filter({ hasText: /continue|send|next/i })
    .first();
  await continueButton.click();

  const otpStep = await waitForOtpStep(page, 20000);
  if (!otpStep.ready) {
    throw new Error(`Phone auth failed before OTP verification: ${otpStep.reason}`);
  }

  const otpInput = page
    .locator('[data-testid="auth-modal"] input[placeholder="000000"], [data-testid="auth-modal"] input[maxlength="6"]')
    .first();
  await otpInput.fill(String(otp));

  const verifyButton = page
    .locator('[data-testid="auth-modal"] button')
    .filter({ hasText: /^verify$|verify code/i })
    .first();
  if (await verifyButton.isVisible().catch(() => false)) {
    await verifyButton.click();
  }

  await page.waitForFunction(
    () => {
      const modal = document.querySelector('[data-testid="auth-modal"]');
      const hidden = !modal || getComputedStyle(modal).display === 'none' || modal.getAttribute('data-state') === 'closed';
      return hidden && Boolean(document.querySelector('header'));
    },
    { timeout: 30000 }
  );
}

async function openNotificationsTab(page, baseUrl, timeoutMs) {
  const target = new URL(baseUrl);
  target.pathname = '/app/notifications';
  target.search = '';
  target.hash = '';
  await page.goto(target.toString(), { waitUntil: 'domcontentloaded', timeout: timeoutMs });
  await waitForSpinnerToClear(page, timeoutMs).catch(() => {});
  await dismissBlockingDialogs(page);

  const notificationsHeading = page
    .locator('h1, h2')
    .filter({ hasText: /^notifications$/i })
    .first();
  if (await notificationsHeading.isVisible().catch(() => false)) {
    return;
  }

  const notificationsButton = page
    .locator('button, a, [role="button"]')
    .filter({ hasText: /notifications/i })
    .first();
  if (await notificationsButton.isVisible().catch(() => false)) {
    await notificationsButton.click({ force: true }).catch(() => {});
    await delay(700);
  }
}

async function triggerPushActivationIfVisible(page) {
  const activateButton = page
    .locator('button')
    .filter({ hasText: /^activate$/i })
    .first();

  if (await activateButton.isVisible().catch(() => false)) {
    await activateButton.click({ force: true }).catch(() => {});
    await delay(1200);
    return true;
  }

  return false;
}

async function attemptLogout(page) {
  const logoutButton = page
    .locator('button, a, [role="menuitem"], [role="button"]')
    .filter({ hasText: /logout|sign out/i })
    .first();

  if (await logoutButton.isVisible().catch(() => false)) {
    await logoutButton.click({ force: true }).catch(() => {});
    await delay(1200);
    return true;
  }

  const profileButton = page
    .locator('header button[aria-label*="profile" i], header button[title*="profile" i]')
    .first();
  if (await profileButton.isVisible().catch(() => false)) {
    await profileButton.click({ force: true }).catch(() => {});
    await delay(500);
    if (await logoutButton.isVisible().catch(() => false)) {
      await logoutButton.click({ force: true }).catch(() => {});
      await delay(1200);
      return true;
    }
  }

  return false;
}

function formatEvent(event) {
  return `${event.method || 'UNKNOWN'} ${event.url} -> ${event.status || event.error || 'unknown'}`;
}

async function run() {
  const url = getArgValue('--url', getArgValue('--base-url', 'https://getgoph.com/'));
  const phone = getArgValue('--phone', '9171234567');
  const otp = getArgValue('--otp', '123456');
  const settleMs = Number(getArgValue('--settle-ms', '12000')) || 12000;
  const timeoutMs = Number(getArgValue('--timeout-ms', '60000')) || 60000;
  const manualAuthTimeoutMs = Number(getArgValue('--manual-auth-timeout-ms', '180000')) || 180000;
  const slowMoMs = Number(getArgValue('--slow-mo-ms', '0')) || 0;
  const skipAuth = hasFlag('--skip-auth');
  const strictAuth = hasFlag('--strict-auth');
  const skipLogout = hasFlag('--skip-logout');
  const headed = hasFlag('--headed');
  const manualAuth = hasFlag('--manual-auth');

  if (manualAuth && skipAuth) {
    console.warn('[fcm-runtime] --manual-auth is ignored because --skip-auth is enabled.');
  }

  if (manualAuth && !headed) {
    throw new Error('--manual-auth requires --headed so you can complete login interactively.');
  }

  const fcmEvents = [];
  const badFcmEvents = [];
  const consoleSignals = [];
  const runtimeErrors = [];
  let authSucceeded = false;
  let pushActivateClicked = false;

  const browser = await chromium.launch({
    headless: !headed,
    ...(slowMoMs > 0 ? { slowMo: slowMoMs } : {}),
  });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  const origin = new URL(url).origin;
  await context.grantPermissions(['notifications'], { origin }).catch(() => {});

  page.on('response', (response) => {
    const request = response.request();
    const responseUrl = response.url();
    if (!FCM_REGISTRATIONS_PATTERN.test(responseUrl)) return;
    const event = {
      method: request.method(),
      status: response.status(),
      url: responseUrl,
    };
    fcmEvents.push(event);
    if (BAD_FCM_STATUSES.has(event.status)) {
      badFcmEvents.push(event);
    }
  });

  page.on('requestfailed', (request) => {
    const failedUrl = request.url();
    if (!FCM_REGISTRATIONS_PATTERN.test(failedUrl)) return;
    const failure = request.failure();
    const event = {
      method: request.method(),
      url: failedUrl,
      error: failure?.errorText || 'requestfailed',
    };
    badFcmEvents.push(event);
  });

  page.on('console', (message) => {
    const text = message.text();
    const value = String(text || '').toLowerCase();
    if (
      value.includes('token-unsubscribe-failed') ||
      value.includes('token-subscribe-failed') ||
      value.includes('fcmregistrations.googleapis.com') ||
      value.includes('messaging:')
    ) {
      consoleSignals.push(`[console:${message.type()}] ${text}`);
    }
  });

  page.on('pageerror', (error) => {
    const text = String(error?.message || error);
    runtimeErrors.push(text);
    if (text.toLowerCase().includes('messaging')) {
      consoleSignals.push(`[pageerror] ${text}`);
    }
  });

  try {
    console.log(`[fcm-runtime] Navigating to ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await waitForSpinnerToClear(page, timeoutMs).catch(() => {});
    await dismissBlockingDialogs(page);

    if (!skipAuth && manualAuth) {
      console.log('[fcm-runtime] Manual auth mode enabled.');
      console.log('[fcm-runtime] Complete sign-in in the opened browser window (including OTP/reCAPTCHA).');
      const manualResult = await waitForManualAuth(page, manualAuthTimeoutMs);
      if (!manualResult.ready) {
        console.warn(`[fcm-runtime] Manual auth failed: ${manualResult.reason}`);
        if (strictAuth) {
          throw new Error(`Manual auth failed: ${manualResult.reason}`);
        }
        console.warn('[fcm-runtime] Continuing in guest mode because strict auth is disabled.');
      } else {
        authSucceeded = true;
        await waitForSpinnerToClear(page, timeoutMs).catch(() => {});
        await dismissBlockingDialogs(page);
        console.log('[fcm-runtime] Manual sign-in detected.');
      }
    } else if (!skipAuth) {
      try {
        console.log('[fcm-runtime] Attempting sign-in using test phone credentials');
        await signInWithTestPhone(page, phone, otp);
        authSucceeded = true;
        await waitForSpinnerToClear(page, timeoutMs).catch(() => {});
        await dismissBlockingDialogs(page);
        console.log('[fcm-runtime] Sign-in succeeded');
      } catch (error) {
        const message = String(error?.message || error);
        const recaptchaBlocked = isRecaptchaChallengeError(message);
        console.warn(`[fcm-runtime] Sign-in failed: ${message}`);
        if (strictAuth || !recaptchaBlocked) {
          throw error;
        }
        console.warn('[fcm-runtime] Continuing in guest mode because auth is optional and likely blocked by reCAPTCHA challenge.');
      }
    } else {
      console.log('[fcm-runtime] Skipping sign-in (--skip-auth)');
    }

    if (authSucceeded) {
      await openNotificationsTab(page, url, timeoutMs);
      pushActivateClicked = await triggerPushActivationIfVisible(page);
      if (pushActivateClicked) {
        console.log('[fcm-runtime] Push activate button clicked');
      } else {
        console.log('[fcm-runtime] Push activate button not visible (likely already granted/registered)');
      }
    }

    console.log(`[fcm-runtime] Settling for ${settleMs}ms`);
    await delay(settleMs);

    if (authSucceeded && !skipLogout) {
      const loggedOut = await attemptLogout(page);
      if (loggedOut) {
        console.log('[fcm-runtime] Logout action triggered');
        await delay(2000);
      } else {
        console.warn('[fcm-runtime] Could not locate logout control. Skipping logout assertion.');
      }
    }

    if (badFcmEvents.length > 0) {
      const sample = badFcmEvents.slice(0, 10).map(formatEvent).join('\n');
      throw new Error(`Detected bad FCM registration responses:\n${sample}`);
    }

    if (consoleSignals.length > 0) {
      const sample = consoleSignals.slice(0, 20).join('\n');
      throw new Error(`Detected messaging error signals in console:\n${sample}`);
    }

    if (authSucceeded && fcmEvents.length === 0) {
      console.warn('[fcm-runtime] No FCM registration requests observed during authenticated flow.');
    }

    console.log(`[fcm-runtime] PASS: No FCM 400/401 signals detected. authSucceeded=${authSucceeded} activateClicked=${pushActivateClicked} fcmEvents=${fcmEvents.length}`);
    if (runtimeErrors.length > 0) {
      console.log(`[fcm-runtime] Non-blocking runtime errors observed: ${runtimeErrors.length}`);
    }
  } finally {
    if (badFcmEvents.length > 0 || consoleSignals.length > 0) {
      await page.screenshot({ path: 'tmp-smoke-hosting-fcm-runtime-failure.png', fullPage: true }).catch(() => {});
    }
    await context.close();
    await browser.close();
  }
}

run().catch((error) => {
  console.error(`[fcm-runtime] FAIL: ${error.message}`);
  process.exit(1);
});
