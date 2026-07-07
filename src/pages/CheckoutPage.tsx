import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, CreditCard, Lock, MapPin, Pencil, Smartphone, Tag, Truck, User } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useRouter } from '../context/RouterContext';
import { useAuth } from '../context/AuthContext';
import { useOrders } from '../context/OrderContext';
import { formatINR } from '../constants';
import { PaymentMethod, ShippingAddress } from '../types';
import { couponsApi } from '../lib/firebase';
import { analytics } from '../lib/analytics';
import { sendOrderEmail, sendOrderWhatsApp } from '../lib/notify';
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

// Indian phone: optional +91 / 0 prefix, then a 10-digit number starting 6-9.
const PHONE_RE = /^(?:\+?91[\s-]?|0)?[6-9]\d{9}$/;
const PIN_RE = /^[1-9]\d{5}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const FIELD_ORDER: (keyof ShippingAddress)[] = [
  'fullName', 'email', 'phone', 'line1', 'city', 'state', 'postalCode', 'country'
];

// IMPORTANT: keep StepBlock and Field at module scope, not inside
// CheckoutPage. When defined inside the parent, each render creates a
// fresh function identity, React treats them as a new component type and
// unmounts/remounts the whole subtree on every keystroke. That destroys
// the underlying <input>, drops focus, and orphans the mobile cursor
// handle below the row — visible as the blue droplet drifting out of the
// input on every backspace.

const StepBlock: React.FC<{
  id: Step;
  index: number;
  title: string;
  doneTitle?: string;
  currentStep: Step;
  setStep: (s: Step) => void;
  children: React.ReactNode;
}> = ({ id, index, title, doneTitle, currentStep, setStep, children }) => {
  const active = currentStep === id;
  const done =
    (id === 'login' && (currentStep === 'address' || currentStep === 'payment')) ||
    (id === 'address' && currentStep === 'payment');

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

const Field: React.FC<{
  label: string;
  field: keyof ShippingAddress;
  errors: Record<string, string>;
  fieldRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
  children: (ref: (el: HTMLInputElement | null) => void) => React.ReactNode;
  cols?: number;
}> = ({ label, field, errors, fieldRefs, children, cols = 1 }) => (
  <div className={cols === 2 ? 'sm:col-span-2' : ''}>
    <label className="block text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-1.5">{label}</label>
    {children(el => { fieldRefs.current[field] = el; })}
    {errors[field] && <p className="text-[12px] text-[color:var(--color-myntra-pink)] mt-1 font-semibold">{errors[field]}</p>}
  </div>
);

const CheckoutPage: React.FC = () => {
  const { resolved, subtotal, shipping, tax, total, clearCart } = useCart();
  const { navigate } = useRouter();
  const { user, updateProfile } = useAuth();
  const { placeOrder } = useOrders();

  const [step, setStep] = useState<Step>(user ? 'address' : 'login');
  const [phone, setPhone] = useState(user?.phone ?? '');

  // Whether the saved address banner is currently active. When true, the
  // form is presented as a single read-only line + "Use a different address".
  const [useSavedAddress, setUseSavedAddress] = useState<boolean>(!!user?.defaultAddress);
  const [address, setAddress] = useState<ShippingAddress>(
    user?.defaultAddress
      ?? { ...initialAddress, fullName: user?.fullName ?? '', email: user?.email ?? '', phone: user?.phone ?? '' }
  );
  // Save the (possibly edited) address back to the user profile after order
  // success. Default ON for signed-in users without a saved address.
  const [saveAddress, setSaveAddress] = useState<boolean>(!!user && !user?.defaultAddress);

  // Cash on Delivery is the only live method until the Cashfree gateway lands.
  const [payment, setPayment] = useState<PaymentMethod>('cod');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);

  const [couponInput, setCouponInput] = useState('');
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMsg, setCouponMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);

  // Refs for "focus first invalid field" on validation failure.
  const fieldRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Hydrate the form whenever the user (or their saved address) changes —
  // covers the case where auth resolves after the page mounts.
  useEffect(() => {
    if (user?.defaultAddress) {
      setAddress(user.defaultAddress);
      setUseSavedAddress(true);
      setSaveAddress(false);
    } else if (user) {
      setAddress(prev => ({
        ...prev,
        fullName: prev.fullName || user.fullName,
        email: prev.email || user.email,
        phone: prev.phone || (user.phone ?? '')
      }));
      setSaveAddress(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.defaultAddress]);

  // Fire begin_checkout once on mount (GA4 funnel).
  useEffect(() => {
    if (resolved.length > 0) analytics.beginCheckout(total, resolved.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mrpTotal = useMemo(
    () => resolved.reduce((s, { item, fabric }) => s + fabric.mrp * item.quantity, 0),
    [resolved]
  );

  if (resolved.length === 0) {
    return (
      <main className="pt-[140px] pb-20 min-h-screen text-center px-5 bg-white">
        <h1 className="text-3xl font-extrabold mb-4">Your bag is empty</h1>
        <button onClick={() => navigate({ name: 'shop' })} className="btn-primary">Continue Shopping</button>
      </main>
    );
  }

  const productDiscount = mrpTotal - subtotal;
  const payable = Math.max(0, total - couponDiscount);

  const validateAddress = (): boolean => {
    const e: Record<string, string> = {};
    if (!address.fullName.trim()) e.fullName = 'Required';
    if (!EMAIL_RE.test(address.email)) e.email = 'Enter a valid email';
    if (!PHONE_RE.test(address.phone.trim())) e.phone = 'Enter a 10-digit Indian mobile';
    if (!address.line1.trim()) e.line1 = 'Required';
    if (!address.city.trim()) e.city = 'Required';
    if (!address.state.trim()) e.state = 'Required';
    if (!PIN_RE.test(address.postalCode.trim())) e.postalCode = 'Enter a 6-digit PIN';
    if (!address.country.trim()) e.country = 'Required';
    setErrors(e);
    if (Object.keys(e).length > 0) {
      const firstBad = FIELD_ORDER.find(f => e[f]);
      if (firstBad) fieldRefs.current[firstBad]?.focus();
      return false;
    }
    return true;
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

  const handleUseDifferentAddress = () => {
    setUseSavedAddress(false);
    // Pre-fill with the user's name/email/phone but blank out the postal bits
    // so the user can clearly type a new destination.
    setAddress({
      ...initialAddress,
      fullName: user?.fullName ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? ''
    });
    setSaveAddress(true);
    // Focus the first real input on next tick.
    setTimeout(() => fieldRefs.current.fullName?.focus(), 0);
  };

  // Online gateway (Cashfree) is not wired yet, so checkout completes via Cash
  // on Delivery: the order is recorded server-side with paymentStatus 'pending'
  // and settled on delivery. No fake "payment successful" theatre.
  const finishOrder = (orderId: string, placedAddress: ShippingAddress) => {
    // Fire-and-forget save of the shipping address as the new default.
    if (saveAddress && user) {
      void updateProfile({ defaultAddress: placedAddress }).catch(err => {
        console.warn('[checkout] could not save default address', err);
      });
    }
    analytics.purchase(orderId, payable);
    // Cart MUST be emptied before navigation so the user can't re-place by
    // hitting back.
    clearCart();
    navigate({ name: 'confirmation', orderId });
  };

  const handlePlaceOrder = async () => {
    if (!validateAddress()) {
      setStep('address');
      return;
    }
    if (!user) {
      setPlaceError('Please sign in to place your order.');
      navigate({ name: 'login' });
      return;
    }
    setPlaceError(null);
    setPlacing(true);
    try {
      analytics.addPaymentInfo(payable, 'cod');
      const placed = await placeOrder({
        items: resolved.map(({ item }) => ({ fabricId: item.fabricId, quantity: item.quantity, color: item.color })),
        shippingAddress: address,
        paymentMethod: 'cod',
        couponCode: couponCode ?? undefined,
      });
      void sendOrderEmail(placed); // Brevo confirmation — fire-and-forget
      void sendOrderWhatsApp(placed, address.fullName); // store alert (dormant until WA env set)
      finishOrder(placed.id, address);
    } catch (err) {
      setPlacing(false);
      const raw = err instanceof Error ? err.message : 'Could not place your order. Please try again.';
      const friendly =
        raw === 'orders_not_configured'
          ? 'Checkout is not fully configured yet. Please try again in a moment or contact us for help.'
          : raw.startsWith('insufficient_stock:')
          ? 'One or more items in your bag just went out of stock. Please review your cart and try again.'
          : raw;
      setPlaceError(friendly);
    }
  };

  return (
    <main className="pt-[100px] md:pt-[112px] pb-12 md:pb-16 bg-[color:var(--color-myntra-bg-soft)] min-h-screen">
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 lg:px-10">
        <h1 className="text-xl md:text-2xl font-extrabold mb-4 text-[color:var(--color-myntra-navy)]">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 lg:gap-6">
          <div>
            <StepBlock id="login" index={1} title="Login or Sign Up" doneTitle={user ? `Signed in: ${user.fullName}` : `Login: ${phone || 'Guest checkout'}`} currentStep={step} setStep={setStep}>
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
              currentStep={step}
              setStep={setStep}
            >
              {/* Saved-address banner — shown only when we're using the user's stored default. */}
              {useSavedAddress && user?.defaultAddress && (
                <div className="mb-4 border border-[color:var(--color-myntra-green)]/30 bg-[color:var(--color-myntra-green)]/5 px-4 py-3 rounded flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 mt-0.5 text-[color:var(--color-myntra-green)]" aria-hidden />
                    <div>
                      <p className="text-[13px] font-bold text-[color:var(--color-myntra-navy)]">
                        Delivering to your saved address — {user.defaultAddress.city}, {user.defaultAddress.state}
                      </p>
                      <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] mt-0.5 leading-relaxed">
                        {user.defaultAddress.fullName} · {user.defaultAddress.line1}
                        {user.defaultAddress.line2 ? `, ${user.defaultAddress.line2}` : ''} · {user.defaultAddress.postalCode}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleUseDifferentAddress}
                    className="self-start sm:self-center inline-flex items-center gap-1.5 text-[12px] font-bold text-[color:var(--color-myntra-pink)] whitespace-nowrap"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Use a different address
                  </button>
                </div>
              )}

              <div className="flex items-center gap-3 mb-4 text-[color:var(--color-myntra-ink-soft)]">
                <MapPin className="w-4 h-4" />
                <p className="text-[13px]">Where would you like your weaves delivered?</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Full Name" field="fullName" cols={2} errors={errors} fieldRefs={fieldRefs}>
                  {ref => <input ref={ref} name="fullName" className="input-box" value={address.fullName} onChange={e => setAddress(a => ({ ...a, fullName: e.target.value }))} />}
                </Field>
                <Field label="Email" field="email" errors={errors} fieldRefs={fieldRefs}>
                  {ref => <input ref={ref} name="email" className="input-box" type="email" value={address.email} onChange={e => setAddress(a => ({ ...a, email: e.target.value }))} />}
                </Field>
                <Field label="Phone" field="phone" errors={errors} fieldRefs={fieldRefs}>
                  {ref => <input ref={ref} name="phone" className="input-box" type="tel" inputMode="tel" placeholder="10-digit mobile" value={address.phone} onChange={e => setAddress(a => ({ ...a, phone: e.target.value }))} />}
                </Field>
                <Field label="Address Line 1" field="line1" cols={2} errors={errors} fieldRefs={fieldRefs}>
                  {ref => <input ref={ref} name="line1" className="input-box" value={address.line1} onChange={e => setAddress(a => ({ ...a, line1: e.target.value }))} />}
                </Field>
                <div className="sm:col-span-2">
                  <label className="block text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-1.5">Address Line 2 (optional)</label>
                  <input name="line2" className="input-box" value={address.line2 ?? ''} onChange={e => setAddress(a => ({ ...a, line2: e.target.value }))} />
                </div>
                <Field label="City" field="city" errors={errors} fieldRefs={fieldRefs}>
                  {ref => <input ref={ref} name="city" className="input-box" value={address.city} onChange={e => setAddress(a => ({ ...a, city: e.target.value }))} />}
                </Field>
                <Field label="State" field="state" errors={errors} fieldRefs={fieldRefs}>
                  {ref => <input ref={ref} name="state" className="input-box" value={address.state} onChange={e => setAddress(a => ({ ...a, state: e.target.value }))} />}
                </Field>
                <Field label="PIN Code" field="postalCode" errors={errors} fieldRefs={fieldRefs}>
                  {ref => <input ref={ref} name="postalCode" className="input-box" inputMode="numeric" maxLength={6} placeholder="6-digit PIN" value={address.postalCode} onChange={e => setAddress(a => ({ ...a, postalCode: e.target.value.replace(/\D/g, '').slice(0, 6) }))} />}
                </Field>
                <Field label="Country" field="country" errors={errors} fieldRefs={fieldRefs}>
                  {ref => <input ref={ref} name="country" className="input-box" value={address.country} onChange={e => setAddress(a => ({ ...a, country: e.target.value }))} />}
                </Field>
              </div>

              {user && (
                <label className="mt-4 inline-flex items-start gap-2 text-[13px] text-[color:var(--color-myntra-ink-soft)] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={saveAddress}
                    onChange={e => setSaveAddress(e.target.checked)}
                    className="mt-0.5 accent-[color:var(--color-myntra-pink)]"
                  />
                  <span>
                    Save this address to my profile for faster checkout next time.
                  </span>
                </label>
              )}

              <button
                onClick={() => { if (validateAddress()) setStep('payment'); }}
                className="btn-primary mt-5"
              >
                Save & Continue
              </button>
            </StepBlock>

            <StepBlock id="payment" index={3} title="Payment Method" currentStep={step} setStep={setStep}>
              <div className="flex items-center gap-3 mb-4 text-[color:var(--color-myntra-ink-soft)]">
                <Lock className="w-4 h-4" />
                <p className="text-[13px]">Online payment is launching soon. For now, pay securely on delivery.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                {([
                  { id: 'cod',  label: 'Cash on Delivery', sub: 'Pay when you receive', icon: Truck, enabled: true },
                  { id: 'upi',  label: 'UPI',               sub: 'Coming soon',          icon: Smartphone, enabled: false },
                  { id: 'card', label: 'Card',              sub: 'Coming soon',          icon: CreditCard, enabled: false },
                ] as const).map(opt => {
                  const Icon = opt.icon;
                  const active = payment === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={!opt.enabled}
                      onClick={() => opt.enabled && setPayment(opt.id)}
                      className={`text-left border rounded p-3 transition-colors ${
                        !opt.enabled
                          ? 'border-[color:var(--color-myntra-border-soft)] opacity-50 cursor-not-allowed'
                          : active
                            ? 'border-[color:var(--color-myntra-pink)] bg-[#F5E8C8]'
                            : 'border-[color:var(--color-myntra-border)] hover:border-[color:var(--color-myntra-navy)]'
                      }`}
                    >
                      <Icon className="w-5 h-5 mb-2 text-[color:var(--color-myntra-navy)]" />
                      <p className="text-[13px] font-bold">{opt.label}</p>
                      <p className="text-[11px] text-[color:var(--color-myntra-ink-soft)]">{opt.sub}</p>
                    </button>
                  );
                })}
              </div>

              <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)]">
                Pay in cash when our courier arrives. Available across India for orders below ₹50,000.
                Online card &amp; UPI payment will be enabled shortly.
              </p>

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
                {placing ? 'Placing order…' : `Place Order · ${formatINR(payable)}`}
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
                        <p className="text-[11px] text-[color:var(--color-myntra-ink-mute)]">Qty {item.quantity}{item.color ? ` · ${item.color}` : ''}</p>
                      </div>
                      <p className="text-[13px] font-bold whitespace-nowrap">{formatINR(item.quantity * fabric.price)}</p>
                    </li>
                  ))}
                </ul>

                <hr className="my-4 border-dashed border-[color:var(--color-myntra-border)]" />

                <dl className="space-y-2 text-[14px]">
                  <div className="flex justify-between"><dt>Total MRP</dt><dd>{formatINR(mrpTotal)}</dd></div>
                  {productDiscount > 0 && (
                    <div className="flex justify-between"><dt>Discount on MRP</dt><dd className="text-[color:var(--color-myntra-green)]">- {formatINR(productDiscount)}</dd></div>
                  )}
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
