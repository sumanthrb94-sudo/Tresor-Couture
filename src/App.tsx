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
import Footer from './components/Footer';
import ShopPage from './pages/ShopPage';
import ProductPage from './pages/ProductPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import ConfirmationPage from './pages/ConfirmationPage';
import { FABRICS } from './constants';
import { CartProvider } from './context/CartContext';
import { OrderProvider } from './context/OrderContext';
import { WishlistProvider } from './context/WishlistContext';
import { RouterProvider, useRouter } from './context/RouterContext';

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
    <ProductRail eyebrow="The Bridal Edit" title="Heritage Silks for the Aisle" items={bridal} ctaCategory="Silk" bg="soft" />
    <ProductRail eyebrow="Just Dropped" title="New In · Limited Bolts" items={newIn} bg="white" />
    <ProductRail eyebrow="Summer Lightweights" title="Cottons, Linens & Muslins" items={summer} ctaCategory="Cotton" bg="soft" />
  </main>
);

const RoutedView: React.FC = () => {
  const { route } = useRouter();
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
  }
};

function App() {
  return (
    <RouterProvider>
      <WishlistProvider>
        <CartProvider>
          <OrderProvider>
            <div className="selection:bg-[color:var(--color-myntra-pink)] selection:text-white bg-white min-h-screen">
              <Navbar />
              <RoutedView />
              <Footer />
            </div>
          </OrderProvider>
        </CartProvider>
      </WishlistProvider>
    </RouterProvider>
  );
}

export default App;
