import type { NextFunction, Request, Response } from 'express';
import { auth as adminAuth } from './firebase';

export interface AuthedRequest extends Request {
  uid?: string;
  email?: string | null;
  isAdmin?: boolean;
}

/**
 * Verifies the `Authorization: Bearer <Firebase ID token>` header and
 * attaches `uid`, `email`, `isAdmin` to the request. Pass through if no
 * token; routes that require auth call `requireAuth` / `requireAdmin`
 * downstream.
 */
export async function parseAuth(
  req: AuthedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.header('authorization') ?? req.header('Authorization');
  if (!header) return next();

  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return next();

  try {
    const decoded = await adminAuth.verifyIdToken(match[1]);
    req.uid = decoded.uid;
    req.email = decoded.email ?? null;
    req.isAdmin = decoded.admin === true;
  } catch (err) {
    // Bad/expired token — treat as anonymous; downstream guards reject.
    console.warn('[auth] verifyIdToken failed:', (err as Error).message);
  }
  next();
}

export function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.uid) {
    res.status(401).json({ error: 'unauthenticated', message: 'Sign in to access this resource.' });
    return;
  }
  next();
}

export function requireAdmin(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.uid) {
    res.status(401).json({ error: 'unauthenticated' });
    return;
  }
  if (!req.isAdmin) {
    res.status(403).json({ error: 'forbidden', message: 'Admin access required.' });
    return;
  }
  next();
}
