import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, ShoppingBag, Search } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useRouter } from '../context/RouterContext';
import { Route } from '../types';

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { meterCount } = useCart();
  const { navigate } = useRouter();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks: { name: string; route: Route }[] = [
    { name: 'Shop', route: { name: 'shop' } },
    { name: 'Silk', route: { name: 'shop', category: 'Silk' } },
    { name: 'Cotton', route: { name: 'shop', category: 'Cotton' } },
    { name: 'Wool', route: { name: 'shop', category: 'Wool' } },
    { name: 'Linen', route: { name: 'shop', category: 'Linen' } }
  ];

  const cartBadge = Math.min(meterCount, 99);

  return (
    <nav
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-500 border-b border-brand-border h-[100px] flex items-center ${
        isScrolled ? 'bg-brand-bg/90 backdrop-blur-md' : 'bg-brand-bg'
      }`}
    >
      <div className="w-full px-6 md:px-[60px] h-full flex items-center justify-between text-brand-ink relative">
        <div className="flex-1 hidden md:flex gap-6 items-center text-[10px] uppercase tracking-[0.1em] font-bold">
          <button
            onClick={() => navigate({ name: 'shop' })}
            className="hover:text-brand-gold transition-colors whitespace-nowrap"
          >
            Shop
          </button>
          <button
            onClick={() => navigate({ name: 'shop', category: 'Silk' })}
            className="hover:text-brand-gold transition-colors whitespace-nowrap hidden lg:inline-block"
          >
            Silk
          </button>
          <button
            onClick={() => navigate({ name: 'shop', category: 'Cotton' })}
            className="hover:text-brand-gold transition-colors whitespace-nowrap hidden lg:inline-block"
          >
            Cotton
          </button>
          <button
            onClick={() => navigate({ name: 'shop', category: 'Wool' })}
            className="hover:text-brand-gold transition-colors whitespace-nowrap hidden xl:inline-block"
          >
            Wool
          </button>
          <button
            onClick={() => navigate({ name: 'home' })}
            className="hover:text-brand-gold transition-colors whitespace-nowrap hidden xl:inline-block"
          >
            Story
          </button>
        </div>

        <button
          className="md:hidden flex-1 flex justify-start"
          onClick={() => setIsMobileMenuOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6" />
        </button>

        <div className="flex-shrink-0 px-4">
          <button
            onClick={() => navigate({ name: 'home' })}
            className="text-lg md:text-2xl font-serif tracking-[0.2em] uppercase whitespace-nowrap"
          >
            Trésor <span className="italic">Couture</span>
          </button>
        </div>

        <div className="flex-1 flex justify-end gap-6 md:gap-8 items-center">
          <button
            onClick={() => navigate({ name: 'shop' })}
            className="hidden sm:block border border-brand-ink px-5 py-2 text-[9px] uppercase tracking-[0.1em] font-bold hover:bg-brand-ink hover:text-white transition-all whitespace-nowrap"
          >
            Shop Now
          </button>
          <div className="flex items-center gap-4 md:gap-6">
            <button
              onClick={() => navigate({ name: 'shop' })}
              className="hover:text-brand-gold transition-colors cursor-pointer"
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate({ name: 'cart' })}
              className="hover:text-brand-gold transition-colors cursor-pointer relative"
              aria-label="Cart"
            >
              <ShoppingBag className="w-5 h-5" />
              <span className="absolute -top-2 -right-2 bg-brand-gold text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center">
                {cartBadge}
              </span>
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 bg-brand-bg z-[60] flex flex-col p-12"
          >
            <button className="absolute top-8 right-8" onClick={() => setIsMobileMenuOpen(false)} aria-label="Close menu">
              <X className="w-8 h-8" />
            </button>

            <div className="flex flex-col gap-8 mt-20">
              {navLinks.map(link => (
                <button
                  key={link.name}
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    navigate(link.route);
                  }}
                  className="text-3xl font-serif italic hover:text-brand-gold transition-colors text-left"
                >
                  {link.name}
                </button>
              ))}
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  navigate({ name: 'cart' });
                }}
                className="text-3xl font-serif italic hover:text-brand-gold transition-colors text-left"
              >
                Cart ({cartBadge})
              </button>
            </div>

            <div className="mt-auto border-t border-brand-ink/10 pt-12 flex flex-col gap-4 text-xs uppercase tracking-widest opacity-60">
              <p>India - Global Shipping</p>
              <p>tresor@couture.com</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
