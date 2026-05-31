import React, { useEffect, useMemo, useState } from 'react';
import {
  Pencil,
  Trash2,
  Plus,
  Search,
  X,
  Filter,
  Image as ImageIcon,
  Save,
  Upload,
  Tag
} from 'lucide-react';
import { productsApi } from '../../lib/firebase';
import { CATEGORIES, formatINR } from '../../constants';
import type { Fabric } from '../../types';

/* ───────────── domain helpers ───────────── */

const STICKERS: NonNullable<Fabric['sticker']>[] = [
  'Trending',
  'Bestseller',
  'New In',
  'Limited'
];

const AVAILABLE_PHOTOS: string[] = [
  '/products/banarasi-purple-1.jpg',
  '/products/banarasi-purple-2.jpg',
  '/products/banarasi-purple-3.jpg',
  '/products/banarasi-purple-4.jpg',
  '/products/bandhani-red-1.jpg',
  '/products/bandhani-red-2.jpg',
  '/products/jamdani-pink-1.jpg',
  '/products/jamdani-pink-2.jpg',
  '/products/jamdani-pink-3.jpg',
  '/products/kalamkari-cream-1.jpg',
  '/products/kalamkari-cream-2.jpg',
  '/products/kalamkari-cream-3.jpg',
  '/products/kalamkari-cream-4.jpg',
  '/products/kanjivaram-olive-1.jpg',
  '/products/kanjivaram-olive-2.jpg',
  '/products/linensilk-teal-1.jpg',
  '/products/mashru-saffron-1.jpg',
  '/products/patola-purple-1.jpg',
  '/products/patola-purple-2.jpg',
  '/products/patola-purple-3.jpg'
];

const PLACEHOLDER_SVG =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 100'><rect width='80' height='100' fill='%23F2EBDD'/><text x='50%25' y='52%25' font-size='10' fill='%23A0826D' text-anchor='middle' font-family='serif'>Tresor</text></svg>";

const newId = (): string =>
  'f-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const discountPercent = (price: number, mrp: number): number => {
  if (!Number.isFinite(price) || !Number.isFinite(mrp) || mrp <= 0 || price >= mrp) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
};

const parseCsvStrings = (raw: string): string[] =>
  raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

/* ───────────── draft model ───────────── */

type ColorRow = { name: string; hex: string };

interface Draft {
  id: string;
  brand: string;
  name: string;
  description: string;
  price: string;
  mrp: string;
  photo: string;
  gallery1: string;
  gallery2: string;
  gallery3: string;
  category: Fabric['category'] | '';
  origin: string;
  tagsCsv: string;
  sticker: Fabric['sticker'] | '';
  colors: ColorRow[];
  stock: string;
  weaveType: string;
  rating: string;
  reviewCount: string;
}

const emptyDraft = (): Draft => ({
  id: '',
  brand: 'TRESOR',
  name: '',
  description: '',
  price: '',
  mrp: '',
  photo: AVAILABLE_PHOTOS[0],
  gallery1: '',
  gallery2: '',
  gallery3: '',
  category: '',
  origin: '',
  tagsCsv: '',
  sticker: '',
  colors: [],
  stock: '',
  weaveType: '',
  rating: '',
  reviewCount: ''
});

const fabricToDraft = (f: Fabric): Draft => ({
  id: f.id,
  brand: f.brand,
  name: f.name,
  description: f.description,
  price: String(f.price),
  mrp: String(f.mrp),
  photo: f.photo,
  gallery1: f.photoGallery?.[0] ?? '',
  gallery2: f.photoGallery?.[1] ?? '',
  gallery3: f.photoGallery?.[2] ?? '',
  category: f.category,
  origin: f.origin,
  tagsCsv: (f.tags ?? []).join(', '),
  sticker: f.sticker ?? '',
  colors: (f.colors ?? []).map(c => ({ name: c.name, hex: c.hex })),
  stock: f.stock != null ? String(f.stock) : '',
  weaveType: f.weaveType ?? '',
  rating: f.rating != null ? String(f.rating) : '',
  reviewCount: f.reviewCount != null ? String(f.reviewCount) : ''
});

interface DraftErrors {
  brand?: string;
  name?: string;
  description?: string;
  category?: string;
  origin?: string;
  price?: string;
  mrp?: string;
  stock?: string;
  photo?: string;
}

const validateDraft = (d: Draft): DraftErrors => {
  const errs: DraftErrors = {};
  if (!d.brand.trim()) errs.brand = 'Brand is required';
  if (!d.name.trim()) errs.name = 'Name is required';
  if (!d.description.trim()) errs.description = 'Description is required';
  if (!d.category) errs.category = 'Pick a category';
  if (!d.origin.trim()) errs.origin = 'Origin is required';
  if (!d.photo.trim()) errs.photo = 'Photo path is required';

  const price = Number(d.price);
  if (!Number.isFinite(price) || price <= 0) errs.price = 'Price must be > 0';
  const mrp = Number(d.mrp);
  if (!Number.isFinite(mrp) || mrp <= 0) errs.mrp = 'MRP must be > 0';
  else if (Number.isFinite(price) && mrp < price)
    errs.mrp = 'MRP should be ≥ selling price';

  if (d.stock !== '') {
    const stock = Number(d.stock);
    if (!Number.isFinite(stock) || stock < 0) errs.stock = 'Stock must be ≥ 0';
  }
  return errs;
};

const draftToFabric = (d: Draft, existing?: Fabric): Fabric => {
  const gallery = [d.gallery1, d.gallery2, d.gallery3].map(s => s.trim()).filter(Boolean);
  const colors = d.colors
    .map(c => ({ name: c.name.trim(), hex: c.hex.trim() }))
    .filter(c => c.name && c.hex);
  const tags = parseCsvStrings(d.tagsCsv);
  const photo = d.photo.trim();

  const next: Fabric = {
    id: d.id || newId(),
    brand: d.brand.trim(),
    name: d.name.trim(),
    description: d.description.trim(),
    price: Number(d.price),
    mrp: Number(d.mrp),
    photo,
    photoGallery: gallery.length ? gallery : undefined,
    image: existing?.image ?? photo,
    gallery: existing?.gallery,
    category: (d.category || 'Silk') as Fabric['category'],
    masterCategory: existing?.masterCategory ?? 'Fabrics',
    subCategory: existing?.subCategory,
    origin: d.origin.trim(),
    tags,
    sticker: d.sticker || undefined,
    colors: colors.length ? colors : undefined,
    stock: d.stock !== '' ? Number(d.stock) : undefined,
    weaveType: d.weaveType.trim() || undefined,
    rating:
      d.rating !== '' && Number.isFinite(Number(d.rating)) ? Number(d.rating) : existing?.rating,
    reviewCount:
      d.reviewCount !== '' && Number.isFinite(Number(d.reviewCount))
        ? Number(d.reviewCount)
        : existing?.reviewCount
  };
  return next;
};

/* ───────────── thumbnail (with fallback) ───────────── */

const Thumb: React.FC<{ photo: string; fallback?: string; alt: string; className?: string }> = ({
  photo,
  fallback,
  alt,
  className
}) => {
  const [src, setSrc] = useState(photo);
  useEffect(() => setSrc(photo), [photo]);
  return (
    <img
      src={src || PLACEHOLDER_SVG}
      alt={alt}
      className={className}
      onError={() => {
        const fb = fallback && fallback !== src ? fallback : PLACEHOLDER_SVG;
        if (fb !== src) setSrc(fb);
      }}
    />
  );
};

/* ───────────── category badge ───────────── */

const categoryBadge = (cat: Fabric['category']): string => {
  switch (cat) {
    case 'Silk':
      return 'bg-[#FDEEF2] text-[#A2275A] border-[#F5C8D6]';
    case 'Cotton':
      return 'bg-[#E8F2E8] text-[#2F6E2F] border-[#C9DFC9]';
    case 'Wool':
      return 'bg-[#F1E8DC] text-[#7A4F1F] border-[#DEC9AA]';
    case 'Linen':
      return 'bg-[#E8EEF6] text-[#274C8A] border-[#C4D2E8]';
    case 'Mixed':
      return 'bg-[#F1ECF7] text-[#5C3A8E] border-[#D6C9E9]';
    case 'Satin':
      return 'bg-[#FBF2E1] text-[#8B5A14] border-[#EFDDB5]';
    default:
      return 'bg-[#F3F3F3] text-[#444] border-[#E0E0E0]';
  }
};

/* ───────────── modal shells ───────────── */

const Overlay: React.FC<{ onClose: () => void; children: React.ReactNode; z?: number }> = ({
  onClose,
  children,
  z = 120
}) => (
  <div
    className="fixed inset-0 flex items-center justify-center px-3 sm:px-6 py-6"
    style={{ zIndex: z, backgroundColor: 'rgba(20, 16, 24, 0.55)' }}
    onClick={onClose}
  >
    <div onClick={e => e.stopPropagation()} className="w-full">
      {children}
    </div>
  </div>
);

/* ───────────── product editor modal ───────────── */

interface EditorProps {
  draft: Draft;
  isNew: boolean;
  saving: boolean;
  errors: DraftErrors;
  onChange: (next: Draft) => void;
  onCancel: () => void;
  onSave: () => void;
}

const Editor: React.FC<EditorProps> = ({ draft, isNew, saving, errors, onChange, onCancel, onSave }) => {
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    onChange({ ...draft, [key]: value });

  const priceNum = Number(draft.price);
  const mrpNum = Number(draft.mrp);
  const disc = discountPercent(priceNum, mrpNum);
  const mrpWarn = Number.isFinite(priceNum) && Number.isFinite(mrpNum) && mrpNum < priceNum;

  return (
    <div className="bg-white rounded-md max-w-3xl w-full mx-auto max-h-[90vh] overflow-y-auto shadow-2xl border border-[color:var(--color-myntra-border-soft)]">
      {/* header */}
      <div className="sticky top-0 z-10 bg-white border-b border-[color:var(--color-myntra-border-soft)] px-5 sm:px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-extrabold text-[color:var(--color-myntra-navy)]">
            {isNew ? 'Add Product' : 'Edit Product'}
          </h2>
          {!isNew && (
            <p className="text-[11px] text-[color:var(--color-myntra-ink-mute)] mt-0.5">
              ID: {draft.id}
            </p>
          )}
        </div>
        <button
          onClick={onCancel}
          className="p-2 rounded hover:bg-[color:var(--color-myntra-bg-soft)] text-[color:var(--color-myntra-ink-soft)]"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="px-5 sm:px-6 py-5 space-y-7">
        {/* Basics */}
        <section>
          <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--color-myntra-ink-mute)] mb-3">
            Basics
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Brand" error={errors.brand}>
              <input
                className="input-box"
                value={draft.brand}
                onChange={e => set('brand', e.target.value)}
              />
            </Field>
            <Field label="Name" error={errors.name}>
              <input
                className="input-box"
                value={draft.name}
                onChange={e => set('name', e.target.value)}
                placeholder="Banarasi Bridal Silk"
              />
            </Field>
            <Field label="Category" error={errors.category}>
              <select
                className="input-box"
                value={draft.category}
                onChange={e => set('category', e.target.value as Fabric['category'] | '')}
              >
                <option value="">— Select —</option>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Origin" error={errors.origin}>
              <input
                className="input-box"
                value={draft.origin}
                onChange={e => set('origin', e.target.value)}
                placeholder="Varanasi"
              />
            </Field>
            <Field label="Weave type">
              <input
                className="input-box"
                value={draft.weaveType}
                onChange={e => set('weaveType', e.target.value)}
                placeholder="Kadhua Brocade"
              />
            </Field>
            <Field label="Sticker">
              <select
                className="input-box"
                value={draft.sticker}
                onChange={e =>
                  set('sticker', e.target.value as Fabric['sticker'] | '')
                }
              >
                <option value="">— None —</option>
                {STICKERS.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Description" error={errors.description} full>
              <textarea
                className="input-box min-h-[88px] resize-y"
                value={draft.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Hand-woven on traditional pit looms…"
              />
            </Field>
          </div>
        </section>

        {/* Pricing & stock */}
        <section>
          <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--color-myntra-ink-mute)] mb-3">
            Pricing &amp; Stock
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="Price (₹)" error={errors.price}>
              <input
                type="number"
                min={0}
                className="input-box"
                value={draft.price}
                onChange={e => set('price', e.target.value)}
              />
            </Field>
            <Field label="MRP (₹)" error={errors.mrp}>
              <input
                type="number"
                min={0}
                className="input-box"
                value={draft.mrp}
                onChange={e => set('mrp', e.target.value)}
              />
            </Field>
            <Field label="Stock (units)" error={errors.stock}>
              <input
                type="number"
                min={0}
                className="input-box"
                value={draft.stock}
                onChange={e => set('stock', e.target.value)}
              />
            </Field>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">
            {disc > 0 && (
              <span className="badge-discount">{disc}% OFF</span>
            )}
            {mrpWarn && (
              <span className="text-[12px] font-semibold text-[#A12626]">
                MRP is lower than selling price.
              </span>
            )}
          </div>
        </section>

        {/* Media */}
        <section>
          <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--color-myntra-ink-mute)] mb-3">
            Media
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-start">
            <div className="space-y-2">
              <Field label="Main photo path" error={errors.photo}>
                <input
                  className="input-box"
                  value={draft.photo}
                  onChange={e => set('photo', e.target.value)}
                  placeholder="/products/banarasi-purple-1.jpg"
                />
              </Field>
              <div className="flex items-center gap-2">
                <Upload className="w-3.5 h-3.5 text-[color:var(--color-myntra-ink-mute)]" />
                <select
                  className="input-box flex-1 !py-2 text-[12px]"
                  value=""
                  onChange={e => {
                    if (e.target.value) set('photo', e.target.value);
                  }}
                >
                  <option value="">Quick-pick from /public/products…</option>
                  {AVAILABLE_PHOTOS.map(p => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="w-24 h-32 rounded-md overflow-hidden border border-[color:var(--color-myntra-border-soft)] bg-[color:var(--color-myntra-bg-soft)] shrink-0">
              <Thumb
                photo={draft.photo}
                alt="Main preview"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {([
              ['gallery1', draft.gallery1],
              ['gallery2', draft.gallery2],
              ['gallery3', draft.gallery3]
            ] as [keyof Draft, string][]).map(([k, v], i) => (
              <div key={String(k)}>
                <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--color-myntra-ink-mute)] mb-1">
                  Gallery {i + 1}
                </label>
                <div className="flex gap-2">
                  <input
                    className="input-box flex-1"
                    value={v}
                    onChange={e => set(k, e.target.value as Draft[typeof k])}
                    placeholder="/products/…"
                  />
                  <div className="w-10 h-12 rounded border border-[color:var(--color-myntra-border-soft)] bg-[color:var(--color-myntra-bg-soft)] overflow-hidden shrink-0">
                    {v ? (
                      <Thumb photo={v} alt={`Gallery ${i + 1}`} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[color:var(--color-myntra-ink-mute)]">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Variants */}
        <section>
          <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--color-myntra-ink-mute)] mb-3">
            Variants
          </h3>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--color-myntra-ink-mute)] mb-2">
              Colors
            </label>
            <div className="space-y-2">
              {draft.colors.length === 0 && (
                <p className="text-[12px] text-[color:var(--color-myntra-ink-mute)]">
                  No colors yet.
                </p>
              )}
              {draft.colors.map((c, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 bg-[color:var(--color-myntra-bg-soft)] border border-[color:var(--color-myntra-border-soft)] rounded-md p-2"
                >
                  <span
                    className="w-7 h-7 rounded-full border border-[color:var(--color-myntra-border)] shrink-0"
                    style={{ background: c.hex || '#ddd' }}
                  />
                  <input
                    className="input-box !py-1.5 flex-1"
                    value={c.name}
                    placeholder="Maroon"
                    onChange={e => {
                      const next = draft.colors.slice();
                      next[i] = { ...next[i], name: e.target.value };
                      set('colors', next);
                    }}
                  />
                  <input
                    className="input-box !py-1.5 w-28"
                    value={c.hex}
                    placeholder="#7A1F2C"
                    onChange={e => {
                      const next = draft.colors.slice();
                      next[i] = { ...next[i], hex: e.target.value };
                      set('colors', next);
                    }}
                  />
                  <input
                    type="color"
                    value={/^#[0-9a-fA-F]{6}$/.test(c.hex) ? c.hex : '#cccccc'}
                    onChange={e => {
                      const next = draft.colors.slice();
                      next[i] = { ...next[i], hex: e.target.value };
                      set('colors', next);
                    }}
                    className="w-8 h-8 rounded border border-[color:var(--color-myntra-border-soft)] cursor-pointer p-0"
                    aria-label="Pick color"
                  />
                  <button
                    onClick={() => {
                      const next = draft.colors.slice();
                      next.splice(i, 1);
                      set('colors', next);
                    }}
                    className="p-1.5 rounded text-[#A12626] hover:bg-white"
                    aria-label="Remove color"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => set('colors', [...draft.colors, { name: '', hex: '#C5A059' }])}
              className="btn-outline mt-3 !py-1.5 !px-3 text-[12px] inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add color
            </button>
          </div>

        </section>

        {/* Tags */}
        <section>
          <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--color-myntra-ink-mute)] mb-3">
            Tags
          </h3>
          <div className="relative">
            <Tag className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-myntra-ink-mute)]" />
            <input
              className="input-box pl-9"
              value={draft.tagsCsv}
              onChange={e => set('tagsCsv', e.target.value)}
              placeholder="Handloom, Heritage, Endangered"
            />
          </div>
        </section>
      </div>

      {/* footer */}
      <div className="sticky bottom-0 bg-white border-t border-[color:var(--color-myntra-border-soft)] px-5 sm:px-6 py-3.5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <button
          onClick={onCancel}
          disabled={saving}
          className="btn-outline !py-2.5"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="btn-primary !py-2.5 inline-flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="w-4 h-4" /> {isNew ? 'Create product' : 'Save changes'}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

/* ───────────── field atom ───────────── */

const Field: React.FC<{
  label: string;
  error?: string;
  full?: boolean;
  children: React.ReactNode;
}> = ({ label, error, full, children }) => (
  <div className={full ? 'sm:col-span-2' : ''}>
    <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--color-myntra-ink-mute)] mb-1">
      {label}
    </label>
    {children}
    {error && (
      <p className="mt-1 text-[11px] font-semibold text-[#A12626]">{error}</p>
    )}
  </div>
);

/* ───────────── delete confirm ───────────── */

interface ConfirmProps {
  name: string;
  busy: boolean;
  onCancel: () => void;
  onDelete: () => void;
}

const Confirm: React.FC<ConfirmProps> = ({ name, busy, onCancel, onDelete }) => (
  <div className="bg-white rounded-md max-w-sm w-full mx-auto p-5 shadow-2xl border border-[color:var(--color-myntra-border-soft)]">
    <h3 className="text-[15px] font-extrabold text-[color:var(--color-myntra-navy)] mb-1">
      Delete product?
    </h3>
    <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)]">
      Delete <span className="font-semibold text-[color:var(--color-myntra-navy)]">{name}</span>?
      This cannot be undone.
    </p>
    <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
      <button onClick={onCancel} disabled={busy} className="btn-outline !py-2">
        Cancel
      </button>
      <button
        onClick={onDelete}
        disabled={busy}
        className="!py-2 !px-4 rounded-md font-bold text-white text-[13px] inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
        style={{ backgroundColor: '#A12626' }}
      >
        {busy ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Deleting…
          </>
        ) : (
          <>
            <Trash2 className="w-4 h-4" /> Delete
          </>
        )}
      </button>
    </div>
  </div>
);

/* ───────────── main page ───────────── */

type CategoryFilter = Fabric['category'] | 'all';

const AdminProducts: React.FC = () => {
  const [rows, setRows] = useState<Fabric[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

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

  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState<CategoryFilter>('all');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingExisting, setEditingExisting] = useState<Fabric | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [saving, setSaving] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<Fabric | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* filter rows */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(f => {
      if (catFilter !== 'all' && f.category !== catFilter) return false;
      if (!q) return true;
      return (
        f.name.toLowerCase().includes(q) ||
        f.brand.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q) ||
        f.origin.toLowerCase().includes(q)
      );
    });
  }, [rows, query, catFilter]);

  /* open editor handlers */
  const openCreate = () => {
    setEditingExisting(null);
    setDraft(emptyDraft());
    setErrors({});
    setEditorOpen(true);
  };

  const openEdit = (f: Fabric) => {
    setEditingExisting(f);
    setDraft(fabricToDraft(f));
    setErrors({});
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (saving) return;
    setEditorOpen(false);
    setEditingExisting(null);
    setErrors({});
  };

  const saveDraft = async () => {
    const errs = validateDraft(draft);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSaving(true);
    try {
      const record = draftToFabric(draft, editingExisting ?? undefined);
      const { id, ...payload } = record;
      if (editingExisting) {
        await productsApi.update(editingExisting.id, payload as unknown as Record<string, unknown>);
      } else {
        await productsApi.create({ ...payload, id } as unknown as Record<string, unknown>);
      }
      setEditorOpen(false);
      setEditingExisting(null);
      setReloadKey(k => k + 1);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Save failed';
      setErrors(prev => ({ ...prev, photo: message }));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await productsApi.remove(pendingDelete.id);
      setPendingDelete(null);
      setReloadKey(k => k + 1);
    } finally {
      setDeleting(false);
    }
  };

  /* keyboard: ESC closes overlays */
  useEffect(() => {
    if (!editorOpen && !pendingDelete) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (editorOpen) closeEditor();
      else if (pendingDelete && !deleting) setPendingDelete(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorOpen, pendingDelete, deleting, saving]);

  /* ───────────── render ───────────── */
  return (
    <div className="space-y-4">
      {/* header strip */}
      <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-[20px] sm:text-[22px] font-extrabold text-[color:var(--color-myntra-navy)]">
              Products
            </h1>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[color:var(--color-myntra-bg-soft)] border border-[color:var(--color-myntra-border-soft)] text-[12px] font-bold text-[color:var(--color-myntra-ink-soft)]">
              {rows.length}
              <span className="ml-1 font-medium opacity-70">total</span>
            </span>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-myntra-ink-mute)]" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search name, brand, origin…"
                className="input-box pl-9 w-full sm:w-[260px]"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-[color:var(--color-myntra-bg-soft)] text-[color:var(--color-myntra-ink-mute)]"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="relative">
              <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-myntra-ink-mute)] pointer-events-none" />
              <select
                value={catFilter}
                onChange={e => setCatFilter(e.target.value as CategoryFilter)}
                className="input-box pl-9 pr-3 w-full sm:w-[170px]"
              >
                <option value="all">All categories</option>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={openCreate}
              className="btn-primary inline-flex items-center justify-center gap-1.5 !py-2.5"
            >
              <Plus className="w-4 h-4" /> Add Product
            </button>
          </div>
        </div>
      </div>

      {/* content */}
      <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-[14px] text-[color:var(--color-myntra-ink-soft)]">
            Loading products…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState hasFilter={Boolean(query) || catFilter !== 'all'} onAdd={openCreate} />
        ) : (
          <>
            {/* desktop table */}
            <div className="hidden md:block">
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 z-[1] bg-[color:var(--color-myntra-bg-soft)] border-b border-[color:var(--color-myntra-border-soft)]">
                  <tr className="text-left">
                    <Th className="w-[80px]">Photo</Th>
                    <Th>Name</Th>
                    <Th className="w-[110px]">Category</Th>
                    <Th className="w-[140px]">Price</Th>
                    <Th className="w-[80px]">Stock</Th>
                    <Th className="w-[80px]">Rating</Th>
                    <Th className="w-[110px] text-right pr-4">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(f => {
                    const stock = f.stock ?? 0;
                    const lowStock = stock < 10;
                    return (
                      <tr
                        key={f.id}
                        className="border-b border-[color:var(--color-myntra-border-soft)] hover:bg-[color:var(--color-myntra-bg-soft)] transition-colors"
                      >
                        <Td>
                          <div className="w-12 h-16 rounded overflow-hidden border border-[color:var(--color-myntra-border-soft)] bg-[color:var(--color-myntra-bg-soft)]">
                            <Thumb
                              photo={f.photo}
                              fallback={f.image}
                              alt={f.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        </Td>
                        <Td>
                          <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[color:var(--color-myntra-navy)]">
                            {f.brand}
                          </div>
                          <div className="text-[13px] font-semibold text-[color:var(--color-myntra-navy)] line-clamp-2">
                            {f.name}
                          </div>
                          <div className="text-[11px] text-[color:var(--color-myntra-ink-mute)] mt-0.5">
                            {f.origin}
                          </div>
                        </Td>
                        <Td>
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full border text-[11px] font-bold ${categoryBadge(
                              f.category
                            )}`}
                          >
                            {f.category}
                          </span>
                        </Td>
                        <Td>
                          <div className="font-bold text-[color:var(--color-myntra-navy)]">
                            {formatINR(f.price)}
                          </div>
                          {f.mrp > f.price && (
                            <div className="text-[11px] text-[color:var(--color-myntra-ink-mute)]">
                              <span className="line-through">{formatINR(f.mrp)}</span>
                              <span className="ml-1.5 text-[color:var(--color-myntra-green)] font-bold">
                                {discountPercent(f.price, f.mrp)}% off
                              </span>
                            </div>
                          )}
                        </Td>
                        <Td>
                          <span
                            className={
                              lowStock
                                ? 'font-bold text-[#A12626]'
                                : 'font-semibold text-[color:var(--color-myntra-navy)]'
                            }
                          >
                            {stock}
                          </span>
                          <span className="text-[11px] text-[color:var(--color-myntra-ink-mute)]"> m</span>
                        </Td>
                        <Td>
                          {f.rating != null ? (
                            <span className="badge-rating">
                              <span className="star">★</span>
                              {f.rating.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-[12px] text-[color:var(--color-myntra-ink-mute)]">
                              —
                            </span>
                          )}
                        </Td>
                        <Td className="text-right pr-3">
                          <div className="inline-flex gap-1">
                            <IconBtn
                              onClick={() => openEdit(f)}
                              label="Edit"
                              tone="default"
                              icon={<Pencil className="w-4 h-4" />}
                            />
                            <IconBtn
                              onClick={() => setPendingDelete(f)}
                              label="Delete"
                              tone="danger"
                              icon={<Trash2 className="w-4 h-4" />}
                            />
                          </div>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* mobile cards */}
            <ul className="md:hidden divide-y divide-[color:var(--color-myntra-border-soft)]">
              {filtered.map(f => {
                const stock = f.stock ?? 0;
                const lowStock = stock < 10;
                return (
                  <li key={f.id} className="p-3 flex gap-3">
                    <div className="w-16 h-20 rounded overflow-hidden border border-[color:var(--color-myntra-border-soft)] bg-[color:var(--color-myntra-bg-soft)] shrink-0">
                      <Thumb
                        photo={f.photo}
                        fallback={f.image}
                        alt={f.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[color:var(--color-myntra-navy)]">
                        {f.brand}
                      </div>
                      <div className="text-[13px] font-semibold text-[color:var(--color-myntra-navy)] line-clamp-2">
                        {f.name}
                      </div>
                      <div className="text-[11px] text-[color:var(--color-myntra-ink-mute)]">
                        {f.origin}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded-full border text-[10px] font-bold ${categoryBadge(
                            f.category
                          )}`}
                        >
                          {f.category}
                        </span>
                        <span className="text-[13px] font-bold text-[color:var(--color-myntra-navy)]">
                          {formatINR(f.price)}
                        </span>
                        {f.mrp > f.price && (
                          <span className="text-[11px] text-[color:var(--color-myntra-ink-mute)] line-through">
                            {formatINR(f.mrp)}
                          </span>
                        )}
                        <span
                          className={`text-[11px] font-semibold ${
                            lowStock ? 'text-[#A12626]' : 'text-[color:var(--color-myntra-ink-soft)]'
                          }`}
                        >
                          {stock} in stock
                        </span>
                      </div>
                      <div className="mt-2 flex gap-1.5">
                        <button
                          onClick={() => openEdit(f)}
                          className="btn-outline !py-1 !px-2.5 text-[11px] inline-flex items-center gap-1"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          onClick={() => setPendingDelete(f)}
                          className="!py-1 !px-2.5 text-[11px] rounded-md font-bold border border-[#F0C7C7] text-[#A12626] bg-white hover:bg-[#FBE6E6] inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {/* editor overlay */}
      {editorOpen && (
        <Overlay onClose={closeEditor}>
          <Editor
            draft={draft}
            isNew={editingExisting === null}
            saving={saving}
            errors={errors}
            onChange={setDraft}
            onCancel={closeEditor}
            onSave={saveDraft}
          />
        </Overlay>
      )}

      {/* delete overlay */}
      {pendingDelete && (
        <Overlay onClose={() => !deleting && setPendingDelete(null)} z={130}>
          <Confirm
            name={pendingDelete.name}
            busy={deleting}
            onCancel={() => setPendingDelete(null)}
            onDelete={confirmDelete}
          />
        </Overlay>
      )}
    </div>
  );
};

/* ───────────── table atoms ───────────── */

const Th: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <th
    className={`text-left px-3 py-2.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[color:var(--color-myntra-ink-mute)] ${
      className ?? ''
    }`}
  >
    {children}
  </th>
);

const Td: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <td className={`px-3 py-2.5 align-middle ${className ?? ''}`}>{children}</td>
);

const IconBtn: React.FC<{
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  tone: 'default' | 'danger';
}> = ({ onClick, label, icon, tone }) => (
  <button
    onClick={onClick}
    aria-label={label}
    title={label}
    className={`p-1.5 rounded border transition-colors ${
      tone === 'danger'
        ? 'border-[#F0C7C7] text-[#A12626] bg-white hover:bg-[#FBE6E6]'
        : 'border-[color:var(--color-myntra-border-soft)] text-[color:var(--color-myntra-navy)] bg-white hover:bg-[color:var(--color-myntra-bg-soft)]'
    }`}
  >
    {icon}
  </button>
);

/* ───────────── empty state ───────────── */

const EmptyState: React.FC<{ hasFilter: boolean; onAdd: () => void }> = ({ hasFilter, onAdd }) => (
  <div className="p-10 sm:p-14 text-center">
    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[color:var(--color-myntra-bg-soft)] border border-[color:var(--color-myntra-border-soft)] mb-3">
      <ImageIcon className="w-5 h-5 text-[color:var(--color-myntra-ink-mute)]" />
    </div>
    <h3 className="text-[15px] font-extrabold text-[color:var(--color-myntra-navy)]">
      {hasFilter ? 'No products match your filters' : 'No products yet'}
    </h3>
    <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] mt-1">
      {hasFilter
        ? 'Try clearing the search or category filter.'
        : 'Add your first fabric to populate the storefront.'}
    </p>
    {!hasFilter && (
      <button
        onClick={onAdd}
        className="btn-primary mt-4 inline-flex items-center gap-1.5"
      >
        <Plus className="w-4 h-4" /> Add Product
      </button>
    )}
  </div>
);

export default AdminProducts;
