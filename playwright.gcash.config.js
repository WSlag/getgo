import { defineConfig, devices } from '@playwright/test';

process.env.PW_FIREBASE_PROJECT_ID = process.env.PW_FIREBASE_PROJECT_ID || 'karga-ph';

export default defineConfig({
  testDir: './tests/e2e/payments',
  fullyParallel: false,
  workers: 1,
  timeout: 90 * 1000,
  expect: { timeout: 15 * 1000 },
  retries: 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    actionTimeout: 15 * 1000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    // Firebase Emulators (auth + firestore + functions)
    {
      command: 'firebase emulators:start --only auth,firestore,functions',
      url: 'http://127.0.0.1:9099',
      reuseExistingServer: true,
      timeout: 180 * 1000,
      env: {
        JAVA_HOME: 'C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.5.11-hotspot',
        PATH: `C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.5.11-hotspot\\bin;${process.env.PATH}`,
      },
      stdout: 'pipe',
      stderr: 'pipe',
    },
    // Frontend dev server (Vite)
    {
      command: 'cd frontend && npm run dev',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: true,
      timeout: 120 * 1000,
      env: {
        VITE_USE_FIREBASE_EMULATOR: 'true',
        VITE_FIREBASE_EMULATOR_HOST: '127.0.0.1',
      },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
