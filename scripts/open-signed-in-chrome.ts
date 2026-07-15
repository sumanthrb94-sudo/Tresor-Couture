/**
 * Opens a headed Chrome window using a persistent profile so you can sign in
 * manually on the website itself (Google sign-in is blocked in automated
 * browsers, so use email/password or phone OTP on the Tresor login pages).
 *
 * Two tabs are created:
 *   1. Storefront (customer account)
 *   2. Admin console
 *
 * After signing in to both accounts, close the browser window and run the
 * signed-in E2E tests.
 *
 * Usage:
 *   npx tsx scripts/open-signed-in-chrome.ts [profile-name]
 *
 * Env:
 *   CHROME_USER_DATA_DIR  - Chrome user data directory
 *                           default: %USERPROFILE%\AppData\Local\Google\Chrome\User Data
 *   CHROME_PROFILE        - profile folder inside user data dir
 *                           default: Default
 *
 * Example:
 *   npx tsx scripts/open-signed-in-chrome.ts "Profile 2"
 */
import { chromium } from '@playwright/test';
import path from 'path';

const userDataDir = process.env.CHROME_USER_DATA_DIR
  || path.join(process.env.USERPROFILE || process.env.HOME || '.', 'AppData', 'Local', 'Google', 'Chrome', 'User Data');

const profileName = process.argv[2] || process.env.CHROME_PROFILE || 'Default';
const profileDir = path.join(userDataDir, profileName);

console.log(`Opening Chrome with profile:\n  ${profileDir}`);
console.log('Close Chrome completely before running the E2E tests.\n');

const context = await chromium.launchPersistentContext(profileDir, {
  channel: 'chrome',
  headless: false,
  args: ['--no-first-run', '--no-default-browser-check'],
  ignoreHTTPSErrors: true,
});

const storefront = await context.newPage();
await storefront.goto('https://tresorcouture.in/#/login');

const admin = await context.newPage();
await admin.goto('https://tresorcouture.in/#/admin/dashboard');

console.log('Two tabs are open:');
console.log('  1. Storefront login  - sign in as the CUSTOMER');
console.log('  2. Admin console     - sign in as the ADMIN');
console.log('\nUse email/password or phone OTP; Google sign-in is blocked in this automated window.');
console.log('When both accounts are signed in, close the browser window.');
console.log('Then set CUSTOMER_CHROME_PROFILE / ADMIN_CHROME_PROFILE to this profile path and run:');
console.log('  npm run test:e2e:signed-in\n');

await new Promise<void>((resolve) => {
  context.on('close', () => {
    console.log('Browser closed.');
    resolve();
  });
});
