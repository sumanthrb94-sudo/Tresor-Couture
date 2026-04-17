import React from 'react';
import { motion } from 'motion/react';
import { COLLECTIONS } from '../constants';
import { ArrowRight } from 'lucide-react';

const CollectionSection = () => {
  return (
    <section id="collections" className="py-32 bg-brand-bg border-t border-brand-border">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="flex flex-col md:flex-row justify-between items-end mb-20 gap-8">
          <div className="max-w-2xl">
            <span className="text-brand-gold text-[9px] uppercase tracking-[0.4em] mb-6 block font-bold">
              Collections
            </span>
            <h2 className="text-4xl md:text-6xl font-serif leading-tight">
              A Symphony of <span className="italic">Texture</span> & Balance
            </h2>
          </div>
          <div className="flex gap-4">
            <button className="text-[10px] uppercase tracking-widest font-bold flex items-center gap-2 group border-b border-brand-ink/20 pb-2 hover:border-brand-gold transition-all duration-500">
              View Catalogues <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-brand-border border border-brand-border overflow-hidden">
          {COLLECTIONS.map((collection, index) => (
            <motion.div 
              key={collection.id}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: index * 0.2 }}
              viewport={{ once: true }}
              className="bg-brand-bg group cursor-pointer p-12 hover:bg-brand-accent/20 transition-all duration-700"
            >
              <div className="relative aspect-[16/9] overflow-hidden mb-10 shadow-sm border border-brand-border p-2 bg-white">
                <img 
                  src={collection.coverImage} 
                  alt={collection.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover grayscale brightness-95 group-hover:grayscale-0 group-hover:scale-105 transition-all duration-1000"
                />
              </div>
              
              <div className="flex justify-between items-end">
                <div>
                  <h3 className="text-3xl font-serif mb-3 italic group-hover:not-italic transition-all">{collection.name}</h3>
                  <p className="text-[10px] font-bold text-brand-gold uppercase tracking-[0.2em]">{collection.subtitle}</p>
                </div>
                <div className="group-hover:translate-x-2 transition-transform duration-500 text-brand-ink/20 group-hover:text-brand-gold">
                  <ArrowRight className="w-10 h-10" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CollectionSection;
