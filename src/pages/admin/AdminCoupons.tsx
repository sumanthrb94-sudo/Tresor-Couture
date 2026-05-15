import React, { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Tag, X } from 'lucide-react';
import type { Coupon, CouponKind } from '../../types';
import { couponsStore } from '../../data/storage';
import { useStore } from '../../data/useStore';
import { formatINR } from '../../constants';
import type { BaseRecord } from '../../data/storage';

type CouponRow = Coupon & BaseRecord;

interface FormState {
  code: string;
  description: string;
  kind: CouponKind;
  value: string;
  minSubtotal: string;
  maxDiscount: string;
  expiresAt: string;
  active: boolean;
}

const emptyForm: FormState = {
  code: '',
  description: '',
  kind: 'percent',
  value: '',
  minSubtotal: '',
  maxDiscount: '',
  expiresAt: '',
  active: true
};

const toFormState = (c: CouponRow): FormState => ({
  code: c.code,
  description: c.description,
  kind: c.kind,
  value: String(c.value),
  minSubtotal: c.minSubtotal !== undefined ? String(c.minSubtotal) : '',
  maxDiscount: c.maxDiscount !== undefined ? String(c.maxDiscount) : '',
  expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : '',
  active: c.active
});

const formatExpiry = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const describeKindValue = (c: CouponRow): string => {
  if (c.kind === 'percent') {
    const cap = c.maxDiscount ? `, max ${formatINR(c.maxDiscount)}` : '';
    return `${c.value}% off${cap}`;
  }
  return `${formatINR(c.value)} flat`;
};

const AdminCoupons: React.FC = () => {
  const { rows: coupons, loading } = useStore(couponsStore);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyToggleId, setBusyToggleId] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...coupons].sort((a, b) => a.code.localeCompare(b.code)),
    [coupons]
  );

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (c: CouponRow) => {
    setEditingId(c.id);
    setForm(toFormState(c));
    setError(null);
    setModalOpen(true);
  };

  const close = () => {
    if (saving) return;
    setModalOpen(false);
    setError(null);
  };

  const toggleActive = async (c: CouponRow) => {
    setBusyToggleId(c.id);
    try {
      await couponsStore.update(c.id, { active: !c.active });
    } finally {
      setBusyToggleId(null);
    }
  };

  const handleDelete = async (c: CouponRow) => {
    if (!window.confirm(`Delete coupon ${c.code}? This cannot be undone.`)) return;
    await couponsStore.remove(c.id);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const code = form.code.trim().toUpperCase();
    if (!code) {
      setError('Coupon code is required.');
      return;
    }
    if (!/^[A-Z0-9_-]+$/.test(code)) {
      setError('Code may only contain letters, numbers, hyphen and underscore.');
      return;
    }
    if (!form.description.trim()) {
      setError('Description is required.');
      return;
    }
    const valueNum = Number(form.value);
    if (!Number.isFinite(valueNum) || valueNum <= 0) {
      setError('Value must be a positive number.');
      return;
    }
    if (form.kind === 'percent' && valueNum > 100) {
      setError('Percent value cannot exceed 100.');
      return;
    }

    const minSubtotalNum = form.minSubtotal.trim() === '' ? undefined : Number(form.minSubtotal);
    if (minSubtotalNum !== undefined && (!Number.isFinite(minSubtotalNum) || minSubtotalNum < 0)) {
      setError('Minimum subtotal must be zero or positive.');
      return;
    }
    const maxDiscountNum = form.maxDiscount.trim() === '' ? undefined : Number(form.maxDiscount);
    if (maxDiscountNum !== undefined && (!Number.isFinite(maxDiscountNum) || maxDiscountNum <= 0)) {
      setError('Max discount must be a positive number.');
      return;
    }

    let expiresAtIso: string | undefined;
    if (form.expiresAt.trim() !== '') {
      const d = new Date(form.expiresAt + 'T23:59:59');
      if (Number.isNaN(d.getTime())) {
        setError('Invalid expiry date.');
        return;
      }
      expiresAtIso = d.toISOString();
    }

    if (!editingId) {
      const dupe = coupons.some(c => c.code.toUpperCase() === code);
      if (dupe) {
        setError('A coupon with that code already exists.');
        return;
      }
    }

    setSaving(true);
    try {
      const record: CouponRow = {
        id: code,
        code,
        description: form.description.trim(),
        kind: form.kind,
        value: valueNum,
        minSubtotal: minSubtotalNum,
        maxDiscount: maxDiscountNum,
        expiresAt: expiresAtIso,
        active: form.active
      };
      await couponsStore.upsert(record);
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save coupon.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-[20px] md:text-[22px] font-extrabold text-[color:var(--color-myntra-navy)] leading-tight">
            Coupons
          </h1>
          <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] mt-0.5">
            {coupons.length} coupon{coupons.length === 1 ? '' : 's'} configured
          </p>
        </div>
        <button type="button" onClick={openAdd} className="btn-primary inline-flex items-center gap-2 self-start md:self-auto">
          <Plus className="w-4 h-4" /> Add Coupon
        </button>
      </div>

      {/* Body */}
      {loading ? (
        <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md p-10 text-center text-[13px] text-[color:var(--color-myntra-ink-soft)]">
          Loading coupons…
        </div>
      ) : sorted.length === 0 ? (
        <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md p-10 md:p-14 text-center">
          <Tag className="w-10 h-10 mx-auto text-[color:var(--color-myntra-ink-mute)] mb-3" />
          <h2 className="text-[16px] font-extrabold text-[color:var(--color-myntra-navy)] mb-1">No coupons yet</h2>
          <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] mb-5">
            Create your first promo code to surface it in the customer cart.
          </p>
          <button type="button" onClick={openAdd} className="btn-primary inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Create coupon
          </button>
        </div>
      ) : (
        <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[color:var(--color-myntra-bg-soft)] text-[11px] uppercase tracking-wider font-bold text-[color:var(--color-myntra-ink-soft)]">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Type & Value</th>
                  <th className="px-4 py-3">Min Subtotal</th>
                  <th className="px-4 py-3">Expires</th>
                  <th className="px-4 py-3">Active</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--color-myntra-border-soft)]">
                {sorted.map(c => (
                  <tr key={c.id} className="text-[13px]">
                    <td className="px-4 py-3">
                      <span className="font-extrabold uppercase tracking-wider text-[color:var(--color-myntra-navy)]">
                        {c.code}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[color:var(--color-myntra-ink)] max-w-[280px]">
                      {c.description}
                    </td>
                    <td className="px-4 py-3 text-[color:var(--color-myntra-ink)]">{describeKindValue(c)}</td>
                    <td className="px-4 py-3 text-[color:var(--color-myntra-ink)]">
                      {c.minSubtotal && c.minSubtotal > 0 ? formatINR(c.minSubtotal) : '—'}
                    </td>
                    <td className="px-4 py-3 text-[color:var(--color-myntra-ink)]">{formatExpiry(c.expiresAt)}</td>
                    <td className="px-4 py-3">
                      <ToggleSwitch
                        checked={c.active}
                        disabled={busyToggleId === c.id}
                        onChange={() => toggleActive(c)}
                        ariaLabel={`Toggle ${c.code}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => openEdit(c)}
                          className="inline-flex items-center gap-1 text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-navy)] hover:text-[color:var(--color-myntra-pink)]"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(c)}
                          className="inline-flex items-center gap-1 text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] hover:text-[color:var(--color-myntra-pink)]"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="md:hidden divide-y divide-[color:var(--color-myntra-border-soft)]">
            {sorted.map(c => (
              <li key={c.id} className="p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="font-extrabold uppercase tracking-wider text-[14px] text-[color:var(--color-myntra-navy)]">
                      {c.code}
                    </p>
                    <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)]">{c.description}</p>
                  </div>
                  <ToggleSwitch
                    checked={c.active}
                    disabled={busyToggleId === c.id}
                    onChange={() => toggleActive(c)}
                    ariaLabel={`Toggle ${c.code}`}
                  />
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] mb-3">
                  <dt className="text-[color:var(--color-myntra-ink-soft)]">Value</dt>
                  <dd className="font-semibold">{describeKindValue(c)}</dd>
                  <dt className="text-[color:var(--color-myntra-ink-soft)]">Min subtotal</dt>
                  <dd className="font-semibold">{c.minSubtotal && c.minSubtotal > 0 ? formatINR(c.minSubtotal) : '—'}</dd>
                  <dt className="text-[color:var(--color-myntra-ink-soft)]">Expires</dt>
                  <dd className="font-semibold">{formatExpiry(c.expiresAt)}</dd>
                </dl>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => openEdit(c)}
                    className="inline-flex items-center gap-1 text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-navy)]"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(c)}
                    className="inline-flex items-center gap-1 text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)]"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3 md:p-6"
          role="dialog"
          aria-modal="true"
          onClick={close}
        >
          <form
            onSubmit={handleSave}
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-md w-full max-w-lg max-h-[90vh] overflow-y-auto border border-[color:var(--color-myntra-border-soft)] shadow-lg"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--color-myntra-border-soft)]">
              <h2 className="font-[family-name:var(--font-display)] text-[18px] font-extrabold text-[color:var(--color-myntra-navy)]">
                {editingId ? 'Edit coupon' : 'New coupon'}
              </h2>
              <button
                type="button"
                onClick={close}
                disabled={saving}
                className="text-[color:var(--color-myntra-ink-soft)] hover:text-[color:var(--color-myntra-navy)]"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-4 flex flex-col gap-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] block mb-1.5">
                  Code
                </label>
                <input
                  value={form.code}
                  onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. SUMMER25"
                  disabled={Boolean(editingId)}
                  className="input-box w-full uppercase tracking-wider font-bold disabled:bg-[color:var(--color-myntra-bg-soft)] disabled:cursor-not-allowed"
                />
                {editingId && (
                  <p className="text-[11px] text-[color:var(--color-myntra-ink-mute)] mt-1">Code cannot be changed after creation.</p>
                )}
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] block mb-1.5">
                  Description
                </label>
                <input
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Shown to customers in the cart"
                  className="input-box w-full"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] block mb-1.5">
                  Type
                </label>
                <div className="flex gap-2">
                  {(['percent', 'flat'] as const).map(k => (
                    <label
                      key={k}
                      className={`flex items-center gap-2 px-3 py-2 border rounded cursor-pointer flex-1 text-[13px] font-semibold transition-colors ${
                        form.kind === k
                          ? 'border-[color:var(--color-myntra-pink)] bg-[color:var(--color-myntra-bg-soft)] text-[color:var(--color-myntra-pink)]'
                          : 'border-[color:var(--color-myntra-border)] text-[color:var(--color-myntra-ink)]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="kind"
                        value={k}
                        checked={form.kind === k}
                        onChange={() => setForm({ ...form, kind: k })}
                        className="accent-[color:var(--color-myntra-pink)]"
                      />
                      {k === 'percent' ? 'Percent off' : 'Flat amount'}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] block mb-1.5">
                    Value {form.kind === 'percent' ? '(%)' : '(₹)'}
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={form.kind === 'percent' ? 1 : 50}
                    value={form.value}
                    onChange={e => setForm({ ...form, value: e.target.value })}
                    className="input-box w-full"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] block mb-1.5">
                    Min subtotal (₹, optional)
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={100}
                    value={form.minSubtotal}
                    onChange={e => setForm({ ...form, minSubtotal: e.target.value })}
                    className="input-box w-full"
                  />
                </div>
                {form.kind === 'percent' && (
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] block mb-1.5">
                      Max discount (₹, optional)
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={100}
                      value={form.maxDiscount}
                      onChange={e => setForm({ ...form, maxDiscount: e.target.value })}
                      className="input-box w-full"
                    />
                  </div>
                )}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] block mb-1.5">
                    Expires on (optional)
                  </label>
                  <input
                    type="date"
                    value={form.expiresAt}
                    onChange={e => setForm({ ...form, expiresAt: e.target.value })}
                    className="input-box w-full"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div>
                  <p className="text-[13px] font-bold text-[color:var(--color-myntra-navy)]">Active</p>
                  <p className="text-[11px] text-[color:var(--color-myntra-ink-soft)]">Customers can apply this code when toggled on.</p>
                </div>
                <ToggleSwitch
                  checked={form.active}
                  onChange={() => setForm({ ...form, active: !form.active })}
                  ariaLabel="Active toggle"
                />
              </div>

              {error && (
                <div className="text-[12px] font-semibold text-[color:var(--color-myntra-pink)]">{error}</div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[color:var(--color-myntra-border-soft)] bg-[color:var(--color-myntra-bg-soft)]">
              <button type="button" onClick={close} disabled={saving} className="btn-outline">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create coupon'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

interface ToggleSwitchProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  ariaLabel?: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange, disabled, ariaLabel }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    onClick={onChange}
    disabled={disabled}
    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
      checked ? 'bg-[color:var(--color-myntra-green)]' : 'bg-[color:var(--color-myntra-border)]'
    } ${disabled ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-4' : 'translate-x-0.5'
      }`}
    />
  </button>
);

export default AdminCoupons;
