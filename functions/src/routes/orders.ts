import { Router } from 'express';
import { z } from 'zod';
import { db, FieldValue } from '../firebase';
import { requireAdmin, requireAuth, type AuthedRequest } from '../auth';
import type { Order, OrderStatus } from '../types';

const router = Router();

const ShippingAddress = z.object({
  fullName:   z.string().min(1),
  email:      z.string().email(),
  phone:      z.string().min(7),
  line1:      z.string().min(1),
  line2:      z.string().optional(),
  city:       z.string().min(1),
  state:      z.string().min(1),
  postalCode: z.string().min(1),
  country:    z.string().min(1)
});

const PlaceOrderBody = z.object({
  items: z.array(z.object({
    fabricId: z.string().min(1),
    meters:   z.number().positive(),
    color:    z.string().optional()
  })).min(1),
  shippingAddress: ShippingAddress,
  paymentMethod:   z.enum(['card', 'upi', 'cod']),
  couponCode:      z.string().optional()
});

const StatusBody = z.object({
  status: z.enum(['placed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'])
});

const TAX_RATE = 0.05;
const FREE_SHIPPING_THRESHOLD = 1999;
const SHIPPING_FLAT_RATE = 99;

/**
 * GET /orders — list current user's orders (or all if admin + ?all=1).
 */
router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const wantsAll = req.query.all === '1';
  let q: FirebaseFirestore.Query = db.collection('orders');
  if (!(wantsAll && req.isAdmin)) {
    q = q.where('userId', '==', req.uid).orderBy('placedAt', 'desc');
  } else {
    q = q.orderBy('placedAt', 'desc');
  }
  const snap = await q.limit(200).get();
  res.json({ orders: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
});

/**
 * GET /orders/:id
 */
router.get('/:id', requireAuth, async (req: AuthedRequest, res) => {
  const doc = await db.collection('orders').doc(req.params.id).get();
  if (!doc.exists) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  const data = doc.data() as Order;
  if (!req.isAdmin && data.userId !== req.uid) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }
  res.json({ order: { id: doc.id, ...data } });
});

/**
 * POST /orders — create an order. Prices, tax, shipping and totals are
 * computed server-side from current product data so the client can't
 * tamper with them. Returns the persisted order.
 */
router.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = PlaceOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });
    return;
  }
  const body = parsed.data;

  // Load product snapshots
  const products = await Promise.all(
    body.items.map(it => db.collection('products').doc(it.fabricId).get())
  );
  for (let i = 0; i < products.length; i++) {
    if (!products[i].exists) {
      res.status(400).json({ error: 'unknown_product', fabricId: body.items[i].fabricId });
      return;
    }
  }

  const items = body.items.map((it, idx) => {
    const snap = products[idx].data() as { pricePerMeter: number; id: string; [k: string]: unknown };
    return {
      fabricId: it.fabricId,
      meters:   it.meters,
      color:    it.color,
      fabricSnapshot: { id: products[idx].id, ...snap }
    };
  });

  const subtotal = items.reduce((s, it) => s + (it.fabricSnapshot.pricePerMeter * it.meters), 0);
  let couponDiscount = 0;
  if (body.couponCode) {
    const couponSnap = await db.collection('coupons').doc(body.couponCode.toUpperCase()).get();
    if (couponSnap.exists) {
      const c = couponSnap.data() as { active: boolean; kind: 'percent' | 'flat'; value: number; minSubtotal?: number; maxDiscount?: number; expiresAt?: string };
      const valid = c.active
        && (!c.expiresAt || new Date(c.expiresAt).getTime() > Date.now())
        && (!c.minSubtotal || subtotal >= c.minSubtotal);
      if (valid) {
        couponDiscount = c.kind === 'percent'
          ? Math.min(c.maxDiscount ?? Infinity, Math.round(subtotal * (c.value / 100)))
          : c.value;
      }
    }
  }
  const taxable = Math.max(0, subtotal - couponDiscount);
  const tax = Math.round(taxable * TAX_RATE);
  const shipping = taxable >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT_RATE;
  const total = taxable + tax + shipping;

  const ref = db.collection('orders').doc();
  const order: Order = {
    id: ref.id,
    userId: req.uid!,
    items,
    subtotal,
    shipping,
    tax,
    total,
    shippingAddress: body.shippingAddress,
    paymentMethod: body.paymentMethod,
    placedAt: new Date().toISOString(),
    status: 'placed',
    ...(body.couponCode ? { couponCode: body.couponCode.toUpperCase(), couponDiscount } : {})
  };
  await ref.set({ ...order, createdAt: FieldValue.serverTimestamp() });
  res.status(201).json({ order });
});

/**
 * PATCH /orders/:id/status — admin updates fulfilment state.
 */
router.patch('/:id/status', requireAdmin, async (req, res) => {
  const parsed = StatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });
    return;
  }
  const ref = db.collection('orders').doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  const next: OrderStatus = parsed.data.status;
  await ref.update({ status: next, updatedAt: FieldValue.serverTimestamp() });
  res.json({ ok: true, status: next });
});

export default router;
