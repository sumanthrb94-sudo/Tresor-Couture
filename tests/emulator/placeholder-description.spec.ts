import { test, expect } from '@playwright/test';
import { isPlaceholderDescription, fallbackDescription, displayDescription } from '../../src/lib/productCopy';

test('Descriptions · placeholders are caught, real copy is left alone', () => {
  for (const t of ['test', 'Test', ' TEST. ', 'testing', 'test product', '', '   ', 'demo', 'lorem ipsum', undefined])
    expect(isPlaceholderDescription(t as string)).toBe(true);
  for (const t of ['Antique gold scalloped cord lace with pleated zari.', 'Tested for colourfastness on silk and satin.'])
    expect(isPlaceholderDescription(t)).toBe(false);
});

test('Descriptions · fallback copy states only what the record says', () => {
  const p = { name: 'Gold Gota Lace', colourName: 'Gold', masterCategory: 'Laces', category: 'Laces',
    subCategory: 'Trim & Edging', unitType: 'bundle', bundleSizeMeters: 9, description: 'test' } as never;
  const d = displayDescription(p);
  expect(d).toContain('Gold Gota Lace');
  expect(d).toContain('9-metre bundle');
  expect(d).not.toMatch(/hand|silk|zari|embroider/i);
  expect(fallbackDescription(p)).toBe(d);
  expect(displayDescription({ ...(p as object), description: 'Real words.' } as never)).toBe('Real words.');
});
