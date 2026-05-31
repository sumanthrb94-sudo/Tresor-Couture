import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Route } from '../types';
import { trackPageView } from '../lib/analytics';

const parseLocation = (): Route => {
  // Firebase's email-action handler redirects to a path-based URL with the
  // action mode + oobCode in the query string. It cannot put them after the
  // hash because email clients (and Firebase) don't speak hash routing. So
  // we special-case this BEFORE the regular hash parser runs.
  if (typeof window !== 'undefined' && window.location.pathname === '/auth/action') {
    const sp = new URLSearchParams(window.location.search);
    const mode = sp.get('mode');
    const oobCode = sp.get('oobCode');
    if (mode && oobCode) {
      return {
        name: 'auth-action',
        mode,
        oobCode,
        apiKey: sp.get('apiKey') ?? undefined,
        continueUrl: sp.get('continueUrl') ?? undefined,
      };
    }
  }
  return parseHash(window.location.hash);
};

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
    case 'auth-action':
      // Internal nav never builds this — Firebase redirects to /auth/action
      // directly. Returning '#/' means in-app links never accidentally land
      // on the handler.
      return '#/';
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
  const [route, setRoute] = useState<Route>(() => parseLocation());

  useEffect(() => {
    const handler = () => setRoute(parseLocation());
    window.addEventListener('hashchange', handler);
    window.addEventListener('popstate', handler);
    return () => {
      window.removeEventListener('hashchange', handler);
      window.removeEventListener('popstate', handler);
    };
  }, []);

  // Fire an analytics pageview after every successful route change (including
  // the initial load). trackPageView is a no-op until trackers are configured
  // AND consent is granted, so this is always safe. We report a clean path
  // (the hash without its leading '#') so analytics dashboards stay readable.
  useEffect(() => {
    const path = buildHash(route).replace(/^#/, '') || '/';
    trackPageView(path);
  }, [route]);

  const navigate = useCallback((next: Route) => {
    // If the current URL is a path-based route (e.g. /auth/action after a
    // Firebase email link), we need to switch back to the hash-routed root
    // before applying the new hash — otherwise the path persists and the
    // hash router is bypassed on the next page-load.
    if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
      window.history.replaceState(null, '', '/' + buildHash(next));
    } else {
      const hash = buildHash(next);
      if (window.location.hash !== hash) {
        window.location.hash = hash;
      }
    }
    setRoute(next);
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
