/**
 * Sentry frontend initialization.
 *
 * No-ops unless VITE_SENTRY_DSN is configured. Set the DSN in Vercel for
 * production error tracking; leave it empty in local dev to keep noise down.
 */
import * as Sentry from '@sentry/react';

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const dsn = env.VITE_SENTRY_DSN?.trim();

export function initSentry(): void {
  if (!dsn) return;

  Sentry.init({
    dsn,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}

export { Sentry };
