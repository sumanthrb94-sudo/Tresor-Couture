import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Heart, LayoutDashboard, Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../context/RouterContext';
import { FABRICS, MASTER_CATEGORIES, MASTER_CATEGORY_TREE, OFFER_TICKER } from '../constants';
import type { MasterCategory } from '../types';

type NavEntry =
  | { kind: 'master'; label: MasterCategory; tone?: 'default' | 'premium' }
  | { kind: 'static'; label: string; tone?: 'default' | 'sale' | 'premium' };

// The two atelier lines ("Couture Customisations" and "Studios Prêt") render with
// a distinct serif/gold treatment so they read as signature offerings, not regular
// shop categories. Sale keeps its red/pink tone.
const NAV: NavEntry[] = [
  ...MASTER_CATEGORIES
    .filter(m => m !== 'Studios Prêt')
    .map<NavEntry>(m => ({ kind: 'master', label: m })),
  { kind: 'static', label: 'Couture Customisations', tone: 'premium' },
  { kind: 'master', label: 'Studios Prêt', tone: 'premium' },
  { kind: 'static', label: 'Sale', tone: 'sale' }
];

const Navbar: React.FC = () => {
  const { itemCount } = useCart();
  const { count: wishCount } = useWishlist();
  const { user, isAdmin } = useAuth();
  const { navigate, route } = useRouter();

  const [search, setSearch] = useState('');
  const [searchFocus, setSearchFocus] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [hoverCat, setHoverCat] = useState<string | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const cartBadge = Math.min(itemCount, 99);
  const wishBadge = Math.min(wishCount, 99);

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return FABRICS.filter(f =>
      f.name.toLowerCase().includes(q) ||
      f.category.toLowerCase().includes(q) ||
      f.masterCategory.toLowerCase().includes(q) ||
      f.tags.some(t => t.toLowerCase().includes(q))
    ).slice(0, 6);
  }, [search]);

  const activeCat = route.name === 'shop' ? route.category : undefined;

  const goShop = (category?: string, subCategory?: string) => {
    setMobileOpen(false);
    setMobileExpanded(null);
    setSearch('');
    setSearchFocus(false);
    setHoverCat(null);
    navigate({ name: 'shop', category, subCategory });
  };

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (suggestions[0]) {
      navigate({ name: 'product', id: suggestions[0].id });
      setSearch('');
      setSearchFocus(false);
    } else if (search.trim()) {
      goShop();
    }
  };

  const megaPanel = (label: MasterCategory) => {
    const subs = MASTER_CATEGORY_TREE[label] ?? [];
    const items = FABRICS.filter(f => f.masterCategory === label).slice(0, 4);
    return (
      <div
        className="absolute top-full left-1/2 -translate-x-1/2 w-[820px] bg-white border-t-4 border-[color:var(--color-myntra-pink)] shadow-2xl pt-6 pb-7 px-8 grid grid-cols-[220px_1fr] gap-8 z-50"
        onMouseEnter={() => setHoverCat(label)}
        onMouseLeave={() => setHoverCat(null)}
      >
        <div>
          <p className="text-[11px] uppercase tracking-[0.15em] font-bold text-[color:var(--color-myntra-pink)] mb-3">
            Shop by {label}
          </p>
          <ul className="space-y-2 text-sm">
            <li>
              <button
                onClick={() => goShop(label)}
                className="hover:text-[color:var(--color-myntra-pink)] font-semibold"
              >
                All {label}
              </button>
            </li>
            {subs.map(sub => (
              <li key={sub}>
                <button
                  onClick={() => goShop(label, sub)}
                  className="hover:text-[color:var(--color-myntra-pink)] text-[color:var(--color-myntra-ink-soft)]"
                >
                  {sub}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {items.length > 0 ? (
            items.map(f => (
              <button
                key={f.id}
                onClick={() => { navigate({ name: 'product', id: f.id }); setHoverCat(null); }}
                className="text-left group"
              >
                <div className="aspect-[3/4] bg-[color:var(--color-myntra-bg-soft)] overflow-hidden mb-2">
                  <img
                    src={f.photo}
                    alt={f.name}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = f.image; }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <p className="text-[12px] font-bold text-[color:var(--color-myntra-navy)] truncate">{f.brand}</p>
                <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] truncate">
                  {f.name.split(' ').slice(0, 3).join(' ')}
                </p>
              </button>
            ))
          ) : (
            <button
              onClick={() => goShop(label)}
              className="col-span-4 aspect-[16/6] bg-[color:var(--color-myntra-bg-soft)] border border-dashed border-[color:var(--color-myntra-pink)] flex flex-col items-center justify-center gap-1 text-center px-4 group hover:bg-white transition-colors"
            >
              <span className="text-[11px] uppercase tracking-[0.18em] font-bold text-[color:var(--color-myntra-pink)]">
                Coming soon
              </span>
              <span className="text-[13px] font-semibold text-[color:var(--color-myntra-navy)] group-hover:text-[color:var(--color-myntra-pink)]">
                Preview the {label} collection ↗
              </span>
            </button>
          )}
        </div>
      </div>
    );
  };

  const mobileDrawer = (
    <AnimatePresence>
      {mobileOpen && (
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: 0 }}
          exit={{ x: '-100%' }}
          transition={{ type: 'tween', duration: 0.25 }}
          className="fixed inset-0 z-[200] bg-white flex flex-col"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--color-myntra-border-soft)]">
            <button onClick={() => { setMobileOpen(false); navigate({ name: 'home' }); }} className="flex items-center gap-2">
              <img src="/branding/mark-master.png" alt="" className="h-9 w-auto object-contain" draggable={false} />
              <span className="font-serif font-semibold text-xl tracking-[0.04em] text-[color:var(--color-myntra-navy)]">TRÉSOR</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--color-myntra-ink-soft)]">couture</span>
            </button>
            <button onClick={() => setMobileOpen(false)} aria-label="Close menu">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="px-5 py-4 border-b border-[color:var(--color-myntra-border-soft)]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[color:var(--color-myntra-ink-mute)]" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search for fabrics, sarees, lehengas and more"
                className="input-search"
              />
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto px-5 py-4">
            <button
              onClick={() => goShop()}
              className="w-full text-left py-3 font-bold text-[15px] border-b border-[color:var(--color-myntra-border-soft)]"
            >
              All Categories
            </button>
            {NAV.map(n => {
              if (n.kind === 'static') {
                const click = () => {
                  if (n.label === 'Couture Customisations') {
                    setMobileOpen(false);
                    navigate({ name: 'customise' });
                  } else {
                    goShop();
                  }
                };
                const premium = n.tone === 'premium';
                return (
                  <button
                    key={n.label}
                    onClick={click}
                    className={
                      premium
                        ? 'w-full text-left py-3.5 border-b border-[#E8DCC4] bg-[#FBF7EE] -mx-5 px-5 flex items-center gap-2 font-serif italic text-[17px] text-[#8E6520]'
                        : `w-full text-left py-3 text-[15px] border-b border-[color:var(--color-myntra-border-soft)] ${n.tone === 'sale' ? 'text-[color:var(--color-myntra-pink)] font-bold' : 'font-semibold'}`
                    }
                  >
                    {premium && <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-myntra-pink)]" />}
                    {n.label}
                  </button>
                );
              }
              const expanded = mobileExpanded === n.label;
              const subs = MASTER_CATEGORY_TREE[n.label] ?? [];
              const isPremium = n.tone === 'premium';
              return (
                <div key={n.label} className={`border-b border-[color:var(--color-myntra-border-soft)] ${isPremium ? 'bg-[#FBF7EE] -mx-5 px-5' : ''}`}>
                  <div className="flex items-stretch">
                    <button
                      onClick={() => goShop(n.label)}
                      className={
                        isPremium
                          ? 'flex-1 text-left py-3.5 font-serif italic text-[17px] text-[#8E6520] flex items-center gap-2'
                          : 'flex-1 text-left py-3 font-semibold text-[15px]'
                      }
                    >
                      {isPremium && <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-myntra-pink)]" />}
                      {n.label}
                    </button>
                    <button
                      onClick={() => setMobileExpanded(expanded ? null : n.label)}
                      aria-label={`${expanded ? 'Collapse' : 'Expand'} ${n.label}`}
                      aria-expanded={expanded}
                      className="px-3 flex items-center"
                    >
                      <ChevronDown
                        className={`w-5 h-5 text-[color:var(--color-myntra-ink-soft)] transition-transform ${expanded ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </div>
                  {expanded && subs.length > 0 && (
                    <div className="pb-3 flex flex-wrap gap-2">
                      {subs.map(sub => (
                        <button
                          key={sub}
                          onClick={() => goShop(n.label, sub)}
                          className="text-[12px] font-semibold px-3 py-1.5 rounded-full bg-[color:var(--color-myntra-bg-soft)] text-[color:var(--color-myntra-navy)] hover:bg-[color:var(--color-myntra-pink)] hover:text-white transition-colors"
                        >
                          {sub}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <header className="fixed top-0 left-0 w-full z-50 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
        {/* Top tier — logo, nav, search, icons */}
        <div className="h-16 md:h-20 px-4 md:px-8 lg:px-10 flex items-center gap-4 md:gap-6">
          <button
            onClick={() => navigate({ name: 'home' })}
            className="flex items-center gap-2 md:gap-2.5 shrink-0 no-tap-highlight"
            aria-label="Trésor Couture — Home"
          >
            <img
              src="/branding/mark-master.png"
              alt=""
              aria-hidden="true"
              className="h-10 md:h-12 w-auto select-none object-contain"
              loading="eager"
              draggable={false}
            />
            <span className="flex items-baseline gap-1.5">
              <span className="font-serif font-semibold text-[20px] md:text-[24px] tracking-[0.04em] text-[color:var(--color-myntra-navy)] leading-none">
                TRÉSOR
              </span>
              <span className="hidden sm:inline text-[10px] md:text-[11px] font-bold uppercase tracking-[0.22em] text-[color:var(--color-myntra-ink-soft)] leading-none">
                couture
              </span>
            </span>
          </button>

          {/* Desktop mega-menu */}
          <nav className="hidden lg:flex items-stretch gap-1 h-full" aria-label="Primary">
            {NAV.map(n => {
              const isActive =
                (n.kind === 'master' && activeCat === n.label) ||
                (n.kind === 'static' && n.label === 'Sale' && route.name === 'shop' && !activeCat);
              const onClick = () => {
                if (n.kind === 'master') goShop(n.label);
                else if (n.label === 'Couture Customisations') {
                  setMobileOpen(false);
                  setHoverCat(null);
                  navigate({ name: 'customise' });
                }
                else goShop();
              };
              const isPremium = n.tone === 'premium';
              const isSale = n.kind === 'static' && n.tone === 'sale';
              return (
                <div
                  key={n.label}
                  className="relative h-full"
                  onMouseEnter={() => setHoverCat(n.label)}
                  onMouseLeave={() => setHoverCat(null)}
                >
                  <button
                    onClick={onClick}
                    aria-haspopup={n.kind === 'master' ? 'true' : undefined}
                    aria-expanded={n.kind === 'master' ? hoverCat === n.label : undefined}
                    className={
                      isPremium
                        ? `h-full px-3 xl:px-4 flex items-center gap-1.5 font-serif italic text-[13px] xl:text-[15px] tracking-[0.02em] transition-colors no-tap-highlight border-b-[3px] ${
                            isActive
                              ? 'border-[color:var(--color-myntra-pink)] text-[color:var(--color-myntra-pink)]'
                              : 'border-transparent text-[#8E6520] hover:text-[color:var(--color-myntra-pink)]'
                          }`
                        : `h-full px-3 xl:px-4 flex items-center text-[12px] xl:text-[13px] font-bold uppercase tracking-[0.04em] transition-colors no-tap-highlight border-b-[3px] ${
                            isActive
                              ? 'border-[color:var(--color-myntra-pink)] text-[color:var(--color-myntra-pink)]'
                              : isSale
                                ? 'border-transparent text-[color:var(--color-myntra-pink)] hover:text-[color:var(--color-myntra-pink-dark)]'
                                : 'border-transparent text-[color:var(--color-myntra-navy)] hover:text-[color:var(--color-myntra-pink)]'
                          }`
                    }
                  >
                    {isPremium && (
                      <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full bg-[color:var(--color-myntra-pink)]" />
                    )}
                    {n.label}
                  </button>
                  {n.kind === 'master' && hoverCat === n.label && megaPanel(n.label)}
                </div>
              );
            })}
          </nav>

          {/* Search */}
          <form onSubmit={onSearchSubmit} className="hidden md:block flex-1 max-w-[560px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--color-myntra-ink-mute)] pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => setSearchFocus(true)}
              onBlur={() => setTimeout(() => setSearchFocus(false), 150)}
              placeholder="Search for fabrics, sarees, lehengas and more"
              className="input-search"
              aria-label="Search catalogue"
            />
            {searchFocus && suggestions.length > 0 && (
              <ul className="absolute top-full left-0 right-0 mt-1 bg-white border border-[color:var(--color-myntra-border-soft)] shadow-xl z-30 max-h-[360px] overflow-y-auto">
                {suggestions.map(f => (
                  <li key={f.id}>
                    <button
                      type="button"
                      onMouseDown={() => { navigate({ name: 'product', id: f.id }); setSearch(''); }}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[color:var(--color-myntra-bg-soft)] text-left"
                    >
                      <img src={f.photo} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).src = f.image; }} className="w-10 h-10 object-cover" />
                      <div className="min-w-0">
                        <p className="text-[12px] font-bold truncate">{f.brand}</p>
                        <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] truncate">{f.name}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </form>

          {/* Right icons */}
          <div className="flex items-center gap-1 md:gap-2 ml-auto md:ml-0 shrink-0">
            <div
              className="relative"
              onMouseEnter={() => setProfileOpen(true)}
              onMouseLeave={() => setProfileOpen(false)}
            >
              <button
                onClick={() => setProfileOpen(v => !v)}
                className="flex flex-col items-center px-2 md:px-3 py-1 group"
                aria-label="Profile"
                aria-expanded={profileOpen}
              >
                <User className="w-5 h-5 text-[color:var(--color-myntra-navy)] group-hover:text-[color:var(--color-myntra-pink)]" />
                <span className="hidden md:block text-[10px] font-bold mt-0.5">Profile</span>
              </button>
              {profileOpen && (
                <div className="absolute top-full right-0 w-60 bg-white border-t-4 border-[color:var(--color-myntra-pink)] shadow-2xl pt-3 pb-2 z-50">
                  <div className="px-4 pb-3 border-b border-[color:var(--color-myntra-border-soft)]">
                    {user ? (
                      <>
                        <p className="text-[14px] font-extrabold truncate">Hello, {user.fullName.split(' ')[0]}</p>
                        <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] truncate">{user.email}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-[14px] font-extrabold">Welcome</p>
                        <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] mb-2">To access your bag and orders</p>
                        <button
                          onClick={() => { setProfileOpen(false); navigate({ name: 'login' }); }}
                          className="block w-full text-center border border-[color:var(--color-myntra-pink)] text-[color:var(--color-myntra-pink)] text-[12px] font-bold uppercase tracking-wider py-1.5 rounded"
                        >
                          Login / Sign Up
                        </button>
                      </>
                    )}
                  </div>
                  <ul className="py-1 text-[13px]">
                    {user && (
                      <>
                        <li><button onClick={() => { setProfileOpen(false); navigate({ name: 'account', tab: 'profile' }); }} className="w-full text-left px-4 py-2 hover:bg-[color:var(--color-myntra-bg-soft)]">My Profile</button></li>
                        <li><button onClick={() => { setProfileOpen(false); navigate({ name: 'account', tab: 'orders' }); }} className="w-full text-left px-4 py-2 hover:bg-[color:var(--color-myntra-bg-soft)]">My Orders</button></li>
                        <li><button onClick={() => { setProfileOpen(false); navigate({ name: 'account', tab: 'wishlist' }); }} className="w-full text-left px-4 py-2 hover:bg-[color:var(--color-myntra-bg-soft)]">Wishlist</button></li>
                        <li><button onClick={() => { setProfileOpen(false); navigate({ name: 'account', tab: 'addresses' }); }} className="w-full text-left px-4 py-2 hover:bg-[color:var(--color-myntra-bg-soft)]">Addresses</button></li>
                      </>
                    )}
                    {isAdmin && (
                      <li>
                        <button
                          onClick={() => { setProfileOpen(false); navigate({ name: 'admin' }); }}
                          className="w-full text-left px-4 py-2 hover:bg-[color:var(--color-myntra-bg-soft)] text-[color:var(--color-myntra-pink)] font-bold flex items-center gap-2"
                        >
                          <LayoutDashboard className="w-4 h-4" /> Admin Console
                        </button>
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
            <button
              onClick={() => navigate(user ? { name: 'account', tab: 'wishlist' } : { name: 'login' })}
              className="flex flex-col items-center px-2 md:px-3 py-1 group relative"
              aria-label="Wishlist"
            >
              <Heart className="w-5 h-5 text-[color:var(--color-myntra-navy)] group-hover:text-[color:var(--color-myntra-pink)]" />
              <span className="hidden md:block text-[10px] font-bold mt-0.5">Wishlist</span>
              {wishBadge > 0 && (
                <span className="absolute top-0 right-1 bg-[color:var(--color-myntra-pink)] text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                  {wishBadge}
                </span>
              )}
            </button>
            <button
              onClick={() => navigate({ name: 'cart' })}
              className="flex flex-col items-center px-3 py-1 group relative"
              aria-label="Bag"
            >
              <ShoppingBag className="w-5 h-5 text-[color:var(--color-myntra-navy)] group-hover:text-[color:var(--color-myntra-pink)]" />
              <span className="hidden md:block text-[10px] font-bold mt-0.5">Bag</span>
              {cartBadge > 0 && (
                <span className="absolute top-0 right-1 bg-[color:var(--color-myntra-pink)] text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                  {cartBadge}
                </span>
              )}
            </button>
            <button className="lg:hidden p-2" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Offer ticker */}
        <div className="bg-[color:var(--color-myntra-navy)] text-white text-[12px] font-semibold tracking-wide py-1.5 overflow-hidden">
          <div className="marquee-track flex gap-12 whitespace-nowrap w-max">
            {[...OFFER_TICKER, ...OFFER_TICKER].map((t, i) => (
              <span key={i} className="flex items-center gap-3 px-3">
                <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-myntra-pink)]" />
                {t}
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* Sub-bar with master-category chips on shop pages */}
      {route.name === 'shop' && (
        <div className="fixed top-[88px] md:top-[100px] left-0 w-full z-40 bg-white border-b border-[color:var(--color-myntra-border-soft)]">
          <div className="max-w-[1400px] mx-auto px-4 md:px-8 lg:px-10 py-2 flex gap-2 overflow-x-auto scrollbar-none">
            <button onClick={() => goShop()} className={`chip ${!activeCat ? 'chip-active' : ''}`}>All</button>
            {MASTER_CATEGORIES.map(c => (
              <button key={c} onClick={() => goShop(c)} className={`chip ${activeCat === c ? 'chip-active' : ''}`}>
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {typeof document !== 'undefined' && createPortal(mobileDrawer, document.body)}
    </>
  );
};

export default Navbar;
