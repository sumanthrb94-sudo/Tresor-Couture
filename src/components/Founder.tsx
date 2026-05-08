import React from 'react';
import { motion } from 'motion/react';

const Founder = () => {
  return (
    <section
      id="founder"
      className="py-20 md:py-[120px] px-5 md:px-16 max-w-[1280px] mx-auto bg-brand-bg-soft border-y border-brand-outline/30"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.2 }}
          viewport={{ once: true }}
          className="aspect-[4/5] flex items-center justify-center"
        >
          <img
            src="/branding/monogram-master.png"
            alt="Trésor Couture"
            loading="eager"
            className="max-h-full max-w-full object-contain"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 40 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, delay: 0.3 }}
          viewport={{ once: true }}
        >
          <span className="text-[11px] uppercase tracking-[0.15em] font-semibold text-brand-gold mb-6 block">
            The Rescue Mission
          </span>
          <h2 className="font-serif text-[32px] md:text-4xl lg:text-5xl gold-text leading-tight tracking-[-0.01em] mb-6 md:mb-8">
            Hand-woven by the last <em>four families</em> on earth.
          </h2>
          <div className="space-y-5 text-base text-brand-ink-soft leading-relaxed">
            <p>
              Trésor Couture began with a single visit to Mandvi, where we met the four remaining
              families weaving Mashru silk-satin on traditional pit looms. Their daughters had no
              interest in the loom; the craft was on the brink of vanishing within a generation.
            </p>
            <p>
              Today we underwrite weavers across nine Indian states — Banaras, Patan, Kanchipuram,
              Srikalahasti, Kutch, Ladakh, Bhagalpur, Chanderi and West Bengal — paying fair-trade
              rates and reserving every metre of their output for our atelier and chosen designers.
            </p>
            <p className="font-serif italic text-lg text-brand-ink">
              — Meera Rajput, Founder
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Founder;
