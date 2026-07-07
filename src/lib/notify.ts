// Thin client for the Vercel notification endpoints (Brevo). All calls are
// best-effort and fire-and-forget — a failure here must never block the order
// or the UI. Secrets live server-side; the client only passes its ID token.

import { auth } from './firebase';
import { apiPost } from './csrf';
import type { Order } from '../types';

/** Add an email to the Brevo marketing list (newsletter / signup capture). */
export async function subscribeContact(email: string, source = 'site', name?: string, captchaToken?: string | null): Promise<void> {
  try {
    await apiPost('/api/contact', { email, source, name, captchaToken });
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
    await apiPost('/api/whatsapp/notify', { order: { id: order.id, total: order.total, customerName } }, { authorization: `Bearer ${token}` });
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
          quantity: it.quantity,
          color: it.color,
          price: it.fabricSnapshot?.price,
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
    await apiPost('/api/email/order', payload, { authorization: `Bearer ${token}` });
  } catch {
    /* best-effort */
  }
}
