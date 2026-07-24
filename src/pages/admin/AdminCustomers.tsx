import React, { useEffect, useMemo, useState } from 'react';
import { Users, Search, Filter, Download, X, ShieldCheck, Trash2, FileDown, Mail, Phone } from 'lucide-react';
import { usersApi, ordersApi } from '../../lib/firebase';
import { formatINR } from '../../constants';
import { toCsv, downloadCsv, downloadJson } from '../../lib/csv';
import AdminCustomerCrm from './AdminCustomerCrm';
import type { Order } from '../../types';

interface UserDoc {
  id: string;
  uid?: string;
  email?: string;
  fullName?: string;
  phone?: string | null;
  role?: string;
  createdAt?: string;
  photoURL?: string | null;
  defaultAddress?: Record<string, string>;
}

interface CustomerRow {
  user: UserDoc;
  orders: Order[];
  spend: number;
  lastOrderAt?: string;
}

const fmtDate = (iso?: string): string =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—';

const realised = (o: Order): boolean => o.status !== 'cancelled' && o.status !== 'refunded' && !o.deletedAt;

const Overlay: React.FC<{ onClose: () => void; children: React.ReactNode }> = ({ onClose, children }) => (
  <div className="fixed inset-0 z-[120] flex items-stretch justify-end" style={{ backgroundColor: 'rgba(20,16,24,0.55)' }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} className="w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl">{children}</div>
  </div>
);

const AdminCustomers: React.FC = () => {
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'customer' | 'admin'>('all');
  const [selected, setSelected] = useState<CustomerRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CustomerRow | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [users, orders] = await Promise.all([
          usersApi.list() as unknown as Promise<UserDoc[]>,
          ordersApi.all() as unknown as Promise<Order[]>,
        ]);
        const byUser = new Map<string, Order[]>();
        for (const o of orders) {
          const uid = o.userId ?? '';
          if (!uid) continue;
          const arr = byUser.get(uid);
          if (arr) arr.push(o);
          else byUser.set(uid, [o]);
        }
        const built: CustomerRow[] = users.map(u => {
          const uOrders = byUser.get(u.uid ?? u.id) ?? [];
          const spend = uOrders.filter(realised).reduce((s, o) => s + (o.total ?? 0), 0);
          const lastOrderAt = uOrders.map(o => o.placedAt).sort().at(-1);
          return { user: u, orders: uOrders, spend, lastOrderAt };
        });
        built.sort((a, b) => b.spend - a.spend);
        if (!cancelled) setRows(built);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const totals = useMemo(() => ({
    customers: rows.length,
    withOrders: rows.filter(r => r.orders.length > 0).length,
    lifetime: rows.reduce((s, r) => s + r.spend, 0),
  }), [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(r => {
      if (roleFilter !== 'all' && (r.user.role ?? 'customer') !== roleFilter) return false;
      if (!q) return true;
      return (r.user.fullName ?? '').toLowerCase().includes(q)
        || (r.user.email ?? '').toLowerCase().includes(q)
        || (r.user.phone ?? '').toLowerCase().includes(q);
    });
  }, [rows, query, roleFilter]);

  const exportCsv = () => {
    const headers = ['Name', 'Email', 'Phone', 'Role', 'Joined', 'Orders', 'Lifetime spend', 'Last order'];
    const data = filtered.map(r => [
      r.user.fullName ?? '', r.user.email ?? '', r.user.phone ?? '', r.user.role ?? 'customer',
      fmtDate(r.user.createdAt), r.orders.length, r.spend, fmtDate(r.lastOrderAt),
    ]);
    downloadCsv(`tresor-customers-${new Date().toISOString().slice(0, 10)}`, toCsv(headers, data));
  };

  const exportOne = async (r: CustomerRow) => {
    setBusy(true);
    try {
      const data = await usersApi.exportData(r.user.uid ?? r.user.id);
      downloadJson(`tresor-customer-${(r.user.email ?? r.user.id).replace(/[^a-z0-9]/gi, '-')}`, data);
    } finally { setBusy(false); }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await usersApi.adminAnonymiseAndDelete(confirmDelete.user.uid ?? confirmDelete.user.id);
      setConfirmDelete(null);
      setSelected(null);
      setReloadKey(k => k + 1);
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)]">Customers</p>
          <p className="text-[22px] font-extrabold text-[color:var(--color-myntra-navy)]">{totals.customers.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)]">With orders</p>
          <p className="text-[22px] font-extrabold text-[color:var(--color-myntra-navy)]">{totals.withOrders.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)]">Lifetime value</p>
          <p className="text-[22px] font-extrabold text-[color:var(--color-myntra-navy)]">{formatINR(totals.lifetime)}</p>
        </div>
      </div>

      <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <h1 className="text-[20px] font-extrabold text-[color:var(--color-myntra-navy)] inline-flex items-center gap-2"><Users className="w-5 h-5" /> Customers</h1>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-myntra-ink-mute)]" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, email, phone…" className="input-box pl-9 w-full sm:w-[260px]" />
          </div>
          <div className="relative">
            <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-myntra-ink-mute)] pointer-events-none" />
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as 'all' | 'customer' | 'admin')} className="input-box pl-9 w-full sm:w-[150px]">
              <option value="all">All roles</option>
              <option value="customer">Customers</option>
              <option value="admin">Admins</option>
            </select>
          </div>
          <button onClick={exportCsv} className="btn-outline inline-flex items-center justify-center gap-1.5 !py-2.5 whitespace-nowrap"><Download className="w-4 h-4" /> Export CSV</button>
        </div>
      </div>

      <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-[14px] text-[color:var(--color-myntra-ink-soft)]">Loading customers…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-[14px] text-[color:var(--color-myntra-ink-soft)]">No customers match.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-[color:var(--color-myntra-bg-soft)] border-b border-[color:var(--color-myntra-border-soft)] text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-[color:var(--color-myntra-ink-mute)]">
                <tr>
                  <th className="px-3 py-2.5">Customer</th>
                  <th className="px-3 py-2.5">Role</th>
                  <th className="px-3 py-2.5">Joined</th>
                  <th className="px-3 py-2.5 text-right">Orders</th>
                  <th className="px-3 py-2.5 text-right">Lifetime spend</th>
                  <th className="px-3 py-2.5">Last order</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.user.id} onClick={() => setSelected(r)} className="border-b border-[color:var(--color-myntra-border-soft)] hover:bg-[color:var(--color-myntra-bg-soft)] cursor-pointer">
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-[color:var(--color-myntra-navy)]">{r.user.fullName ?? '—'}</div>
                      <div className="text-[11px] text-[color:var(--color-myntra-ink-soft)]">{r.user.email ?? r.user.phone ?? '—'}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${r.user.role === 'admin' ? 'bg-[#EDE7F6] text-[#5C3A8E] border-[#D6C9E9]' : 'bg-[color:var(--color-myntra-bg-soft)] text-[color:var(--color-myntra-ink-soft)] border-[color:var(--color-myntra-border-soft)]'}`}>{r.user.role ?? 'customer'}</span>
                    </td>
                    <td className="px-3 py-2.5 text-[color:var(--color-myntra-ink-soft)]">{fmtDate(r.user.createdAt)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold">{r.orders.length}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-[color:var(--color-myntra-navy)]">{formatINR(r.spend)}</td>
                    <td className="px-3 py-2.5 text-[color:var(--color-myntra-ink-soft)]">{fmtDate(r.lastOrderAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {selected && (
        <Overlay onClose={() => !busy && setSelected(null)}>
          <div className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-[18px] font-extrabold text-[color:var(--color-myntra-navy)]">{selected.user.fullName ?? '—'}</h2>
                <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)]">{selected.user.role ?? 'customer'} · joined {fmtDate(selected.user.createdAt)}</p>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 rounded hover:bg-[color:var(--color-myntra-bg-soft)]" aria-label="Close"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-1.5 text-[13px] mb-5">
              {selected.user.email && <p className="flex items-center gap-2"><Mail className="w-4 h-4 text-[color:var(--color-myntra-ink-mute)]" /> {selected.user.email}</p>}
              {selected.user.phone && <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-[color:var(--color-myntra-ink-mute)]" /> {selected.user.phone}</p>}
            </div>

            {selected.user.defaultAddress && (
              <div className="mb-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-1">Default address</p>
                <p className="text-[13px] leading-relaxed text-[color:var(--color-myntra-ink-soft)]">
                  {[selected.user.defaultAddress.line1, selected.user.defaultAddress.line2, selected.user.defaultAddress.city, selected.user.defaultAddress.state, selected.user.defaultAddress.postalCode].filter(Boolean).join(', ')}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-[color:var(--color-myntra-bg-soft)] rounded-md p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)]">Lifetime spend</p>
                <p className="text-[18px] font-extrabold text-[color:var(--color-myntra-navy)]">{formatINR(selected.spend)}</p>
              </div>
              <div className="bg-[color:var(--color-myntra-bg-soft)] rounded-md p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)]">Orders</p>
                <p className="text-[18px] font-extrabold text-[color:var(--color-myntra-navy)]">{selected.orders.length}</p>
              </div>
            </div>

            <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-2">Order history</p>
            <ul className="space-y-2 mb-6">
              {selected.orders.length === 0 && <li className="text-[13px] text-[color:var(--color-myntra-ink-mute)]">No orders yet.</li>}
              {selected.orders.map(o => (
                <li key={o.id} className="flex items-center justify-between text-[12px] border border-[color:var(--color-myntra-border-soft)] rounded p-2">
                  <span><span className="font-mono">{o.id.slice(0, 8)}</span> · {fmtDate(o.placedAt)}</span>
                  <span className="font-semibold">{formatINR(o.total ?? 0)} <span className="text-[color:var(--color-myntra-ink-mute)] font-normal">{o.status ?? 'placed'}</span></span>
                </li>
              ))}
            </ul>

            {/* CRM overlay: lifecycle, tags, notes, support timeline */}
            <div className="border-t border-[color:var(--color-myntra-border-soft)] pt-4 mb-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-3">CRM</p>
              <AdminCustomerCrm uid={selected.user.uid ?? selected.user.id} customerName={selected.user.fullName ?? selected.user.email ?? 'this customer'} />
            </div>

            {/* DPDP data rights */}
            <div className="border-t border-[color:var(--color-myntra-border-soft)] pt-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-2 inline-flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> Data rights (DPDP)</p>
              <div className="flex flex-col gap-2">
                <button onClick={() => exportOne(selected)} disabled={busy} className="btn-outline inline-flex items-center justify-center gap-2 !py-2 text-[12px]"><FileDown className="w-4 h-4" /> Export this customer's data (JSON)</button>
                <button onClick={() => setConfirmDelete(selected)} disabled={busy} className="inline-flex items-center justify-center gap-2 !py-2 px-3 rounded-md font-bold text-[12px] border border-[#F0C7C7] text-[#A12626] bg-white hover:bg-[#FBE6E6]"><Trash2 className="w-4 h-4" /> Erase profile &amp; anonymise orders</button>
              </div>
            </div>
          </div>
        </Overlay>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(20,16,24,0.6)' }} onClick={() => !busy && setConfirmDelete(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-md max-w-md w-full p-5 shadow-2xl">
            <h3 className="text-[16px] font-extrabold text-[color:var(--color-myntra-navy)] mb-2">Erase customer data?</h3>
            <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] mb-3">
              This deletes <span className="font-semibold">{confirmDelete.user.fullName ?? confirmDelete.user.email}</span>'s profile, reviews and consent record, and strips personal details from their {confirmDelete.orders.length} order(s) — financial totals are retained for GST/tax compliance.
            </p>
            <p className="text-[12px] text-[#9A5B12] bg-[#FDF0E1] border border-[#F0D9B5] rounded p-2 mb-4">
              Note: the Firebase Auth login can only be removed server-side (Admin SDK). Do that separately in the Firebase Console.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} disabled={busy} className="btn-outline !py-2">Cancel</button>
              <button onClick={doDelete} disabled={busy} className="!py-2 !px-4 rounded-md font-bold text-white text-[13px] inline-flex items-center gap-2 disabled:opacity-60" style={{ backgroundColor: '#A12626' }}>
                {busy ? 'Working…' : <><Trash2 className="w-4 h-4" /> Erase</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCustomers;
