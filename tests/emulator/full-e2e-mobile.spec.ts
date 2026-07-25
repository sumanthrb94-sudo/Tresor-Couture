import { test, type Browser } from '@playwright/test';
import { runWalkthrough } from './walkthrough';

/**
 * The SAME full walkthrough as full-e2e.spec.ts, run at a MOBILE viewport
 * (iPhone-class 390×844, touch + isMobile) so the responsive storefront, the
 * per-order chat modal, returns, and the admin console are all exercised on a
 * phone-sized screen. Screenshots land in tests/emulator/screens-mobile/.
 */
test('full e2e (mobile): storefront + account + admin + real-time chat + returns + security', async ({ browser }: { browser: Browser }) => {
  // Mobile is single-column, so full-page screenshots (esp. the 34-product shop)
  // are much taller/heavier than desktop — give the run extra headroom.
  test.setTimeout(420_000);
  await runWalkthrough(browser, {
    screensDir: 'tests/emulator/screens-mobile',
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });
});
