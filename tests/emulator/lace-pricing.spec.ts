import { test, expect } from '@playwright/test';
import { Recorder } from './lib/recorder';
import { costOf, lineTotal, describeLine, hasBundleBreak, type LaceTerms } from '../../api/_lib/lacePricing';

/**
 * What a length of lace costs.
 *
 * Lace is held and sold in metres; a bundle is a price break on those same
 * metres, not a second unit. The rule this pins down is "a customer is never
 * charged more for ordering less", which a naive price break breaks: with a 9m
 * bundle at ₹1,800 and loose lace at ₹250/m, eight metres would cost ₹2,000 and
 * nine would cost ₹1,800.
 *
 * The last case is the important one. It does not check an example — it sweeps
 * every length and asserts the price never goes DOWN as the order grows, which
 * is the property the whole rule exists to guarantee.
 */

// 9m bundle at ₹1,800 (₹200/m) against loose lace at ₹250/m.
const BUNDLE: LaceTerms = { price: 250, unitType: 'bundle', bundleSizeMeters: 9, bundlePrice: 1800 };
const PER_METRE: LaceTerms = { price: 250, unitType: 'per meter' };
const PLAIN: LaceTerms = { price: 4599, unitType: 'unit' };

test('Lace pricing · bundles are a price break, never a penalty', async () => {
  const rec = new Recorder({
    slug: 'lace-pricing',
    title: 'Lace pricing · metres, bundles and the price break',
    area: 'Checkout · Pricing',
    purpose:
      'Lace sells by the metre, with a bundle rate for a full roll. The same rule has to hold on the product page, in the cart and in the authoritative server total, and a customer must never pay more for a shorter length than a longer one.',
    reproduce: [
      'A 9m bundle costs ₹1,800; loose lace is ₹250 a metre.',
      'Order 5m and pay loose rate; order 9m and pay the bundle rate.',
      'Order 8m and pay the bundle rate too — a full bundle is cheaper than 8 loose metres.',
    ],
  });

  try {
    // --- an ordinary product is untouched ----------------------------------
    expect(hasBundleBreak(PLAIN)).toBe(false);
    expect(lineTotal(PLAIN, 3)).toBe(3 * 4599);
    expect(describeLine(PLAIN, 3)).toBe('');
    rec.note('A non-lace product still prices as quantity × price', 'The break only applies where a bundle is defined.');

    // --- plain per-metre lace ----------------------------------------------
    expect(hasBundleBreak(PER_METRE)).toBe(false);
    expect(lineTotal(PER_METRE, 4)).toBe(1000);

    // --- the break, at and above a whole bundle ----------------------------
    expect(lineTotal(BUNDLE, 5)).toBe(1250);        // all loose
    expect(lineTotal(BUNDLE, 9)).toBe(1800);        // exactly one bundle
    expect(lineTotal(BUNDLE, 12)).toBe(2550);       // one bundle + 3m loose
    expect(lineTotal(BUNDLE, 18)).toBe(3600);       // two bundles
    expect(describeLine(BUNDLE, 12)).toBe('1 bundle + 3m');
    expect(describeLine(BUNDLE, 18)).toBe('2 bundles');
    rec.note('Whole bundles are charged at the bundle rate', '12m is one bundle plus three loose metres, ₹2,550.');

    // --- just under a bundle: the case the rule exists for ------------------
    const eight = costOf(BUNDLE, 8);
    expect(eight.total).toBe(1800);                 // NOT 8 × 250 = 2000
    expect(eight.metersGiven).toBe(9);              // so the shelf must lose 9
    expect(eight.wouldHaveCost).toBe(2000);
    rec.note('8m is sold as the 9m bundle', 'Cheaper than 8 loose metres, so the customer gets the 9th metre.');

    // --- a bundle that is not actually cheaper is never forced --------------
    // If someone prices a bundle above the loose rate, the customer must not be
    // pushed into it.
    const dearBundle: LaceTerms = { price: 100, unitType: 'bundle', bundleSizeMeters: 5, bundlePrice: 900 };
    expect(lineTotal(dearBundle, 5)).toBe(500);
    expect(costOf(dearBundle, 5).bundles).toBe(0);
    rec.note('A bundle priced above the loose rate is ignored', 'The cheapest honest way to cover the order still wins.');

    // --- guards ------------------------------------------------------------
    // Half-written products are normal mid-setup and must not throw or mispriced.
    expect(lineTotal({ price: 250, unitType: 'bundle' }, 4)).toBe(1000);                       // no size/price
    expect(lineTotal({ price: 250, unitType: 'bundle', bundleSizeMeters: 0, bundlePrice: 9 }, 4)).toBe(1000);
    expect(lineTotal(BUNDLE, 0)).toBe(0);
    expect(lineTotal(BUNDLE, -3)).toBe(0);

    // --- THE INVARIANT: never cheaper to order more ------------------------
    // Swept rather than sampled, across several bundle shapes, because this is
    // the one property a customer can actually catch us on.
    const shapes: LaceTerms[] = [
      BUNDLE,
      { price: 120, unitType: 'bundle', bundleSizeMeters: 5, bundlePrice: 500 },
      { price: 99, unitType: 'bundle', bundleSizeMeters: 3, bundlePrice: 250 },
      { price: 1000, unitType: 'bundle', bundleSizeMeters: 10, bundlePrice: 1 },
      PER_METRE,
    ];
    for (const shape of shapes) {
      let previous = 0;
      for (let m = 1; m <= 60; m++) {
        const c = costOf(shape, m);
        expect(c.total, `ordering ${m}m costs less than ${m - 1}m`).toBeGreaterThanOrEqual(previous);
        // And never more than paying the loose rate for every metre.
        expect(c.total, `${m}m costs more than loose`).toBeLessThanOrEqual(Math.round(shape.price * m));
        // The customer always receives at least what they asked for.
        expect(c.metersGiven).toBeGreaterThanOrEqual(m);
        previous = c.total;
      }
    }
    rec.note('Swept 1–60m: price never falls as the order grows', 'Across five bundle shapes, and never above the loose rate.');

    rec.finish('passed');
  } catch (err) {
    rec.finish('failed', err instanceof Error ? err.message : String(err));
    throw err;
  }
});
