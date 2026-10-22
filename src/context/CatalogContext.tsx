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

/**
 * First paint without waiting on Firebase.
 *
 * A cold visit used to show beige skeleton cards until the Firebase SDK had
 * downloaded, initialised and answered a query — seconds on a phone. Two
 * faster sources now fill the grid first, and Firestore still has the last
 * word:
 *   1. the catalogue this browser saw last time (localStorage) — instant on
 *      every repeat visit;
 *   2. /api/catalog, the same list as one edge-cached JSON response — a plain
 *      fetch, no SDK.
 * Both are full lists of listed products, not a partial preview, so a product
 * page or cart resolving against them finds what it should. The emulator
 * build has no API routes, so it skips (2).
 */
const CACHE_KEY = 'tc.catalog.v1';
const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const USE_EMULATORS = env.VITE_USE_EMULATORS === '1' || env.VITE_USE_EMULATORS === 'true';

function readCache(): Fabric[] {
  try {
    const rows = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '[]');
    return Array.isArray(rows) ? (rows as Fabric[]).filter(isListed) : [];
  } catch {
    return [];
  }
}

function writeCache(rows: Fabric[]): void {
  try {
    // Firestore Timestamps do not survive JSON; createdMs() in homeRails reads
    // the plain millisecond number this leaves behind.
    const plain = rows.map(r => {
      const c = r.createdAt as unknown as { toMillis?: () => number } | undefined;
      return typeof c?.toMillis === 'function' ? { ...r, createdAt: c.toMillis() } : r;
    });
    localStorage.setItem(CACHE_KEY, JSON.stringify(plain));
  } catch {
    // Private mode or a full quota: the cache is a convenience, never required.
  }
}

export const CatalogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Fabric[]>(readCache);
  const [preview, setPreview] = useState<Fabric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // Once Firestore has answered, a slower edge response must not overwrite it.
    let authoritative = false;
    setLoading(true);
    setError(null);
    if (!USE_EMULATORS) {
      fetch('/api/catalog')
        .then(r => (r.ok ? r.json() : null))
        .then((body: { products?: Fabric[] } | null) => {
          const rows = body?.products?.filter(isListed) ?? [];
          if (cancelled || authoritative || !rows.length) return;
          setProducts(rows);
          writeCache(rows);
        })
        .catch(() => {});
    }
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
        if (!cancelled) {
          const listed = rows.filter(isListed);
          if (listed.length) {
            authoritative = true;
            setProducts(listed);
            writeCache(listed);
          }
          // An empty answer is what the SDK returns OFFLINE, from its own empty
          // local cache — not a sign the shop has nothing. Never let it blank a
          // grid the edge or the browser cache has already filled.
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load catalogue');
          // Keep whatever the cache or the edge already put on screen: an empty
          // shop is a worse answer to a flaky connection than a slightly old one.
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
