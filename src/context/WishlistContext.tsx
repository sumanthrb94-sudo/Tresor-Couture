import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { productsApi } from '../lib/firebase';
import { FABRICS } from '../constants';
import type { Fabric } from '../types';

const STORAGE_KEY = 'tresor-wishlist-v1';

interface WishlistContextValue {
  /** Raw fabric ids stored in localStorage. Source of truth for badges + has(). */
  ids: string[];
  /** Alias preserved for existing consumers (Navbar reads this). */
  items: string[];
  /** Same as ids.length — what badges should display for instant feedback. */
  count: number;
  has: (id: string) => boolean;
  toggle: (id: string) => void;
  add: (id: string) => void;
  remove: (id: string) => void;
  /** Hydrated Fabric objects, filtered to those we successfully resolved
   *  from Firestore (or the bundled FABRICS seed for legacy ids). */
  resolved: Fabric[];
  /** True while we're still fetching missing product details. */
  resolving: boolean;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

const load = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(x => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ids, setIds] = useState<string[]>(() => load());

  // Product details cache — wishlist stores only ids, so the AccountPage
  // wishlist tab needs the rest from Firestore. Seeded with the static
  // FABRICS bundle so legacy ids that match the seed render instantly.
  const [productCache, setProductCache] = useState<Map<string, Fabric>>(() => {
    const m = new Map<string, Fabric>();
    for (const f of FABRICS) m.set(f.id, f);
    return m;
  });
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
      /* ignore quota errors */
    }
  }, [ids]);

  useEffect(() => {
    const missing = ids.filter(id => !productCache.has(id));
    if (missing.length === 0) {
      setResolving(false);
      return;
    }
    let cancelled = false;
    setResolving(true);
    (async () => {
      const fetched = await Promise.all(missing.map(id => productsApi.get(id).catch(() => null)));
      if (cancelled) return;
      setProductCache(prev => {
        const next = new Map(prev);
        fetched.forEach((p, i) => {
          if (p) next.set(missing[i], p as unknown as Fabric);
        });
        return next;
      });
      setResolving(false);
    })();
    return () => { cancelled = true; };
  }, [ids, productCache]);

  const value = useMemo<WishlistContextValue>(() => {
    const resolved = ids
      .map(id => productCache.get(id))
      .filter((f): f is Fabric => Boolean(f));
    return {
      ids,
      items: ids,
      count: ids.length,
      has: (id: string) => ids.includes(id),
      toggle: (id: string) =>
        setIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])),
      add: (id: string) => setIds(prev => (prev.includes(id) ? prev : [...prev, id])),
      remove: (id: string) => setIds(prev => prev.filter(x => x !== id)),
      resolved,
      resolving
    };
  }, [ids, productCache, resolving]);

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
};

export const useWishlist = () => {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used inside WishlistProvider');
  return ctx;
};
