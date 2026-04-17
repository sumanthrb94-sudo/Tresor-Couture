import React from 'react';
import { motion } from 'motion/react';
import { COLLECTIONS } from '../constants';
import { ArrowRight } from 'lucide-react';

const Hero = () => {
  return (
    <section className="relative min-h-[90vh] lg:h-screen lg:min-h-[700px] w-full overflow-hidden bg-brand-bg pt-[100px]">
      <div className="geometric-grid h-full min-h-[600px] lg:h-[calc(100vh-100px)]">
        {/* Left Pane - Vision */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="side-pane pane-border-r hidden lg:flex flex-col justify-center px-12 pb-20"
        >
          <span className="text-[9px] uppercase tracking-[0.2em] text-brand-gold font-bold mb-8">
            Rescue Initiative
          </span>
          <h1 className="text-4xl font-serif italic mb-6 leading-tight">
            Preserving India's <span className="not-italic">Dying Looms</span>
          </h1>
          <p className="text-sm text-brand-ink/60 leading-relaxed mb-10 max-w-xs">
            We identify, document, and restore Indian weaving techniques on the brink of extinction. Every thread purchased is a direct contribution to preserving our human heritage.
          </p>
          <div className="mt-auto">
            <span className="text-[9px] uppercase tracking-[0.2em] text-brand-gold font-bold italic">
              Legacy Restoration Since 2012
            </span>
          </div>
        </motion.div>

        {/* Center Stage - Visual */}
        <div className="center-stage bg-brand-accent flex items-center justify-center overflow-hidden h-full p-6 lg:p-0">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.2 }}
            className="relative w-full max-w-lg lg:w-4/5 lg:h-4/5 aspect-[4/5] lg:aspect-auto shadow-2xl overflow-hidden group border border-brand-border p-1 bg-white"
          >
            <img 
              src="https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&q=80&w=1200" 
              alt="Fabric Texture"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-[2000ms]"
            />
            <div className="absolute inset-0 bg-black/10" />
            
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center px-6">
              <span className="text-[9px] uppercase tracking-[0.5em] mb-4 font-medium opacity-80">Selected Weave</span>
              <h2 className="text-4xl md:text-6xl font-serif drop-shadow-lg">Varanasi <span className="italic">Gold</span></h2>
              
              {/* Visible only on mobile/tablet to ensure message is seen */}
              <div className="lg:hidden mt-8 max-w-xs">
                <p className="text-[11px] uppercase tracking-widest leading-relaxed opacity-90 font-medium">
                  Centuries of Indian weaving traditions.
                </p>
                <button className="mt-8 px-8 py-3 border border-white text-[10px] uppercase tracking-widest hover:bg-white hover:text-black transition-all">
                  Inaugural Collection
                </button>
              </div>
            </div>

            <motion.div 
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: -20, opacity: 1 }}
              transition={{ delay: 1, duration: 0.8 }}
              className="absolute bottom-6 left-6 lg:bottom-10 lg:left-0 bg-brand-bg px-6 py-4 lg:px-10 lg:py-6 border border-brand-border font-serif italic text-xs lg:text-sm shadow-xl z-10 max-w-[180px] lg:max-w-none"
            >
              "Textiles are the soul of the home."
            </motion.div>
          </motion.div>
        </div>

        {/* Right Pane - Catalogues */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="side-pane pane-border-l hidden lg:flex flex-col justify-center px-12"
        >
          <span className="text-[9px] uppercase tracking-[0.2em] text-brand-gold font-bold mb-8">
            Catalogues
          </span>
          <ul className="space-y-0">
            {COLLECTIONS.map((collection) => (
              <li key={collection.id} className="group border-b border-brand-border py-6 flex justify-between items-center cursor-pointer hover:bg-brand-accent/30 transition-all">
                <span className="font-serif text-lg group-hover:italic transition-all">{collection.name}</span>
                <span className="text-[10px] uppercase opacity-40 group-hover:opacity-100 group-hover:text-brand-gold transition-all">Explore</span>
              </li>
            ))}
            <li className="group border-b border-brand-border py-6 flex justify-between items-center cursor-pointer hover:bg-brand-accent/30 transition-all">
              <span className="font-serif text-lg group-hover:italic transition-all font-medium">Bespoke Couture</span>
              <span className="text-[10px] uppercase opacity-40 group-hover:opacity-100 group-hover:text-brand-gold transition-all">Explore</span>
            </li>
          </ul>
          <p className="text-[11px] text-brand-ink/40 mt-12 leading-relaxed italic">
            Shipping premium fabrics across New Delhi, Mumbai, and International hubs.
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
