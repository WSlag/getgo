# E2E Testing Quick Start Guide

## 🚀 First Time Setup (One-time)

1. **Verify setup is complete:**
   ```bash
   npm run test:verify
   ```

   You should see "✅ All checks passed!"

2. **If Playwright browsers aren't installed:**
   ```bash
   npx playwright install chromium
   ```

## 🧪 Running Tests

### Visual Test Runner (Recommended for Development)

```bash
npm run test:e2e:ui
```

This opens Playwright's visual interface where you can:
- See all test files
- Run tests with a single click
- Watch tests execute in real-time
- Debug failures visually

### Headless Mode (Fast, CI-style)

```bash
npm run test:e2e
```

Runs the default suite in the background (excludes backend-health).

### Full Suite (Includes Backend-Health)

```bash
npm run test:e2e:all
```

### Backend-Health Only

```bash
npm run test:e2e:backend-health
```

### Watch Tests Execute (Headed Mode)

```bash
npm run test:e2e:headed
```

Opens browser windows so you can watch tests run in real-time.

### Debug a Specific Test

```bash
npm run test:e2e:debug
```

Opens Chrome DevTools for step-by-step debugging.

## 📖 What Gets Tested

The E2E tests cover:

✅ **Authentication Flow**
- Phone number OTP login
- User registration (shipper, trucker, broker)
- Logout functionality
- Invalid OTP rejection

✅ **Marketplace Navigation**
- Guest user access
- Logged-in user navigation
- Tab/view switching

## 🔧 How It Works

When you run tests, Playwright automatically:

1. **Starts Backend API** (Node server on port 3001)
2. **Starts Firebase Emulators** (Auth, Firestore, Functions, Storage)
3. **Starts Frontend** (Vite dev server on port 5173)
4. **Runs tests** against the emulated environment
5. **Cleans up** all servers when done

Backend-health tests still target `http://127.0.0.1:3001` and are run separately by script.
If backend is unavailable, backend-health tests are skipped by a short-term guard.

**Important:** All tests run against emulators, not production! Zero risk to real data.

## 📱 Test Credentials

These phone numbers work in the Auth Emulator (no real SMS sent):

| Role    | Phone Number    | OTP Code |
|---------|----------------|----------|
| Shipper | +639171234567  | 123456   |
| Trucker | +639171234568  | 123456   |
| Broker  | +639171234569  | 123456   |
| Admin   | +639171234570  | 123456   |

## 📊 Viewing Test Reports

After running tests, view the HTML report:

```bash
npm run test:e2e:report
```

The report includes:
- Pass/fail status for each test
- Screenshots of failures
- Step-by-step trace viewer
- Console logs and network activity

## 🐛 Troubleshooting

### "Port already in use" Error

**Solution 1 - Kill processes:**
```bash
# Windows
netstat -ano | findstr :5173
netstat -ano | findstr :3001
netstat -ano | findstr :9099
taskkill /PID <PID> /F
```

**Solution 2 - Stop emulators:**
```bash
firebase emulators:stop
```

### "Timeout waiting for server" Error

This usually means a server failed to start. Check:
1. Frontend dependencies installed: `cd frontend && npm install`
2. Backend dependencies installed: `cd backend && npm install`
3. No other processes using ports 5173, 3001, or emulator ports

### Tests Fail Randomly

Tests might fail if:
- Network is slow (increase timeout in test)
- Emulator data is stale (tests clear data automatically)
- UI changed (update selectors in test)

## 📚 Full Documentation

For comprehensive documentation, see: [tests/README.md](tests/README.md)

## 💡 Writing Your First Test

Create a new test file in `tests/e2e/`:

```javascript
import { test, expect } from '../fixtures/auth.fixture.js';

test.describe('My Feature', () => {
  test('should do something', async ({ page, authHelper, testPhoneNumbers }) => {
    // Login as shipper
    await authHelper.login(testPhoneNumbers.shipper);

    // Register user
    await authHelper.register({
      name: 'Test User',
      role: 'shipper'
    });

    // Your test assertions here
    const isLoggedIn = await authHelper.isLoggedIn();
    expect(isLoggedIn).toBe(true);
  });
});
```

## ✅ Verification Checklist

Before committing changes, verify:

- [ ] All tests pass: `npm run test:e2e`
- [ ] Backend health (when backend is available): `npm run test:e2e:backend-health`
- [ ] Setup is valid: `npm run test:verify`
- [ ] Tests are independent (each test clears emulator data)
- [ ] No production credentials in tests
- [ ] Test names are descriptive

## 🆘 Need Help?

1. Check [tests/README.md](tests/README.md) for detailed documentation
2. Review [Playwright docs](https://playwright.dev)
3. Check Firebase Emulator UI at http://127.0.0.1:4000 (when running)

---

**Happy Testing! 🎉**
