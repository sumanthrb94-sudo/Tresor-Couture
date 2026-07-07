/**
 * hCaptcha server-side verification.
 *
 * Expects HCAPTCHA_SECRET server-side and HCAPTCHA_SITE_KEY client-side.
 * If HCAPTCHA_SECRET is not configured, verification is skipped (the endpoint
 * returns true) so the app keeps working in dev/preview without keys.
 */

const VERIFY_URL = 'https://hcaptcha.com/siteverify';

export interface CaptchaVerifyResult {
  ok: boolean;
  /** Human-readable error; empty when ok. */
  error: string;
}

export async function verifyHcaptcha(token: string | undefined): Promise<CaptchaVerifyResult> {
  const secret = process.env.HCAPTCHA_SECRET?.trim();
  if (!secret) {
    // No secret configured: fail open in non-production, log a warning.
    console.warn('[captcha] HCAPTCHA_SECRET not set; skipping verification.');
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
    // Fail open on network errors to avoid blocking legitimate users.
    return { ok: true, error: '' };
  }
}
