/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import CategoryStrip from './components/CategoryStrip';
import OffersBanner from './components/OffersBanner';
import DealsStrip from './components/DealsStrip';
import ProductRail from './components/ProductRail';
import LookbookRail from './components/LookbookRail';
import Footer from './components/Footer';
import ShopPage from './pages/ShopPage';
import ProductPage from './pages/ProductPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import ConfirmationPage from './pages/ConfirmationPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminLandingPage from './pages/AdminLandingPage';
import AdminBrandKitPage from './pages/AdminBrandKitPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AccountPage from './pages/AccountPage';
import AdminPage from './pages/admin/AdminPage';
import { FABRICS } from './constants';
import { CartProvider } from './context/CartContext';
import { OrderProvider } from './context/OrderContext';
import { WishlistProvider } from './context/WishlistContext';
import { AuthProvider } from './context/AuthContext';
import { RouterProvider, useRouter } from './context/RouterContext';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';

const trending = FABRICS.filter(f => f.sticker === 'Trending' || f.sticker === 'Bestseller').slice(0, 5);
const newIn = FABRICS.filter(f => f.sticker === 'New In' || f.sticker === 'Limited').slice(0, 5);
const bridal = FABRICS.filter(f => f.category === 'Silk' || f.category === 'Satin').slice(0, 5);
const summer = FABRICS.filter(f => f.category === 'Cotton' || f.category === 'Linen').slice(0, 5);

const Home: React.FC = () => (
  <main>
    <Hero />
    <CategoryStrip />
    <OffersBanner />
    <DealsStrip />
    <ProductRail eyebrow="Hot on Tresor" title="Trending Weaves" items={trending} bg="white" />
    <LookbookRail />
    <ProductRail eyebrow="The Bridal Edit" title="Heritage Silks for the Aisle" items={bridal} ctaCategory="Silk" bg="white" />
    <ProductRail eyebrow="Just Dropped" title="New In · Limited Bolts" items={newIn} bg="soft" />
    <ProductRail eyebrow="Summer Lightweights" title="Cottons, Linens & Muslins" items={summer} ctaCategory="Cotton" bg="white" />
  </main>
);

const RoutedView: React.FC = () => {
  const { route } = useRouter();
  const { unlocked } = useAdminAuth();
  switch (route.name) {
    case 'home':
      return <Home />;
    case 'shop':
      return <ShopPage initialCategory={route.category} />;
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
      return unlocked ? <AdminPage section={route.section} /> : <AdminLoginPage redirectTo="admin" />;
    case 'admin-brand-kit':
      return unlocked
        ? <AdminBrandKitPage section={route.section} />
        : <AdminLoginPage redirectTo="admin-brand-kit" section={route.section} />;
  }
};

const Chrome: React.FC = () => {
  const { route } = useRouter();
  const isAdmin = route.name === 'admin' || route.name === 'admin-brand-kit';
  return (
    <div className="selection:bg-[color:var(--color-myntra-pink)] selection:text-white bg-white min-h-screen">
      <Navbar />
      <RoutedView />
      {!isAdmin && <Footer />}
    </div>
  );
};

function App() {
  return (
    <RouterProvider>
      <AuthProvider>
        <AdminAuthProvider>
          <WishlistProvider>
            <CartProvider>
              <OrderProvider>
                <Chrome />
              </OrderProvider>
            </CartProvider>
          </WishlistProvider>
        </AdminAuthProvider>
      </AuthProvider>
    </RouterProvider>
  );
}

export default App;
