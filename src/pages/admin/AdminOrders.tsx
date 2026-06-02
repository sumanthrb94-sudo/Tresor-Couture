import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search,
  Filter,
  Eye,
  Truck,
  CheckCircle2,
  XCircle,
  ShoppingBag,
  Calendar,
  ArrowUpRight,
  RefreshCw
} from 'lucide-react';
import { FileText, X } from 'lucide-react';
import { collection, getDocs, orderBy, query as fsQuery, limit as qLimit } from 'firebase/firestore';
import { db, ordersApi } from '../../lib/firebase';
import { formatINR } from '../../constants';
import { useRouter } from '../../context/RouterContext';
import TaxInvoice from '../../components/TaxInvoice';
import type { Order, OrderStatus, PaymentMethod } from '../../types';

/* ───────────── domain helpers ───────────── */

const STATUS_FILTERS: { value: 'all' | OrderStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'placed', label: 'Placed' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' }
];

const ALL_STATUSES: OrderStatus[] = [
  'placed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded'
];

const STATUS_STYLE: Record<
  OrderStatus,
  { bg: string; text: string; border: string; label: string }
> = {
  placed:     { bg: '#E8F0FB', text: '#1E4FAE', border: '#C5D8F6', label: 'Placed' },
  processing: { bg: '#FDF0E1', text: '#A0561A', border: '#F4D6B5', label: 'Processing' },
  shipped:    { bg: '#EAEAFB', text: '#4338CA', border: '#CDCDF4', label: 'Shipped' },
  delivered:  { bg: '#E5EFDB', text: '#3F5A26', border: '#C7D9AE', label: 'Delivered' },
  cancelled:  { bg: '#FBE6E6', text: '#A12626', border: '#F0C7C7', label: 'Cancelled' },
  refunded:   { bg: '#ECECEC', text: '#52525B', border: '#D4D4D8', label: 'Refunded' }
};

type DateRange = 'all' | 'today' | '7d' | '30d';

const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'all', label: 'All time' }
];

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  card: 'Card',
  upi: 'UPI',
  cod: 'Cash on delivery'
};

const statusOf = (o: Order): OrderStatus => o.status ?? 'placed';

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const formatDateTime = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })} · ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
};

const withinRange = (iso: string, range: DateRange): boolean => {
  if (range === 'all') return true;
  const placed = new Date(iso).getTime();
  if (Number.isNaN(placed)) return false;
  const now = Date.now();
  if (range === 'today') {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return placed >= start.getTime();
  }
  const days = range === '7d' ? 7 : 30;
  return now - placed <= days * 24 * 60 * 60 * 1000;
};

/* CSV serialiser — escapes per RFC 4180. */
const csvEscape = (v: string | number | undefined | null): string => {
  if (v === undefined || v === null) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const buildCsv = (orders: Order[]): string => {
  const header = [
    'id',
    'placedAt',
    'customerName',
    'customerEmail',
    'itemCount',
    'subtotal',
    'shipping',
    'tax',
    'total',
    'paymentMethod',
    'status',
    'couponCode'
  ];
  const rows = orders.map(o =>
    [
      o.id,
      o.placedAt,
      o.shippingAddress.fullName,
      o.shippingAddress.email,
      o.items.reduce((acc, it) => acc + it.quantity, 0),
      o.subtotal,
      o.shipping,
      o.tax,
      o.total,
      o.paymentMethod,
      statusOf(o),
      o.couponCode ?? ''
    ]
      .map(csvEscape)
      .join(',')
  );
  return [header.join(','), ...rows].join('\r\n');
};

const downloadCsv = (csv: string, filename: string): void => {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/* ───────────── presentation atoms ───────────── */

const StatusPill: React.FC<{ status: OrderStatus }> = ({ status }) => {
  const s = STATUS_STYLE[status];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border"
      style={{ background: s.bg, color: s.text, borderColor: s.border }}
    >
      {s.label}
    </span>
  );
};

interface StatusSelectProps {
  value: OrderStatus;
  onChange: (next: OrderStatus) => void;
  disabled?: boolean;
}

const StatusSelect: React.FC<StatusSelectProps> = ({ value, onChange, disabled }) => {
  const s = STATUS_STYLE[value];
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={e => onChange(e.target.value as OrderStatus)}
      onClick={e => e.stopPropagation()}
      className="text-[11px] font-bold uppercase tracking-wider rounded-full border px-2 py-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[color:var(--color-myntra-pink)] disabled:opacity-60"
      style={{ background: s.bg, color: s.text, borderColor: s.border }}
      aria-label="Update order status"
    >
      {ALL_STATUSES.map(st => (
        <option key={st} value={st} style={{ background: '#fff', color: '#000' }}>
          {STATUS_STYLE[st].label}
        </option>
      ))}
    </select>
  );
};

/* ───────────── expanded details ───────────── */

interface OrderDetailsProps {
  order: Order;
  nextStatus: OrderStatus | null;
  pending: boolean;
  onAdvance: () => void;
  onCancel: () => void;
}

const OrderDetails: React.FC<OrderDetailsProps> = ({
  order,
  nextStatus,
  pending,
  onAdvance,
  onCancel
}) => {
  const status = statusOf(order);
  const [showInvoice, setShowInvoice] = useState(false);
  const canCancel =
    status !== 'cancelled' && status !== 'refunded' && status !== 'delivered';

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-4 md:gap-5">
      {/* Items + totals */}
      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-mute)] mb-2">
          Items
        </h3>
        <ul className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md divide-y divide-[color:var(--color-myntra-border-soft)]">
          {order.items.map((it, idx) => (
            <li key={`${it.fabricId}-${idx}`} className="flex items-center gap-3 px-3 py-2.5">
              <div className="w-12 h-12 rounded overflow-hidden bg-[color:var(--color-myntra-bg-soft)] shrink-0">
                <img
                  src={it.fabricSnapshot.photo}
                  alt={it.fabricSnapshot.name}
                  onError={e => {
                    (e.currentTarget as HTMLImageElement).src = it.fabricSnapshot.image;
                  }}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase font-bold tracking-wider text-[color:var(--color-myntra-ink-mute)] truncate">
                  {it.fabricSnapshot.brand}
                </p>
                <p className="text-[13px] font-semibold text-[color:var(--color-myntra-navy)] truncate">
                  {it.fabricSnapshot.name}
                </p>
                <p className="text-[11px] text-[color:var(--color-myntra-ink-soft)]">
                  Qty {it.quantity.toLocaleString('en-IN')}
                  {it.color ? ` · ${it.color}` : ''} ·{' '}
                  {formatINR(it.fabricSnapshot.price)}
                </p>
              </div>
              <p className="text-[13px] font-extrabold text-[color:var(--color-myntra-navy)] tabular-nums shrink-0">
                {formatINR(Math.round(it.quantity * it.fabricSnapshot.price))}
              </p>
            </li>
          ))}
        </ul>

        <dl className="mt-3 grid grid-cols-2 gap-y-1 text-[12px]">
          <dt className="text-[color:var(--color-myntra-ink-soft)]">Subtotal</dt>
          <dd className="text-right tabular-nums text-[color:var(--color-myntra-navy)]">
            {formatINR(order.subtotal)}
          </dd>
          <dt className="text-[color:var(--color-myntra-ink-soft)]">Shipping</dt>
          <dd className="text-right tabular-nums text-[color:var(--color-myntra-navy)]">
            {order.shipping === 0 ? 'Free' : formatINR(order.shipping)}
          </dd>
          <dt className="text-[color:var(--color-myntra-ink-soft)]">Tax</dt>
          <dd className="text-right tabular-nums text-[color:var(--color-myntra-navy)]">
            {formatINR(order.tax)}
          </dd>
          {order.couponCode && (
            <>
              <dt className="text-[color:var(--color-myntra-green)]">
                Coupon · {order.couponCode}
              </dt>
              <dd className="text-right tabular-nums text-[color:var(--color-myntra-green)]">
                −{formatINR(order.couponDiscount ?? 0)}
              </dd>
            </>
          )}
          <dt className="font-extrabold text-[color:var(--color-myntra-navy)] pt-1 border-t border-[color:var(--color-myntra-border-soft)] mt-1">
            Total
          </dt>
          <dd className="font-extrabold text-right tabular-nums text-[color:var(--color-myntra-navy)] pt-1 border-t border-[color:var(--color-myntra-border-soft)] mt-1">
            {formatINR(order.total)}
          </dd>
        </dl>
      </div>

      {/* Address + meta + actions */}
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-mute)] mb-2">
            Shipping address
          </h3>
          <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md p-3 text-[12px] leading-relaxed">
            <p className="text-[13px] font-semibold text-[color:var(--color-myntra-navy)]">
              {order.shippingAddress.fullName}
            </p>
            <p className="text-[color:var(--color-myntra-ink-soft)]">
              {order.shippingAddress.line1}
              {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}
            </p>
            <p className="text-[color:var(--color-myntra-ink-soft)]">
              {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
              {order.shippingAddress.postalCode}
            </p>
            <p className="text-[color:var(--color-myntra-ink-soft)]">
              {order.shippingAddress.country}
            </p>
            <p className="text-[color:var(--color-myntra-ink-soft)] mt-1">
              {order.shippingAddress.phone} · {order.shippingAddress.email}
            </p>
          </div>
        </div>

        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-mute)] mb-2">
            Order info
          </h3>
          <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md p-3 text-[12px] flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[color:var(--color-myntra-ink-soft)]">Placed</span>
              <span className="text-[color:var(--color-myntra-navy)]">
                {formatDateTime(order.placedAt)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[color:var(--color-myntra-ink-soft)]">Payment</span>
              <span className="text-[color:var(--color-myntra-navy)]">
                {PAYMENT_LABEL[order.paymentMethod]}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[color:var(--color-myntra-ink-soft)]">Customer ID</span>
              <span className="text-[color:var(--color-myntra-navy)] truncate max-w-[160px]">
                {order.userId ?? 'Guest'}
              </span>
            </div>
            {order.couponCode && (
              <div className="flex items-center justify-between">
                <span className="text-[color:var(--color-myntra-ink-soft)]">Coupon</span>
                <span className="text-[color:var(--color-myntra-green)] font-bold uppercase">
                  {order.couponCode}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {nextStatus && (
            <button
              type="button"
              onClick={onAdvance}
              disabled={pending}
              className="btn-primary inline-flex items-center gap-1.5 disabled:opacity-60"
            >
              {nextStatus === 'shipped' ? (
                <>
                  <Truck className="w-4 h-4" /> Mark as shipped
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Mark as delivered
                </>
              )}
            </button>
          )}
          {canCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={pending}
              className="btn-outline inline-flex items-center gap-1.5 disabled:opacity-60"
            >
              <XCircle className="w-4 h-4" /> Cancel order
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowInvoice(true)}
            className="btn-outline inline-flex items-center gap-1.5"
          >
            <FileText className="w-4 h-4" /> Tax invoice
          </button>
        </div>
      </div>

      {showInvoice && (
        <div
          className="fixed inset-0 z-[120] overflow-y-auto py-6 px-3"
          style={{ backgroundColor: 'rgba(20,16,24,0.6)' }}
          onClick={() => setShowInvoice(false)}
        >
          <div onClick={e => e.stopPropagation()} className="max-w-[860px] mx-auto">
            <div className="no-print flex justify-end mb-2">
              <button onClick={() => setShowInvoice(false)} className="p-2 rounded-full bg-white shadow" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <TaxInvoice order={order} />
          </div>
        </div>
      )}
    </div>
  );
};

/* ───────────── component ───────────── */

const AdminOrders: React.FC = () => {
  const { navigate } = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // Direct Firestore read (vs ordersApi.all) so we can tune constraints
      // and cap to a stable admin page size.
      const snap = await getDocs(fsQuery(collection(db, 'orders'), orderBy('placedAt', 'desc'), qLimit(500)));
      setOrders(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Order, 'id'>) })));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load orders.');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...orders]
      .filter(o => statusFilter === 'all' || statusOf(o) === statusFilter)
      .filter(o => withinRange(o.placedAt, dateRange))
      .filter(o => {
        if (!q) return true;
        return (
          o.id.toLowerCase().includes(q) ||
          o.shippingAddress.fullName.toLowerCase().includes(q) ||
          o.shippingAddress.email.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());
  }, [orders, query, statusFilter, dateRange]);

  const updateStatus = async (id: string, next: OrderStatus): Promise<void> => {
    setPendingId(id);
    // Optimistic update — revert on failure so the table reflects truth.
    const prev = orders;
    setOrders(rows => rows.map(o => (o.id === id ? { ...o, status: next } : o)));
    try {
      await ordersApi.setStatus(id, next);
    } catch (err) {
      setOrders(prev);
      setLoadError(err instanceof Error ? err.message : 'Could not update order.');
    } finally {
      setPendingId(p => (p === id ? null : p));
    }
  };

  const handleExport = (): void => {
    if (filtered.length === 0) return;
    const csv = buildCsv(filtered);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `tresor-orders-${stamp}.csv`);
  };

  const advanceStatus = (status: OrderStatus): OrderStatus | null => {
    if (status === 'placed' || status === 'processing') return 'shipped';
    if (status === 'shipped') return 'delivered';
    return null;
  };

  const totalCount = orders.length;
  const filteredCount = filtered.length;
  const filtersDirty = query !== '' || statusFilter !== 'all' || dateRange !== 'all';

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      {/* Header */}
      <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md p-4 md:p-5 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-[22px] md:text-[26px] font-extrabold text-[color:var(--color-myntra-navy)] leading-tight">
              Orders
            </h1>
            <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] mt-0.5">
              Showing <strong>{filteredCount}</strong> of <strong>{totalCount}</strong> order
              {totalCount === 1 ? '' : 's'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center w-full md:w-auto">
            <div className="relative flex-1 sm:flex-none sm:min-w-[260px]">
              <Search
                className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-myntra-ink-mute)] pointer-events-none"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search id, name or email"
                className="input-box w-full pl-9"
                aria-label="Search orders"
              />
            </div>
            <div className="relative">
              <Calendar
                className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-myntra-ink-mute)] pointer-events-none"
                aria-hidden
              />
              <select
                value={dateRange}
                onChange={e => setDateRange(e.target.value as DateRange)}
                className="input-box pl-9 pr-8 appearance-none cursor-pointer"
                aria-label="Date range filter"
              >
                {DATE_RANGES.map(r => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => void fetchOrders()}
              disabled={loading}
              className="btn-outline whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
              aria-label="Reload orders"
              title="Reload"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden /> Refresh
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={filteredCount === 0}
              className="btn-outline whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Export CSV
            </button>
          </div>
        </div>
        {loadError && (
          <p role="alert" className="text-[12px] font-semibold text-[color:var(--color-myntra-pink)]">{loadError}</p>
        )}

        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <Filter
            className="w-3.5 h-3.5 text-[color:var(--color-myntra-ink-mute)] shrink-0"
            aria-hidden
          />
          {STATUS_FILTERS.map(f => {
            const count =
              f.value === 'all'
                ? orders.length
                : orders.filter(o => statusOf(o) === f.value).length;
            const active = statusFilter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setStatusFilter(f.value)}
                className={`chip whitespace-nowrap transition-colors ${
                  active ? 'chip-active' : 'hover:border-[color:var(--color-myntra-pink)]'
                }`}
              >
                {f.label}
                <span
                  className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${
                    active
                      ? 'bg-white/70 text-[color:var(--color-myntra-pink)]'
                      : 'bg-[color:var(--color-myntra-bg-soft)] text-[color:var(--color-myntra-ink-mute)]'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md p-10 text-center">
          <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)]">Loading orders…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md p-10 md:p-16 text-center">
          <ShoppingBag className="w-10 h-10 mx-auto text-[color:var(--color-myntra-ink-mute)] mb-3" />
          <h2 className="font-[family-name:var(--font-display)] text-[18px] font-extrabold text-[color:var(--color-myntra-navy)]">
            No orders match
          </h2>
          <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] mt-1 max-w-md mx-auto">
            {totalCount === 0
              ? 'No orders have been placed yet. Once customers check out, they will show up here.'
              : 'Try a different search, status or date range to find what you are looking for.'}
          </p>
          {filtersDirty && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setStatusFilter('all');
                setDateRange('all');
              }}
              className="btn-outline mt-4"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-[color:var(--color-myntra-bg-soft)]">
                  <tr className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-mute)]">
                    <th className="px-4 py-3 w-8" aria-label="Expand" />
                    <th className="px-4 py-3">Order ID</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Placed</th>
                    <th className="px-4 py-3 text-right">Items</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(o => {
                    const status = statusOf(o);
                    const expanded = expandedId === o.id;
                    const nextStatus = advanceStatus(status);
                    const itemUnits = o.items.reduce((acc, it) => acc + it.quantity, 0);
                    return (
                      <React.Fragment key={o.id}>
                        <tr
                          onClick={() => setExpandedId(expanded ? null : o.id)}
                          className="border-t border-[color:var(--color-myntra-border-soft)] cursor-pointer hover:bg-[color:var(--color-myntra-bg-soft)]/60 transition-colors"
                        >
                          <td className="px-4 py-3 text-[color:var(--color-myntra-ink-mute)]">
                            <span
                              className={`inline-block transition-transform ${
                                expanded ? 'rotate-90' : ''
                              }`}
                              aria-hidden
                            >
                              ▸
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[13px] font-bold text-[color:var(--color-myntra-navy)] whitespace-nowrap">
                            #{o.id}
                          </td>
                          <td className="px-4 py-3 text-[13px] min-w-[180px]">
                            <p className="font-semibold text-[color:var(--color-myntra-navy)] truncate max-w-[220px]">
                              {o.shippingAddress.fullName}
                            </p>
                            <p className="text-[11px] text-[color:var(--color-myntra-ink-soft)] truncate max-w-[220px]">
                              {o.shippingAddress.email}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-[12px] text-[color:var(--color-myntra-ink-soft)] whitespace-nowrap">
                            {formatDate(o.placedAt)}
                          </td>
                          <td className="px-4 py-3 text-[13px] text-right text-[color:var(--color-myntra-navy)] tabular-nums whitespace-nowrap">
                            {o.items.length}
                            <span className="text-[10px] text-[color:var(--color-myntra-ink-mute)] block">
                              {itemUnits.toLocaleString('en-IN')} units
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[13px] font-extrabold text-right text-[color:var(--color-myntra-navy)] tabular-nums whitespace-nowrap">
                            {formatINR(o.total)}
                          </td>
                          <td className="px-4 py-3 text-[12px] text-[color:var(--color-myntra-ink-soft)] whitespace-nowrap">
                            {PAYMENT_LABEL[o.paymentMethod]}
                          </td>
                          <td
                            className="px-4 py-3"
                            onClick={e => e.stopPropagation()}
                          >
                            <StatusSelect
                              value={status}
                              disabled={pendingId === o.id}
                              onChange={next => updateStatus(o.id, next)}
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                navigate({ name: 'confirmation', orderId: o.id });
                              }}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-[color:var(--color-myntra-border)] text-[color:var(--color-myntra-ink-soft)] hover:text-[color:var(--color-myntra-pink)] hover:border-[color:var(--color-myntra-pink)] transition-colors"
                              aria-label="View order"
                              title="View order"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                        {expanded && (
                          <tr className="bg-[color:var(--color-myntra-bg-soft)]/40">
                            <td colSpan={9} className="px-4 py-4">
                              <OrderDetails
                                order={o}
                                nextStatus={nextStatus}
                                pending={pendingId === o.id}
                                onAdvance={() =>
                                  nextStatus && updateStatus(o.id, nextStatus)
                                }
                                onCancel={() => updateStatus(o.id, 'cancelled')}
                              />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden flex flex-col gap-3">
            {filtered.map(o => {
              const status = statusOf(o);
              const expanded = expandedId === o.id;
              const nextStatus = advanceStatus(status);
              const itemUnits = o.items.reduce((acc, it) => acc + it.quantity, 0);
              return (
                <div
                  key={o.id}
                  className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : o.id)}
                    className="w-full text-left p-4 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-bold text-[color:var(--color-myntra-navy)]">
                        #{o.id}
                      </span>
                      <StatusPill status={status} />
                    </div>
                    <p className="text-[13px] font-semibold text-[color:var(--color-myntra-navy)] truncate">
                      {o.shippingAddress.fullName}
                    </p>
                    <p className="text-[11px] text-[color:var(--color-myntra-ink-soft)] truncate">
                      {o.shippingAddress.email}
                    </p>
                    <div className="flex items-center justify-between mt-1 text-[12px] text-[color:var(--color-myntra-ink-soft)]">
                      <span>
                        {formatDate(o.placedAt)} · {o.items.length} item
                        {o.items.length === 1 ? '' : 's'} ·{' '}
                        {itemUnits.toLocaleString('en-IN')} units
                      </span>
                      <span className="text-[14px] font-extrabold text-[color:var(--color-myntra-navy)] tabular-nums">
                        {formatINR(o.total)}
                      </span>
                    </div>
                  </button>

                  <div className="px-4 pb-3 flex flex-wrap items-center gap-2 border-t border-[color:var(--color-myntra-border-soft)] pt-3">
                    <StatusSelect
                      value={status}
                      disabled={pendingId === o.id}
                      onChange={next => updateStatus(o.id, next)}
                    />
                    <button
                      type="button"
                      onClick={() => navigate({ name: 'confirmation', orderId: o.id })}
                      className="ml-auto inline-flex items-center gap-1 text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-pink)]"
                    >
                      View <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {expanded && (
                    <div className="border-t border-[color:var(--color-myntra-border-soft)] px-4 py-4 bg-[color:var(--color-myntra-bg-soft)]/40">
                      <OrderDetails
                        order={o}
                        nextStatus={nextStatus}
                        pending={pendingId === o.id}
                        onAdvance={() => nextStatus && updateStatus(o.id, nextStatus)}
                        onCancel={() => updateStatus(o.id, 'cancelled')}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default AdminOrders;
