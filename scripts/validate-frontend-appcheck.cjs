#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const envPathArg = process.argv[2] || 'frontend/.env.production';
const envPath = path.resolve(process.cwd(), envPathArg);

function parseEnv(content) {
  const values = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const normalized = line.startsWith('export ') ? line.slice(7) : line;
    const separatorIndex = normalized.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = normalized.slice(0, separatorIndex).trim();
    let value = normalized.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }
  return values;
}

if (!fs.existsSync(envPath)) {
  console.error(`[appcheck-guard] Missing env file: ${envPath}`);
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const env = parseEnv(envContent);

const projectId = String(env.VITE_FIREBASE_PROJECT_ID || '').trim();
if (!projectId) {
  console.error('[appcheck-guard] VITE_FIREBASE_PROJECT_ID is required.');
  process.exit(1);
}

if (projectId !== 'karga-ph') {
  console.log(`[appcheck-guard] Project "${projectId}" does not require karga-ph App Check policy checks.`);
  process.exit(0);
}

const enabled = String(env.VITE_ENABLE_APPCHECK || '').trim().toLowerCase();
const provider = String(env.VITE_APPCHECK_PROVIDER || 'auto').trim().toLowerCase();
const siteKey = String(env.VITE_APPCHECK_SITE_KEY || env.VITE_RECAPTCHA_ENTERPRISE_KEY || '').trim();

const failures = [];

if (enabled !== 'true') {
  failures.push('VITE_ENABLE_APPCHECK must be "true" for karga-ph production deploys.');
}

if (provider === 'off') {
  failures.push('VITE_APPCHECK_PROVIDER must not be "off" for karga-ph production deploys.');
}

if (!siteKey) {
  failures.push('App Check site key is required (VITE_APPCHECK_SITE_KEY or VITE_RECAPTCHA_ENTERPRISE_KEY).');
}

if (failures.length > 0) {
  console.error('[appcheck-guard] Blocked hosting deploy due to invalid App Check config:');
  for (const failure of failures) {
    console.error(` - ${failure}`);
  }
  process.exit(1);
}

console.log('[appcheck-guard] OK: production App Check config is compatible with enforced Firestore/Storage policy.');
