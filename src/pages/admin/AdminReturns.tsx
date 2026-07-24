import React, { useEffect, useMemo, useState } from 'react';
import { RotateCcw, Search, Filter, X, Clock, IndianRupee, Package, CheckCircle2, XCircle } from 'lucide-react';
import { returnsApi } from '../../lib/support';
import { formatINR } from '../../constants';
import type { ReturnRequest, ReturnStatus } from '../../types';

const STATUS_META: Record<ReturnStatus, { label: string; bg: string; text: string; border: string }> = {
  requested:        { label: 'Requested',        bg: '#E8F0FB', text: '#1E4FAE', border: '#C5D8F6' },
  approved:         { label: 'Approved',         bg: '#EAEAFB', text: '#4338CA', border: '#CDCDF4' },
  pickup_scheduled: { label: 'Pickup scheduled', bg: '#FDF0E1', text: '#A0561A', border: '#F4D6B5' },
  in_transit:       { label: 'In transit',       bg: '#FDF0E1', text: '#A0561A', border: '#F4D6B5' },
  received:         { label: 'Received',          bg: '#E5EFDB', text: '#3F5A26', border: '#C7D9AE' },
  refunded:         { label: 'Refunded',          bg: '#E5EFDB', text: '#3F5A26', border: '#C7D9AE' },
  replaced:         { label: 'Replaced',          bg: '#E5EFDB', text: '#3F5A26', border: '#C7D9AE' },
  rejected:         { label: 'Rejected',          bg: '#FBE6E6', text: '#A12626', border: '#F0C7C7' },
  cancelled:        { label: 'Cancelled',         bg: '#ECECEC', text: '#52525B', border: '#D4D4D8' },
  closed:           { label: 'Closed',            bg: '#ECECEC', text: '#52525B', border: '#D4D4D8' },
};

// Allowed next steps from each state — keeps the admin from skipping the workflow.
const NEXT_STEPS: Record<ReturnStatus, ReturnStatus[]> = {
  requested: ['approved', 'rejected'],
  approved: ['pickup_scheduled', 'in_transit', 'received', 'rejected'],
  pickup_scheduled: ['in_transit', 'received'],
  in_transit: ['received'],
  received: ['refunded', 'replaced'],
  refunded: ['closed'],
  replaced: ['closed'],
  rejected: ['closed'],
  cancelled: [],
  closed: [],
};

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—');
const shortId = (id: string) => `RET-${id.slice(-8).toUpperCase()}`;

const StatusPill: React.FC<{ status: ReturnStatus }> = ({ status }) => {
  const m = STATUS_META[status];
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border" style={{ background: m.bg, color: m.text, borderColor: m.border }}>
      {m.label}
    </span>
  );
};

const AdminReturns: React.FC = () => {
  const [rows, setRows] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ReturnStatus>('all');
  const [selected, setSelected] = useState<ReturnRequest | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const data = await returnsApi.all();
        if (!cancelled) setRows(data);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const counts = useMemo(() => {
    const open = rows.filter(r => ['requested', 'approved', 'pickup_scheduled', 'in_transit', 'received'].includes(r.status)).length;
    const pendingRefund = rows.filter(r => r.status === 'received').length;
    const refundedValue = rows.filter(r => r.status === 'refunded').reduce((s, r) => s + (r.refundAmount ?? 0), 0);
    return { total: rows.length, open, pendingRefund, refundedValue };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!q) return true;
      return (r.customerEmail ?? '').toLowerCase().includes(q)
        || (r.customerName ?? '').toLowerCase().includes(q)
        || r.id.toLowerCase().includes(q)
        || r.orderId.toLowerCase().includes(q);
    });
  }, [rows, query, statusFilter]);

  const refresh = () => setReloadKey(k => k + 1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Total returns" value={counts.total.toLocaleString('en-IN')} />
        <Stat label="Open" value={counts.open.toLocaleString('en-IN')} />
        <Stat label="Awaiting refund/replace" value={counts.pendingRefund.toLocaleString('en-IN')} />
        <Stat label="Refunded value" value={formatINR(counts.refundedValue)} />
      </div>

      <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <h1 className="text-[20px] font-extrabold text-[color:var(--color-myntra-navy)] inline-flex items-center gap-2"><RotateCcw className="w-5 h-5" /> Returns &amp; Refunds</h1>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-myntra-ink-mute)]" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search customer, return, order…" className="input-box pl-9 w-full sm:w-[260px]" />
          </div>
          <div className="relative">
            <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-myntra-ink-mute)] pointer-events-none" />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as 'all' | ReturnStatus)} className="input-box pl-9 w-full sm:w-[180px]">
              <option value="all">All statuses</option>
              {(Object.keys(STATUS_META) as ReturnStatus[]).map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-[14px] text-[color:var(--color-myntra-ink-soft)]">Loading returns…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-[14px] text-[color:var(--color-myntra-ink-soft)]">No returns match.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-[color:var(--color-myntra-bg-soft)] border-b border-[color:var(--color-myntra-border-soft)] text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-[color:var(--color-myntra-ink-mute)]">
                <tr>
                  <th className="px-3 py-2.5">Return</th>
                  <th className="px-3 py-2.5">Customer</th>
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5">Items</th>
                  <th className="px-3 py-2.5">Raised</th>
                  <th className="px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} onClick={() => setSelected(r)} className="border-b border-[color:var(--color-myntra-border-soft)] hover:bg-[color:var(--color-myntra-bg-soft)] cursor-pointer">
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-[color:var(--color-myntra-navy)]">{shortId(r.id)}</div>
                      <div className="text-[11px] text-[color:var(--color-myntra-ink-soft)]">Order {r.orderId.slice(0, 8).toUpperCase()}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="text-[color:var(--color-myntra-navy)]">{r.customerName ?? '—'}</div>
                      <div className="text-[11px] text-[color:var(--color-myntra-ink-soft)]">{r.customerEmail ?? '—'}</div>
                    </td>
                    <td className="px-3 py-2.5 capitalize">{r.resolution}</td>
                    <td className="px-3 py-2.5">{r.items.reduce((s, it) => s + it.quantity, 0)}</td>
                    <td className="px-3 py-2.5 text-[color:var(--color-myntra-ink-soft)]">{fmtDate(r.createdAt)}</td>
                    <td className="px-3 py-2.5"><StatusPill status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <ReturnDrawer
          key={selected.id}
          initial={selected}
          onClose={() => setSelected(null)}
          onChanged={() => { refresh(); }}
        />
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md p-4">
    <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)]">{label}</p>
    <p className="text-[22px] font-extrabold text-[color:var(--color-myntra-navy)]">{value}</p>
  </div>
);

/* ─────────── Detail drawer with the transition workflow ─────────── */

const ReturnDrawer: React.FC<{ initial: ReturnRequest; onClose: () => void; onChanged: () => void }> = ({ initial, onClose, onChanged }) => {
  const [ret, setRet] = useState<ReturnRequest>(initial);
  const [note, setNote] = useState('');
  const [refundAmount, setRefundAmount] = useState<string>(String(initial.refundAmount ?? ''));
  const [refundMethod, setRefundMethod] = useState(initial.refundMethod ?? 'Original payment method');
  const [trackingRef, setTrackingRef] = useState(initial.trackingRef ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps = NEXT_STEPS[ret.status];

  const transition = async (next: ReturnStatus) => {
    setError(null);
    setBusy(true);
    try {
      const opts: { note?: string; refundAmount?: number; refundMethod?: string; trackingRef?: string } = {};
      if (note.trim()) opts.note = note.trim();
      if (trackingRef.trim()) opts.trackingRef = trackingRef.trim();
      if (next === 'refunded') {
        const amt = Number(refundAmount);
        if (!amt || amt <= 0) { setError('Enter the refund amount before marking refunded.'); setBusy(false); return; }
        opts.refundAmount = amt;
        opts.refundMethod = refundMethod;
      }
      await returnsApi.setStatus(ret.id, next, opts);
      const fresh = await returnsApi.get(ret.id);
      if (fresh) setRet(fresh);
      setNote('');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the return.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-stretch justify-end" style={{ backgroundColor: 'rgba(20,16,24,0.55)' }} onClick={() => !busy && onClose()}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-[color:var(--color-myntra-border-soft)] px-5 py-4 flex items-start justify-between">
          <div>
            <h2 className="text-[16px] font-extrabold text-[color:var(--color-myntra-navy)]">{shortId(ret.id)}</h2>
            <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)]">Order {ret.orderId.slice(0, 8).toUpperCase()} · {fmtDate(ret.createdAt)}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded hover:bg-[color:var(--color-myntra-bg-soft)]" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex items-center justify-between">
            <StatusPill status={ret.status} />
            <span className="text-[12px] font-semibold capitalize text-[color:var(--color-myntra-ink-soft)]">{ret.resolution}</span>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-1">Customer</p>
            <p className="text-[13px] text-[color:var(--color-myntra-navy)] font-semibold">{ret.customerName ?? '—'}</p>
            <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)]">{ret.customerEmail ?? '—'}</p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-1.5 inline-flex items-center gap-1"><Package className="w-3.5 h-3.5" /> Items</p>
            <ul className="space-y-1.5">
              {ret.items.map((it, i) => (
                <li key={`${it.fabricId}-${i}`} className="text-[13px] border border-[color:var(--color-myntra-border-soft)] rounded p-2">
                  <span className="font-semibold text-[color:var(--color-myntra-navy)]">{it.name}</span> · Qty {it.quantity}
                  <span className="block text-[11px] text-[color:var(--color-myntra-ink-soft)]">{it.reason}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-1">Reason given</p>
            <p className="text-[13px] text-[color:var(--color-myntra-ink)]">{ret.reason}</p>
          </div>

          {/* Timeline */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-2 inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Timeline</p>
            <ol className="space-y-2 border-l-2 border-[color:var(--color-myntra-border-soft)] pl-3">
              {(ret.history ?? []).map((h, i) => (
                <li key={i} className="text-[12px]">
                  <span className="font-semibold text-[color:var(--color-myntra-navy)]">{STATUS_META[h.status]?.label ?? h.status}</span>
                  <span className="text-[color:var(--color-myntra-ink-mute)]"> · {fmtDate(h.at)}{h.by ? ` · ${h.by}` : ''}</span>
                  {h.note && <span className="block text-[color:var(--color-myntra-ink-soft)]">{h.note}</span>}
                </li>
              ))}
            </ol>
          </div>

          {/* Refund fields (shown when a refund step is reachable or done) */}
          {(NEXT_STEPS[ret.status].includes('refunded') || ret.status === 'refunded') && (
            <div className="bg-[color:var(--color-myntra-bg-soft)] rounded-md p-3 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] inline-flex items-center gap-1"><IndianRupee className="w-3.5 h-3.5" /> Refund</p>
              <input value={refundAmount} onChange={e => setRefundAmount(e.target.value.replace(/[^\d.]/g, ''))} placeholder="Amount (₹)" className="input-box !py-2" inputMode="decimal" disabled={ret.status === 'refunded'} />
              <select value={refundMethod} onChange={e => setRefundMethod(e.target.value)} className="input-box !py-2" disabled={ret.status === 'refunded'}>
                <option>Original payment method</option>
                <option>UPI</option>
                <option>Bank transfer</option>
                <option>Store credit</option>
              </select>
              <p className="text-[11px] text-[#9A5B12] bg-[#FDF0E1] border border-[#F0D9B5] rounded p-2">
                The gateway/bank refund is issued separately (Razorpay dashboard or bank). Marking “Refunded” records it and emails the customer.
              </p>
            </div>
          )}

          {/* Tracking ref for reverse pickup */}
          {['approved', 'pickup_scheduled', 'in_transit'].includes(ret.status) && (
            <input value={trackingRef} onChange={e => setTrackingRef(e.target.value)} placeholder="Reverse pickup / AWB reference (optional)" className="input-box !py-2" />
          )}

          {/* Note + actions */}
          {steps.length > 0 ? (
            <div className="border-t border-[color:var(--color-myntra-border-soft)] pt-4 space-y-2.5">
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Add a note to the customer (optional, emailed with the update)" className="input-box resize-none" />
              {error && <p role="alert" className="text-[12px] font-semibold text-[color:var(--color-myntra-pink)]">{error}</p>}
              <div className="flex flex-wrap gap-2">
                {steps.map(s => {
                  const isReject = s === 'rejected';
                  const Icon = isReject ? XCircle : CheckCircle2;
                  return (
                    <button
                      key={s}
                      onClick={() => void transition(s)}
                      disabled={busy}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md font-bold text-[12px] disabled:opacity-60 ${
                        isReject
                          ? 'border border-[#F0C7C7] text-[#A12626] bg-white hover:bg-[#FBE6E6]'
                          : 'bg-[color:var(--color-myntra-pink)] text-white hover:bg-[color:var(--color-myntra-pink-dark)]'
                      }`}
                    >
                      <Icon className="w-4 h-4" /> {STATUS_META[s].label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-[12px] text-[color:var(--color-myntra-ink-mute)] border-t border-[color:var(--color-myntra-border-soft)] pt-4">This return is closed. No further action.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminReturns;
