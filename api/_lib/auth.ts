/**
 * Shared Firebase ID-token verification for Vercel API functions.
 *
 * Routes through the shared credentialed app (getAdminApp) so it can never
 * create a second, un-credentialed app. This matters because both this module
 * and getDb() lazily initialise Admin and reuse getApps()[0]: whichever runs
 * first wins. If this module initialised a keyless projectId-only app and a
 * handler verified the token BEFORE calling getDb() (e.g. /api/email/order),
 * getDb() would inherit the keyless app and every Firestore call would fail
 * with "Could not load the default credentials". Using getAdminApp() here
 * guarantees the credentialed app regardless of call order.
 */
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { getAdminApp } from './firebaseAdmin.js';

let _adminAuth: ReturnType<typeof getAuth> | null = null;

function getAdminAuth(): ReturnType<typeof getAuth> {
  if (!_adminAuth) {
    _adminAuth = getAuth(getAdminApp());
  }
  return _adminAuth;
}

/** Extract a Bearer token from an Authorization header value. */
export function extractBearer(authHeader: string | undefined): string | undefined {
  if (!authHeader) return undefined;
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
}

/** Verify a Firebase ID token. Returns null on missing/invalid token. */
export async function verifyIdToken(authHeader: string | undefined): Promise<DecodedIdToken | null> {
  const token = extractBearer(authHeader);
  if (!token) return null;
  try {
    return await getAdminAuth().verifyIdToken(token);
  } catch {
    return null;
  }
}
