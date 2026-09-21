import { unitBadge, stockLabel, bundleOnly, meteredLace, quantityNoun } from '../../src/lib/laceUnits';
import { costOf } from '../../api/_lib/lacePricing';

const GOLD   = { category: 'Laces', unitType: 'per meter', price: 480 } as never;
const PURPLE = { category: 'Laces', unitType: 'unit', bundleSizeMeters: 9, price: 3900 } as never;
const BREAK  = { category: 'Laces', unitType: 'bundle', bundleSizeMeters: 9, bundlePrice: 3600, price: 480 } as never;
const SAREE  = { category: 'Sarees', unitType: undefined } as never;

let fail = 0;
const is = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}: ${JSON.stringify(got)}${ok ? '' : ` (wanted ${JSON.stringify(want)})`}`);
};

console.log('-- which shape is it --');
is('gold is metered', meteredLace(GOLD), true);
is('gold is not bundle-only', bundleOnly(GOLD), false);
is('purple IS bundle-only', bundleOnly(PURPLE), true);
is('purple is NOT metered (quantity means bundles)', meteredLace(PURPLE), false);
is('a price-break lace is metered', meteredLace(BREAK), true);
is('a price-break lace is not bundle-only', bundleOnly(BREAK), false);
is("'unit' without a bundle length is not bundle-only", bundleOnly({ category: 'Laces', unitType: 'unit' } as never), false);

console.log('\n-- what the shopper is told --');
is('gold badge', unitBadge(GOLD), 'Sold per meter');
is('purple badge', unitBadge(PURPLE), '9m bundle only');
is('price-break badge', unitBadge(BREAK), '9m bundle rate');
is('a saree gets no lace badge', unitBadge(SAREE), null);

console.log('\n-- what stock counts --');
is('gold stock', stockLabel(GOLD, 9), 'meters');
is('purple stock (plural)', stockLabel(PURPLE, 3), 'bundles of 9m');
is('purple stock (singular)', stockLabel(PURPLE, 1), 'bundle of 9m');
is('price-break stock', stockLabel(BREAK, 20), 'meters (2 bundles)');
is('quantity noun, purple', quantityNoun(PURPLE), 'bundles');
is('quantity noun, gold', quantityNoun(GOLD), 'meters');

console.log('\n-- money --');
// The point of modelling bundle-only as a unit: 2 bundles must cost 2x3900,
// with no metre arithmetic anywhere near it.
is('purple, 1 bundle', costOf(PURPLE, 1).total, 3900);
is('purple, 2 bundles', costOf(PURPLE, 2).total, 7800);
is('purple gives exactly what was ordered', costOf(PURPLE, 2).metersGiven, 2);
is('gold, 3 metres', costOf(GOLD, 3).total, 1440);
is('price-break lace still rounds up to the cheaper bundle', costOf(BREAK, 8).total, 3600);
is('...and hands over the whole bundle', costOf(BREAK, 8).metersGiven, 9);

console.log(`\n${fail === 0 ? 'all passed' : fail + ' FAILED'}`);
process.exit(fail ? 1 : 0);
