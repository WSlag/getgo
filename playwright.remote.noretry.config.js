import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60 * 1000,
  expect: { timeout: 10 * 1000 },
  retries: 0,
  reporter: [
    ['html', { outputFolder: 'playwright-report-remote', open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: 'https://karga-ph.firebaseapp.com/',
    trace: 'on',
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
});
