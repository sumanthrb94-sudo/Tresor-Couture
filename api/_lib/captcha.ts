/**
 * hCaptcha server-side verification.
 *
 * Expects HCAPTCHA_SECRET server-side and HCAPTCHA_SITE_KEY client-side.
 * If HCAPTCHA_SECRET is not configured, verification is skipped (the endpoint
 * returns true) so the app keeps working in dev/preview without keys.
 */

const VERIFY_URL = 'https://hcaptcha.com/siteverify';

function isProduction(): boolean {
  return process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
}

export interface CaptchaVerifyResult {
  ok: boolean;
  /** Human-readable error; empty when ok. */
  error: string;
}

export async function verifyHcaptcha(token: string | undefined): Promise<CaptchaVerifyResult> {
  const secret = process.env.HCAPTCHA_SECRET?.trim();
  if (!secret) {
    // In production a missing secret is a misconfiguration: fail closed.
    if (isProduction()) {
      console.error('[captcha] HCAPTCHA_SECRET not set in production; rejecting.');
      return { ok: false, error: 'captcha_misconfigured' };
    }
    console.warn('[captcha] HCAPTCHA_SECRET not set; skipping verification in dev/preview.');
    return { ok: true, error: '' };
  }

  if (!token) {
    return { ok: false, error: 'captcha_missing' };
  }

  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ response: token, secret }).toString(),
    });
    const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };
    if (data.success) return { ok: true, error: '' };
    return { ok: false, error: data['error-codes']?.[0] || 'captcha_failed' };
  } catch (err) {
    console.error('[captcha] verify failed', (err as Error).message);
    // In production a network error to the captcha provider must not disable bot protection.
    if (isProduction()) return { ok: false, error: 'captcha_unreachable' };
    return { ok: true, error: '' };
  }
}
