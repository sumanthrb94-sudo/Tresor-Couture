import { test, expect } from '@playwright/test';
import { buildHomeRails, browseAll, RAIL_SIZE } from '../../src/lib/homeRails';
import type { Fabric } from '../../src/types';

/**
 * The home page must fill itself from the catalogue, not from hand-typed tags.
 *
 * Every rail used to be a sticker filter. A catalogue grown by bulk upload has
 * no stickers, so every rail was empty, empty rails are removed from the page,
 * and a shop with hundreds of pieces showed a hero and a few tiles.
 */

let n = 0;
const piece = (over: Partial<Fabric> = {}): Fabric => {
  n += 1;
  return {
    id: `p${n}`, brand: 'TRESOR COUTURE', name: `Piece ${n}`, description: 'x',
    price: 1000, mrp: 1000, photo: `/products/real-${n}.jpg`, image: '/products/real.jpg',
    category: 'Laces', masterCategory: 'Laces', subCategory: 'Trim & Edging',
    tags: [], stock: 3, createdAt: n * 1000, ...over,
  };
};
const swatch = 'data:image/svg+xml;utf8,%3Csvg%3E%3C/svg%3E';

test('Home · an untagged catalogue still fills New In, Studio Picks and the full grid', () => {
  const catalogue = Array.from({ length: 40 }, () => piece());
  const r = buildHomeRails(catalogue);
  expect(r.newIn).toHaveLength(RAIL_SIZE);
  expect(r.studio).toHaveLength(RAIL_SIZE);
  expect(r.studioChosen).toBe(0);
  expect(browseAll(catalogue)).toHaveLength(40);
});

test('Home · New In is genuinely the newest, not the first N rows', () => {
  const catalogue = Array.from({ length: 12 }, () => piece());
  const newest = catalogue[catalogue.length - 1].id;
  expect(buildHomeRails(catalogue).newIn[0].id).toBe(newest);
});

test('Home · a featured piece is a studio pick and leads the rail', () => {
  const picked = piece({ featured: true, createdAt: 1 });
  const catalogue = [...Array.from({ length: 10 }, () => piece()), picked];
  const r = buildHomeRails(catalogue);
  expect(r.studio[0].id).toBe(picked.id);
  expect(r.studioChosen).toBe(1);
  // …and is still allowed to be on the studio rail even if it is also new.
  const alsoNew = piece({ featured: true, createdAt: 9e9 });
  const r2 = buildHomeRails([...catalogue, alsoNew]);
  expect(r2.studio.map(f => f.id)).toContain(alsoNew.id);
});

test('Home · never advertises sold-out, draft, retired or unphotographed pieces', () => {
  const bad = [
    piece({ stock: 0, featured: true }),
    piece({ stock: undefined, featured: true }),
    piece({ listingStatus: 'Draft', featured: true }),
    piece({ listingStatus: 'Retired', featured: true }),
    piece({ photo: swatch, featured: true }),
  ];
  const good = piece();
  const r = buildHomeRails([...bad, good]);
  const ids = new Set([...r.newIn, ...r.studio, ...r.trending].map(f => f.id));
  for (const b of bad) expect(ids.has(b.id)).toBe(false);
  expect(ids.has(good.id)).toBe(true);
  expect(browseAll([...bad, good]).map(f => f.id)).toContain(good.id);
});

test('Home · a piece sits on one curated rail only, and colourways collapse to one card', () => {
  const trending = Array.from({ length: 3 }, () => piece({ sticker: 'Trending' }));
  const colourways = ['Red', 'Blue', 'Green'].map(c => piece({ styleCode: 'TC-X', colourName: c } as Partial<Fabric>));
  const r = buildHomeRails([...trending, ...colourways, ...Array.from({ length: 8 }, () => piece())]);
  const seen = [...r.trending, ...r.newIn, ...r.bridal, ...r.summer].map(f => f.id);
  expect(new Set(seen).size).toBe(seen.length);
  expect(browseAll(colourways)).toHaveLength(1);
});
