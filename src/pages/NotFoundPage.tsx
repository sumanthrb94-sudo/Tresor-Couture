import React from 'react';
import { Home, Search } from 'lucide-react';
import { useRouter } from '../context/RouterContext';

const NotFoundPage: React.FC = () => {
  const { navigate } = useRouter();
  return (
    <main className="pt-[120px] min-h-screen bg-[#FBF7EE] flex items-center justify-center px-5 md:px-10">
      <div className="max-w-[560px] text-center py-16">
        <p className="font-serif text-[88px] md:text-[120px] leading-none text-[#C5A059] mb-4">404</p>
        <h1 className="font-serif text-[26px] md:text-[34px] text-[#2A1F12] leading-tight mb-3">
          That page is off the loom.
        </h1>
        <p className="text-[14px] md:text-[15px] text-[#5D4E36] leading-relaxed mb-8">
          The thread you followed didn't lead anywhere — it may have been moved or never existed.
          The atelier is open; let's get you back to something beautiful.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate({ name: 'home' })}
            className="px-6 py-3 bg-[color:var(--color-myntra-navy)] text-white text-[12px] font-bold uppercase tracking-[0.14em] rounded inline-flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" /> Back to storefront
          </button>
          <button
            onClick={() => navigate({ name: 'shop' })}
            className="px-6 py-3 border-2 border-[#2A1F12] text-[#2A1F12] text-[12px] font-bold uppercase tracking-[0.14em] rounded inline-flex items-center justify-center gap-2"
          >
            <Search className="w-4 h-4" /> Browse all categories
          </button>
        </div>
      </div>
    </main>
  );
};

export default NotFoundPage;
