import React from 'react';
import { Home, LayoutGrid, Heart, ShoppingBag, User } from 'lucide-react';
import { useRouter } from '../context/RouterContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useAuth } from '../context/AuthContext';
import type { Route } from '../types';

/**
 * Mobile-only sticky bottom tab bar (Myntra/Zepto pattern) for thumb-reach
 * navigation. Hidden on lg+ (the top navbar carries desktop) and on admin
 * screens. Pages get bottom clearance via the Chrome wrapper's pb on mobile.
 */
const BottomNav: React.FC = () => {
  const { route, navigate } = useRouter();
  const { items: cartItems } = useCart();
  const { ids: wishIds } = useWishlist();
  const { user } = useAuth();

  const cartCount = cartItems.length;
  const wishCount = wishIds.length;

  const tabs: {
    key: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    to: Route;
    active: boolean;
    badge?: number;
  }[] = [
    { key: 'home', label: 'Home', icon: Home, to: { name: 'home' }, active: route.name === 'home' },
    { key: 'shop', label: 'Shop', icon: LayoutGrid, to: { name: 'shop' }, active: route.name === 'shop' || route.name === 'search' },
    {
      key: 'wishlist',
      label: 'Wishlist',
      icon: Heart,
      to: user ? { name: 'account', tab: 'wishlist' } : { name: 'login' },
      active: route.name === 'account' && route.tab === 'wishlist',
      badge: wishCount,
    },
    { key: 'bag', label: 'Bag', icon: ShoppingBag, to: { name: 'cart' }, active: route.name === 'cart' || route.name === 'checkout', badge: cartCount },
    {
      key: 'account',
      label: user ? 'Account' : 'Login',
      icon: User,
      to: user ? { name: 'account' } : { name: 'login' },
      active: route.name === 'account' || route.name === 'login' || route.name === 'register',
    },
  ];

  return (
    <nav
      aria-label="Primary"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[color:var(--color-myntra-border-soft)] shadow-[0_-2px_10px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-5">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <li key={t.key}>
              <button
                onClick={() => navigate(t.to)}
                aria-current={t.active ? 'page' : undefined}
                className={`w-full flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-bold tracking-wide transition-colors ${
                  t.active ? 'text-[color:var(--color-myntra-pink)]' : 'text-[color:var(--color-myntra-ink-soft)]'
                }`}
              >
                <span className="relative">
                  <Icon className="w-[22px] h-[22px]" />
                  {t.badge ? (
                    <span className="absolute -top-1.5 -right-2 bg-[color:var(--color-myntra-pink)] text-white text-[9px] font-bold rounded-full min-w-[15px] h-[15px] flex items-center justify-center px-1">
                      {t.badge > 9 ? '9+' : t.badge}
                    </span>
                  ) : null}
                </span>
                {t.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default BottomNav;
