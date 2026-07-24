/**
 * TEST ONLY — seed two users into the local Firebase Auth + Firestore emulators
 * for the live-chat end-to-end test:
 *   - customer@test.local (role customer)
 *   - admin@test.local    (role admin, `admin: true` custom claim)
 *
 * Requires the emulators to be running and these env vars set:
 *   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'demo-tresor';
if (!getApps().length) initializeApp({ projectId: PROJECT_ID });

const auth = getAuth();
const db = getFirestore();

const PASSWORD = 'Test1234!';

async function ensureUser(email: string, fullName: string, admin: boolean) {
  let uid: string;
  try {
    const existing = await auth.getUserByEmail(email);
    uid = existing.uid;
  } catch {
    const created = await auth.createUser({ email, emailVerified: true, password: PASSWORD, displayName: fullName });
    uid = created.uid;
  }
  if (admin) await auth.setCustomUserClaims(uid, { admin: true });
  await db.collection('users').doc(uid).set({
    uid,
    email,
    fullName,
    role: admin ? 'admin' : 'customer',
    createdAt: new Date().toISOString(),
  }, { merge: true });
  console.log(`  ✓ ${email} (${uid})${admin ? ' [admin]' : ''}`);
  return uid;
}

async function main() {
  console.log('Seeding emulator users…');
  await ensureUser('customer@test.local', 'Test Customer', false);
  await ensureUser('admin@test.local', 'Atelier Admin', true);
  console.log('Done.');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
