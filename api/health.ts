/**
 * GET /api/health
 *
 * Lightweight health/readiness probe for uptime monitors and load balancers.
 * Reports whether the critical third-party integrations are configured.
 * Does NOT perform deep dependency checks (no Firestore reads, no Brevo/Razorpay
 * API calls) so it stays fast and cheap.
 */
import { handleCorsPreflight, rejectDisallowedOrigin } from './_lib/cors.js';
import { header, type ApiRequest, type ApiResponse } from './_lib/http.js';
import { withSentry } from './_lib/sentry.js';

interface HealthCheck {
  name: string;
  configured: boolean;
  required: boolean;
}

async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (handleCorsPreflight(req, res, 'GET, OPTIONS')) return;
  if (rejectDisallowedOrigin(req, res)) return;

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const checks: HealthCheck[] = [
    {
      name: 'firebase_admin',
      configured: Boolean(
        process.env.FIREBASE_SERVICE_ACCOUNT?.trim() || process.env.GOOGLE_APPLICATION_CREDENTIALS,
      ),
      required: true,
    },
    {
      name: 'razorpay',
      configured: Boolean(
        process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET,
      ),
      required: false, // launch blocker, but site can run in demo mode without it
    },
    {
      name: 'brevo',
      configured: Boolean(process.env.BREVO_API_KEY),
      required: false,
    },
    {
      name: 'upstash_redis',
      configured: Boolean(
        process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
      ),
      required: false,
    },
    {
      name: 'hcaptcha',
      configured: Boolean(process.env.HCAPTCHA_SECRET),
      required: false,
    },
  ];

  const missingRequired = checks.filter((c) => c.required && !c.configured).map((c) => c.name);
  const ok = missingRequired.length === 0;

  res.status(ok ? 200 : 503);
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.json({
    ok,
    nodeVersion: process.version,
    timestamp: new Date().toISOString(),
    region: header(req, 'x-vercel-id')?.split(':')[0] || 'unknown',
    checks,
    ...(missingRequired.length ? { missingRequired } : {}),
  });
}

export default withSentry(handler);
