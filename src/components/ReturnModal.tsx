import React, { useMemo, useState } from 'react';
import { X, RotateCcw, PackageCheck, AlertCircle } from 'lucide-react';
import { returnsApi } from '../lib/support';
import { formatINR } from '../constants';
import FabricImage from './FabricImage';
import useBodyScrollLock from '../hooks/useBodyScrollLock';
import type { Order, ReturnLineItem, ReturnRequest, ReturnResolution } from '../types';

const REASONS = [
  'Wrong item received',
  'Damaged or defective',
  'Not as described',
  'Quality not as expected',
  'Size or fit issue',
  'Changed my mind',
  'Other',
];

interface Props {
  order: Order;
  /** Returns already raised on this order — units already covered are locked out. */
  existingReturns?: ReturnRequest[];
  onClose: () => void;
  onSubmitted: (created: ReturnRequest) => void;
}

interface Selection {
  checked: boolean;
  quantity: number;
}

/** A return is only actionable while it is not withdrawn/declined. */
const ACTIVE_STATUSES = new Set(['requested', 'approved', 'pickup_scheduled', 'in_transit', 'received', 'refunded', 'replaced', 'closed']);

const ReturnModal: React.FC<Props> = ({ order, existingReturns = [], onClose, onSubmitted }) => {
  useBodyScrollLock();

  // Units already tied up in an active return, per fabricId, so a customer can't
  // return the same piece twice.
  const alreadyReturned = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of existingReturns) {
      if (!ACTIVE_STATUSES.has(r.status)) continue;
      for (const it of r.items) map.set(it.fabricId, (map.get(it.fabricId) ?? 0) + it.quantity);
    }
    return map;
  }, [existingReturns]);

  const rows = useMemo(
    () =>
      order.items.map(it => {
        const returned = alreadyReturned.get(it.fabricId) ?? 0;
        const available = Math.max(0, (it.quantity ?? 0) - returned);
        return { it, available };
      }),
    [order.items, alreadyReturned],
  );

  const [selection, setSelection] = useState<Record<string, Selection>>(() => {
    const init: Record<string, Selection> = {};
    order.items.forEach((it, i) => {
      init[`${it.fabricId}-${i}`] = { checked: false, quantity: 1 };
    });
    return init;
  });
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [resolution, setResolution] = useState<ReturnResolution>('refund');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const anySelected = Object.values(selection).some(s => s.checked);
  const nothingReturnable = rows.every(r => r.available === 0);

  const toggle = (key: string, available: number) =>
    setSelection(prev => ({ ...prev, [key]: { ...prev[key], checked: available > 0 ? !prev[key].checked : false } }));

  const setQty = (key: string, qty: number, max: number) =>
    setSelection(prev => ({ ...prev, [key]: { ...prev[key], quantity: Math.max(1, Math.min(max, qty)) } }));

  const handleSubmit = async () => {
    setError(null);
    const items: ReturnLineItem[] = [];
    order.items.forEach((it, i) => {
      const key = `${it.fabricId}-${i}`;
      const sel = selection[key];
      const available = rows[i].available;
      if (sel?.checked && available > 0) {
        items.push({
          fabricId: it.fabricId,
          name: it.fabricSnapshot?.name ?? 'Item',
          quantity: Math.min(sel.quantity, available),
          reason: reason || 'Not specified',
        });
      }
    });
    if (items.length === 0) { setError('Select at least one item to return.'); return; }
    if (!reason) { setError('Please choose a reason.'); return; }

    setSubmitting(true);
    try {
      const overallReason = details.trim() ? `${reason} — ${details.trim()}` : reason;
      const created = await returnsApi.create({ orderId: order.id, items, resolution, reason: overallReason });
      onSubmitted(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit your request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[140] flex items-end sm:items-center justify-center sm:px-4"
      style={{ backgroundColor: 'rgba(20,16,24,0.6)' }}
      onClick={() => !submitting && onClose()}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-white w-full sm:max-w-lg sm:rounded-md max-h-[92vh] overflow-y-auto shadow-2xl"
      >
        <div className="sticky top-0 bg-white border-b border-[color:var(--color-myntra-border-soft)] px-5 py-4 flex items-center justify-between">
          <h2 className="text-[15px] font-extrabold text-[color:var(--color-myntra-navy)] inline-flex items-center gap-2">
            <RotateCcw className="w-4 h-4" /> Return or replace
          </h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-[color:var(--color-myntra-bg-soft)]" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {nothingReturnable ? (
            <div className="text-center py-8">
              <PackageCheck className="w-10 h-10 mx-auto text-[color:var(--color-myntra-ink-mute)] mb-3" />
              <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)]">
                Every item in this order already has an active return request.
              </p>
            </div>
          ) : (
            <>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-mute)] mb-2">
                  Choose items
                </p>
                <ul className="space-y-2">
                  {order.items.map((it, i) => {
                    const key = `${it.fabricId}-${i}`;
                    const sel = selection[key];
                    const available = rows[i].available;
                    const fs = it.fabricSnapshot;
                    const disabled = available === 0;
                    return (
                      <li
                        key={key}
                        className={`flex items-center gap-3 border rounded p-2.5 ${
                          sel?.checked ? 'border-[color:var(--color-myntra-pink)] bg-[color:var(--color-myntra-bg-sale)]' : 'border-[color:var(--color-myntra-border-soft)]'
                        } ${disabled ? 'opacity-50' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={!!sel?.checked}
                          disabled={disabled}
                          onChange={() => toggle(key, available)}
                          className="w-4 h-4 accent-[color:var(--color-myntra-pink)] shrink-0"
                          aria-label={`Select ${fs?.name ?? 'item'}`}
                        />
                        <div className="w-10 h-12 shrink-0 bg-[color:var(--color-myntra-bg-soft)] overflow-hidden">
                          <FabricImage photo={fs?.photo ?? ''} fallback={fs?.image ?? ''} alt={fs?.name ?? 'Item'} className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-bold text-[color:var(--color-myntra-navy)] truncate">{fs?.name ?? 'Item'}</p>
                          <p className="text-[11px] text-[color:var(--color-myntra-ink-soft)]">
                            {disabled ? 'Already in a return' : `Qty ordered ${it.quantity}`}
                            {it.color ? ` · ${it.color}` : ''} · {formatINR(fs?.price ?? 0)}
                          </p>
                        </div>
                        {sel?.checked && available > 1 && (
                          <select
                            value={sel.quantity}
                            onChange={e => setQty(key, Number(e.target.value), available)}
                            className="input-box !w-16 !py-1 text-[12px] shrink-0"
                            aria-label="Return quantity"
                          >
                            {Array.from({ length: available }, (_, n) => n + 1).map(n => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div>
                <label htmlFor="return-reason" className="block text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-mute)] mb-1.5">
                  Reason
                </label>
                <select id="return-reason" value={reason} onChange={e => setReason(e.target.value)} className="input-box">
                  <option value="">Select a reason…</option>
                  {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="return-details" className="block text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-mute)] mb-1.5">
                  Details <span className="font-medium normal-case text-[color:var(--color-myntra-ink-mute)]">(optional)</span>
                </label>
                <textarea
                  id="return-details"
                  value={details}
                  onChange={e => setDetails(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="Tell us a little more so we can help faster…"
                  className="input-box resize-none"
                />
              </div>

              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-mute)] mb-1.5">Preferred resolution</p>
                <div className="grid grid-cols-2 gap-2">
                  {([['refund', 'Refund'], ['replacement', 'Replacement']] as [ReturnResolution, string][]).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setResolution(val)}
                      className={`py-2.5 text-[13px] font-bold border rounded transition-colors ${
                        resolution === val
                          ? 'border-[color:var(--color-myntra-pink)] text-[color:var(--color-myntra-pink)] bg-[color:var(--color-myntra-bg-sale)]'
                          : 'border-[color:var(--color-myntra-border-soft)] text-[color:var(--color-myntra-ink-soft)]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <p role="alert" className="text-[12px] font-semibold text-[color:var(--color-myntra-pink)] bg-[color:var(--color-myntra-bg-sale)] border border-[color:var(--color-myntra-border)] px-3 py-2 rounded inline-flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </p>
              )}

              <p className="text-[11px] text-[color:var(--color-myntra-ink-mute)] leading-relaxed">
                Returns are accepted within 7 days of delivery for unused items in original condition. Made-to-order pieces are only returnable if damaged or defective. See our <span className="font-semibold">Refund &amp; Returns Policy</span>.
              </p>

              <div className="flex gap-2 pt-1">
                <button onClick={onClose} disabled={submitting} className="btn-outline flex-1">Cancel</button>
                <button onClick={handleSubmit} disabled={submitting || !anySelected || !reason} className="btn-primary flex-1 disabled:opacity-60">
                  {submitting ? 'Submitting…' : 'Submit request'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReturnModal;
