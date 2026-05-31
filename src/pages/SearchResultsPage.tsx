import React, { useEffect, useMemo, useState } from 'react';
import ProductCard from '../components/ProductCard';
import { productsApi } from '../lib/firebase';
import { useRouter } from '../context/RouterContext';
import type { Fabric } from '../types';

interface Props {
  q: string;
}

const RECENT_KEY = 'tresor:search:recent';
const RECENT_MAX = 5;

const readRecent = (): string[] => {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
};

const writeRecent = (list: string[]) => {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
  } catch {
    /* localStorage unavailable (private mode / quota) — silently no-op */
  }
};

const matches = (fabric: Fabric, needle: string): boolean => {
  const n = needle.toLowerCase();
  if (fabric.name?.toLowerCase().includes(n)) return true;
  if (fabric.description?.toLowerCase().includes(n)) return true;
  if (fabric.masterCategory?.toLowerCase().includes(n)) return true;
  if (fabric.category?.toLowerCase().includes(n)) return true;
  if (fabric.subCategory?.toLowerCase().includes(n)) return true;
  if (Array.isArray(fabric.tags) && fabric.tags.some(t => t?.toLowerCase().includes(n))) return true;
  return false;
};

const SuggestionChip: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="px-3 py-1.5 rounded-full border border-[color:var(--color-myntra-border-soft)] text-[12px] text-[color:var(--color-myntra-ink)] hover:border-[color:var(--color-myntra-pink)] hover:text-[color:var(--color-myntra-pink)] transition-colors"
  >
    {label}
  </button>
);

const SkeletonCard: React.FC = () => (
  <div className="animate-pulse">
    <div className="aspect-[3/4] bg-[color:var(--color-myntra-bg-soft)] rounded" />
    <div className="px-2.5 pt-2.5 pb-3 space-y-2">
      <div className="h-3 w-2/3 bg-[color:var(--color-myntra-bg-soft)] rounded" />
      <div className="h-3 w-1/2 bg-[color:var(--color-myntra-bg-soft)] rounded" />
      <div className="h-3 w-1/3 bg-[color:var(--color-myntra-bg-soft)] rounded" />
    </div>
  </div>
);

const SearchResultsPage: React.FC<Props> = ({ q }) => {
  const { navigate } = useRouter();
  const [products, setProducts] = useState<Fabric[] | null>(null);
  const [recent, setRecent] = useState<string[]>(() => readRecent());

  // Push current q into the recent-searches stack on mount/change. We dedupe
  // case-insensitively but preserve the most recent casing the user typed.
  useEffect(() => {
    if (!q) return;
    setRecent(prev => {
      const filtered = prev.filter(s => s.toLowerCase() !== q.toLowerCase());
      const next = [q, ...filtered].slice(0, RECENT_MAX);
      writeRecent(next);
      return next;
    });
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    setProducts(null);
    (async () => {
      try {
        const rows = await productsApi.list({ limit: 200 });
        if (!cancelled) setProducts(rows as unknown as Fabric[]);
      } catch {
        if (!cancelled) setProducts([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const results = useMemo(() => {
    if (!products) return [];
    return products.filter(p => matches(p, q));
  }, [products, q]);

  const loading = products === null;

  return (
    <main className="pt-[100px] md:pt-[112px] pb-12 md:pb-16 bg-white min-h-screen">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 lg:px-10">
        <header className="mb-4">
          <h1 className="font-serif text-2xl md:text-3xl text-[color:var(--color-myntra-navy)]">
            Search results for "{q}"
          </h1>
          {!loading && (
            <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] mt-1">
              {results.length} {results.length === 1 ? 'fabric' : 'fabrics'} matched
            </p>
          )}
        </header>

        {/* Exclude the active query — showing it as a "Recent" chip is a dead
            control (clicking re-navigates to the page you're already on). */}
        {recent.filter(t => t.toLowerCase() !== q.toLowerCase()).length > 0 && (
          <div className="mb-6 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] uppercase tracking-[0.1em] text-[color:var(--color-myntra-ink-mute)] font-semibold">
              Recent
            </span>
            {recent.filter(t => t.toLowerCase() !== q.toLowerCase()).map(term => (
              <SuggestionChip
                key={term}
                label={term}
                onClick={() => navigate({ name: 'search', q: term })}
              />
            ))}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : results.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-[16px] text-[color:var(--color-myntra-ink)] mb-4">
              No fabrics match "{q}"
            </p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <SuggestionChip label="Sarees" onClick={() => navigate({ name: 'shop', category: 'Sarees' })} />
              <SuggestionChip label="Lehenga Cholis" onClick={() => navigate({ name: 'shop', category: 'Lehenga Cholis' })} />
              <SuggestionChip label="Studios Prêt" onClick={() => navigate({ name: 'shop', category: 'Studios Prêt' })} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
            {results.map(f => <ProductCard key={f.id} fabric={f} />)}
          </div>
        )}
      </div>
    </main>
  );
};

export default SearchResultsPage;
