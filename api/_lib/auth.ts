/**
 * Firebase ID-token verification for the serverless API.
 *
 * The browser sends its Firebase ID token as `Authorization: Bearer <token>`.
 * We verify it against Google's public keys via the Admin SDK (keyless — only
 * a projectId is needed), and hand back the decoded claims. The `uid` and
 * `email` here are TRUSTWORTHY (Google-signed) — unlike anything in the request
 * body — so callers should derive ownership (e.g. order.userId) from this, not
 * from client-supplied fields.
 */
import { getAuth } from 'firebase-admin/auth';
import { getAdminApp } from './firebaseAdmin.js';
import { header, type ApiRequest } from './http.js';

export interface DecodedToken {
  uid: string;
  email?: string;
  name?: string;
  email_verified?: boolean;
  [claim: string]: unknown;
}

/** Verify a raw `Authorization` header value. Returns the decoded token, or
 *  null when the header is missing/malformed/invalid/expired. Never throws. */
export async function verifyBearer(
  authHeader: string | string[] | undefined,
): Promise<DecodedToken | null> {
  const raw = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  const token = raw?.startsWith('Bearer ') ? raw.slice(7) : raw;
  if (!token) return null;
  try {
    const decoded = await getAuth(getAdminApp()).verifyIdToken(token);
    return decoded as unknown as DecodedToken;
  } catch {
    return null;
  }
}

/** Convenience: pull + verify the bearer token straight off a request. */
export function verifyRequest(req: ApiRequest): Promise<DecodedToken | null> {
  return verifyBearer(header(req, 'authorization'));
}
