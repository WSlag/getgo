import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration for Karga Marketplace
 *
 * Tests run against Firebase Emulators to ensure zero production impact.
 * Playwright automatically manages frontend, backend, and emulator servers.
 */
export default defineConfig({
  testDir: './tests/e2e',

  // Test execution settings
  fullyParallel: false, // Serial execution prevents emulator race conditions
  workers: 1, // Single worker for stable emulator state
  timeout: 60 * 1000, // 60 seconds per test
  expect: {
    timeout: 10 * 1000, // 10 seconds for assertions
  },

  // Retry failed tests once (helps with flaky network/emulator issues)
  retries: process.env.CI ? 2 : 1,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],

  // Shared settings for all tests
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry', // Capture trace on retry for debugging
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Browser context options
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,

    // Timeout for actions (click, fill, etc.)
    actionTimeout: 15 * 1000,
  },

  // Test projects (browsers to test)
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /**
   * Automatically start required servers before running tests
   * Playwright will wait for all servers to be ready before executing tests
   */
  webServer: [
    // Frontend dev server (Vite)
    {
      command: 'cd frontend && npm run dev',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000, // 2 minutes for npm install if needed
      env: {
        VITE_USE_FIREBASE_EMULATOR: 'true',
        VITE_FIREBASE_EMULATOR_HOST: '127.0.0.1',
      },
      stdout: 'pipe',
      stderr: 'pipe',
    },

    // Backend API server
    {
      command: 'cd backend && npm run dev',
      url: 'http://127.0.0.1:3001/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      stdout: 'pipe',
      stderr: 'pipe',
    },

    // Firebase Emulators (auth + firestore only — skips functions/storage for faster startup)
    {
      command: 'firebase emulators:start --only auth,firestore',
      url: 'http://127.0.0.1:9099', // Auth emulator (simpler than waiting for UI)
      reuseExistingServer: !process.env.CI,
      timeout: 180 * 1000, // 3 minutes — allows JAR download on first run
      env: {
        JAVA_HOME: 'C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.5.11-hotspot',
        PATH: `C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.5.11-hotspot\\bin;${process.env.PATH}`,
      },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
