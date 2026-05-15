import { Router } from 'express';
import { z } from 'zod';
import { db } from '../firebase';
import { requireAdmin, requireAuth, type AuthedRequest } from '../auth';

const router = Router();

const ProfileUpdate = z.object({
  fullName: z.string().min(2).optional(),
  phone:    z.string().optional(),
  defaultAddress: z.object({
    fullName:   z.string(),
    email:      z.string().email(),
    phone:      z.string(),
    line1:      z.string(),
    line2:      z.string().optional(),
    city:       z.string(),
    state:      z.string(),
    postalCode: z.string(),
    country:    z.string()
  }).optional()
});

/**
 * GET /users/me — current user profile.
 */
router.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const snap = await db.collection('users').doc(req.uid!).get();
  if (!snap.exists) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({ user: snap.data(), isAdmin: req.isAdmin === true });
});

/**
 * PATCH /users/me — update current user profile.
 */
router.patch('/me', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = ProfileUpdate.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });
    return;
  }
  const ref = db.collection('users').doc(req.uid!);
  await ref.set(parsed.data, { merge: true });
  const snap = await ref.get();
  res.json({ user: snap.data() });
});

/**
 * GET /users — admin list (paginated).
 */
router.get('/', requireAdmin, async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const snap = await db.collection('users').limit(limit).get();
  res.json({ users: snap.docs.map(d => ({ ...d.data() })) });
});

export default router;
