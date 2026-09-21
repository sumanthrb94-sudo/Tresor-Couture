/**
 * /supplier — where a consignment partner hands over a delivery.
 *
 * The shape of this form is the point. A supplier does not think in rows of a
 * spreadsheet; they think "this design, in these six colours". So the form is
 * nested the same way: one card per DESIGN, carrying the things that are true
 * of every colour of it (its name, what it is, how it is sold, the bundle
 * terms), and inside it one row per COLOUR carrying only what actually differs
 * — the colour's name, its numbers, and its photographs.
 *
 * That nesting is also what produces the grouping the storefront needs. A
 * design gets ONE style code, minted here, and every colour inside it inherits
 * it; the shop then shows one card reading "6 colours" instead of six
 * near-identical tiles. Asking a supplier to type a matching style code on six
 * separate spreadsheet rows is asking for the typo that splits one design in
 * two.
 *
 * Nothing here writes to `products`. A submission is raw material: an admin
 * reviews it in Admin -> Intake and imports it, which is where barcodes are
 * minted and prices become real. A supplier cannot publish to the storefront.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus, Trash2, Upload, Loader2, AlertCircle, CheckCircle2, Send, Save, X, Package,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../context/RouterContext';
import { intakeApi, isSupplierUser } from '../lib/firebase';
import { compressImage } from '../lib/compressImage';
import { CATEGORIES, MASTER_CATEGORY_TREE } from '../constants';
import type { IntakeColour, IntakeSubmission } from '../types';

/** Photographs per colour. Four is a front, a back, a close-up and a drape —
 *  past that the document approaches the 1MB Firestore cap. */
const MAX_PHOTOS = 4;
/** Matches the rules cap, so the form can never build a document that is
 *  rejected only once the supplier presses save. */
const MAX_COLOURS = 12;

const blankColour = (): IntakeColour => ({
  colourName: '', cost: '', price: '', mrp: '', stock: '', photos: [],
});

const blankDesign = (): Omit<IntakeSubmission, 'id' | 'userId' | 'createdAt' | 'updatedAt'> => ({
  designName: '',
  category: 'Laces',
  subCategory: '',
  styleCode: '',
  unitType: '',
  bundleSizeMeters: '',
  bundlePrice: '',
  notes: '',
  colours: [blankColour()],
  status: 'draft',
});

/**
 * Derive a style code from the design name: "Beaded Floral Vine" -> "TC-BFV".
 *
 * Suggested, never forced — the supplier can overwrite it. The value is that
 * every colour of one design gets the SAME code without anyone typing it twice,
 * which is the only thing the storefront grouping actually depends on.
 */
const suggestStyleCode = (designName: string): string => {
  const initials = designName
    .trim()
    .split(/\s+/)
    .filter(w => /[a-z0-9]/i.test(w))
    .slice(0, 4)
    .map(w => w[0].toUpperCase())
    .join('');
  return initials ? `TC-${initials}` : '';
};

const money = (v: string): number | undefined => {
  const n = Number(String(v).replace(/[₹,\s]/g, ''));
  return v.trim() !== '' && Number.isFinite(n) ? n : undefined;
};

/** What the supplier still has to do before this design can be handed over. */
function problemsWith(d: IntakeSubmission | ReturnType<typeof blankDesign>): string[] {
  const out: string[] = [];
  if (!d.designName.trim()) out.push('the design needs a name');
  if (!d.colours.length) out.push('add at least one colour');
  const named = d.colours.filter(c => c.colourName.trim() || c.price.trim() || c.photos.length);
  if (!named.length) out.push('fill in at least one colour');
  named.forEach((c, i) => {
    const label = c.colourName.trim() || `colour ${i + 1}`;
    if (!c.colourName.trim()) out.push(`${label} needs a colour name`);
    if (money(c.price) === undefined) out.push(`${label} needs a price`);
    if (!c.photos.length) out.push(`${label} needs at least one photo`);
  });
  if (d.unitType === 'bundle') {
    if (money(d.bundleSizeMeters) === undefined) out.push('bundle size is missing');
    if (money(d.bundlePrice) === undefined) out.push('bundle price is missing');
  }
  return out;
}

/* ───────────── photo strip ───────────── */

const PhotoStrip: React.FC<{
  photos: string[];
  disabled?: boolean;
  onChange: (next: string[]) => void;
  label: string;
}> = ({ photos, disabled, onChange, label }) => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setErr(null);
    setBusy(true);
    try {
      const room = MAX_PHOTOS - photos.length;
      const chosen = Array.from(files).slice(0, Math.max(0, room));
      if (files.length > room) {
        setErr(`Only ${MAX_PHOTOS} photos per colour — the extra ${files.length - room} were not added.`);
      }
      const shots = await Promise.all(chosen.map(f => compressImage(f)));
      onChange([...photos, ...shots]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'That photo could not be read. Try another file.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {photos.map((p, i) => (
          <div key={i} className="relative w-16 h-20 rounded-md overflow-hidden border border-[color:var(--color-myntra-border-soft)] bg-white">
            <img src={p} alt={`${label} photo ${i + 1}`} className="w-full h-full object-cover" />
            {i === 0 && (
              <span className="absolute inset-x-0 bottom-0 text-[8px] font-bold uppercase tracking-wide text-center text-white bg-[color:var(--color-myntra-navy)]/80 py-px">
                Main
              </span>
            )}
            {!disabled && (
              <button
                type="button"
                onClick={() => onChange(photos.filter((_, j) => j !== i))}
                aria-label={`Remove ${label} photo ${i + 1}`}
                className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-white/95 border border-[color:var(--color-myntra-border-soft)] flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
        {!disabled && photos.length < MAX_PHOTOS && (
          <label className="w-16 h-20 rounded-md border border-dashed border-[color:var(--color-myntra-border)] flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-[color:var(--color-myntra-bg-soft)] text-[color:var(--color-myntra-ink-mute)]">
            {busy
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <><Upload className="w-4 h-4" /><span className="text-[9px] font-semibold">Photo</span></>}
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              aria-label={`Add a photo of ${label}`}
              onChange={e => { void addFiles(e.target.files); e.target.value = ''; }}
            />
          </label>
        )}
      </div>
      {err && <p className="text-[11px] text-[#A12626] mt-1">{err}</p>}
    </div>
  );
};

/* ───────────── one design ───────────── */

type DesignDraft = IntakeSubmission | (ReturnType<typeof blankDesign> & { id?: string });

const DesignCard: React.FC<{
  draft: DesignDraft;
  onChange: (patch: Partial<IntakeSubmission>) => void;
  onSave: (status: 'draft' | 'submitted') => void;
  onDelete: () => void;
  saving: boolean;
}> = ({ draft, onChange, onSave, onDelete, saving }) => {
  const locked = draft.status === 'imported';
  const handed = draft.status === 'submitted';
  const problems = useMemo(() => problemsWith(draft), [draft]);
  const subs = MASTER_CATEGORY_TREE[draft.category as keyof typeof MASTER_CATEGORY_TREE] ?? [];

  const setColour = (i: number, patch: Partial<IntakeColour>) =>
    onChange({ colours: draft.colours.map((c, j) => (j === i ? { ...c, ...patch } : c)) });

  return (
    <section className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-lg overflow-hidden">
      <header className="px-4 py-3 border-b border-[color:var(--color-myntra-border-soft)] flex flex-wrap items-center gap-2">
        <Package className="w-4 h-4 text-[color:var(--color-myntra-pink)]" />
        <h2 className="text-[13px] font-extrabold uppercase tracking-[0.1em] text-[color:var(--color-myntra-navy)]">
          {draft.designName.trim() || 'New design'}
        </h2>
        {locked && (
          <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[color:var(--color-myntra-green)] text-white">
            Added to catalogue
          </span>
        )}
        {handed && !locked && (
          <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[color:var(--color-myntra-bg-sale)] text-[color:var(--color-myntra-ink)]">
            Sent — with the studio
          </span>
        )}
        {!locked && (
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Remove ${draft.designName.trim() || 'this design'}`}
            className="ml-auto text-[color:var(--color-myntra-ink-mute)] hover:text-[#A12626]"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </header>

      <div className="p-4 space-y-4">
        {/* What is true of every colour of this design. */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label className="block col-span-2">
            <span className="block text-[11px] font-bold uppercase tracking-wide text-[color:var(--color-myntra-ink-mute)] mb-1">
              Design name
            </span>
            <input
              value={draft.designName}
              disabled={locked}
              onChange={e => {
                const designName = e.target.value;
                // Fill the style code only while the supplier has not set one
                // themselves — retyping the name must never silently rewrite a
                // code they chose deliberately.
                const auto = !draft.styleCode.trim() || draft.styleCode === suggestStyleCode(draft.designName);
                onChange(auto ? { designName, styleCode: suggestStyleCode(designName) } : { designName });
              }}
              placeholder="Beaded Floral Vine Border"
              className="input-box w-full disabled:opacity-60"
            />
          </label>
          <label className="block">
            <span className="block text-[11px] font-bold uppercase tracking-wide text-[color:var(--color-myntra-ink-mute)] mb-1">
              Category
            </span>
            <select
              value={draft.category}
              disabled={locked}
              onChange={e => onChange({ category: e.target.value, subCategory: '' })}
              className="input-box w-full disabled:opacity-60"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-[11px] font-bold uppercase tracking-wide text-[color:var(--color-myntra-ink-mute)] mb-1">
              Type
            </span>
            <input
              value={draft.subCategory}
              disabled={locked}
              onChange={e => onChange({ subCategory: e.target.value })}
              list={`subs-${draft.id ?? 'new'}`}
              placeholder="Bridal Border"
              className="input-box w-full disabled:opacity-60"
            />
            <datalist id={`subs-${draft.id ?? 'new'}`}>
              {subs.map(s => <option key={s} value={s} />)}
            </datalist>
          </label>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label className="block">
            <span className="block text-[11px] font-bold uppercase tracking-wide text-[color:var(--color-myntra-ink-mute)] mb-1">
              Sold as
            </span>
            <select
              value={draft.unitType}
              disabled={locked}
              onChange={e => onChange({ unitType: e.target.value as IntakeSubmission['unitType'] })}
              className="input-box w-full disabled:opacity-60"
            >
              <option value="">Choose…</option>
              <option value="unit">Per piece</option>
              <option value="per meter">By the metre</option>
              <option value="bundle">By the metre, with a bundle rate</option>
            </select>
          </label>
          {draft.unitType === 'bundle' && (
            <>
              <label className="block">
                <span className="block text-[11px] font-bold uppercase tracking-wide text-[color:var(--color-myntra-ink-mute)] mb-1">
                  Metres in a bundle
                </span>
                <input
                  value={draft.bundleSizeMeters}
                  disabled={locked}
                  onChange={e => onChange({ bundleSizeMeters: e.target.value })}
                  inputMode="numeric" placeholder="9"
                  className="input-box w-full disabled:opacity-60"
                />
              </label>
              <label className="block">
                <span className="block text-[11px] font-bold uppercase tracking-wide text-[color:var(--color-myntra-ink-mute)] mb-1">
                  Price for a whole bundle ₹
                </span>
                <input
                  value={draft.bundlePrice}
                  disabled={locked}
                  onChange={e => onChange({ bundlePrice: e.target.value })}
                  inputMode="numeric" placeholder="1800"
                  className="input-box w-full disabled:opacity-60"
                />
              </label>
            </>
          )}
          <label className="block">
            <span className="block text-[11px] font-bold uppercase tracking-wide text-[color:var(--color-myntra-ink-mute)] mb-1">
              Design code
            </span>
            <input
              value={draft.styleCode}
              disabled={locked}
              onChange={e => onChange({ styleCode: e.target.value })}
              placeholder="TC-BFV"
              className="input-box w-full disabled:opacity-60"
            />
          </label>
        </div>

        {(draft.unitType === 'per meter' || draft.unitType === 'bundle') && (
          <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] bg-[color:var(--color-myntra-bg-soft)] rounded-md px-3 py-2">
            Because this is sold by the metre: <b>Price</b> below is for <b>one metre</b>, and{' '}
            <b>Stock</b> is <b>how many metres</b> you have — not how many bundles.
          </p>
        )}

        {/* One row per colour. */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--color-myntra-ink-mute)]">
              Colours in this design
            </h3>
            <span className="text-[11px] text-[color:var(--color-myntra-ink-mute)]">
              {draft.colours.length} of {MAX_COLOURS}
            </span>
          </div>

          <div className="space-y-3">
            {draft.colours.map((c, i) => (
              <div key={i} className="border border-[color:var(--color-myntra-border-soft)] rounded-md p-3 bg-[color:var(--color-myntra-bg-soft)]/40">
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-2">
                  <label className="block col-span-2">
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-[color:var(--color-myntra-ink-mute)] mb-1">Colour</span>
                    <input value={c.colourName} disabled={locked}
                      onChange={e => setColour(i, { colourName: e.target.value })}
                      placeholder="Emerald" aria-label={`Colour name, colour ${i + 1}`}
                      className="input-box w-full disabled:opacity-60" />
                  </label>
                  <label className="block">
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-[color:var(--color-myntra-ink-mute)] mb-1">Your cost ₹</span>
                    <input value={c.cost} disabled={locked} inputMode="numeric"
                      onChange={e => setColour(i, { cost: e.target.value })}
                      aria-label={`Cost, colour ${i + 1}`} className="input-box w-full disabled:opacity-60" />
                  </label>
                  <label className="block">
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-[color:var(--color-myntra-ink-mute)] mb-1">
                      Price ₹{draft.unitType === 'per meter' || draft.unitType === 'bundle' ? ' / m' : ''}
                    </span>
                    <input value={c.price} disabled={locked} inputMode="numeric"
                      onChange={e => setColour(i, { price: e.target.value })}
                      aria-label={`Price, colour ${i + 1}`} className="input-box w-full disabled:opacity-60" />
                  </label>
                  <label className="block">
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-[color:var(--color-myntra-ink-mute)] mb-1">MRP ₹</span>
                    <input value={c.mrp} disabled={locked} inputMode="numeric" placeholder="= price"
                      onChange={e => setColour(i, { mrp: e.target.value })}
                      aria-label={`M R P, colour ${i + 1}`} className="input-box w-full disabled:opacity-60" />
                  </label>
                  <label className="block">
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-[color:var(--color-myntra-ink-mute)] mb-1">
                      Stock{draft.unitType === 'per meter' || draft.unitType === 'bundle' ? ' (m)' : ''}
                    </span>
                    <input value={c.stock} disabled={locked} inputMode="numeric"
                      onChange={e => setColour(i, { stock: e.target.value })}
                      aria-label={`Stock, colour ${i + 1}`} className="input-box w-full disabled:opacity-60" />
                  </label>
                </div>

                <div className="flex items-end justify-between gap-3">
                  <PhotoStrip
                    photos={c.photos}
                    disabled={locked}
                    label={c.colourName.trim() || `colour ${i + 1}`}
                    onChange={photos => setColour(i, { photos })}
                  />
                  {!locked && draft.colours.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onChange({ colours: draft.colours.filter((_, j) => j !== i) })}
                      aria-label={`Remove colour ${i + 1}`}
                      className="text-[11px] font-semibold text-[color:var(--color-myntra-ink-mute)] hover:text-[#A12626] shrink-0"
                    >
                      Remove colour
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {!locked && draft.colours.length < MAX_COLOURS && (
            <button
              type="button"
              onClick={() => onChange({ colours: [...draft.colours, blankColour()] })}
              className="btn-outline !py-1.5 !px-3 text-[12px] inline-flex items-center gap-1.5 mt-3"
            >
              <Plus className="w-3.5 h-3.5" /> Another colour of this design
            </button>
          )}
        </div>

        <label className="block">
          <span className="block text-[11px] font-bold uppercase tracking-wide text-[color:var(--color-myntra-ink-mute)] mb-1">
            Anything we should know
          </span>
          <textarea
            value={draft.notes}
            disabled={locked}
            onChange={e => onChange({ notes: e.target.value })}
            rows={2}
            placeholder="Width, backing, how long a repeat order takes…"
            className="input-box w-full disabled:opacity-60"
          />
        </label>

        {!locked && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => onSave('draft')}
              disabled={saving}
              className="btn-outline !py-1.5 !px-3 text-[12px] inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save for later
            </button>
            <button
              type="button"
              onClick={() => onSave('submitted')}
              disabled={saving || problems.length > 0}
              className="btn-primary !py-1.5 !px-3 text-[12px] inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" /> Send to the studio
            </button>
            {problems.length > 0 && (
              <span className="text-[11px] text-[color:var(--color-myntra-ink-soft)]">
                Before sending: {problems.slice(0, 3).join(', ')}
                {problems.length > 3 ? `, and ${problems.length - 3} more` : ''}.
              </span>
            )}
            {handed && (
              <span className="text-[11px] text-[color:var(--color-myntra-ink-soft)]">
                Already sent — saving again updates it.
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

/* ───────────── page ───────────── */

const SupplierIntakePage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { navigate } = useRouter();

  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<DesignDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setAllowed(false); setLoading(false); return; }
    let live = true;
    void (async () => {
      const ok = await isSupplierUser().catch(() => false);
      if (!live) return;
      setAllowed(ok);
      if (!ok) { setLoading(false); return; }
      try {
        const mine = await intakeApi.mine();
        if (!live) return;
        setRows(mine as unknown as IntakeSubmission[]);
      } catch {
        if (live) setError('Could not load your submissions. Check your connection and reload.');
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, [authLoading, user]);

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 4000);
    return () => window.clearTimeout(t);
  }, [flash]);

  const patchRow = useCallback((idx: number, patch: Partial<IntakeSubmission>) => {
    setRows(prev => prev.map((r, i) => (i === idx ? { ...r, ...patch } as DesignDraft : r)));
  }, []);

  const saveRow = async (idx: number, status: 'draft' | 'submitted') => {
    const row = rows[idx];
    const key = row.id ?? `new-${idx}`;
    setSavingId(key);
    setError(null);
    try {
      const payload = {
        designName: row.designName.trim(),
        category: row.category,
        subCategory: row.subCategory.trim(),
        // Upper-cased here so two colours of one design cannot land under
        // "tc-bfv" and "TC-BFV" and be shown as two separate designs.
        styleCode: row.styleCode.trim().toUpperCase(),
        unitType: row.unitType,
        bundleSizeMeters: row.bundleSizeMeters.trim(),
        bundlePrice: row.bundlePrice.trim(),
        notes: row.notes.trim(),
        colours: row.colours,
        status,
      };
      if (row.id) {
        await intakeApi.update(row.id, payload);
        patchRow(idx, { ...payload, updatedAt: new Date().toISOString() } as Partial<IntakeSubmission>);
      } else {
        const created = await intakeApi.create(payload);
        patchRow(idx, created as unknown as Partial<IntakeSubmission>);
      }
      setFlash(status === 'submitted'
        ? `"${payload.designName}" is with the studio.`
        : `"${payload.designName}" saved — come back to it any time.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setError(
        /permission|insufficient/i.test(msg)
          ? 'The studio has not enabled submissions on this account yet. Ask them to switch it on, then sign out and back in.'
          : 'Could not save that. Your photos may be too large — remove one and try again.',
      );
    } finally {
      setSavingId(null);
    }
  };

  const deleteRow = async (idx: number) => {
    const row = rows[idx];
    if (row.id && row.status !== 'draft') {
      setError('That one is already with the studio — ask them to remove it.');
      return;
    }
    try {
      if (row.id) await intakeApi.remove(row.id);
      setRows(prev => prev.filter((_, i) => i !== idx));
    } catch {
      setError('Could not remove that one.');
    }
  };

  if (authLoading || (loading && allowed !== false)) {
    return (
      <main className="pt-[110px] pb-16 min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[color:var(--color-myntra-pink)]" aria-label="Loading" />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="pt-[110px] pb-16 px-4 max-w-md mx-auto text-center">
        <h1 className="text-[20px] font-extrabold text-[color:var(--color-myntra-navy)] mb-2">Consignment form</h1>
        <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] mb-4">
          Sign in with the account the studio set up for you.
        </p>
        <button onClick={() => navigate({ name: 'login' })} className="btn-primary">Sign in</button>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="pt-[110px] pb-16 px-4 max-w-md mx-auto text-center">
        <h1 className="text-[20px] font-extrabold text-[color:var(--color-myntra-navy)] mb-2">Not enabled yet</h1>
        <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)]">
          This account can't submit stock yet. Ask the studio to enable it for{' '}
          <b className="text-[color:var(--color-myntra-navy)]">{user.email}</b>, then sign out and sign back in.
        </p>
      </main>
    );
  }

  return (
    <main className="pt-[100px] pb-20 px-4 max-w-4xl mx-auto">
      <header className="mb-5">
        <h1 className="text-[22px] font-extrabold text-[color:var(--color-myntra-navy)]">Send us your stock</h1>
        <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] mt-1 max-w-prose">
          One card per design. Put every colour of that design inside its own card — that is what lets the
          shop show them together instead of as separate products. Save as you go; nothing is published
          until the studio reviews it.
        </p>
      </header>

      {flash && (
        <p className="mb-4 text-[12px] text-[color:var(--color-myntra-green)] flex items-center gap-1.5 font-semibold">
          <CheckCircle2 className="w-4 h-4" /> {flash}
        </p>
      )}
      {error && (
        <p role="alert" className="mb-4 text-[12px] text-[#A12626] flex items-start gap-1.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-px" /> {error}
        </p>
      )}

      <div className="space-y-4">
        {rows.map((row, i) => (
          <DesignCard
            key={row.id ?? `new-${i}`}
            draft={row}
            saving={savingId === (row.id ?? `new-${i}`)}
            onChange={patch => patchRow(i, patch)}
            onSave={status => void saveRow(i, status)}
            onDelete={() => void deleteRow(i)}
          />
        ))}
      </div>

      {rows.length === 0 && (
        <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] py-6">
          Nothing here yet. Add your first design below.
        </p>
      )}

      <button
        type="button"
        onClick={() => setRows(prev => [...prev, blankDesign() as DesignDraft])}
        className="btn-outline mt-4 inline-flex items-center gap-2"
      >
        <Plus className="w-4 h-4" /> Add a design
      </button>
    </main>
  );
};

export default SupplierIntakePage;
