import { defineConfig, devices } from '@playwright/test';

/**
 * Emulator-only Playwright config for the live-chat two-party test. Kept
 * SEPARATE from playwright.config.ts (whose testDir is ./tests/e2e) so this
 * suite never runs against production — it requires the local emulators +
 * a preview build made with VITE_USE_EMULATORS=1.
 *
 *   BASE_URL   — preview server (default http://127.0.0.1:4173)
 *   PW_EXECUTABLE_PATH — optional Chromium path override for sandboxes that
 *                        ship a prebuilt browser.
 */
const executablePath = process.env.PW_EXECUTABLE_PATH || undefined;

export default defineConfig({
  testDir: './tests/emulator',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  // Every spec here drives the SAME seeded emulator dataset — the same customer,
  // the same order, the same chat thread. Running files in parallel would let
  // two specs interleave messages in one thread and fight over the admin inbox,
  // so serialise them. (Locally this often happened to be 1 anyway, by CPU
  // count; CI runners would not have been.)
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL || 'http://127.0.0.1:4173',
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
