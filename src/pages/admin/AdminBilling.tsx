import React, { useEffect, useMemo, useState } from 'react';
import { ReceiptText, Download, TrendingUp, IndianRupee, FileText, X } from 'lucide-react';
import { ordersApi } from '../../lib/firebase';
import { formatINR } from '../../constants';
import { toCsv, downloadCsv } from '../../lib/csv';
import { gstBreakdown, invoiceNumber } from '../../lib/invoice';
import TaxInvoice from '../../components/TaxInvoice';
import type { Order } from '../../types';

const realised = (o: Order): boolean => o.status !== 'cancelled' && o.status !== 'refunded' && !o.deletedAt;
const monthKey = (iso: string): string => iso.slice(0, 7); // YYYY-MM
const fmtMonth = (k: string): string => {
  const [y, m] = k.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
};

const Kpi: React.FC<{ label: string; value: string; sub?: string; Icon: React.ComponentType<{ className?: string }>; iconBg: string }> = ({ label, value, sub, Icon, iconBg }) => (
  <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md p-4 flex items-center gap-3">
    <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: iconBg }}><Icon className="w-5 h-5" /></span>
    <div className="min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] truncate">{label}</p>
      <p className="text-[19px] font-extrabold text-[color:var(--color-myntra-navy)] leading-tight">{value}</p>
      {sub && <p className="text-[11px] text-[color:var(--color-myntra-ink-mute)]">{sub}</p>}
    </div>
  </div>
);

/* Dependency-free monthly revenue bar chart. */
const RevenueChart: React.FC<{ data: { key: string; value: number }[] }> = ({ data }) => {
  if (data.length === 0) return <p className="text-[13px] text-[color:var(--color-myntra-ink-mute)] p-4">No revenue yet.</p>;
  const max = Math.max(...data.map(d => d.value), 1);
  const W = 720, H = 220, pad = 28, barGap = 10;
  const bw = (W - pad * 2) / data.length - barGap;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Monthly revenue">
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="var(--color-myntra-border-soft)" />
      {data.map((d, i) => {
        const h = ((d.value / max) * (H - pad * 2));
        const x = pad + i * (bw + barGap) + barGap / 2;
        const y = H - pad - h;
        return (
          <g key={d.key}>
            <rect x={x} y={y} width={bw} height={h} rx={3} fill="var(--color-myntra-pink)" opacity={0.85} />
            <text x={x + bw / 2} y={y - 4} textAnchor="middle" fontSize="9" fill="var(--color-myntra-ink-soft)">{Math.round(d.value / 1000)}k</text>
            <text x={x + bw / 2} y={H - pad + 14} textAnchor="middle" fontSize="9" fill="var(--color-myntra-ink-mute)">{fmtMonth(d.key)}</text>
          </g>
        );
      })}
    </svg>
  );
};

const AdminBilling: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const all = (await ordersApi.all()) as unknown as Order[];
        if (!cancelled) setOrders(all);
      } catch {
        if (!cancelled) setOrders([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const live = useMemo(() => orders.filter(realised), [orders]);

  const kpis = useMemo(() => {
    const gross = live.reduce((s, o) => s + (o.total ?? 0), 0);
    const gst = live.reduce((s, o) => s + (o.tax ?? 0), 0);
    const discounts = live.reduce((s, o) => s + (o.couponDiscount ?? 0), 0);
    const paid = live.filter(o => o.paymentStatus === 'paid').reduce((s, o) => s + (o.total ?? 0), 0);
    const refunds = orders.filter(o => o.status === 'refunded').reduce((s, o) => s + (o.total ?? 0), 0);
    return {
      gross, gst, discounts, paid, refunds,
      count: live.length,
      aov: live.length ? Math.round(gross / live.length) : 0,
      outstanding: gross - paid,
    };
  }, [live, orders]);

  const revenueByMonth = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of live) m.set(monthKey(o.placedAt), (m.get(monthKey(o.placedAt)) ?? 0) + (o.total ?? 0));
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([key, value]) => ({ key, value }));
  }, [live]);

  const topProducts = useMemo(() => {
    const m = new Map<string, { revenue: number; units: number }>();
    for (const o of live) {
      for (const it of o.items ?? []) {
        const name = it.fabricSnapshot?.name ?? 'Unknown';
        const cur = m.get(name) ?? { revenue: 0, units: 0 };
        cur.revenue += (it.fabricSnapshot?.price ?? 0) * it.quantity;
        cur.units += it.quantity;
        m.set(name, cur);
      }
    }
    return [...m.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [live]);

  const ledger = useMemo(() => {
    const m = new Map<string, { name: string; spend: number; outstanding: number; refunded: number }>();
    for (const o of orders) {
      const key = o.userId ?? o.shippingAddress?.email ?? 'guest';
      const row = m.get(key) ?? { name: o.shippingAddress?.fullName ?? key, spend: 0, outstanding: 0, refunded: 0 };
      if (o.status === 'refunded') row.refunded += o.total ?? 0;
      else if (!o.deletedAt && o.status !== 'cancelled') {
        row.spend += o.total ?? 0;
        if (o.paymentStatus !== 'paid') row.outstanding += o.total ?? 0;
      }
      m.set(key, row);
    }
    return [...m.values()].sort((a, b) => b.spend - a.spend).slice(0, 20);
  }, [orders]);

  const register = useMemo(() => live.map(o => ({ order: o, gst: gstBreakdown(o), inv: invoiceNumber(o) })), [live]);

  const exportRegister = () => {
    const headers = ['Invoice No', 'Date', 'Customer', 'State', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total'];
    const data = register.map(({ order: o, gst, inv }) => [
      inv, new Date(o.placedAt).toLocaleDateString('en-IN'), o.shippingAddress?.fullName ?? '', o.shippingAddress?.state ?? '',
      gst.taxableValue, gst.cgst, gst.sgst, gst.igst, o.total ?? 0,
    ]);
    downloadCsv(`tresor-gst-register-${new Date().toISOString().slice(0, 10)}`, toCsv(headers, data));
  };

  if (loading) return <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md p-10 text-center text-[14px] text-[color:var(--color-myntra-ink-soft)]">Loading billing…</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-[20px] font-extrabold text-[color:var(--color-myntra-navy)] inline-flex items-center gap-2"><ReceiptText className="w-5 h-5" /> Billing &amp; Finance</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Gross revenue" value={formatINR(kpis.gross)} sub={`${kpis.count} realised orders`} Icon={IndianRupee} iconBg="#E5EFDB" />
        <Kpi label="GST collected" value={formatINR(kpis.gst)} sub="output tax payable" Icon={ReceiptText} iconBg="#FDEEF2" />
        <Kpi label="Avg order value" value={formatINR(kpis.aov)} Icon={TrendingUp} iconBg="#E8EEF6" />
        <Kpi label="Outstanding" value={formatINR(kpis.outstanding)} sub="unpaid / COD pending" Icon={FileText} iconBg="#FDF0E1" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Collected (paid)" value={formatINR(kpis.paid)} Icon={IndianRupee} iconBg="#E5EFDB" />
        <Kpi label="Discounts given" value={formatINR(kpis.discounts)} Icon={ReceiptText} iconBg="#EDE7F6" />
        <Kpi label="Refunds" value={formatINR(kpis.refunds)} Icon={FileText} iconBg="#FBE6E6" />
        <Kpi label="Invoices" value={register.length.toLocaleString('en-IN')} Icon={FileText} iconBg="#E8EEF6" />
      </div>

      {/* Revenue chart */}
      <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md p-4">
        <h2 className="text-[14px] font-extrabold text-[color:var(--color-myntra-navy)] mb-2">Revenue (last 12 months)</h2>
        <RevenueChart data={revenueByMonth} />
      </div>

      {/* Top products */}
      <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md overflow-hidden">
        <div className="px-4 py-3 border-b border-[color:var(--color-myntra-border-soft)]"><h2 className="text-[14px] font-extrabold text-[color:var(--color-myntra-navy)]">Top products by revenue</h2></div>
        <table className="w-full text-[13px]">
          <thead className="bg-[color:var(--color-myntra-bg-soft)] text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-[color:var(--color-myntra-ink-mute)]">
            <tr><th className="px-4 py-2">Product</th><th className="px-4 py-2 text-right">Units</th><th className="px-4 py-2 text-right">Revenue</th></tr>
          </thead>
          <tbody>
            {topProducts.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-[color:var(--color-myntra-ink-mute)]">No sales yet.</td></tr>
            ) : topProducts.map(p => (
              <tr key={p.name} className="border-t border-[color:var(--color-myntra-border-soft)]">
                <td className="px-4 py-2 font-semibold text-[color:var(--color-myntra-navy)]">{p.name}</td>
                <td className="px-4 py-2 text-right">{p.units}</td>
                <td className="px-4 py-2 text-right font-bold">{formatINR(p.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Customer ledger */}
      <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md overflow-hidden">
        <div className="px-4 py-3 border-b border-[color:var(--color-myntra-border-soft)]"><h2 className="text-[14px] font-extrabold text-[color:var(--color-myntra-navy)]">Customer ledger (top 20)</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-[color:var(--color-myntra-bg-soft)] text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-[color:var(--color-myntra-ink-mute)]">
              <tr><th className="px-4 py-2">Customer</th><th className="px-4 py-2 text-right">Lifetime spend</th><th className="px-4 py-2 text-right">Outstanding</th><th className="px-4 py-2 text-right">Refunded</th></tr>
            </thead>
            <tbody>
              {ledger.map((r, i) => (
                <tr key={i} className="border-t border-[color:var(--color-myntra-border-soft)]">
                  <td className="px-4 py-2 font-semibold text-[color:var(--color-myntra-navy)]">{r.name}</td>
                  <td className="px-4 py-2 text-right font-bold">{formatINR(r.spend)}</td>
                  <td className="px-4 py-2 text-right" style={{ color: r.outstanding > 0 ? '#9A5B12' : undefined }}>{formatINR(r.outstanding)}</td>
                  <td className="px-4 py-2 text-right text-[color:var(--color-myntra-ink-soft)]">{formatINR(r.refunded)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* GST register */}
      <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md overflow-hidden">
        <div className="px-4 py-3 border-b border-[color:var(--color-myntra-border-soft)] flex items-center justify-between">
          <h2 className="text-[14px] font-extrabold text-[color:var(--color-myntra-navy)]">GST register / invoices</h2>
          <button onClick={exportRegister} className="btn-outline inline-flex items-center gap-1.5 !py-2 text-[12px]"><Download className="w-4 h-4" /> Export CSV</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-[color:var(--color-myntra-bg-soft)] text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-[color:var(--color-myntra-ink-mute)]">
              <tr>
                <th className="px-4 py-2">Invoice No</th><th className="px-4 py-2">Date</th><th className="px-4 py-2">Customer</th>
                <th className="px-4 py-2 text-right">Taxable</th><th className="px-4 py-2 text-right">CGST</th><th className="px-4 py-2 text-right">SGST</th>
                <th className="px-4 py-2 text-right">IGST</th><th className="px-4 py-2 text-right">Total</th><th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {register.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-6 text-center text-[color:var(--color-myntra-ink-mute)]">No invoices yet.</td></tr>
              ) : register.map(({ order: o, gst, inv }) => (
                <tr key={o.id} className="border-t border-[color:var(--color-myntra-border-soft)] hover:bg-[color:var(--color-myntra-bg-soft)]">
                  <td className="px-4 py-2 font-mono text-[12px]">{inv}</td>
                  <td className="px-4 py-2 text-[color:var(--color-myntra-ink-soft)]">{new Date(o.placedAt).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-2">{o.shippingAddress?.fullName ?? '—'}</td>
                  <td className="px-4 py-2 text-right">{formatINR(gst.taxableValue)}</td>
                  <td className="px-4 py-2 text-right">{formatINR(gst.cgst)}</td>
                  <td className="px-4 py-2 text-right">{formatINR(gst.sgst)}</td>
                  <td className="px-4 py-2 text-right">{formatINR(gst.igst)}</td>
                  <td className="px-4 py-2 text-right font-bold">{formatINR(o.total ?? 0)}</td>
                  <td className="px-4 py-2 text-right"><button onClick={() => setInvoiceOrder(o)} className="text-[color:var(--color-myntra-pink)] font-bold text-[12px] inline-flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice overlay */}
      {invoiceOrder && (
        <div className="fixed inset-0 z-[120] overflow-y-auto py-6 px-3" style={{ backgroundColor: 'rgba(20,16,24,0.6)' }} onClick={() => setInvoiceOrder(null)}>
          <div onClick={e => e.stopPropagation()} className="max-w-[860px] mx-auto">
            <div className="no-print flex justify-end mb-2">
              <button onClick={() => setInvoiceOrder(null)} className="p-2 rounded-full bg-white shadow" aria-label="Close"><X className="w-5 h-5" /></button>
            </div>
            <TaxInvoice order={invoiceOrder} />
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBilling;
