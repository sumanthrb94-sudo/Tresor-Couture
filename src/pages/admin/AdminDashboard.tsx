import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ShoppingBag,
  Package,
  IndianRupee,
  AlertCircle,
  TrendingUp,
  Users,
  Truck,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  Calendar,
  Tag,
  Star,
  Palette,
  Database
} from 'lucide-react';
import { collection, getDocs, orderBy, query as fsQuery, limit as qLimit } from 'firebase/firestore';
import { fabricsStore } from '../../data/storage';
import { useStore } from '../../data/useStore';
import { FABRICS, formatINR } from '../../constants';
import { db, seedCatalog } from '../../lib/firebase';
import { useRouter } from '../../context/RouterContext';
import type { Order, OrderStatus, Route } from '../../types';

/* ───────────── helpers ───────────── */

const STATUS_STYLE: Record<OrderStatus, { bg: string; text: string; border: string; label: string }> = {
  placed:     { bg: '#E8F0FB', text: '#1E4FAE', border: '#C5D8F6', label: 'Placed' },
  processing: { bg: '#FDF0E1', text: '#A0561A', border: '#F4D6B5', label: 'Processing' },
  shipped:    { bg: '#EAEAFB', text: '#4338CA', border: '#CDCDF4', label: 'Shipped' },
  delivered:  { bg: '#E5EFDB', text: '#3F5A26', border: '#C7D9AE', label: 'Delivered' },
  cancelled:  { bg: '#FBE6E6', text: '#A12626', border: '#F0C7C7', label: 'Cancelled' },
  refunded:   { bg: '#ECECEC', text: '#52525B', border: '#D4D4D8', label: 'Refunded' }
};

const statusOf = (o: Order): OrderStatus => o.status ?? 'placed';

// Soft-deleted orders are "returned to supplier" — they stay in the DB for
// reporting but aren't realised revenue.
const isRts = (o: Order): boolean => Boolean(o.deletedAt);

// Cancelled / refunded / soft-deleted orders are excluded from revenue —
// the goods went back to inventory (or to the supplier) and no money was
// collected (or it was refunded).
const isRealised = (o: Order): boolean => {
  if (isRts(o)) return false;
  const s = statusOf(o);
  return s !== 'cancelled' && s !== 'refunded';
};

const sumUnits = (o: Order): number =>
  o.items.reduce((n, it) => n + (it.quantity ?? 0), 0);

const timeAgo = (iso: string): string => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const todayLabel = () =>
  new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

/* ───────────── presentation atoms ───────────── */

interface KpiTileProps {
  label: string;
  value: string;
  subtitle?: React.ReactNode;
  Icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  onClick?: () => void;
}

const KpiTile: React.FC<KpiTileProps> = ({ label, value, subtitle, Icon, iconBg, iconColor, onClick }) => (
  <div
    onClick={onClick}
    className={`bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md p-5 flex flex-col gap-3 transition-shadow ${
      onClick ? 'cursor-pointer hover:shadow-md' : ''
    }`}
  >
    <div className="flex items-start justify-between">
      <div
        className="w-10 h-10 rounded-md flex items-center justify-center"
        style={{ background: iconBg, color: iconColor }}
      >
        <Icon className="w-5 h-5" />
      </div>
      {onClick && <ArrowUpRight className="w-4 h-4 text-[color:var(--color-myntra-ink-mute)]" />}
    </div>
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--color-myntra-ink-mute)]">
        {label}
      </p>
      <p className="text-[26px] font-extrabold text-[color:var(--color-myntra-navy)] leading-tight font-[family-name:var(--font-display)]">
        {value}
      </p>
      {subtitle && (
        <div className="mt-1 text-[12px] text-[color:var(--color-myntra-ink-soft)]">{subtitle}</div>
      )}
    </div>
  </div>
);

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

/* ───────────── component ───────────── */

const AdminDashboard: React.FC = () => {
  // Orders come from Firestore directly — AdminOrders mutates orders via
  // ordersApi (Firestore writes) without touching the local ordersStore,
  // so reading from the store would show stale data: status changes,
  // soft-deletes (returns to supplier), even brand-new orders would never
  // appear. We re-read from Firestore on mount and whenever the router
  // brings us back here.
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const { rows: fabrics } = useStore(fabricsStore);
  const { navigate } = useRouter();

  const fetchOrders = useCallback(async () => {
    try {
      const snap = await getDocs(
        fsQuery(collection(db, 'orders'), orderBy('placedAt', 'desc'), qLimit(500))
      );
      setOrders(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Order, 'id'>) })));
      setOrdersError(null);
    } catch (err) {
      setOrdersError(err instanceof Error ? err.message : 'Could not load orders.');
    }
  }, []);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);

  const handleSeed = async () => {
    setSeeding(true);
    setSeedMessage(null);
    try {
      const result = await seedCatalog(FABRICS as unknown as Record<string, unknown>[], { force: false });
      setSeedMessage(
        result.skipped
          ? 'Catalogue already populated — no changes made.'
          : `Seeded ${result.seeded} products into Firestore.`
      );
    } catch (err) {
      setSeedMessage(err instanceof Error ? `Seed failed: ${err.message}` : 'Seed failed.');
    } finally {
      setSeeding(false);
    }
  };

  /* Sorted view used everywhere below. */
  const ordersSorted = useMemo(
    () =>
      [...orders].sort(
        (a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime()
      ),
    [orders]
  );

  /* KPI metrics. Revenue figures only count orders that were not
     cancelled or refunded — those go back to inventory. */
  const realisedOrders = useMemo(() => orders.filter(isRealised), [orders]);

  const totalRevenue = useMemo(
    () => realisedOrders.reduce((sum, o) => sum + (o.total ?? 0), 0),
    [realisedOrders]
  );

  const ordersThisMonth = useMemo(() => {
    const now = new Date();
    return orders.filter(o => {
      const d = new Date(o.placedAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  }, [orders]);

  const revenueTrend = useMemo(() => {
    const now = new Date();
    const thisMonthIdx = now.getMonth();
    const thisYear = now.getFullYear();
    const lastMonthIdx = thisMonthIdx === 0 ? 11 : thisMonthIdx - 1;
    const lastMonthYear = thisMonthIdx === 0 ? thisYear - 1 : thisYear;

    let curr = 0;
    let prev = 0;
    for (const o of realisedOrders) {
      const d = new Date(o.placedAt);
      const m = d.getMonth();
      const y = d.getFullYear();
      if (m === thisMonthIdx && y === thisYear) curr += o.total;
      else if (m === lastMonthIdx && y === lastMonthYear) prev += o.total;
    }
    if (prev === 0) {
      return { delta: curr > 0 ? 100 : 0, positive: curr > 0, hasPrev: false };
    }
    const delta = ((curr - prev) / prev) * 100;
    return { delta, positive: delta >= 0, hasPrev: true };
  }, [realisedOrders]);

  const aov = useMemo(
    () => (realisedOrders.length === 0 ? 0 : Math.round(totalRevenue / realisedOrders.length)),
    [realisedOrders, totalRevenue]
  );

  const lowStockCount = useMemo(
    () => fabrics.filter(f => (f.stock ?? 0) < 10).length,
    [fabrics]
  );

  /* Returned-to-supplier (soft-deleted) totals. Row appears in the sales
     report only when at least one such unit exists. */
  const rts = useMemo(() => {
    const rows = orders.filter(isRts);
    return {
      orderCount: rows.length,
      quantity:     rows.reduce((n, o) => n + sumUnits(o), 0),
      value:      rows.reduce((n, o) => n + (o.total ?? 0), 0)
    };
  }, [orders]);

  /* Quick stats. */
  const pendingCount = useMemo(
    () => orders.filter(o => statusOf(o) === 'placed' || statusOf(o) === 'processing').length,
    [orders]
  );
  const couponOrdersCount = useMemo(
    () => orders.filter(o => Boolean(o.couponCode)).length,
    [orders]
  );
  const uniqueCustomers = useMemo(() => {
    const set = new Set<string>();
    for (const o of orders) {
      set.add(o.userId ?? `guest:${o.shippingAddress.email.toLowerCase()}`);
    }
    return set.size;
  }, [orders]);

  /* Top products by revenue. */
  interface TopProduct {
    fabricId: string;
    name: string;
    brand: string;
    photo: string;
    image: string;
    quantity: number;
    revenue: number;
  }
  const topProducts: TopProduct[] = useMemo(() => {
    const map = new Map<string, TopProduct>();
    for (const o of realisedOrders) {
      for (const it of o.items) {
        const existing = map.get(it.fabricId);
        const lineRev = it.quantity * it.fabricSnapshot.price;
        if (existing) {
          existing.quantity += it.quantity;
          existing.revenue += lineRev;
        } else {
          map.set(it.fabricId, {
            fabricId: it.fabricId,
            name: it.fabricSnapshot.name,
            brand: it.fabricSnapshot.brand,
            photo: it.fabricSnapshot.photo,
            image: it.fabricSnapshot.image,
            quantity: it.quantity,
            revenue: lineRev
          });
        }
      }
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [realisedOrders]);

  const recentOrders = ordersSorted.slice(0, 8);

  /* Quick action chips. */
  const quickActions: { label: string; route: Route; Icon: React.ComponentType<{ className?: string }> }[] = [
    { label: 'Manage Products', route: { name: 'admin', section: 'products' }, Icon: Package },
    { label: 'View All Orders',  route: { name: 'admin', section: 'orders' },   Icon: ShoppingBag },
    { label: 'Coupons',          route: { name: 'admin', section: 'coupons' },  Icon: Tag },
    { label: 'Reviews',          route: { name: 'admin', section: 'reviews' },  Icon: Star },
    { label: 'Brand Identity Kit', route: { name: 'admin-brand-kit' },          Icon: Palette }
  ];

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      {/* Greeting */}
      <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md p-5 md:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-[22px] md:text-[26px] font-extrabold text-[color:var(--color-myntra-navy)] leading-tight">
            Welcome back
          </h1>
          <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] flex items-center gap-1.5 mt-1">
            <Calendar className="w-3.5 h-3.5" /> {todayLabel()}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {quickActions.map(({ label, route, Icon }) => (
            <button
              key={label}
              type="button"
              onClick={() => navigate(route)}
              className="chip hover:border-[color:var(--color-myntra-pink)] hover:text-[color:var(--color-myntra-pink)] transition-colors"
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
          <button
            type="button"
            onClick={handleSeed}
            disabled={seeding}
            className="chip hover:border-[color:var(--color-myntra-pink)] hover:text-[color:var(--color-myntra-pink)] transition-colors disabled:opacity-60"
            title="Push the in-repo FABRICS list into Firestore (idempotent)"
          >
            <Database className="w-3.5 h-3.5" />
            {seeding ? 'Seeding…' : 'Seed catalog from FABRICS'}
          </button>
        </div>
      </div>
      {seedMessage && (
        <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md px-4 py-3 text-[13px] text-[color:var(--color-myntra-ink)]">
          {seedMessage}
        </div>
      )}
      {ordersError && (
        <div className="rounded-md px-4 py-3 text-[13px]" style={{ background: '#FBE6E6', color: '#A12626', border: '1px solid #F0C7C7' }}>
          Couldn't load orders — KPIs and the Sales Report may be empty. ({ordersError})
        </div>
      )}

      {/* KPI tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile
          label="Total Revenue"
          value={formatINR(totalRevenue)}
          subtitle={
            <span className="flex items-center gap-1.5">
              <span className="text-[color:var(--color-myntra-ink-mute)]">all time</span>
              {revenueTrend.hasPrev && (
                <span
                  className="inline-flex items-center gap-0.5 font-bold"
                  style={{
                    color: revenueTrend.positive
                      ? 'var(--color-myntra-green)'
                      : '#A12626'
                  }}
                >
                  {revenueTrend.positive ? '▲' : '▼'}
                  {Math.abs(revenueTrend.delta).toFixed(1)}%
                </span>
              )}
            </span>
          }
          Icon={IndianRupee}
          iconBg="#F5E8C8"
          iconColor="var(--color-myntra-pink)"
        />
        <KpiTile
          label="Orders"
          value={orders.length.toLocaleString('en-IN')}
          subtitle={<span>this month: <strong>{ordersThisMonth.length}</strong></span>}
          Icon={ShoppingBag}
          iconBg="#E8F0FB"
          iconColor="#1E4FAE"
        />
        <KpiTile
          label="Avg. Order Value"
          value={formatINR(aov)}
          subtitle={<span>across {realisedOrders.length} realised order{realisedOrders.length === 1 ? '' : 's'}</span>}
          Icon={TrendingUp}
          iconBg="#E5EFDB"
          iconColor="var(--color-myntra-green)"
        />
        <KpiTile
          label="Low Stock Alerts"
          value={lowStockCount.toString()}
          subtitle={<span>below 10 units</span>}
          Icon={AlertCircle}
          iconBg="#FDF0E1"
          iconColor="var(--color-myntra-orange)"
          onClick={() => navigate({ name: 'admin', section: 'products' })}
        />
      </div>

      {/* Sales report */}
      <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--color-myntra-border-soft)]">
          <h2 className="font-[family-name:var(--font-display)] text-[16px] font-extrabold text-[color:var(--color-myntra-navy)]">
            Sales Report
          </h2>
          <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)]">all time</p>
        </div>
        <table className="w-full text-[13px]">
          <thead className="bg-[color:var(--color-myntra-cream)] text-[11px] uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)]">
            <tr>
              <th className="text-left  font-bold px-5 py-2.5">Line</th>
              <th className="text-right font-bold px-5 py-2.5">Orders</th>
              <th className="text-right font-bold px-5 py-2.5">Units</th>
              <th className="text-right font-bold px-5 py-2.5">Value</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-[color:var(--color-myntra-border-soft)]">
              <td className="px-5 py-3 font-bold text-[color:var(--color-myntra-navy)]">Realised revenue</td>
              <td className="px-5 py-3 text-right">{realisedOrders.length.toLocaleString('en-IN')}</td>
              <td className="px-5 py-3 text-right">
                {realisedOrders.reduce((n, o) => n + sumUnits(o), 0).toLocaleString('en-IN')}
              </td>
              <td className="px-5 py-3 text-right font-bold">{formatINR(totalRevenue)}</td>
            </tr>
            {rts.orderCount > 0 && (
              <tr className="border-t border-[color:var(--color-myntra-border-soft)]" style={{ color: '#A12626', backgroundColor: '#FBE6E6' }}>
                <td className="px-5 py-3 font-bold">Returned to supplier</td>
                <td className="px-5 py-3 text-right">{rts.orderCount.toLocaleString('en-IN')}</td>
                <td className="px-5 py-3 text-right">{rts.quantity.toLocaleString('en-IN')}</td>
                <td className="px-5 py-3 text-right font-bold">{formatINR(rts.value)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Two-column section */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 md:gap-5">
        {/* Recent orders */}
        <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--color-myntra-border-soft)]">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-[16px] font-extrabold text-[color:var(--color-myntra-navy)]">
                Recent Orders
              </h2>
              <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)]">Latest {recentOrders.length} of {orders.length}</p>
            </div>
            <button
              type="button"
              onClick={() => navigate({ name: 'admin', section: 'orders' })}
              className="text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-pink)] hover:underline flex items-center gap-1"
            >
              View all <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {recentOrders.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <ShoppingBag className="w-8 h-8 mx-auto text-[color:var(--color-myntra-ink-mute)] mb-2" />
              <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)]">No orders yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-[color:var(--color-myntra-border-soft)]">
              {recentOrders.map(o => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => navigate({ name: 'confirmation', orderId: o.id })}
                    className="w-full text-left px-5 py-3 hover:bg-[color:var(--color-myntra-bg-soft)]/60 transition-colors flex items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold text-[color:var(--color-myntra-navy)] truncate">
                          #{o.id}
                        </span>
                        <StatusPill status={statusOf(o)} />
                      </div>
                      <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] truncate mt-0.5">
                        {o.shippingAddress.fullName} · {timeAgo(o.placedAt)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[14px] font-extrabold text-[color:var(--color-myntra-navy)]">
                        {formatINR(o.total)}
                      </p>
                      <p className="text-[11px] uppercase tracking-wider text-[color:var(--color-myntra-ink-mute)]">
                        {o.items.length} item{o.items.length === 1 ? '' : 's'}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Top products */}
        <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--color-myntra-border-soft)]">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-[16px] font-extrabold text-[color:var(--color-myntra-navy)]">
                Top Products
              </h2>
              <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)]">By revenue</p>
            </div>
          </div>
          {topProducts.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Package className="w-8 h-8 mx-auto text-[color:var(--color-myntra-ink-mute)] mb-2" />
              <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)]">No sales recorded yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-[color:var(--color-myntra-border-soft)]">
              {topProducts.map((p, idx) => (
                <li
                  key={p.fabricId}
                  className="px-5 py-3 flex items-center gap-3"
                >
                  <span className="w-5 text-[12px] font-extrabold text-[color:var(--color-myntra-ink-mute)] shrink-0">
                    {idx + 1}
                  </span>
                  <div className="w-11 h-11 rounded overflow-hidden bg-[color:var(--color-myntra-bg-soft)] shrink-0">
                    <img
                      src={p.photo}
                      alt={p.name}
                      onError={e => {
                        (e.currentTarget as HTMLImageElement).src = p.image;
                      }}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] uppercase font-bold tracking-wider text-[color:var(--color-myntra-ink-mute)] truncate">
                      {p.brand}
                    </p>
                    <p className="text-[13px] font-semibold text-[color:var(--color-myntra-navy)] truncate">
                      {p.name}
                    </p>
                    <p className="text-[11px] text-[color:var(--color-myntra-ink-soft)] truncate">
                      {p.quantity.toLocaleString('en-IN')} units sold
                    </p>
                  </div>
                  <p className="text-[13px] font-extrabold text-[color:var(--color-myntra-navy)] shrink-0">
                    {formatINR(Math.round(p.revenue))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Quick stats row */}
      <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md p-4 md:p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {[
            { label: 'Total Products', value: fabrics.length, Icon: Package, color: 'var(--color-myntra-navy)' },
            { label: 'Pending Orders', value: pendingCount, Icon: Truck, color: 'var(--color-myntra-orange)' },
            { label: 'Coupons Used', value: couponOrdersCount, Icon: Tag, color: 'var(--color-myntra-pink)' },
            { label: 'Customers', value: uniqueCustomers, Icon: Users, color: 'var(--color-myntra-green)' }
          ].map(({ label, value, Icon, color }) => (
            <div
              key={label}
              className="flex items-center gap-3 p-2"
            >
              <div
                className="w-9 h-9 rounded-md flex items-center justify-center bg-[color:var(--color-myntra-bg-soft)]"
                style={{ color }}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-mute)]">
                  {label}
                </p>
                <p className="text-[18px] font-extrabold text-[color:var(--color-myntra-navy)] leading-tight">
                  {value.toLocaleString('en-IN')}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;

/* Suppress unused warnings for icons reserved for the design system reference. */
void CheckCircle2;
void XCircle;
