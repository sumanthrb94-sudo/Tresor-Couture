/**
 * Launches a normal Chrome window with remote debugging enabled so you can
 * sign in manually, then run the signed-in E2E tests against that already-open
 * browser via CDP.
 *
 * This avoids Playwright's automation browser, which sometimes fails to load
 * signed-in profiles or is blocked by Google sign-in.
 *
 * Usage:
 *   npx tsx scripts/open-signed-in-cdp.ts [profile-name]
 *
 * Env:
 *   CHROME_USER_DATA_DIR  - Chrome user data directory
 *                           default: %USERPROFILE%\AppData\Local\Google\Chrome\User Data
 *   CHROME_EXE            - path to chrome.exe
 *                           default: C:\Program Files\Google\Chrome\Application\chrome.exe
 *
 * Example:
 *   npx tsx scripts/open-signed-in-cdp.ts "Profile 2"
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const userDataDir = process.env.CHROME_USER_DATA_DIR
  || path.join(process.env.USERPROFILE || process.env.HOME || '.', 'AppData', 'Local', 'Google', 'Chrome', 'User Data');

const profileName = process.argv[2] || 'Profile 2';
const profileDir = path.join(userDataDir, profileName);

function findChrome(): string {
  const candidates = [
    process.env.CHROME_EXE,
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean) as string[];

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error('Could not find chrome.exe. Set CHROME_EXE to the full path.');
}

const chromeExe = findChrome();

const args = [
  `--user-data-dir=${profileDir}`,
  '--remote-debugging-port=9222',
  '--no-first-run',
  '--no-default-browser-check',
  'https://tresorcouture.in/#/login',
  'https://tresorcouture.in/#/admin/dashboard',
];

console.log(`Launching Chrome with CDP on port 9222`);
console.log(`Profile: ${profileDir}\n`);

const proc = spawn(chromeExe, args, { stdio: 'ignore' });

proc.on('error', (err) => {
  console.error('Failed to launch Chrome:', err.message);
  process.exit(1);
});

console.log('Two tabs are open:');
console.log('  1. Storefront login  - sign in as the CUSTOMER');
console.log('  2. Admin console     - sign in as the ADMIN');
console.log('\nAfter signing in, run the tests in another terminal:');
console.log('  $env:CDP_URL="http://localhost:9222"');
console.log('  npm run test:e2e:signed-in:cdp');
console.log('\nClose Chrome when done.\n');

await new Promise<void>((resolve) => {
  proc.on('exit', (code) => {
    console.log(`Chrome exited (code ${code}).`);
    resolve();
  });
});
