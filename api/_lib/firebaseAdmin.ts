/**
 * Firebase Admin SDK bootstrap for Vercel serverless functions.
 *
 * Credentials come from the environment (NEVER bundled into the client):
 *   - FIREBASE_SERVICE_ACCOUNT : the full service-account JSON, as a single
 *     env var (paste the downloaded key file's contents). Preferred on Vercel.
 *   - GOOGLE_APPLICATION_CREDENTIALS : a path to a service-account JSON file
 *     (the standard Google ADC mechanism). Used as a fallback.
 *   - If neither is set, we fall back to applicationDefault() so the function
 *     still initialises in environments where ADC is implicitly available
 *     (e.g. Google Cloud). On Vercel without credentials, Firestore calls will
 *     fail — the calling handler is expected to gate on Razorpay config first.
 *
 * The Admin SDK bypasses Firestore security rules, so all authority checks
 * (amount recomputation, stock) live in the handler code, not the rules.
 */
import {
  initializeApp,
  getApps,
  cert,
  applicationDefault,
  type App,
} from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let cachedDb: Firestore | null = null;

function buildApp(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0]!;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw && raw.trim()) {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON');
    }
    // Vercel often stores the private key with literal "\n" sequences; restore
    // them to real newlines so the PEM parses.
    const pk = parsed.private_key;
    if (typeof pk === 'string') {
      parsed.private_key = pk.replace(/\\n/g, '\n');
    }
    return initializeApp({ credential: cert(parsed as never) });
  }

  // Keyless fallback (matches main's email functions): if the org policy blocks
  // service-account key creation, initialise with just the projectId. Firestore
  // Admin can still authenticate via the platform's default credentials / ADC.
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'tresor-couture';
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return initializeApp({ projectId });
  }

  // GOOGLE_APPLICATION_CREDENTIALS (a file path) is picked up automatically by
  // applicationDefault(); this branch also covers GCP metadata-server creds.
  return initializeApp({ credential: applicationDefault() });
}

export function getDb(): Firestore {
  if (cachedDb) return cachedDb;
  const app = buildApp();
  cachedDb = getFirestore(app);
  return cachedDb;
}

/** True when the Admin SDK can initialise: an explicit credential, or the
 *  keyless projectId path (which matches main's email functions running on
 *  Vercel where the org blocks service-account key creation). */
export function firebaseAdminConfigured(): boolean {
  return Boolean(
    (process.env.FIREBASE_SERVICE_ACCOUNT && process.env.FIREBASE_SERVICE_ACCOUNT.trim()) ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.FIREBASE_PROJECT_ID ||
      process.env.GCLOUD_PROJECT,
  );
}
