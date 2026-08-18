import React, { useMemo, useRef, useState } from 'react';
import { X, Plus, Trash2, Loader2, ClipboardPaste, Tag, CheckCircle2, AlertCircle } from 'lucide-react';
import { CATEGORIES, MASTER_CATEGORY_TREE } from '../../constants';
import { productsApi } from '../../lib/firebase';
import { reserveBarcode } from '../../lib/barcodeAssign';
import { placeholderSwatch } from '../../lib/swatch';
import { code128Svg } from '../../lib/barcode';
import { LABEL_DESIGNS, defaultDesign, designById, printLabels } from '../../admin/printLabels';
import { THERMAL_SIZES, downloadThermalLabel, isThermal, thermalById } from '../../admin/thermalLabel';
import type { Fabric } from '../../types';

/**
 * Add a shelf of products in one pass, then barcode and label exactly them.
 *
 * The one-at-a-time editor is right for a piece that needs copy, colours and a
 * photograph. It is the wrong shape for the actual job of filling a store:
 * forty items off a supplier's invoice, each of which is a name, a category, a
 * price and a count. Doing that through a full form forty times is why the work
 * ends up in a spreadsheet instead.
 *
 * Every row carries its OWN category and subcategory, so one batch can hold
 * laces, sarees and a lehenga — a delivery is rarely all one thing. The panel at
 * the top sets defaults for whatever a row leaves blank, which is what makes a
 * forty-line invoice of one supplier's trims quick without making a mixed
 * delivery impossible.
 *
 * The aim is to capture everything EXCEPT the photograph and the copy, so the
 * only work left per piece is the shoot and a paragraph. Everything created is
 * a DRAFT: it counts for stock and sells at the counter immediately, and no
 * shopper sees it until it has been photographed.
 *
 * The batch stays on screen after saving, with its codes, so the labels printed
 * are exactly the pieces just entered — not "whatever the Inventory filter
 * happens to show", which is the same list only until someone changes a filter.
 */

interface Row {
  name: string;
  category: string;
  subCategory: string;
  code: string;
  cost: string;
  price: string;
  mrp: string;
  stock: string;
  unit: string;
}

const blankRow = (): Row => ({
  name: '', category: '', subCategory: '', code: '',
  cost: '', price: '', mrp: '', stock: '', unit: '',
});

const newId = (name: string): string => {
  const slug = name.trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 6);
  // A readable id becomes a readable web address later, but it still has to be
  // unique — two "Gold Zari Border"s a month apart must not collide.
  return slug ? `${slug}-${suffix}` : `p-${Date.now().toString(36)}-${suffix}`;
};

const num = (v: string): number | undefined => {
  const n = Number(String(v).replace(/[₹,\s]/g, ''));
  return v.trim() !== '' && Number.isFinite(n) ? n : undefined;
};

/** Match a pasted header cell to a field, so column ORDER need not be guessed. */
const HEADER_ALIASES: Record<keyof Row, RegExp> = {
  name: /^(name|product|product\s*name|item|description)$/i,
  category: /^(category|master\s*category|type)$/i,
  subCategory: /^(sub\s*category|subcategory|sub\s*category\s*\/\s*design|design)$/i,
  code: /^(code|supplier\s*code|sku|article)$/i,
  cost: /^(cost|buying|buying\s*price.*|purchase.*|cost\s*price.*)$/i,
  price: /^(price.*|selling.*|rate|mrp\s*price)$/i,
  mrp: /^(mrp.*|list\s*price|max.*)$/i,
  stock: /^(stock.*|qty|quantity|units?|pcs?)$/i,
  unit: /^(unit|unit\s*type|sold\s*as|uom)$/i,
};

/** Positional fallback when the paste has no header line. */
const DEFAULT_ORDER: (keyof Row)[] = ['name', 'category', 'subCategory', 'price', 'mrp', 'stock'];

const splitCells = (line: string): string[] =>
  (line.includes('\t') ? line.split('\t') : line.split(',')).map(c => c.trim());

/**
 * Parse pasted spreadsheet text.
 *
 * If the first line looks like headers, columns are matched BY NAME — so a
 * sheet whose columns are in a different order, or which carries extras we do
 * not want, still lands in the right fields. Otherwise the common order is
 * assumed and the placeholder says what it is.
 */
export function parsePaste(text: string): Row[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  const first = splitCells(lines[0]);
  const mapped: (keyof Row | null)[] = first.map(cell => {
    const hit = (Object.keys(HEADER_ALIASES) as (keyof Row)[])
      .find(field => HEADER_ALIASES[field].test(cell));
    return hit ?? null;
  });
  // A header row is one where most cells name a field. Requiring a name column
  // stops a product called "Price" from being mistaken for a header.
  const isHeader = mapped.filter(Boolean).length >= Math.max(2, Math.ceil(first.length / 2))
    && mapped.includes('name');

  const order = isHeader ? mapped : DEFAULT_ORDER;
  const body = isHeader ? lines.slice(1) : lines;

  return body
    .map(line => {
      const cells = splitCells(line);
      const row = blankRow();
      order.forEach((field, i) => {
        if (field && cells[i] !== undefined) row[field] = cells[i];
      });
      if (!row.mrp) row.mrp = row.price;
      return row;
    })
    .filter(r => r.name);
}

interface Created { product: Fabric; }

const BatchAddProducts: React.FC<{ onClose: () => void; onSaved: () => void }> = ({ onClose, onSaved }) => {
  /* Defaults for whatever a row leaves blank. */
  const [brand, setBrand] = useState('TRESOR');
  const [category, setCategory] = useState<string>('Laces');
  const [subCategory, setSubCategory] = useState('');
  const [material, setMaterial] = useState('');
  const [unitType, setUnitType] = useState('');
  const [supplier, setSupplier] = useState('');

  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: 6 }, blankRow));
  const [pasteOpen, setPasteOpen] = useState(false);
  const pasteRef = useRef<HTMLTextAreaElement>(null);

  const [saving, setSaving] = useState<{ done: number; total: number } | null>(null);
  const [created, setCreated] = useState<Created[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [labelDesignId, setLabelDesignId] = useState<string>(() => defaultDesign().id);

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows(prev => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  /** A row counts once it has a name and a price — everything else has a default. */
  const ready = useMemo(
    () => rows.filter(r => r.name.trim() && (num(r.price) ?? 0) > 0),
    [rows],
  );
  /** Half-filled rows are worth warning about; blank ones are just spare. */
  const incomplete = useMemo(
    () => rows.filter(r => (r.name.trim() || r.price.trim()) && !ready.includes(r)).length,
    [rows, ready],
  );

  /** Categories a row names that are not in the vocabulary — a typo shows here. */
  const unknownCategories = useMemo(() => {
    const known = new Set<string>(CATEGORIES as unknown as string[]);
    return [...new Set(ready.map(r => r.category.trim()).filter(c => c && !known.has(c)))];
  }, [ready]);

  const applyPaste = () => {
    const parsed = parsePaste(pasteRef.current?.value ?? '');
    if (!parsed.length) {
      setError('Nothing recognisable in that paste. One product per line, and either a header row or the order shown below.');
      return;
    }
    setError(null);
    setRows(prev => {
      // Keep whatever was already typed; spare blank rows are dropped.
      const kept = prev.filter(r => r.name.trim() || r.price.trim());
      return [...kept, ...parsed, blankRow()];
    });
    setPasteOpen(false);
  };

  const save = async () => {
    if (!ready.length || saving) return;
    setError(null);
    setSaving({ done: 0, total: ready.length });
    const made: Created[] = [];

    try {
      for (const [i, r] of ready.entries()) {
        // One transaction per code — sequential so they cannot contend, and so
        // a failure halfway leaves everything before it genuinely saved.
        const barcode = await reserveBarcode();
        const id = newId(r.name);
        const name = r.name.trim();
        const price = num(r.price) ?? 0;
        const mrp = num(r.mrp) ?? price;
        // The row wins; the panel fills what the row left blank.
        const cat = (r.category.trim() || category) as Fabric['category'];
        const sub = r.subCategory.trim() || subCategory.trim();
        const unit = (r.unit.trim() || unitType) as Fabric['unitType'] | '';

        const product: Fabric = {
          id,
          brand: brand.trim() || 'TRESOR',
          name,
          description: '',
          price,
          mrp: Math.max(mrp, price),
          photo: placeholderSwatch(id, name, cat),
          image: placeholderSwatch(id, name, cat),
          category: cat,
          masterCategory: cat,
          ...(sub ? { subCategory: sub } : {}),
          ...(unit ? { unitType: unit } : {}),
          ...(material.trim() ? { materialType: material.trim() } : {}),
          ...(supplier.trim() ? { supplier: supplier.trim() } : {}),
          ...(r.code.trim() ? { productCode: r.code.trim() } : {}),
          ...(num(r.cost) !== undefined ? { costPrice: num(r.cost) } : {}),
          tags: [cat, ...(sub ? [sub] : []), ...(material.trim() ? [material.trim()] : [])],
          stock: num(r.stock) ?? 0,
          barcode,
          // Nothing here has been photographed, so nothing here is published.
          listingStatus: 'Draft',
        };

        const { id: _drop, ...payload } = product;
        await productsApi.create({ ...payload, id } as unknown as Record<string, unknown>);
        made.push({ product });
        setSaving({ done: i + 1, total: ready.length });
      }
      setCreated(made);
      onSaved();
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err ?? '');
      setError(
        `${made.length} of ${ready.length} saved before this failed: ${raw}. ` +
        'The ones already saved are in Products with their barcodes; close this and re-enter the rest.',
      );
      if (made.length) {
        setCreated(made);
        onSaved();
      }
    } finally {
      setSaving(null);
    }
  };

  const printBatch = async () => {
    try {
      const products = created.map(c => c.product);
      if (isThermal(labelDesignId)) {
        const size = thermalById(labelDesignId);
        for (const p of products) {
          await downloadThermalLabel(p, { size });
          await new Promise(r => window.setTimeout(r, 250));
        }
      } else {
        await printLabels(products, designById(labelDesignId));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not produce the labels.');
    }
  };

  /* ── After saving: the batch and its codes, ready to label ───────────── */
  if (created.length) {
    return (
      <div className="bg-white rounded-md max-w-3xl w-full mx-auto max-h-[90vh] overflow-y-auto shadow-2xl border border-[color:var(--color-myntra-border-soft)]">
        <div className="px-5 py-4 border-b border-[color:var(--color-myntra-border-soft)] flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-[color:var(--color-myntra-green)] shrink-0 mt-0.5" />
            <div>
              <h2 className="text-[18px] font-extrabold text-[color:var(--color-myntra-navy)]">
                {created.length} product{created.length === 1 ? '' : 's'} added
              </h2>
              <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)]">
                All drafts — in stock and sellable at the counter. Add the photo and the copy on each
                to put it on the website.
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1"><X className="w-5 h-5" /></button>
        </div>

        {error && (
          <p role="alert" className="mx-5 mt-4 text-[12px] text-[#A12626] flex items-start gap-1.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-px" /> {error}
          </p>
        )}

        <div className="p-5 space-y-2" role="list" aria-label="Barcodes for this batch">
          {created.map(({ product }) => (
            <div key={product.id} role="listitem" className="flex items-center gap-3 border border-[color:var(--color-myntra-border-soft)] rounded p-2.5">
              <div
                className="w-[120px] shrink-0 [&>svg]:block [&>svg]:w-full [&>svg]:h-auto"
                dangerouslySetInnerHTML={{ __html: code128Svg(product.barcode as string, { height: 9 }) }}
              />
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-[color:var(--color-myntra-navy)] line-clamp-1">{product.name}</div>
                <div className="text-[11px] text-[color:var(--color-myntra-ink-mute)]">
                  {product.masterCategory}{product.subCategory ? ` · ${product.subCategory}` : ''}
                </div>
                <div className="text-[11px] font-mono text-[#5C3A8E]">{product.barcode}</div>
              </div>
              <div className="ml-auto text-right whitespace-nowrap">
                <div className="text-[13px] font-bold">₹{product.price.toLocaleString('en-IN')}</div>
                <div className="text-[11px] text-[color:var(--color-myntra-ink-mute)]">{product.stock ?? 0} in stock</div>
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-4 border-t border-[color:var(--color-myntra-border-soft)] flex flex-col sm:flex-row gap-2 sm:items-center">
          <select
            value={labelDesignId}
            onChange={e => setLabelDesignId(e.target.value)}
            aria-label="Label design"
            className="input-box w-full sm:w-[190px]"
          >
            <optgroup label="Sheet labels (A4)">
              {LABEL_DESIGNS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </optgroup>
            <optgroup label="Thermal printer">
              {THERMAL_SIZES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </optgroup>
          </select>
          <button onClick={printBatch} className="btn-primary inline-flex items-center justify-center gap-2">
            <Tag className="w-4 h-4" />
            {isThermal(labelDesignId) ? 'Save' : 'Print'} {created.length} label{created.length === 1 ? '' : 's'}
          </button>
          <button onClick={onClose} className="btn-outline sm:ml-auto">Done</button>
        </div>
      </div>
    );
  }

  /* ── The grid ─────────────────────────────────────────────────────────── */
  const th = 'pb-2 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[color:var(--color-myntra-ink-mute)] text-left';

  return (
    <div className="bg-white rounded-md max-w-[1100px] w-full mx-auto max-h-[90vh] overflow-y-auto shadow-2xl border border-[color:var(--color-myntra-border-soft)]">
      <div className="px-5 py-4 border-b border-[color:var(--color-myntra-border-soft)] flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-extrabold text-[color:var(--color-myntra-navy)]">Add a batch</h2>
          <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] max-w-2xl">
            A delivery at a time, mixed categories and all. Everything except the photograph and the
            description — each row is saved as a draft with its own barcode, and you can print the
            labels for exactly this batch on the next screen.
          </p>
        </div>
        <button onClick={onClose} aria-label="Close" className="p-1"><X className="w-5 h-5" /></button>
      </div>

      {/* Defaults for whatever a row leaves blank. */}
      <div className="px-5 py-4 bg-[color:var(--color-myntra-bg-soft)]">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--color-myntra-ink-mute)] mb-2">
          Applies to rows that leave it blank
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <label className="block">
            <span className="block text-[11px] text-[color:var(--color-myntra-ink-soft)] mb-1">Brand</span>
            <input value={brand} onChange={e => setBrand(e.target.value)} aria-label="Batch brand" className="input-box w-full" />
          </label>
          <label className="block">
            <span className="block text-[11px] text-[color:var(--color-myntra-ink-soft)] mb-1">Category</span>
            <select value={category} onChange={e => setCategory(e.target.value)} aria-label="Batch category" className="input-box w-full">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-[11px] text-[color:var(--color-myntra-ink-soft)] mb-1">Sub category</span>
            <input value={subCategory} onChange={e => setSubCategory(e.target.value)} placeholder="optional" aria-label="Batch sub category" className="input-box w-full" />
          </label>
          <label className="block">
            <span className="block text-[11px] text-[color:var(--color-myntra-ink-soft)] mb-1">Material</span>
            <input value={material} onChange={e => setMaterial(e.target.value)} placeholder="Silk, Net…" aria-label="Batch material" className="input-box w-full" />
          </label>
          <label className="block">
            <span className="block text-[11px] text-[color:var(--color-myntra-ink-soft)] mb-1">Supplier</span>
            <input value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="optional" aria-label="Batch supplier" className="input-box w-full" />
          </label>
          <label className="block">
            <span className="block text-[11px] text-[color:var(--color-myntra-ink-soft)] mb-1">Sold as</span>
            <select value={unitType} onChange={e => setUnitType(e.target.value)} aria-label="Batch unit type" className="input-box w-full">
              <option value="">Unit</option>
              <option value="per meter">Per meter</option>
              <option value="bundle">Bundle</option>
            </select>
          </label>
        </div>
      </div>

      <div className="px-5 pt-4">
        <button onClick={() => setPasteOpen(v => !v)} className="btn-outline !py-1.5 !px-3 text-[12px] inline-flex items-center gap-1.5">
          <ClipboardPaste className="w-3.5 h-3.5" /> {pasteOpen ? 'Hide paste box' : 'Paste from a spreadsheet'}
        </button>
        {pasteOpen && (
          <div className="mt-2">
            <textarea
              ref={pasteRef}
              rows={6}
              aria-label="Paste rows"
              placeholder={'Paste with a header row and the columns are matched by NAME, in any order:\nName\tCategory\tSub Category\tSupplier Code\tBuying Price\tSelling Price\tMRP\tStock\n\nNo header? Then the order is: Name, Category, Sub Category, Price, MRP, Stock'}
              className="input-box w-full font-mono text-[12px]"
            />
            <div className="flex flex-wrap gap-2 mt-2">
              <button onClick={applyPaste} className="btn-primary !py-1.5 !px-3 text-[12px]">Add these rows</button>
              <span className="text-[11px] text-[color:var(--color-myntra-ink-soft)] self-center max-w-xl">
                Copy the columns straight out of Excel — tabs or commas both work. Keep the header row
                and the order does not matter.
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="p-5 overflow-x-auto">
        <table className="w-full text-[13px] min-w-[900px]">
          <thead>
            <tr>
              <th className={`${th} w-8`}>#</th>
              <th className={`${th} min-w-[200px]`}>Product name *</th>
              <th className={`${th} w-[130px]`}>Category</th>
              <th className={`${th} w-[120px]`}>Sub category</th>
              <th className={`${th} w-[100px]`}>Code</th>
              <th className={`${th} w-[86px]`}>Cost ₹</th>
              <th className={`${th} w-[86px]`}>Price ₹ *</th>
              <th className={`${th} w-[86px]`}>MRP ₹</th>
              <th className={`${th} w-[70px]`}>Stock</th>
              <th className={`${th} w-[92px]`}>Sold as</th>
              <th className={`${th} w-8`} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const subs = MASTER_CATEGORY_TREE[(r.category || category) as keyof typeof MASTER_CATEGORY_TREE] ?? [];
              return (
                <tr key={i}>
                  <td className="py-1 text-[11px] text-[color:var(--color-myntra-ink-mute)]">{i + 1}</td>
                  <td className="py-1 pr-2">
                    <input value={r.name} onChange={e => setRow(i, { name: e.target.value })}
                      placeholder="Ivory Pearl Bouquet Border" aria-label={`Name, row ${i + 1}`} className="input-box w-full" />
                  </td>
                  <td className="py-1 pr-2">
                    <select value={r.category} onChange={e => setRow(i, { category: e.target.value, subCategory: '' })}
                      aria-label={`Category, row ${i + 1}`} className="input-box w-full">
                      <option value="">{category}</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="py-1 pr-2">
                    {/* A list of the known names, but typing a new one is allowed —
                        the storefront menus are built from what the catalogue
                        actually contains, so a new design name appears on its own. */}
                    <input value={r.subCategory} onChange={e => setRow(i, { subCategory: e.target.value })}
                      list={`subs-${i}`} placeholder={subCategory || '—'} aria-label={`Sub category, row ${i + 1}`} className="input-box w-full" />
                    <datalist id={`subs-${i}`}>
                      {subs.map(sub => <option key={sub} value={sub} />)}
                    </datalist>
                  </td>
                  <td className="py-1 pr-2">
                    <input value={r.code} onChange={e => setRow(i, { code: e.target.value })}
                      placeholder="HA6758" aria-label={`Supplier code, row ${i + 1}`} className="input-box w-full" />
                  </td>
                  <td className="py-1 pr-2">
                    <input value={r.cost} onChange={e => setRow(i, { cost: e.target.value })}
                      inputMode="numeric" aria-label={`Cost, row ${i + 1}`} className="input-box w-full" />
                  </td>
                  <td className="py-1 pr-2">
                    <input value={r.price} onChange={e => setRow(i, { price: e.target.value })}
                      inputMode="numeric" aria-label={`Price, row ${i + 1}`} className="input-box w-full" />
                  </td>
                  <td className="py-1 pr-2">
                    <input value={r.mrp} onChange={e => setRow(i, { mrp: e.target.value })}
                      inputMode="numeric" placeholder="= price" aria-label={`MRP, row ${i + 1}`} className="input-box w-full" />
                  </td>
                  <td className="py-1 pr-2">
                    <input value={r.stock} onChange={e => setRow(i, { stock: e.target.value })}
                      inputMode="numeric" placeholder="0" aria-label={`Stock, row ${i + 1}`} className="input-box w-full" />
                  </td>
                  <td className="py-1 pr-2">
                    <select value={r.unit} onChange={e => setRow(i, { unit: e.target.value })}
                      aria-label={`Sold as, row ${i + 1}`} className="input-box w-full">
                      <option value="">{unitType || 'Unit'}</option>
                      <option value="unit">Unit</option>
                      <option value="per meter">Per meter</option>
                      <option value="bundle">Bundle</option>
                    </select>
                  </td>
                  <td className="py-1">
                    <button
                      onClick={() => setRows(prev => (prev.length > 1 ? prev.filter((_, j) => j !== i) : [blankRow()]))}
                      aria-label={`Remove row ${i + 1}`}
                      className="text-[color:var(--color-myntra-ink-mute)] hover:text-[#A12626]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <button
          onClick={() => setRows(prev => [...prev, ...Array.from({ length: 5 }, blankRow)])}
          className="btn-outline !py-1.5 !px-3 text-[12px] inline-flex items-center gap-1.5 mt-3"
        >
          <Plus className="w-3.5 h-3.5" /> 5 more rows
        </button>
      </div>

      {(error || unknownCategories.length > 0) && (
        <div className="mx-5 mb-3 space-y-1">
          {error && (
            <p role="alert" className="text-[12px] text-[#A12626] flex items-start gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-px" /> {error}
            </p>
          )}
          {unknownCategories.length > 0 && (
            <p className="text-[12px] text-[#9A5B12] flex items-start gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
              Not a known category: {unknownCategories.join(', ')}. Pasted values have to match one of
              the eight exactly, or the piece will not appear under any menu.
            </p>
          )}
        </div>
      )}

      <div className="px-5 py-4 border-t border-[color:var(--color-myntra-border-soft)] flex flex-col sm:flex-row gap-2 sm:items-center">
        <span className="text-[12px] text-[color:var(--color-myntra-ink-soft)]">
          <b className="text-[color:var(--color-myntra-navy)]">{ready.length}</b> ready to add
          {incomplete > 0 && <> · {incomplete} row{incomplete === 1 ? '' : 's'} need a name and a price</>}
        </span>
        <div className="sm:ml-auto flex gap-2">
          <button onClick={onClose} disabled={Boolean(saving)} className="btn-outline">Cancel</button>
          <button
            onClick={save}
            disabled={!ready.length || Boolean(saving)}
            className="btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding {saving.done}/{saving.total}…</>
              : `Add ${ready.length} product${ready.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BatchAddProducts;
