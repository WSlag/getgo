/**
 * Verification Script for E2E Testing Setup
 *
 * Checks that all required components are properly configured
 */

import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('🔍 Verifying E2E Testing Setup...\n');

let allChecksPassed = true;

// Check 1: Firebase config has emulators section
console.log('✓ Checking firebase.json...');
try {
  const firebaseConfig = JSON.parse(
    readFileSync(join(rootDir, 'firebase.json'), 'utf-8')
  );

  if (!firebaseConfig.emulators) {
    console.error('  ❌ Missing "emulators" section in firebase.json');
    allChecksPassed = false;
  } else {
    const requiredEmulators = ['auth', 'firestore', 'functions', 'storage'];
    const configuredEmulators = Object.keys(firebaseConfig.emulators);

    for (const emulator of requiredEmulators) {
      if (!configuredEmulators.includes(emulator)) {
        console.error(`  ❌ Missing "${emulator}" emulator in firebase.json`);
        allChecksPassed = false;
      }
    }

    if (allChecksPassed) {
      console.log('  ✅ Firebase emulators configured correctly');
    }
  }
} catch (error) {
  console.error('  ❌ Error reading firebase.json:', error.message);
  allChecksPassed = false;
}

// Check 2: Frontend firebase.js has emulator connection logic
console.log('\n✓ Checking frontend/src/firebase.js...');
try {
  const firebaseJs = readFileSync(
    join(rootDir, 'frontend/src/firebase.js'),
    'utf-8'
  );

  const requiredImports = [
    'connectAuthEmulator',
    'connectFirestoreEmulator',
    'connectFunctionsEmulator',
    'connectStorageEmulator',
  ];

  const hasAllImports = requiredImports.every((imp) =>
    firebaseJs.includes(imp)
  );

  if (!hasAllImports) {
    console.error('  ❌ Missing emulator connection imports');
    allChecksPassed = false;
  }

  if (!firebaseJs.includes('VITE_USE_FIREBASE_EMULATOR')) {
    console.error('  ❌ Missing VITE_USE_FIREBASE_EMULATOR check');
    allChecksPassed = false;
  }

  if (hasAllImports && firebaseJs.includes('VITE_USE_FIREBASE_EMULATOR')) {
    console.log('  ✅ Firebase emulator connection logic present');
  }
} catch (error) {
  console.error('  ❌ Error reading frontend/src/firebase.js:', error.message);
  allChecksPassed = false;
}

// Check 3: Playwright config exists
console.log('\n✓ Checking playwright.config.js...');
if (!existsSync(join(rootDir, 'playwright.config.js'))) {
  console.error('  ❌ playwright.config.js not found');
  allChecksPassed = false;
} else {
  const config = readFileSync(join(rootDir, 'playwright.config.js'), 'utf-8');

  if (!config.includes('webServer')) {
    console.error('  ❌ Missing webServer configuration');
    allChecksPassed = false;
  }

  if (!config.includes('VITE_USE_FIREBASE_EMULATOR')) {
    console.error('  ❌ Missing VITE_USE_FIREBASE_EMULATOR env var');
    allChecksPassed = false;
  }

  if (config.includes('webServer') && config.includes('VITE_USE_FIREBASE_EMULATOR')) {
    console.log('  ✅ Playwright configuration valid');
  }
}

// Check 4: Test files exist
console.log('\n✓ Checking test files...');
const testFiles = [
  'tests/e2e/auth/login-register-logout.spec.js',
  'tests/e2e/fixtures/auth.fixture.js',
  'tests/e2e/utils/test-data.js',
];

let allTestFilesExist = true;
for (const file of testFiles) {
  if (!existsSync(join(rootDir, file))) {
    console.error(`  ❌ Missing ${file}`);
    allChecksPassed = false;
    allTestFilesExist = false;
  }
}

if (allTestFilesExist) {
  console.log('  ✅ All test files present');
}

// Check 5: Package.json has test scripts
console.log('\n✓ Checking package.json scripts...');
try {
  const packageJson = JSON.parse(
    readFileSync(join(rootDir, 'package.json'), 'utf-8')
  );

  const requiredScripts = ['test:e2e', 'test:e2e:ui', 'test:e2e:debug'];
  let allScriptsPresent = true;

  for (const script of requiredScripts) {
    if (!packageJson.scripts || !packageJson.scripts[script]) {
      console.error(`  ❌ Missing script: ${script}`);
      allChecksPassed = false;
      allScriptsPresent = false;
    }
  }

  if (allScriptsPresent) {
    console.log('  ✅ All test scripts configured');
  }
} catch (error) {
  console.error('  ❌ Error reading package.json:', error.message);
  allChecksPassed = false;
}

// Check 6: Dependencies installed
console.log('\n✓ Checking dependencies...');
if (!existsSync(join(rootDir, 'node_modules/@playwright/test'))) {
  console.error('  ❌ @playwright/test not installed. Run: npm install');
  allChecksPassed = false;
} else {
  console.log('  ✅ Playwright dependencies installed');
}

// Final summary
console.log('\n' + '='.repeat(50));
if (allChecksPassed) {
  console.log('✅ All checks passed! E2E testing setup is complete.\n');
  console.log('Next steps:');
  console.log('  1. Run: npm run test:e2e:ui');
  console.log('  2. Or: npm run test:e2e');
  console.log('  3. Read: tests/README.md for full documentation\n');
} else {
  console.log('❌ Some checks failed. Please review the errors above.\n');
  process.exit(1);
}
