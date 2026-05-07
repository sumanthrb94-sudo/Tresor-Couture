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

    <section className="py-32 bg-brand-bg border-t border-brand-border">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <span className="text-[9px] uppercase tracking-[0.6em] font-bold text-brand-gold mb-6 block italic">
          Inner Circle
        </span>
        <h2 className="text-4xl md:text-5xl font-serif mb-8 italic">
          Discover New Weaves <br />
          <span className="not-italic">Before the World</span>
        </h2>
        <p className="text-brand-ink/60 font-light mb-12 max-w-xl mx-auto text-sm leading-relaxed">
          Be the first to know about our seasonal releases, artisanal collaborations, and exclusive exhibitions across the globe.
        </p>
        <form className="flex flex-col sm:flex-row gap-4 max-w-lg mx-auto" onSubmit={(e) => e.preventDefault()}>
          <input
            type="email"
            placeholder="EMAIL ADDRESS"
            className="flex-grow bg-white border border-brand-border px-6 py-4 text-[10px] uppercase tracking-widest focus:outline-none focus:border-brand-gold transition-colors"
            required
          />
          <button className="bg-brand-ink text-white px-10 py-4 text-[10px] uppercase tracking-[0.2em] font-bold hover:bg-brand-gold transition-colors duration-500">
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
