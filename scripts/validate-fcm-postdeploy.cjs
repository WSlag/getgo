#!/usr/bin/env node

/**
 * Post-deploy validation for FCM web registration fixes.
 *
 * Automates checklist steps:
 * 1) Firebase source-of-truth sdkconfig check
 * 2) Local config consistency check (.env, .env.production, SW)
 * 3) Build artifact check (optional build + dist asset inspection)
 * 4) Production artifact check (getgoph.com bundle inspection)
 * 6) Optional smoke push test (when --uid is provided)
 *
 * Usage:
 *   node scripts/validate-fcm-postdeploy.cjs
 *   node scripts/validate-fcm-postdeploy.cjs --skip-build
 *   node scripts/validate-fcm-postdeploy.cjs --uid <firebase-uid>
 *   node scripts/validate-fcm-postdeploy.cjs --base-url https://getgoph.com
 *   node scripts/validate-fcm-postdeploy.cjs --runtime-check
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DEFAULTS = {
  project: 'karga-ph',
  appId: '1:580800488549:web:3b5051b8c1ec0c8ba9128c',
  baseUrl: 'https://getgoph.com/',
  envPath: 'frontend/.env',
  envProdPath: 'frontend/.env.production',
  swPath: 'frontend/public/firebase-messaging-sw.js',
  oldAsset: 'index-izTjEJAG.js',
  oldKey: 'AIzaSyAnC80DcEGsq30csD_Gy5pD8okkRUWZ9nk',
};

function parseArgs(argv) {
  const args = {
    project: DEFAULTS.project,
    appId: DEFAULTS.appId,
    baseUrl: DEFAULTS.baseUrl,
    envPath: DEFAULTS.envPath,
    envProdPath: DEFAULTS.envProdPath,
    swPath: DEFAULTS.swPath,
    oldAsset: DEFAULTS.oldAsset,
    oldKey: DEFAULTS.oldKey,
    uid: '',
    skipBuild: false,
    runtimeCheck: false,
    runtimeSkipAuth: false,
    runtimeStrictAuth: false,
    skipSdkconfig: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--skip-build') {
      args.skipBuild = true;
      continue;
    }
    if (token === '--runtime-check') {
      args.runtimeCheck = true;
      continue;
    }
    if (token === '--runtime-skip-auth') {
      args.runtimeSkipAuth = true;
      continue;
    }
    if (token === '--runtime-strict-auth') {
      args.runtimeStrictAuth = true;
      continue;
    }
    if (token === '--skip-sdkconfig') {
      args.skipSdkconfig = true;
      continue;
    }
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) continue;
    if (Object.prototype.hasOwnProperty.call(args, key)) {
      args[key] = value;
      i += 1;
    }
  }

  return args;
}

function fail(message) {
  console.error(`FAIL: ${message}`);
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

function info(message) {
  console.log(`INFO: ${message}`);
}

function warning(message) {
  console.warn(`WARN: ${message}`);
}

function runCommand(command) {
  return execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

function extractFirstJsonObject(text) {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (start === -1) {
      if (ch === '{') {
        start = i;
        depth = 1;
      }
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return '';
}

function parseEnvValue(filePath, key) {
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(new RegExp(`^${key}=(.*)$`, 'm'));
  if (!match) return '';
  return String(match[1] || '').trim();
}

function parseSwApiKey(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/apiKey:\s*'([^']+)'/);
  return match ? match[1] : '';
}

function parseIndexScriptPath(html) {
  const match = html.match(/<script[^>]+src="([^"]*\/assets\/index-[^"]+\.js)"/i);
  return match ? match[1] : '';
}

function parseBundledApiKey(js) {
  const match =
    js.match(/VITE_FIREBASE_API_KEY:"([^"]+)"/)
    || js.match(/VITE_FIREBASE_API_KEY:'([^']+)'/)
    || js.match(/apiKey:"(AIza[0-9A-Za-z_-]+)"/)
    || js.match(/apiKey:'(AIza[0-9A-Za-z_-]+)'/);
  return match ? match[1] : '';
}

async function fetchText(url) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.text();
}

function ensureFileExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${filePath}`);
  }
}

function validateDistAgainstOldKey(distDir, oldKey) {
  if (!oldKey) return false;
  if (!fs.existsSync(distDir)) return false;

  const stack = [distDir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!/\.(js|html|json|txt|map|webmanifest)$/i.test(entry.name)) continue;
      const content = fs.readFileSync(absolutePath, 'utf8');
      if (content.includes(oldKey)) {
        return true;
      }
    }
  }

  return false;
}

async function main() {
  const args = parseArgs(process.argv);
  const errors = [];

  const repoRoot = process.cwd();
  const envPath = path.resolve(repoRoot, args.envPath);
  const envProdPath = path.resolve(repoRoot, args.envProdPath);
  const swPath = path.resolve(repoRoot, args.swPath);
  const distIndexPath = path.resolve(repoRoot, 'frontend/dist/index.html');

  info('Step 1: Firebase source-of-truth check');
  let expectedKey = '';
  if (args.skipSdkconfig) {
    expectedKey = parseEnvValue(envProdPath, 'VITE_FIREBASE_API_KEY');
    if (!expectedKey) {
      errors.push('Step 1 skipped but frontend/.env.production has no VITE_FIREBASE_API_KEY.');
      fail('Cannot resolve expected API key when --skip-sdkconfig is used.');
    } else {
      warning('Skipping firebase apps:sdkconfig lookup (--skip-sdkconfig).');
      pass(`Expected API key resolved from frontend/.env.production: ${expectedKey}`);
    }
  } else {
    try {
      const sdkRaw = runCommand(
        `firebase apps:sdkconfig WEB ${args.appId} --project ${args.project} --json`
      );
      const sdkJsonString = extractFirstJsonObject(sdkRaw);
      const sdk = JSON.parse(sdkJsonString);
      expectedKey = sdk?.result?.sdkConfig?.apiKey || '';
      if (!expectedKey) {
        errors.push('Could not read sdkConfig.apiKey from firebase apps:sdkconfig output.');
        fail('Could not read expected apiKey from Firebase source-of-truth.');
      } else {
        pass(`Firebase sdkConfig apiKey resolved: ${expectedKey}`);
      }
    } catch (error) {
      errors.push(`firebase apps:sdkconfig failed: ${error.message || error}`);
      fail(`firebase apps:sdkconfig failed: ${error.message || error}`);
    }
  }

  info('Step 2: Local config consistency check');
  try {
    ensureFileExists(envPath);
    ensureFileExists(envProdPath);
    ensureFileExists(swPath);

    const envKey = parseEnvValue(envPath, 'VITE_FIREBASE_API_KEY');
    const envProdKey = parseEnvValue(envProdPath, 'VITE_FIREBASE_API_KEY');
    const swKey = parseSwApiKey(swPath);

    if (!envKey || !envProdKey || !swKey) {
      errors.push('Failed to parse one or more local API keys from env/SW files.');
      fail('Could not parse local Firebase API keys from required files.');
    } else {
      pass(`frontend/.env key: ${envKey}`);
      pass(`frontend/.env.production key: ${envProdKey}`);
      pass(`firebase-messaging-sw.js key: ${swKey}`);

      if (expectedKey) {
        if (envKey !== expectedKey) {
          errors.push('frontend/.env key does not match Firebase sdkconfig key.');
          fail('frontend/.env key mismatch.');
        } else {
          pass('frontend/.env key matches sdkconfig key.');
        }

        if (envProdKey !== expectedKey) {
          errors.push('frontend/.env.production key does not match Firebase sdkconfig key.');
          fail('frontend/.env.production key mismatch.');
        } else {
          pass('frontend/.env.production key matches sdkconfig key.');
        }

        if (swKey !== expectedKey) {
          errors.push('firebase-messaging-sw.js key does not match Firebase sdkconfig key.');
          fail('firebase-messaging-sw.js key mismatch.');
        } else {
          pass('firebase-messaging-sw.js key matches sdkconfig key.');
        }
      }
    }
  } catch (error) {
    errors.push(`Local config consistency check failed: ${error.message || error}`);
    fail(`Local config consistency check failed: ${error.message || error}`);
  }

  info('Step 3: Build artifact check');
  try {
    if (args.skipBuild) {
      warning('Skipping build because --skip-build was provided.');
    } else {
      info('Running frontend build...');
      execSync('npm --prefix frontend run build', { stdio: 'inherit' });
      pass('frontend build completed.');
    }

    ensureFileExists(distIndexPath);
    const distIndexHtml = fs.readFileSync(distIndexPath, 'utf8');
    const distScriptPath = parseIndexScriptPath(distIndexHtml);
    if (!distScriptPath) {
      errors.push('Could not resolve dist index-* asset path from frontend/dist/index.html.');
      fail('Could not resolve dist index bundle path.');
    } else {
      const distScriptAbs = path.resolve(repoRoot, `frontend/dist${distScriptPath}`);
      ensureFileExists(distScriptAbs);
      const distJs = fs.readFileSync(distScriptAbs, 'utf8');
      const distKey = parseBundledApiKey(distJs);
      if (!distKey) {
        errors.push('Could not extract Firebase API key from dist index bundle.');
        fail('Could not extract Firebase API key from dist bundle.');
      } else {
        pass(`dist bundle key: ${distKey}`);
        if (expectedKey && distKey !== expectedKey) {
          errors.push('dist bundle key does not match Firebase sdkconfig key.');
          fail('dist bundle key mismatch.');
        } else if (expectedKey) {
          pass('dist bundle key matches sdkconfig key.');
        }
      }

      const oldKeyStillPresent = validateDistAgainstOldKey(
        path.resolve(repoRoot, 'frontend/dist'),
        args.oldKey
      );
      if (oldKeyStillPresent) {
        errors.push('Old key was found in frontend/dist artifacts.');
        fail('Old Firebase API key still present in dist artifacts.');
      } else {
        pass('Old Firebase API key is not present in dist artifacts.');
      }
    }
  } catch (error) {
    errors.push(`Build artifact check failed: ${error.message || error}`);
    fail(`Build artifact check failed: ${error.message || error}`);
  }

  info('Step 4: Production artifact check');
  try {
    const baseUrl = String(args.baseUrl || '').trim();
    if (!baseUrl) {
      throw new Error('Missing --base-url value.');
    }

    const html = await fetchText(baseUrl);
    const prodScriptPath = parseIndexScriptPath(html);
    if (!prodScriptPath) {
      errors.push('Could not parse production index bundle path from homepage HTML.');
      fail('Could not parse production index bundle path.');
    } else {
      const prodAssetUrl = new URL(prodScriptPath, baseUrl).toString();
      const prodJs = await fetchText(prodAssetUrl);
      const prodKey = parseBundledApiKey(prodJs);

      pass(`Production bundle path: ${prodScriptPath}`);

      if (!prodKey) {
        errors.push('Could not extract Firebase API key from production index bundle.');
        fail('Could not extract production bundle Firebase API key.');
      } else {
        pass(`production bundle key: ${prodKey}`);
        if (expectedKey && prodKey !== expectedKey) {
          errors.push('production bundle key does not match Firebase sdkconfig key.');
          fail('Production bundle key mismatch.');
        } else if (expectedKey) {
          pass('Production bundle key matches sdkconfig key.');
        }
      }

      if (args.oldAsset && prodScriptPath.includes(args.oldAsset)) {
        warning(
          `Production bundle still references prior asset hash (${args.oldAsset}). ` +
          'If a deploy was expected, verify hosting publish step.'
        );
      } else if (args.oldAsset) {
        pass(`Production asset changed from old hash marker (${args.oldAsset}).`);
      }
    }
  } catch (error) {
    errors.push(`Production artifact check failed: ${error.message || error}`);
    fail(`Production artifact check failed: ${error.message || error}`);
  }

  info('Step 5: Browser runtime check');
  if (args.runtimeCheck) {
    try {
      const runtimeArgs = [`--url ${args.baseUrl}`];
      if (args.runtimeSkipAuth) runtimeArgs.push('--skip-auth');
      if (args.runtimeStrictAuth) runtimeArgs.push('--strict-auth');
      const runtimeCommand = `node scripts/smoke-hosting-fcm-runtime.cjs ${runtimeArgs.join(' ')}`;
      execSync(runtimeCommand, { stdio: 'inherit' });
      pass('Runtime FCM smoke check passed.');
    } catch (error) {
      errors.push(`Runtime FCM smoke check failed: ${error.message || error}`);
      fail(`Runtime FCM smoke check failed: ${error.message || error}`);
    }
  } else {
    warning(
      'Manual validation required: sign in, activate notifications, verify no fcmregistrations 401/400 loops, ' +
      'and verify users/{uid}/fcmTokens lifecycle in Firestore. ' +
      'You can run: npm run test:smoke:hosting:fcm-runtime'
    );
  }

  info('Step 6: Smoke push delivery check');
  if (args.uid) {
    try {
      execSync(
        `node functions/scripts/smoke-push-notifications.cjs --uid ${args.uid}`,
        { stdio: 'inherit' }
      );
      pass('Smoke push script passed.');
    } catch (error) {
      errors.push(`Smoke push script failed: ${error.message || error}`);
      fail(`Smoke push script failed: ${error.message || error}`);
    }
  } else {
    warning('Skipped smoke push script because no --uid was provided.');
  }

  console.log('');
  if (errors.length > 0) {
    console.error(`Validation completed with ${errors.length} failure(s).`);
    process.exit(1);
  }

  console.log('Validation completed with no automated failures.');
}

main().catch((error) => {
  console.error(`Unhandled validation error: ${error.message || error}`);
  process.exit(1);
});
