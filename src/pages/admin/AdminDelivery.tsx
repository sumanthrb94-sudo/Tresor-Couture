import React, { useEffect, useMemo, useState } from 'react';
import { Zap, Save, RotateCcw, Loader2, MapPin } from 'lucide-react';
import { deliveryConfigApi } from '../../lib/firebase';
import {
  SEED_SERVICEABLE_PINCODES,
  STORE_HUB,
  DELIVERY_RADIUS_KM,
  DELIVERY_PROMISE_MINUTES,
  isValidPincode,
} from '../../lib/serviceability';

/**
 * Admin editor for the 40-minute-delivery serviceable pincode list
 * (Firestore `config/delivery`). Edits as free text (one pincode per line or
 * comma/space separated); validates + de-dupes on save. Falls back to the
 * seed list display when nothing is stored yet.
 */
const parsePincodes = (raw: string): { valid: string[]; invalid: string[] } => {
  const tokens = raw.split(/[\s,]+/).map(t => t.trim()).filter(Boolean);
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const t of tokens) {
    if (isValidPincode(t)) { if (!valid.includes(t)) valid.push(t); }
    else invalid.push(t);
  }
  return { valid: valid.sort(), invalid };
};

const AdminDelivery: React.FC = () => {
  const [text, setText] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [usingSeed, setUsingSeed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    deliveryConfigApi.get().then(cfg => {
      if (cancelled) return;
      if (cfg && cfg.pincodes.length) {
        setText(cfg.pincodes.join('\n'));
      } else {
        setText(SEED_SERVICEABLE_PINCODES.join('\n'));
        setUsingSeed(true);
      }
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  const { valid, invalid } = useMemo(() => parsePincodes(text), [text]);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await deliveryConfigApi.setPincodes(valid);
      setUsingSeed(false);
      setMsg({ ok: true, text: `Saved ${valid.length} serviceable pincode${valid.length === 1 ? '' : 's'}.` });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Could not save. Are you signed in as admin?' });
    } finally {
      setSaving(false);
    }
  };

  const resetToSeed = () => {
    setText(SEED_SERVICEABLE_PINCODES.join('\n'));
    setMsg(null);
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 mb-1">
        <Zap className="w-5 h-5 text-[color:var(--color-myntra-pink)]" />
        <h1 className="text-xl font-extrabold text-[color:var(--color-myntra-navy)]">{DELIVERY_PROMISE_MINUTES}-Minute Delivery</h1>
      </div>
      <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] mb-5">
        Manage which Hyderabad pincodes qualify for express delivery. Customers outside
        this list (and outside the {DELIVERY_RADIUS_KM} km radius of the hub) fall back
        to standard shipping — they are never blocked from ordering.
      </p>

      <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-lg p-4 mb-4">
        <div className="flex items-center gap-2 text-[13px] text-[color:var(--color-myntra-ink-soft)] mb-3">
          <MapPin className="w-4 h-4 text-[color:var(--color-myntra-navy)]" />
          Hub: <span className="font-semibold text-[color:var(--color-myntra-navy)]">{STORE_HUB.label}</span>
          <span className="text-[color:var(--color-myntra-ink-mute)]">({STORE_HUB.lat}, {STORE_HUB.lng}) · radius {DELIVERY_RADIUS_KM} km</span>
        </div>

        {!loaded ? (
          <div className="flex items-center gap-2 text-[13px] text-[color:var(--color-myntra-ink-soft)] py-6">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            {usingSeed && (
              <p className="text-[12px] text-[color:var(--color-myntra-pink)] font-semibold mb-2">
                No saved list yet — showing the built-in seed list. Save to persist your own.
              </p>
            )}
            <label className="block text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-1.5">
              Serviceable pincodes (one per line, or comma/space separated)
            </label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={12}
              className="input-box w-full font-mono text-[13px] leading-relaxed"
              placeholder="500001&#10;500016&#10;500034"
            />
            <div className="flex flex-wrap items-center gap-3 mt-3 text-[12px]">
              <span className="text-[color:var(--color-myntra-green)] font-semibold">{valid.length} valid</span>
              {invalid.length > 0 && (
                <span className="text-[color:var(--color-myntra-pink)] font-semibold">
                  {invalid.length} invalid (ignored): {invalid.slice(0, 5).join(', ')}{invalid.length > 5 ? '…' : ''}
                </span>
              )}
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={save} disabled={saving || valid.length === 0} className="btn-primary inline-flex items-center gap-1.5 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save list
              </button>
              <button onClick={resetToSeed} disabled={saving} className="btn-outline inline-flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4" /> Reset to seed
              </button>
            </div>

            {msg && (
              <p className={`text-[13px] mt-3 font-semibold ${msg.ok ? 'text-[color:var(--color-myntra-green)]' : 'text-[color:var(--color-myntra-pink)]'}`}>
                {msg.text}
              </p>
            )}
          </>
        )}
      </div>

      <p className="text-[12px] text-[color:var(--color-myntra-ink-mute)]">
        Note: this is the software serviceability layer. Actual 40-minute fulfilment also
        requires a stocked dark store, packing SLA, and a last-mile rider partner — see
        <span className="font-mono"> docs/DELIVERY-OPS.md</span>.
      </p>
    </div>
  );
};

export default AdminDelivery;
