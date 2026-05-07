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
      <section className="pt-[160px] pb-32 min-h-screen text-center px-6">
        <h1 className="text-3xl font-serif italic mb-4">Your cart is empty</h1>
        <button
          onClick={() => navigate({ name: 'shop' })}
          className="text-[10px] uppercase tracking-widest underline"
        >
          Continue shopping
        </button>
      </section>
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

  const fieldClass = (key: string) =>
    `w-full border ${
      errors[key] ? 'border-red-400' : 'border-brand-border'
    } bg-brand-bg px-4 py-3 text-sm focus:outline-none focus:border-brand-gold`;

  return (
    <section className="pt-[140px] pb-32 min-h-screen bg-brand-bg">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <h1 className="text-4xl md:text-5xl font-serif mb-12">
          <span className="italic">Checkout</span>
        </h1>

        <form onSubmit={placeOrder} className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-12">
          <div className="space-y-10">
            {/* Shipping */}
            <div className="border border-brand-border bg-white p-8">
              <div className="flex items-center gap-3 mb-6">
                <Truck className="w-5 h-5 text-brand-gold" />
                <h2 className="text-[10px] uppercase tracking-[0.3em] font-bold">Shipping Details</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-[10px] uppercase tracking-widest text-brand-ink/60">Full Name</label>
                  <input
                    type="text"
                    value={address.fullName}
                    onChange={e => setField('fullName', e.target.value)}
                    className={fieldClass('fullName')}
                  />
                  {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>}
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-brand-ink/60">Email</label>
                  <input
                    type="email"
                    value={address.email}
                    onChange={e => setField('email', e.target.value)}
                    className={fieldClass('email')}
                  />
                  {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-brand-ink/60">Phone</label>
                  <input
                    type="tel"
                    value={address.phone}
                    onChange={e => setField('phone', e.target.value)}
                    className={fieldClass('phone')}
                  />
                  {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[10px] uppercase tracking-widest text-brand-ink/60">Address Line 1</label>
                  <input
                    type="text"
                    value={address.line1}
                    onChange={e => setField('line1', e.target.value)}
                    className={fieldClass('line1')}
                  />
                  {errors.line1 && <p className="text-xs text-red-500 mt-1">{errors.line1}</p>}
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[10px] uppercase tracking-widest text-brand-ink/60">Address Line 2 (optional)</label>
                  <input
                    type="text"
                    value={address.line2 ?? ''}
                    onChange={e => setField('line2', e.target.value)}
                    className={fieldClass('line2')}
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-brand-ink/60">City</label>
                  <input
                    type="text"
                    value={address.city}
                    onChange={e => setField('city', e.target.value)}
                    className={fieldClass('city')}
                  />
                  {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city}</p>}
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-brand-ink/60">State</label>
                  <input
                    type="text"
                    value={address.state}
                    onChange={e => setField('state', e.target.value)}
                    className={fieldClass('state')}
                  />
                  {errors.state && <p className="text-xs text-red-500 mt-1">{errors.state}</p>}
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-brand-ink/60">Postal Code</label>
                  <input
                    type="text"
                    value={address.postalCode}
                    onChange={e => setField('postalCode', e.target.value)}
                    className={fieldClass('postalCode')}
                  />
                  {errors.postalCode && <p className="text-xs text-red-500 mt-1">{errors.postalCode}</p>}
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-brand-ink/60">Country</label>
                  <input
                    type="text"
                    value={address.country}
                    onChange={e => setField('country', e.target.value)}
                    className={fieldClass('country')}
                  />
                </div>
              </div>
            </div>

            {/* Payment */}
            <div className="border border-brand-border bg-white p-8">
              <div className="flex items-center gap-3 mb-6">
                <Lock className="w-5 h-5 text-brand-gold" />
                <h2 className="text-[10px] uppercase tracking-[0.3em] font-bold">Payment</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                {(
                  [
                    { id: 'card', label: 'Card', icon: CreditCard },
                    { id: 'upi', label: 'UPI', icon: Smartphone },
                    { id: 'cod', label: 'Cash on Delivery', icon: Truck }
                  ] as const
                ).map(opt => {
                  const Icon = opt.icon;
                  const active = payment === opt.id;
                  return (
                    <button
                      type="button"
                      key={opt.id}
                      onClick={() => setPayment(opt.id)}
                      className={`flex items-center gap-3 px-4 py-3 border text-sm transition-colors ${
                        active
                          ? 'border-brand-gold bg-brand-accent/40'
                          : 'border-brand-border hover:border-brand-ink'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {payment === 'card' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] uppercase tracking-widest text-brand-ink/60">Card Number</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="1234 5678 9012 3456"
                      value={card.number}
                      onChange={e => setCard(c => ({ ...c, number: e.target.value }))}
                      className={fieldClass('cardNumber')}
                    />
                    {errors.cardNumber && <p className="text-xs text-red-500 mt-1">{errors.cardNumber}</p>}
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] uppercase tracking-widest text-brand-ink/60">Name on Card</label>
                    <input
                      type="text"
                      value={card.name}
                      onChange={e => setCard(c => ({ ...c, name: e.target.value }))}
                      className={fieldClass('cardName')}
                    />
                    {errors.cardName && <p className="text-xs text-red-500 mt-1">{errors.cardName}</p>}
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-brand-ink/60">Expiry</label>
                    <input
                      type="text"
                      placeholder="MM/YY"
                      value={card.expiry}
                      onChange={e => setCard(c => ({ ...c, expiry: e.target.value }))}
                      className={fieldClass('cardExpiry')}
                    />
                    {errors.cardExpiry && <p className="text-xs text-red-500 mt-1">{errors.cardExpiry}</p>}
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-brand-ink/60">CVV</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      value={card.cvv}
                      onChange={e => setCard(c => ({ ...c, cvv: e.target.value }))}
                      className={fieldClass('cardCvv')}
                    />
                    {errors.cardCvv && <p className="text-xs text-red-500 mt-1">{errors.cardCvv}</p>}
                  </div>
                </div>
              )}

              {payment === 'upi' && (
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-brand-ink/60">UPI ID</label>
                  <input
                    type="text"
                    placeholder="name@bank"
                    value={upi}
                    onChange={e => setUpi(e.target.value)}
                    className={fieldClass('upi')}
                  />
                  {errors.upi && <p className="text-xs text-red-500 mt-1">{errors.upi}</p>}
                </div>
              )}

              {payment === 'cod' && (
                <p className="text-sm text-brand-ink/60 leading-relaxed">
                  Pay in cash when our courier arrives. Available across India for orders below ₹50,000.
                </p>
              )}

              <p className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-brand-ink/40 mt-6">
                <Lock className="w-3 h-3" /> Encrypted · Demo checkout, no real charges are made.
              </p>
            </div>
          </div>

          {/* Summary */}
          <aside className="border border-brand-border bg-white p-8 h-fit lg:sticky lg:top-[120px]">
            <h2 className="text-[10px] uppercase tracking-[0.3em] font-bold text-brand-gold mb-6">Order Summary</h2>
            <ul className="space-y-4 mb-6 max-h-[260px] overflow-auto pr-2">
              {resolved.map(({ item, fabric }) => (
                <li
                  key={`${fabric.id}-${item.color ?? ''}`}
                  className="flex gap-3 pb-4 border-b border-brand-border last:border-b-0 last:pb-0"
                >
                  <FabricImage
                    photo={fabric.photo}
                    fallback={fabric.image}
                    alt={fabric.name}
                    className="w-14 h-14 object-cover border border-brand-border"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-serif italic truncate">{fabric.name}</p>
                    <p className="text-[10px] uppercase tracking-widest text-brand-ink/50 mt-0.5">
                      {item.meters} m{item.color ? ` · ${item.color}` : ''}
                    </p>
                  </div>
                  <p className="text-sm font-medium whitespace-nowrap">
                    {formatINR(item.meters * fabric.pricePerMeter)}
                  </p>
                </li>
              ))}
            </ul>

            <dl className="space-y-2 text-sm border-t border-brand-border pt-4">
              <div className="flex justify-between">
                <dt className="text-brand-ink/60">Subtotal</dt>
                <dd>{formatINR(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-brand-ink/60">Shipping</dt>
                <dd>{shipping === 0 ? 'Free' : formatINR(shipping)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-brand-ink/60">GST (5%)</dt>
                <dd>{formatINR(tax)}</dd>
              </div>
            </dl>
            <div className="flex justify-between items-end mt-4 mb-8 pt-4 border-t border-brand-border">
              <span className="text-[10px] uppercase tracking-[0.3em] font-bold">Total</span>
              <span className="text-2xl font-serif">{formatINR(total)}</span>
            </div>

            <button
              type="submit"
              disabled={placing}
              className="w-full bg-brand-ink text-white py-4 text-[10px] uppercase tracking-[0.2em] font-bold hover:bg-brand-gold transition-colors duration-500 disabled:opacity-60"
            >
              {placing ? 'Placing Order…' : `Place Order · ${formatINR(total)}`}
            </button>
          </aside>
        </form>
      </div>
    </section>
  );
};

export default CheckoutPage;
