import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Filter, X } from 'lucide-react';
import {
  CATEGORIES,
  MASTER_CATEGORIES,
  MASTER_CATEGORY_TILES
} from '../constants';
import { subcategoriesFor } from '../lib/subcategories';
import { Fabric, MasterCategory } from '../types';
import ProductCard from '../components/ProductCard';
import { useRouter } from '../context/RouterContext';
import { useCatalog } from '../context/CatalogContext';
import { sellableFirst } from '../lib/availability';

type SortKey = 'recommended' | 'popularity' | 'price-asc' | 'price-desc' | 'rating' | 'newest';

interface Props {
  initialCategory?: string;
  initialSubCategory?: string;
}

const PRICE_BRACKETS = [
  { id: '0-2000', label: 'Under ₹2,000', min: 0, max: 2000 },
  { id: '2000-5000', label: '₹2,000 – ₹5,000', min: 2000, max: 5000 },
  { id: '5000-10000', label: '₹5,000 – ₹10,000', min: 5000, max: 10000 },
  { id: '10000-99999999', label: 'Over ₹10,000', min: 10000, max: Number.MAX_SAFE_INTEGER }
];

const isMasterCategory = (v: string | undefined): v is MasterCategory =>
  !!v && (MASTER_CATEGORIES as string[]).includes(v);

const Section: React.FC<{ title: string; defaultOpen?: boolean; children: React.ReactNode }> = ({ title, defaultOpen = true, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[color:var(--color-myntra-border-soft)] py-4">
      <button onClick={() => setOpen(o => !o)} className="w-full flex justify-between items-center mb-3">
        <span className="text-[12px] font-extrabold uppercase tracking-[0.1em] text-[color:var(--color-myntra-navy)]">{title}</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && <div className="space-y-2">{children}</div>}
    </div>
  );
};

const Checkbox: React.FC<{ checked: boolean; onChange: () => void; label: React.ReactNode }> = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-2 text-[13px] text-[color:var(--color-myntra-ink)] cursor-pointer hover:text-[color:var(--color-myntra-pink)]">
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="accent-[color:var(--color-myntra-pink)] w-4 h-4"
    />
    {label}
  </label>
);

const ShopPage: React.FC<Props> = ({ initialCategory, initialSubCategory }) => {
  const { navigate } = useRouter();

  const activeMaster: MasterCategory | null = isMasterCategory(initialCategory) ? initialCategory : null;
  const activeSub = initialSubCategory ?? '';

  // Legacy weave-type facet (Silk / Cotton / ...) — only meaningful inside Fabrics.
  const [weaveTypes, setWeaveTypes] = useState<Set<string>>(
    () => new Set(initialCategory && !isMasterCategory(initialCategory) && initialCategory !== 'All' ? [initialCategory] : [])
  );
  const [colors, setColors] = useState<Set<string>>(new Set());
  const [priceBrackets, setPriceBrackets] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortKey>('recommended');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Reset ALL facets when the category/subcategory changes. Previously only
  // weaveTypes reset, so a colour/origin/price chip that exists only in the
  // old category stayed selected after navigating elsewhere — leaving an active
  // chip the new category can't satisfy, hence a wrongly-empty grid.
  useEffect(() => {
    setWeaveTypes(new Set(initialCategory && !isMasterCategory(initialCategory) && initialCategory !== 'All' ? [initialCategory] : []));
    setColors(new Set());
    setPriceBrackets(new Set());
  }, [initialCategory, initialSubCategory]);

  // Lock body scroll while the mobile filter drawer is open (matches Navbar /
  // PaymentModal), so the product grid behind the overlay can't scroll away.
  useEffect(() => {
    document.body.style.overflow = mobileFiltersOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileFiltersOpen]);

  const { products: allProducts, loading, error: loadError, refresh } = useCatalog();

  const products = useMemo(() => {
    if (!activeMaster) return allProducts;
    return allProducts.filter(p => {
      if (p.masterCategory !== activeMaster) return false;
      if (activeSub && p.subCategory !== activeSub) return false;
      return true;
    });
  }, [allProducts, activeMaster, activeSub]);

  const allColors = useMemo(() => {
    const s = new Set<string>();
    (products ?? []).forEach(f => f.colors?.forEach(c => s.add(c.name)));
    return Array.from(s).sort();
  }, [products]);

  const toggleSet = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, v: string) =>
    setter(prev => {
      const n = new Set(prev);
      if (n.has(v)) n.delete(v); else n.add(v);
      return n;
    });

  const filtered = useMemo(() => {
    const source = products ?? [];
    let list: Fabric[] = source.filter(f => {
      if (weaveTypes.size > 0 && !weaveTypes.has(f.category)) return false;
      if (colors.size > 0 && !(f.colors ?? []).some(c => colors.has(c.name))) return false;
      if (priceBrackets.size > 0) {
        const ok = PRICE_BRACKETS.some(b => priceBrackets.has(b.id) && f.price >= b.min && f.price < b.max);
        if (!ok) return false;
      }
      return true;
    });

    switch (sort) {
      case 'price-asc': list = [...list].sort((a, b) => a.price - b.price); break;
      case 'price-desc': list = [...list].sort((a, b) => b.price - a.price); break;
      case 'rating': list = [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)); break;
      case 'popularity': list = [...list].sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0)); break;
      case 'newest': list = [...list].reverse(); break;
    }
    // Applied last, so it outranks every sort: nobody wants "price low to high"
    // to open on a row of pieces they cannot buy. Sold-out stays in the grid —
    // hiding it would collapse thin categories and 404 links already shared —
    // but always below what is in stock.
    return sellableFirst(list);
  }, [products, weaveTypes, colors, priceBrackets, sort]);

  const masterTile = activeMaster ? MASTER_CATEGORY_TILES.find(t => t.name === activeMaster) : null;
  const subOptions = activeMaster ? subcategoriesFor(activeMaster, products) : [];

  const headerTitle = activeMaster ?? 'All Products';
  const itemCountText = `${filtered.length} ${filtered.length === 1 ? 'item' : 'items'}`;

  const activeChips: { label: string; clear: () => void }[] = [];
  weaveTypes.forEach(c => activeChips.push({ label: c, clear: () => toggleSet(setWeaveTypes, c) }));
  colors.forEach(c => activeChips.push({ label: c, clear: () => toggleSet(setColors, c) }));
  priceBrackets.forEach(id => {
    const b = PRICE_BRACKETS.find(p => p.id === id);
    if (b) activeChips.push({ label: b.label, clear: () => toggleSet(setPriceBrackets, id) });
  });

  const clearAll = () => {
    setWeaveTypes(new Set());
    setColors(new Set());
    setPriceBrackets(new Set());
  };

  const selectMaster = (m: MasterCategory) => {
    clearAll();
    navigate({ name: 'shop', category: m });
  };

  const selectSub = (sub: string) => {
    if (!activeMaster) return;
    const next = activeSub === sub ? undefined : sub;
    navigate({ name: 'shop', category: activeMaster, subCategory: next });
  };

  // Weave-type facet only applies inside Fabrics / Dyeable Fabrics; outside those we hide it.
  const showWeaveFacet = !activeMaster || activeMaster === 'Fabrics' || activeMaster === 'Dyeable Fabrics';

  const Sidebar = (
    <aside className="text-[color:var(--color-myntra-navy)]">
      <div className="flex justify-between items-center pb-3 border-b border-[color:var(--color-myntra-border-soft)]">
        <span className="text-[14px] font-extrabold uppercase tracking-wider">Filters</span>
        {(activeChips.length > 0 || activeMaster || activeSub) && (
          <button
            onClick={() => { clearAll(); navigate({ name: 'shop' }); }}
            className="text-[12px] font-bold text-[color:var(--color-myntra-pink)]"
          >
            Clear All
          </button>
        )}
      </div>

      <Section title="Master Category">
        {MASTER_CATEGORIES.map(m => {
          const active = activeMaster === m;
          return (
            <button
              key={m}
              onClick={() => selectMaster(m)}
              className={`block w-full text-left text-[13px] py-1 ${active ? 'font-extrabold text-[color:var(--color-myntra-pink)]' : 'text-[color:var(--color-myntra-ink)] hover:text-[color:var(--color-myntra-pink)]'}`}
            >
              {m}
            </button>
          );
        })}
      </Section>

      {showWeaveFacet && (
        <Section title="Weave Type">
          {CATEGORIES.map(c => (
            <Checkbox key={c} checked={weaveTypes.has(c)} onChange={() => toggleSet(setWeaveTypes, c)} label={c} />
          ))}
        </Section>
      )}

      <Section title="Price">
        {PRICE_BRACKETS.map(b => (
          <Checkbox key={b.id} checked={priceBrackets.has(b.id)} onChange={() => toggleSet(setPriceBrackets, b.id)} label={b.label} />
        ))}
      </Section>

      <Section title="Colour" defaultOpen={false}>
        <div className="grid grid-cols-3 gap-2">
          {allColors.map(c => {
            const hex = (products ?? []).find(f => f.colors?.find(x => x.name === c))?.colors?.find(x => x.name === c)?.hex ?? '#ccc';
            const active = colors.has(c);
            return (
              <button
                key={c}
                onClick={() => toggleSet(setColors, c)}
                className={`flex flex-col items-center gap-1 p-1 rounded ${active ? 'ring-2 ring-[color:var(--color-myntra-pink)]' : ''}`}
                title={c}
              >
                <span className="swatch-dot" style={{ background: hex }} />
                <span className="text-[10px] truncate w-full text-center">{c}</span>
              </button>
            );
          })}
        </div>
      </Section>

    </aside>
  );

  return (
    <main className="pt-[100px] md:pt-[112px] pb-12 md:pb-16 bg-white min-h-screen">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 lg:px-10">
        {/* Breadcrumb */}
        <nav className="text-[12px] text-[color:var(--color-myntra-ink-soft)] mb-3">
          <button onClick={() => navigate({ name: 'home' })} className="hover:text-[color:var(--color-myntra-pink)]">Home</button>
          <span className="mx-1.5">/</span>
          {activeMaster ? (
            <button
              onClick={() => navigate({ name: 'shop', category: activeMaster })}
              className={`hover:text-[color:var(--color-myntra-pink)] ${!activeSub ? 'text-[color:var(--color-myntra-navy)] font-semibold' : ''}`}
            >
              {activeMaster}
            </button>
          ) : (
            <span className="text-[color:var(--color-myntra-navy)] font-semibold">All Products</span>
          )}
          {activeSub && (
            <>
              <span className="mx-1.5">/</span>
              <span className="text-[color:var(--color-myntra-navy)] font-semibold">{activeSub}</span>
            </>
          )}
        </nav>

        <div className="flex items-end justify-between mb-4 gap-4 flex-wrap">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-[color:var(--color-myntra-navy)]">
              {headerTitle}
              <span className="text-[14px] font-medium text-[color:var(--color-myntra-ink-mute)] ml-2">— {itemCountText}</span>
            </h1>
            {activeSub && (
              <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] mt-1">
                {activeSub} · {itemCountText}
              </p>
            )}
            {!activeSub && masterTile && (
              <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] mt-1">{masterTile.tagline}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileFiltersOpen(true)} className="lg:hidden inline-flex items-center gap-2 chip">
              <Filter className="w-4 h-4" /> Filters
            </button>
            <label className="inline-flex items-center gap-2 text-[12px] text-[color:var(--color-myntra-ink-soft)]">
              <span className="hidden sm:inline">Sort by:</span>
              <div className="relative">
                <select
                  value={sort}
                  onChange={e => setSort(e.target.value as SortKey)}
                  className="appearance-none border border-[color:var(--color-myntra-border)] rounded px-3 py-2 pr-8 text-[13px] font-semibold bg-white"
                >
                  <option value="recommended">Recommended</option>
                  <option value="popularity">Popularity</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="rating">Customer Rating</option>
                  <option value="newest">What's New</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </label>
          </div>
        </div>

        {/* Subcategory chip row */}
        {activeMaster && subOptions.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4 overflow-x-auto">
            {subOptions.map(sub => {
              const active = activeSub === sub;
              return (
                <button
                  key={sub}
                  onClick={() => selectSub(sub)}
                  className={
                    active
                      ? 'px-3 py-1.5 rounded-full text-[12px] font-bold bg-[color:var(--color-myntra-navy)] text-white border border-[color:var(--color-myntra-navy)]'
                      : 'px-3 py-1.5 rounded-full text-[12px] font-semibold bg-white text-[color:var(--color-myntra-navy)] border border-[color:var(--color-myntra-border)] hover:border-[color:var(--color-myntra-pink)] hover:text-[color:var(--color-myntra-pink)]'
                  }
                >
                  {sub}
                </button>
              );
            })}
          </div>
        )}

        {/* Active filter chips */}
        {activeChips.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {activeChips.map((c, i) => (
              <button key={i} onClick={c.clear} className="chip chip-active">
                {c.label} <X className="w-3 h-3" />
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] xl:grid-cols-[260px_1fr] gap-6 lg:gap-8">
          <div className="hidden lg:block">{Sidebar}</div>

          <div>
            {loadError && (
              <div className="mb-4 border border-[color:var(--color-myntra-pink)] bg-[color:var(--color-myntra-bg-soft)] rounded p-4 flex items-center justify-between gap-3 flex-wrap">
                <p className="text-[13px] text-[color:var(--color-myntra-navy)] font-semibold">
                  Couldn't fetch this section. {loadError}
                </p>
                <button
                  type="button"
                  onClick={refresh}
                  className="text-[13px] font-bold text-[color:var(--color-myntra-pink)] underline"
                >
                  Try again
                </button>
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="aspect-[3/4] bg-[color:var(--color-myntra-bg-soft)] rounded" />
                    <div className="mt-2 h-3 w-3/4 bg-[color:var(--color-myntra-bg-soft)] rounded" />
                    <div className="mt-1.5 h-3 w-1/2 bg-[color:var(--color-myntra-bg-soft)] rounded" />
                    <div className="mt-2 h-4 w-1/3 bg-[color:var(--color-myntra-bg-soft)] rounded" />
                  </div>
                ))}
              </div>
            ) : products.length === 0 && !loadError ? (
              <div className="border border-dashed border-[color:var(--color-myntra-border)] py-20 px-6 text-center bg-[color:var(--color-myntra-bg-soft)]">
                <p className="font-serif text-2xl md:text-3xl mb-2 text-[color:var(--color-myntra-navy)]">
                  Curated stock is on the loom
                </p>
                <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] mb-5">
                  Check back soon, or browse another atelier section.
                </p>
                <div className="flex gap-2 justify-center flex-wrap">
                  {MASTER_CATEGORIES.filter(m => m !== activeMaster).slice(0, 4).map(m => (
                    <button
                      key={m}
                      onClick={() => navigate({ name: 'shop', category: m })}
                      className="chip"
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="border border-[color:var(--color-myntra-border-soft)] py-20 px-6 text-center bg-[color:var(--color-myntra-bg-soft)]">
                <p className="font-serif text-2xl md:text-3xl mb-2 text-[color:var(--color-myntra-navy)]">
                  {activeMaster ? `${activeMaster} — curated stock is on the loom` : 'Curated stock is on the loom'}
                </p>
                {masterTile && (
                  <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] mb-5 italic">{masterTile.tagline}</p>
                )}
                {!masterTile && (
                  <p className="text-[14px] text-[color:var(--color-myntra-ink-soft)] mb-5">
                    Check back soon, or browse another section.
                  </p>
                )}
                <div className="flex gap-2 justify-center flex-wrap mb-3">
                  {MASTER_CATEGORIES.filter(m => m !== activeMaster).slice(0, 4).map(m => (
                    <button
                      key={m}
                      onClick={() => navigate({ name: 'shop', category: m })}
                      className="chip"
                    >
                      {m}
                    </button>
                  ))}
                </div>
                {activeChips.length > 0 && (
                  <button onClick={() => { clearAll(); navigate({ name: 'shop' }); }} className="btn-outline">
                    Clear Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                {filtered.map(f => <ProductCard key={f.id} fabric={f} />)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile filter drawer. lg:hidden so a resize to desktop while open can't
          leave the full-screen overlay blocking the now-visible sidebar/grid. */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-[120] flex lg:hidden">
          <div className="flex-1 bg-black/40" onClick={() => setMobileFiltersOpen(false)} />
          <div className="w-[86%] max-w-[360px] bg-white overflow-y-auto p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[14px] font-extrabold uppercase tracking-wider">Filters</span>
              <button onClick={() => setMobileFiltersOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            {Sidebar}
            <button onClick={() => setMobileFiltersOpen(false)} className="btn-primary w-full mt-5">
              Apply ({filtered.length})
            </button>
          </div>
        </div>
      )}
    </main>
  );
};

export default ShopPage;
