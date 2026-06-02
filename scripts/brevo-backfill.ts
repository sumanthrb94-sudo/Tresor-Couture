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
 *   # import existing users into the Brevo list:
 *   BREVO_API_KEY=xkeysib-... BREVO_LIST_ID=2 npx tsx scripts/brevo-backfill.ts
 *
 *   # ALSO send each existing user a "Welcome to Tresor Couture" email:
 *   BREVO_API_KEY=xkeysib-... BREVO_LIST_ID=2 BREVO_SENDER_EMAIL=hello@tresorcouture.in \
 *     npx tsx scripts/brevo-backfill.ts --welcome
 *
 * --welcome sends ONE transactional welcome per user. Run it once (re-running
 * will email everyone again).
 */

import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'tresor-couture';
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const LIST_ID = process.env.BREVO_LIST_ID ? Number(process.env.BREVO_LIST_ID) : undefined;
const SEND_WELCOME = process.argv.includes('--welcome');
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'hello@tresorcouture.in';
const SENDER_NAME = process.env.BREVO_SENDER_NAME || 'Tresor Couture';

function welcomeHtml(first: string): string {
  return `<!doctype html><html><body style="margin:0;background:#FBF7EE;font-family:Georgia,'Times New Roman',serif;color:#2A1F12;">
    <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
      <h1 style="font-size:24px;letter-spacing:.04em;margin:0 0 6px;">TRESOR COUTURE</h1>
      <p style="color:#8A7656;font-size:12px;text-transform:uppercase;letter-spacing:.18em;margin:0 0 22px;">Welcome to the atelier</p>
      <p style="font-size:16px;">Dear ${first || 'there'}, welcome to Tresor Couture.</p>
      <p style="font-size:15px;line-height:1.6;color:#3a3026;">You have access to our ledger of heritage Indian weaves — Banarasi, Patola, Jamdani, Kanjivaram and more — shipped worldwide. Members get a saved wishlist, faster checkout, and early access to bridal drops.</p>
      <p style="font-size:15px;line-height:1.6;color:#3a3026;">Here is <b>10% off your next order</b> with code <b>WELCOME10</b>.</p>
      <p style="margin-top:24px;"><a href="https://tresorcouture.in/#/shop" style="background:#7A1F2C;color:#fff;text-decoration:none;padding:12px 22px;border-radius:4px;font-family:Arial,sans-serif;font-size:14px;">Explore the collection</a></p>
      <p style="font-size:12px;color:#8A7656;margin-top:28px;">Hand-woven heritage · 40-minute delivery across Hyderabad · free shipping over ₹1,999.</p>
    </div></body></html>`;
}

async function sendWelcome(email: string, name: string): Promise<boolean> {
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY as string, 'content-type': 'application/json' },
    body: JSON.stringify({
      sender: { email: SENDER_EMAIL, name: SENDER_NAME },
      to: [{ email, name }],
      subject: 'Welcome to Tresor Couture',
      htmlContent: welcomeHtml((name || '').split(' ')[0]),
      textContent: `Welcome to Tresor Couture, ${name || 'there'}. Enjoy 10% off with code WELCOME10. https://tresorcouture.in/#/shop`,
    }),
  });
  if (!r.ok) { console.error(`  ✗ welcome ${email} ${r.status}: ${await r.text()}`); return false; }
  return true;
}

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

  if (SEND_WELCOME) {
    console.log(`▸ Sending welcome emails to ${contacts.length} users...`);
    let sent = 0;
    for (const c of contacts) {
      const ok = await sendWelcome(c.email, String((c.attributes as any).FIRSTNAME || ''));
      if (ok) sent++;
      // Gentle pacing to stay under Brevo rate limits.
      await new Promise(r => setTimeout(r, 120));
    }
    console.log(`✓ Welcome emails sent: ${sent}/${contacts.length}.`);
  } else {
    console.log('ℹ Re-run with --welcome to also send the welcome email to each user.');
  }
}

main().catch(err => { console.error('✗ Backfill failed:', err); process.exit(1); });
