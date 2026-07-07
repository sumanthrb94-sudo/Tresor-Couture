import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ChevronDown, Heart, LayoutDashboard, LogIn, LogOut, Menu, PackageOpen, Search, ShoppingBag, User, UserCircle, UserPlus, X } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../context/RouterContext';
import { FABRICS, MASTER_CATEGORIES, MASTER_CATEGORY_TREE, OFFER_TICKER } from '../constants';
import { productsApi } from '../lib/firebase';
import type { Fabric, MasterCategory } from '../types';

type NavEntry =
  | { kind: 'master'; label: MasterCategory; tone?: 'default' | 'premium' }
  | { kind: 'static'; label: string; tone?: 'default' | 'premium' };

const NAV: NavEntry[] = [
  ...MASTER_CATEGORIES
    .filter(m => m !== 'Studios Prêt')
    .map<NavEntry>(m => ({ kind: 'master', label: m })),
  { kind: 'master', label: 'Studios Prêt', tone: 'premium' }
];

const Navbar: React.FC = () => {
  const { navigate, route } = useRouter();
  const { user, isAdmin, logout } = useAuth();
  const { itemCount: cartCount } = useCart();
  const { ids: wishIds } = useWishlist();

  const [search, setSearch] = useState('');
  const [searchFocus, setSearchFocus] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hoverCat, setHoverCat] = useState<string | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    if (!mobileOpen) setMobileExpanded(null);
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  // Close desktop account dropdown on outside click
  useEffect(() => {
    if (!accountOpen) return;
    const handler = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [accountOpen]);

  // Live catalogue for search
  const [catalog, setCatalog] = useState<Fabric[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await productsApi.list({ limit: 200 });
        if (!cancelled && rows.length) setCatalog(rows as unknown as Fabric[]);
      } catch { /* keep FABRICS fallback */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const searchPool = catalog ?? FABRICS;

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return searchPool.filter(f =>
      f.name.toLowerCase().includes(q) ||
      f.category.toLowerCase().includes(q) ||
      f.masterCategory.toLowerCase().includes(q) ||
      (f.tags ?? []).some(t => t.toLowerCase().includes(q))
    ).slice(0, 6);
  }, [search, searchPool]);

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
    const q = search.trim();
    if (suggestions[0]) {
      navigate({ name: 'product', id: suggestions[0].id });
    } else if (q) {
      navigate({ name: 'search', q });
    }
    setSearch('');
    setSearchFocus(false);
    setSearchOpen(false);
  };

  useEffect(() => {
    if (searchOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [searchOpen]);

  const megaPanel = (label: MasterCategory) => {
    const subs = MASTER_CATEGORY_TREE[label] ?? [];
    const items = searchPool.filter(f => f.masterCategory === label).slice(0, 4);
    return (
      <div
        className="fixed top-[64px] md:top-[80px] left-1/2 -translate-x-1/2 w-[820px] max-w-[calc(100vw-32px)] bg-white border-t-4 border-[color:var(--color-myntra-pink)] shadow-2xl pt-6 pb-7 px-8 grid grid-cols-[220px_1fr] gap-8 z-[60]"
        onMouseEnter={() => setHoverCat(label)}
        onMouseLeave={() => setHoverCat(null)}
      >
        <div>
          <p className="text-[11px] uppercase tracking-[0.15em] font-bold text-[color:var(--color-myntra-pink)] mb-3">
            Shop by {label}
          </p>
          <ul className="space-y-2 text-sm">
            <li>
              <button onClick={() => goShop(label)} className="hover:text-[color:var(--color-myntra-pink)] font-semibold">
                All {label}
              </button>
            </li>
            {subs.map(sub => (
              <li key={sub}>
                <button onClick={() => goShop(label, sub)} className="hover:text-[color:var(--color-myntra-pink)] text-[color:var(--color-myntra-ink-soft)]">
                  {sub}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {items.length > 0 ? (
            items.map(f => (
              <button key={f.id} onClick={() => { navigate({ name: 'product', id: f.id }); setHoverCat(null); }} className="text-left group">
                <div className="aspect-[3/4] bg-[color:var(--color-myntra-bg-soft)] overflow-hidden mb-2">
                  <img src={f.photo} alt={f.name} onError={(e) => { (e.currentTarget as HTMLImageElement).src = f.image; }} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <p className="text-[12px] font-bold text-[color:var(--color-myntra-navy)] truncate">{f.brand}</p>
                <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] truncate">{f.name.split(' ').slice(0, 3).join(' ')}</p>
              </button>
            ))
          ) : (
            <button onClick={() => goShop(label)} className="col-span-4 aspect-[16/6] bg-[color:var(--color-myntra-bg-soft)] border border-dashed border-[color:var(--color-myntra-pink)] flex flex-col items-center justify-center gap-1 text-center px-4 group hover:bg-white transition-colors">
              <span className="text-[11px] uppercase tracking-[0.18em] font-bold text-[color:var(--color-myntra-pink)]">Coming soon</span>
              <span className="text-[13px] font-semibold text-[color:var(--color-myntra-navy)] group-hover:text-[color:var(--color-myntra-pink)]">Preview the {label} collection ↗</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  const searchOverlay = (
    <AnimatePresence>
      {searchOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="lg:hidden fixed inset-0 z-[210] bg-white flex flex-col">
          <form onSubmit={onSearchSubmit} className="flex items-center gap-2 px-3 py-3 border-b border-[color:var(--color-myntra-border-soft)]">
            <button type="button" onClick={() => { setSearchOpen(false); setSearch(''); }} aria-label="Close search" className="p-2 -ml-1 text-[color:var(--color-myntra-navy)]"><ArrowLeft className="w-5 h-5" /></button>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--color-myntra-ink-mute)] pointer-events-none" />
              <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search for sarees, lehengas, dresses…" className="input-search" aria-label="Search catalogue" enterKeyHint="search" />
              {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear" className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[color:var(--color-myntra-ink-mute)]"><X className="w-4 h-4" /></button>}
            </div>
          </form>
          <div className="flex-1 overflow-y-auto">
            {suggestions.length > 0 ? (
              <ul>
                {suggestions.map(f => (
                  <li key={f.id}>
                    <button type="button" onClick={() => { navigate({ name: 'product', id: f.id }); setSearch(''); setSearchOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 border-b border-[color:var(--color-myntra-border-soft)] text-left active:bg-[color:var(--color-myntra-bg-soft)]">
                      <img src={f.photo} alt="" onError={e => { (e.currentTarget as HTMLImageElement).src = f.image; }} className="w-12 h-14 object-cover bg-[color:var(--color-myntra-bg-soft)]" />
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold truncate">{f.brand}</p>
                        <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] truncate">{f.name}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : search.trim() ? (
              <button type="button" onClick={() => { navigate({ name: 'search', q: search.trim() }); setSearch(''); setSearchOpen(false); }} className="w-full text-left px-4 py-3 text-[14px] font-semibold text-[color:var(--color-myntra-pink)]">Search for "{search.trim()}"</button>
            ) : (
              <div className="px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.14em] font-bold text-[color:var(--color-myntra-ink-mute)] mb-3">Popular</p>
                <div className="flex flex-wrap gap-2">
                  {['Sarees', 'Lehenga Cholis', 'Anarkalis', 'Western Wear', 'Fabrics'].map(term => (
                    <button key={term} type="button" onClick={() => { navigate({ name: 'shop', category: term }); setSearchOpen(false); }} className="px-3 py-1.5 rounded-full border border-[color:var(--color-myntra-border-soft)] text-[12px] text-[color:var(--color-myntra-ink)]">{term}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const mobileDrawer = (
    <AnimatePresence>
      {mobileOpen && (
        <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'tween', duration: 0.25 }} className="fixed inset-0 z-[200] bg-white flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--color-myntra-border-soft)]">
            <button onClick={() => { setMobileOpen(false); navigate({ name: 'home' }); }} className="flex items-center gap-2">
              <img src="/branding/tc-emblem.png" alt="" className="h-9 w-auto object-contain" draggable={false} />
              <span className="font-serif font-semibold text-xl tracking-[0.04em] text-[color:var(--color-myntra-navy)]">TRESOR</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--color-myntra-ink-soft)]">couture</span>
            </button>
            <button onClick={() => setMobileOpen(false)} aria-label="Close menu"><X className="w-6 h-6" /></button>
          </div>
          {user ? (
            <div className="px-5 py-3 border-b border-[color:var(--color-myntra-border-soft)] flex items-center justify-between gap-3 bg-[color:var(--color-myntra-bg-soft)]">
              <div className="min-w-0">
                <p className="text-[14px] font-extrabold truncate">Hello, {user.fullName.split(' ')[0]}</p>
                <p className="text-[11px] text-[color:var(--color-myntra-ink-soft)] truncate">{user.email}</p>
              </div>
              <button onClick={() => { setMobileOpen(false); logout(); navigate({ name: 'home' }); }} className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--color-myntra-pink)] flex items-center gap-1 shrink-0"><LogOut className="w-4 h-4" /> Sign out</button>
            </div>
          ) : (
            <div className="px-5 py-3 border-b border-[color:var(--color-myntra-border-soft)] grid grid-cols-2 gap-2 bg-[#FBF7EE]">
              <button onClick={() => { setMobileOpen(false); navigate({ name: 'login' }); }} className="flex items-center justify-center gap-1.5 bg-[color:var(--color-myntra-pink)] text-white text-[12px] font-bold uppercase tracking-[0.08em] py-2.5 rounded"><LogIn className="w-4 h-4" /> Sign in</button>
              <button onClick={() => { setMobileOpen(false); navigate({ name: 'register' }); }} className="flex items-center justify-center gap-1.5 bg-white border border-[color:var(--color-myntra-pink)] text-[color:var(--color-myntra-pink)] text-[12px] font-bold uppercase tracking-[0.08em] py-2.5 rounded"><UserPlus className="w-4 h-4" /> Sign up</button>
            </div>
          )}
          <div className="px-5 py-4 border-b border-[color:var(--color-myntra-border-soft)]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[color:var(--color-myntra-ink-mute)]" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search for fabrics, sarees, lehengas and more" className="input-search" />
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto px-5 py-4">
            <button onClick={() => goShop()} className="w-full text-left py-3 font-bold text-[15px] border-b border-[color:var(--color-myntra-border-soft)]">All Categories</button>
            {NAV.map(n => {
              if (n.kind === 'static') {
                const click = () => { goShop(); };
                const premium = n.tone === 'premium';
                return (
                  <button key={n.label} onClick={click} className={premium ? 'w-full text-left py-3.5 border-b border-[#E8DCC4] bg-[#FBF7EE] -mx-5 px-5 flex items-center gap-2 font-serif italic text-[17px] text-[#8E6520]' : 'w-full text-left py-3 text-[15px] border-b border-[color:var(--color-myntra-border-soft)] font-semibold'}>
                    {premium && <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-myntra-pink)]" />}{n.label}
                  </button>
                );
              }
              const expanded = mobileExpanded === n.label;
              const subs = MASTER_CATEGORY_TREE[n.label] ?? [];
              const isPremium = n.tone === 'premium';
              return (
                <div key={n.label} className={`border-b border-[color:var(--color-myntra-border-soft)] ${isPremium ? 'bg-[#FBF7EE] -mx-5 px-5' : ''}`}>
                  <div className="flex items-stretch">
                    <button onClick={() => goShop(n.label)} className={isPremium ? 'flex-1 text-left py-3.5 font-serif italic text-[17px] text-[#8E6520] flex items-center gap-2' : 'flex-1 text-left py-3 font-semibold text-[15px]'}>
                      {isPremium && <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-myntra-pink)]" />}{n.label}
                    </button>
                    <button onClick={() => setMobileExpanded(expanded ? null : n.label)} aria-label={`${expanded ? 'Collapse' : 'Expand'} ${n.label}`} aria-expanded={expanded} className="px-3 flex items-center">
                      <ChevronDown className={`w-5 h-5 text-[color:var(--color-myntra-ink-soft)] transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                  {expanded && subs.length > 0 && (
                    <div className="pb-3 flex flex-wrap gap-2">
                      {subs.map(sub => <button key={sub} onClick={() => goShop(n.label, sub)} className="text-[12px] font-semibold px-3 py-1.5 rounded-full bg-[color:var(--color-myntra-bg-soft)] text-[color:var(--color-myntra-navy)] hover:bg-[color:var(--color-myntra-pink)] hover:text-white transition-colors">{sub}</button>)}
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
        {/* Top tier — hamburger, logo, centered search, search icon */}
        <div className="h-16 md:h-20 px-4 md:px-6 lg:px-6 xl:px-10 flex items-center gap-3 md:gap-4">
          {/* Hamburger — left of logo (mobile only) */}
          <button className="lg:hidden p-2 -ml-2" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu className="w-6 h-6" />
          </button>

          {/* Logo */}
          <button onClick={() => navigate({ name: 'home' })} className="flex items-center gap-2 md:gap-2.5 shrink-0 no-tap-highlight" aria-label="Tresor Couture — Home">
            <img src="/branding/tc-emblem.png" alt="" aria-hidden="true" className="h-10 md:h-12 w-auto select-none object-contain" loading="eager" draggable={false} />
            <span className="flex items-baseline gap-1.5">
              <span className="font-serif font-semibold text-[20px] md:text-[24px] tracking-[0.04em] text-[color:var(--color-myntra-navy)] leading-none">TRESOR</span>
              <span className="hidden sm:inline text-[10px] md:text-[11px] font-bold uppercase tracking-[0.22em] text-[color:var(--color-myntra-ink-soft)] leading-none">couture</span>
            </span>
          </button>

          {/* Desktop mega-menu nav — left of center */}
          <nav className="hidden lg:flex items-stretch gap-0 xl:gap-1 h-full min-w-0 flex-shrink overflow-x-auto scrollbar-none" aria-label="Primary">
            {NAV.map(n => {
              const isActive = (n.kind === 'master' && activeCat === n.label) || (n.kind === 'static' && n.label === 'Sale' && route.name === 'shop' && !activeCat);
              const onClick = () => { if (n.kind === 'master') goShop(n.label); else goShop(); };
              const isPremium = n.tone === 'premium';
              return (
                <div key={n.label} className="relative h-full" onMouseEnter={() => setHoverCat(n.label)} onMouseLeave={() => setHoverCat(null)}>
                  <button onClick={onClick} aria-haspopup={n.kind === 'master' ? 'true' : undefined} aria-expanded={n.kind === 'master' ? hoverCat === n.label : undefined}
                    className={isPremium ? `h-full px-2 flex items-center gap-1.5 whitespace-nowrap font-serif italic text-[12px] tracking-[0.02em] transition-colors no-tap-highlight border-b-[3px] ${isActive ? 'border-[color:var(--color-myntra-pink)] text-[color:var(--color-myntra-pink)]' : 'border-transparent text-[#8E6520] hover:text-[color:var(--color-myntra-pink)]'}` : `h-full px-2 flex items-center whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.04em] transition-colors no-tap-highlight border-b-[3px] ${isActive ? 'border-[color:var(--color-myntra-pink)] text-[color:var(--color-myntra-pink)]' : 'border-transparent text-[color:var(--color-myntra-navy)] hover:text-[color:var(--color-myntra-pink)]'}`}>
                    {isPremium && <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full bg-[color:var(--color-myntra-pink)]" />}{n.label}
                  </button>
                  {n.kind === 'master' && hoverCat === n.label && megaPanel(n.label)}
                </div>
              );
            })}
          </nav>

          {/* CENTERED SEARCH BAR — visible on tablet+ */}
          <form onSubmit={onSearchSubmit} className="hidden md:flex flex-1 justify-center max-w-xl mx-auto relative">
            <div className="relative w-full max-w-[480px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--color-myntra-ink-mute)] pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                onFocus={() => setSearchFocus(true)}
                onBlur={() => setTimeout(() => setSearchFocus(false), 150)}
                placeholder="Search for fabrics, sarees, lehengas and more"
                className="input-search w-full"
                aria-label="Search catalogue"
              />
              {searchFocus && suggestions.length > 0 && (
                <ul className="absolute top-full left-0 right-0 mt-1 bg-white border border-[color:var(--color-myntra-border-soft)] shadow-xl z-30 max-h-[360px] overflow-y-auto">
                  {suggestions.map(f => (
                    <li key={f.id}>
                      <button type="button" onMouseDown={() => { navigate({ name: 'product', id: f.id }); setSearch(''); }} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[color:var(--color-myntra-bg-soft)] text-left">
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
            </div>
          </form>

          {/* Right side — search icon (mobile) + desktop actions */}
          <div className="flex items-center shrink-0 ml-auto gap-0 md:gap-1">
            <button className="md:hidden flex items-center px-2 py-1 group" onClick={() => setSearchOpen(true)} aria-label="Search">
              <Search className="w-5 h-5 text-[color:var(--color-myntra-navy)] group-hover:text-[color:var(--color-myntra-pink)]" />
            </button>

            {/* Desktop action icons */}
            <div className="hidden lg:flex items-center">
              {/* Wishlist */}
              <button
                onClick={() => navigate({ name: 'account', tab: 'wishlist' })}
                className="relative flex flex-col items-center px-3 py-1 group"
                aria-label="Wishlist"
              >
                <Heart className="w-5 h-5 text-[color:var(--color-myntra-navy)] group-hover:text-[color:var(--color-myntra-pink)] transition-colors" />
                {wishIds.length > 0 && (
                  <span className="absolute -top-0.5 right-1.5 bg-[color:var(--color-myntra-pink)] text-white text-[9px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1">
                    {wishIds.length > 9 ? '9+' : wishIds.length}
                  </span>
                )}
              </button>

              {/* Cart */}
              <button
                onClick={() => navigate({ name: 'cart' })}
                className="relative flex flex-col items-center px-3 py-1 group"
                aria-label={`Cart with ${cartCount} item${cartCount > 1 ? 's' : ''}`}
              >
                <ShoppingBag className="w-5 h-5 text-[color:var(--color-myntra-navy)] group-hover:text-[color:var(--color-myntra-pink)] transition-colors" />
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 right-1.5 bg-[color:var(--color-myntra-pink)] text-white text-[9px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1">
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </button>

              {/* Account dropdown */}
              <div ref={accountRef} className="relative">
                <button
                  onClick={() => setAccountOpen(v => !v)}
                  aria-haspopup="true"
                  aria-expanded={accountOpen}
                  className="flex flex-col items-center px-3 py-1 group"
                  aria-label={user ? 'Account menu' : 'Sign in'}
                >
                  <User className={`w-5 h-5 transition-colors ${accountOpen ? 'text-[color:var(--color-myntra-pink)]' : 'text-[color:var(--color-myntra-navy)] group-hover:text-[color:var(--color-myntra-pink)]'}`} />
                </button>

                {accountOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-[color:var(--color-myntra-border-soft)] shadow-xl rounded-lg py-2 z-[60]">
                    {user ? (
                      <>
                        <div className="px-4 py-3 border-b border-[color:var(--color-myntra-border-soft)] mb-1">
                          <p className="text-[13px] font-extrabold text-[color:var(--color-myntra-navy)] truncate">Hello, {user.fullName.split(' ')[0]}</p>
                          <p className="text-[11px] text-[color:var(--color-myntra-ink-soft)] truncate">{user.email}</p>
                        </div>
                        <button onClick={() => { setAccountOpen(false); navigate({ name: 'account', tab: 'profile' }); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-semibold text-[color:var(--color-myntra-navy)] hover:bg-[color:var(--color-myntra-bg-soft)] text-left">
                          <UserCircle className="w-4 h-4 text-[color:var(--color-myntra-ink-soft)]" /> My Profile
                        </button>
                        <button onClick={() => { setAccountOpen(false); navigate({ name: 'account', tab: 'orders' }); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-semibold text-[color:var(--color-myntra-navy)] hover:bg-[color:var(--color-myntra-bg-soft)] text-left">
                          <PackageOpen className="w-4 h-4 text-[color:var(--color-myntra-ink-soft)]" /> My Orders
                        </button>
                        <button onClick={() => { setAccountOpen(false); navigate({ name: 'account', tab: 'wishlist' }); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-semibold text-[color:var(--color-myntra-navy)] hover:bg-[color:var(--color-myntra-bg-soft)] text-left">
                          <Heart className="w-4 h-4 text-[color:var(--color-myntra-ink-soft)]" /> Wishlist
                        </button>
                        {isAdmin && (
                          <button onClick={() => { setAccountOpen(false); navigate({ name: 'admin' }); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-semibold text-[color:var(--color-myntra-pink)] hover:bg-[color:var(--color-myntra-bg-soft)] text-left">
                            <LayoutDashboard className="w-4 h-4" /> Admin Console
                          </button>
                        )}
                        <div className="border-t border-[color:var(--color-myntra-border-soft)] mt-1 pt-1">
                          <button onClick={() => { setAccountOpen(false); logout(); navigate({ name: 'home' }); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-semibold text-[#A12626] hover:bg-[#FBE6E6] text-left">
                            <LogOut className="w-4 h-4" /> Sign out
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="px-4 py-3 border-b border-[color:var(--color-myntra-border-soft)] mb-1">
                          <p className="text-[13px] font-extrabold text-[color:var(--color-myntra-navy)]">Welcome to Tresor</p>
                          <p className="text-[11px] text-[color:var(--color-myntra-ink-soft)]">Sign in to access your account</p>
                        </div>
                        <button onClick={() => { setAccountOpen(false); navigate({ name: 'login' }); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-semibold text-[color:var(--color-myntra-navy)] hover:bg-[color:var(--color-myntra-bg-soft)] text-left">
                          <LogIn className="w-4 h-4 text-[color:var(--color-myntra-ink-soft)]" /> Sign In
                        </button>
                        <button onClick={() => { setAccountOpen(false); navigate({ name: 'register' }); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-semibold text-[color:var(--color-myntra-navy)] hover:bg-[color:var(--color-myntra-bg-soft)] text-left">
                          <UserPlus className="w-4 h-4 text-[color:var(--color-myntra-ink-soft)]" /> Create Account
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Offer ticker */}
        <div className="bg-[color:var(--color-myntra-navy)] text-white text-[12px] font-semibold tracking-wide py-1.5 overflow-hidden">
          <div className="marquee-track flex gap-12 whitespace-nowrap w-max">
            {[...OFFER_TICKER, ...OFFER_TICKER].map((t, i) => (
              <span key={i} className="flex items-center gap-3 px-3"><span className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-myntra-pink)]" />{t}</span>
            ))}
          </div>
        </div>
      </header>

      {typeof document !== 'undefined' && createPortal(mobileDrawer, document.body)}
      {typeof document !== 'undefined' && createPortal(searchOverlay, document.body)}
    </>
  );
};

export default Navbar;