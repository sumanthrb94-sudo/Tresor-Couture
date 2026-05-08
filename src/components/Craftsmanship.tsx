import React from 'react';
import { motion } from 'motion/react';

const STATS = [
  { value: '12', label: 'Endangered weaves rescued' },
  { value: '47', label: 'Master weavers underwritten' },
  { value: '9', label: 'Indian states represented' },
  { value: '300', label: 'Thread-count Dhakai muslin' }
];

const Craftsmanship = () => {
  return (
    <section id="craft" className="py-20 md:py-[120px] px-5 md:px-16 max-w-[1280px] mx-auto">
      <div className="text-center max-w-2xl mx-auto mb-12 md:mb-16">
        <span className="text-[11px] uppercase tracking-[0.15em] font-semibold text-brand-gold mb-3 block">
          Quality Above All
        </span>
        <h2 className="font-serif text-[40px] md:text-5xl lg:text-[64px] gold-text leading-[1.1] tracking-[-0.02em] mb-5 md:mb-6">
          The Art of the <em>Perfect Thread</em>
        </h2>
        <p className="text-base text-brand-ink-soft leading-relaxed">
          From the silk farms of Assam to the finest spinning mills in Italy, our sourcing
          is a journey of uncompromising quality. Every material is tested for drape,
          durability, and depth of colour.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-brand-outline/30 border border-brand-outline/30">
        {STATS.map((s, idx) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: idx * 0.1 }}
            viewport={{ once: true }}
            className="bg-brand-bg p-6 md:p-10 text-center"
          >
            <p className="font-serif text-[44px] md:text-[64px] gold-text leading-none mb-2 md:mb-3">{s.value}</p>
            <p className="text-[10px] md:text-[11px] uppercase tracking-[0.15em] font-semibold text-brand-ink-soft">
              {s.label}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

export default Craftsmanship;
