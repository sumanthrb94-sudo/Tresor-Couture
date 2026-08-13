import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Route, PolicyKey, ADMIN_SECTIONS } from '../types';
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
    case 'login':
      return { name: 'login' };
    case 'register':
      return { name: 'register' };
    case 'account': {
      const tab = segments[1] as 'profile' | 'orders' | 'returns' | 'wishlist' | 'addresses' | undefined;
      return { name: 'account', tab };
    }
    case 'admin': {
      if (segments[1] === 'brand-kit') {
        return { name: 'admin-brand-kit', section: params.get('section') ?? undefined };
      }
      // Validate against the shared list rather than casting: an unknown
      // segment used to slip through as a "valid" section and render a blank
      // console instead of falling back to the dashboard.
      const raw = segments[1];
      const section = ADMIN_SECTIONS.find(s => s === raw);
      return { name: 'admin', section };
    }
    case 'privacy':
    case 'terms':
    case 'refund':
    case 'shipping':
    case 'cookies':
    case 'contact':
      return { name: 'policy', policy: segments[0] as PolicyKey };
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
    case 'policy':
      return `#/${route.policy}`;
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
    // Own the scroll position ourselves. Without this the browser tries to
    // restore the previous page's scroll on hash/back navigation, so a new
    // page (e.g. the order confirmation after checkout) opens scrolled
    // half-way down on mobile instead of at the top.
    if ('scrollRestoration' in window.history) {
      try { window.history.scrollRestoration = 'manual'; } catch { /* ignore */ }
    }
    const handler = () => setRoute(parseLocation());
    window.addEventListener('hashchange', handler);
    window.addEventListener('popstate', handler);
    return () => {
      window.removeEventListener('hashchange', handler);
      window.removeEventListener('popstate', handler);
    };
  }, []);

  // Scroll to the top on EVERY route change — whether triggered by navigate(),
  // an <a href="#/…"> link (hashchange), or back/forward (popstate). Instant,
  // not smooth: a new screen should appear at the top immediately, and smooth
  // scrolling is unreliable mid-transition on mobile. Runs after paint so it
  // wins against any layout the freshly-mounted (lazy) page performs.
  useEffect(() => {
    const toTop = () => window.scrollTo(0, 0);
    toTop();
    const raf = window.requestAnimationFrame(toTop);
    return () => window.cancelAnimationFrame(raf);
  }, [route]);

  // SPA page_view on every route change (incl. initial). No-ops without GA4 id.
  useEffect(() => {
    trackPageView(window.location.pathname + window.location.hash);
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
    // Scroll reset is handled centrally by the route-change effect above, so
    // it also covers anchor-link and back/forward navigation.
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
