/**
 * Shared Firebase ID-token verification for Vercel API functions.
 *
 * Reuses the already-initialized firebase-admin app from `getDb()` so there
 * is no risk of creating a second, un-credentialed app. Returns the decoded
 * token (uid + email) or null when the token is missing/invalid.
 */
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'tresor-couture';

let _adminAuth: ReturnType<typeof getAuth> | null = null;

function getAdminAuth(): ReturnType<typeof getAuth> {
  if (!_adminAuth) {
    const app = getApps()[0] ?? initializeApp({ projectId: PROJECT_ID });
    _adminAuth = getAuth(app);
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
