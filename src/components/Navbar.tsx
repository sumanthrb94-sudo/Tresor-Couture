import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useRouter } from '../context/RouterContext';
import { CATEGORIES, FABRICS, OFFER_TICKER } from '../constants';

const NAV: { label: string; category?: string; tone?: 'default' | 'sale' }[] = [
  { label: 'Silks', category: 'Silk' },
  { label: 'Cottons', category: 'Cotton' },
  { label: 'Wool', category: 'Wool' },
  { label: 'Linen', category: 'Linen' },
  { label: 'Satin', category: 'Satin' },
  { label: 'Mixed', category: 'Mixed' },
  { label: 'Studio' },
  { label: 'Sale', tone: 'sale' }
];

const Navbar: React.FC = () => {
  const { itemCount } = useCart();
  const { count: wishCount } = useWishlist();
  const { navigate, route } = useRouter();

  const [search, setSearch] = useState('');
  const [searchFocus, setSearchFocus] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hoverCat, setHoverCat] = useState<string | null>(null);

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
      f.tags.some(t => t.toLowerCase().includes(q))
    ).slice(0, 6);
  }, [search]);

  const activeCat = route.name === 'shop' ? route.category : undefined;

  const goShop = (category?: string) => {
    setMobileOpen(false);
    setSearch('');
    setSearchFocus(false);
    navigate({ name: 'shop', category });
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

  const megaPanel = (label: string) => {
    if (label === 'Sale' || label === 'Studio') return null;
    const cat = NAV.find(n => n.label === label)?.category;
    const items = FABRICS.filter(f => f.category === cat).slice(0, 4);
    if (!items.length) return null;
    return (
      <div
        className="absolute top-full left-1/2 -translate-x-1/2 w-[760px] bg-white border-t-4 border-[color:var(--color-myntra-pink)] shadow-2xl pt-6 pb-7 px-8 grid grid-cols-[200px_1fr] gap-8 z-50"
        onMouseEnter={() => setHoverCat(label)}
        onMouseLeave={() => setHoverCat(null)}
      >
        <div>
          <p className="text-[11px] uppercase tracking-[0.15em] font-bold text-[color:var(--color-myntra-pink)] mb-3">
            Shop by Weave
          </p>
          <ul className="space-y-2 text-sm">
            <li><button onClick={() => goShop(cat)} className="hover:text-[color:var(--color-myntra-pink)] font-semibold">All {label}</button></li>
            <li><button onClick={() => goShop(cat)} className="hover:text-[color:var(--color-myntra-pink)] text-[color:var(--color-myntra-ink-soft)]">Bestsellers</button></li>
            <li><button onClick={() => goShop(cat)} className="hover:text-[color:var(--color-myntra-pink)] text-[color:var(--color-myntra-ink-soft)]">New In</button></li>
            <li><button onClick={() => goShop(cat)} className="hover:text-[color:var(--color-myntra-pink)] text-[color:var(--color-myntra-ink-soft)]">Hand-woven</button></li>
            <li><button onClick={() => goShop(cat)} className="hover:text-[color:var(--color-myntra-pink)] text-[color:var(--color-myntra-ink-soft)]">Heritage Revival</button></li>
          </ul>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {items.map(f => (
            <button
              key={f.id}
              onClick={() => { navigate({ name: 'product', id: f.id }); setHoverCat(null); }}
              className="text-left group"
            >
              <div className="aspect-[3/4] bg-[color:var(--color-myntra-bg-soft)] overflow-hidden mb-2">
                <img src={f.photo} alt={f.name} onError={(e) => { (e.currentTarget as HTMLImageElement).src = f.image; }} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <p className="text-[12px] font-bold text-[color:var(--color-myntra-navy)] truncate">{f.brand}</p>
              <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] truncate">{f.name.split(' ').slice(0, 3).join(' ')}</p>
            </button>
          ))}
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
              <img src="/branding/logo-master.png" alt="" className="h-9 w-auto object-contain" />
              <span className="font-bold text-xl tracking-tight text-[color:var(--color-myntra-pink)]">Trésor</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[color:var(--color-myntra-ink-soft)]">couture</span>
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
                placeholder="Search for fabrics, weaves and more"
                className="input-search"
              />
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto px-5 py-4">
            <button onClick={() => goShop()} className="w-full text-left py-3 font-bold text-[15px] border-b border-[color:var(--color-myntra-border-soft)]">All Fabrics</button>
            {NAV.map(n => (
              <button
                key={n.label}
                onClick={() => n.category ? goShop(n.category) : goShop()}
                className={`w-full text-left py-3 text-[15px] border-b border-[color:var(--color-myntra-border-soft)] ${n.tone === 'sale' ? 'text-[color:var(--color-myntra-pink)] font-bold' : 'font-semibold'}`}
              >
                {n.label}
              </button>
            ))}
            <button onClick={() => { setMobileOpen(false); navigate({ name: 'cart' }); }} className="w-full text-left py-3 font-semibold text-[15px] border-b border-[color:var(--color-myntra-border-soft)]">
              Bag ({cartBadge})
            </button>
            <button className="w-full text-left py-3 font-semibold text-[15px]">Wishlist ({wishBadge})</button>
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
            className="flex items-baseline gap-1.5 shrink-0 no-tap-highlight"
            aria-label="Home"
          >
            <img
              src="/branding/logo-master.png"
              alt=""
              className="h-10 md:h-12 w-auto object-contain"
              loading="eager"
            />
            <span className="font-extrabold text-[20px] md:text-[24px] tracking-tight text-[color:var(--color-myntra-pink)] leading-none">
              Trésor
            </span>
            <span className="hidden sm:inline text-[10px] md:text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--color-myntra-ink-soft)] leading-none">
              couture
            </span>
          </button>

          {/* Desktop mega-menu */}
          <nav className="hidden lg:flex items-stretch gap-1 h-full">
            {NAV.map(n => {
              const isActive =
                (n.category && activeCat === n.category) ||
                (n.label === 'Sale' && route.name === 'shop' && !activeCat);
              return (
                <div
                  key={n.label}
                  className="relative h-full"
                  onMouseEnter={() => setHoverCat(n.label)}
                  onMouseLeave={() => setHoverCat(null)}
                >
                  <button
                    onClick={() => n.category ? goShop(n.category) : goShop()}
                    className={`h-full px-3 xl:px-4 flex items-center text-[12px] xl:text-[13px] font-bold uppercase tracking-[0.04em] transition-colors no-tap-highlight border-b-[3px] ${
                      isActive ? 'border-[color:var(--color-myntra-pink)] text-[color:var(--color-myntra-pink)]'
                        : n.tone === 'sale'
                          ? 'border-transparent text-[color:var(--color-myntra-pink)] hover:text-[color:var(--color-myntra-pink-dark)]'
                          : 'border-transparent text-[color:var(--color-myntra-navy)] hover:text-[color:var(--color-myntra-pink)]'
                    }`}
                  >
                    {n.label}
                  </button>
                  {hoverCat === n.label && megaPanel(n.label)}
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
              placeholder="Search for fabrics, weaves, brands and more"
              className="input-search"
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
            <button className="hidden md:flex flex-col items-center px-3 py-1 group" aria-label="Profile">
              <User className="w-5 h-5 text-[color:var(--color-myntra-navy)] group-hover:text-[color:var(--color-myntra-pink)]" />
              <span className="text-[10px] font-bold mt-0.5">Profile</span>
            </button>
            <button className="hidden md:flex flex-col items-center px-3 py-1 group relative" aria-label="Wishlist">
              <Heart className="w-5 h-5 text-[color:var(--color-myntra-navy)] group-hover:text-[color:var(--color-myntra-pink)]" />
              <span className="text-[10px] font-bold mt-0.5">Wishlist</span>
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

      {/* Sub-bar with quick filter chips on shop pages */}
      {route.name === 'shop' && (
        <div className="fixed top-[88px] md:top-[100px] left-0 w-full z-40 bg-white border-b border-[color:var(--color-myntra-border-soft)]">
          <div className="max-w-[1400px] mx-auto px-4 md:px-8 lg:px-10 py-2 flex gap-2 overflow-x-auto scrollbar-none">
            <button onClick={() => goShop()} className={`chip ${!activeCat ? 'chip-active' : ''}`}>All</button>
            {CATEGORIES.map(c => (
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
