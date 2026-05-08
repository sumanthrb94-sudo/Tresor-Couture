/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import CollectionSection from './components/CollectionSection';
import Founder from './components/Founder';
import Craftsmanship from './components/Craftsmanship';
import Footer from './components/Footer';
import ShopPage from './pages/ShopPage';
import ProductPage from './pages/ProductPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import ConfirmationPage from './pages/ConfirmationPage';
import { CartProvider } from './context/CartContext';
import { OrderProvider } from './context/OrderContext';
import { RouterProvider, useRouter } from './context/RouterContext';

const Home: React.FC = () => (
  <main>
    <Hero />
    <CollectionSection />
    <Founder />
    <Craftsmanship />

    <section className="py-20 md:py-[120px] px-5 md:px-16 max-w-[1280px] mx-auto bg-brand-bg-soft border-y border-brand-outline/30">
      <div className="max-w-3xl mx-auto text-center">
        <span className="text-[11px] uppercase tracking-[0.15em] font-semibold text-brand-gold mb-4 block">
          Inner Circle
        </span>
        <h2 className="font-serif text-[32px] md:text-4xl lg:text-5xl gold-text leading-tight tracking-[-0.01em] mb-5 md:mb-6">
          Discover new weaves <em>before the world</em>
        </h2>
        <p className="text-base text-brand-ink-soft mb-10 max-w-xl mx-auto leading-relaxed">
          Be the first to know about our seasonal releases, artisanal collaborations, and exclusive exhibitions.
        </p>
        <form className="flex flex-col sm:flex-row gap-4 max-w-lg mx-auto" onSubmit={(e) => e.preventDefault()}>
          <input
            type="email"
            placeholder="Email address"
            required
            className="input-underline flex-grow text-base text-brand-ink"
          />
          <button type="submit" className="btn-gold whitespace-nowrap w-full sm:w-auto">
            Subscribe
          </button>
        </form>
      </div>
    </section>
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
      <CartProvider>
        <OrderProvider>
          <div className="selection:bg-brand-gold selection:text-white">
            <Navbar />
            <RoutedView />
            <Footer />
          </div>
        </OrderProvider>
      </CartProvider>
    </RouterProvider>
  );
}

export default App;
