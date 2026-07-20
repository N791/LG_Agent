import { defineConfig, devices } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.05 }
  },
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: 'html',
  use: {
    actionTimeout: 0,
    trace: 'on-first-retry',
    baseURL: 'http://localhost:8081',
    // Run headless in CI, but allow headed locally for debugging
    headless: process.env['CI'] ? true : undefined,
  },

  projects: [
    {
      name: 'Smoke',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'Regression',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'Visual-Regression',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
