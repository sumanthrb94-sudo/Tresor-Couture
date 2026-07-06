import React, { useState, useRef, useEffect } from 'react';
import { Home, LayoutGrid, User, Heart, ShoppingBag, LogOut, Settings, MapPin, ChevronUp } from 'lucide-react';
import { useRouter } from '../context/RouterContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useAuth } from '../context/AuthContext';
import type { Route } from '../types';

/**
 * Mobile sticky bottom navigation — Myntra/Zepto pattern.
 * Consolidated design: Home | Shop | Account
 * Profile, Wishlist, Cart are all inside the Account menu.
 * A floating cart FAB appears at bottom-right when items are in the cart.
 */
const BottomNav: React.FC = () => {
  const { route, navigate } = useRouter();
  const { itemCount: cartCount } = useCart();
  const { ids: wishIds } = useWishlist();
  const { user, logout } = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close account menu on outside tap
  useEffect(() => {
    if (!accountOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [accountOpen]);

  // Lock body scroll when account menu is open
  useEffect(() => {
    if (accountOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [accountOpen]);

  const wishCount = wishIds.length;

  const mainTabs: {
    key: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    to: Route;
    active: boolean;
  }[] = [
    { key: 'home', label: 'Home', icon: Home, to: { name: 'home' }, active: route.name === 'home' },
    { key: 'shop', label: 'Shop', icon: LayoutGrid, to: { name: 'shop' }, active: route.name === 'shop' || route.name === 'search' },
  ];

  const isAccountActive = route.name === 'account' || route.name === 'login' || route.name === 'register';

  return (
    <>
      {/* Account menu overlay */}
      {accountOpen && (
        <div className="fixed inset-0 z-[55] bg-black/30 lg:hidden" onClick={() => setAccountOpen(false)} />
      )}

      {/* Account dropdown panel — slides up from bottom nav */}
      {accountOpen && (
        <div
          ref={menuRef}
          className="lg:hidden fixed bottom-[68px] right-3 z-[60] w-56 bg-white rounded-xl shadow-2xl border border-[color:var(--color-myntra-border-soft)] overflow-hidden"
        >
          {/* User greeting */}
          <div className="px-4 py-3 bg-[color:var(--color-myntra-bg-soft)] border-b border-[color:var(--color-myntra-border-soft)]">
            {user ? (
              <>
                <p className="text-[13px] font-extrabold truncate">Hello, {user.fullName.split(' ')[0]}</p>
                <p className="text-[11px] text-[color:var(--color-myntra-ink-soft)] truncate">{user.email}</p>
              </>
            ) : (
              <p className="text-[12px] font-bold text-[color:var(--color-myntra-navy)]">Welcome to Tresor</p>
            )}
          </div>

          <ul className="py-1 text-[13px]">
            {user && (
              <>
                <li>
                  <button
                    onClick={() => { setAccountOpen(false); navigate({ name: 'account', tab: 'profile' }); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-[color:var(--color-myntra-bg-soft)] flex items-center gap-3"
                  >
                    <User className="w-4 h-4 text-[color:var(--color-myntra-ink-soft)]" /> My Profile
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => { setAccountOpen(false); navigate({ name: 'account', tab: 'orders' }); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-[color:var(--color-myntra-bg-soft)] flex items-center gap-3"
                  >
                    <ShoppingBag className="w-4 h-4 text-[color:var(--color-myntra-ink-soft)]" /> My Orders
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => { setAccountOpen(false); navigate({ name: 'account', tab: 'wishlist' }); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-[color:var(--color-myntra-bg-soft)] flex items-center gap-3"
                  >
                    <Heart className="w-4 h-4 text-[color:var(--color-myntra-ink-soft)]" /> Wishlist
                    {wishCount > 0 && (
                      <span className="ml-auto text-[10px] bg-[color:var(--color-myntra-pink)] text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 font-bold">{wishCount > 9 ? '9+' : wishCount}</span>
                    )}
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => { setAccountOpen(false); navigate({ name: 'account', tab: 'addresses' }); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-[color:var(--color-myntra-bg-soft)] flex items-center gap-3"
                  >
                    <MapPin className="w-4 h-4 text-[color:var(--color-myntra-ink-soft)]" /> Addresses
                  </button>
                </li>
                <li className="border-t border-[color:var(--color-myntra-border-soft)]">
                  <button
                    onClick={() => { setAccountOpen(false); navigate({ name: 'account', tab: 'settings' }); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-[color:var(--color-myntra-bg-soft)] flex items-center gap-3"
                  >
                    <Settings className="w-4 h-4 text-[color:var(--color-myntra-ink-soft)]" /> Settings
                  </button>
                </li>
                <li className="border-t border-[color:var(--color-myntra-border-soft)]">
                  <button
                    onClick={() => { setAccountOpen(false); logout(); navigate({ name: 'home' }); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-[color:var(--color-myntra-bg-soft)] flex items-center gap-3 text-[color:var(--color-myntra-ink-soft)]"
                  >
                    <LogOut className="w-4 h-4" /> Sign out
                  </button>
                </li>
              </>
            )}
            {!user && (
              <>
                <li>
                  <button
                    onClick={() => { setAccountOpen(false); navigate({ name: 'login' }); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-[color:var(--color-myntra-bg-soft)] flex items-center gap-3"
                  >
                    <User className="w-4 h-4 text-[color:var(--color-myntra-ink-soft)]" /> Sign In
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => { setAccountOpen(false); navigate({ name: 'account', tab: 'wishlist' }); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-[color:var(--color-myntra-bg-soft)] flex items-center gap-3"
                  >
                    <Heart className="w-4 h-4 text-[color:var(--color-myntra-ink-soft)]" /> Wishlist
                    {wishCount > 0 && (
                      <span className="ml-auto text-[10px] bg-[color:var(--color-myntra-pink)] text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 font-bold">{wishCount > 9 ? '9+' : wishCount}</span>
                    )}
                  </button>
                </li>
              </>
            )}
          </ul>
        </div>
      )}

      {/* Main bottom nav — 3 columns: Home | Shop | Account */}
      <nav
        aria-label="Primary"
        className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-[color:var(--color-myntra-border-soft)] shadow-[0_-2px_10px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="grid grid-cols-3">
          {mainTabs.map(t => {
            const Icon = t.icon;
            return (
              <li key={t.key}>
                <button
                  onClick={() => navigate(t.to)}
                  aria-current={t.active ? 'page' : undefined}
                  className={`w-full flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-bold tracking-wide transition-colors ${
                    t.active ? 'text-[color:var(--color-myntra-pink)]' : 'text-[color:var(--color-myntra-ink-soft)]'
                  }`}
                >
                  <Icon className="w-[22px] h-[22px]" />
                  {t.label}
                </button>
              </li>
            );
          })}

          {/* Account tab — rightmost, opens dropdown menu */}
          <li>
            <button
              onClick={() => setAccountOpen(v => !v)}
              aria-expanded={accountOpen}
              aria-haspopup="true"
              className={`w-full flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-bold tracking-wide transition-colors ${
                isAccountActive || accountOpen ? 'text-[color:var(--color-myntra-pink)]' : 'text-[color:var(--color-myntra-ink-soft)]'
              }`}
            >
              <span className="relative">
                <User className="w-[22px] h-[22px]" />
                {/* Pink dot indicator when signed out */}
                {!user && !isAccountActive && (
                  <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-[color:var(--color-myntra-pink)] ring-2 ring-white" />
                )}
              </span>
              {user ? 'Account' : 'Login'}
              <ChevronUp className={`w-3 h-3 transition-transform duration-200 ${accountOpen ? 'rotate-180' : ''}`} />
            </button>
          </li>
        </ul>
      </nav>

      {/* Floating Cart FAB — bottom right, above the nav */}
      {cartCount > 0 && (
        <button
          onClick={() => navigate({ name: 'cart' })}
          className="lg:hidden fixed bottom-[72px] right-3 z-[45] w-12 h-12 bg-[color:var(--color-myntra-pink)] text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          aria-label={`Cart with ${cartCount} item${cartCount > 1 ? 's' : ''}`}
        >
          <ShoppingBag className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 bg-[color:var(--color-myntra-navy)] text-white text-[9px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {cartCount > 9 ? '9+' : cartCount}
          </span>
        </button>
      )}
    </>
  );
};

export default BottomNav;