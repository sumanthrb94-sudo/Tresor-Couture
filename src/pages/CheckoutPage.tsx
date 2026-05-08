import React, { useState } from 'react';
import { CreditCard, Lock, Smartphone, Truck } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useRouter } from '../context/RouterContext';
import { useOrders } from '../context/OrderContext';
import { formatINR } from '../constants';
import { Order, PaymentMethod, ShippingAddress } from '../types';
import FabricImage from '../components/FabricImage';

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

const generateOrderId = () =>
  'TC-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();

const CheckoutPage: React.FC = () => {
  const { resolved, subtotal, shipping, tax, total, clear } = useCart();
  const { navigate } = useRouter();
  const { addOrder } = useOrders();

  const [address, setAddress] = useState<ShippingAddress>(initialAddress);
  const [payment, setPayment] = useState<PaymentMethod>('card');
  const [card, setCard] = useState({ number: '', name: '', expiry: '', cvv: '' });
  const [upi, setUpi] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [placing, setPlacing] = useState(false);

  if (resolved.length === 0) {
    return (
      <main className="pt-32 md:pt-[160px] pb-20 md:pb-[120px] min-h-screen text-center px-5">
        <h1 className="font-serif text-3xl md:text-4xl gold-text mb-4">Your bag is empty</h1>
        <button onClick={() => navigate({ name: 'shop' })} className="btn-gold">
          Continue shopping
        </button>
      </main>
    );
  }

  const setField = <K extends keyof ShippingAddress>(key: K, value: ShippingAddress[K]) => {
    setAddress(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: '' }));
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!address.fullName.trim()) e.fullName = 'Required';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address.email)) e.email = 'Valid email required';
    if (!/^[0-9+\-\s()]{7,}$/.test(address.phone)) e.phone = 'Valid phone required';
    if (!address.line1.trim()) e.line1 = 'Required';
    if (!address.city.trim()) e.city = 'Required';
    if (!address.state.trim()) e.state = 'Required';
    if (!/^[0-9A-Za-z\- ]{4,}$/.test(address.postalCode)) e.postalCode = 'Valid postal code required';
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

  const placeOrder = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setPlacing(true);
    await new Promise(r => setTimeout(r, 800));
    const order: Order = {
      id: generateOrderId(),
      items: resolved.map(({ item, fabric }) => ({ ...item, fabricSnapshot: fabric })),
      subtotal,
      shipping,
      tax,
      total,
      shippingAddress: address,
      paymentMethod: payment,
      placedAt: new Date().toISOString()
    };
    addOrder(order);
    clear();
    navigate({ name: 'confirmation', orderId: order.id });
  };

  const Field: React.FC<{ label: string; field: string; children: React.ReactNode }> = ({ label, field, children }) => (
    <div>
      <label className="block text-[11px] uppercase tracking-[0.15em] font-semibold text-brand-ink-soft mb-2">
        {label}
      </label>
      {children}
      {errors[field] && <p className="text-xs text-red-700 mt-1">{errors[field]}</p>}
    </div>
  );

  return (
    <main className="flex-grow pt-24 md:pt-[120px] pb-20 md:pb-[120px] px-5 md:px-16 max-w-[1280px] mx-auto w-full">
      <div className="mb-10 md:mb-12">
        <h1 className="font-serif text-[40px] md:text-[48px] gold-text mb-3 md:mb-4">Checkout</h1>
        <p className="text-sm md:text-base text-brand-ink-soft">Final details before we hand-cut and dispatch your weaves.</p>
      </div>

      <form onSubmit={placeOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 flex flex-col gap-10">
          {/* Shipping */}
          <section className="bg-brand-bg-soft p-6 md:p-8 border border-brand-outline/30">
            <div className="flex items-center gap-3 mb-6">
              <Truck className="w-5 h-5 text-brand-gold" />
              <h2 className="font-serif text-xl md:text-2xl text-brand-ink">Shipping Details</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="sm:col-span-2">
                <Field label="Full Name" field="fullName">
                  <input type="text" value={address.fullName} onChange={e => setField('fullName', e.target.value)} className="input-underline" />
                </Field>
              </div>
              <Field label="Email" field="email">
                <input type="email" value={address.email} onChange={e => setField('email', e.target.value)} className="input-underline" />
              </Field>
              <Field label="Phone" field="phone">
                <input type="tel" value={address.phone} onChange={e => setField('phone', e.target.value)} className="input-underline" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Address Line 1" field="line1">
                  <input type="text" value={address.line1} onChange={e => setField('line1', e.target.value)} className="input-underline" />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Address Line 2 (optional)" field="line2">
                  <input type="text" value={address.line2 ?? ''} onChange={e => setField('line2', e.target.value)} className="input-underline" />
                </Field>
              </div>
              <Field label="City" field="city">
                <input type="text" value={address.city} onChange={e => setField('city', e.target.value)} className="input-underline" />
              </Field>
              <Field label="State" field="state">
                <input type="text" value={address.state} onChange={e => setField('state', e.target.value)} className="input-underline" />
              </Field>
              <Field label="Postal Code" field="postalCode">
                <input type="text" value={address.postalCode} onChange={e => setField('postalCode', e.target.value)} className="input-underline" />
              </Field>
              <Field label="Country" field="country">
                <input type="text" value={address.country} onChange={e => setField('country', e.target.value)} className="input-underline" />
              </Field>
            </div>
          </section>

          {/* Payment */}
          <section className="bg-brand-bg-soft p-6 md:p-8 border border-brand-outline/30">
            <div className="flex items-center gap-3 mb-6">
              <Lock className="w-5 h-5 text-brand-gold" />
              <h2 className="font-serif text-xl md:text-2xl text-brand-ink">Payment</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              {([
                { id: 'card', label: 'Card', icon: CreditCard },
                { id: 'upi', label: 'UPI', icon: Smartphone },
                { id: 'cod', label: 'Cash on Delivery', icon: Truck }
              ] as const).map(opt => {
                const Icon = opt.icon;
                const active = payment === opt.id;
                return (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() => setPayment(opt.id)}
                    className={`flex items-center gap-3 px-4 py-3 border text-sm transition-colors ${
                      active ? 'border-brand-gold bg-brand-surface' : 'border-brand-outline/40 hover:border-brand-ink'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {payment === 'card' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="sm:col-span-2">
                  <Field label="Card Number" field="cardNumber">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="1234 5678 9012 3456"
                      value={card.number}
                      onChange={e => setCard(c => ({ ...c, number: e.target.value }))}
                      className="input-underline"
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Name on Card" field="cardName">
                    <input type="text" value={card.name} onChange={e => setCard(c => ({ ...c, name: e.target.value }))} className="input-underline" />
                  </Field>
                </div>
                <Field label="Expiry" field="cardExpiry">
                  <input type="text" placeholder="MM/YY" value={card.expiry} onChange={e => setCard(c => ({ ...c, expiry: e.target.value }))} className="input-underline" />
                </Field>
                <Field label="CVV" field="cardCvv">
                  <input type="password" inputMode="numeric" value={card.cvv} onChange={e => setCard(c => ({ ...c, cvv: e.target.value }))} className="input-underline" />
                </Field>
              </div>
            )}

            {payment === 'upi' && (
              <Field label="UPI ID" field="upi">
                <input type="text" placeholder="name@bank" value={upi} onChange={e => setUpi(e.target.value)} className="input-underline" />
              </Field>
            )}

            {payment === 'cod' && (
              <p className="text-sm text-brand-ink-soft leading-relaxed">
                Pay in cash when our courier arrives. Available across India for orders below ₹50,000.
              </p>
            )}

            <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] font-semibold text-brand-ink-soft mt-6">
              <Lock className="w-3 h-3" /> Encrypted · Demo checkout, no real charges are made.
            </p>
          </section>
        </div>

        <aside className="lg:col-span-4">
          <div className="bg-brand-bg-soft p-6 md:p-8 lg:sticky lg:top-[120px] border border-brand-outline/30">
            <h2 className="font-serif text-xl md:text-2xl text-brand-ink mb-5 md:mb-6 border-b border-brand-outline/30 pb-4">Order Summary</h2>
            <ul className="space-y-4 mb-6 max-h-[280px] overflow-auto pr-2">
              {resolved.map(({ item, fabric }) => (
                <li key={`${fabric.id}-${item.color ?? ''}`} className="flex gap-3 pb-4 border-b border-brand-outline/30 last:border-b-0 last:pb-0">
                  <FabricImage photo={fabric.photo} fallback={fabric.image} alt={fabric.name} className="w-14 h-14 object-cover border border-brand-outline/30" />
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-serif italic truncate">{fabric.name}</p>
                    <p className="text-[11px] uppercase tracking-[0.1em] font-semibold text-brand-ink-soft mt-0.5">
                      {item.meters} m{item.color ? ` · ${item.color}` : ''}
                    </p>
                  </div>
                  <p className="text-base font-medium whitespace-nowrap">{formatINR(item.meters * fabric.pricePerMeter)}</p>
                </li>
              ))}
            </ul>
            <dl className="space-y-3 border-t border-brand-outline/30 pt-4 text-base">
              <div className="flex justify-between"><dt className="text-brand-ink-soft">Subtotal</dt><dd>{formatINR(subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-brand-ink-soft">Shipping</dt><dd>{shipping === 0 ? 'Free' : formatINR(shipping)}</dd></div>
              <div className="flex justify-between"><dt className="text-brand-ink-soft">GST</dt><dd>{formatINR(tax)}</dd></div>
            </dl>
            <div className="flex justify-between items-end mt-5 md:mt-6 mb-6 md:mb-8 pt-4 border-t border-brand-gold/20">
              <span className="font-serif text-xl md:text-2xl text-brand-ink">Total</span>
              <span className="font-serif text-[28px] md:text-[32px] gold-text">{formatINR(total)}</span>
            </div>
            <button type="submit" disabled={placing} className="btn-gold w-full">
              {placing ? 'Placing Order…' : `Place Order · ${formatINR(total)}`}
            </button>
          </div>
        </aside>
      </form>
    </main>
  );
};

export default CheckoutPage;
