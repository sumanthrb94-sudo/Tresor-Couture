import { Router } from 'express';
import { z } from 'zod';
import { db, FieldValue } from '../firebase';
import { requireAdmin } from '../auth';
import type { Product } from '../types';

const router = Router();

const MASTER_CATEGORIES = [
  'Fabrics', 'Dyeable Fabrics', 'Lace', 'Sarees', 'Lehenga Cholis',
  'Anarkalis', 'Western Wear', 'Studios Prêt'
] as const;

const ProductBody = z.object({
  brand: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  pricePerMeter: z.number().nonnegative(),
  mrpPerMeter: z.number().nonnegative(),
  photo: z.string().url().or(z.string().startsWith('/')),
  photoGallery: z.array(z.string()).optional(),
  image: z.string(),
  category: z.enum(['Silk', 'Cotton', 'Wool', 'Linen', 'Mixed', 'Satin']),
  masterCategory: z.enum(MASTER_CATEGORIES),
  subCategory: z.string().optional(),
  origin: z.string().min(1),
  tags: z.array(z.string()).default([]),
  sticker: z.enum(['Trending', 'Bestseller', 'New In', 'Limited']).optional(),
  colors: z.array(z.object({ name: z.string(), hex: z.string() })).optional(),
  lengthOptions: z.array(z.number()).optional(),
  widthInches: z.number().optional(),
  inStockMeters: z.number().optional(),
  weaveType: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
  reviewCount: z.number().nonnegative().optional()
});

/**
 * GET /products — list with optional filtering.
 * Query: ?masterCategory=Sarees&subCategory=Half%20Sarees&limit=50
 */
router.get('/', async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 100), 200);
  let q: FirebaseFirestore.Query = db.collection('products');
  if (req.query.masterCategory) q = q.where('masterCategory', '==', req.query.masterCategory);
  if (req.query.subCategory)    q = q.where('subCategory',    '==', req.query.subCategory);
  if (req.query.sticker)        q = q.where('sticker',        '==', req.query.sticker);
  const snap = await q.limit(limit).get();
  res.json({ products: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
});

/**
 * GET /products/:id
 */
router.get('/:id', async (req, res) => {
  const doc = await db.collection('products').doc(req.params.id).get();
  if (!doc.exists) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({ product: { id: doc.id, ...doc.data() } });
});

/**
 * POST /products — admin only.
 */
router.post('/', requireAdmin, async (req, res) => {
  const parsed = ProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });
    return;
  }
  const doc = db.collection('products').doc();
  const product: Product = {
    id: doc.id,
    ...parsed.data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await doc.set(product);
  res.status(201).json({ product });
});

/**
 * PATCH /products/:id — admin only.
 */
router.patch('/:id', requireAdmin, async (req, res) => {
  const parsed = ProductBody.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });
    return;
  }
  const ref = db.collection('products').doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  await ref.update({ ...parsed.data, updatedAt: new Date().toISOString() });
  const updated = await ref.get();
  res.json({ product: { id: updated.id, ...updated.data() } });
});

/**
 * DELETE /products/:id — admin only.
 */
router.delete('/:id', requireAdmin, async (req, res) => {
  const ref = db.collection('products').doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  await ref.delete();
  res.json({ ok: true, id: req.params.id });
});

/**
 * POST /products/bulk — admin only. Seed many products in one call.
 * Body: { products: [...ProductBody] }
 */
router.post('/bulk', requireAdmin, async (req, res) => {
  const Body = z.object({ products: z.array(ProductBody).min(1).max(500) });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });
    return;
  }
  const batch = db.batch();
  const created: string[] = [];
  for (const input of parsed.data.products) {
    const ref = db.collection('products').doc();
    batch.set(ref, {
      id: ref.id,
      ...input,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    created.push(ref.id);
  }
  await batch.commit();
  res.status(201).json({ ok: true, count: created.length, ids: created });
});

export default router;
