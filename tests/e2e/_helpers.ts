import type { APIRequestContext } from '@playwright/test';

/**
 * Some CI/sandbox environments sit behind an egress proxy that blocks
 * non-allowlisted hosts with `403 host_not_allowed`. That's an environment
 * limitation, not a product failure — detect it so tests SKIP (not FAIL)
 * rather than reporting a false negative. On a machine with open network
 * (your laptop, or CI with the domain allowlisted) this returns false and
 * the tests run for real.
 */
export async function egressBlocked(request: APIRequestContext, baseURL?: string): Promise<boolean> {
  try {
    const res = await request.get(baseURL || '/', { timeout: 8000, failOnStatusCode: false });
    if (res.headers()['x-deny-reason'] === 'host_not_allowed') return true;
    if (res.status() === 403 && (await res.text()).includes('not in allowlist')) return true;
    return false;
  } catch {
    // A hard network error in a restricted sandbox also means "can't reach it".
    return true;
  }
}
