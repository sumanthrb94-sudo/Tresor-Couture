import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Route } from '../types';

const parseHash = (hash: string): Route => {
  const cleaned = hash.replace(/^#\/?/, '');
  if (!cleaned) return { name: 'home' };
  const [path, query = ''] = cleaned.split('?');
  const segments = path.split('/').filter(Boolean);
  const params = new URLSearchParams(query);

  switch (segments[0]) {
    case 'shop': {
      const category = params.get('category') ?? undefined;
      return { name: 'shop', category };
    }
    case 'product':
      if (segments[1]) return { name: 'product', id: segments[1] };
      return { name: 'shop' };
    case 'cart':
      return { name: 'cart' };
    case 'checkout':
      return { name: 'checkout' };
    case 'confirmation':
      if (segments[1]) return { name: 'confirmation', orderId: segments[1] };
      return { name: 'home' };
    default:
      return { name: 'home' };
  }
};

const buildHash = (route: Route): string => {
  switch (route.name) {
    case 'home':
      return '#/';
    case 'shop':
      return route.category ? `#/shop?category=${encodeURIComponent(route.category)}` : '#/shop';
    case 'product':
      return `#/product/${route.id}`;
    case 'cart':
      return '#/cart';
    case 'checkout':
      return '#/checkout';
    case 'confirmation':
      return `#/confirmation/${route.orderId}`;
  }
};

interface RouterContextValue {
  route: Route;
  navigate: (route: Route) => void;
  hrefFor: (route: Route) => string;
}

const RouterContext = createContext<RouterContextValue | null>(null);

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const handler = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  const navigate = useCallback((next: Route) => {
    const hash = buildHash(next);
    if (window.location.hash !== hash) {
      window.location.hash = hash;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const hrefFor = useCallback((r: Route) => buildHash(r), []);

  return (
    <RouterContext.Provider value={{ route, navigate, hrefFor }}>{children}</RouterContext.Provider>
  );
};

export const useRouter = () => {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error('useRouter must be used inside RouterProvider');
  return ctx;
};
