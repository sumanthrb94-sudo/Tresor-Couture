import React, { useEffect, useState } from 'react';
import { Tag } from 'lucide-react';
import { useRouter } from '../context/RouterContext';
import { FABRICS } from '../constants';
import ProductCard from './ProductCard';

const useCountdown = (hoursAhead = 9) => {
  const [end] = useState(() => Date.now() + hoursAhead * 60 * 60 * 1000);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, end - now);
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return { h, m, s };
};

const Two: React.FC<{ n: number }> = ({ n }) => (
  <span className="inline-block w-8 text-center bg-[color:var(--color-myntra-navy)] text-white font-bold rounded">{String(n).padStart(2, '0')}</span>
);

const DealsStrip: React.FC = () => {
  const { h, m, s } = useCountdown();
  const { navigate } = useRouter();
  const deals = FABRICS.filter(f => f.mrpPerMeter - f.pricePerMeter > 1000).slice(0, 6);

  return (
    <section className="bg-[color:var(--color-myntra-bg-sale)] py-8 md:py-10">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 lg:px-10">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5 md:mb-6">
          <div>
            <span className="section-eyebrow flex items-center gap-2">
              <Tag className="w-4 h-4" /> Deals of the Day
            </span>
            <h2 className="text-2xl md:text-3xl font-extrabold mt-1">Hand-picked Heritage at Festival Prices</h2>
          </div>
          <div className="flex items-center gap-2 text-[12px] font-semibold text-[color:var(--color-myntra-ink)]">
            <span>Ends in</span>
            <Two n={h} /> <span className="font-bold">:</span> <Two n={m} /> <span className="font-bold">:</span> <Two n={s} />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
          {deals.map(f => <ProductCard key={f.id} fabric={f} />)}
        </div>

        <div className="text-center mt-7">
          <button onClick={() => navigate({ name: 'shop' })} className="btn-outline">
            View All Deals
          </button>
        </div>
      </div>
    </section>
  );
};

export default DealsStrip;
