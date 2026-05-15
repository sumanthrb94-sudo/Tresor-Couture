import { Router } from 'express';
import { z } from 'zod';
import { db, FieldValue } from '../firebase';
import { requireAdmin, requireAuth, type AuthedRequest } from '../auth';

const router = Router();

const ReviewBody = z.object({
  fabricId: z.string().min(1),
  rating:   z.number().int().min(1).max(5),
  title:    z.string().max(120).optional(),
  body:     z.string().min(4).max(2000),
  authorName: z.string().min(1)
});

/**
 * GET /reviews?fabricId=X — approved reviews for a product.
 */
router.get('/', async (req, res) => {
  const fabricId = String(req.query.fabricId ?? '');
  if (!fabricId) {
    res.status(400).json({ error: 'missing_fabricId' });
    return;
  }
  const status = req.query.status ?? 'approved';
  const snap = await db.collection('reviews')
    .where('fabricId', '==', fabricId)
    .where('status', '==', status)
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();
  res.json({ reviews: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
});

/**
 * POST /reviews — signed-in users can leave a review. Goes into 'pending'
 * for admin moderation.
 */
router.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = ReviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });
    return;
  }
  const ref = db.collection('reviews').doc();
  const review = {
    id: ref.id,
    userId: req.uid,
    status: 'pending' as const,
    createdAt: new Date().toISOString(),
    ...parsed.data
  };
  await ref.set({ ...review, createdAtServer: FieldValue.serverTimestamp() });
  res.status(201).json({ review });
});

/**
 * PATCH /reviews/:id — admin moderation (approve / reject).
 */
router.patch('/:id', requireAdmin, async (req, res) => {
  const Body = z.object({ status: z.enum(['pending', 'approved', 'rejected']) });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });
    return;
  }
  const ref = db.collection('reviews').doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  await ref.update({ status: parsed.data.status });
  res.json({ ok: true, status: parsed.data.status });
});

/**
 * DELETE /reviews/:id — admin only.
 */
router.delete('/:id', requireAdmin, async (req, res) => {
  await db.collection('reviews').doc(req.params.id).delete();
  res.json({ ok: true, id: req.params.id });
});

export default router;
