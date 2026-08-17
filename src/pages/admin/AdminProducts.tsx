import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  Tag,
  Camera,
  AlertTriangle,
  Ruler,
  Download,
  Barcode,
  Check
} from 'lucide-react';
import { productsApi } from '../../lib/firebase';
import { placeholderSwatch } from '../../lib/swatch';
import { awaitingPhoto } from '../../lib/availability';
import { code128Svg } from '../../lib/barcode';
import { reserveBarcode } from '../../lib/barcodeAssign';
import { LABEL_DESIGNS, designById, printSingleLabel } from '../../admin/printLabels';
import { THERMAL_SIZES, downloadThermalLabel, isThermal, thermalById } from '../../admin/thermalLabel';
import { CATEGORIES, formatINR } from '../../constants';
import { toCsv, downloadCsv } from '../../lib/csv';
import LACE_SEED from '../../../inventory-from-pptx/inventory_full_seed.json';
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

const laceBundleLabel = (f: Fabric): string => {
  if (f.unitType === 'bundle' && f.bundleSizeMeters) return `${f.bundleSizeMeters}m bundle`;
  if (f.unitType === 'per meter') return 'per meter';
  return '';
};

const parseCsvStrings = (raw: string): string[] =>
  raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

/** Compress an image file via canvas resize to keep payload under 1MB. */
const compressImage = (file: File, maxDim: number, quality: number): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas not supported'));
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

/** Estimate payload size in KB. */
const payloadSizeKB = (payload: unknown): number => {
  try {
    return new Blob([JSON.stringify(payload)]).size / 1024;
  } catch {
    return 0;
  }
};

/** Strip undefined values so Firebase doesn't complain. */
const cleanPayload = (obj: Record<string, unknown>): Record<string, unknown> => {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = value;
    }
  }
  return cleaned;
};

/* ───────────── draft model ───────────── */

type ColorRow = { name: string; hex: string };

interface Draft {
  id: string;
  brand: string;
  name: string;
  productCode: string;
  description: string;
  price: string;
  mrp: string;
  photo: string;
  gallery1: string;
  gallery2: string;
  gallery3: string;
  category: Fabric['category'] | '';
  tagsCsv: string;
  sticker: Fabric['sticker'] | '';
  colors: ColorRow[];
  stock: string;
  unitType: Fabric['unitType'] | '';
  costPrice: string;
  sellingPricePerMeter: string;
  bundleSizeMeters: string;
  bundlePrice: string;
  weaveType: string;
  rating: string;
  reviewCount: string;
  /** Our own scannable code. Allocated on save when empty — never typed. */
  barcode: string;
  /** Draft = saved, barcoded and sellable at the counter, but not on the website. */
  listingStatus: NonNullable<Fabric['listingStatus']>;
}

const emptyDraft = (): Draft => ({
  id: '',
  brand: 'TRESOR',
  name: '',
  productCode: '',
  description: '',
  price: '',
  mrp: '',
  photo: '',
  gallery1: '',
  gallery2: '',
  gallery3: '',
  category: '',
  tagsCsv: '',
  sticker: '',
  colors: [],
  stock: '',
  unitType: '',
  costPrice: '',
  sellingPricePerMeter: '',
  bundleSizeMeters: '',
  bundlePrice: '',
  weaveType: '',
  rating: '',
  reviewCount: '',
  barcode: '',
  // A new product starts as a Draft. Almost everything is entered before it is
  // photographed, and a piece with no photograph has no business on the
  // storefront — adding the photo is what promotes it.
  listingStatus: 'Draft'
});

const fabricToDraft = (f: Fabric): Draft => ({
  id: f.id,
  brand: f.brand,
  name: f.name,
  productCode: f.productCode ?? '',
  description: f.description,
  price: String(f.price),
  mrp: String(f.mrp),
  // A product with no photograph carries a generated swatch. Showing that in
  // the form would read as "already photographed": the hint would not appear,
  // and uploading the real photo would not promote the draft, because the field
  // never went from empty to filled.
  photo: awaitingPhoto(f) ? '' : f.photo,
  gallery1: f.photoGallery?.[0] ?? '',
  gallery2: f.photoGallery?.[1] ?? '',
  gallery3: f.photoGallery?.[2] ?? '',
  category: f.category,
  tagsCsv: (f.tags ?? []).join(', '),
  sticker: f.sticker ?? '',
  colors: (f.colors ?? []).map(c => ({ name: c.name, hex: c.hex })),
  stock: f.stock != null ? String(f.stock) : '',
  unitType: f.unitType ?? '',
  costPrice: f.costPrice != null ? String(f.costPrice) : '',
  sellingPricePerMeter: f.sellingPricePerMeter != null ? String(f.sellingPricePerMeter) : '',
  bundleSizeMeters: f.bundleSizeMeters != null ? String(f.bundleSizeMeters) : '',
  bundlePrice: f.bundlePrice != null ? String(f.bundlePrice) : '',
  weaveType: f.weaveType ?? '',
  rating: f.rating != null ? String(f.rating) : '',
  reviewCount: f.reviewCount != null ? String(f.reviewCount) : '',
  barcode: f.barcode ?? '',
  listingStatus: f.listingStatus ?? 'Active'
});

interface DraftErrors {
  brand?: string;
  name?: string;
  productCode?: string;
  description?: string;
  category?: string;
  price?: string;
  mrp?: string;
  stock?: string;
  costPrice?: string;
  sellingPricePerMeter?: string;
  bundleSizeMeters?: string;
  bundlePrice?: string;
  photo?: string;
  _general?: string;
}

const isPositiveNumber = (v: string): boolean => {
  const n = Number(v);
  return v !== '' && Number.isFinite(n) && n >= 0;
};

const validateDraft = (d: Draft): DraftErrors => {
  const errs: DraftErrors = {};
  if (!d.brand.trim()) errs.brand = 'Brand is required';
  if (!d.name.trim()) errs.name = 'Name is required';
  if (!d.description.trim()) errs.description = 'Description is required';
  if (!d.category) errs.category = 'Pick a category';
  // A photo is deliberately NOT required. A piece is registered — priced,
  // stocked, barcoded, sellable at the counter — days before the shoot, and
  // blocking the save until a photograph exists is what pushed that work into
  // spreadsheets. Instead, no photo means the product cannot be published:
  // see `draftToFabric`, which forces Draft.
  if (!d.photo.trim() && d.listingStatus === 'Active') {
    errs.photo = 'A product on the website needs a photo. Leave it as a Draft until the shoot.';
  }

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

  if (d.costPrice !== '' && !isPositiveNumber(d.costPrice)) {
    errs.costPrice = 'Cost price must be ≥ 0';
  }

  const isLacesPricing = d.unitType === 'per meter' || d.unitType === 'bundle';
  if (isLacesPricing) {
    if (d.sellingPricePerMeter !== '' && !isPositiveNumber(d.sellingPricePerMeter)) {
      errs.sellingPricePerMeter = 'Price per meter must be ≥ 0';
    }
  }
  if (d.unitType === 'bundle') {
    if (d.bundleSizeMeters !== '' && !isPositiveNumber(d.bundleSizeMeters)) {
      errs.bundleSizeMeters = 'Bundle size must be ≥ 0';
    }
    if (d.bundlePrice !== '' && !isPositiveNumber(d.bundlePrice)) {
      errs.bundlePrice = 'Bundle price must be ≥ 0';
    }
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

  const parseOpt = (v: string): number | undefined =>
    v !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined;
  const parseNullable = (v: string): number | null =>
    v !== '' && Number.isFinite(Number(v)) ? Number(v) : null;

  // No photograph yet? Stand in a deterministic swatch so the admin grid renders
  // something recognisable, and keep the piece off the storefront. The swatch is
  // never seen by a shopper: a product without a photo cannot be Active.
  const id = d.id || newId();
  const master = (d.category || 'Fabrics') as Fabric['masterCategory'];
  const swatch = placeholderSwatch(id, d.name.trim() || id, master);
  const listingStatus: NonNullable<Fabric['listingStatus']> =
    !photo && d.listingStatus === 'Active' ? 'Draft' : d.listingStatus;

  const next: Fabric = {
    id,
    brand: d.brand.trim(),
    name: d.name.trim(),
    productCode: d.productCode.trim() || undefined,
    description: d.description.trim(),
    price: Number(d.price),
    mrp: Number(d.mrp),
    photo: photo || swatch,
    photoGallery: gallery.length ? gallery : [],
    image: existing?.image || swatch,
    gallery: existing?.gallery,
    category: (d.category || 'Fabrics') as Fabric['category'],
    masterCategory: master,
    barcode: d.barcode.trim() || undefined,
    listingStatus,
    subCategory: d.category === 'Laces' ? 'Trim & Edging' : existing?.subCategory,
    tags,
    sticker: d.sticker || undefined,
    colors: colors.length ? colors : undefined,
    stock: d.stock !== '' ? Number(d.stock) : undefined,
    unitType: d.unitType || undefined,
    costPrice: parseOpt(d.costPrice),
    sellingPricePerMeter: parseNullable(d.sellingPricePerMeter),
    bundleSizeMeters: parseNullable(d.bundleSizeMeters),
    bundlePrice: parseNullable(d.bundlePrice),
    weaveType: d.weaveType.trim() || undefined,
    rating:
      d.rating !== '' && Number.isFinite(Number(d.rating)) ? Number(d.rating) : existing?.rating,
    reviewCount:
      d.rating !== '' && Number.isFinite(Number(d.reviewCount))
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

/* ───────────── image upload component ───────────── */

const ImageUpload: React.FC<{
  value: string;
  onChange: (value: string) => void;
  label: string;
  error?: string;
  id: string;
}> = ({ value, onChange, label, error, id }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadErr(null);
    try {
      const base64 = await compressImage(file, 800, 0.8);
      const sizeKB = new Blob([base64]).size / 1024;
      if (sizeKB > 900) {
        setUploadErr('Image still too large after compression. Try a smaller file.');
        return;
      }
      onChange(base64);
    } catch {
      setUploadErr('Failed to process image. Try another file.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--color-myntra-ink-mute)] mb-1">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          className="input-box flex-1"
          value={value}
          onChange={e => { onChange(e.target.value); setUploadErr(null); }}
          placeholder="/products/… or base64"
        />
        <div className="w-12 h-14 rounded border border-[color:var(--color-myntra-border-soft)] bg-[color:var(--color-myntra-bg-soft)] overflow-hidden shrink-0">
          {value ? (
            <Thumb photo={value} alt={label} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[color:var(--color-myntra-ink-mute)]">
              <ImageIcon className="w-4 h-4" />
            </div>
          )}
        </div>
      </div>
      {error && <p className="text-[11px] font-semibold text-[#A12626]">{error}</p>}
      {uploadErr && <p className="text-[11px] font-semibold text-[#A12626]">{uploadErr}</p>}

      {/* Upload options */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          id={`file-${id}`}
          accept="image/*"
          onChange={handleFile}
          className="hidden"
        />
        <label
          htmlFor={`file-${id}`}
          className="btn-outline !py-1.5 !px-3 text-[12px] inline-flex items-center gap-1.5 cursor-pointer"
        >
          {uploading ? (
            <>
              <span className="w-3 h-3 border-2 border-[color:var(--color-myntra-navy)] border-t-transparent rounded-full animate-spin" />
              Compressing…
            </>
          ) : (
            <>
              <Upload className="w-3.5 h-3.5" /> Upload Image
            </>
          )}
        </label>

        {/* Camera capture for mobile */}
        <input
          type="file"
          id={`camera-${id}`}
          accept="image/*"
          capture="environment"
          onChange={handleFile}
          className="hidden"
        />
        <label
          htmlFor={`camera-${id}`}
          className="btn-outline !py-1.5 !px-3 text-[12px] inline-flex items-center gap-1.5 cursor-pointer sm:hidden"
        >
          <Camera className="w-3.5 h-3.5" /> Take Photo
        </label>

        {/* Quick-pick dropdown */}
        <div className="relative flex-1 min-w-[140px]">
          <select
            className="input-box !py-1.5 text-[12px] w-full"
            value=""
            onChange={e => {
              if (e.target.value) onChange(e.target.value);
            }}
          >
            <option value="">Quick-pick…</option>
            {AVAILABLE_PHOTOS.map(p => (
              <option key={p} value={p}>
                {p.split('/').pop()}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

/* ───────────── category badge ───────────── */

const categoryBadge = (cat: Fabric['category']): string => {
  switch (cat) {
    case 'Fabrics':
      return 'bg-[#E8F2E8] text-[#2F6E2F] border-[#C9DFC9]';
    case 'Dyeable Fabrics':
      return 'bg-[#E8EEF6] text-[#274C8A] border-[#C4D2E8]';
    case 'Laces':
      return 'bg-[#F1ECF7] text-[#5C3A8E] border-[#D6C9E9]';
    case 'Sarees':
      return 'bg-[#FDEEF2] text-[#A2275A] border-[#F5C8D6]';
    case 'Lehenga Cholis':
      return 'bg-[#FBF2E1] text-[#8B5A14] border-[#EFDDB5]';
    case 'Anarkalis':
      return 'bg-[#F1E8DC] text-[#7A4F1F] border-[#DEC9AA]';
    case 'Western Wear':
      return 'bg-[#E8E8E8] text-[#3A3A3A] border-[#D0D0D0]';
    case 'Studios Prêt':
      return 'bg-[#E0E0E0] text-[#4A4A4A] border-[#B8B8B8]';
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
  const [barcoding, setBarcoding] = useState(false);
  const [labelDesignId, setLabelDesignId] = useState<string>(() => THERMAL_SIZES[0].id);

  /**
   * Allocate the barcode now, not on save.
   *
   * A barcode needs a number and nothing else — not a photograph, not a saved
   * document. Making the operator save first meant a piece could not be tagged
   * and put on the shelf in one pass, which is the whole job. The number is
   * reserved from the shared counter the moment this is clicked, so the label
   * can be printed and stuck on before the form is even submitted.
   *
   * It is never re-generated: once a code is on a printed label, changing it
   * would make the shelf and the till disagree.
   */
  const onGenerateBarcode = async () => {
    if (draft.barcode || barcoding) return;
    setBarcoding(true);
    try {
      onChange({ ...draft, barcode: await reserveBarcode() });
    } catch (err) {
      // "Missing or insufficient permissions" is Firestore's wording and tells
      // the operator nothing they can act on.
      const raw = err instanceof Error ? err.message : String(err ?? '');
      window.alert(
        /insufficient permissions/i.test(raw)
          ? 'Could not allocate a barcode: this account is not an admin on this project, '
            + 'or it needs to sign out and back in so its admin claim refreshes.'
          : raw || 'Could not allocate a barcode.',
      );
    } finally {
      setBarcoding(false);
    }
  };

  /**
   * One label for this piece.
   *
   * A thermal roll gets a PNG at the print head's exact dot width, because
   * these printers take a bitmap and feed it — hand one an A4 page and its app
   * shrinks the whole sheet onto the roll, which is how a barcode ends up a
   * few millimetres wide and unscannable. Sheet stock gets the print dialog,
   * where "Save as PDF" is the download.
   */
  const onDownloadLabel = async () => {
    try {
      const product = draftToFabric(draft);
      if (isThermal(labelDesignId)) {
        await downloadThermalLabel(product, { size: thermalById(labelDesignId) });
      } else {
        await printSingleLabel(product, designById(labelDesignId));
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not produce the label.');
    }
  };

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    onChange({ ...draft, [key]: value });

  /**
   * Adding the photograph is what publishes a draft.
   *
   * That is the whole point of allowing photo-less products: the piece is
   * registered now and goes live the day it is shot. Doing it here, as the
   * image lands, means the operator SEES the status change to "On the website"
   * before pressing save — a silent promotion at save time would be a surprise,
   * and one they can still undo with the select right below.
   *
   * Removing a photo does the reverse: a live product cannot lose its only
   * image and stay live.
   */
  const setPhoto = (value: string) => {
    const had = draft.photo.trim().length > 0;
    const has = value.trim().length > 0;
    if (!had && has && draft.listingStatus === 'Draft') {
      onChange({ ...draft, photo: value, listingStatus: 'Active' });
      return;
    }
    if (had && !has && draft.listingStatus === 'Active') {
      onChange({ ...draft, photo: value, listingStatus: 'Draft' });
      return;
    }
    set('photo', value);
  };

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

      {/* general error banner */}
      {errors._general && (
        <div className="mx-5 sm:mx-6 mt-4 flex items-start gap-2 rounded-md border border-[#F0C7C7] bg-[#FBE6E6] p-3 text-[#A12626]">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="text-[12px] font-semibold leading-relaxed">{errors._general}</p>
        </div>
      )}

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
            <Field label="Product Code" error={errors.productCode}>
              <input
                className="input-box"
                value={draft.productCode}
                onChange={e => set('productCode', e.target.value)}
                placeholder="HA6758"
              />
            </Field>
            <Field label="Category" error={errors.category}>
              <select
                aria-label="Category"
                className="input-box"
                value={draft.category}
                onChange={e => {
                  const next = e.target.value as Fabric['category'] | '';
                  const nextDraft: Draft = { ...draft, category: next };
                  if (next !== 'Laces') {
                    // Non-lace products are always unit-based
                    nextDraft.unitType = '';
                    nextDraft.sellingPricePerMeter = '';
                    nextDraft.bundleSizeMeters = '';
                    nextDraft.bundlePrice = '';
                  }
                  onChange(nextDraft);
                }}
              >
                <option value="">— Select —</option>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
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
            {draft.category === 'Laces' ? (
              <Field label="Unit Type">
                <select
                  className="input-box"
                  value={draft.unitType}
                  onChange={e => set('unitType', e.target.value as Fabric['unitType'] | '')}
                >
                  <option value="">Unit (default)</option>
                  <option value="per meter">Per meter</option>
                  <option value="bundle">Bundle of meters</option>
                </select>
              </Field>
            ) : (
              <Field label="Unit Type">
                <input
                  className="input-box bg-[color:var(--color-myntra-bg-soft)] text-[color:var(--color-myntra-ink-mute)]"
                  value="Unit (sold per piece)"
                  disabled
                />
              </Field>
            )}
            <Field label="Cost Price (₹)" error={errors.costPrice}>
              <input
                type="number"
                min={0}
                className="input-box"
                value={draft.costPrice}
                onChange={e => set('costPrice', e.target.value)}
                placeholder="Buying cost"
              />
            </Field>
            <Field label="Stock" error={errors.stock}>
              <input
                type="number"
                min={0}
                aria-label="Stock"
                className="input-box"
                value={draft.stock}
                onChange={e => set('stock', e.target.value)}
              />
            </Field>
            <Field label="Price (₹)" error={errors.price}>
              <input
                type="number"
                min={0}
                aria-label="Price"
                className="input-box"
                value={draft.price}
                onChange={e => set('price', e.target.value)}
              />
            </Field>
            <Field label="MRP (₹)" error={errors.mrp}>
              <input
                type="number"
                min={0}
                aria-label="MRP"
                className="input-box"
                value={draft.mrp}
                onChange={e => set('mrp', e.target.value)}
              />
            </Field>
          </div>

          {/* Laces / metered pricing */}
          {draft.category === 'Laces' && (draft.unitType === 'per meter' || draft.unitType === 'bundle') && (
            <div className="mt-4 border border-[color:var(--color-myntra-border-soft)] rounded-md p-3 bg-[color:var(--color-myntra-bg-soft)]">
              <div className="flex items-center gap-2 mb-2 text-[color:var(--color-myntra-navy)]">
                <Ruler className="w-4 h-4" />
                <span className="text-[12px] font-bold uppercase tracking-[0.12em]">Laces / Metered Pricing</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Field label="Selling Price per Meter (₹)" error={errors.sellingPricePerMeter}>
                  <input
                    type="number"
                    min={0}
                    className="input-box"
                    value={draft.sellingPricePerMeter}
                    onChange={e => set('sellingPricePerMeter', e.target.value)}
                  />
                </Field>
                {draft.unitType === 'bundle' && (
                  <>
                    <Field label="Bundle Size (meters)" error={errors.bundleSizeMeters}>
                      <input
                        type="number"
                        min={0}
                        className="input-box"
                        value={draft.bundleSizeMeters}
                        onChange={e => set('bundleSizeMeters', e.target.value)}
                        placeholder="e.g. 9"
                      />
                    </Field>
                    <Field label="Bundle Price (₹)" error={errors.bundlePrice}>
                      <input
                        type="number"
                        min={0}
                        className="input-box"
                        value={draft.bundlePrice}
                        onChange={e => set('bundlePrice', e.target.value)}
                      />
                    </Field>
                  </>
                )}
              </div>
            </div>
          )}

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
          <div className="space-y-4">
            <ImageUpload
              id="main"
              label="Main Photo"
              value={draft.photo}
              onChange={setPhoto}
              error={errors.photo}
            />
            {!draft.photo.trim() && (
              <p className="text-[11px] text-[color:var(--color-myntra-ink-soft)] -mt-2">
                No photo yet? Save anyway. The product is created with a barcode and counts for
                stock and counter billing — it simply stays off the website until you add the
                photograph here, which publishes it.
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {([
                ['gallery1', draft.gallery1, 'Gallery 1'],
                ['gallery2', draft.gallery2, 'Gallery 2'],
                ['gallery3', draft.gallery3, 'Gallery 3']
              ] as [keyof Draft, string, string][]).map(([k, v, label]) => (
                <ImageUpload
                  key={String(k)}
                  id={String(k)}
                  label={label}
                  value={v}
                  onChange={val => set(k, val as Draft[typeof k])}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Publishing */}
        <section>
          <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--color-myntra-ink-mute)] mb-3">
            Publishing &amp; Barcode
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            <Field label="Listing status">
              <select
                aria-label="Listing status"
                className="input-box"
                value={draft.listingStatus}
                onChange={e => set('listingStatus', e.target.value as Draft['listingStatus'])}
              >
                <option value="Active">On the website</option>
                <option value="Draft">Draft — not on the website</option>
                <option value="Retired">Retired</option>
              </select>
              <p className="mt-1.5 text-[11px] text-[color:var(--color-myntra-ink-soft)]">
                {draft.listingStatus === 'Active'
                  ? 'Shoppers can find and buy this piece.'
                  : draft.listingStatus === 'Draft'
                    ? 'Saved in the system with its stock and barcode, and sellable at the counter — but no shopper sees it.'
                    : 'Taken down. Existing orders keep their record.'}
              </p>
            </Field>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--color-myntra-ink-mute)] mb-2">
                Barcode
              </label>
              {draft.barcode ? (
                <div className="border border-[color:var(--color-myntra-border-soft)] rounded p-3 bg-white">
                  {/* The real encoder, so what is previewed is exactly what prints. */}
                  <div
                    className="[&>svg]:block [&>svg]:w-full [&>svg]:h-auto"
                    dangerouslySetInnerHTML={{ __html: code128Svg(draft.barcode, { height: 34 }) }}
                  />
                  <p className="mt-1 font-mono text-[12px] tracking-[0.08em] text-[color:var(--color-myntra-navy)]">
                    {draft.barcode}
                  </p>
                </div>
              ) : (
                <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] border border-dashed border-[color:var(--color-myntra-border-soft)] rounded p-3">
                  No barcode yet. Generate one now — it needs nothing but the name and price,
                  and it is allocated automatically if you save without it.
                </p>
              )}

              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onGenerateBarcode}
                  disabled={Boolean(draft.barcode) || barcoding}
                  title={draft.barcode ? 'This piece already has a barcode — a code never changes once printed.' : 'Allocate the next code'}
                  className="btn-outline !py-1.5 !px-3 text-[12px] inline-flex items-center gap-1.5 disabled:opacity-40"
                >
                  <Barcode className="w-3.5 h-3.5" /> {barcoding ? 'Generating…' : 'Generate barcode'}
                </button>

                <select
                  aria-label="Label design"
                  value={labelDesignId}
                  onChange={e => setLabelDesignId(e.target.value)}
                  className="input-box !py-1.5 text-[12px] flex-1 min-w-[140px]"
                >
                  <optgroup label="Thermal printer">
                    {THERMAL_SIZES.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Sheet labels (A4)">
                    {LABEL_DESIGNS.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </optgroup>
                </select>

                <button
                  type="button"
                  onClick={onDownloadLabel}
                  disabled={!draft.barcode}
                  title={draft.barcode ? 'Opens the print dialog — choose "Save as PDF" to download' : 'Generate a barcode first'}
                  className="btn-outline !py-1.5 !px-3 text-[12px] inline-flex items-center gap-1.5 disabled:opacity-40"
                >
                  <Download className="w-3.5 h-3.5" /> Download label {isThermal(labelDesignId) ? '(PNG)' : '(PDF)'}
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-[color:var(--color-myntra-ink-soft)]">
                {isThermal(labelDesignId)
                  ? `Saves a ${thermalById(labelDesignId).dots}-pixel image — exactly the width of a ${thermalById(labelDesignId).rollMm}mm print head. Open it from your printer's app and print at 100%, no scaling.`
                  : designById(labelDesignId).blurb}
              </p>
            </div>
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
  error: string | null;
  onCancel: () => void;
  onDelete: () => void;
}

const Confirm: React.FC<ConfirmProps> = ({ name, busy, error, onCancel, onDelete }) => (
  <div className="bg-white rounded-md max-w-sm w-full mx-auto p-5 shadow-2xl border border-[color:var(--color-myntra-border-soft)]">
    <h3 className="text-[15px] font-extrabold text-[color:var(--color-myntra-navy)] mb-1">
      Delete product?
    </h3>
    <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)]">
      Delete <span className="font-semibold text-[color:var(--color-myntra-navy)]">{name}</span>?
      This cannot be undone.
    </p>

    {/* Delete error banner */}
    {error && (
      <div className="mt-3 flex items-start gap-2 rounded-md border border-[#F0C7C7] bg-[#FBE6E6] p-2.5 text-[#A12626]">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <p className="text-[11px] font-semibold leading-relaxed">{error}</p>
      </div>
    )}

    <div className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
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

/* ───────────── bulk action confirm ───────────── */

interface ActionConfirmProps {
  action: 'wipe' | 'seed-laces' | null;
  busy: boolean;
  error: string | null;
  success: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

const ACTION_TITLES: Record<'wipe' | 'seed-laces', string> = {
  wipe: 'Wipe all products?',
  'seed-laces': 'Seed laces catalogue?'
};

const ACTION_BODIES: Record<'wipe' | 'seed-laces', string> = {
  wipe: 'This will permanently delete every product from the database. The storefront and home screen will show 0 products.',
  'seed-laces': 'This will add the 34 lace products from the PPTX catalogue. Existing products with the same code will be overwritten.'
};

const ActionConfirm: React.FC<ActionConfirmProps> = ({ action, busy, error, success, onCancel, onConfirm }) => {
  if (!action) return null;
  return (
    <div className="bg-white rounded-md max-w-sm w-full mx-auto p-5 shadow-2xl border border-[color:var(--color-myntra-border-soft)]">
      <h3 className="text-[15px] font-extrabold text-[color:var(--color-myntra-navy)] mb-1">
        {ACTION_TITLES[action]}
      </h3>
      <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)]">
        {ACTION_BODIES[action]}
      </p>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-[#F0C7C7] bg-[#FBE6E6] p-2.5 text-[#A12626]">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="text-[11px] font-semibold leading-relaxed">{error}</p>
        </div>
      )}
      {success && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-[#C9DFC9] bg-[#E8F2E8] p-2.5 text-[#2F6E2F]">
          <Check className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="text-[11px] font-semibold leading-relaxed">{success}</p>
        </div>
      )}

      <div className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <button onClick={onCancel} disabled={busy} className="btn-outline !py-2">
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={busy || success != null}
          className="!py-2 !px-4 rounded-md font-bold text-white text-[13px] inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
          style={{ backgroundColor: action === 'wipe' ? '#A12626' : 'var(--color-myntra-navy, #282c3f)' }}
        >
          {busy ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Working…
            </>
          ) : (
            <>
              {action === 'wipe' ? <Trash2 className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
              {action === 'wipe' ? 'Wipe' : 'Seed'}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

/* ───────────── main page ───────────── */

type CategoryFilter = Fabric['category'] | 'all';

const AdminProducts: React.FC = () => {
  const [rows, setRows] = useState<Fabric[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(null);
    (async () => {
      try {
        const list = (await productsApi.list({ limit: 500 })) as unknown as Fabric[];
        if (!cancelled) setRows(list);
      } catch (err) {
        if (!cancelled) {
          setRows([]);
          setFetchError(err instanceof Error ? err.message : 'Failed to load products');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState<CategoryFilter>('all');
  const [lacesShowcase, setLacesShowcase] = useState(false);
  /** "Waiting for photos" — the queue a bulk import or a photo-less save fills. */
  const [needsPhoto, setNeedsPhoto] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingExisting, setEditingExisting] = useState<Fabric | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [saving, setSaving] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<Fabric | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [pendingAction, setPendingAction] = useState<'wipe' | 'seed-laces' | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  /* filter rows */
  const effectiveCat = lacesShowcase ? 'Laces' : catFilter;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(f => {
      if (effectiveCat !== 'all' && f.category !== effectiveCat) return false;
      if (needsPhoto && !awaitingPhoto(f)) return false;
      if (!q) return true;
      return (
        f.name.toLowerCase().includes(q) ||
        (f.productCode ?? '').toLowerCase().includes(q) ||
        f.brand.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q)
      );
    });
  }, [rows, query, effectiveCat, needsPhoto]);

  const awaitingCount = useMemo(() => rows.filter(awaitingPhoto).length, [rows]);

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
      // Every product gets a scannable code, allocated here rather than typed:
      // the number comes from one shared counter so the admin console and a
      // bulk import can never hand out the same one. Allocated on save, not on
      // open, so abandoning a half-filled form does not burn a number.
      let working = draft;
      if (!working.barcode.trim()) {
        const barcode = await reserveBarcode();
        working = { ...working, barcode };
        setDraft(d => ({ ...d, barcode }));
      }

      const record = draftToFabric(working, editingExisting ?? undefined);
      const { id, ...payload } = record;
      const cleaned = cleanPayload(payload as unknown as Record<string, unknown>);
      const sizeKB = payloadSizeKB(cleaned);
      if (sizeKB > 950) {
        setErrors(prev => ({ ...prev, _general: `Product data is ${Math.round(sizeKB)}KB — too large for Firestore (max ~950KB). Remove or shrink images and try again.` }));
        return;
      }
      if (editingExisting) {
        await productsApi.update(editingExisting.id, cleaned);
      } else {
        await productsApi.create({ ...cleaned, id } as unknown as Record<string, unknown>);
      }
      setEditorOpen(false);
      setEditingExisting(null);
      setReloadKey(k => k + 1);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Save failed';
      setErrors(prev => ({ ...prev, _general: message }));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await productsApi.remove(pendingDelete.id);
      setPendingDelete(null);
      setReloadKey(k => k + 1);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Delete failed — check Firestore rules';
      setDeleteError(message);
    } finally {
      setDeleting(false);
    }
  };

  const cancelDelete = () => {
    if (deleting) return;
    setPendingDelete(null);
    setDeleteError(null);
  };

  /* bulk destructive actions */
  const cancelAction = () => {
    if (actionBusy) return;
    setPendingAction(null);
    setActionError(null);
    setActionSuccess(null);
  };

  const runPendingAction = async () => {
    if (!pendingAction || actionBusy) return;
    setActionBusy(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      if (pendingAction === 'wipe') {
        const deleted = await productsApi.removeAll();
        setActionSuccess(`Wiped ${deleted} product${deleted === 1 ? '' : 's'}.`);
      } else if (pendingAction === 'seed-laces') {
        const seeded = await productsApi.seedWithIds(LACE_SEED as unknown as Record<string, unknown>[]);
        setActionSuccess(`Seeded ${seeded} lace product${seeded === 1 ? '' : 's'}.`);
      }
      setReloadKey(k => k + 1);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Action failed';
      setActionError(message);
    } finally {
      setActionBusy(false);
    }
  };

  /* export products CSV — laces product codes are used as the product ID column */
  const exportCsv = () => {
    const headers = [
      'Product ID',
      'Product Code',
      'Brand',
      'Name',
      'Category',
      'Unit Type',
      'Bundle Size (meters)',
      'Price per Meter (₹)',
      'Bundle Price (₹)',
      'Price (₹)',
      'MRP (₹)',
      'Cost Price (₹)',
      'Stock',
      'Stock Status'
    ];
    const data = filtered.map(f => {
      const s = f.stock ?? 0;
      const lowStock = s > 0 && s < 10;
      const status = s <= 0 ? 'Out of stock' : lowStock ? 'Low stock' : 'In stock';
      return [
        f.category === 'Laces' ? (f.productCode ?? f.id) : f.id,
        f.productCode ?? '',
        f.brand,
        f.name,
        f.category,
        f.unitType ?? 'unit',
        f.bundleSizeMeters ?? '',
        f.sellingPricePerMeter ?? '',
        f.bundlePrice ?? '',
        f.price,
        f.mrp,
        f.costPrice ?? '',
        s,
        status
      ];
    });
    downloadCsv(`tresor-products-${new Date().toISOString().slice(0, 10)}`, toCsv(headers, data));
  };

  /* keyboard: ESC closes overlays */
  useEffect(() => {
    if (!editorOpen && !pendingDelete) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (editorOpen) closeEditor();
      else if (pendingDelete && !deleting) cancelDelete();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorOpen, pendingDelete, deleting, saving]);

  /* ───────────── render ───────────── */
  return (
    <div className="space-y-4">
      {/* fetch error banner */}
      {fetchError && (
        <div className="flex items-start gap-2 rounded-md border border-[#F0C7C7] bg-[#FBE6E6] p-3 text-[#A12626]">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-[12px] font-semibold leading-relaxed">{fetchError}</p>
            <button
              onClick={() => setReloadKey(k => k + 1)}
              className="mt-1.5 text-[11px] font-bold underline"
            >
              Retry
            </button>
          </div>
        </div>
      )}

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
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:items-center">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-myntra-ink-mute)]" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search name, brand, category…"
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
                className="input-box pl-9 pr-3 w-full sm:w-[180px]"
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
            <button
              onClick={() => setNeedsPhoto(v => !v)}
              disabled={!awaitingCount && !needsPhoto}
              title="Products saved without a photograph. They are barcoded and sellable at the counter, but not on the website."
              className={`btn-outline inline-flex items-center justify-center gap-1.5 !py-2.5 disabled:opacity-40 ${needsPhoto ? 'bg-[#FDF0E1] border-[#F0D9B5] text-[#9A5B12]' : ''}`}
            >
              <Camera className="w-4 h-4" /> Waiting for photos{awaitingCount ? ` (${awaitingCount})` : ''}
            </button>
            <button
              onClick={() => setLacesShowcase(v => !v)}
              className={`btn-outline inline-flex items-center justify-center gap-1.5 !py-2.5 ${lacesShowcase ? 'bg-[#F1ECF7] border-[#D6C9E9] text-[#5C3A8E]' : ''}`}
              title="Toggle laces meter/bundle view"
            >
              <Ruler className="w-4 h-4" /> {lacesShowcase ? 'Hide Laces View' : 'Showcase Laces'}
            </button>
            <button
              onClick={exportCsv}
              className="btn-outline inline-flex items-center justify-center gap-1.5 !py-2.5"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <button
              onClick={() => { setPendingAction('seed-laces'); setActionError(null); setActionSuccess(null); }}
              className="btn-outline inline-flex items-center justify-center gap-1.5 !py-2.5"
              title="Seed laces from PPTX catalogue"
            >
              <Upload className="w-4 h-4" /> Seed Laces
            </button>
            <button
              onClick={() => { setPendingAction('wipe'); setActionError(null); setActionSuccess(null); }}
              className="inline-flex items-center justify-center gap-1.5 !py-2.5 rounded-md font-bold text-white text-[13px] border border-[#F0C7C7] transition-colors disabled:opacity-60"
              style={{ backgroundColor: '#A12626' }}
              title="Delete all products"
            >
              <Trash2 className="w-4 h-4" /> Wipe DB
            </button>
          </div>
        </div>
      </div>

      {/* laces showcase banner */}
      {lacesShowcase && (
        <div className="bg-[#F1ECF7] border border-[#D6C9E9] rounded-md p-3 flex items-center gap-2 text-[#5C3A8E]">
          <Ruler className="w-4 h-4 shrink-0" />
          <p className="text-[12px] font-semibold">
            Laces showcase is on. Stock is shown in meters/bundles and product codes are highlighted.
          </p>
        </div>
      )}

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
                    <Th className="w-[130px]">Category</Th>
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
                          {lacesShowcase && f.category === 'Laces' && (
                            <div className="text-[10px] font-bold text-[#5C3A8E] mt-0.5">
                              Code: {f.productCode ?? f.id}
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {f.listingStatus && f.listingStatus !== 'Active' && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border bg-[#FDF0E1] text-[#9A5B12] border-[#F0D9B5]">
                                {f.listingStatus === 'Draft' ? 'Draft' : 'Retired'}
                              </span>
                            )}
                            {awaitingPhoto(f) && (
                              <span className="text-[10px] font-semibold text-[color:var(--color-myntra-ink-mute)]">
                                needs a photo
                              </span>
                            )}
                            {f.barcode && (
                              <span className="text-[10px] font-mono text-[#5C3A8E]">{f.barcode}</span>
                            )}
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
                          {f.unitType === 'per meter' && Number.isFinite(f.sellingPricePerMeter as number) && (
                            <div className="text-[11px] text-[#5C3A8E] font-semibold">
                              ₹{f.sellingPricePerMeter}/m
                            </div>
                          )}
                          {f.unitType === 'bundle' && Number.isFinite(f.bundlePrice as number) && (
                            <div className="text-[11px] text-[#5C3A8E] font-semibold">
                              {f.bundleSizeMeters}m bundle @ {formatINR(f.bundlePrice as number)}
                            </div>
                          )}
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
                          <span className="text-[11px] text-[color:var(--color-myntra-ink-mute)]"> {unitLabel(f.unitType)}s</span>
                          {f.unitType === 'bundle' && Number.isFinite(f.bundleSizeMeters as number) && (
                            <div className="text-[10px] text-[#5C3A8E] font-semibold">
                              {f.bundleSizeMeters}m each
                            </div>
                          )}
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
                              onClick={() => { setPendingDelete(f); setDeleteError(null); }}
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
                      {lacesShowcase && f.category === 'Laces' && (
                        <div className="text-[10px] font-bold text-[#5C3A8E] mt-0.5">
                          Code: {f.productCode ?? f.id}
                        </div>
                      )}

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
                        {f.unitType === 'per meter' && Number.isFinite(f.sellingPricePerMeter as number) && (
                          <span className="text-[11px] text-[#5C3A8E] font-semibold">₹{f.sellingPricePerMeter}/m</span>
                        )}
                        {f.unitType === 'bundle' && Number.isFinite(f.bundlePrice as number) && (
                          <span className="text-[11px] text-[#5C3A8E] font-semibold">{f.bundleSizeMeters}m bundle</span>
                        )}
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
                          {stock} {unitLabel(f.unitType)}s in stock
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
                          onClick={() => { setPendingDelete(f); setDeleteError(null); }}
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
        <Overlay onClose={() => !deleting && cancelDelete()} z={130}>
          <Confirm
            name={pendingDelete.name}
            busy={deleting}
            error={deleteError}
            onCancel={cancelDelete}
            onDelete={confirmDelete}
          />
        </Overlay>
      )}

      {/* bulk action overlay */}
      {pendingAction && (
        <Overlay onClose={() => !actionBusy && cancelAction()} z={140}>
          <ActionConfirm
            action={pendingAction}
            busy={actionBusy}
            error={actionError}
            success={actionSuccess}
            onCancel={cancelAction}
            onConfirm={runPendingAction}
          />
        </Overlay>
      )}
    </div>
  );
};

/* ───────────── table atoms ───────────── */

const Th: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <th
    className={`text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--color-myntra-ink-mute)] ${
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