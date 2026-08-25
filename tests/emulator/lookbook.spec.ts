import { test, expect } from '@playwright/test';
import { Recorder } from './lib/recorder';
import { buildEntries } from '../../src/lib/lookbook';
import { categoryShowcase } from '../../src/lib/showcase';
import type { Fabric } from '../../src/types';

/**
 * The home-page Lookbook must only ever advertise things the shop has.
 *
 * It used to be eight hardcoded cards — Patola, Jamdani, Mashru — with CTAs
 * pointing at `?category=Silk`. Every one of those was a promise the catalogue
 * could not keep: the atelier sells laces and lehengas, and `Silk` is a
 * SUBcategory, so the buttons landed on an unfiltered shop. It is the same
 * failure as the dead subcategory menus: two lists that each looked right on
 * their own, describing different shops.
 *
 * So the rail is derived now, and these are the properties that keep it honest.
 */

const piece = (over: Partial<Fabric> = {}): Fabric => ({
  id: 'p', brand: 'TRESOR COUTURE', name: 'A piece',
  description: 'A description long enough to be worth printing on a card, comfortably.',
  price: 1000, mrp: 1000, photo: '/products/real.jpg', image: '/products/real.jpg',
  category: 'Laces', masterCategory: 'Laces', subCategory: 'Trim & Edging',
  tags: [], stock: 2, ...over,
});

const swatch = 'data:image/svg+xml;utf8,%3Csvg%3E%3C/svg%3E';

test('Lookbook · every card points at a shelf that has stock', async () => {
  const rec = new Recorder({
    slug: 'lookbook-rail',
    title: 'Lookbook · derived from the catalogue, never from a list',
    area: 'Storefront · Home',
    purpose:
      'The home-page Lookbook is the most prominent editorial block on the site, and it used to be eight hardcoded cards describing weaves the shop has never listed, each linking to an unfiltered shop. It is now built from the catalogue, so a card can only exist where a product does.',
    reproduce: [
      'Open the home page and scroll to "The Lookbook".',
      'Every card is a subcategory that currently has a live product.',
      'Tapping one lands on that exact category + subcategory in the shop.',
    ],
  });

  try {
    // --- A card cannot exist without a product -------------------------
    const entries = buildEntries([
      piece({ id: 'a', masterCategory: 'Laces', category: 'Laces', subCategory: 'Trim & Edging' }),
      piece({ id: 'b', masterCategory: 'Laces', category: 'Laces', subCategory: 'Trim & Edging' }),
      piece({ id: 'c', masterCategory: 'Lehenga Cholis', category: 'Lehenga Cholis', subCategory: 'Zardozi Floral' }),
      piece({ id: 'd', masterCategory: 'Sarees', category: 'Sarees', subCategory: 'Banarasi' }),
    ]);
    expect(entries).toHaveLength(3);
    expect(entries.map(e => e.title)).toContain('Trim & Edging');
    expect(entries.map(e => e.title)).not.toContain('Jamdani');

    // Deepest shelf first — the card a shopper taps should have more behind it.
    expect(entries[0].title).toBe('Trim & Edging');

    // --- The destination is a real pair, not a subcategory used as a category --
    // This is the exact bug that made every old card land on an unfiltered shop.
    for (const e of entries) {
      expect(e.category, 'card must carry its master category').toBeTruthy();
      expect(e.subCategory, 'card must carry its subcategory').toBeTruthy();
      expect(e.category).not.toBe(e.subCategory);
    }
    rec.note('Cards exist only where products do', 'Three shelves, three cards; nothing invented.');

    // --- Categories with spaces survive the grouping --------------------
    // "Lehenga Cholis" and "Trim & Edging" both contain spaces, so a key built
    // by joining them and split back apart yields a category nothing matches.
    const spaced = buildEntries([
      piece({ id: 'x', masterCategory: 'Lehenga Cholis', category: 'Lehenga Cholis', subCategory: 'Zardozi Floral' }),
      piece({ id: 'y', masterCategory: 'Laces', category: 'Laces', subCategory: 'Trim & Edging' }),
      piece({ id: 'z', masterCategory: 'Western Wear', category: 'Western Wear', subCategory: 'Co-ords' }),
    ]);
    expect(spaced.map(e => e.category).sort())
      .toEqual(['Laces', 'Lehenga Cholis', 'Western Wear']);
    expect(spaced.map(e => e.title).sort()).toEqual(['Co-ords', 'Trim & Edging', 'Zardozi Floral']);
    rec.note('Multi-word categories stay intact', 'The pair is carried, not encoded into a key and parsed back.');

    // --- A piece with no subcategory cannot make a card -----------------
    // It has nowhere to link to; a card for it would be the dead link again.
    expect(buildEntries([
      piece({ id: 'n1', subCategory: undefined }),
      piece({ id: 'n2', subCategory: '   ' }),
    ])).toHaveLength(0);

    // --- The hero is the piece that photographs the shelf best -----------
    const heroed = buildEntries([
      piece({ id: 'plain', photo: swatch, image: swatch, price: 9000, name: 'Unphotographed' }),
      piece({ id: 'shot', photo: '/products/real.jpg', price: 100, name: 'Photographed' }),
    ]);
    expect(heroed).toHaveLength(1);
    // Price loses to a real photograph: a card showing a generated swatch is
    // advertising a picture nobody has taken.
    expect(heroed[0].photo).toBe('/products/real.jpg');
    rec.note('A real photograph outranks a higher price', 'A card never fronts a shelf with a placeholder swatch.');

    // --- Sold-out pieces do not front a shelf that still has stock -------
    // Distinct descriptions, or this asserts nothing: with identical copy the
    // card looks the same whichever piece won.
    const stocked = buildEntries([
      piece({ id: 'gone', stock: 0, price: 9000, description: 'The sold out one, described at length.' }),
      piece({ id: 'here', stock: 3, price: 500, description: 'The available one, described at length.' }),
    ]);
    expect(stocked).toHaveLength(1);
    expect(stocked[0].blurb).toContain('available');

    // But a shelf where everything is sold out still gets its card — the shop
    // has that edit, and hiding it would be a different kind of lie.
    expect(buildEntries([piece({ id: 'only', stock: 0 })])).toHaveLength(1);
    rec.note('Sold-out pieces yield to available ones', 'The shelf still shows; the card just fronts a piece you can buy.');

    // --- The blurb is the product's own words, trimmed ------------------
    const long = 'x'.repeat(400);
    const trimmed = buildEntries([piece({ id: 'l', description: long })])[0];
    expect(trimmed.blurb.length).toBeLessThanOrEqual(160);
    expect(trimmed.blurb.endsWith('…')).toBe(true);

    // A piece with no description still gets a usable card rather than a blank.
    const noDesc = buildEntries([piece({ id: 'nd', description: '' })])[0];
    expect(noDesc.blurb).toContain('Trim & Edging');
    rec.note('Copy comes from the product', 'Written once, and it shows on the product page too.');

    // --- The rail is capped ---------------------------------------------
    const many = Array.from({ length: 20 }, (_, i) =>
      piece({ id: `m${i}`, subCategory: `Sub ${i}` }));
    expect(buildEntries(many).length).toBeLessThanOrEqual(8);

    rec.finish('passed');
  } catch (err) {
    rec.finish('failed', err instanceof Error ? err.message : String(err));
    throw err;
  }
});

test('Home page · the hero and the tiles are the shop, not a slideshow', async () => {
  const rec = new Recorder({
    slug: 'home-showcase',
    title: 'Home · hero and category tiles come from the catalogue',
    area: 'Storefront · Home',
    purpose:
      'The first screen a customer sees was three fixed slides of stock photography promising Banarasi, Kanjivaram, Patola and Bandhani — none of which the atelier lists — over CTAs pointing at Sarees and Fabrics. Both the hero and the Shop the House tiles are derived now, so the front page can only show categories that have pieces in them, photographed by those pieces.',
    reproduce: [
      'Open the home page.',
      'Each hero slide is a master category that has live products, using a photograph of one of them.',
      'Each Shop the House tile likewise; a category with nothing in it has no tile.',
    ],
  });

  try {
    const shown = categoryShowcase([
      piece({ id: 'l1', masterCategory: 'Laces', category: 'Laces', subCategory: 'Trim & Edging' }),
      piece({ id: 'l2', masterCategory: 'Laces', category: 'Laces', subCategory: 'Patch' }),
      piece({ id: 'l3', masterCategory: 'Laces', category: 'Laces', subCategory: 'Patch' }),
      piece({ id: 'w1', masterCategory: 'Western Wear', category: 'Western Wear', subCategory: 'Jumpsuits' }),
    ]);

    // Deepest category leads — the hero should open on the fullest shelf.
    expect(shown.map(s => s.category)).toEqual(['Laces', 'Western Wear']);
    expect(shown[0].count).toBe(3);

    // A category with no products has no slide and no tile. This is the whole
    // point: the old hero advertised four weaves that were never in the shop.
    expect(shown.map(s => s.category)).not.toContain('Sarees');

    // Subcategories are the ones with stock, so the subtitle cannot list a
    // shelf that is empty.
    expect(shown[0].subcategories.sort()).toEqual(['Patch', 'Trim & Edging']);
    rec.note('Every slide and tile is a category that has stock', 'Ordered deepest first, so the hero opens on the fullest shelf.');

    // Every slide carries a real photograph — a hero is the largest image on
    // the site and a generated swatch at that size is unmistakable.
    for (const s of shown) {
      expect(s.photo, `${s.category} must have a photo`).toBeTruthy();
      expect(s.photo.startsWith('data:image/svg')).toBe(false);
    }

    const swatchOnly = categoryShowcase([
      piece({ id: 's1', masterCategory: 'Gown', category: 'Gown', photo: swatch, image: swatch, price: 9000 }),
      piece({ id: 's2', masterCategory: 'Gown', category: 'Gown', photo: '/products/real.jpg', price: 10 }),
    ]);
    expect(swatchOnly[0].photo).toBe('/products/real.jpg');
    rec.note('The photographed piece fronts its category', 'Even when a pricier piece in it has not been shot yet.');

    // --- The studio can overrule the guess ------------------------------
    // The heuristic cannot tell a styled flat-lay from a snapshot with a price
    // tag in it, so `featured` beats every other signal — including a real
    // photograph and being in stock, which are the two it normally weighs most.
    const featured = categoryShowcase([
      piece({ id: 'auto', masterCategory: 'Laces', category: 'Laces', photo: '/products/auto.jpg', price: 9000 }),
      piece({ id: 'chosen', masterCategory: 'Laces', category: 'Laces', photo: '/products/chosen.jpg', price: 10, stock: 0, featured: true }),
    ]);
    expect(featured[0].photo).toBe('/products/chosen.jpg');

    // And on the Lookbook card for its subcategory, from the same flag.
    const featuredCard = buildEntries([
      piece({ id: 'auto2', photo: '/products/auto.jpg', price: 9000, description: 'The automatic pick, at length.' }),
      piece({ id: 'chosen2', photo: '/products/chosen.jpg', price: 10, featured: true, description: 'The chosen pick, at length.' }),
    ]);
    expect(featuredCard[0].photo).toBe('/products/chosen.jpg');
    expect(featuredCard[0].blurb).toContain('chosen');
    rec.note('A featured piece outranks the heuristic', 'One tick in the product editor decides the hero, the tile and the card.');

    // An empty catalogue yields no slides at all, so the hero renders nothing
    // rather than falling back to something invented.
    expect(categoryShowcase([])).toHaveLength(0);
    rec.note('No catalogue, no hero', 'A shorter page beats a fabricated one.');

    rec.finish('passed');
  } catch (err) {
    rec.finish('failed', err instanceof Error ? err.message : String(err));
    throw err;
  }
});
