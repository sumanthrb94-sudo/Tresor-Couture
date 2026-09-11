import React, { useMemo, useState } from 'react';
import { ImageIcon, ImageOff, ScanLine, AlertTriangle } from 'lucide-react';
import FabricImage from '../../components/FabricImage';
import { awaitingPhoto, isListed } from '../../lib/availability';
import type { Fabric } from '../../types';

/**
 * Photos & codes — the catalogue split by what each piece actually has.
 *
 * Two questions the product grid could not answer, because it interleaves
 * everything into one list:
 *
 *   1. Which pieces are photographed and which are not? The studio is deciding
 *      which photographs to replace, and that decision needs the two sets side
 *      by side, not a filter you toggle back and forth.
 *   2. Which pieces carry a scan code? A barcode is allocated by the system
 *      when a piece is registered through the admin, so a piece WITHOUT one was
 *      never entered that way — it was seeded. That makes the code the honest
 *      marker of a real, stocked piece, which is why it is counted here per
 *      category rather than left to be discovered one row at a time.
 *
 * The counts are over the whole catalogue on purpose. A summary that moved
 * with the search box would answer "how much of what I am looking at", which is
 * not the question — the question is what the shop holds.
 */

interface Props {
  rows: Fabric[];
  onEdit: (f: Fabric) => void;
}

interface CatRow {
  category: string;
  total: number;
  withImage: number;
  noImage: number;
  withCode: number;
  noCode: number;
}

const hasCode = (f: Fabric): boolean => Boolean((f.barcode ?? '').trim());
const hasImage = (f: Fabric): boolean => !awaitingPhoto(f);

const Tile: React.FC<{
  label: string;
  value: number;
  Icon: React.ComponentType<{ className?: string }>;
  tone?: 'plain' | 'warn';
  hint?: string;
}> = ({ label, value, Icon, tone = 'plain', hint }) => (
  <div
    title={hint}
    data-testid={`audit-tile-${label.toLowerCase().replace(/\s+/g, '-')}`}
    className={`border rounded p-3 ${
      tone === 'warn'
        ? 'border-[#F0D9B5] bg-[#FDF0E1]'
        : 'border-[color:var(--color-myntra-border-soft)] bg-white'
    }`}
  >
    <div className="flex items-center gap-1.5 text-[color:var(--color-myntra-ink-mute)]">
      <Icon className="w-3.5 h-3.5" />
      <span className="text-[10px] font-extrabold uppercase tracking-[0.1em]">{label}</span>
    </div>
    <div
      data-testid={`audit-value-${label.toLowerCase().replace(/\s+/g, '-')}`}
      className="mt-1 text-[22px] font-extrabold leading-none text-[color:var(--color-myntra-navy)]"
    >
      {value}
    </div>
  </div>
);

/** One product line, used in both columns. */
const Line: React.FC<{ f: Fabric; onEdit: (f: Fabric) => void }> = ({ f, onEdit }) => (
  <li>
    <button
      type="button"
      onClick={() => onEdit(f)}
      className="w-full text-left flex items-center gap-2.5 p-2 rounded hover:bg-[color:var(--color-myntra-bg-soft)]"
    >
      <div className="w-10 h-12 rounded overflow-hidden border border-[color:var(--color-myntra-border-soft)] bg-[color:var(--color-myntra-bg-soft)] shrink-0">
        <FabricImage
          photo={f.photo}
          fallback={f.image ?? f.photo}
          alt={f.name}
          loading="lazy"
          className="w-full h-full object-cover object-top"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-semibold text-[color:var(--color-myntra-navy)] truncate">
          {f.name}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
          <span className="text-[10px] text-[color:var(--color-myntra-ink-mute)]">{f.category}</span>
          {hasCode(f) ? (
            <span className="text-[10px] font-mono text-[#5C3A8E]">{f.barcode}</span>
          ) : (
            // Not a neutral absence: every piece registered through the admin
            // gets a code, so a missing one means this was never registered.
            <span className="text-[10px] font-bold text-[#9A5B12] bg-[#FDF0E1] border border-[#F0D9B5] rounded px-1">
              no scan code
            </span>
          )}
          {!isListed(f) && (
            <span className="text-[10px] font-bold text-[color:var(--color-myntra-ink-mute)]">Draft</span>
          )}
        </div>
      </div>
    </button>
  </li>
);

const Column: React.FC<{
  title: string;
  Icon: React.ComponentType<{ className?: string }>;
  items: Fabric[];
  onEdit: (f: Fabric) => void;
  empty: string;
  testId: string;
}> = ({ title, Icon, items, onEdit, empty, testId }) => {
  const coded = items.filter(hasCode).length;
  return (
    <section className="border border-[color:var(--color-myntra-border-soft)] rounded bg-white flex flex-col min-h-0">
      <header className="px-3 py-2.5 border-b border-[color:var(--color-myntra-border-soft)] bg-[color:var(--color-myntra-bg-soft)]">
        <h3 className="text-[13px] font-extrabold text-[color:var(--color-myntra-navy)] flex items-center gap-1.5">
          <Icon className="w-4 h-4" /> {title}
          <span
            data-testid={testId}
            className="ml-auto text-[12px] font-bold text-[color:var(--color-myntra-ink-mute)]"
          >
            {items.length}
          </span>
        </h3>
        <p className="text-[11px] text-[color:var(--color-myntra-ink-mute)] mt-0.5">
          {coded} with a scan code
          {items.length - coded > 0 && ` · ${items.length - coded} without`}
        </p>
      </header>
      {items.length === 0 ? (
        <p className="p-4 text-[12px] text-[color:var(--color-myntra-ink-mute)]">{empty}</p>
      ) : (
        <ul className="p-1.5 overflow-y-auto max-h-[560px]">
          {items.map(f => (
            <Line key={f.id} f={f} onEdit={onEdit} />
          ))}
        </ul>
      )}
    </section>
  );
};

const ProductAudit: React.FC<Props> = ({ rows, onEdit }) => {
  const [cat, setCat] = useState<string>('all');
  const [onlyNoCode, setOnlyNoCode] = useState(false);

  const byCategory = useMemo<CatRow[]>(() => {
    const m = new Map<string, CatRow>();
    for (const f of rows) {
      const key = f.masterCategory || f.category || '—';
      const r = m.get(key) ?? { category: key, total: 0, withImage: 0, noImage: 0, withCode: 0, noCode: 0 };
      r.total += 1;
      if (hasImage(f)) r.withImage += 1; else r.noImage += 1;
      if (hasCode(f)) r.withCode += 1; else r.noCode += 1;
      m.set(key, r);
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [rows]);

  const totals = useMemo(
    () => ({
      total: rows.length,
      withImage: rows.filter(hasImage).length,
      noImage: rows.filter(f => !hasImage(f)).length,
      withCode: rows.filter(hasCode).length,
      noCode: rows.filter(f => !hasCode(f)).length,
    }),
    [rows],
  );

  const shown = useMemo(() => {
    let list = rows;
    if (cat !== 'all') list = list.filter(f => (f.masterCategory || f.category) === cat);
    if (onlyNoCode) list = list.filter(f => !hasCode(f));
    return list;
  }, [rows, cat, onlyNoCode]);

  const withImages = useMemo(
    () => shown.filter(hasImage).sort((a, b) => a.name.localeCompare(b.name)),
    [shown],
  );
  const withoutImages = useMemo(
    () => shown.filter(f => !hasImage(f)).sort((a, b) => a.name.localeCompare(b.name)),
    [shown],
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
        <Tile label="Products" value={totals.total} Icon={ScanLine} />
        <Tile label="With image" value={totals.withImage} Icon={ImageIcon} />
        <Tile label="No image" value={totals.noImage} Icon={ImageOff} />
        <Tile label="Scan code" value={totals.withCode} Icon={ScanLine} hint="Registered through the admin — a code was allocated" />
        <Tile
          label="No scan code"
          value={totals.noCode}
          Icon={AlertTriangle}
          tone={totals.noCode ? 'warn' : 'plain'}
          hint="Never registered through the admin, so no code was allocated — these are seeded pieces"
        />
      </div>

      {totals.noCode > 0 && (
        <div className="border border-[#F0D9B5] bg-[#FDF0E1] rounded p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#9A5B12]" />
          <p className="text-[12px] text-[#9A5B12] leading-relaxed">
            <span className="font-bold">{totals.noCode} pieces carry no scan code.</span>{' '}
            Every piece registered through the admin is allocated one, so these were never entered
            that way — they came from the seed catalogue. Use “Only pieces with no scan code” below
            to see exactly which.
          </p>
        </div>
      )}

      <section className="border border-[color:var(--color-myntra-border-soft)] rounded bg-white overflow-hidden">
        <h3 className="px-3 py-2.5 text-[13px] font-extrabold text-[color:var(--color-myntra-navy)] border-b border-[color:var(--color-myntra-border-soft)] bg-[color:var(--color-myntra-bg-soft)]">
          By category
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="text-[color:var(--color-myntra-ink-mute)] border-b border-[color:var(--color-myntra-border-soft)]">
              <tr className="text-left">
                <th className="px-3 py-2 font-bold">Category</th>
                <th className="px-3 py-2 font-bold text-right">Total</th>
                <th className="px-3 py-2 font-bold text-right">With image</th>
                <th className="px-3 py-2 font-bold text-right">No image</th>
                <th className="px-3 py-2 font-bold text-right">Scan code</th>
                <th className="px-3 py-2 font-bold text-right">No code</th>
              </tr>
            </thead>
            <tbody>
              {byCategory.map(r => (
                <tr
                  key={r.category}
                  className="border-b border-[color:var(--color-myntra-border-soft)] last:border-0 hover:bg-[color:var(--color-myntra-bg-soft)] cursor-pointer"
                  onClick={() => setCat(c => (c === r.category ? 'all' : r.category))}
                >
                  <td className="px-3 py-2 font-semibold text-[color:var(--color-myntra-navy)]">
                    {r.category}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.total}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.withImage}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[color:var(--color-myntra-ink-mute)]">
                    {r.noImage || '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.withCode}</td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums font-bold ${
                      r.noCode ? 'text-[#9A5B12]' : 'text-[color:var(--color-myntra-ink-mute)]'
                    }`}
                  >
                    {r.noCode || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-3 py-2 text-[11px] text-[color:var(--color-myntra-ink-mute)] border-t border-[color:var(--color-myntra-border-soft)]">
          Tap a row to filter the two lists below to that category.
        </p>
      </section>

      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={cat}
          onChange={e => setCat(e.target.value)}
          className="input-box w-full sm:w-[200px]"
        >
          <option value="all">All categories</option>
          {byCategory.map(r => (
            <option key={r.category} value={r.category}>
              {r.category} ({r.total})
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-[12px] font-semibold text-[color:var(--color-myntra-ink)]">
          <input type="checkbox" checked={onlyNoCode} onChange={e => setOnlyNoCode(e.target.checked)} />
          Only pieces with no scan code
        </label>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <Column
          title="With images"
          Icon={ImageIcon}
          items={withImages}
          onEdit={onEdit}
          empty="Nothing photographed in this selection."
          testId="audit-count-with-images"
        />
        <Column
          title="Without images"
          Icon={ImageOff}
          items={withoutImages}
          onEdit={onEdit}
          empty="Everything here is photographed."
          testId="audit-count-without-images"
        />
      </div>

      <p className="text-[11px] text-[color:var(--color-myntra-ink-mute)] leading-relaxed">
        Tap any piece to open it in the product editor. A piece counts as photographed when it has a
        real image — the generated swatch shown for unphotographed pieces does not count.
      </p>
    </div>
  );
};

export default ProductAudit;
