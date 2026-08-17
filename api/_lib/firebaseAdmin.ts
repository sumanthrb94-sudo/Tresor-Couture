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

/**
 * The single, credentialed Admin app for this serverless instance. Every module
 * that needs Admin (Firestore via getDb, Auth via auth.ts) MUST route through
 * this so the FIRST initializer wins with real credentials. Previously auth.ts
 * initialised a keyless projectId-only app; if token verification ran before
 * getDb() (as in /api/email/order), getDb() reused that keyless app and every
 * Firestore call failed with "Could not load the default credentials".
 */
export function getAdminApp(): App {
  return buildApp();
}

export function getDb(): Firestore {
  if (cachedDb) return cachedDb;
  const app = buildApp();
  cachedDb = getFirestore(app);
  return cachedDb;
}

/** True only when real Admin SDK credentials are available. The keyless
 *  projectId-only initialisation can verify ID tokens but cannot write
 *  Firestore, so it must not be treated as "configured" for state-changing
 *  endpoints. */
export function firebaseAdminConfigured(): boolean {
  return Boolean(
    (process.env.FIREBASE_SERVICE_ACCOUNT && process.env.FIREBASE_SERVICE_ACCOUNT.trim()) ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      // The Firestore emulator accepts any credentials, so a projectId-only app
      // really can write when this is set. Vercel never sets it; setting it is
      // an explicit choice to point at a local emulator. Without this allowance
      // no state-changing endpoint could be tested at all.
      process.env.FIRESTORE_EMULATOR_HOST,
  );
}
