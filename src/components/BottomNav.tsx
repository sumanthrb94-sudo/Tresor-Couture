import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Home, LayoutGrid, LayoutDashboard, User, Heart, ShoppingBag, LogOut, MapPin, ChevronUp, X, UserCircle, PackageOpen } from 'lucide-react';
import { useRouter } from '../context/RouterContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useAuth } from '../context/AuthContext';
import type { Route } from '../types';

/**
 * Mobile sticky bottom navigation — Myntra/Zepto pattern.
 * Consolidated design: Home | Shop | Account
 * Profile, Wishlist, Cart are all inside the Account menu (full-screen).
 * A floating cart FAB appears at bottom-right when items are in the cart.
 */
const BottomNav: React.FC = () => {
  const { route, navigate } = useRouter();
  const { itemCount: cartCount } = useCart();
  const { ids: wishIds } = useWishlist();
  const { user, isAdmin, logout } = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);

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

  const closeAccount = () => setAccountOpen(false);

  const go = (to: Route) => {
    setAccountOpen(false);
    navigate(to);
  };

  return (
    <>
      {/* Full-screen Account menu — slides in from right */}
      <AnimatePresence>
        {accountOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[55] bg-black/40 lg:hidden"
              onClick={closeAccount}
            />
            {/* Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="fixed inset-y-0 right-0 z-[60] w-full max-w-[360px] bg-white shadow-2xl flex flex-col lg:hidden"
            >
              {/* Header — greeting + close */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--color-myntra-border-soft)] bg-[color:var(--color-myntra-bg-soft)]">
                {user ? (
                  <div className="min-w-0">
                    <p className="text-[15px] font-extrabold truncate">Hello, {user.fullName.split(' ')[0]}</p>
                    <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] truncate">{user.email}</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-[15px] font-extrabold text-[color:var(--color-myntra-navy)]">Welcome to Tresor</p>
                    <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)]">Sign in to access your account</p>
                  </div>
                )}
                <button onClick={closeAccount} aria-label="Close" className="p-2 -mr-1">
                  <X className="w-6 h-6 text-[color:var(--color-myntra-navy)]" />
                </button>
              </div>

              {/* Menu items */}
              <nav className="flex-1 overflow-y-auto px-5 py-4">
                {user && (
                  <ul className="space-y-1">
                    <li>
                      <button
                        onClick={() => go({ name: 'account', tab: 'profile' })}
                        className="w-full flex items-center gap-4 px-3 py-3.5 rounded-lg text-[15px] font-semibold text-[color:var(--color-myntra-navy)] hover:bg-[color:var(--color-myntra-bg-soft)] transition-colors"
                      >
                        <UserCircle className="w-5 h-5 text-[color:var(--color-myntra-ink-soft)]" />
                        My Profile
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => go({ name: 'account', tab: 'orders' })}
                        className="w-full flex items-center gap-4 px-3 py-3.5 rounded-lg text-[15px] font-semibold text-[color:var(--color-myntra-navy)] hover:bg-[color:var(--color-myntra-bg-soft)] transition-colors"
                      >
                        <PackageOpen className="w-5 h-5 text-[color:var(--color-myntra-ink-soft)]" />
                        My Orders
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => go({ name: 'account', tab: 'wishlist' })}
                        className="w-full flex items-center gap-4 px-3 py-3.5 rounded-lg text-[15px] font-semibold text-[color:var(--color-myntra-navy)] hover:bg-[color:var(--color-myntra-bg-soft)] transition-colors"
                      >
                        <Heart className="w-5 h-5 text-[color:var(--color-myntra-ink-soft)]" />
                        Wishlist
                        {wishCount > 0 && (
                          <span className="ml-auto text-[11px] bg-[color:var(--color-myntra-pink)] text-white rounded-full min-w-[22px] h-[22px] flex items-center justify-center px-1.5 font-bold">
                            {wishCount > 9 ? '9+' : wishCount}
                          </span>
                        )}
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => go({ name: 'account', tab: 'addresses' })}
                        className="w-full flex items-center gap-4 px-3 py-3.5 rounded-lg text-[15px] font-semibold text-[color:var(--color-myntra-navy)] hover:bg-[color:var(--color-myntra-bg-soft)] transition-colors"
                      >
                        <MapPin className="w-5 h-5 text-[color:var(--color-myntra-ink-soft)]" />
                        Addresses
                      </button>
                    </li>

                    {/* Admin Console — only for admins */}
                    {isAdmin && (
                      <li className="pt-2 border-t border-[color:var(--color-myntra-border-soft)]">
                        <button
                          onClick={() => go({ name: 'admin' })}
                          className="w-full flex items-center gap-4 px-3 py-3.5 rounded-lg text-[15px] font-semibold text-[color:var(--color-myntra-pink)] hover:bg-[color:var(--color-myntra-bg-soft)] transition-colors"
                        >
                          <LayoutDashboard className="w-5 h-5" />
                          Admin Console
                        </button>
                      </li>
                    )}

                    <li className={`${isAdmin ? '' : 'pt-2 border-t border-[color:var(--color-myntra-border-soft)]'}`}>
                      <button
                        onClick={() => { closeAccount(); logout(); navigate({ name: 'home' }); }}
                        className="w-full flex items-center gap-4 px-3 py-3.5 rounded-lg text-[15px] font-semibold text-[#A12626] hover:bg-[#FBE6E6] transition-colors"
                      >
                        <LogOut className="w-5 h-5" />
                        Sign out
                      </button>
                    </li>
                  </ul>
                )}

                {!user && (
                  <ul className="space-y-1">
                    <li>
                      <button
                        onClick={() => go({ name: 'login' })}
                        className="w-full flex items-center gap-4 px-3 py-3.5 rounded-lg text-[15px] font-semibold text-[color:var(--color-myntra-navy)] hover:bg-[color:var(--color-myntra-bg-soft)] transition-colors"
                      >
                        <User className="w-5 h-5 text-[color:var(--color-myntra-ink-soft)]" />
                        Sign In
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => go({ name: 'account', tab: 'wishlist' })}
                        className="w-full flex items-center gap-4 px-3 py-3.5 rounded-lg text-[15px] font-semibold text-[color:var(--color-myntra-navy)] hover:bg-[color:var(--color-myntra-bg-soft)] transition-colors"
                      >
                        <Heart className="w-5 h-5 text-[color:var(--color-myntra-ink-soft)]" />
                        Wishlist
                        {wishCount > 0 && (
                          <span className="ml-auto text-[11px] bg-[color:var(--color-myntra-pink)] text-white rounded-full min-w-[22px] h-[22px] flex items-center justify-center px-1.5 font-bold">
                            {wishCount > 9 ? '9+' : wishCount}
                          </span>
                        )}
                      </button>
                    </li>
                  </ul>
                )}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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

          {/* Account tab — rightmost, opens full-screen menu */}
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