import { Router } from 'express';
import { z } from 'zod';
import { auth as adminAuth, db } from '../firebase';
import { requireAuth, type AuthedRequest } from '../auth';

const router = Router();

const RegisterBody = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(2),
  phone: z.string().optional()
});

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

/**
 * POST /auth/register — create a Firebase Auth user + profile doc.
 * Body: { email, password, fullName, phone? }
 * Returns: { uid, idToken, user }
 */
router.post('/register', async (req, res) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });
    return;
  }
  const { email, password, fullName, phone } = parsed.data;

  try {
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: fullName,
      phoneNumber: phone && phone.startsWith('+') ? phone : undefined
    });

    const profile = {
      uid: userRecord.uid,
      email,
      fullName,
      phone: phone ?? null,
      role: 'customer' as const,
      createdAt: new Date().toISOString()
    };
    await db.collection('users').doc(userRecord.uid).set(profile);

    const idToken = await issueIdToken(userRecord.uid, email, password);

    res.status(201).json({ uid: userRecord.uid, idToken, user: profile });
  } catch (err) {
    const e = err as { code?: string; message?: string };
    if (e.code === 'auth/email-already-exists') {
      res.status(409).json({ error: 'email_taken', message: 'An account with this email already exists.' });
      return;
    }
    res.status(500).json({ error: 'register_failed', message: e.message ?? 'Unknown error' });
  }
});

/**
 * POST /auth/login — exchange email/password for a Firebase ID token.
 * Body: { email, password }
 * Returns: { uid, idToken, refreshToken, user }
 *
 * Implementation note: Firebase Admin SDK can't verify passwords directly;
 * it can only mint custom tokens. To return an ID token here we proxy to
 * the Firebase Auth REST endpoint (signInWithPassword) using the project
 * API key. This is the canonical pattern for server-side login.
 */
router.post('/login', async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });
    return;
  }
  const { email, password } = parsed.data;

  try {
    const tokens = await signInWithPassword(email, password);
    const profileSnap = await db.collection('users').doc(tokens.localId).get();
    const profile = profileSnap.exists ? profileSnap.data() : null;
    res.json({
      uid: tokens.localId,
      idToken: tokens.idToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      user: profile
    });
  } catch (err) {
    const e = err as Error;
    res.status(401).json({ error: 'invalid_credentials', message: e.message });
  }
});

/**
 * GET /auth/me — current user profile from a Bearer ID token.
 */
router.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const snap = await db.collection('users').doc(req.uid!).get();
  if (!snap.exists) {
    res.status(404).json({ error: 'profile_not_found' });
    return;
  }
  res.json({ user: snap.data(), isAdmin: req.isAdmin === true });
});

/**
 * POST /auth/promote — promote a user to admin (admin custom claim).
 * Bootstrapping note: the FIRST admin must be promoted manually via the
 * Firebase console (set custom claim {admin:true} on a user) or via the
 * gcloud / admin SDK from a privileged environment. After that, existing
 * admins can promote others through this endpoint.
 * Body: { uid }
 */
router.post('/promote', requireAuth, async (req: AuthedRequest, res) => {
  if (!req.isAdmin) {
    res.status(403).json({ error: 'forbidden', message: 'Only admins can promote.' });
    return;
  }
  const targetUid = String(req.body?.uid ?? '');
  if (!targetUid) {
    res.status(400).json({ error: 'missing_uid' });
    return;
  }
  await adminAuth.setCustomUserClaims(targetUid, { admin: true });
  await db.collection('users').doc(targetUid).update({ role: 'admin' });
  res.json({ ok: true, uid: targetUid });
});

export default router;

// ---- helpers ----

async function signInWithPassword(email: string, password: string): Promise<{
  localId: string;
  idToken: string;
  refreshToken: string;
  expiresIn: string;
}> {
  const apiKey = process.env.FIREBASE_WEB_API_KEY;
  if (!apiKey) {
    throw new Error('FIREBASE_WEB_API_KEY is not configured. Set it via `firebase functions:secrets:set FIREBASE_WEB_API_KEY`.');
  }
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });
  if (!resp.ok) {
    const errBody = await resp.json().catch(() => ({}));
    const msg = (errBody as { error?: { message?: string } }).error?.message ?? `HTTP ${resp.status}`;
    throw new Error(msg);
  }
  return resp.json() as Promise<{
    localId: string;
    idToken: string;
    refreshToken: string;
    expiresIn: string;
  }>;
}

async function issueIdToken(uid: string, email: string, password: string): Promise<string> {
  try {
    const tokens = await signInWithPassword(email, password);
    return tokens.idToken;
  } catch {
    // Fallback: return a custom token the client can exchange.
    return adminAuth.createCustomToken(uid);
  }
}
