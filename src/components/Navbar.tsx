import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, ShoppingBag, Search, User } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useRouter } from '../context/RouterContext';
import { Route } from '../types';

const navLinks: { name: string; route: Route }[] = [
  { name: 'Shop', route: { name: 'shop' } },
  { name: 'Collections', route: { name: 'home' } },
  { name: 'About', route: { name: 'home' } },
  { name: 'Contact', route: { name: 'home' } }
];

const Navbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { meterCount } = useCart();
  const { navigate, route } = useRouter();

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : original;
    return () => { document.body.style.overflow = original; };
  }, [isMobileMenuOpen]);

  const cartBadge = Math.min(meterCount, 99);
  const isShop = route.name === 'shop' || route.name === 'product';

  const linkClass = (active = false) =>
    `font-sans text-[14px] uppercase tracking-[0.15em] font-medium transition-colors duration-300 ${
      active ? 'text-brand-gold' : 'text-brand-ink-soft hover:text-brand-gold'
    }`;

  const mobileMenu = (
    <AnimatePresence>
      {isMobileMenuOpen && (
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: 0 }}
          exit={{ x: '-100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          style={{ backgroundColor: '#FFF8F5', color: '#1E1B18' }}
          className="fixed inset-0 z-[200] flex flex-col p-10 overflow-y-auto"
        >
          <div className="flex items-center justify-between mb-12">
            <button
              onClick={() => { setIsMobileMenuOpen(false); navigate({ name: 'home' }); }}
              className="brand-logotype text-3xl text-brand-gold"
            >
              Tresor Couture
            </button>
            <button onClick={() => setIsMobileMenuOpen(false)} aria-label="Close menu">
              <X className="w-7 h-7" />
            </button>
          </div>

          <div className="flex flex-col gap-7">
            {navLinks.map(link => (
              <button
                key={link.name}
                onClick={() => { setIsMobileMenuOpen(false); navigate(link.route); }}
                className="text-3xl font-serif text-left hover:text-brand-gold transition-colors"
              >
                {link.name}
              </button>
            ))}
            <button
              onClick={() => { setIsMobileMenuOpen(false); navigate({ name: 'cart' }); }}
              className="text-3xl font-serif text-left hover:text-brand-gold transition-colors"
            >
              Bag ({cartBadge})
            </button>
          </div>

          <div className="mt-auto pt-12 border-t border-brand-outline/40 flex flex-col gap-3 text-[11px] uppercase tracking-[0.15em] text-brand-ink-soft">
            <p>India · Global Shipping</p>
            <p>concierge@tresorcouture.com</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <header
        className="fixed top-0 left-0 w-full z-50 h-16 md:h-20 flex items-center border-b border-brand-outline/30 transition-all duration-200"
        style={{ backgroundColor: 'rgba(255, 248, 245, 0.85)', backdropFilter: 'blur(14px)' }}
      >
        <div className="w-full max-w-[1280px] mx-auto px-5 md:px-16 flex items-center justify-between">
          {/* Brand */}
          <button
            onClick={() => navigate({ name: 'home' })}
            className="brand-logotype text-[19px] md:text-[28px] text-brand-gold hover:opacity-70 transition-opacity whitespace-nowrap"
          >
            Tresor Couture
          </button>

          {/* Center nav */}
          <nav className="hidden md:flex gap-8">
            <button onClick={() => navigate({ name: 'shop' })} className={linkClass(isShop)}>
              Shop
            </button>
            <button onClick={() => navigate({ name: 'home' })} className={linkClass()}>
              Collections
            </button>
            <button onClick={() => navigate({ name: 'home' })} className={linkClass()}>
              About
            </button>
            <button onClick={() => navigate({ name: 'home' })} className={linkClass()}>
              Contact
            </button>
          </nav>

          {/* Right */}
          <div className="flex gap-4 items-center">
            <button
              className="md:hidden text-brand-ink"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            <button
              onClick={() => navigate({ name: 'shop' })}
              className="hidden md:block text-brand-gold hover:opacity-70 transition-opacity"
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </button>
            <button
              className="hidden md:block text-brand-gold hover:opacity-70 transition-opacity"
              aria-label="Account"
            >
              <User className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate({ name: 'cart' })}
              className={`text-brand-gold hover:opacity-70 transition-opacity relative ${
                route.name === 'cart' ? 'border-b border-brand-gold pb-1' : ''
              }`}
              aria-label="Bag"
            >
              <ShoppingBag className="w-5 h-5" />
              {cartBadge > 0 && (
                <span className="absolute -top-1 -right-2 bg-brand-gold text-brand-bg text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {cartBadge}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {typeof document !== 'undefined' && createPortal(mobileMenu, document.body)}
    </>
  );
};

export default Navbar;
