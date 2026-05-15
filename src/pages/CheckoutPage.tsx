import React, { useState } from 'react';
import { CheckCircle2, CreditCard, Lock, MapPin, Smartphone, Tag, Truck, User } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useRouter } from '../context/RouterContext';
import { useOrders } from '../context/OrderContext';
import { useAuth } from '../context/AuthContext';
import { formatINR } from '../constants';
import { PaymentMethod, ShippingAddress } from '../types';
import { couponsApi } from '../lib/firebase';
import FabricImage from '../components/FabricImage';

type Step = 'login' | 'address' | 'payment';

const initialAddress: ShippingAddress = {
  fullName: '',
  email: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'India'
};

const CheckoutPage: React.FC = () => {
  const { resolved, subtotal, shipping, tax, total, clear } = useCart();
  const { navigate } = useRouter();
  const { placeOrder } = useOrders();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>(user ? 'address' : 'login');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [address, setAddress] = useState<ShippingAddress>(
    user?.defaultAddress
      ?? { ...initialAddress, fullName: user?.fullName ?? '', email: user?.email ?? '', phone: user?.phone ?? '' }
  );
  const [payment, setPayment] = useState<PaymentMethod>('upi');
  const [card, setCard] = useState({ number: '', name: '', expiry: '', cvv: '' });
  const [upi, setUpi] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);

  const [couponInput, setCouponInput] = useState('');
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMsg, setCouponMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);

  if (resolved.length === 0) {
    return (
      <main className="pt-[140px] pb-20 min-h-screen text-center px-5 bg-white">
        <h1 className="text-3xl font-extrabold mb-4">Your bag is empty</h1>
        <button onClick={() => navigate({ name: 'shop' })} className="btn-primary">Continue Shopping</button>
      </main>
    );
  }

  const mrpTotal = resolved.reduce((s, { item, fabric }) => s + fabric.mrpPerMeter * item.meters, 0);
  const productDiscount = mrpTotal - subtotal;
  const payable = Math.max(0, total - couponDiscount);

  const validateAddress = (): boolean => {
    const e: Record<string, string> = {};
    if (!address.fullName.trim()) e.fullName = 'Required';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address.email)) e.email = 'Valid email required';
    if (!/^[0-9+\-\s()]{7,}$/.test(address.phone)) e.phone = 'Valid phone required';
    if (!address.line1.trim()) e.line1 = 'Required';
    if (!address.city.trim()) e.city = 'Required';
    if (!address.state.trim()) e.state = 'Required';
    if (!/^[0-9A-Za-z\- ]{4,}$/.test(address.postalCode)) e.postalCode = 'Valid postal code required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validatePayment = (): boolean => {
    const e: Record<string, string> = {};
    if (payment === 'card') {
      if (!/^[0-9\s]{12,19}$/.test(card.number)) e.cardNumber = 'Enter a valid card number';
      if (!card.name.trim()) e.cardName = 'Required';
      if (!/^(0[1-9]|1[0-2])\/?([0-9]{2})$/.test(card.expiry)) e.cardExpiry = 'MM/YY';
      if (!/^[0-9]{3,4}$/.test(card.cvv)) e.cardCvv = '3-4 digits';
    }
    if (payment === 'upi' && !/^[\w.\-]+@[\w]+$/.test(upi)) e.upi = 'Enter a valid UPI ID';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const applyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponBusy(true);
    setCouponMsg(null);
    try {
      const res = await couponsApi.validate(code, subtotal);
      if (!res.valid) {
        setCouponCode(null);
        setCouponDiscount(0);
        const text =
          res.reason === 'not_found'    ? 'Coupon code is invalid.'
        : res.reason === 'inactive'     ? 'This coupon is no longer active.'
        : res.reason === 'expired'      ? 'This coupon has expired.'
        : res.reason === 'min_subtotal' ? `Add ${formatINR(res.minSubtotal ?? 0)} more to use this coupon.`
        : 'This coupon cannot be used.';
        setCouponMsg({ ok: false, text });
        return;
      }
      setCouponCode(code);
      setCouponDiscount(res.discount);
      setCouponMsg({ ok: true, text: `Applied — ${formatINR(res.discount)} off.` });
    } catch (err) {
      setCouponMsg({ ok: false, text: err instanceof Error ? err.message : 'Could not validate coupon.' });
    } finally {
      setCouponBusy(false);
    }
  };

  const clearCoupon = () => {
    setCouponCode(null);
    setCouponDiscount(0);
    setCouponMsg(null);
    setCouponInput('');
  };

  const handlePlaceOrder = async () => {
    if (!validatePayment()) return;
    if (!user) {
      // ordersApi.place() asserts auth; route to login rather than 500.
      setPlaceError('Please sign in to place your order.');
      navigate({ name: 'login' });
      return;
    }
    setPlacing(true);
    setPlaceError(null);
    try {
      const placed = await placeOrder({
        items: resolved.map(({ item }) => ({ fabricId: item.fabricId, meters: item.meters, color: item.color })),
        shippingAddress: address,
        paymentMethod: payment,
        couponCode: couponCode ?? undefined
      });
      clear();
      navigate({ name: 'confirmation', orderId: placed.id });
    } catch (err) {
      setPlaceError(err instanceof Error ? err.message : 'Could not place your order.');
    } finally {
      setPlacing(false);
    }
  };

  const StepBlock: React.FC<{ id: Step; index: number; title: string; doneTitle?: string; children: React.ReactNode }> = ({ id, index, title, doneTitle, children }) => {
    const active = step === id;
    const done =
      (id === 'login' && (step === 'address' || step === 'payment')) ||
      (id === 'address' && step === 'payment');

    return (
      <div className={`bg-white border ${active ? 'border-[color:var(--color-myntra-pink)]' : 'border-[color:var(--color-myntra-border-soft)]'} mb-3`}>
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold ${done ? 'bg-[color:var(--color-myntra-green)] text-white' : active ? 'bg-[color:var(--color-myntra-pink)] text-white' : 'bg-[color:var(--color-myntra-bg-soft)] text-[color:var(--color-myntra-ink-soft)]'}`}>
              {done ? <CheckCircle2 className="w-4 h-4" /> : index}
            </span>
            <span className="text-[14px] font-extrabold uppercase tracking-wider">
              {done && doneTitle ? doneTitle : title}
            </span>
          </div>
          {done && (
            <button onClick={() => setStep(id)} className="text-[12px] font-bold text-[color:var(--color-myntra-pink)]">CHANGE</button>
          )}
        </div>
        {active && <div className="px-4 pb-5 pt-2">{children}</div>}
      </div>
    );
  };

  const Field: React.FC<{ label: string; field: string; children: React.ReactNode; cols?: number }> = ({ label, field, children, cols = 1 }) => (
    <div className={cols === 2 ? 'sm:col-span-2' : ''}>
      <label className="block text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-1.5">{label}</label>
      {children}
      {errors[field] && <p className="text-[12px] text-[color:var(--color-myntra-pink)] mt-1 font-semibold">{errors[field]}</p>}
    </div>
  );

  return (
    <main className="pt-[100px] pb-12 md:pb-16 bg-[color:var(--color-myntra-bg-soft)] min-h-screen">
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 lg:px-10">
        <h1 className="text-xl md:text-2xl font-extrabold mb-4 text-[color:var(--color-myntra-navy)]">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 lg:gap-6">
          <div>
            <StepBlock id="login" index={1} title="Login or Sign Up" doneTitle={user ? `Signed in: ${user.fullName}` : `Login: ${phone || 'Guest checkout'}`}>
              <div className="flex items-center gap-3 mb-3 text-[color:var(--color-myntra-ink-soft)]">
                <User className="w-4 h-4" />
                <p className="text-[13px]">
                  {user
                    ? 'You are signed in. Continue to delivery.'
                    : 'Sign in to track your order, or continue as guest.'}
                </p>
              </div>
              {user ? (
                <button onClick={() => setStep('address')} className="btn-primary">Continue</button>
              ) : (
                <div className="flex flex-wrap gap-2 max-w-md">
                  <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 Mobile number" className="input-box flex-1 min-w-[180px]" />
                  <button onClick={() => navigate({ name: 'login' })} className="btn-outline">Sign In</button>
                  <button onClick={() => setStep('address')} className="btn-primary">Continue</button>
                </div>
              )}
            </StepBlock>

            <StepBlock
              id="address"
              index={2}
              title="Delivery Address"
              doneTitle={address.fullName ? `Delivery to: ${address.fullName}, ${address.city}` : 'Delivery Address'}
            >
              <div className="flex items-center gap-3 mb-4 text-[color:var(--color-myntra-ink-soft)]">
                <MapPin className="w-4 h-4" />
                <p className="text-[13px]">Where would you like your weaves delivered?</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Full Name" field="fullName" cols={2}>
                  <input className="input-box" value={address.fullName} onChange={e => setAddress(a => ({ ...a, fullName: e.target.value }))} />
                </Field>
                <Field label="Email" field="email">
                  <input className="input-box" type="email" value={address.email} onChange={e => setAddress(a => ({ ...a, email: e.target.value }))} />
                </Field>
                <Field label="Phone" field="phone">
                  <input className="input-box" type="tel" value={address.phone} onChange={e => setAddress(a => ({ ...a, phone: e.target.value }))} />
                </Field>
                <Field label="Address Line 1" field="line1" cols={2}>
                  <input className="input-box" value={address.line1} onChange={e => setAddress(a => ({ ...a, line1: e.target.value }))} />
                </Field>
                <Field label="Address Line 2 (optional)" field="line2" cols={2}>
                  <input className="input-box" value={address.line2 ?? ''} onChange={e => setAddress(a => ({ ...a, line2: e.target.value }))} />
                </Field>
                <Field label="City" field="city">
                  <input className="input-box" value={address.city} onChange={e => setAddress(a => ({ ...a, city: e.target.value }))} />
                </Field>
                <Field label="State" field="state">
                  <input className="input-box" value={address.state} onChange={e => setAddress(a => ({ ...a, state: e.target.value }))} />
                </Field>
                <Field label="PIN Code" field="postalCode">
                  <input className="input-box" value={address.postalCode} onChange={e => setAddress(a => ({ ...a, postalCode: e.target.value }))} />
                </Field>
                <Field label="Country" field="country">
                  <input className="input-box" value={address.country} onChange={e => setAddress(a => ({ ...a, country: e.target.value }))} />
                </Field>
              </div>
              <button
                onClick={() => { if (validateAddress()) setStep('payment'); }}
                className="btn-primary mt-5"
              >
                Save & Continue
              </button>
            </StepBlock>

            <StepBlock id="payment" index={3} title="Payment Options">
              <div className="flex items-center gap-3 mb-4 text-[color:var(--color-myntra-ink-soft)]">
                <Lock className="w-4 h-4" />
                <p className="text-[13px]">All payments are encrypted. Demo checkout — no real charges.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                {([
                  { id: 'upi', label: 'UPI', sub: 'GPay / PhonePe / Paytm', icon: Smartphone },
                  { id: 'card', label: 'Credit / Debit Card', sub: 'Visa, MC, Rupay', icon: CreditCard },
                  { id: 'cod', label: 'Cash on Delivery', sub: 'Pay when you receive', icon: Truck }
                ] as const).map(opt => {
                  const Icon = opt.icon;
                  const active = payment === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPayment(opt.id)}
                      className={`text-left border rounded p-3 transition-colors ${active ? 'border-[color:var(--color-myntra-pink)] bg-[#F5E8C8]' : 'border-[color:var(--color-myntra-border)] hover:border-[color:var(--color-myntra-navy)]'}`}
                    >
                      <Icon className="w-5 h-5 mb-2 text-[color:var(--color-myntra-navy)]" />
                      <p className="text-[13px] font-bold">{opt.label}</p>
                      <p className="text-[11px] text-[color:var(--color-myntra-ink-soft)]">{opt.sub}</p>
                    </button>
                  );
                })}
              </div>

              {payment === 'card' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Card Number" field="cardNumber" cols={2}>
                    <input className="input-box" inputMode="numeric" placeholder="1234 5678 9012 3456" value={card.number} onChange={e => setCard(c => ({ ...c, number: e.target.value }))} />
                  </Field>
                  <Field label="Name on Card" field="cardName" cols={2}>
                    <input className="input-box" value={card.name} onChange={e => setCard(c => ({ ...c, name: e.target.value }))} />
                  </Field>
                  <Field label="Expiry (MM/YY)" field="cardExpiry">
                    <input className="input-box" value={card.expiry} onChange={e => setCard(c => ({ ...c, expiry: e.target.value }))} />
                  </Field>
                  <Field label="CVV" field="cardCvv">
                    <input className="input-box" type="password" inputMode="numeric" value={card.cvv} onChange={e => setCard(c => ({ ...c, cvv: e.target.value }))} />
                  </Field>
                </div>
              )}

              {payment === 'upi' && (
                <Field label="UPI ID" field="upi">
                  <input className="input-box max-w-md" placeholder="yourname@bank" value={upi} onChange={e => setUpi(e.target.value)} />
                </Field>
              )}

              {payment === 'cod' && (
                <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)]">
                  Pay in cash when our courier arrives. Available across India for orders below ₹50,000.
                </p>
              )}

              {placeError && (
                <p role="alert" className="mt-4 text-[13px] font-semibold text-[color:var(--color-myntra-pink)] bg-[color:var(--color-myntra-bg-sale)] border border-[color:var(--color-myntra-border)] px-3 py-2 rounded">
                  {placeError}
                </p>
              )}

              <button
                onClick={handlePlaceOrder}
                disabled={placing}
                className="btn-primary mt-5 w-full sm:w-auto inline-flex items-center justify-center gap-2"
              >
                {placing && (
                  <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" aria-hidden />
                )}
                {placing ? 'Placing Order…' : `Place Order · ${formatINR(payable)}`}
              </button>
            </StepBlock>
          </div>

          {/* Summary */}
          <aside>
            <div className="lg:sticky lg:top-[110px] space-y-3">
              {/* Coupon */}
              <div className="bg-white border border-[color:var(--color-myntra-border-soft)] p-4">
                <p className="text-[12px] font-extrabold uppercase tracking-wider text-[color:var(--color-myntra-navy)] mb-3 inline-flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-[color:var(--color-myntra-green)]" /> Apply Coupon
                </p>
                {couponCode ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-bold text-[color:var(--color-myntra-green)]">
                      {couponCode} · −{formatINR(couponDiscount)}
                    </span>
                    <button onClick={clearCoupon} className="text-[12px] font-bold text-[color:var(--color-myntra-pink)]">REMOVE</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      value={couponInput}
                      onChange={e => setCouponInput(e.target.value)}
                      placeholder="Enter coupon code"
                      className="input-box flex-1"
                    />
                    <button onClick={applyCoupon} disabled={couponBusy} className="text-[13px] font-bold text-[color:var(--color-myntra-pink)] px-3 disabled:opacity-60">
                      {couponBusy ? '...' : 'APPLY'}
                    </button>
                  </div>
                )}
                {couponMsg && (
                  <p className={`text-[12px] mt-2 font-semibold ${couponMsg.ok ? 'text-[color:var(--color-myntra-green)]' : 'text-[color:var(--color-myntra-pink)]'}`}>
                    {couponMsg.text}
                  </p>
                )}
              </div>

              <div className="bg-white border border-[color:var(--color-myntra-border-soft)] p-4">
                <p className="text-[12px] font-extrabold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-4">Order Summary ({resolved.length})</p>
                <ul className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
                  {resolved.map(({ item, fabric }) => (
                    <li key={`${fabric.id}-${item.color ?? ''}`} className="flex gap-3 pb-3 border-b border-[color:var(--color-myntra-border-soft)] last:border-b-0 last:pb-0">
                      <FabricImage photo={fabric.photo} fallback={fabric.image} alt={fabric.name} className="w-12 h-16 object-cover bg-[color:var(--color-myntra-bg-soft)]" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold truncate">{fabric.brand}</p>
                        <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] truncate">{fabric.name}</p>
                        <p className="text-[11px] text-[color:var(--color-myntra-ink-mute)]">{item.meters} m{item.color ? ` · ${item.color}` : ''}</p>
                      </div>
                      <p className="text-[13px] font-bold whitespace-nowrap">{formatINR(item.meters * fabric.pricePerMeter)}</p>
                    </li>
                  ))}
                </ul>

                <hr className="my-4 border-dashed border-[color:var(--color-myntra-border)]" />

                <dl className="space-y-2 text-[14px]">
                  <div className="flex justify-between"><dt>Total MRP</dt><dd>{formatINR(mrpTotal)}</dd></div>
                  <div className="flex justify-between"><dt>Discount</dt><dd className="text-[color:var(--color-myntra-green)]">- {formatINR(productDiscount)}</dd></div>
                  {couponDiscount > 0 && (
                    <div className="flex justify-between"><dt>Coupon</dt><dd className="text-[color:var(--color-myntra-green)]">- {formatINR(couponDiscount)}</dd></div>
                  )}
                  <div className="flex justify-between"><dt>Shipping</dt><dd className={shipping === 0 ? 'text-[color:var(--color-myntra-green)] font-bold' : ''}>{shipping === 0 ? 'FREE' : formatINR(shipping)}</dd></div>
                  <div className="flex justify-between"><dt>GST</dt><dd>{formatINR(tax)}</dd></div>
                </dl>

                <div className="flex justify-between mt-4 pt-3 border-t border-[color:var(--color-myntra-border)]">
                  <span className="font-extrabold">Total Payable</span>
                  <span className="font-extrabold">{formatINR(payable)}</span>
                </div>
              </div>

              <div className="bg-white border border-[color:var(--color-myntra-border-soft)] p-4 flex items-center gap-3">
                <Lock className="w-6 h-6 text-[color:var(--color-myntra-ink-soft)]" />
                <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)]">
                  Encrypted SSL checkout. Your data is secure.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
};

export default CheckoutPage;
