import React, { useEffect, useMemo, useState } from 'react';
import { Boxes, Minus, Plus, Search, Filter, Download, AlertCircle, Check, PackageX, Tag, Barcode } from 'lucide-react';
import { productsApi } from '../../lib/firebase';
import { CATEGORIES, formatINR } from '../../constants';
import { toCsv, downloadCsv } from '../../lib/csv';
import { printLabels, labelableProducts } from '../../admin/printLabels';
import { awaitingPhoto } from '../../lib/availability';
import { reserveBarcode } from '../../lib/barcodeAssign';
import FabricImage from '../../components/FabricImage';
import type { Fabric } from '../../types';

const LOW_STOCK = 10;

type StockFilter = 'all' | 'low' | 'out' | 'in';
type CatFilter = Fabric['category'] | 'all';
type ListingFilter = 'all' | 'Active' | 'Draft' | 'Retired';

/** Absent means Active — every product written before the field existed is live. */
const listingOf = (f: Fabric): NonNullable<Fabric['listingStatus']> => f.listingStatus ?? 'Active';

const LISTING_CLS: Record<NonNullable<Fabric['listingStatus']>, string> = {
  Active: 'bg-[#E8F2E8] text-[#2F6E2F] border-[#C9DFC9]',
  Draft: 'bg-[#FDF0E1] text-[#9A5B12] border-[#F0D9B5]',
  Retired: 'bg-[#EFEFEF] text-[#5A5A5A] border-[#D8D8D8]',
};

const stockStatus = (n: number): { label: string; cls: string } => {
  if (n <= 0) return { label: 'Out of stock', cls: 'bg-[#FBE6E6] text-[#A12626] border-[#F0C7C7]' };
  if (n < LOW_STOCK) return { label: 'Low', cls: 'bg-[#FDF0E1] text-[#9A5B12] border-[#F0D9B5]' };
  return { label: 'In stock', cls: 'bg-[#E8F2E8] text-[#2F6E2F] border-[#C9DFC9]' };
};

const unitLabel = (unitType?: Fabric['unitType']): string => {
  switch (unitType) {
    case 'per meter':
      return 'meter';
    case 'bundle':
      return 'bundle';
    default:
      return 'unit';
  }
};

/* KPI tile — same visual language as the dashboard. */
const Kpi: React.FC<{ label: string; value: string; Icon: React.ComponentType<{ className?: string }>; iconBg: string; iconColor: string; alert?: boolean }> = ({ label, value, Icon, iconBg, iconColor, alert }) => (
  <div className={`bg-white border rounded-md p-4 flex items-center gap-3 ${alert ? 'border-[#F0C7C7]' : 'border-[color:var(--color-myntra-border-soft)]'}`}>
    <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: iconBg }}>
      <Icon className="w-5 h-5" />
    </span>
    <div className="min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] truncate">{label}</p>
      <p className="text-[20px] font-extrabold text-[color:var(--color-myntra-navy)] leading-tight" style={{ color: alert ? '#A12626' : undefined }}>{value}</p>
    </div>
  </div>
);

const AdminInventory: React.FC = () => {
  const [rows, setRows] = useState<Fabric[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [catFilter, setCatFilter] = useState<CatFilter>('all');
  const [listingFilter, setListingFilter] = useState<ListingFilter>('all');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const list = (await productsApi.list({ limit: 500 })) as unknown as Fabric[];
        if (!cancelled) setRows(list);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const kpis = useMemo(() => {
    let units = 0, value = 0, low = 0, out = 0;
    for (const f of rows) {
      const s = f.stock ?? 0;
      units += s;
      value += s * (f.price ?? 0);
      if (s <= 0) out += 1;
      else if (s < LOW_STOCK) low += 1;
    }
    return { skus: rows.length, units, value, low, out };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(f => {
      const s = f.stock ?? 0;
      if (catFilter !== 'all' && f.category !== catFilter) return false;
      if (listingFilter !== 'all' && listingOf(f) !== listingFilter) return false;
      if (stockFilter === 'out' && s > 0) return false;
      if (stockFilter === 'low' && !(s > 0 && s < LOW_STOCK)) return false;
      if (stockFilter === 'in' && s < LOW_STOCK) return false;
      if (!q) return true;
      return f.name.toLowerCase().includes(q) || f.brand.toLowerCase().includes(q);
    });
  }, [rows, query, stockFilter, catFilter, listingFilter]);

  /* Persist a new stock value (optimistic; reverts on failure). */
  const setStock = async (f: Fabric, next: number) => {
    const value = Math.max(0, Math.round(next));
    if (value === (f.stock ?? 0)) return;
    setSavingId(f.id);
    setRows(prev => prev.map(r => (r.id === f.id ? { ...r, stock: value } : r)));
    try {
      await productsApi.update(f.id, { stock: value });
      setSavedId(f.id);
      setTimeout(() => setSavedId(id => (id === f.id ? null : id)), 1200);
    } catch {
      setReloadKey(k => k + 1); // reload truth on failure
    } finally {
      setSavingId(id => (id === f.id ? null : id));
    }
  };

  /**
   * Publish or unpublish a product.
   *
   * This is the other half of the bulk import: a spreadsheet row with no
   * photograph lands as a Draft, and this is where it goes live once the photo
   * is up — without a second import round-trip. It sits in Inventory rather
   * than in the product editor because publishing a shelf of newly-photographed
   * pieces is a list operation, not a per-product edit.
   */
  const setListing = async (f: Fabric, next: NonNullable<Fabric['listingStatus']>) => {
    if (next === listingOf(f)) return;
    setSavingId(f.id);
    setRows(prev => prev.map(r => (r.id === f.id ? { ...r, listingStatus: next } : r)));
    try {
      await productsApi.update(f.id, { listingStatus: next });
      setSavedId(f.id);
      setTimeout(() => setSavedId(id => (id === f.id ? null : id)), 1200);
    } catch {
      setReloadKey(k => k + 1);
    } finally {
      setSavingId(id => (id === f.id ? null : id));
    }
  };

  /**
   * Give every filtered product that lacks a barcode one.
   *
   * New products are barcoded as they are saved, so this is for the backlog:
   * a catalogue that predates the counter, or anything that slipped through.
   * It exists so the answer to "some of these have no barcode" is a button
   * rather than a command line — the studio should never need a terminal to
   * print a price tag.
   *
   * Sequential on purpose. The allocator is one transaction per number, and
   * firing hundreds at a single counter document in parallel would make them
   * contend and retry; a shelf's worth takes a couple of seconds either way.
   */
  const [barcoding, setBarcoding] = useState<{ done: number; total: number } | null>(null);

  const handleGenerateBarcodes = async () => {
    const missing = labelable.missing;
    if (!missing.length || barcoding) return;
    if (!window.confirm(
      `Allocate a barcode for ${missing.length} product${missing.length === 1 ? '' : 's'} that ${missing.length === 1 ? 'does' : 'do'} not have one?\n\n` +
      'Existing barcodes are never changed.',
    )) return;

    setBarcoding({ done: 0, total: missing.length });
    try {
      for (let i = 0; i < missing.length; i++) {
        const barcode = await reserveBarcode();
        await productsApi.update(missing[i].id, { barcode });
        setBarcoding({ done: i + 1, total: missing.length });
      }
    } catch (err) {
      // Partial progress is kept: the products already updated have real,
      // unique barcodes. Re-running picks up where this stopped.
      window.alert(err instanceof Error ? err.message : 'Could not allocate barcodes.');
    } finally {
      setBarcoding(null);
      setReloadKey(k => k + 1);
    }
  };

  // Labels print for whatever the current filters show — the toolbar already
  // has search, stock and category filters, so "filter then print" needs no
  // extra selection UI. Products without a barcode are excluded and reported
  // rather than silently dropped.
  const labelable = useMemo(() => labelableProducts(filtered), [filtered]);

  const handlePrintLabels = async () => {
    if (!labelable.ready.length) return;
    if (labelable.missing.length) {
      const ok = window.confirm(
        `${labelable.missing.length} of the ${filtered.length} filtered products have no barcode yet and will be skipped.\n\n` +
        `Print ${labelable.ready.length} label${labelable.ready.length === 1 ? '' : 's'}?`,
      );
      if (!ok) return;
    }
    try {
      await printLabels(labelable.ready);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not open the print dialog.');
    }
  };

  const exportCsv = () => {
    const headers = [
      'Product ID',
      'Product Code',
      'Product Name',
      'Brand',
      'Category',
      'Unit Type',
      'Bundle Size (meters)',
      'Price per Meter (₹)',
      'Bundle Price (₹)',
      'Price (₹)',
      'Stock',
      'Stock Value (₹)',
      'Status',
      'Barcode',
      'Listing'
    ];
    const data = filtered.map(f => {
      const s = f.stock ?? 0;
      return [
        f.category === 'Laces' ? (f.productCode ?? f.id) : f.id,
        f.productCode ?? '',
        f.name,
        f.brand,
        f.category,
        f.unitType ?? 'unit',
        f.bundleSizeMeters ?? '',
        f.sellingPricePerMeter ?? '',
        f.bundlePrice ?? '',
        f.price,
        s,
        s * (f.price ?? 0),
        stockStatus(s).label,
        f.barcode ?? '',
        listingOf(f)
      ];
    });
    downloadCsv(`tresor-inventory-${new Date().toISOString().slice(0, 10)}`, toCsv(headers, data));
  };

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="SKUs" value={kpis.skus.toLocaleString('en-IN')} Icon={Boxes} iconBg="#EDE7F6" iconColor="#5C3A8E" />
        <Kpi label="Units in stock" value={kpis.units.toLocaleString('en-IN')} Icon={Boxes} iconBg="#E5EFDB" iconColor="#2F6E2F" />
        <Kpi label="Inventory value" value={formatINR(kpis.value)} Icon={Boxes} iconBg="#FDEEF2" iconColor="#A2275A" />
        <Kpi label="Low stock" value={kpis.low.toLocaleString('en-IN')} Icon={AlertCircle} iconBg="#FDF0E1" iconColor="#9A5B12" alert={kpis.low > 0} />
        <Kpi label="Out of stock" value={kpis.out.toLocaleString('en-IN')} Icon={PackageX} iconBg="#FBE6E6" iconColor="#A12626" alert={kpis.out > 0} />
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <h1 className="text-[20px] font-extrabold text-[color:var(--color-myntra-navy)]">Inventory</h1>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-myntra-ink-mute)]" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search product…" className="input-box pl-9 w-full sm:w-[220px]" />
          </div>
          <div className="relative">
            <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-myntra-ink-mute)] pointer-events-none" />
            <select value={stockFilter} onChange={e => setStockFilter(e.target.value as StockFilter)} className="input-box pl-9 w-full sm:w-[150px]">
              <option value="all">All stock</option>
              <option value="in">In stock</option>
              <option value="low">Low (&lt;{LOW_STOCK})</option>
              <option value="out">Out of stock</option>
            </select>
          </div>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value as CatFilter)} className="input-box w-full sm:w-[150px]">
            <option value="all">All categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={listingFilter}
            onChange={e => setListingFilter(e.target.value as ListingFilter)}
            title="Drafts are in the system — stock, barcodes and counter billing all work — but are not on the website."
            className="input-box w-full sm:w-[150px]"
          >
            <option value="all">All listings</option>
            <option value="Active">On the website</option>
            <option value="Draft">Drafts</option>
            <option value="Retired">Retired</option>
          </select>
          {labelable.missing.length > 0 && (
            <button
              onClick={handleGenerateBarcodes}
              disabled={Boolean(barcoding)}
              title={`${labelable.missing.length} of the filtered products have no barcode yet`}
              className="btn-outline inline-flex items-center justify-center gap-1.5 !py-2.5 whitespace-nowrap"
            >
              <Barcode className="w-4 h-4" />
              {barcoding ? `Generating ${barcoding.done}/${barcoding.total}…` : `Generate barcodes (${labelable.missing.length})`}
            </button>
          )}
          <button
            onClick={handlePrintLabels}
            disabled={!labelable.ready.length}
            title={
              labelable.ready.length
                ? `Print ${labelable.ready.length} barcode label${labelable.ready.length === 1 ? '' : 's'} for the filtered products`
                : 'None of the filtered products have a barcode yet'
            }
            className="btn-outline inline-flex items-center justify-center gap-1.5 !py-2.5 whitespace-nowrap"
          >
            <Tag className="w-4 h-4" /> Print labels{labelable.ready.length ? ` (${labelable.ready.length})` : ''}
          </button>
          <button onClick={exportCsv} className="btn-outline inline-flex items-center justify-center gap-1.5 !py-2.5 whitespace-nowrap">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-[14px] text-[color:var(--color-myntra-ink-soft)]">Loading inventory…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-[14px] text-[color:var(--color-myntra-ink-soft)]">No products match these filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-[color:var(--color-myntra-bg-soft)] border-b border-[color:var(--color-myntra-border-soft)] text-left">
                <tr className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[color:var(--color-myntra-ink-mute)]">
                  <th className="px-3 py-2.5">Product</th>
                  <th className="px-3 py-2.5">Category</th>
                  <th className="px-3 py-2.5 text-right">Price</th>
                  <th className="px-3 py-2.5 text-center">Stock</th>
                  <th className="px-3 py-2.5 text-right">Stock value</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Listing</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(f => {
                  const s = f.stock ?? 0;
                  const st = stockStatus(s);
                  return (
                    <tr key={f.id} className="border-b border-[color:var(--color-myntra-border-soft)] hover:bg-[color:var(--color-myntra-bg-soft)]">
                      <td className="px-3 py-2.5">
                        <div className="flex gap-2.5 items-center">
                          <div className="w-9 h-12 rounded overflow-hidden border border-[color:var(--color-myntra-border-soft)] bg-[color:var(--color-myntra-bg-soft)] shrink-0">
                            <FabricImage photo={f.photo} fallback={f.image} alt={f.name} className="w-full h-full object-cover" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[color:var(--color-myntra-navy)]">{f.brand}</div>
                            <div className="text-[13px] font-semibold text-[color:var(--color-myntra-navy)] line-clamp-1">{f.name}</div>
                            {f.category === 'Laces' && (
                              <div className="text-[10px] font-bold text-[#5C3A8E]">Code: {f.productCode ?? f.id}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-[color:var(--color-myntra-ink-soft)]">{f.category}</td>
                      <td className="px-3 py-2.5 text-right font-semibold">
                        <div>{formatINR(f.price)}</div>
                        {f.unitType === 'per meter' && Number.isFinite(f.sellingPricePerMeter as number) && (
                          <div className="text-[11px] text-[#5C3A8E]">₹{f.sellingPricePerMeter}/m</div>
                        )}
                        {f.unitType === 'bundle' && Number.isFinite(f.bundlePrice as number) && (
                          <div className="text-[11px] text-[#5C3A8E]">{f.bundleSizeMeters}m bundle @ {formatINR(f.bundlePrice as number)}</div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => setStock(f, s - 1)} disabled={s <= 0 || savingId === f.id} className="w-7 h-7 rounded border border-[color:var(--color-myntra-border-soft)] flex items-center justify-center hover:bg-white disabled:opacity-40" aria-label="Decrease stock">
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number" min={0} value={s}
                            onChange={e => setRows(prev => prev.map(r => (r.id === f.id ? { ...r, stock: Math.max(0, Number(e.target.value)) } : r)))}
                            onBlur={e => setStock(f, Number(e.target.value))}
                            className="input-box !py-1 w-16 text-center"
                          />
                          <button onClick={() => setStock(f, s + 1)} disabled={savingId === f.id} className="w-7 h-7 rounded border border-[color:var(--color-myntra-border-soft)] flex items-center justify-center hover:bg-white disabled:opacity-40" aria-label="Increase stock">
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          {savedId === f.id && <Check className="w-4 h-4 text-[color:var(--color-myntra-green)]" />}
                        </div>
                        <div className="text-center text-[10px] text-[color:var(--color-myntra-ink-mute)] mt-1">
                          {unitLabel(f.unitType)}s
                        </div>
                        {f.unitType === 'bundle' && Number.isFinite(f.bundleSizeMeters as number) && (
                          <div className="text-center text-[10px] text-[#5C3A8E] font-semibold">
                            {f.bundleSizeMeters}m each
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold">{formatINR(s * (f.price ?? 0))}</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-block px-2 py-0.5 rounded-full border text-[11px] font-bold ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <select
                          value={listingOf(f)}
                          onChange={e => setListing(f, e.target.value as NonNullable<Fabric['listingStatus']>)}
                          disabled={savingId === f.id}
                          aria-label={`Listing status for ${f.name}`}
                          className={`text-[11px] font-bold rounded-full border px-2 py-1 ${LISTING_CLS[listingOf(f)]}`}
                        >
                          <option value="Active">On the website</option>
                          <option value="Draft">Draft</option>
                          <option value="Retired">Retired</option>
                        </select>
                        {listingOf(f) === 'Draft' && awaitingPhoto(f) && (
                          <div className="text-[10px] text-[color:var(--color-myntra-ink-mute)] mt-1">Needs a photo</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminInventory;
