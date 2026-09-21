/**
 * Admin -> Supplier Intake — review what a consignment partner sent, and turn
 * it into real products.
 *
 * The import is the whole point of this screen. Everything a supplier typed is
 * unverified text until an admin agrees to it, so nothing reaches `products`
 * until someone presses the button here. What the button does is exactly what
 * Batch Add does — mint a barcode, create one product per colourway, carry the
 * style code so the colours group — with the one difference that the
 * photographs arrive already attached, which is the manual step this whole
 * feature exists to remove.
 *
 * Imported products are still created as DRAFTS. A photograph existing is not
 * the same as a photograph being good enough for the storefront, and the
 * decision to publish stays with the studio.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Inbox, Loader2, AlertCircle, CheckCircle2, Trash2, PackagePlus, ChevronDown, ChevronRight,
} from 'lucide-react';
import { intakeApi, productsApi } from '../../lib/firebase';
import { reserveBarcode } from '../../lib/barcodeAssign';
import { placeholderSwatch } from '../../lib/swatch';
import { formatINR } from '../../constants';
import type { Fabric, IntakeSubmission } from '../../types';

const num = (v: string): number | undefined => {
  const n = Number(String(v).replace(/[₹,\s]/g, ''));
  return v.trim() !== '' && Number.isFinite(n) ? n : undefined;
};

const newId = (name: string): string => {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 6);
  return slug ? `${slug}-${suffix}` : `p-${Date.now().toString(36)}-${suffix}`;
};

/** Colours worth importing: a blank spare row the supplier never filled is not
 *  a product, and creating one would burn a barcode on nothing. */
const realColours = (s: IntakeSubmission) =>
  s.colours.filter(c => c.colourName.trim() && num(c.price) !== undefined);

const STATUS_STYLE: Record<IntakeSubmission['status'], string> = {
  draft: 'bg-[color:var(--color-myntra-bg-soft)] text-[color:var(--color-myntra-ink-soft)]',
  submitted: 'bg-[color:var(--color-myntra-bg-sale)] text-[color:var(--color-myntra-ink)]',
  imported: 'bg-[color:var(--color-myntra-green)] text-white',
};
const STATUS_LABEL: Record<IntakeSubmission['status'], string> = {
  draft: 'Supplier still editing',
  submitted: 'Ready to review',
  imported: 'Imported',
};

const AdminIntake: React.FC = () => {
  const [rows, setRows] = useState<IntakeSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [importing, setImporting] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const all = await intakeApi.all();
      setRows(all as unknown as IntakeSubmission[]);
      setError(null);
    } catch {
      setError('Could not load the intake queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 5000);
    return () => window.clearTimeout(t);
  }, [flash]);

  const waiting = useMemo(() => rows.filter(r => r.status === 'submitted').length, [rows]);

  const importOne = async (s: IntakeSubmission) => {
    const colours = realColours(s);
    if (!colours.length) {
      setError('Nothing to import: no colour has both a name and a price.');
      return;
    }
    setImporting(s.id);
    setError(null);
    setProgress({ done: 0, total: colours.length });
    const created: string[] = [];
    try {
      // Bundle terms only count when BOTH halves are present. Half a break is
      // not a break, and lacePricing would silently charge the loose per-metre
      // rate for every metre of a nine-metre bundle.
      const bSize = s.unitType === 'bundle' ? num(s.bundleSizeMeters) : undefined;
      const bPrice = s.unitType === 'bundle' ? num(s.bundlePrice) : undefined;
      const hasBreak = bSize !== undefined && bSize > 0 && bPrice !== undefined && bPrice > 0;

      for (const [i, c] of colours.entries()) {
        // Sequential, so two colours cannot contend for the barcode counter and
        // a failure halfway leaves everything before it genuinely saved.
        const barcode = await reserveBarcode();
        const id = newId(`${s.designName} ${c.colourName}`);
        const price = num(c.price) ?? 0;
        const mrp = num(c.mrp) ?? price;
        const cat = s.category as Fabric['category'];
        const photo = c.photos[0] ?? placeholderSwatch(id, s.designName, cat);

        const product: Fabric = {
          id,
          brand: 'TRESOR',
          name: s.designName.trim(),
          description: s.notes.trim(),
          price,
          mrp: Math.max(mrp, price),
          photo,
          image: photo,
          ...(c.photos.length > 1 ? { photoGallery: c.photos.slice(1) } : {}),
          category: cat,
          masterCategory: cat,
          ...(s.subCategory.trim() ? { subCategory: s.subCategory.trim() } : {}),
          ...(s.unitType ? { unitType: s.unitType as Fabric['unitType'] } : {}),
          ...(hasBreak ? { bundleSizeMeters: bSize, bundlePrice: bPrice } : {}),
          ...(s.styleCode.trim() ? { styleCode: s.styleCode.trim().toUpperCase() } : {}),
          colourName: c.colourName.trim(),
          ...(num(c.cost) !== undefined ? { costPrice: num(c.cost) } : {}),
          tags: [cat, ...(s.subCategory.trim() ? [s.subCategory.trim()] : [])],
          stock: num(c.stock) ?? 0,
          barcode,
          // A photograph arriving is not the same as it being fit to publish.
          // The studio decides that in Admin -> Products.
          listingStatus: 'Draft',
        };

        const { id: _drop, ...payload } = product;
        await productsApi.create({ ...payload, id } as unknown as Record<string, unknown>);
        created.push(id);
        setProgress({ done: i + 1, total: colours.length });
      }

      await intakeApi.update(s.id, {
        status: 'imported',
        importedAt: new Date().toISOString(),
        importedProductIds: created,
      });
      setRows(prev => prev.map(r => (r.id === s.id
        ? { ...r, status: 'imported', importedAt: new Date().toISOString(), importedProductIds: created }
        : r)));
      setFlash(`${created.length} product${created.length === 1 ? '' : 's'} created from "${s.designName}" — as Drafts, in Products.`);
    } catch (e) {
      // Say how far it got: the products already created are real, and an admin
      // who thinks nothing happened will import the whole design a second time.
      setError(
        `Import stopped after ${created.length} of ${colours.length}. Those ${created.length} exist in Products as drafts; `
        + `remove them before trying again. (${e instanceof Error ? e.message : 'unknown error'})`,
      );
    } finally {
      setImporting(null);
      setProgress(null);
    }
  };

  const removeOne = async (s: IntakeSubmission) => {
    try {
      await intakeApi.remove(s.id);
      setRows(prev => prev.filter(r => r.id !== s.id));
    } catch {
      setError('Could not remove that submission.');
    }
  };

  if (loading) {
    return (
      <div className="py-16 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[color:var(--color-myntra-pink)]" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-2">
        <Inbox className="w-5 h-5 text-[color:var(--color-myntra-pink)]" />
        <h1 className="text-[16px] font-extrabold uppercase tracking-[0.1em] text-[color:var(--color-myntra-navy)]">
          Supplier Intake
        </h1>
        <span className="text-[12px] text-[color:var(--color-myntra-ink-soft)]">
          {waiting} waiting to review · {rows.length} total
        </span>
      </header>

      {flash && (
        <p className="text-[12px] text-[color:var(--color-myntra-green)] flex items-center gap-1.5 font-semibold">
          <CheckCircle2 className="w-4 h-4" /> {flash}
        </p>
      )}
      {error && (
        <p role="alert" className="text-[12px] text-[#A12626] flex items-start gap-1.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-px" /> {error}
        </p>
      )}

      {rows.length === 0 && (
        <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] py-8">
          Nothing submitted yet. Suppliers fill this in at <b>/supplier</b> once you grant them access with{' '}
          <code className="text-[11px]">npm run set-supplier -- their@email</code>.
        </p>
      )}

      <div className="space-y-3">
        {rows.map(s => {
          const colours = realColours(s);
          const isOpen = open[s.id] ?? s.status === 'submitted';
          return (
            <section key={s.id} className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-lg overflow-hidden">
              <header className="px-4 py-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(p => ({ ...p, [s.id]: !isOpen }))}
                  aria-expanded={isOpen}
                  className="flex items-center gap-2 text-left"
                >
                  {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <span className="text-[14px] font-extrabold text-[color:var(--color-myntra-navy)]">
                    {s.designName || '(unnamed design)'}
                  </span>
                </button>
                <span className="text-[11px] text-[color:var(--color-myntra-ink-soft)]">
                  {s.category}{s.subCategory ? ` · ${s.subCategory}` : ''} · {colours.length} colour{colours.length === 1 ? '' : 's'}
                  {s.styleCode ? ` · ${s.styleCode}` : ''}
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${STATUS_STYLE[s.status]}`}>
                  {STATUS_LABEL[s.status]}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  {s.status !== 'imported' && (
                    <button
                      type="button"
                      onClick={() => void importOne(s)}
                      disabled={importing !== null || colours.length === 0}
                      className="btn-primary !py-1.5 !px-3 text-[12px] inline-flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {importing === s.id && progress
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {progress.done}/{progress.total}</>
                        : <><PackagePlus className="w-3.5 h-3.5" /> Create {colours.length} product{colours.length === 1 ? '' : 's'}</>}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void removeOne(s)}
                    disabled={importing !== null}
                    aria-label={`Delete submission ${s.designName}`}
                    className="text-[color:var(--color-myntra-ink-mute)] hover:text-[#A12626] disabled:opacity-40"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </header>

              {isOpen && (
                <div className="px-4 pb-4 border-t border-[color:var(--color-myntra-border-soft)] pt-3 space-y-3">
                  {s.unitType && (
                    <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)]">
                      Sold as <b>{s.unitType}</b>
                      {s.unitType === 'bundle' && s.bundleSizeMeters && s.bundlePrice
                        ? ` · ${s.bundleSizeMeters}m bundle at ${formatINR(num(s.bundlePrice) ?? 0)}`
                        : s.unitType === 'bundle'
                        ? ' · bundle terms incomplete, so no price break will be applied'
                        : ''}
                    </p>
                  )}
                  {s.notes && (
                    <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] bg-[color:var(--color-myntra-bg-soft)] rounded-md px-3 py-2">
                      {s.notes}
                    </p>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full text-[12px] min-w-[560px]">
                      <thead>
                        <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-[color:var(--color-myntra-ink-mute)]">
                          <th className="pb-2 pr-3">Photos</th>
                          <th className="pb-2 pr-3">Colour</th>
                          <th className="pb-2 pr-3">Cost</th>
                          <th className="pb-2 pr-3">Price</th>
                          <th className="pb-2 pr-3">MRP</th>
                          <th className="pb-2">Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.colours.map((c, i) => (
                          <tr key={i} className="border-t border-[color:var(--color-myntra-border-soft)]">
                            <td className="py-2 pr-3">
                              <div className="flex gap-1">
                                {c.photos.length === 0 && (
                                  <span className="text-[11px] text-[#9A5B12]">no photo</span>
                                )}
                                {c.photos.map((p, j) => (
                                  <img key={j} src={p} alt={`${c.colourName} ${j + 1}`}
                                    className="w-10 h-12 object-cover rounded border border-[color:var(--color-myntra-border-soft)]" />
                                ))}
                              </div>
                            </td>
                            <td className="py-2 pr-3 font-semibold text-[color:var(--color-myntra-navy)]">
                              {c.colourName || <span className="text-[color:var(--color-myntra-ink-mute)]">—</span>}
                            </td>
                            <td className="py-2 pr-3 tabular-nums">{c.cost || '—'}</td>
                            <td className="py-2 pr-3 tabular-nums">{c.price || '—'}</td>
                            <td className="py-2 pr-3 tabular-nums">{c.mrp || '—'}</td>
                            <td className="py-2 tabular-nums">{c.stock || '0'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {s.colours.length !== colours.length && (
                    <p className="text-[11px] text-[#9A5B12] flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
                      {s.colours.length - colours.length} row{s.colours.length - colours.length === 1 ? '' : 's'} will be
                      skipped — a colour needs both a name and a price to become a product.
                    </p>
                  )}
                  {s.status === 'imported' && (
                    <p className="text-[11px] text-[color:var(--color-myntra-ink-soft)]">
                      Imported {s.importedAt ? new Date(s.importedAt).toLocaleString() : ''} ·{' '}
                      {s.importedProductIds?.length ?? 0} product(s). Find them under Products, filtered to Drafts.
                    </p>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default AdminIntake;
