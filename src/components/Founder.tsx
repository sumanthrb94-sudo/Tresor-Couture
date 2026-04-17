import React from 'react';
import { motion } from 'motion/react';

const Founder = () => {
  return (
    <section id="founder" className="py-32 bg-brand-bg text-brand-ink overflow-hidden border-t border-brand-border">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div className="relative">
            <motion.div 
              initial={{ scale: 1.1, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1.5 }}
              viewport={{ once: true }}
              className="relative z-10 p-4 border border-brand-border bg-white"
            >
              <img 
                src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=1200" 
                alt="Founder of Trésor Couture"
                referrerPolicy="no-referrer"
                className="w-full aspect-[4/5] object-cover grayscale brightness-90 shadow-sm"
              />
            </motion.div>
            
            <div className="absolute -bottom-6 -right-6 bg-brand-gold p-8 z-20 hidden lg:block">
              <span className="vertical-text text-white text-[10px] tracking-[0.6em] font-medium uppercase rotate-180">
                Meera Rajput
              </span>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 0.3 }}
            viewport={{ once: true }}
          >
            <span className="text-brand-gold text-[9px] uppercase tracking-[0.4em] mb-6 block font-bold italic">
              The Rescue Mission
            </span>
            <h2 className="text-4xl md:text-6xl font-serif leading-tight mb-8">
              Restoring the <br />
              <span className="italic">Lost Weaves of India</span>
            </h2>
            
            <div className="space-y-6 text-brand-ink/60 font-light leading-relaxed">
              <p>
                Led by <span className="text-brand-ink font-normal italic">Meera Rajput</span>, Trésor Couture 
                is not just a brand, but a rescue initiative. We identify weaving techniques that are down to their 
                last three or four practitioners across India.
              </p>
              <p>
                "Our goal is to pull these arts back from the edge of extinction," Meera says. From the complex double-ikkat 
                of Patan to the translucent Muslins of Bengal, we provide the infrastructure, fair wages, and international 
                exposure that these masters of the loom deserve.
              </p>
              <p className="italic font-medium border-l-2 border-brand-gold pl-6 py-2">
                "When a weave goes extinct, we don't just lose a fabric; we lose a piece of the human story."
              </p>
            </div>

            <div className="mt-12 flex flex-col md:flex-row items-start md:items-center gap-8 border-t border-brand-border pt-12">
              <div className="flex flex-col">
                <span className="text-3xl font-serif text-brand-gold">15+</span>
                <span className="text-[10px] uppercase tracking-widest text-brand-ink/40 font-bold">Artisanal Communities</span>
              </div>
              <div className="hidden md:block w-[1px] h-12 bg-brand-border" />
              <div className="flex flex-col">
                <span className="text-3xl font-serif text-brand-gold">5000+</span>
                <span className="text-[10px] uppercase tracking-widest text-brand-ink/40 font-bold">Exclusive Weaves</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Founder;
