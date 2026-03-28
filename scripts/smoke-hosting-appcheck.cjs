#!/usr/bin/env node

const { chromium } = require('@playwright/test');

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
  throw new Error(`Timed out waiting for loading spinner to clear after ${timeoutMs}ms.`);
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

async function assertProfileHydratedAfterAuth(page, baseUrl, timeoutMs) {
  const profileUrl = new URL(baseUrl);
  profileUrl.hash = 'profile';

  await page.goto(profileUrl.toString(), { waitUntil: 'domcontentloaded', timeout: timeoutMs });
  await waitForSpinnerToClear(page, timeoutMs).catch(() => {});
  await dismissBlockingDialogs(page);

  const profilePage = page.locator('[data-testid="profile-page"]').first();
  await profilePage.waitFor({ state: 'visible', timeout: timeoutMs });

  const fallbackNameVisible = await profilePage
    .locator('h1')
    .filter({ hasText: /^User$/ })
    .count();
  const fallbackPhoneVisible = await profilePage
    .locator('p')
    .filter({ hasText: /^No phone number$/ })
    .count();

  if (fallbackNameVisible > 0 || fallbackPhoneVisible > 0) {
    throw new Error('Authenticated profile rendered fallback placeholders (User/No phone number).');
  }
}

function shouldTrackPermissionSignal(text) {
  const value = String(text || '').toLowerCase();
  return (
    value.includes('missing or insufficient permissions') ||
    value.includes('permission-denied') ||
    value.includes('error listening to user profile') ||
    value.includes('error fetching my bids') ||
    value.includes('error fetching cargo listings') ||
    value.includes('error fetching truck listings') ||
    value.includes('error fetching notifications') ||
    value.includes('error fetching shipments') ||
    value.includes('error subscribing contracts') ||
    value.includes('error subscribing owner conversations') ||
    value.includes('error subscribing bidder conversations') ||
    value.includes('error listening to broker onboarding tracking')
  );
}

async function run() {
  const url = getArgValue('--url', getArgValue('--base-url', 'https://getgoph.com/'));
  const phone = getArgValue('--phone', '9171234567');
  const otp = getArgValue('--otp', '123456');
  const settleMs = Number(getArgValue('--settle-ms', '12000')) || 12000;
  const timeoutMs = Number(getArgValue('--timeout-ms', '60000')) || 60000;
  const skipAuth = hasFlag('--skip-auth');

  const permissionSignals = [];
  const runtimeErrors = [];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  page.on('console', (message) => {
    const text = message.text();
    if (shouldTrackPermissionSignal(text)) {
      permissionSignals.push(`[console:${message.type()}] ${text}`);
    }
  });

  page.on('pageerror', (error) => {
    const text = String(error && error.message ? error.message : error);
    runtimeErrors.push(text);
    if (shouldTrackPermissionSignal(text)) {
      permissionSignals.push(`[pageerror] ${text}`);
    }
  });

  try {
    console.log(`[smoke] Navigating to ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await waitForSpinnerToClear(page, timeoutMs);
    await dismissBlockingDialogs(page);

    if (!skipAuth) {
      console.log('[smoke] Signing in with configured test phone');
      await signInWithTestPhone(page, phone, otp);
      await waitForSpinnerToClear(page, timeoutMs).catch(() => {});
      await dismissBlockingDialogs(page);
      console.log('[smoke] Validating authenticated profile hydration');
      await assertProfileHydratedAfterAuth(page, url, timeoutMs);
    } else {
      console.log('[smoke] Skipping auth flow (--skip-auth) and validating guest-mode listeners');
    }

    console.log(`[smoke] Waiting ${settleMs}ms for listener initialization`);
    await delay(settleMs);

    if (permissionSignals.length > 0) {
      const sample = permissionSignals.slice(0, 20).join('\n');
      throw new Error(
        `Detected Firestore/App Check permission signals${skipAuth ? ' in guest mode' : ' after sign-in'}:\n${sample}`
      );
    }

    console.log(
      `[smoke] PASS: No Firestore/App Check permission-denied signals detected ${skipAuth ? 'in guest mode' : 'after auth'}.`
    );
    if (runtimeErrors.length > 0) {
      console.log(`[smoke] Non-blocking runtime errors observed: ${runtimeErrors.length}`);
    }
  } finally {
    if (permissionSignals.length > 0 || runtimeErrors.length > 0) {
      await page.screenshot({ path: 'tmp-smoke-hosting-appcheck-failure.png', fullPage: true }).catch(() => {});
    }
    await context.close();
    await browser.close();
  }
}

run().catch((error) => {
  console.error(`[smoke] FAIL: ${error.message}`);
  process.exit(1);
});
