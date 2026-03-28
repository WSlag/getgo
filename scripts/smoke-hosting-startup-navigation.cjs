#!/usr/bin/env node

const { chromium } = require('@playwright/test');

const DEFAULT_URL = 'https://getgoph.com/';

function getArgValue(flag, defaultValue = '') {
  const index = process.argv.indexOf(flag);
  if (index === -1) return defaultValue;
  if (index + 1 >= process.argv.length) return defaultValue;
  return String(process.argv[index + 1] || defaultValue);
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function runCase(browser, { url, timeoutMs, settleMs, useStaleBuildId }) {
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  if (useStaleBuildId) {
    await context.addInitScript(() => {
      try {
        localStorage.setItem('getgo_build_id', '2000-01-01T00:00:00.000Z');
      } catch {
        // Ignore storage issues.
      }
      try {
        sessionStorage.removeItem('getgo_build_refresh_guard');
      } catch {
        // Ignore storage issues.
      }
    });
  }

  const page = await context.newPage();
  const navigations = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      navigations.push(frame.url());
    }
  });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
  await page.waitForTimeout(settleMs);

  const uniqueNavigations = [...new Set(navigations)];
  await context.close();
  return uniqueNavigations;
}

async function main() {
  const url = getArgValue('--url', DEFAULT_URL);
  const timeoutMs = toNumber(getArgValue('--timeout-ms', '90000'), 90000);
  const settleMs = toNumber(getArgValue('--settle-ms', '7000'), 7000);
  const maxNormal = toNumber(getArgValue('--max-normal-nav', '1'), 1);
  const maxStale = toNumber(getArgValue('--max-stale-nav', '1'), 1);

  const browser = await chromium.launch({ headless: true });

  try {
    const normalNavigations = await runCase(browser, {
      url,
      timeoutMs,
      settleMs,
      useStaleBuildId: false,
    });

    console.log(`[startup-nav] normal nav count=${normalNavigations.length}`);
    normalNavigations.forEach((entry) => console.log(`[startup-nav] normal -> ${entry}`));

    const staleNavigations = await runCase(browser, {
      url,
      timeoutMs,
      settleMs,
      useStaleBuildId: true,
    });

    console.log(`[startup-nav] stale-build nav count=${staleNavigations.length}`);
    staleNavigations.forEach((entry) => console.log(`[startup-nav] stale  -> ${entry}`));

    if (normalNavigations.length > maxNormal) {
      throw new Error(
        `Normal startup exceeded navigation threshold (${normalNavigations.length} > ${maxNormal}).`
      );
    }

    if (staleNavigations.length > maxStale) {
      throw new Error(
        `Stale-build startup exceeded navigation threshold (${staleNavigations.length} > ${maxStale}).`
      );
    }

    console.log('[startup-nav] PASS: startup navigation is stable.');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`[startup-nav] FAIL: ${error?.message || error}`);
  process.exit(1);
});
