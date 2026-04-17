import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, ShoppingBag, Search } from 'lucide-react';

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Collections', href: '#collections' },
    { name: 'Craftsmanship', href: '#craft' },
    { name: 'The Story', href: '#founder' },
    { name: 'Contact', href: '#contact' },
  ];

  return (
    <nav 
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-500 border-b border-brand-border h-[100px] flex items-center ${
        isScrolled ? 'bg-brand-bg/90 backdrop-blur-md' : 'bg-brand-bg'
      }`}
    >
      <div className="w-full px-6 md:px-[60px] h-full flex items-center justify-between text-brand-ink relative">
        {/* Left Side (Flex-1) */}
        <div className="flex-1 hidden md:flex gap-8 items-center text-[10px] uppercase tracking-[0.1em] font-bold">
          <a href="#collections" className="hover:text-brand-gold transition-colors whitespace-nowrap">
            Collections
          </a>
          <a href="#craft" className="hover:text-brand-gold transition-colors whitespace-nowrap hidden xl:block">
            Craftsmanship
          </a>
        </div>

        {/* Mobile Menu Button - Left */}
        <button 
          className="md:hidden flex-1 flex justify-start"
          onClick={() => setIsMobileMenuOpen(true)}
        >
          <Menu className="w-6 h-6" />
        </button>

        {/* Logo - Centered (Shrink-0) */}
        <div className="flex-shrink-0 px-4">
          <a href="/" className="text-lg md:text-2xl font-serif tracking-[0.2em] uppercase whitespace-nowrap">
            Trésor <span className="italic">Couture</span>
          </a>
        </div>

        {/* Right Side (Flex-1) */}
        <div className="flex-1 flex justify-end gap-6 md:gap-8 items-center">
          <button className="hidden sm:block border border-brand-ink px-5 py-2 text-[9px] uppercase tracking-[0.1em] font-bold hover:bg-brand-ink hover:text-white transition-all whitespace-nowrap">
            Book Bespoke
          </button>
          <div className="flex items-center gap-4 md:gap-6">
            <button className="hover:text-brand-gold transition-colors cursor-pointer">
              <Search className="w-5 h-5" />
            </button>
            <button className="hover:text-brand-gold transition-colors cursor-pointer relative">
              <ShoppingBag className="w-5 h-5" />
              <span className="absolute -top-2 -right-2 bg-brand-gold text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center">
                0
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 bg-brand-bg z-[60] flex flex-col p-12"
          >
            <button 
              className="absolute top-8 right-8"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <X className="w-8 h-8" />
            </button>
            
            <div className="flex flex-col gap-12 mt-20">
              {navLinks.map((link) => (
                <a 
                  key={link.name} 
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-4xl font-serif italic hover:text-brand-gold transition-colors"
                >
                  {link.name}
                </a>
              ))}
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
