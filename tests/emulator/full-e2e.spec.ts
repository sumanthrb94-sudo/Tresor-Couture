import { test, type Browser } from '@playwright/test';
import { runWalkthrough } from './walkthrough';

/**
 * FULL end-to-end walkthrough at DESKTOP viewport against the Firebase Emulator
 * Suite (Auth + Firestore, real firestore.rules). Storefront → customer account
 * → per-order chat → returns → admin console (support/returns/orders/CRM) →
 * real-time chat both directions → cross-customer isolation. Screenshots land in
 * tests/emulator/screens/. See the mobile variant in full-e2e-mobile.spec.ts.
 */
test('full e2e (desktop): storefront + account + admin + real-time chat + returns + security', async ({ browser }: { browser: Browser }) => {
  test.setTimeout(240_000);
  await runWalkthrough(browser, {
    screensDir: 'tests/emulator/screens',
    viewport: { width: 1280, height: 900 },
  });
});
