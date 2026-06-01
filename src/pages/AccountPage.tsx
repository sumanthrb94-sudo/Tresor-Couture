import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Heart,
  LogOut,
  Mail,
  MapPin,
  Package,
  RotateCw,
  ShoppingBag,
  Trash2,
  Truck,
  User as UserIcon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../context/RouterContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useOrders } from '../context/OrderContext';
import { FABRICS, formatINR } from '../constants';
import FabricImage from '../components/FabricImage';
import OrderStatusTracker from '../components/OrderStatusTracker';
import AddressBookEditor from '../components/AddressBookEditor';
import { auth, ordersApi } from '../lib/firebase';
import type { Order, OrderStatus } from '../types';

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

const statusPillStyle: Record<OrderStatus, string> = {
  placed: 'bg-[color:var(--color-myntra-bg-sale)] text-[color:var(--color-myntra-pink-dark)]',
  processing: 'bg-[color:var(--color-myntra-bg-sale)] text-[color:var(--color-myntra-pink-dark)]',
  shipped: 'bg-[color:var(--color-myntra-green)] text-white',
  delivered: 'bg-[color:var(--color-myntra-green)] text-white',
  cancelled: 'bg-[color:var(--color-myntra-pink)] text-white',
  refunded: 'bg-[color:var(--color-myntra-ink-soft)] text-white'
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const formatShortDate = (d: Date) =>
  d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

const SLOW_CATEGORIES = new Set(['Studios Prêt', 'Sarees']);

// Same-week SLA for in-stock fabric meters, multi-week SLA for stitched
// pieces (Studios Prêt) and made-to-order sarees.
const ETA_FAST_DAYS = 5;
const ETA_SLOW_DAYS = 14;

const computeEta = (order: Order): Date | null => {
  if (!order.placedAt) return null;
  const placed = new Date(order.placedAt);
  if (Number.isNaN(placed.getTime())) return null;
  const slow = order.items.some(it => SLOW_CATEGORIES.has(it.fabricSnapshot.masterCategory));
  const days = slow ? ETA_SLOW_DAYS : ETA_FAST_DAYS;
  return new Date(placed.getTime() + days * 24 * 60 * 60 * 1000);
};

const shortOrderId = (id: string) => `TC-${id.slice(-8).toUpperCase()}`;

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('') || '?';

const paymentLabel = (m: Order['paymentMethod']) => {
  switch (m) {
    case 'card': return 'Card';
    case 'upi': return 'UPI';
    case 'cod': return 'Cash on Delivery';
    default: return m;
  }
};

const AccountPage: React.FC<Props> = ({ tab = 'profile' }) => {
  const { user, loading, logout } = useAuth();
  const { navigate } = useRouter();

  // Only bounce to login once Firebase has finished rehydrating the session.
  // During the initial ~500ms auth resolution `user` is null even for a
  // signed-in returning visitor; redirecting then causes a loop with
  // LoginPage's reciprocal redirect.
  useEffect(() => {
    if (!loading && !user) navigate({ name: 'login' });
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <main className="pt-[140px] pb-20 min-h-screen flex items-center justify-center bg-[color:var(--color-myntra-bg-soft)]">
        <div
          className="w-8 h-8 border-2 border-[color:var(--color-myntra-pink)] border-t-transparent rounded-full animate-spin"
          aria-label="Loading account"
        />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="pt-[140px] pb-20 min-h-screen text-center px-5 bg-[color:var(--color-myntra-bg-soft)]">
        <p className="text-[14px] text-[color:var(--color-myntra-ink-soft)]">Redirecting to sign in…</p>
      </main>
    );
  }

  const handleSignOut = () => {
    void logout();
    navigate({ name: 'home' });
  };

  return (
    <main className="pt-[100px] md:pt-[112px] pb-12 md:pb-16 bg-[color:var(--color-myntra-bg-soft)] min-h-screen">
      <div className="max-w-[1100px] mx-auto px-4 md:px-8 lg:px-10">
        <p className="section-eyebrow mb-2">My Tresor</p>
        <h1 className="text-xl md:text-2xl font-extrabold mb-4 text-[color:var(--color-myntra-navy)]">
          Hello, {user.fullName.split(' ')[0] || 'there'}
        </h1>

        {/* Mobile tab bar — 4-up grid so every tab (incl. Addresses) is visible
            without horizontal scrolling. Sign out sits on its own row below. */}
        <div className="md:hidden mb-4">
          <nav className="grid grid-cols-4 border border-[color:var(--color-myntra-border-soft)] rounded overflow-hidden divide-x divide-[color:var(--color-myntra-border-soft)]">
            {TABS.map(t => {
              const Icon = t.icon;
              const active = t.id === tab;
              return (
                <button
                  key={t.id}
                  onClick={() => navigate({ name: 'account', tab: t.id })}
                  className={`flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-bold uppercase tracking-wide ${
                    active
                      ? 'text-[color:var(--color-myntra-pink)] bg-[color:var(--color-myntra-bg-sale)]'
                      : 'text-[color:var(--color-myntra-ink-soft)] bg-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              );
            })}
          </nav>
          <div className="text-right mt-2">
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] hover:text-[color:var(--color-myntra-pink)]"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        </div>

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
                className="w-full bg-white border border-[color:var(--color-myntra-border-soft)] px-4 py-3 text-[13px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink)] inline-flex items-center justify-center gap-2 hover:border-[color:var(--color-myntra-pink)] hover:text-[color:var(--color-myntra-pink)]"
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
            {tab === 'addresses' && <AddressBookEditor />}
          </section>
        </div>
      </div>
    </main>
  );
};

/* ─────────── Profile tab ─────────── */

// Maps a user-id derived hash to a palette slot — same id always gets the
// same colour so the avatar feels stable across renders.
const AVATAR_PALETTE = [
  'bg-[color:var(--color-myntra-pink)]',
  'bg-[color:var(--color-myntra-green)]',
  'bg-[color:var(--color-myntra-navy)]'
];

const ProfileTab: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Firebase Auth currentUser carries the Google photo + display info that we
  // don't persist on the user doc. Reading it directly keeps the User type
  // unchanged while still surfacing the avatar.
  const photoURL = auth.currentUser?.photoURL ?? null;

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

  const paletteIdx =
    Math.abs(user.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_PALETTE.length;

  return (
    <div className="bg-white border border-[color:var(--color-myntra-border-soft)] p-5 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-5 pb-5 border-b border-[color:var(--color-myntra-border-soft)]">
        {photoURL ? (
          <img
            src={photoURL}
            alt={user.fullName}
            referrerPolicy="no-referrer"
            className="w-16 h-16 rounded-full object-cover border border-[color:var(--color-myntra-border-soft)] shrink-0"
          />
        ) : (
          <div
            aria-hidden
            className={`w-16 h-16 rounded-full text-white font-extrabold text-[20px] inline-flex items-center justify-center shrink-0 ${AVATAR_PALETTE[paletteIdx]}`}
          >
            {initialsOf(user.fullName || user.email)}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-[16px] font-extrabold text-[color:var(--color-myntra-navy)] truncate">
            {user.fullName || 'Tresor Member'}
          </h2>
          <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] truncate">{user.email}</p>
          <p className="text-[11px] text-[color:var(--color-myntra-ink-mute)] mt-0.5">
            Member since {formatDate(user.createdAt)}
          </p>
        </div>
      </div>

      <h3 className="text-[13px] font-extrabold uppercase tracking-wider text-[color:var(--color-myntra-navy)] mb-3">
        Edit Profile
      </h3>

      <form onSubmit={handleSave} noValidate className="space-y-4 max-w-md">
        <div>
          <label
            htmlFor="profile-name"
            className="block text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-1.5"
          >
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
          <label
            htmlFor="profile-email"
            className="block text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-1.5"
          >
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
            Email cannot be changed. Reach out to hello@tresorcouture.in if you need help.
          </p>
        </div>

        <div>
          <label
            htmlFor="profile-phone"
            className="block text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-1.5"
          >
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
          <p
            role="alert"
            className="text-[13px] font-semibold text-[color:var(--color-myntra-pink)] bg-[color:var(--color-myntra-bg-sale)] border border-[color:var(--color-myntra-border)] px-3 py-2 rounded"
          >
            {error}
          </p>
        )}
        {success && (
          <p
            role="status"
            className="text-[13px] font-semibold text-[color:var(--color-myntra-green)] bg-white border border-[color:var(--color-myntra-border-soft)] px-3 py-2 rounded"
          >
            {success}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving || !dirty} className="btn-primary">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

/* ─────────── Orders tab ─────────── */

const OrderSkeleton: React.FC = () => (
  <div className="bg-white border border-[color:var(--color-myntra-border-soft)] p-4 flex gap-4 animate-pulse">
    <div className="w-16 h-20 md:w-20 md:h-24 shrink-0 bg-[color:var(--color-myntra-bg-soft)]" />
    <div className="flex-1 space-y-2">
      <div className="h-3 w-24 bg-[color:var(--color-myntra-bg-soft)]" />
      <div className="h-4 w-40 bg-[color:var(--color-myntra-bg-soft)]" />
      <div className="h-3 w-56 bg-[color:var(--color-myntra-bg-soft)]" />
      <div className="h-4 w-20 bg-[color:var(--color-myntra-bg-soft)] mt-3" />
    </div>
  </div>
);

const OrdersTab: React.FC = () => {
  const { user } = useAuth();
  const { orders, loading, error, refresh } = useOrders();
  const { navigate } = useRouter();
  const { addItem } = useCart();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reordered, setReordered] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // ordersApi.mine() already filters/sorts server-side, so the rows arrive
  // ready to render — no client-side userId filter needed.
  const myOrders = useMemo<Order[]>(() => (user ? orders : []), [orders, user]);

  useEffect(() => {
    if (!reordered) return;
    const id = window.setTimeout(() => setReordered(null), 3000);
    return () => window.clearTimeout(id);
  }, [reordered]);

  if (loading && myOrders.length === 0) {
    return (
      <div className="space-y-3" aria-busy="true" aria-live="polite">
        <OrderSkeleton />
        <OrderSkeleton />
        <OrderSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-[color:var(--color-myntra-border-soft)] px-6 py-12 text-center">
        <p className="text-[13px] font-semibold text-[color:var(--color-myntra-pink)] mb-4">{error}</p>
        <button onClick={() => void refresh()} className="btn-outline">
          Try again
        </button>
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
          Start your first commission and your orders will live here.
        </p>
        <button onClick={() => navigate({ name: 'shop' })} className="btn-primary">
          Shop Now
        </button>
      </div>
    );
  }

  const reorder = (order: Order) => {
    order.items.forEach(it => addItem({ fabricId: it.fabricId, quantity: it.quantity, color: it.color }));
    setReordered(order.id);
    // Slight delay so the user sees the "added" toast before we whisk them away.
    window.setTimeout(() => navigate({ name: 'cart' }), 350);
  };

  const cancelOrder = async (order: Order) => {
    const ok = window.confirm(`Cancel order ${shortOrderId(order.id)}? This cannot be undone.`);
    if (!ok) return;
    setCancelError(null);
    setCancelling(order.id);
    try {
      await ordersApi.setStatus(order.id, 'cancelled');
      await refresh();
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Unable to cancel this order.');
    } finally {
      setCancelling(null);
    }
  };

  return (
    <div className="space-y-3">
      <h2 className="text-[15px] font-extrabold uppercase tracking-wider mb-1 text-[color:var(--color-myntra-navy)]">
        My Orders{' '}
        <span className="text-[12px] font-medium text-[color:var(--color-myntra-ink-mute)] ml-2">
          {myOrders.length}
        </span>
      </h2>

      {myOrders.map(order => {
        const status: OrderStatus = order.status ?? 'placed';
        const isCancelled = status === 'cancelled' || status === 'refunded';
        const isDelivered = status === 'delivered';
        const unitCount = order.items.reduce((s, it) => s + it.quantity, 0);
        const firstItem = order.items[0]?.fabricSnapshot;
        const isOpen = expanded === order.id;
        const eta = !isCancelled && !isDelivered ? computeEta(order) : null;
        const canCancel = status === 'placed' || status === 'processing';

        return (
          <article
            key={order.id}
            className="bg-white border border-[color:var(--color-myntra-border-soft)]"
          >
            <div className="p-4 flex gap-4">
              {firstItem && (
                <button
                  onClick={() => navigate({ name: 'product', id: firstItem.id })}
                  className="w-16 h-20 md:w-20 md:h-24 shrink-0 bg-[color:var(--color-myntra-bg-soft)] overflow-hidden"
                  aria-label={`View ${firstItem.name}`}
                >
                  <FabricImage
                    photo={firstItem.photo}
                    fallback={firstItem.image}
                    alt={firstItem.name}
                    className="w-full h-full object-cover"
                  />
                </button>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-mute)]">
                      Order ID
                    </p>
                    <p className="text-[13px] font-bold text-[color:var(--color-myntra-navy)] truncate">
                      {shortOrderId(order.id)}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 ${statusPillStyle[status]}`}
                  >
                    {isCancelled ? 'Cancelled' : status}
                  </span>
                </div>

                <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] mt-1">
                  Placed {formatDate(order.placedAt)} · {order.items.length} item
                  {order.items.length === 1 ? '' : 's'} · {unitCount} m
                </p>

                {eta && (
                  <p className="text-[12px] mt-1 inline-flex items-center gap-1 font-semibold text-[color:var(--color-myntra-green)]">
                    <Truck className="w-3.5 h-3.5" />
                    Arriving by {formatShortDate(eta)}
                  </p>
                )}
                {isDelivered && (
                  <p className="text-[12px] mt-1 inline-flex items-center gap-1 font-semibold text-[color:var(--color-myntra-green)]">
                    <Check className="w-3.5 h-3.5" strokeWidth={3} />
                    Delivered
                  </p>
                )}

                <div className="flex items-center justify-between mt-3 gap-2 flex-wrap">
                  <p className="text-[14px] font-extrabold">{formatINR(order.total)}</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={() => reorder(order)}
                      className="text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] inline-flex items-center gap-1 hover:text-[color:var(--color-myntra-pink)]"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      Reorder
                    </button>
                    {canCancel && (
                      <button
                        onClick={() => void cancelOrder(order)}
                        disabled={cancelling === order.id}
                        className="text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-pink)] inline-flex items-center gap-1 hover:underline disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {cancelling === order.id ? 'Cancelling…' : 'Cancel'}
                      </button>
                    )}
                    {!isCancelled && (
                      <button
                        onClick={() => setExpanded(isOpen ? null : order.id)}
                        className="text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-pink)] inline-flex items-center gap-1 hover:underline"
                        aria-expanded={isOpen}
                      >
                        Track
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        />
                      </button>
                    )}
                    <button
                      onClick={() => navigate({ name: 'confirmation', orderId: order.id })}
                      className="text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-pink)] inline-flex items-center gap-1 hover:underline"
                    >
                      View
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {reordered === order.id && (
                  <p
                    role="status"
                    className="text-[12px] font-semibold text-[color:var(--color-myntra-green)] mt-2"
                  >
                    Items added to your bag — taking you there…
                  </p>
                )}
                {cancelError && cancelling === order.id && (
                  <p
                    role="alert"
                    className="text-[12px] font-semibold text-[color:var(--color-myntra-pink)] mt-2"
                  >
                    {cancelError}
                  </p>
                )}
              </div>
            </div>

            {isOpen && (
              <div className="border-t border-[color:var(--color-myntra-border-soft)] px-4 py-4 bg-[color:var(--color-myntra-bg-soft)]">
                <OrderStatusTracker currentStatus={status} placedAt={order.placedAt} />

                {eta && (
                  <p className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[color:var(--color-myntra-navy)]">
                    <CalendarDays className="w-3.5 h-3.5" />
                    Estimated delivery: {formatShortDate(eta)}
                  </p>
                )}

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-mute)] mb-2">
                      Items
                    </p>
                    <ul className="space-y-2">
                      {order.items.map((it, idx) => (
                        <li key={`${it.fabricId}-${idx}`} className="flex items-center gap-3">
                          <div className="w-10 h-12 shrink-0 bg-white border border-[color:var(--color-myntra-border-soft)] overflow-hidden">
                            <FabricImage
                              photo={it.fabricSnapshot.photo}
                              fallback={it.fabricSnapshot.image}
                              alt={it.fabricSnapshot.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[12px] font-bold uppercase text-[color:var(--color-myntra-navy)] truncate">
                              {it.fabricSnapshot.brand}
                            </p>
                            <p className="text-[11px] text-[color:var(--color-myntra-ink-soft)] truncate">
                              {it.fabricSnapshot.name} · Qty {it.quantity}
                              {it.color ? ` · ${it.color}` : ''}
                            </p>
                          </div>
                          <p className="text-[12px] font-bold shrink-0">
                            {formatINR(it.quantity * it.fabricSnapshot.price)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-mute)] mb-1 inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        Shipping to
                      </p>
                      <p className="text-[12px] text-[color:var(--color-myntra-ink)] whitespace-pre-line leading-relaxed">
                        {order.shippingAddress.fullName}
                        {`\n${order.shippingAddress.line1}`}
                        {order.shippingAddress.line2 ? `\n${order.shippingAddress.line2}` : ''}
                        {`\n${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.postalCode}`}
                        {`\n${order.shippingAddress.country}`}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-mute)] mb-1 inline-flex items-center gap-1">
                        <CreditCard className="w-3 h-3" />
                        Payment
                      </p>
                      <p className="text-[12px] text-[color:var(--color-myntra-ink)]">
                        {paymentLabel(order.paymentMethod)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </article>
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

  // Prefer the context's `resolved` (hydrated from Firestore + seed) so
  // wishlist works for products that aren't in the static FABRICS array.
  // Fall back to the seed lookup for safety during context warm-up.
  const items = useMemo(
    () =>
      wishlist.resolved.length > 0
        ? wishlist.resolved
        : wishlist.ids
            .map(id => FABRICS.find(f => f.id === id))
            .filter((f): f is NonNullable<typeof f> => Boolean(f)),
    [wishlist.resolved, wishlist.ids]
  );

  if (items.length === 0 && wishlist.resolving) {
    return (
      <div className="bg-white border border-[color:var(--color-myntra-border-soft)] px-6 py-12 text-center">
        <span
          className="inline-block w-6 h-6 border-2 border-[color:var(--color-myntra-border)] border-t-[color:var(--color-myntra-pink)] rounded-full animate-spin"
          aria-label="Loading wishlist"
        />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-white border border-[color:var(--color-myntra-border-soft)] px-6 py-12 text-center">
        <Heart className="w-12 h-12 mx-auto text-[color:var(--color-myntra-ink-mute)] mb-4" />
        <h2 className="text-[16px] font-extrabold uppercase tracking-wider mb-1 text-[color:var(--color-myntra-navy)]">
          Save fabrics you love
        </h2>
        <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] mb-5">
          Tap the heart on any fabric to keep it close.
        </p>
        <button onClick={() => navigate({ name: 'shop' })} className="btn-primary">
          Browse
        </button>
      </div>
    );
  }

  const moveToBag = (fabricId: string) => {
    addItem({ fabricId, quantity: 1 });
    wishlist.remove(fabricId);
  };

  return (
    <div>
      <h2 className="text-[15px] font-extrabold uppercase tracking-wider mb-3 text-[color:var(--color-myntra-navy)]">
        My Wishlist{' '}
        <span className="text-[12px] font-medium text-[color:var(--color-myntra-ink-mute)] ml-2">
          {items.length}
        </span>
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
              <FabricImage
                photo={fabric.photo}
                fallback={fabric.image}
                alt={fabric.name}
                className="w-full h-full object-cover"
              />
            </button>
            <div className="p-3 flex flex-col gap-1 flex-1">
              <p className="text-[12px] font-extrabold uppercase truncate">{fabric.brand}</p>
              <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] truncate">{fabric.name}</p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-[13px] font-bold">{formatINR(fabric.price)}</span>
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

export default AccountPage;
