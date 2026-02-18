# Karga E2E Testing Guide

This directory contains end-to-end (E2E) tests for the Karga trucking marketplace using Playwright and Firebase Emulators.

## 🚀 Quick Start

### Prerequisites

1. **Install dependencies:**
   ```bash
   # Install root-level dependencies (Playwright)
   npm install

   # Install frontend dependencies
   cd frontend
   npm install
   cd ..

   # Install backend dependencies
   cd backend
   npm install
   cd ..

   # Install Firebase CLI globally (if not already installed)
   npm install -g firebase-tools
   ```

2. **Install Playwright browsers:**
   ```bash
   npx playwright install chromium
   ```

### Running Tests

**Run all tests:**
```bash
npm run test:e2e
```

**Visual test runner (recommended for debugging):**
```bash
npm run test:e2e:ui
```

**Run in headed mode (watch tests execute):**
```bash
npm run test:e2e:headed
```

**Debug mode (step through tests):**
```bash
npm run test:e2e:debug
```

**Run specific test file:**
```bash
npx playwright test tests/e2e/auth/login-register-logout.spec.js
```

**View test report:**
```bash
npm run test:e2e:report
```

## 🧪 How It Works

### Firebase Emulators

All tests run against **Firebase Emulators** (not production):
- **Auth Emulator:** Port 9099 (handles phone OTP without real SMS)
- **Firestore Emulator:** Port 8080 (local database)
- **Functions Emulator:** Port 5001 (cloud functions)
- **Storage Emulator:** Port 9199 (file storage)
- **Emulator UI:** Port 4000 (http://127.0.0.1:4000)

Playwright automatically starts all required servers:
- Frontend (Vite): Port 5173
- Backend API: Port 3001
- Firebase Emulators: Various ports

### Test Phone Numbers

These phone numbers work with the Auth Emulator (no real SMS sent):

- **Shipper:** `+639171234567`
- **Trucker:** `+639171234568`
- **Broker:** `+639171234569`
- **Admin:** `+639171234570`

**OTP Code:** All test numbers accept `123456` as the verification code.

### Environment Variables

Tests automatically set `VITE_USE_FIREBASE_EMULATOR=true` which tells the frontend to connect to emulators instead of production Firebase.

**Production safety:** Normal development (`npm run dev`) connects to production unless you explicitly set the environment variable.

## 📝 Writing Tests

### Basic Test Structure

```javascript
import { test, expect } from '../fixtures/auth.fixture.js';
import { generateTestUser } from '../utils/test-data.js';

test.describe('My Feature', () => {
  // Clear emulator data before each test
  test.beforeEach(async ({ authHelper }) => {
    await authHelper.clearEmulatorData();
  });

  test('should do something', async ({ page, authHelper, testPhoneNumbers }) => {
    // Your test code here
  });
});
```

### Available Fixtures

#### `testPhoneNumbers`
Pre-configured test phone numbers for different roles:
```javascript
testPhoneNumbers.shipper  // +639171234567
testPhoneNumbers.trucker  // +639171234568
testPhoneNumbers.broker   // +639171234569
testPhoneNumbers.admin    // +639171234570
```

#### `authHelper`
Reusable authentication methods:

**Login with phone OTP:**
```javascript
await authHelper.login(testPhoneNumbers.shipper);
```

**Register a new user:**
```javascript
const userData = generateTestUser('shipper', 1);
await authHelper.register(userData);
```

**Logout:**
```javascript
await authHelper.logout();
```

**Check if logged in:**
```javascript
const isLoggedIn = await authHelper.isLoggedIn();
```

**Clear emulator data:**
```javascript
await authHelper.clearEmulatorData();
```

### Test Data Generators

**Generate user data:**
```javascript
import { generateTestUser } from '../utils/test-data.js';

const shipper = generateTestUser('shipper', 1);
const trucker = generateTestUser('trucker', 1);
const broker = generateTestUser('broker', 1);
```

**Generate cargo listing:**
```javascript
import { generateCargoListing } from '../utils/test-data.js';

const cargo = generateCargoListing({
  title: 'Custom title',
  weight: '10 tons',
});
```

## 🔧 Troubleshooting

### Port Already in Use

If you see "port already in use" errors:

1. **Check running processes:**
   ```bash
   # Windows
   netstat -ano | findstr :5173
   netstat -ano | findstr :3001
   netstat -ano | findstr :9099

   # Kill process by PID
   taskkill /PID <PID> /F
   ```

2. **Stop all emulators:**
   ```bash
   firebase emulators:stop
   ```

3. **Restart tests:**
   ```bash
   npm run test:e2e
   ```

### Emulator Data Issues

If tests fail due to stale emulator data:

1. **Clear emulator data manually:**
   ```bash
   # Delete emulator-data directory
   rm -rf emulator-data
   ```

2. **Use `clearEmulatorData()` in tests:**
   ```javascript
   test.beforeEach(async ({ authHelper }) => {
     await authHelper.clearEmulatorData();
   });
   ```

### Timeout Errors

If tests timeout:

1. **Increase timeout in test:**
   ```javascript
   test('slow test', async ({ page }) => {
     test.setTimeout(120000); // 2 minutes
     // test code...
   });
   ```

2. **Check server logs:**
   - Playwright pipes server output during test runs
   - Check for errors in frontend/backend/emulator logs

### Frontend Not Connecting to Emulators

Verify emulator connection:

1. **Check browser console:**
   - Open http://127.0.0.1:5173 manually
   - Look for "🧪 Connected to Firebase Emulators" message

2. **Verify environment variable:**
   ```javascript
   // In frontend/src/firebase.js
   console.log('VITE_USE_FIREBASE_EMULATOR:', import.meta.env.VITE_USE_FIREBASE_EMULATOR);
   ```

3. **Check Playwright config:**
   - Ensure `VITE_USE_FIREBASE_EMULATOR: 'true'` is set in webServer env

### Test Flakiness

If tests are flaky (pass/fail randomly):

1. **Add explicit waits:**
   ```javascript
   await page.waitForSelector('button', { state: 'visible' });
   ```

2. **Use retry assertions:**
   ```javascript
   await expect(page.locator('text=Success')).toBeVisible({ timeout: 10000 });
   ```

3. **Increase workers to 1 (serial execution):**
   - Already configured in `playwright.config.js`

## 🎯 Best Practices

1. **Always clear emulator data between tests:**
   ```javascript
   test.beforeEach(async ({ authHelper }) => {
     await authHelper.clearEmulatorData();
   });
   ```

2. **Use test fixtures for reusable logic:**
   - Don't duplicate auth logic across tests
   - Use `authHelper.login()` instead of manual OTP flow

3. **Use descriptive test names:**
   ```javascript
   test('should create cargo listing and receive bid from trucker', ...)
   ```

4. **Test user journeys, not implementation:**
   - Test what users do, not how the code works
   - Example: "should complete checkout" not "should call createOrder API"

5. **Keep tests independent:**
   - Each test should work in isolation
   - Don't rely on test execution order

6. **Use data-testid for stable selectors:**
   ```javascript
   // Good
   await page.click('[data-testid="submit-button"]');

   // Avoid (brittle)
   await page.click('.btn.btn-primary:nth-child(2)');
   ```

## 📊 Test Reports

After running tests, view the HTML report:

```bash
npm run test:e2e:report
```

Reports include:
- Test results (pass/fail)
- Screenshots on failure
- Trace viewer (step-by-step execution)
- Console logs
- Network activity

## 🔄 CI/CD Integration

To run tests in CI (GitHub Actions, etc.):

```yaml
- name: Install dependencies
  run: |
    npm install
    cd frontend && npm install && cd ..
    cd backend && npm install && cd ..
    npm install -g firebase-tools

- name: Install Playwright browsers
  run: npx playwright install chromium

- name: Run E2E tests
  run: npm run test:e2e

- name: Upload test report
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## 📚 Resources

- [Playwright Documentation](https://playwright.dev)
- [Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite)
- [Firebase Auth Emulator](https://firebase.google.com/docs/emulator-suite/connect_auth)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)

## 🆘 Getting Help

If you encounter issues:

1. Check the troubleshooting section above
2. Review test logs and screenshots in `playwright-report/`
3. Run tests in UI mode for visual debugging: `npm run test:e2e:ui`
4. Check the [Playwright Discord](https://discord.com/invite/playwright-807756831384403968)
