import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for Tresor Couture E2E.
 *
 * Target any environment via BASE_URL (defaults to production):
 *   BASE_URL=https://tresorcouture.in npx playwright test
 *   BASE_URL=http://localhost:3000   npx playwright test   # local `npm run dev`
 *
 * The suite is read-only / non-destructive by default: it browses, checks the
 * API contract, and submits a clearly-tagged test email to the capture form.
 * It never completes a real payment.
 *
 * NOTE: the app is a client-rendered SPA with HASH routing (#/shop, #/product/:id).
 * Tests wait for hydration (network idle + visible anchors), not server HTML.
 */
const BASE_URL = process.env.BASE_URL || 'https://tresorcouture.in';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    // Tolerate TLS validity errors caused by CI/sandbox clock skew (a future-
    // dated clock makes a valid cert look "not yet valid"). Real cert problems
    // still surface in browsers; this only affects the test client.
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: 'signed-in/**/*.spec.ts' },
    { name: 'mobile-safari', use: { ...devices['iPhone 13'] }, testIgnore: 'signed-in/**/*.spec.ts' },
    {
      name: 'signed-in-chrome',
      testMatch: 'signed-in/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
