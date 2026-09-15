import { test, expect } from '@playwright/test';
import { Recorder } from './lib/recorder';
import { colourSiblings, colourwayCount, styleKey } from '../../src/lib/styleGroup';
import type { Fabric } from '../../src/types';

/**
 * Which colourways a shopper is offered on a product page.
 *
 * A lace design arrives in five or six colours and each colour is its own
 * product — its own barcode, its own stock, its own photographs — so the page
 * has to find its siblings rather than read them out of its own document. The
 * cases below are the ones that actually bite: a Draft colour that has no live
 * page, a sold-out colour that still deserves to be mentioned, a style code
 * typed in a different case, and a design that only ever had one colour.
 */

const p = (over: Partial<Fabric> = {}): Fabric => ({
  id: 'x', name: 'Lace', brand: 'TRESOR', description: '',
  price: 100, mrp: 100, photo: '/p/x.jpg', image: 'swatch-x',
  category: 'Laces', masterCategory: 'Laces', tags: [], stock: 5,
  ...over,
} as Fabric);

test('Product page · the colourway rail offers every live colour, once', async () => {
  const rec = new Recorder({
    slug: 'style-group',
    title: 'Product page · colourways of one design',
    area: 'Storefront · Product',
    purpose:
      'One lace design is sold in several colours, and each colour is a separate product so that stock, price and the barcode a till scans stay per roll. The page finds its siblings by style code; these are the rules for which ones a shopper is shown.',
    reproduce: [
      'Give every colour of a design the same style code and its own colour name.',
      'Open any one of them: the rail lists all the live colours, the current one marked.',
      'Drafts never appear; sold-out colours appear but are marked.',
    ],
  });

  try {
    const blush = p({ id: 'a', styleCode: 'TC-BFV', colourName: 'Blush' });
    const emerald = p({ id: 'b', styleCode: 'TC-BFV', colourName: 'Emerald' });
    const grey = p({ id: 'c', styleCode: 'TC-BFV', colourName: 'Grey' });
    const other = p({ id: 'z', styleCode: 'TC-FAN', colourName: 'Maroon' });

    // --- the ordinary case -------------------------------------------------
    const rail = colourSiblings(blush, [blush, emerald, grey, other]);
    expect(rail.map(s => s.colour)).toEqual(['Blush', 'Emerald', 'Grey']);
    expect(rail.filter(s => s.isCurrent).map(s => s.id)).toEqual(['a']);
    rec.note('Every colour of the design is offered', 'Including the one being viewed, so the rail reads as a selector.');

    // A different design must not leak in, however similar it looks.
    expect(rail.some(s => s.id === 'z')).toBe(false);

    // --- a Draft colour has no live page -----------------------------------
    // Bulk imports create Drafts, so an unphotographed colour is the normal
    // state of a design mid-shoot. Linking to one would be a dead end.
    const draft = p({ id: 'd', styleCode: 'TC-BFV', colourName: 'Mustard', listingStatus: 'Draft' });
    const withDraft = colourSiblings(blush, [blush, emerald, draft]);
    expect(withDraft.map(s => s.colour)).toEqual(['Blush', 'Emerald']);
    rec.note('A Draft colour is never linked', 'It has no published page to land on.');

    // --- sold out is still worth saying ------------------------------------
    const gone = p({ id: 'e', styleCode: 'TC-BFV', colourName: 'Wine', stock: 0 });
    const withGone = colourSiblings(blush, [blush, gone]);
    expect(withGone.map(s => [s.colour, s.soldOut])).toEqual([['Blush', false], ['Wine', true]]);
    rec.note('A sold-out colour is shown, marked', '"We make this in wine, just not today" is worth knowing.');

    // --- one colour is not a choice ----------------------------------------
    // A rail holding a single swatch costs a section of the page and tells the
    // shopper nothing, so the caller renders nothing at all.
    expect(colourSiblings(other, [other, blush, emerald])).toEqual([]);
    expect(colourSiblings(p({ id: 'q' }), [p({ id: 'q' })])).toEqual([]);
    rec.note('A design with one colour shows no rail', 'And a product with no style code shows none either.');

    // --- style codes are typed by hand -------------------------------------
    const lower = p({ id: 'f', styleCode: ' tc-bfv ', colourName: 'Nude' });
    expect(styleKey(lower)).toBe('TC-BFV');
    expect(colourSiblings(blush, [blush, lower]).map(s => s.colour)).toEqual(['Blush', 'Nude']);
    rec.note('Case and stray spaces do not split a design', 'Codes get typed, and "tc-bfv" is the same design as "TC-BFV".');

    // --- ordering follows the barcode run ----------------------------------
    // Barcodes are issued as one unbroken run per design, so they carry the
    // order the studio shot and labelled the colours in.
    const ordered = colourSiblings(
      p({ id: 'm2', styleCode: 'TC-X', colourName: 'Second', barcode: 'TC00143' }),
      [
        p({ id: 'm3', styleCode: 'TC-X', colourName: 'Third', barcode: 'TC00144' }),
        p({ id: 'm1', styleCode: 'TC-X', colourName: 'First', barcode: 'TC00142' }),
        p({ id: 'm2', styleCode: 'TC-X', colourName: 'Second', barcode: 'TC00143' }),
      ],
    );
    expect(ordered.map(s => s.colour)).toEqual(['First', 'Second', 'Third']);

    // --- a freshly saved product may not be in the cached catalogue yet -----
    const fresh = p({ id: 'new', styleCode: 'TC-BFV', colourName: 'Ivory' });
    expect(colourSiblings(fresh, [blush, emerald]).map(s => s.id).sort()).toEqual(['a', 'b', 'new']);

    // --- the badge on a grid card ------------------------------------------
    expect(colourwayCount(blush, [blush, emerald, grey, other])).toBe(3);
    expect(colourwayCount(other, [blush, other])).toBe(0);          // one colour: no badge
    expect(colourwayCount(p({ id: 'n' }), [p({ id: 'n' })])).toBe(0); // no style code: no badge
    expect(colourwayCount(blush, [blush, emerald, draft])).toBe(2);   // Drafts are not counted
    rec.note('The grid badge counts only openable colours', 'So it never promises a colour that turns out to be a Draft.');

    // A product listed twice in the catalogue snapshot must count once.
    expect(colourwayCount(blush, [blush, blush, emerald])).toBe(2);

    rec.finish('passed');
  } catch (err) {
    rec.finish('failed', err instanceof Error ? err.message : String(err));
    throw err;
  }
});
