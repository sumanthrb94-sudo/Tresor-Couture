import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'tresor-wishlist-v1';

interface WishlistContextValue {
  ids: string[];
  count: number;
  has: (id: string) => boolean;
  toggle: (id: string) => void;
  add: (id: string) => void;
  remove: (id: string) => void;
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

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
      /* ignore quota errors */
    }
  }, [ids]);

  const value = useMemo<WishlistContextValue>(() => ({
    ids,
    count: ids.length,
    has: (id: string) => ids.includes(id),
    toggle: (id: string) =>
      setIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])),
    add: (id: string) => setIds(prev => (prev.includes(id) ? prev : [...prev, id])),
    remove: (id: string) => setIds(prev => prev.filter(x => x !== id))
  }), [ids]);

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
};

export const useWishlist = () => {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used inside WishlistProvider');
  return ctx;
};
