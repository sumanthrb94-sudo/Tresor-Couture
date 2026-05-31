// Thin client for the Vercel notification endpoints (Brevo). All calls are
// best-effort and fire-and-forget — a failure here must never block the order
// or the UI. Secrets live server-side; the client only passes its ID token.

import { auth } from './firebase';
import type { Order } from '../types';

/** Add an email to the Brevo marketing list (newsletter / signup capture). */
export async function subscribeContact(email: string, source = 'site', name?: string): Promise<void> {
  try {
    await fetch('/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, source, name }),
    });
  } catch {
    /* best-effort */
  }
}

/** Notify the store of a new order via WhatsApp (Meta Cloud API). Dormant
 *  until WhatsApp env is configured server-side. */
export async function sendOrderWhatsApp(order: Order, customerName?: string): Promise<void> {
  try {
    const u = auth.currentUser;
    if (!u) return;
    const token = await u.getIdToken();
    await fetch('/api/whatsapp/notify', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ order: { id: order.id, total: order.total, customerName } }),
    });
  } catch {
    /* best-effort */
  }
}

/** Send the order-confirmation email to the signed-in buyer via Brevo. */
export async function sendOrderEmail(order: Order): Promise<void> {
  try {
    const u = auth.currentUser;
    if (!u) return;
    const token = await u.getIdToken();
    const payload = {
      order: {
        id: order.id,
        items: order.items.map(it => ({
          name: it.fabricSnapshot?.name,
          brand: it.fabricSnapshot?.brand,
          meters: it.meters,
          color: it.color,
          pricePerMeter: it.fabricSnapshot?.pricePerMeter,
        })),
        subtotal: order.subtotal,
        shipping: order.shipping,
        tax: order.tax,
        total: order.total,
        couponCode: order.couponCode,
        couponDiscount: order.couponDiscount,
        shippingAddress: order.shippingAddress,
      },
      name: u.displayName ?? undefined,
    };
    await fetch('/api/email/order', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
  } catch {
    /* best-effort */
  }
}
