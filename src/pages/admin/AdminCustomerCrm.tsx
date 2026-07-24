import React, { useEffect, useState } from 'react';
import { Tag, X, Plus, StickyNote, Activity, RotateCcw, Trash2 } from 'lucide-react';
import { crmApi, returnsApi } from '../../lib/support';
import { useAuth } from '../../context/AuthContext';
import type { CustomerCrm, CustomerLifecycle, ReturnRequest } from '../../types';

const LIFECYCLES: { value: CustomerLifecycle; label: string; color: string }[] = [
  { value: 'lead',    label: 'Lead',     color: '#1E4FAE' },
  { value: 'active',  label: 'Active',   color: '#3F5A26' },
  { value: 'vip',     label: 'VIP',      color: '#8A5A00' },
  { value: 'at_risk', label: 'At risk',  color: '#A0561A' },
  { value: 'churned', label: 'Churned',  color: '#A12626' },
];

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—');

/**
 * Admin-only CRM overlay for a single customer: lifecycle stage, tags, internal
 * notes, and a returns timeline. Self-contained — loads its own data from the
 * `crm` and `returns` collections.
 */
const AdminCustomerCrm: React.FC<{ uid: string; customerName: string }> = ({ uid, customerName }) => {
  const { user } = useAuth();
  const author = user?.fullName || user?.email || 'Admin';

  const [crm, setCrm] = useState<CustomerCrm | null>(null);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const [tagInput, setTagInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [c, r] = await Promise.all([
        crmApi.get(uid).catch(() => null),
        returnsApi.forUser(uid).catch(() => [] as ReturnRequest[]),
      ]);
      if (cancelled) return;
      setCrm(c);
      setReturns(r);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [uid]);

  const lifecycle = crm?.lifecycle ?? 'active';
  const tags = crm?.tags ?? [];
  const notes = crm?.notes ?? [];

  const setLifecycle = async (value: CustomerLifecycle) => {
    setBusy(true);
    try {
      await crmApi.setLifecycle(uid, value);
      setCrm(prev => ({ uid, tags: prev?.tags ?? [], notes: prev?.notes ?? [], lifecycle: value }));
    } finally { setBusy(false); }
  };

  const addTag = async () => {
    const t = tagInput.trim();
    if (!t || tags.includes(t)) { setTagInput(''); return; }
    const next = [...tags, t].slice(0, 20);
    setTagInput('');
    setBusy(true);
    try {
      await crmApi.setTags(uid, next);
      setCrm(prev => ({ uid, lifecycle: prev?.lifecycle ?? 'active', notes: prev?.notes ?? [], tags: next }));
    } finally { setBusy(false); }
  };

  const removeTag = async (t: string) => {
    const next = tags.filter(x => x !== t);
    setBusy(true);
    try {
      await crmApi.setTags(uid, next);
      setCrm(prev => ({ uid, lifecycle: prev?.lifecycle ?? 'active', notes: prev?.notes ?? [], tags: next }));
    } finally { setBusy(false); }
  };

  const addNote = async () => {
    const text = noteInput.trim();
    if (!text) return;
    setNoteInput('');
    setBusy(true);
    try {
      const next = await crmApi.addNote(uid, text, author);
      setCrm(next);
    } finally { setBusy(false); }
  };

  const removeNote = async (id: string) => {
    setBusy(true);
    try {
      await crmApi.removeNote(uid, id);
      setCrm(prev => (prev ? { ...prev, notes: prev.notes.filter(n => n.id !== id) } : prev));
    } finally { setBusy(false); }
  };

  if (loading) {
    return <div className="text-[12px] text-[color:var(--color-myntra-ink-soft)] py-3">Loading CRM…</div>;
  }

  return (
    <div className="space-y-5">
      {/* Lifecycle */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-2 inline-flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> Lifecycle stage</p>
        <div className="flex flex-wrap gap-1.5">
          {LIFECYCLES.map(l => (
            <button
              key={l.value}
              onClick={() => void setLifecycle(l.value)}
              disabled={busy}
              className="px-2.5 py-1 rounded-full text-[11px] font-bold border disabled:opacity-60"
              style={lifecycle === l.value
                ? { background: l.color, color: '#fff', borderColor: l.color }
                : { background: '#fff', color: l.color, borderColor: '#E3D9C6' }}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-2 inline-flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" /> Tags</p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.length === 0 && <span className="text-[12px] text-[color:var(--color-myntra-ink-mute)]">No tags yet.</span>}
          {tags.map(t => (
            <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[color:var(--color-myntra-bg-soft)] border border-[color:var(--color-myntra-border-soft)] text-[color:var(--color-myntra-navy)]">
              {t}
              <button onClick={() => void removeTag(t)} disabled={busy} aria-label={`Remove ${t}`} className="hover:text-[color:var(--color-myntra-pink)]"><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void addTag(); } }}
            placeholder="Add a tag (e.g. bridal, wholesale)…"
            className="input-box !py-1.5 text-[12px]"
          />
          <button onClick={() => void addTag()} disabled={busy || !tagInput.trim()} className="btn-outline !py-1.5 !px-2.5 inline-flex items-center gap-1 text-[12px] disabled:opacity-60"><Plus className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* Notes */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-2 inline-flex items-center gap-1.5"><StickyNote className="w-3.5 h-3.5" /> Internal notes</p>
        <div className="flex gap-2 mb-2">
          <textarea
            value={noteInput}
            onChange={e => setNoteInput(e.target.value)}
            rows={2}
            placeholder={`Add a note about ${customerName}…`}
            className="input-box resize-none text-[12px]"
          />
          <button onClick={() => void addNote()} disabled={busy || !noteInput.trim()} className="btn-primary !py-1.5 !px-3 self-start text-[12px] disabled:opacity-60">Add</button>
        </div>
        <ul className="space-y-2">
          {notes.length === 0 && <li className="text-[12px] text-[color:var(--color-myntra-ink-mute)]">No notes yet.</li>}
          {notes.map(n => (
            <li key={n.id} className="border border-[color:var(--color-myntra-border-soft)] rounded p-2.5">
              <p className="text-[12px] text-[color:var(--color-myntra-ink)] whitespace-pre-wrap">{n.text}</p>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[10px] text-[color:var(--color-myntra-ink-mute)]">{n.author} · {fmt(n.at)}</span>
                <button onClick={() => void removeNote(n.id)} disabled={busy} className="text-[color:var(--color-myntra-ink-mute)] hover:text-[color:var(--color-myntra-pink)]" aria-label="Delete note"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Returns timeline */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-2">Returns</p>
        {returns.length === 0 ? (
          <p className="text-[12px] text-[color:var(--color-myntra-ink-mute)]">No returns.</p>
        ) : (
          <ul className="space-y-1.5">
            {returns.map(r => (
              <li key={`r-${r.id}`} className="flex items-center gap-2 text-[12px] text-[color:var(--color-myntra-ink-soft)]">
                <RotateCcw className="w-3.5 h-3.5 text-[color:var(--color-myntra-pink)] shrink-0" />
                Return {r.id.slice(-6).toUpperCase()} · <span className="capitalize">{r.status.replace('_', ' ')}</span> · {fmt(r.createdAt)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AdminCustomerCrm;
