import React from 'react';
import { Zap, MapPin, ArrowRight } from 'lucide-react';
import { useRouter } from '../context/RouterContext';

/**
 * Top-of-home single-line ribbon promoting the radical Zepto-style
 * 40-minute Hyderabad delivery on designer wear. Sits between the
 * sticky navbar and the editorial hero so it's the first promise a
 * shopper sees once the page is parsed.
 */
const HyderabadDeliveryStrip: React.FC = () => {
  const { navigate } = useRouter();
  return (
    <button
      onClick={() => navigate({ name: 'shop', category: 'Studios Prêt' })}
      className="group w-full mt-[88px] md:mt-[100px] bg-gradient-to-r from-[#1A1209] via-[#2A1F12] to-[#1A1209] text-white relative overflow-hidden"
      aria-label="Shop designer wear with 40-minute Hyderabad delivery"
    >
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 lg:px-10 py-2.5 md:py-3 flex items-center justify-center gap-2.5 md:gap-4 text-[12px] md:text-[14px]">
        {/* Pulsing radar dot */}
        <span className="hidden sm:flex relative h-2 w-2 shrink-0" aria-hidden>
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E5C97A] opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#E5C97A]" />
        </span>
        <Zap className="w-4 h-4 md:w-[18px] md:h-[18px] text-[#E5C97A] shrink-0" strokeWidth={2.5} />
        <p className="whitespace-nowrap overflow-hidden text-ellipsis">
          <span className="font-bold uppercase tracking-[0.16em] text-[#E5C97A]">Hyderabad exclusive</span>
          <span className="mx-2 text-[#8A7656]">·</span>
          <span className="font-serif italic text-[14px] md:text-[16px] text-white">Designer wear at your door in 40 minutes</span>
        </p>
        <span className="hidden md:inline-flex items-center gap-1 text-[#E5C97A] text-[11px] font-bold uppercase tracking-[0.18em] shrink-0 group-hover:translate-x-1 transition-transform">
          <MapPin className="w-3.5 h-3.5" /> Shop Studios Prêt <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </button>
  );
};

export default HyderabadDeliveryStrip;
