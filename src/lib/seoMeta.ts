import { useEffect } from 'react';
import type { Fabric, Route } from '../types';
import { BUSINESS, gstinConfigured } from './business';
import { buildPath } from '../context/RouterContext';

/**
 * Per-route document metadata. With history routing every page has a real URL,
 * so each one deserves its own title, description and canonical — an SPA that
 * shows "Tresor Couture" on all 50 product pages tells Google they are one
 * page, which is exactly the collapse the routing migration was built to end.
 *
 * All DOM writes are idempotent upserts keyed by a data attribute, so
 * client-side navigation replaces rather than accumulates tags.
 */

const SITE = 'Tresor Couture';
const ORIGIN = 'https://tresorcouture.in';

const upsertMeta = (name: string, content: string): void => {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
};

const upsertCanonical = (href: string): void => {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
};

/** Route → { title, description }. Product pages are handled separately with
 *  live catalogue data; everything else is static copy. */
const metaFor = (route: Route): { title: string; description: string } => {
  switch (route.name) {
    case 'home':
      return {
        title: `${SITE} · Designer Lehengas, Sarees & Heritage Fabrics — Hyderabad`,
        description: 'Couture boutique in Hyderabad — bridal lehenga cholis, pre-draped sarees and rare hand-woven fabrics: Banarasi, Patola, Jamdani, Kanjivaram. Visit the studio or shop online.',
      };
    case 'shop': {
      const what = route.subCategory || route.category;
      return what
        ? { title: `${what} · ${SITE}`, description: `Shop ${what} at ${SITE} — couture pieces and hand-woven heritage textiles from the Hyderabad atelier, delivered across India.` }
        : { title: `Shop the Catalogue · ${SITE}`, description: `The full ${SITE} catalogue — bridal lehengas, sarees, laces and hand-woven fabrics, delivered across India.` };
    }
    case 'search':
      return { title: `Search: ${route.q} · ${SITE}`, description: `Search results for "${route.q}" in the ${SITE} catalogue.` };
    case 'cart':
      return { title: `Shopping Bag · ${SITE}`, description: `Your ${SITE} shopping bag.` };
    case 'checkout':
      return { title: `Checkout · ${SITE}`, description: `Secure checkout at ${SITE}.` };
    case 'policy': {
      const names: Record<string, string> = {
        privacy: 'Privacy Policy', terms: 'Terms of Service', refund: 'Refund & Return Policy',
        shipping: 'Shipping Policy', cookies: 'Cookie Policy', contact: 'Contact the Atelier',
      };
      const n = names[route.policy] ?? 'Policies';
      return { title: `${n} · ${SITE}`, description: `${n} for ${SITE} (tresorcouture.in).` };
    }
    case 'login':
      return { title: `Sign In · ${SITE}`, description: `Sign in to your ${SITE} account.` };
    case 'register':
      return { title: `Create Account · ${SITE}`, description: `Create your ${SITE} account for faster checkout, wishlists and order tracking.` };
    default:
      // Admin, account, confirmation etc. — never indexed, a plain title is fine.
      return { title: SITE, description: 'Hand-woven heritage Indian fashion from the Hyderabad atelier.' };
  }
};

/** Rendered inside RouterProvider (RoutedView) — one effect owns title,
 *  description, canonical and robots for every non-product route. */
export function useRouteMeta(route: Route): void {
  useEffect(() => {
    if (route.name === 'product') return; // ProductPage owns its own meta.
    const { title, description } = metaFor(route);
    document.title = title;
    upsertMeta('description', description);
    upsertCanonical(ORIGIN + buildPath(route));
    // Private surfaces must never enter the index even though they now have
    // real URLs.
    const priv = ['account', 'admin', 'admin-brand-kit', 'cart', 'checkout', 'confirmation', 'auth-action', 'login', 'register'];
    upsertMeta('robots', priv.includes(route.name) ? 'noindex, nofollow' : 'index, follow');
  }, [route]);
}

const upsertJsonLd = (id: string, data: object | null): void => {
  const sel = `script[type="application/ld+json"][data-seo="${id}"]`;
  const existing = document.head.querySelector(sel);
  if (!data) { existing?.remove(); return; }
  const el = existing ?? (() => {
    const s = document.createElement('script');
    s.setAttribute('type', 'application/ld+json');
    s.setAttribute('data-seo', id);
    document.head.appendChild(s);
    return s;
  })();
  el.textContent = JSON.stringify(data);
};

/** Product rich-result schema + per-product meta. Used by ProductPage. */
export function useProductMeta(fabric: Fabric | undefined): void {
  useEffect(() => {
    if (!fabric) return;
    const url = `${ORIGIN}/product/${encodeURIComponent(fabric.id)}`;
    const desc = (fabric.description || '').slice(0, 300);
    document.title = `${fabric.name} · ${SITE}`;
    upsertMeta('description', desc);
    upsertMeta('robots', 'index, follow');
    upsertCanonical(url);
    upsertJsonLd('product', {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: fabric.name,
      description: desc,
      ...(fabric.photo?.startsWith('/') ? { image: ORIGIN + fabric.photo } : {}),
      ...(fabric.productCode ? { sku: fabric.productCode } : {}),
      brand: { '@type': 'Brand', name: SITE },
      offers: {
        '@type': 'Offer',
        url,
        priceCurrency: 'INR',
        price: fabric.price,
        availability: (fabric.stock ?? 0) > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
        itemCondition: 'https://schema.org/NewCondition',
      },
    });
    return () => upsertJsonLd('product', null);
  }, [fabric]);
}

/** ClothingStore schema for the home page. Address and phone come from the
 *  env-driven business profile; the block is emitted only when the address is
 *  real (same gating discipline as the GSTIN — never publish a placeholder). */
export function useStoreJsonLd(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const addressReal = !BUSINESS.addressLines.join('|').includes('Road No. 12, Banjara Hills');
    upsertJsonLd('store', {
      '@context': 'https://schema.org',
      '@type': 'ClothingStore',
      name: SITE,
      url: ORIGIN + '/',
      image: `${ORIGIN}/branding/social/og-default-1200x630.png`,
      telephone: BUSINESS.phone,
      email: BUSINESS.email,
      priceRange: '₹₹₹',
      currenciesAccepted: 'INR',
      ...(addressReal ? {
        address: {
          '@type': 'PostalAddress',
          streetAddress: BUSINESS.addressLines.slice(0, -2).join(', '),
          addressLocality: 'Hyderabad',
          addressRegion: 'Telangana',
          addressCountry: 'IN',
        },
      } : {}),
      ...(gstinConfigured() ? { taxID: BUSINESS.gstin } : {}),
    });
    return () => upsertJsonLd('store', null);
  }, [active]);
}
