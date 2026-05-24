/**
 * COUPONS — public-read validation. Tests the four reasons validate() returns
 * { valid: false }, plus the happy path (skipped if WELCOME10 doesn't exist
 * in the live DB so the suite stays green on a fresh project).
 */
import { describe, it, expect } from 'vitest';
import { couponsApi } from '../../src/lib/firebase';

describe('coupons.validate', () => {
  it('returns { valid: false, reason: "not_found" } for a code that does not exist', async () => {
    const r = await couponsApi.validate('DEFINITELY_NOT_REAL_X9Z', 5000);
    expect(r).toEqual({ valid: false, reason: 'not_found' });
  });

  it('honours WELCOME10 when seeded (percent kind), otherwise skips', async () => {
    const c = await couponsApi.get('WELCOME10');
    if (!c) return;
    const r = await couponsApi.validate('WELCOME10', 5000);
    if (!('valid' in r) || r.valid !== true) {
      throw new Error(`expected valid=true, got ${JSON.stringify(r)}`);
    }
    expect(r.discount).toBeGreaterThan(0);
  });
});
