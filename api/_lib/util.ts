// Shared helpers for Vercel serverless functions.
//
// Keyless by design: Firebase ID tokens are verified with the Admin SDK
// initialised with ONLY a projectId — token verification fetches Google's
// public keys over HTTPS and needs no service-account key (which org policy
// blocks anyway). Secrets (Brevo) live in Vercel env, never in the client.

import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { DecodedIdToken } from 'firebase-admin/auth';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'tresor-couture';
const adminApp = getApps()[0] ?? initializeApp({ projectId: PROJECT_ID });

export function setCors(res: any): void {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

/** Verify a Firebase ID token (keyless). Returns the decoded token or null. */
export async function verifyIdToken(authHeader: string | undefined): Promise<DecodedIdToken | null> {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  if (!token) return null;
  try {
    return await getAuth(adminApp).verifyIdToken(token);
  } catch {
    return null;
  }
}

const BREVO = 'https://api.brevo.com/v3';

function brevoHeaders() {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error('BREVO_API_KEY is not configured');
  return { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' };
}

/** Send a transactional email via Brevo. */
export async function brevoSendEmail(args: {
  to: { email: string; name?: string };
  subject: string;
  htmlContent: string;
  textContent?: string;
}): Promise<void> {
  const sender = {
    email: process.env.BREVO_SENDER_EMAIL || 'no-reply@tresorcouture.in',
    name: process.env.BREVO_SENDER_NAME || 'Tresor Couture',
  };
  const r = await fetch(`${BREVO}/smtp/email`, {
    method: 'POST',
    headers: brevoHeaders(),
    body: JSON.stringify({ sender, to: [args.to], subject: args.subject, htmlContent: args.htmlContent, textContent: args.textContent }),
  });
  if (!r.ok) throw new Error(`brevo email ${r.status}: ${await r.text()}`);
}

/** Upsert a contact into the marketing list. */
export async function brevoAddContact(email: string, attributes: Record<string, unknown> = {}): Promise<void> {
  const listId = process.env.BREVO_LIST_ID ? Number(process.env.BREVO_LIST_ID) : undefined;
  const r = await fetch(`${BREVO}/contacts`, {
    method: 'POST',
    headers: brevoHeaders(),
    body: JSON.stringify({ email, attributes, updateEnabled: true, ...(listId ? { listIds: [listId] } : {}) }),
  });
  // 201 created, 204 updated. Brevo returns 400 "Contact already exist" only
  // when updateEnabled is false — we set it true, so treat <300 as success.
  if (!r.ok && r.status !== 204) throw new Error(`brevo contact ${r.status}: ${await r.text()}`);
}

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function rupee(n: number): string {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

export function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
