import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronRight,
  Edit,
  Heart,
  LogOut,
  Mail,
  MapPin,
  Package,
  ShoppingBag,
  Trash2,
  User as UserIcon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../context/RouterContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useOrders } from '../context/OrderContext';
import { FABRICS, formatINR } from '../constants';
import FabricImage from '../components/FabricImage';
import type { Order, OrderStatus, ShippingAddress } from '../types';

type Tab = 'profile' | 'orders' | 'wishlist' | 'addresses';

interface Props {
  tab?: Tab;
}

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'profile', label: 'Profile', icon: UserIcon },
  { id: 'orders', label: 'Orders', icon: Package },
  { id: 'wishlist', label: 'Wishlist', icon: Heart },
  { id: 'addresses', label: 'Addresses', icon: MapPin }
];

const emptyAddress: ShippingAddress = {
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

const statusColors: Record<OrderStatus, string> = {
  placed: 'bg-[color:var(--color-myntra-bg-sale)] text-[color:var(--color-myntra-navy)]',
  processing: 'bg-[color:var(--color-myntra-bg-sale)] text-[color:var(--color-myntra-navy)]',
  shipped: 'bg-[color:var(--color-myntra-green)] text-white',
  delivered: 'bg-[color:var(--color-myntra-green)] text-white',
  cancelled: 'bg-[color:var(--color-myntra-pink)] text-white',
  refunded: 'bg-[color:var(--color-myntra-ink-soft)] text-white'
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const AccountPage: React.FC<Props> = ({ tab = 'profile' }) => {
  const { user, logout } = useAuth();
  const { navigate } = useRouter();

  useEffect(() => {
    if (!user) navigate({ name: 'login' });
  }, [user, navigate]);

  if (!user) {
    return (
      <main className="pt-[140px] pb-20 min-h-screen text-center px-5 bg-[color:var(--color-myntra-bg-soft)]">
        <p className="text-[14px] text-[color:var(--color-myntra-ink-soft)]">Redirecting to sign in…</p>
      </main>
    );
  }

  const handleSignOut = () => {
    logout();
    navigate({ name: 'home' });
  };

  return (
    <main className="pt-[100px] pb-12 md:pb-16 bg-[color:var(--color-myntra-bg-soft)] min-h-screen">
      <div className="max-w-[1100px] mx-auto px-4 md:px-8 lg:px-10">
        <p className="section-eyebrow mb-2">My Trésor</p>
        <h1 className="text-xl md:text-2xl font-extrabold mb-4 text-[color:var(--color-myntra-navy)]">
          Hello, {user.fullName.split(' ')[0] || 'there'}
        </h1>

        {/* Mobile tab bar */}
        <nav className="md:hidden -mx-4 px-4 mb-4 overflow-x-auto">
          <ul className="flex gap-2 min-w-max">
            {TABS.map(t => {
              const Icon = t.icon;
              const active = t.id === tab;
              return (
                <li key={t.id}>
                  <button
                    onClick={() => navigate({ name: 'account', tab: t.id })}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-bold uppercase tracking-wider border whitespace-nowrap ${
                      active
                        ? 'border-[color:var(--color-myntra-pink)] text-[color:var(--color-myntra-pink)] bg-white'
                        : 'border-[color:var(--color-myntra-border-soft)] text-[color:var(--color-myntra-ink-soft)] bg-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {t.label}
                  </button>
                </li>
              );
            })}
            <li>
              <button
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-bold uppercase tracking-wider border border-[color:var(--color-myntra-border-soft)] text-[color:var(--color-myntra-ink-soft)] bg-white whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </button>
            </li>
          </ul>
        </nav>

        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4 md:gap-6">
          {/* Desktop sidebar */}
          <aside className="hidden md:block">
            <div className="md:sticky md:top-[110px]">
              <div className="bg-white border border-[color:var(--color-myntra-border-soft)] mb-3">
                <div className="px-4 py-4 border-b border-[color:var(--color-myntra-border-soft)]">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-mute)] mb-1">
                    Signed in as
                  </p>
                  <p className="text-[14px] font-extrabold truncate">{user.fullName}</p>
                  <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] truncate">{user.email}</p>
                </div>
                <ul>
                  {TABS.map(t => {
                    const Icon = t.icon;
                    const active = t.id === tab;
                    return (
                      <li key={t.id}>
                        <button
                          onClick={() => navigate({ name: 'account', tab: t.id })}
                          className={`w-full flex items-center justify-between px-4 py-3 text-[13px] font-semibold border-l-2 transition-colors ${
                            active
                              ? 'border-[color:var(--color-myntra-pink)] text-[color:var(--color-myntra-pink)] bg-[color:var(--color-myntra-bg-sale)]'
                              : 'border-transparent text-[color:var(--color-myntra-ink)] hover:bg-[color:var(--color-myntra-bg-soft)]'
                          }`}
                        >
                          <span className="inline-flex items-center gap-2.5">
                            <Icon className="w-4 h-4" />
                            {t.label}
                          </span>
                          <ChevronRight className="w-4 h-4 opacity-60" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <button
                onClick={handleSignOut}
                className="w-full bg-white border border-[color:var(--color-myntra-border-soft)] px-4 py-3 text-[13px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink) ] inline-flex items-center justify-center gap-2 hover:border-[color:var(--color-myntra-pink)] hover:text-[color:var(--color-myntra-pink)]"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </aside>

          {/* Content */}
          <section>
            {tab === 'profile' && <ProfileTab />}
            {tab === 'orders' && <OrdersTab />}
            {tab === 'wishlist' && <WishlistTab />}
            {tab === 'addresses' && <AddressesTab />}
          </section>
        </div>
      </div>
    </main>
  );
};

/* ─────────── Profile tab ─────────── */

const ProfileTab: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setFullName(user?.fullName ?? '');
    setPhone(user?.phone ?? '');
  }, [user?.fullName, user?.phone]);

  useEffect(() => {
    if (!success) return;
    const id = window.setTimeout(() => setSuccess(null), 4000);
    return () => window.clearTimeout(id);
  }, [success]);

  useEffect(() => {
    if (!error) return;
    const id = window.setTimeout(() => setError(null), 5000);
    return () => window.clearTimeout(id);
  }, [error]);

  if (!user) return null;

  const dirty = fullName.trim() !== user.fullName || (phone.trim() || undefined) !== user.phone;

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (fullName.trim().length < 2) {
      setError('Please enter your full name (min 2 characters).');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ fullName: fullName.trim(), phone: phone.trim() || undefined });
      setSuccess('Profile updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update your profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-[color:var(--color-myntra-border-soft)] p-5 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-extrabold uppercase tracking-wider text-[color:var(--color-myntra-navy)]">
          Profile Details
        </h2>
        <p className="text-[11px] text-[color:var(--color-myntra-ink-mute)] hidden sm:block">
          Member since {formatDate(user.createdAt)}
        </p>
      </div>

      <form onSubmit={handleSave} noValidate className="space-y-4 max-w-md">
        <div>
          <label htmlFor="profile-name" className="block text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-1.5">
            Full Name
          </label>
          <input
            id="profile-name"
            type="text"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            className="input-box"
            autoComplete="name"
          />
        </div>

        <div>
          <label htmlFor="profile-email" className="block text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-1.5">
            Email
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-myntra-ink-mute)] pointer-events-none" />
            <input
              id="profile-email"
              type="email"
              value={user.email}
              readOnly
              className="input-box pl-9 bg-[color:var(--color-myntra-bg-soft)] cursor-not-allowed"
            />
          </div>
          <p className="text-[11px] text-[color:var(--color-myntra-ink-mute)] mt-1">
            Email cannot be changed. Reach out to care@tresor.test if you need help.
          </p>
        </div>

        <div>
          <label htmlFor="profile-phone" className="block text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-1.5">
            Phone <span className="text-[color:var(--color-myntra-ink-mute)] font-medium normal-case">(optional)</span>
          </label>
          <input
            id="profile-phone"
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
            className="input-box"
            autoComplete="tel"
          />
        </div>

        {error && (
          <p role="alert" className="text-[13px] font-semibold text-[color:var(--color-myntra-pink)] bg-[color:var(--color-myntra-bg-sale)] border border-[color:var(--color-myntra-border)] px-3 py-2 rounded">
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="text-[13px] font-semibold text-[color:var(--color-myntra-green)] bg-white border border-[color:var(--color-myntra-border-soft)] px-3 py-2 rounded">
            {success}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving || !dirty} className="btn-primary">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <p className="text-[11px] text-[color:var(--color-myntra-ink-mute)] sm:hidden">
            Member since {formatDate(user.createdAt)}
          </p>
        </div>
      </form>
    </div>
  );
};

/* ─────────── Orders tab ─────────── */

const OrdersTab: React.FC = () => {
  const { user } = useAuth();
  const { orders, loading, error, refresh } = useOrders();
  const { navigate } = useRouter();

  // ordersApi.mine() already filters/sorts server-side, so the rows arrive
  // ready to render — no client-side userId filter needed.
  const myOrders = useMemo<Order[]>(() => (user ? orders : []), [orders, user]);

  if (loading && myOrders.length === 0) {
    return (
      <div className="bg-white border border-[color:var(--color-myntra-border-soft)] px-6 py-12 text-center">
        <div className="inline-flex flex-col items-center gap-3 text-[color:var(--color-myntra-ink-soft)]">
          <span className="inline-block w-6 h-6 border-2 border-[color:var(--color-myntra-border)] border-t-[color:var(--color-myntra-pink)] rounded-full animate-spin" aria-hidden />
          <p className="text-[13px] font-semibold">Loading your orders…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-[color:var(--color-myntra-border-soft)] px-6 py-12 text-center">
        <p className="text-[13px] font-semibold text-[color:var(--color-myntra-pink)] mb-4">{error}</p>
        <button onClick={() => void refresh()} className="btn-outline">Try again</button>
      </div>
    );
  }

  if (myOrders.length === 0) {
    return (
      <div className="bg-white border border-[color:var(--color-myntra-border-soft)] px-6 py-12 text-center">
        <Package className="w-12 h-12 mx-auto text-[color:var(--color-myntra-ink-mute)] mb-4" />
        <h2 className="text-[16px] font-extrabold uppercase tracking-wider mb-1 text-[color:var(--color-myntra-navy)]">
          No orders yet
        </h2>
        <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] mb-5">
          When you place your first order, you&apos;ll find it here.
        </p>
        <button onClick={() => navigate({ name: 'shop' })} className="btn-primary">
          Start Shopping
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-[15px] font-extrabold uppercase tracking-wider mb-1 text-[color:var(--color-myntra-navy)]">
        My Orders <span className="text-[12px] font-medium text-[color:var(--color-myntra-ink-mute)] ml-2">{myOrders.length}</span>
      </h2>

      {myOrders.map(order => {
        const status: OrderStatus = order.status ?? 'placed';
        const itemCount = order.items.reduce((s, it) => s + it.meters, 0);
        const firstItem = order.items[0]?.fabricSnapshot;

        return (
          <div key={order.id} className="bg-white border border-[color:var(--color-myntra-border-soft)] p-4 flex gap-4">
            {firstItem && (
              <button
                onClick={() => navigate({ name: 'confirmation', orderId: order.id })}
                className="w-16 h-20 md:w-20 md:h-24 shrink-0 bg-[color:var(--color-myntra-bg-soft)] overflow-hidden"
                aria-label={`View order ${order.id}`}
              >
                <FabricImage photo={firstItem.photo} fallback={firstItem.image} alt={firstItem.name} className="w-full h-full object-cover" />
              </button>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-mute)]">
                    Order ID
                  </p>
                  <p className="text-[13px] font-bold text-[color:var(--color-myntra-navy)] truncate">{order.id}</p>
                </div>
                <span
                  className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 ${statusColors[status]}`}
                >
                  {status}
                </span>
              </div>

              <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] mt-1">
                Placed {formatDate(order.placedAt)} · {order.items.length} item{order.items.length === 1 ? '' : 's'} · {itemCount} m
              </p>

              <div className="flex items-center justify-between mt-3">
                <p className="text-[14px] font-extrabold">{formatINR(order.total)}</p>
                <button
                  onClick={() => navigate({ name: 'confirmation', orderId: order.id })}
                  className="text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-pink)] inline-flex items-center gap-1 hover:underline"
                >
                  View
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ─────────── Wishlist tab ─────────── */

const WishlistTab: React.FC = () => {
  const wishlist = useWishlist();
  const { addItem } = useCart();
  const { navigate } = useRouter();

  const items = useMemo(
    () =>
      wishlist.ids
        .map(id => FABRICS.find(f => f.id === id))
        .filter((f): f is NonNullable<typeof f> => Boolean(f)),
    [wishlist.ids]
  );

  if (items.length === 0) {
    return (
      <div className="bg-white border border-[color:var(--color-myntra-border-soft)] px-6 py-12 text-center">
        <Heart className="w-12 h-12 mx-auto text-[color:var(--color-myntra-ink-mute)] mb-4" />
        <h2 className="text-[16px] font-extrabold uppercase tracking-wider mb-1 text-[color:var(--color-myntra-navy)]">
          Your wishlist is empty
        </h2>
        <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] mb-5">
          Tap the heart on any fabric to keep it close.
        </p>
        <button onClick={() => navigate({ name: 'shop' })} className="btn-primary">
          Discover Fabrics
        </button>
      </div>
    );
  }

  const moveToBag = (fabricId: string) => {
    addItem({ fabricId, meters: 1 });
    wishlist.remove(fabricId);
  };

  return (
    <div>
      <h2 className="text-[15px] font-extrabold uppercase tracking-wider mb-3 text-[color:var(--color-myntra-navy)]">
        My Wishlist <span className="text-[12px] font-medium text-[color:var(--color-myntra-ink-mute)] ml-2">{items.length}</span>
      </h2>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map(fabric => (
          <div
            key={fabric.id}
            className="bg-white border border-[color:var(--color-myntra-border-soft)] overflow-hidden flex flex-col"
          >
            <button
              onClick={() => navigate({ name: 'product', id: fabric.id })}
              className="block w-full aspect-[3/4] bg-[color:var(--color-myntra-bg-soft)]"
              aria-label={`View ${fabric.name}`}
            >
              <FabricImage photo={fabric.photo} fallback={fabric.image} alt={fabric.name} className="w-full h-full object-cover" />
            </button>
            <div className="p-3 flex flex-col gap-1 flex-1">
              <p className="text-[12px] font-extrabold uppercase truncate">{fabric.brand}</p>
              <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] truncate">{fabric.name}</p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-[13px] font-bold">{formatINR(fabric.pricePerMeter)}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => moveToBag(fabric.id)}
                  className="text-[11px] font-bold uppercase tracking-wider bg-[color:var(--color-myntra-pink)] text-white py-2 hover:bg-[color:var(--color-myntra-pink-dark)] inline-flex items-center justify-center gap-1"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  Move to Bag
                </button>
                <button
                  onClick={() => wishlist.remove(fabric.id)}
                  className="text-[11px] font-bold uppercase tracking-wider border border-[color:var(--color-myntra-border)] text-[color:var(--color-myntra-ink-soft)] py-2 hover:border-[color:var(--color-myntra-pink)] hover:text-[color:var(--color-myntra-pink)] inline-flex items-center justify-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─────────── Addresses tab ─────────── */

const AddressesTab: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ShippingAddress>(user?.defaultAddress ?? emptyAddress);
  const [errors, setErrors] = useState<Partial<Record<keyof ShippingAddress, string>>>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) {
      setDraft(user?.defaultAddress ?? { ...emptyAddress, fullName: user?.fullName ?? '', email: user?.email ?? '', phone: user?.phone ?? '' });
    }
  }, [user, editing]);

  useEffect(() => {
    if (!submitError) return;
    const id = window.setTimeout(() => setSubmitError(null), 5000);
    return () => window.clearTimeout(id);
  }, [submitError]);

  if (!user) return null;

  const validate = (): boolean => {
    const next: Partial<Record<keyof ShippingAddress, string>> = {};
    if (!draft.fullName.trim()) next.fullName = 'Required';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.email)) next.email = 'Valid email required';
    if (!/^[0-9+\-\s()]{7,}$/.test(draft.phone)) next.phone = 'Valid phone required';
    if (!draft.line1.trim()) next.line1 = 'Required';
    if (!draft.city.trim()) next.city = 'Required';
    if (!draft.state.trim()) next.state = 'Required';
    if (!/^[0-9A-Za-z\- ]{4,}$/.test(draft.postalCode)) next.postalCode = 'Valid postal code required';
    if (!draft.country.trim()) next.country = 'Required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);
    if (!validate()) return;
    setSaving(true);
    try {
      await updateProfile({ defaultAddress: { ...draft, line2: draft.line2?.trim() ? draft.line2 : undefined } });
      setEditing(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to save your address.');
    } finally {
      setSaving(false);
    }
  };

  const setField = <K extends keyof ShippingAddress>(key: K, value: ShippingAddress[K]) =>
    setDraft(d => ({ ...d, [key]: value }));

  const address = user.defaultAddress;

  if (editing) {
    return (
      <div className="bg-white border border-[color:var(--color-myntra-border-soft)] p-5 md:p-6">
        <h2 className="text-[15px] font-extrabold uppercase tracking-wider mb-4 text-[color:var(--color-myntra-navy)]">
          {address ? 'Edit Default Address' : 'Add Default Address'}
        </h2>
        <form onSubmit={handleSave} noValidate className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <AddressField label="Full Name" error={errors.fullName} cols={2}>
            <input className="input-box" value={draft.fullName} onChange={e => setField('fullName', e.target.value)} />
          </AddressField>
          <AddressField label="Email" error={errors.email}>
            <input className="input-box" type="email" value={draft.email} onChange={e => setField('email', e.target.value)} />
          </AddressField>
          <AddressField label="Phone" error={errors.phone}>
            <input className="input-box" type="tel" value={draft.phone} onChange={e => setField('phone', e.target.value)} />
          </AddressField>
          <AddressField label="Address Line 1" error={errors.line1} cols={2}>
            <input className="input-box" value={draft.line1} onChange={e => setField('line1', e.target.value)} />
          </AddressField>
          <AddressField label="Address Line 2 (optional)" error={errors.line2} cols={2}>
            <input className="input-box" value={draft.line2 ?? ''} onChange={e => setField('line2', e.target.value)} />
          </AddressField>
          <AddressField label="City" error={errors.city}>
            <input className="input-box" value={draft.city} onChange={e => setField('city', e.target.value)} />
          </AddressField>
          <AddressField label="State" error={errors.state}>
            <input className="input-box" value={draft.state} onChange={e => setField('state', e.target.value)} />
          </AddressField>
          <AddressField label="PIN Code" error={errors.postalCode}>
            <input className="input-box" value={draft.postalCode} onChange={e => setField('postalCode', e.target.value)} />
          </AddressField>
          <AddressField label="Country" error={errors.country}>
            <input className="input-box" value={draft.country} onChange={e => setField('country', e.target.value)} />
          </AddressField>

          {submitError && (
            <p role="alert" className="sm:col-span-2 text-[13px] font-semibold text-[color:var(--color-myntra-pink)] bg-[color:var(--color-myntra-bg-sale)] border border-[color:var(--color-myntra-border)] px-3 py-2 rounded">
              {submitError}
            </p>
          )}

          <div className="sm:col-span-2 flex flex-wrap gap-3 mt-1">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save Address'}
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setErrors({}); setSubmitError(null); }}
              className="btn-outline"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[color:var(--color-myntra-border-soft)] p-5 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-extrabold uppercase tracking-wider text-[color:var(--color-myntra-navy)]">
          Default Address
        </h2>
        {address && (
          <button
            onClick={() => setEditing(true)}
            className="text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-pink)] inline-flex items-center gap-1 hover:underline"
          >
            <Edit className="w-3.5 h-3.5" />
            Edit
          </button>
        )}
      </div>

      {address ? (
        <div className="border border-[color:var(--color-myntra-border-soft)] p-4 max-w-md">
          <p className="text-[14px] font-extrabold text-[color:var(--color-myntra-navy)]">{address.fullName}</p>
          <p className="text-[13px] text-[color:var(--color-myntra-ink)] mt-1 whitespace-pre-line leading-relaxed">
            {address.line1}
            {address.line2 ? `\n${address.line2}` : ''}
            {`\n${address.city}, ${address.state} ${address.postalCode}`}
            {`\n${address.country}`}
          </p>
          <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] mt-2">
            {address.phone} · {address.email}
          </p>
        </div>
      ) : (
        <div className="border border-dashed border-[color:var(--color-myntra-border)] px-5 py-8 text-center max-w-md">
          <MapPin className="w-10 h-10 mx-auto text-[color:var(--color-myntra-ink-mute)] mb-3" />
          <p className="text-[14px] font-bold text-[color:var(--color-myntra-navy)] mb-1">
            No default address yet
          </p>
          <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] mb-4">
            Add an address to speed up checkout next time.
          </p>
          <button onClick={() => setEditing(true)} className="btn-primary">
            Add Address
          </button>
        </div>
      )}
    </div>
  );
};

const AddressField: React.FC<{ label: string; error?: string; cols?: 1 | 2; children: React.ReactNode }> = ({
  label,
  error,
  cols = 1,
  children
}) => (
  <div className={cols === 2 ? 'sm:col-span-2' : ''}>
    <label className="block text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-1.5">
      {label}
    </label>
    {children}
    {error && <p className="text-[12px] text-[color:var(--color-myntra-pink)] mt-1 font-semibold">{error}</p>}
  </div>
);

export default AccountPage;
