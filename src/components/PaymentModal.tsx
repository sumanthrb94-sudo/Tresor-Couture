import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  CreditCard,
  Landmark,
  Lock,
  Smartphone,
  X
} from 'lucide-react';
import { formatINR } from '../constants';
import type { Order, PaymentMethod, ShippingAddress } from '../types';
import { useOrders } from '../context/OrderContext';

type Tab = Extract<PaymentMethod, 'card' | 'upi' | 'cod'>;
type Stage = 'form' | 'processing' | 'success' | 'error';

const COD_SURCHARGE = 50;

interface Props {
  open: boolean;
  amount: number;
  initialMethod?: Tab;
  shippingAddress: ShippingAddress;
  items: { fabricId: string; quantity: number; color?: string }[];
  couponCode?: string;
  onClose: () => void;
  onSuccess: (order: Order) => void;
}

const luhnOk = (digits: string): boolean => {
  // Standard Luhn — only used as a soft hint, not strict.
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (n < 0 || n > 9) return false;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
};

const formatCardNumber = (raw: string): string =>
  raw.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ');

const formatExpiry = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
};

const PaymentModal: React.FC<Props> = ({
  open,
  amount,
  initialMethod = 'upi',
  shippingAddress,
  items,
  couponCode,
  onClose,
  onSuccess
}) => {
  const { placeOrder } = useOrders();

  const [tab, setTab] = useState<Tab>(initialMethod);
  const [stage, setStage] = useState<Stage>('form');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [card, setCard] = useState({ number: '', name: '', expiry: '', cvv: '' });
  const [upi, setUpi] = useState('');

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const firstFieldRef = useRef<HTMLButtonElement | null>(null);

  // Reset state each time the modal opens so a previous error doesn't bleed in.
  useEffect(() => {
    if (open) {
      setTab(initialMethod);
      setStage('form');
      setErrorMsg(null);
      setErrors({});
    }
  }, [open, initialMethod]);

  // Escape-to-close + focus trap on Tab.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    firstFieldRef.current?.focus();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && stage === 'form') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, stage, onClose]);

  const totalDue = useMemo(() => (tab === 'cod' ? amount + COD_SURCHARGE : amount), [amount, tab]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (tab === 'card') {
      const digits = card.number.replace(/\s/g, '');
      if (digits.length !== 16) e.cardNumber = 'Enter a 16-digit card number';
      else if (!luhnOk(digits)) e.cardNumber = 'Card number looks invalid';
      if (!card.name.trim()) e.cardName = 'Name on card is required';
      if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(card.expiry)) e.cardExpiry = 'MM/YY';
      else {
        const [mm, yy] = card.expiry.split('/').map(s => parseInt(s, 10));
        const now = new Date();
        const exp = new Date(2000 + yy, mm, 0, 23, 59, 59);
        if (exp.getTime() < now.getTime()) e.cardExpiry = 'Card has expired';
      }
      if (!/^\d{3}$/.test(card.cvv)) e.cardCvv = '3-digit CVV';
    } else if (tab === 'upi') {
      if (!/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upi.trim())) e.upi = 'Enter a valid UPI ID (name@bank)';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const runPayment = useCallback(async () => {
    setStage('processing');
    setErrorMsg(null);

    // 2.5s bank-emblem animation, then attempt the real order.
    await new Promise(resolve => setTimeout(resolve, 2500));

    try {
      const placed = await placeOrder({
        items,
        shippingAddress,
        paymentMethod: tab,
        couponCode
      });
      setStage('success');
      // Brief tick celebration before handing back to the page.
      setTimeout(() => onSuccess(placed), 800);
    } catch (err) {
      setStage('error');
      setErrorMsg(err instanceof Error ? err.message : 'Payment could not be processed.');
    }
  }, [placeOrder, items, shippingAddress, tab, couponCode, onSuccess]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    void runPayment();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm"
      onMouseDown={e => {
        // Click-outside dismiss while in form stage only.
        if (e.target === e.currentTarget && stage === 'form') onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-modal-title"
        className="bg-white w-full sm:max-w-[460px] sm:rounded-lg shadow-2xl max-h-[92vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[color:var(--color-myntra-navy)] text-white px-5 py-3 flex items-center justify-between sm:rounded-t-lg">
          <div className="flex items-center gap-2">
            <Landmark className="w-5 h-5 text-[color:var(--color-myntra-gold)]" aria-hidden />
            <h2 id="payment-modal-title" className="text-[14px] font-extrabold tracking-wider uppercase">
              Tresor Pay · Secure Checkout
            </h2>
          </div>
          <button
            ref={firstFieldRef}
            type="button"
            onClick={onClose}
            disabled={stage === 'processing'}
            className="text-white/80 hover:text-white disabled:opacity-40"
            aria-label="Close payment dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {stage === 'form' && (
          <form onSubmit={handleSubmit} className="px-5 py-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[12px] uppercase tracking-wider font-bold text-[color:var(--color-myntra-ink-soft)]">
                Amount payable
              </p>
              <p className="text-[20px] font-extrabold text-[color:var(--color-myntra-navy)]">
                {formatINR(totalDue)}
              </p>
            </div>

            {/* Tabs */}
            <div role="tablist" aria-label="Payment methods" className="grid grid-cols-3 gap-2 mb-5">
              {([
                { id: 'upi', label: 'UPI', icon: Smartphone },
                { id: 'card', label: 'Card', icon: CreditCard },
                { id: 'cod', label: 'COD', icon: Banknote }
              ] as const).map(opt => {
                const Icon = opt.icon;
                const active = tab === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      setTab(opt.id);
                      setErrors({});
                    }}
                    className={`flex flex-col items-center gap-1 py-3 border text-[12px] font-bold rounded transition-colors ${
                      active
                        ? 'border-[color:var(--color-myntra-pink)] bg-[#FFF0E8] text-[color:var(--color-myntra-pink)]'
                        : 'border-[color:var(--color-myntra-border)] hover:border-[color:var(--color-myntra-navy)] text-[color:var(--color-myntra-ink-soft)]'
                    }`}
                  >
                    <Icon className="w-4 h-4" aria-hidden />
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {tab === 'card' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-1.5">
                    Card Number
                  </label>
                  <input
                    className="input-box font-mono tracking-wider"
                    placeholder="1234 5678 9012 3456"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    value={card.number}
                    onChange={e => setCard(c => ({ ...c, number: formatCardNumber(e.target.value) }))}
                  />
                  {errors.cardNumber && <p className="text-[12px] text-[color:var(--color-myntra-pink)] mt-1 font-semibold">{errors.cardNumber}</p>}
                </div>
                <div>
                  <label className="block text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-1.5">
                    Name on Card
                  </label>
                  <input
                    className="input-box"
                    autoComplete="cc-name"
                    value={card.name}
                    onChange={e => setCard(c => ({ ...c, name: e.target.value }))}
                  />
                  {errors.cardName && <p className="text-[12px] text-[color:var(--color-myntra-pink)] mt-1 font-semibold">{errors.cardName}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-1.5">
                      Expiry
                    </label>
                    <input
                      className="input-box font-mono"
                      placeholder="MM/YY"
                      inputMode="numeric"
                      autoComplete="cc-exp"
                      value={card.expiry}
                      onChange={e => setCard(c => ({ ...c, expiry: formatExpiry(e.target.value) }))}
                    />
                    {errors.cardExpiry && <p className="text-[12px] text-[color:var(--color-myntra-pink)] mt-1 font-semibold">{errors.cardExpiry}</p>}
                  </div>
                  <div>
                    <label className="block text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-1.5">
                      CVV
                    </label>
                    <input
                      className="input-box font-mono"
                      type="password"
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      maxLength={3}
                      value={card.cvv}
                      onChange={e => setCard(c => ({ ...c, cvv: e.target.value.replace(/\D/g, '').slice(0, 3) }))}
                    />
                    {errors.cardCvv && <p className="text-[12px] text-[color:var(--color-myntra-pink)] mt-1 font-semibold">{errors.cardCvv}</p>}
                  </div>
                </div>
              </div>
            )}

            {tab === 'upi' && (
              <div>
                <label className="block text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-1.5">
                  UPI ID
                </label>
                <input
                  className="input-box"
                  placeholder="yourname@bank"
                  inputMode="email"
                  autoComplete="off"
                  value={upi}
                  onChange={e => setUpi(e.target.value)}
                />
                {errors.upi && <p className="text-[12px] text-[color:var(--color-myntra-pink)] mt-1 font-semibold">{errors.upi}</p>}
                <p className="text-[11px] text-[color:var(--color-myntra-ink-mute)] mt-2">
                  A collect request will be sent to your UPI app. (Demo — no actual gateway call.)
                </p>
              </div>
            )}

            {tab === 'cod' && (
              <div className="bg-[color:var(--color-myntra-bg-soft)] border border-[color:var(--color-myntra-border-soft)] p-4 rounded">
                <p className="text-[13px] font-bold mb-1">Pay on delivery</p>
                <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] leading-relaxed">
                  Cash on Delivery includes a nominal <span className="font-bold text-[color:var(--color-myntra-navy)]">{formatINR(COD_SURCHARGE)}</span> handling surcharge. Available across India for eligible PIN codes.
                </p>
              </div>
            )}

            <div className="mt-5 flex items-center gap-2 text-[11px] text-[color:var(--color-myntra-ink-mute)]">
              <Lock className="w-3.5 h-3.5" />
              256-bit TLS · PCI-DSS demo flow · No real funds move.
            </div>

            <div className="mt-5 flex gap-2">
              <button type="button" onClick={onClose} className="btn-outline flex-1">
                Cancel
              </button>
              <button type="submit" className="btn-primary flex-1">
                Pay {formatINR(totalDue)}
              </button>
            </div>
          </form>
        )}

        {stage === 'processing' && (
          <div className="px-5 py-10 text-center">
            <div className="relative inline-flex items-center justify-center w-20 h-20 mb-4">
              <span className="absolute inset-0 rounded-full border-4 border-[color:var(--color-myntra-border)] border-t-[color:var(--color-myntra-pink)] animate-spin" aria-hidden />
              <Landmark className="w-8 h-8 text-[color:var(--color-myntra-navy)]" aria-hidden />
            </div>
            <p className="text-[15px] font-extrabold text-[color:var(--color-myntra-navy)]">Processing payment…</p>
            <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] mt-1">
              Contacting your bank. Please do not refresh this page.
            </p>
            <p className="text-[11px] text-[color:var(--color-myntra-ink-mute)] mt-4">
              Amount: <span className="font-bold">{formatINR(totalDue)}</span>
            </p>
          </div>
        )}

        {stage === 'success' && (
          <div className="px-5 py-10 text-center" role="status" aria-live="polite">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[color:var(--color-myntra-green)]/15 mb-4">
              <CheckCircle2 className="w-12 h-12 text-[color:var(--color-myntra-green)]" aria-hidden />
            </div>
            <p className="text-[15px] font-extrabold text-[color:var(--color-myntra-green)]">Payment successful</p>
            <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] mt-1">
              Redirecting to your order confirmation…
            </p>
          </div>
        )}

        {stage === 'error' && (
          <div className="px-5 py-8 text-center" role="alert">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[color:var(--color-myntra-pink)]/10 mb-3">
              <AlertCircle className="w-9 h-9 text-[color:var(--color-myntra-pink)]" aria-hidden />
            </div>
            <p className="text-[15px] font-extrabold text-[color:var(--color-myntra-pink)]">Payment failed</p>
            <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] mt-1 max-w-xs mx-auto">
              {errorMsg ?? 'Something went wrong while placing your order.'}
            </p>
            <div className="mt-5 flex gap-2 justify-center">
              <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
              <button type="button" onClick={() => void runPayment()} className="btn-primary">Retry</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentModal;
