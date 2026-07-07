/**
 * Sentry server-side initialization for Vercel Node serverless functions.
 *
 * Initialize once at module load and wrap each handler so Sentry flushes before
 * the function returns. No-ops unless SENTRY_DSN is configured.
 */
import * as Sentry from '@sentry/node';
import type { ApiRequest, ApiResponse } from './http.js';

const dsn = process.env.SENTRY_DSN?.trim();

let initialized = false;
export function initServerSentry(): void {
  if (!dsn || initialized) return;
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
  });
  initialized = true;
}

export type ApiHandler = (req: ApiRequest, res: ApiResponse) => Promise<void>;

/**
 * Wrap an API handler with Sentry error capture. Also flushes the event queue
 * before responding so errors are not lost when the serverless instance is
 * frozen.
 */
export function withSentry(handler: ApiHandler): ApiHandler {
  initServerSentry();
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      Sentry.captureException(err);
      throw err;
    } finally {
      await Sentry.flush(2000);
    }
  };
}
