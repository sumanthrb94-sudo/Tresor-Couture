import React from 'react';
import { motion } from 'motion/react';
import { FABRICS } from '../constants';

const Craftsmanship = () => {
  return (
    <section id="craft" className="py-32 bg-brand-accent/30 border-t border-brand-border">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <span className="text-brand-gold text-[9px] uppercase tracking-[0.4em] mb-6 block font-bold">
            Quality Above All
          </span>
          <h2 className="text-4xl md:text-6xl font-serif mb-8 leading-tight italic">The Art of the <span className="not-italic">Perfect Thread</span></h2>
          <p className="text-brand-ink/60 font-light leading-relaxed">
            From the silk farms of Assam to the finest spinning mills in Italy, our sourcing is a journey 
            of uncompromising quality. Every material is tested for drape, durability, and depth of color.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-brand-border border border-brand-border">
          {FABRICS.map((fabric, index) => (
            <motion.div 
              key={fabric.id}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="bg-brand-bg group relative p-6 hover:bg-brand-accent/40 transition-all duration-500"
            >
              <div className="aspect-[4/5] overflow-hidden mb-8 relative border border-brand-border p-1 bg-white shadow-sm">
                <img 
                  src={fabric.image} 
                  alt={fabric.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover grayscale brightness-95 group-hover:grayscale-0 group-hover:scale-110 transition-transform duration-[2000ms]"
                />
              </div>
              
              <div className="">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-serif leading-tight group-hover:italic transition-all">{fabric.name}</h3>
                </div>
                <div className="flex justify-between items-center mb-6">
                  <span className="text-[10px] text-brand-gold font-bold tracking-[0.2em] uppercase">
                    ₹{fabric.pricePerMeter} / m
                  </span>
                  <span className="text-[9px] text-brand-ink/30 uppercase tracking-[0.1em] font-medium italic">
                    {fabric.origin}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {fabric.tags.map(tag => (
                    <span key={tag} className="text-[8px] border border-brand-border px-2 py-0.5 uppercase tracking-widest text-brand-ink/40 font-bold">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Craftsmanship;
