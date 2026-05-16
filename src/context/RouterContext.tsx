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
      const subCategory = params.get('subcategory') ?? undefined;
      return { name: 'shop', category, subCategory };
    }
    case 'search': {
      const q = (params.get('q') ?? '').trim();
      if (!q) return { name: 'not-found', path: cleaned };
      return { name: 'search', q };
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
    case 'customise':
    case 'couture':
    case 'studio':
      return { name: 'customise', productId: segments[1] || params.get('product') || undefined };
    case 'login':
      return { name: 'login' };
    case 'register':
      return { name: 'register' };
    case 'account': {
      const tab = segments[1] as 'profile' | 'orders' | 'wishlist' | 'addresses' | undefined;
      return { name: 'account', tab };
    }
    case 'admin': {
      if (segments[1] === 'brand-kit') {
        return { name: 'admin-brand-kit', section: params.get('section') ?? undefined };
      }
      const section = segments[1] as
        | 'dashboard'
        | 'products'
        | 'orders'
        | 'coupons'
        | 'reviews'
        | undefined;
      return { name: 'admin', section };
    }
    default:
      return { name: 'not-found', path: cleaned };
  }
};

const buildHash = (route: Route): string => {
  switch (route.name) {
    case 'home':
      return '#/';
    case 'shop': {
      const parts: string[] = [];
      if (route.category) parts.push(`category=${encodeURIComponent(route.category)}`);
      if (route.subCategory) parts.push(`subcategory=${encodeURIComponent(route.subCategory)}`);
      return parts.length ? `#/shop?${parts.join('&')}` : '#/shop';
    }
    case 'search':
      return `#/search?q=${encodeURIComponent(route.q)}`;
    case 'product':
      return `#/product/${route.id}`;
    case 'cart':
      return '#/cart';
    case 'checkout':
      return '#/checkout';
    case 'confirmation':
      return `#/confirmation/${route.orderId}`;
    case 'customise':
      return route.productId ? `#/customise/${route.productId}` : '#/customise';
    case 'login':
      return '#/login';
    case 'register':
      return '#/register';
    case 'account':
      return route.tab ? `#/account/${route.tab}` : '#/account';
    case 'admin':
      return route.section ? `#/admin/${route.section}` : '#/admin';
    case 'admin-brand-kit':
      return route.section ? `#/admin/brand-kit?section=${encodeURIComponent(route.section)}` : '#/admin/brand-kit';
    case 'not-found':
      return route.path ? `#/${route.path}` : '#/404';
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
