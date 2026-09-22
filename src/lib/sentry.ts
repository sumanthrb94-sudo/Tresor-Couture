/**
 * Sentry frontend initialization.
 *
 * No-ops unless VITE_SENTRY_DSN is configured. Set the DSN in Vercel for
 * production error tracking; leave it empty in local dev to keep noise down.
 *
 * THE IMPORT IS DYNAMIC, AND THAT IS THE POINT. A static `import * as Sentry`
 * puts the whole browser SDK — 236 KB raw, ~81 KB gzipped, 22% of the initial
 * JavaScript — into the first chunk every visitor downloads, parses and
 * executes, whether or not a DSN exists. No DSN is set on this project, so
 * every page load has been paying for an error tracker configured to do
 * nothing. Loading it only when there is somewhere to send errors costs
 * nothing when it is off and the same as before when it is on.
 *
 * The trade: with a DSN set, there is now a short window during startup before
 * the SDK is live. It is not awaited, so it loads in parallel with the app
 * rather than ahead of it, and the window is the length of one chunk fetch.
 * If catching the very first frames of startup ever matters more than the
 * 81 KB, make this a static import again — the rest of the file is unchanged.
 */
const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const dsn = env.VITE_SENTRY_DSN?.trim();

export function initSentry(): void {
  if (!dsn) return;

  // Destructured rather than taken as a namespace: `import('...')` then
  // `Sentry.init(...)` materialises the whole module object and defeats
  // tree-shaking, which made the lazy chunk three times bigger than it needed
  // to be. Naming the two bindings lets Rollup drop the rest.
  void import('@sentry/react')
    .then(({ init, browserTracingIntegration }) => {
      init({
        dsn,
        integrations: [browserTracingIntegration()],
        tracesSampleRate: 0.1,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,
      });
    })
    .catch((err: unknown) => {
      // Error reporting failing to load must never be what breaks the page.
      console.warn('[sentry] could not initialise', err);
    });
}
