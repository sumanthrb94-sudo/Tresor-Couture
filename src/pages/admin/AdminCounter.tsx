import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScanLine, Trash2, Minus, Plus, Loader2, AlertCircle, CheckCircle2, RotateCcw } from 'lucide-react';
import { formatINR, TAX_RATE } from '../../constants';
import { lookupCode, ringSale, saleErrorMessage, type Lookup } from '../../lib/pos';
import { unitsAvailable } from '../../lib/availability';
import TaxInvoice from '../../components/TaxInvoice';
import FabricImage from '../../components/FabricImage';
import type { CounterPaymentMethod, Fabric, Order } from '../../types';

/**
 * The counter — ring up a walk-in sale at the studio.
 *
 * A USB barcode scanner is a keyboard: it types the code and presses Enter. So
 * the whole till is one always-focused input. No driver, no SDK, and typing a
 * code by hand works identically when a label is scuffed.
 *
 * It lives in its own section rather than inside Billing, which is 258 lines of
 * read-only reporting that writes nothing — a live till inside a finance report
 * muddles both.
 *
 * The totals shown here are for the operator's eyes. Every rupee that is
 * actually charged is recomputed server-side by /api/pos/sale from Firestore
 * prices; this screen sends nothing but product ids and quantities.
 */

interface Line {
  product: Fabric;
  quantity: number;
}

const PAYMENTS: { id: CounterPaymentMethod; label: string }[] = [
  { id: 'cash', label: 'Cash' },
  { id: 'upi', label: 'UPI' },
  { id: 'card', label: 'Card' },
];

/** One id per ticket, held across retries so a double-submit reprints rather
 *  than double-charges. `randomUUID` needs a secure context, which the admin
 *  console always is; the fallback keeps a plain-HTTP dev server working. */
const newSaleKey = (): string => {
  const c = globalThis.crypto;
  if (c && 'randomUUID' in c) return c.randomUUID();
  return `k-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
};

const AdminCounter: React.FC = () => {
  const [lines, setLines] = useState<Line[]>([]);
  const [scan, setScan] = useState('');
  const [looking, setLooking] = useState(false);
  const [payment, setPayment] = useState<CounterPaymentMethod>('cash');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [saleKey, setSaleKey] = useState(newSaleKey);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [completed, setCompleted] = useState<{ order: Order; reprint: boolean } | null>(null);

  const scanRef = useRef<HTMLInputElement>(null);

  /* The scanner types wherever focus is, so focus has to come back on its own
     after every interaction — otherwise the first scan after touching a button
     is silently swallowed. */
  const refocus = useCallback(() => {
    if (!completed) scanRef.current?.focus();
  }, [completed]);

  useEffect(() => { refocus(); }, [refocus, lines.length]);

  const addProduct = useCallback((product: Fabric, matchedBy: Lookup['matchedBy']) => {
    setError(null);
    const available = unitsAvailable(product);
    setLines(prev => {
      const idx = prev.findIndex(l => l.product.id === product.id);
      if (idx === -1) {
        if (available < 1) {
          setError(`${product.name} shows no units in stock. Adjust stock in Inventory, or sell a different piece.`);
          return prev;
        }
        return [...prev, { product, quantity: 1 }];
      }
      // Re-scanning the same piece increments, which is how a counter actually
      // works — you scan two of a thing twice.
      const next = [...prev];
      const wanted = next[idx].quantity + 1;
      if (wanted > available) {
        setError(`Only ${available} of ${product.name} in stock.`);
        return prev;
      }
      next[idx] = { ...next[idx], quantity: wanted };
      return next;
    });
    setNotice(matchedBy === 'barcode' ? null : `Matched on ${matchedBy === 'id' ? 'product id' : 'supplier code'}, not a barcode.`);
  }, []);

  const submitScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = scan.trim();
    if (!code || looking) return;
    setLooking(true);
    setError(null);
    try {
      const hit = await lookupCode(code);
      if (!hit) {
        setError(`Nothing in the catalogue matches "${code}". Check the label, or search for the piece in Inventory.`);
      } else {
        addProduct(hit.product, hit.matchedBy);
      }
    } catch {
      setError('Could not reach the catalogue. Check the connection and scan again.');
    } finally {
      setScan('');
      setLooking(false);
      scanRef.current?.focus();
    }
  };

  const setQuantity = (id: string, quantity: number) => {
    setError(null);
    setLines(prev => prev.flatMap(l => {
      if (l.product.id !== id) return [l];
      if (quantity <= 0) return [];
      const available = unitsAvailable(l.product);
      if (quantity > available) {
        setError(`Only ${available} of ${l.product.name} in stock.`);
        return [l];
      }
      return [{ ...l, quantity }];
    }));
  };

  /* Indicative only — the server recomputes everything. Prices are
     tax-inclusive, so GST is reported as a component and never added on top. */
  const totals = useMemo(() => {
    const subtotal = lines.reduce((s, l) => s + (l.product.price ?? 0) * l.quantity, 0);
    const units = lines.reduce((s, l) => s + l.quantity, 0);
    return { subtotal, units, tax: Math.round((subtotal * TAX_RATE) / (1 + TAX_RATE)) };
  }, [lines]);

  const completeSale = async () => {
    if (!lines.length || placing) return;
    setPlacing(true);
    setError(null);
    try {
      const res = await ringSale({
        items: lines.map(l => ({ fabricId: l.product.id, quantity: l.quantity })),
        paymentMethod: payment,
        // Deliberately the SAME key on a retry: the server keys idempotency on
        // it, so a double-tap reprints instead of charging twice.
        saleKey,
        ...(customerName.trim() || customerPhone.trim()
          ? { customer: { name: customerName.trim(), phone: customerPhone.trim() } }
          : {}),
      });
      setCompleted({ order: res.order, reprint: res.alreadyProcessed });
    } catch (err) {
      setError(saleErrorMessage(err));
    } finally {
      setPlacing(false);
    }
  };

  const startNextSale = () => {
    setLines([]);
    setScan('');
    setCustomerName('');
    setCustomerPhone('');
    setPayment('cash');
    setSaleKey(newSaleKey());   // a new ticket is a new idempotency key
    setCompleted(null);
    setError(null);
    setNotice(null);
    window.setTimeout(() => scanRef.current?.focus(), 0);
  };

  /* ── Sale complete: show the invoice, ready to print and hand over ────── */
  if (completed) {
    return (
      <div className="space-y-4">
        <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-[color:var(--color-myntra-green)] shrink-0 mt-0.5" />
            <div>
              <h1 className="text-[18px] font-extrabold text-[color:var(--color-myntra-navy)]">
                {completed.reprint ? 'Already rung up — reprinting' : 'Sale complete'}
              </h1>
              <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)]">
                {completed.reprint
                  ? 'This ticket had already been completed, so nothing was charged again. This is the same invoice.'
                  : 'Stock has been reduced and the sale is in Orders and Billing.'}
              </p>
            </div>
          </div>
          <button onClick={startNextSale} className="btn-primary inline-flex items-center justify-center gap-2 whitespace-nowrap">
            <RotateCcw className="w-4 h-4" /> Next sale
          </button>
        </div>
        <TaxInvoice order={completed.order} />
      </div>
    );
  }

  /* ── The till ─────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-4">
      <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md p-4">
        <h1 className="text-[20px] font-extrabold text-[color:var(--color-myntra-navy)] flex items-center gap-2">
          <ScanLine className="w-5 h-5" /> Counter
        </h1>
        <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] mt-1 max-w-3xl">
          Scan a label, or type the code and press Enter. Scanning the same piece again adds one more.
          Prices come from the catalogue — the sale is priced and stock is reduced on the server, so
          this till can never charge a figure of its own.
        </p>

        <form onSubmit={submitScan} className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <ScanLine className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-myntra-ink-mute)]" />
            <input
              ref={scanRef}
              value={scan}
              onChange={e => setScan(e.target.value)}
              onBlur={refocus}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              placeholder="Scan barcode…"
              aria-label="Scan or type a barcode"
              className="input-box pl-9 w-full text-[15px]"
            />
          </div>
          <button type="submit" disabled={!scan.trim() || looking} className="btn-outline !py-2.5 min-w-[92px] inline-flex items-center justify-center gap-2">
            {looking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
          </button>
        </form>

        {error && (
          <p role="alert" className="mt-3 text-[12px] text-[#A12626] flex items-start gap-1.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-px" /> {error}
          </p>
        )}
        {notice && !error && (
          <p className="mt-3 text-[12px] text-[#9A5B12]">{notice}</p>
        )}
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
        {/* Ticket */}
        <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md overflow-hidden">
          {!lines.length ? (
            <div className="p-10 text-center text-[14px] text-[color:var(--color-myntra-ink-soft)]">
              Nothing on this ticket yet. Scan a label to begin.
            </div>
          ) : (
            <table className="w-full text-[13px]">
              <thead className="bg-[color:var(--color-myntra-bg-soft)] border-b border-[color:var(--color-myntra-border-soft)] text-left">
                <tr className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[color:var(--color-myntra-ink-mute)]">
                  <th className="px-3 py-2.5">Item</th>
                  <th className="px-3 py-2.5 text-right">Price</th>
                  <th className="px-3 py-2.5 text-center">Qty</th>
                  <th className="px-3 py-2.5 text-right">Amount</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {lines.map(l => (
                  <tr key={l.product.id} className="border-b border-[color:var(--color-myntra-border-soft)]">
                    <td className="px-3 py-2.5">
                      <div className="flex gap-2.5 items-center">
                        <div className="w-9 h-12 rounded overflow-hidden border border-[color:var(--color-myntra-border-soft)] bg-[color:var(--color-myntra-bg-soft)] shrink-0">
                          <FabricImage photo={l.product.photo} fallback={l.product.image} alt={l.product.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-[color:var(--color-myntra-navy)] line-clamp-1">{l.product.name}</div>
                          <div className="text-[10px] font-bold text-[#5C3A8E]">{l.product.barcode ?? l.product.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">{formatINR(l.product.price ?? 0)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => setQuantity(l.product.id, l.quantity - 1)} className="w-7 h-7 rounded border border-[color:var(--color-myntra-border-soft)] flex items-center justify-center" aria-label={`One fewer ${l.product.name}`}>
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-8 text-center font-semibold">{l.quantity}</span>
                        <button onClick={() => setQuantity(l.product.id, l.quantity + 1)} className="w-7 h-7 rounded border border-[color:var(--color-myntra-border-soft)] flex items-center justify-center" aria-label={`One more ${l.product.name}`}>
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="text-center text-[10px] text-[color:var(--color-myntra-ink-mute)] mt-1">
                        {unitsAvailable(l.product)} in stock
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold">{formatINR((l.product.price ?? 0) * l.quantity)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <button onClick={() => setQuantity(l.product.id, 0)} className="text-[color:var(--color-myntra-ink-mute)] hover:text-[#A12626]" aria-label={`Remove ${l.product.name}`}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Payment */}
        <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md p-4 space-y-4">
          <div className="space-y-1.5 text-[13px]">
            <div className="flex justify-between">
              <span className="text-[color:var(--color-myntra-ink-soft)]">{totals.units} item{totals.units === 1 ? '' : 's'}</span>
              <span className="font-semibold">{formatINR(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-[11px] text-[color:var(--color-myntra-ink-mute)]">
              <span>includes GST</span>
              <span>{formatINR(totals.tax)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-[color:var(--color-myntra-border-soft)] text-[16px] font-extrabold text-[color:var(--color-myntra-navy)]">
              <span>To pay</span>
              <span>{formatINR(totals.subtotal)}</span>
            </div>
            <p className="text-[10px] text-[color:var(--color-myntra-ink-mute)]">
              Nothing is shipped, so no delivery charge. The server confirms the final figure.
            </p>
          </div>

          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[color:var(--color-myntra-ink-mute)] mb-1.5">Paid by</p>
            <div className="grid grid-cols-3 gap-1.5">
              {PAYMENTS.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setPayment(p.id); refocus(); }}
                  aria-pressed={payment === p.id}
                  className={`py-2 rounded border text-[12px] font-bold ${
                    payment === p.id
                      ? 'border-[color:var(--color-myntra-pink)] text-[color:var(--color-myntra-pink)] bg-[#FDEEF2]'
                      : 'border-[color:var(--color-myntra-border-soft)] text-[color:var(--color-myntra-ink-soft)]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[color:var(--color-myntra-ink-mute)]">Customer (optional)</p>
            <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Name for the invoice" className="input-box w-full text-[13px]" />
            <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Phone" inputMode="tel" className="input-box w-full text-[13px]" />
          </div>

          <button
            onClick={completeSale}
            disabled={!lines.length || placing}
            className="btn-primary w-full inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {placing ? <><Loader2 className="w-4 h-4 animate-spin" /> Completing…</> : `Complete sale · ${formatINR(totals.subtotal)}`}
          </button>
          <p className="text-[10px] text-[color:var(--color-myntra-ink-mute)] text-center">
            Coupons are not applied at the counter.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminCounter;
