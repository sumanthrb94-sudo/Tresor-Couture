/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import CategoryStrip from './components/CategoryStrip';
import OffersBanner from './components/OffersBanner';
import SignupCallout from './components/SignupCallout';
import ProductRail from './components/ProductRail';
import LookbookRail from './components/LookbookRail';
import Footer from './components/Footer';
import BottomNav from './components/BottomNav';
import ConsentBanner from './components/ConsentBanner';
import ErrorBoundary from './components/ErrorBoundary';
import ShopPage from './pages/ShopPage';
import ProductPage from './pages/ProductPage';
import CartPage from './pages/CartPage';
import { productsApi, seedCatalog } from './lib/firebase';
import type { Fabric } from './types';

// Routes that aren't on the critical home/shop path are lazy-loaded so they
// don't bloat the initial bundle. React.lazy splits each into its own chunk.
const CheckoutPage      = lazy(() => import('./pages/CheckoutPage'));
const ConfirmationPage  = lazy(() => import('./pages/ConfirmationPage'));
const LoginPage         = lazy(() => import('./pages/LoginPage'));
const RegisterPage      = lazy(() => import('./pages/RegisterPage'));
const AccountPage       = lazy(() => import('./pages/AccountPage'));
const AdminBrandKitPage = lazy(() => import('./pages/AdminBrandKitPage'));
const AdminPage         = lazy(() => import('./pages/admin/AdminPage'));
const NotFoundPage      = lazy(() => import('./pages/NotFoundPage'));
const SearchResultsPage = lazy(() => import('./pages/SearchResultsPage'));
const AuthActionPage    = lazy(() => import('./pages/AuthActionPage'));
const LegalPage         = lazy(() => import('./pages/LegalPage'));
import { FABRICS } from './constants';
import { CartProvider } from './context/CartContext';
import { OrderProvider } from './context/OrderContext';
import { WishlistProvider } from './context/WishlistContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RouterProvider, useRouter } from './context/RouterContext';
import AdminGuard from './pages/admin/AdminGuard';

// Module-level guard so the auto-seed attempt fires at most once per page load
// regardless of how many Home re-mounts happen during the session.
let autoSeedAttempted = false;

const Home: React.FC = () => {
  const [products, setProducts] = useState<Fabric[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const { isAdmin } = useAuth();

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    setProducts(null);
    (async () => {
      try {
        // Only admins can write under firestore.rules; guest visitors trigger
        // a permission_denied that we don't want to surface or risk crashing on.
        if (isAdmin && !autoSeedAttempted) {
          autoSeedAttempted = true;
          await seedCatalog(FABRICS as unknown as Record<string, unknown>[]).catch(() => null);
        }
        const rows = await productsApi.list({ limit: 200 });
        if (!cancelled) setProducts(rows as unknown as Fabric[]);
      } catch (err) {
        if (!cancelled) {
          setProducts([]);
          setLoadError(err instanceof Error ? err.message : 'Could not load the catalogue.');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [isAdmin, reloadKey]);

  const loading = products === null;

  // Rails defined by spec. Bridal prefers master categories (Sarees, Lehenga Cholis)
  // when there are enough; otherwise falls back to silk/satin fabrics so the rail
  // doesn't collapse on a catalogue weighted toward yardage.
  const { trending, newIn, bridal, summer } = useMemo(() => {
    const list = products ?? [];
    const byMaster = list.filter(f => f.masterCategory === 'Sarees' || f.masterCategory === 'Lehenga Cholis');
    const byCategory = list.filter(f => f.category === 'Silk' || f.category === 'Satin');
    return {
      trending: list.filter(f => f.sticker === 'Trending' || f.sticker === 'Bestseller').slice(0, 5),
      newIn:    list.filter(f => f.sticker === 'New In' || f.sticker === 'Limited').slice(0, 5),
      bridal:   (byMaster.length >= 3 ? byMaster : byCategory).slice(0, 5),
      summer:   list.filter(f => f.category === 'Cotton' || f.category === 'Linen').slice(0, 5)
    };
  }, [products]);

  const bridalUsesMaster = useMemo(() => {
    const list = products ?? [];
    return list.filter(f => f.masterCategory === 'Sarees' || f.masterCategory === 'Lehenga Cholis').length >= 3;
  }, [products]);

  return (
    <main>
      <Hero />
      <CategoryStrip />
      <OffersBanner />
      {/* SignupCallout self-gates on auth + session dismissal — safe to always mount here. */}
      <SignupCallout />

      {loadError && (
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 lg:px-10 py-4">
          <div className="border border-[color:var(--color-myntra-pink)] bg-[color:var(--color-myntra-bg-soft)] rounded p-4 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[13px] text-[color:var(--color-myntra-navy)] font-semibold">
              We couldn't reach the catalogue. {loadError}
            </p>
            <button
              type="button"
              onClick={() => setReloadKey(k => k + 1)}
              className="text-[13px] font-bold text-[color:var(--color-myntra-pink)] underline"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      <ProductRail eyebrow="Hot on Tresor" title="Trending Weaves" items={trending} loading={loading} bg="white" />
      <LookbookRail />
      <ProductRail
        eyebrow="The Bridal Edit"
        title="Heritage Silks for the Aisle"
        items={bridal}
        loading={loading}
        masterCategory={bridalUsesMaster ? 'Sarees' : undefined}
        ctaCategory={bridalUsesMaster ? undefined : 'Silk'}
        bg="white"
      />
      <ProductRail eyebrow="Just Dropped" title="New In · Limited Bolts" items={newIn} loading={loading} bg="soft" />
      <ProductRail
        eyebrow="Summer Lightweights"
        title="Cottons, Linens & Muslins"
        items={summer}
        loading={loading}
        ctaCategory="Cotton"
        bg="white"
      />
    </main>
  );
};

const RoutedView: React.FC = () => {
  const { route } = useRouter();
  switch (route.name) {
    case 'home':
      return <Home />;
    case 'shop':
      return <ShopPage initialCategory={route.category} initialSubCategory={route.subCategory} />;
    case 'search':
      return <SearchResultsPage q={route.q} />;
    case 'product':
      return <ProductPage productId={route.id} />;
    case 'cart':
      return <CartPage />;
    case 'checkout':
      return <CheckoutPage />;
    case 'confirmation':
      return <ConfirmationPage orderId={route.orderId} />;
    case 'login':
      return <LoginPage />;
    case 'register':
      return <RegisterPage />;
    case 'account':
      return <AccountPage tab={route.tab} />;
    case 'admin':
      // Access is gated by the Firebase `admin: true` custom claim, enforced
      // inside AdminPage's AdminGuard (and by firestore.rules server-side).
      return <AdminPage section={route.section} />;
    case 'admin-brand-kit':
      return (
        <AdminGuard>
          <AdminBrandKitPage section={route.section} />
        </AdminGuard>
      );
    case 'auth-action':
      return <AuthActionPage mode={route.mode} oobCode={route.oobCode} continueUrl={route.continueUrl} />;
    case 'policy':
      return <LegalPage policy={route.policy} />;
    case 'not-found':
      return <NotFoundPage />;
  }
};

const RouteFallback: React.FC = () => (
  <div className="pt-[120px] min-h-[60vh] flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-[color:var(--color-myntra-pink)] border-t-transparent rounded-full animate-spin" aria-label="Loading" />
  </div>
);

const Chrome: React.FC = () => {
  const { route } = useRouter();
  const isAdmin = route.name === 'admin' || route.name === 'admin-brand-kit';
  return (
    <div className="selection:bg-[color:var(--color-myntra-pink)] selection:text-white bg-white min-h-screen">
      <Navbar />
      <ErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <RoutedView />
        </Suspense>
      </ErrorBoundary>
      {!isAdmin && <Footer />}
      {/* Mobile sticky bottom nav. Reserve space so content/footer isn't hidden
          behind it on phones (the bar is ~58px + safe-area). */}
      {!isAdmin && <div className="lg:hidden h-[58px]" aria-hidden />}
      {!isAdmin && <BottomNav />}
      {!isAdmin && <ConsentBanner />}
    </div>
  );
};

function App() {
  return (
    <RouterProvider>
      <AuthProvider>
        <WishlistProvider>
          <CartProvider>
            <OrderProvider>
              <Chrome />
            </OrderProvider>
          </CartProvider>
        </WishlistProvider>
      </AuthProvider>
    </RouterProvider>
  );
}

export default App;
