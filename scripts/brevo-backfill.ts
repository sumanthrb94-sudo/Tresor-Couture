/**
 * One-time backfill: push EXISTING signed-up users (email / Google — anyone
 * with an email on their users/{uid} profile) into the Brevo marketing list.
 * Phone-only users without an email are skipped (Brevo lists are email-keyed).
 *
 * Uses the Firebase Admin SDK via Application Default Credentials — NO
 * service-account key file (the org policy blocks key creation; ADC via gcloud
 * does not need one).
 *
 *   # one-time auth (if not already done for the seed script):
 *   gcloud auth application-default login
 *
 *   # then, with your Brevo creds in the environment:
 *   BREVO_API_KEY=xkeysib-... BREVO_LIST_ID=2 npx tsx scripts/brevo-backfill.ts
 */

import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'tresor-couture';
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const LIST_ID = process.env.BREVO_LIST_ID ? Number(process.env.BREVO_LIST_ID) : undefined;

if (!BREVO_API_KEY || !LIST_ID) {
  console.error('✗ Set BREVO_API_KEY and BREVO_LIST_ID in the environment first.');
  process.exit(1);
}

if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const db = getFirestore();

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

async function main() {
  console.log(`▸ Project: ${PROJECT_ID} · Brevo list: ${LIST_ID}`);
  const snap = await db.collection('users').get();
  const contacts: { email: string; attributes: Record<string, unknown> }[] = [];
  const seen = new Set<string>();

  snap.forEach(doc => {
    const d = doc.data() as { email?: string; fullName?: string };
    const email = (d.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email) || seen.has(email)) return;
    seen.add(email);
    contacts.push({ email, attributes: { FIRSTNAME: (d.fullName || '').split(' ')[0] || undefined, SIGNUP_SOURCE: 'backfill' } });
  });

  console.log(`▸ ${snap.size} user docs · ${contacts.length} with a usable email`);
  if (!contacts.length) { console.log('Nothing to import.'); return; }

  // Brevo bulk import (handles create + update). Chunk to stay well under limits.
  const CHUNK = 500;
  let imported = 0;
  for (let i = 0; i < contacts.length; i += CHUNK) {
    const batch = contacts.slice(i, i + CHUNK);
    const r = await fetch('https://api.brevo.com/v3/contacts/import', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY as string, 'content-type': 'application/json' },
      body: JSON.stringify({ listIds: [LIST_ID], updateExistingContacts: true, emptyContactsAttributes: false, jsonBody: batch }),
    });
    if (!r.ok) { console.error(`✗ import batch ${i / CHUNK} failed ${r.status}: ${await r.text()}`); process.exit(1); }
    imported += batch.length;
    console.log(`  imported ${imported}/${contacts.length}`);
  }
  console.log(`✓ Done. ${imported} contacts queued into Brevo list ${LIST_ID}.`);
}

main().catch(err => { console.error('✗ Backfill failed:', err); process.exit(1); });
