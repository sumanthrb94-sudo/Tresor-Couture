import express from 'express';
import cors from 'cors';
import { onRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';

import { parseAuth } from './auth';
import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import orderRoutes from './routes/orders';
import userRoutes from './routes/users';
import reviewRoutes from './routes/reviews';
import couponRoutes from './routes/coupons';

setGlobalOptions({ region: 'asia-south1', memory: '512MiB', timeoutSeconds: 30 });

// Web API key — used by /auth/login to call signInWithPassword.
// Set via:  firebase functions:secrets:set FIREBASE_WEB_API_KEY
const FIREBASE_WEB_API_KEY = defineSecret('FIREBASE_WEB_API_KEY');

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));
app.use(parseAuth);

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'tresor-couture-api', time: new Date().toISOString() });
});

app.use('/auth',     authRoutes);
app.use('/products', productRoutes);
app.use('/orders',   orderRoutes);
app.use('/users',    userRoutes);
app.use('/reviews',  reviewRoutes);
app.use('/coupons',  couponRoutes);

app.use((_req, res) => res.status(404).json({ error: 'not_found' }));

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[api] unhandled', err);
  res.status(500).json({ error: 'internal', message: err.message });
});

/**
 * Public HTTPS Cloud Function. Mounted by Firebase Hosting at /api/**
 * (see firebase.json rewrites) so the deployed URL is:
 *   https://tresor-couture.web.app/api/products
 * Direct function URL:
 *   https://<region>-tresor-couture.cloudfunctions.net/api/products
 */
export const api = onRequest(
  { secrets: [FIREBASE_WEB_API_KEY], cors: true },
  app
);
