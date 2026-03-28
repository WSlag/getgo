#!/usr/bin/env node

const DEFAULT_BASE_URL = 'https://getgoph.com';

function getArgValue(flag, defaultValue = '') {
  const index = process.argv.indexOf(flag);
  if (index === -1) return defaultValue;
  if (index + 1 >= process.argv.length) return defaultValue;
  return String(process.argv[index + 1] || defaultValue);
}

function normalizeBaseUrl(rawUrl) {
  const value = String(rawUrl || '').trim() || DEFAULT_BASE_URL;
  try {
    const url = new URL(value);
    return `${url.origin}/`;
  } catch {
    throw new Error(`Invalid --base-url value: ${value}`);
  }
}

async function fetchHeaders(baseUrl, path) {
  const target = new URL(path, baseUrl).toString();
  const response = await fetch(target, {
    method: 'GET',
    redirect: 'follow',
    cache: 'no-store',
  });

  return {
    url: target,
    status: response.status,
    cacheControl: String(response.headers.get('cache-control') || '').toLowerCase(),
    contentType: String(response.headers.get('content-type') || '').toLowerCase(),
  };
}

function assertIncludes(actual, expectedTokens, label) {
  const missing = expectedTokens.filter((token) => !actual.includes(token));
  if (missing.length > 0) {
    throw new Error(`${label} missing required token(s): ${missing.join(', ')}`);
  }
}

async function main() {
  const baseUrl = normalizeBaseUrl(getArgValue('--base-url', DEFAULT_BASE_URL));
  const checks = [
    {
      path: '/sw.js',
      requiredCacheTokens: ['no-store', 'max-age=0', 'must-revalidate'],
      requiredContentTokens: ['javascript'],
    },
    {
      path: '/firebase-messaging-sw.js',
      requiredCacheTokens: ['no-store', 'max-age=0', 'must-revalidate'],
      requiredContentTokens: ['javascript'],
    },
    {
      path: '/registerSW.js',
      requiredCacheTokens: ['no-store', 'max-age=0', 'must-revalidate'],
      requiredContentTokens: ['javascript'],
    },
    {
      path: '/manifest.webmanifest',
      requiredCacheTokens: ['no-store', 'max-age=0', 'must-revalidate'],
      requiredContentTokens: ['manifest+json'],
    },
  ];

  const failures = [];

  for (const check of checks) {
    try {
      const result = await fetchHeaders(baseUrl, check.path);
      if (result.status !== 200) {
        throw new Error(`Expected status 200, got ${result.status}`);
      }

      assertIncludes(result.cacheControl, check.requiredCacheTokens, `Cache-Control for ${check.path}`);
      assertIncludes(result.contentType, check.requiredContentTokens, `Content-Type for ${check.path}`);

      console.log(`[cache-headers] PASS ${check.path} cache-control="${result.cacheControl}" content-type="${result.contentType}"`);
    } catch (error) {
      const message = error?.message || String(error);
      failures.push(`${check.path}: ${message}`);
      console.error(`[cache-headers] FAIL ${check.path}: ${message}`);
    }
  }

  if (failures.length > 0) {
    console.error('[cache-headers] Validation failed. Purge CDN cache for SW/manifest paths and retry.');
    process.exit(1);
  }

  console.log('[cache-headers] PASS: all SW/manifest cache headers are correct.');
}

main().catch((error) => {
  console.error(`[cache-headers] FAIL: ${error?.message || error}`);
  process.exit(1);
});
