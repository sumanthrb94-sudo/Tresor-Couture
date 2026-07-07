import React from 'react';
import { Truck, Zap, MapPin } from 'lucide-react';

/**
 * Two-promise campaign banner. The Hyderabad same-day card is the headline
 * (gold field, lightning glyph, pulsing radar dot); free shipping is the
 * supporting card so shoppers outside the city still see a clear promise.
 *
 * NOTE: 40-minute delivery is NOT advertised until the dark store + last-mile
 * contract are operational. See docs/DELIVERY-OPS.md.
 */
const OffersBanner: React.FC = () => (
  <section className="py-6 md:py-9 bg-white">
    <div className="max-w-[1400px] mx-auto px-4 md:px-8 lg:px-10 grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-4 md:gap-5">
      {/* HEADLINE — Hyderabad same-day */}
      <div className="relative overflow-hidden rounded-md bg-gradient-to-br from-[#2A1F12] via-[#46382A] to-[#1A1209] text-white px-5 pb-5 pt-12 md:p-7 flex items-center gap-5">
        <span className="absolute top-4 right-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#E0BFA0]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E5C97A] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#E5C97A]" />
          </span>
          Live · Hyderabad
        </span>
        <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-[#E5C97A] to-[#B8915A] flex items-center justify-center shrink-0 shadow-[0_0_24px_rgba(229,201,122,0.45)]">
          <Zap className="w-7 h-7 md:w-8 md:h-8 text-[#2A1F12]" strokeWidth={2.5} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#E5C97A] mb-1.5">Express delivery</p>
          <h3 className="font-serif text-[22px] md:text-[28px] leading-[1.1] mb-1.5">
            Same-day delivery <span className="hidden sm:inline">·</span><br className="sm:hidden" /> across Hyderabad.
          </h3>
          <p className="text-[12px] md:text-[13px] text-white/75 leading-snug flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#E5C97A] shrink-0" />
            Studios Prêt · curated designer pieces at the city studio.
          </p>
        </div>
      </div>

      {/* SUPPORT — Free shipping */}
      <div className="rounded-md border border-[#E8DCC4] bg-[#FBF7EE] p-5 md:p-7 flex items-center gap-4">
        <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-white flex items-center justify-center shrink-0">
          <Truck className="w-6 h-6 md:w-7 md:h-7 text-[color:var(--color-myntra-pink)]" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--color-myntra-pink)] mb-1">Pan-India</p>
          <h3 className="font-serif text-[20px] md:text-[24px] leading-tight text-[#2A1F12] mb-0.5">Free shipping over ₹1,999.</h3>
          <p className="text-[12px] md:text-[13px] text-[#5D4E36] leading-snug">Dispatched within 48 hours · easy returns.</p>
        </div>
      </div>
    </div>
  </section>
);

export default OffersBanner;
