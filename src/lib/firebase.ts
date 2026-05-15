/**
 * Frontend Firebase SDK bootstrap. The API key here is the public
 * project identifier (not a secret) — Firebase API keys gate request
 * routing, not authorisation. Real security lives in Firestore rules
 * and the Cloud Function auth middleware.
 *
 * Lazily imports the Auth/Firestore packages so they don't get
 * statically baked into the initial bundle. Call getApi() to obtain
 * a configured client that automatically attaches the current Firebase
 * ID token to outgoing requests.
 */

// Vite injects env vars on import.meta.env; cast lazily so we don't need a
// vite-env.d.ts file for this single consumer.
const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

export const firebaseConfig = {
  apiKey:            env.VITE_FIREBASE_API_KEY            ?? 'AIzaSyAIct4PdHb0YaNCYpLdGxh1kDlukwwc_3M',
  authDomain:        env.VITE_FIREBASE_AUTH_DOMAIN        ?? 'tresor-couture.firebaseapp.com',
  projectId:         env.VITE_FIREBASE_PROJECT_ID         ?? 'tresor-couture',
  storageBucket:     env.VITE_FIREBASE_STORAGE_BUCKET     ?? 'tresor-couture.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '102541847727',
  appId:             env.VITE_FIREBASE_APP_ID             ?? '1:102541847727:web:40ef34c4ec6d001c20f85a'
};

/** Base URL for the REST API (Firebase Hosting rewrites /api/** → api function). */
export const API_BASE = env.VITE_API_BASE_URL ?? '/api';

let cachedIdToken: string | null = null;
export const setIdToken = (token: string | null) => { cachedIdToken = token; };
export const getIdToken = () => cachedIdToken;

/**
 * Tiny REST client. Pass `auth: true` to attach the current ID token.
 *   await api.get('/products');
 *   await api.post('/orders', { items, shippingAddress, paymentMethod }, { auth: true });
 */
export const api = {
  get:    (path: string, opts: { auth?: boolean } = {}) => request('GET',    path, undefined, opts),
  post:   (path: string, body?: unknown, opts: { auth?: boolean } = {}) => request('POST',   path, body, opts),
  patch:  (path: string, body?: unknown, opts: { auth?: boolean } = {}) => request('PATCH',  path, body, opts),
  delete: (path: string, opts: { auth?: boolean } = {}) => request('DELETE', path, undefined, opts)
};

async function request<T>(method: string, path: string, body: unknown, opts: { auth?: boolean }): Promise<T> {
  const headers: Record<string, string> = body !== undefined ? { 'content-type': 'application/json' } : {};
  if (opts.auth && cachedIdToken) headers['authorization'] = `Bearer ${cachedIdToken}`;
  const resp = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = new Error((data as { message?: string }).message ?? `HTTP ${resp.status}`);
    (err as Error & { status?: number; body?: unknown }).status = resp.status;
    (err as Error & { status?: number; body?: unknown }).body = data;
    throw err;
  }
  return data as T;
}
