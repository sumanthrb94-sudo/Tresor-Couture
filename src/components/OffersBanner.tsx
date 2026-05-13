import React from 'react';
import { Sparkles, Truck, ShieldCheck, RotateCcw } from 'lucide-react';

const items = [
  { Icon: Truck, title: 'Free Shipping', sub: 'On orders over ₹1,999' },
  { Icon: ShieldCheck, title: 'Authenticity Card', sub: 'Signed by the weaver' },
  { Icon: RotateCcw, title: '30-Day Returns', sub: 'No questions asked' },
  { Icon: Sparkles, title: 'Hand-Cut to Order', sub: 'Per meter, dispatched in 48h' }
];

const OffersBanner: React.FC = () => (
  <section className="py-6 md:py-8 border-y border-[color:var(--color-myntra-border-soft)] bg-white">
    <div className="max-w-[1400px] mx-auto px-4 md:px-8 lg:px-10 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
      {items.map(({ Icon, title, sub }) => (
        <div key={title} className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-[color:var(--color-myntra-bg-soft)] flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-[color:var(--color-myntra-pink)]" />
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-bold leading-tight">{title}</p>
            <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] leading-tight">{sub}</p>
          </div>
        </div>
      ))}
    </div>
  </section>
);

export default OffersBanner;
