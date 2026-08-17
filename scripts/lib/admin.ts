/**
 * Firestore Admin SDK bootstrap for the maintenance scripts.
 *
 * Every script defaults to the EMULATOR and needs an explicit `--prod` to touch
 * the real project. That default is the point: a script that reaches production
 * unless told otherwise will eventually reach it by accident.
 *
 * Credentials, in order:
 *   1. FIREBASE_SERVICE_ACCOUNT — the JSON key as an environment variable.
 *   2. GOOGLE_APPLICATION_CREDENTIALS — a path to the key file (applicationDefault).
 * The key is never read from, or written to, the repository: this is a public
 * repo, and a service-account key in git is a total compromise of the project.
 */
import { initializeApp, getApps, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

export interface AdminHandle {
  db: Firestore;
  prod: boolean;
  projectId: string;
}

export function initAdmin(argv: string[] = process.argv): AdminHandle {
  const prod = argv.includes('--prod');
  const projectId = prod
    ? (process.env.FIREBASE_PROJECT_ID || 'tresor-couture')
    : (process.env.GCLOUD_PROJECT || 'demo-tresor');

  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (prod && raw?.trim()) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      // A key pasted into a shell keeps its newlines escaped.
      if (typeof parsed.private_key === 'string') parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
      initializeApp({ credential: cert(parsed as never), projectId });
    } else if (prod) {
      initializeApp({ credential: applicationDefault(), projectId });
    } else {
      initializeApp({ projectId });   // the emulator needs no credentials
    }
  }
  return { db: getFirestore(), prod, projectId };
}
