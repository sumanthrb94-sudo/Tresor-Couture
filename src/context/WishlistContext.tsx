import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { productsApi } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { FABRICS } from '../constants';
import type { Fabric } from '../types';

// Wishlist is keyed PER USER so that, on a shared device, signing out of one
// account and into another never leaks (or writes into) the previous person's
// saved fabrics. Guests use the ':guest' bucket. The bare legacy key is
// migrated into the guest bucket once so existing visitors keep their items.
const KEY_PREFIX = 'tresor-wishlist-v1';
const LEGACY_KEY = 'tresor-wishlist-v1';
const keyFor = (uid: string | undefined) => `${KEY_PREFIX}:${uid ?? 'guest'}`;

interface WishlistContextValue {
  ids: string[];
  items: string[];
  count: number;
  has: (id: string) => boolean;
  toggle: (id: string) => void;
  add: (id: string) => void;
  remove: (id: string) => void;
  resolved: Fabric[];
  resolving: boolean;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

const parseIds = (raw: string | null): string[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

const loadFor = (key: string): string[] => {
  try {
    const direct = localStorage.getItem(key);
    if (direct !== null) return parseIds(direct);
    // One-time migration: fold the old unkeyed list into the guest bucket.
    if (key === keyFor(undefined)) {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy !== null && LEGACY_KEY !== key) return parseIds(legacy);
    }
    return [];
  } catch {
    return [];
  }
};

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const storageKey = keyFor(user?.id);

  const [ids, setIds] = useState<string[]>(() => loadFor(keyFor(undefined)));

  // When the active key changes (login/logout), load that user's list. Set a
  // skip flag so the load-driven setIds doesn't immediately persist the old
  // list under the new key (write-before-read race).
  const skipPersistRef = useRef(false);
  useEffect(() => {
    skipPersistRef.current = true;
    setIds(loadFor(storageKey));
  }, [storageKey]);

  // Persist to the CURRENT key only.
  useEffect(() => {
    if (skipPersistRef.current) { skipPersistRef.current = false; return; }
    try { localStorage.setItem(storageKey, JSON.stringify(ids)); } catch { /* quota */ }
  }, [ids, storageKey]);

  // Cross-tab sync: react to writes to the active key from another tab so the
  // badge/list don't go stale. Fires only in OTHER tabs, so no write loop.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== storageKey) return;
      const next = parseIds(e.newValue);
      setIds(prev => (prev.length === next.length && prev.every((v, i) => v === next[i]) ? prev : next));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [storageKey]);

  const [productCache, setProductCache] = useState<Map<string, Fabric>>(() => {
    const m = new Map<string, Fabric>();
    for (const f of FABRICS) m.set(f.id, f);
    return m;
  });
  const [resolving, setResolving] = useState(false);
  // Tombstone unresolvable ids so the resolve effect can't loop (see CartContext).
  const failedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const missing = ids.filter(id => !productCache.has(id) && !failedIdsRef.current.has(id));
    if (missing.length === 0) {
      setResolving(false);
      return;
    }
    let cancelled = false;
    setResolving(true);
    (async () => {
      const fetched = await Promise.all(missing.map(id => productsApi.get(id).catch(() => null)));
      if (cancelled) return;
      missing.forEach((id, i) => { if (!fetched[i]) failedIdsRef.current.add(id); });
      if (fetched.some(Boolean)) {
        setProductCache(prev => {
          const next = new Map(prev);
          fetched.forEach((p, i) => { if (p) next.set(missing[i], p as unknown as Fabric); });
          return next;
        });
      }
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
