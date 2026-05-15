import { Router } from 'express';
import { z } from 'zod';
import { db } from '../firebase';
import { requireAdmin } from '../auth';

const router = Router();

const CouponBody = z.object({
  code: z.string().min(2).max(40),
  description: z.string().min(1),
  kind: z.enum(['percent', 'flat']),
  value: z.number().positive(),
  minSubtotal: z.number().nonnegative().optional(),
  maxDiscount: z.number().positive().optional(),
  expiresAt: z.string().datetime().optional(),
  active: z.boolean().default(true)
});

/**
 * GET /coupons — admin list.
 */
router.get('/', requireAdmin, async (_req, res) => {
  const snap = await db.collection('coupons').limit(200).get();
  res.json({ coupons: snap.docs.map(d => ({ ...d.data() })) });
});

/**
 * POST /coupons — admin create.
 */
router.post('/', requireAdmin, async (req, res) => {
  const parsed = CouponBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });
    return;
  }
  const code = parsed.data.code.toUpperCase();
  const coupon = { ...parsed.data, code };
  await db.collection('coupons').doc(code).set(coupon);
  res.status(201).json({ coupon });
});

/**
 * PATCH /coupons/:code — admin update.
 */
router.patch('/:code', requireAdmin, async (req, res) => {
  const code = req.params.code.toUpperCase();
  const parsed = CouponBody.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });
    return;
  }
  const ref = db.collection('coupons').doc(code);
  if (!(await ref.get()).exists) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  await ref.update(parsed.data);
  res.json({ coupon: (await ref.get()).data() });
});

/**
 * DELETE /coupons/:code — admin only.
 */
router.delete('/:code', requireAdmin, async (req, res) => {
  await db.collection('coupons').doc(req.params.code.toUpperCase()).delete();
  res.json({ ok: true, code: req.params.code.toUpperCase() });
});

/**
 * POST /coupons/validate — public; checks code + subtotal and returns
 * applicable discount.
 * Body: { code, subtotal }
 */
router.post('/validate', async (req, res) => {
  const Body = z.object({ code: z.string().min(1), subtotal: z.number().nonnegative() });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });
    return;
  }
  const code = parsed.data.code.toUpperCase();
  const snap = await db.collection('coupons').doc(code).get();
  if (!snap.exists) {
    res.status(404).json({ valid: false, reason: 'not_found' });
    return;
  }
  const c = snap.data() as { active: boolean; kind: 'percent' | 'flat'; value: number; minSubtotal?: number; maxDiscount?: number; expiresAt?: string };
  if (!c.active)                                                    { res.json({ valid: false, reason: 'inactive' });   return; }
  if (c.expiresAt && new Date(c.expiresAt).getTime() < Date.now())  { res.json({ valid: false, reason: 'expired' });    return; }
  if (c.minSubtotal && parsed.data.subtotal < c.minSubtotal)        { res.json({ valid: false, reason: 'min_subtotal', minSubtotal: c.minSubtotal }); return; }

  const discount = c.kind === 'percent'
    ? Math.min(c.maxDiscount ?? Infinity, Math.round(parsed.data.subtotal * (c.value / 100)))
    : c.value;
  res.json({ valid: true, code, discount });
});

export default router;
