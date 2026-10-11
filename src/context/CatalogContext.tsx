import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { productsApi } from '../lib/firebase';
import { isListed } from '../lib/availability';
import type { Fabric, MasterCategory } from '../types';

interface CatalogContextValue {
  products: Fabric[];
  loading: boolean;
  /** For the home page only: the full catalogue once it has arrived, the
   *  newest few until then. Everything else keeps using `products`, because a
   *  cart or a product page resolving against a partial list would wrongly
   *  report a real item as missing. */
  homeProducts: Fabric[];
  /** True only while there is nothing at all to show on the home page. */
  homeLoading: boolean;
  error: string | null;
  refresh: () => void;
  byId: (id: string) => Fabric | undefined;
  byCategory: (category: MasterCategory | string) => Fabric[];
  bySubCategory: (category: MasterCategory | string, subCategory: string) => Fabric[];
}

const CatalogContext = createContext<CatalogContextValue | null>(null);

export const CatalogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Fabric[]>([]);
  const [preview, setPreview] = useState<Fabric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    // Stage 1: the newest 48, so the home page has real photographs on screen
    // while the full catalogue is still in flight. Best-effort — if it fails or
    // finds nothing, the full load below is the only path, exactly as before.
    productsApi.recent(48)
      .then(r => { if (!cancelled) setPreview((r as unknown as Fabric[]).filter(isListed)); })
      .catch(() => {});
    (async () => {
      try {
        const rows = (await productsApi.list({ limit: 1000 })) as unknown as Fabric[];
        // Drafts and retired pieces are filtered HERE rather than in the query:
        // a `where('listingStatus','==','Active')` would need a composite index
        // for every category/subcategory combination, and would also exclude
        // every product written before the field existed. Filtering in JS keeps
        // one query and treats a missing field as published.
        if (!cancelled) setProducts(rows.filter(isListed));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load catalogue');
          setProducts([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const refresh = () => setReloadKey(k => k + 1);

  const value = useMemo<CatalogContextValue>(() => {
    const byId = (id: string) => products.find(p => p.id === id);
    const byCategory = (category: MasterCategory | string) =>
      products.filter(p => p.masterCategory === category || p.category === category);
    const bySubCategory = (category: MasterCategory | string, subCategory: string) =>
      byCategory(category).filter(p => p.subCategory === subCategory);
    const homeProducts = products.length ? products : preview;
    const homeLoading = loading && homeProducts.length === 0;
    return { products, loading, homeProducts, homeLoading, error, refresh, byId, byCategory, bySubCategory };
  }, [products, preview, loading, error]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
};

export const useCatalog = () => {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog must be used inside CatalogProvider');
  return ctx;
};
