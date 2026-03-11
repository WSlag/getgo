#!/usr/bin/env node

function getArgValue(flag, defaultValue = '') {
  const index = process.argv.indexOf(flag);
  if (index === -1) return defaultValue;
  return String(process.argv[index + 1] || defaultValue);
}

function normalizeBaseUrl(rawUrl) {
  const fallback = 'https://getgoph.web.app';
  const value = String(rawUrl || fallback).trim() || fallback;
  try {
    const parsed = new URL(value);
    return parsed.origin;
  } catch {
    throw new Error(`Invalid --base-url value: ${value}`);
  }
}

async function fetchPage(url) {
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers: {
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  });

  const body = await response.text().catch(() => '');
  return {
    status: response.status,
    body,
  };
}

function hasDiagnosticPayload(body, markers) {
  if (!body) return false;
  const normalizedBody = String(body);
  return markers.some((marker) => normalizedBody.includes(marker));
}

async function run() {
  const baseUrl = normalizeBaseUrl(getArgValue('--base-url', 'https://getgoph.web.app'));

  const checks = [
    {
      path: '/verify-contracts.html',
      markers: [
        'Contract Creation Verification Tool',
        'runVerification()',
        'firebase-app-compat.js',
      ],
    },
    {
      path: '/icons/generate-icons.html',
      markers: [
        'GetGo Icon Generator',
        'downloadAll()',
        'Preview updated.',
      ],
    },
  ];

  const failures = [];

  for (const check of checks) {
    const url = `${baseUrl}${check.path}`;
    const { status, body } = await fetchPage(url);

    if (status >= 400) {
      console.log(`[debug-page-smoke] PASS ${check.path}: status=${status}`);
      continue;
    }

    if (hasDiagnosticPayload(body, check.markers)) {
      failures.push(`${check.path} returned status=${status} and still contains debug payload markers.`);
      continue;
    }

    console.log(
      `[debug-page-smoke] PASS ${check.path}: status=${status}, debug markers not detected (likely SPA fallback or sanitized response).`
    );
  }

  if (failures.length > 0) {
    console.error('[debug-page-smoke] FAIL');
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exitCode = 1;
    return;
  }

  console.log('[debug-page-smoke] PASS: debug pages are not exposed with diagnostic payloads.');
}

run().catch((error) => {
  console.error(`[debug-page-smoke] FAIL: ${error.message}`);
  process.exitCode = 1;
});
