/**
 * Inspect / update the Firebase Authentication "Authorized domains" list — the
 * allowlist that decides which origins may run Google/email sign-in. A domain
 * missing here causes auth/unauthorized-domain (Google login silently fails).
 *
 * Uses the Admin SDK service-account credential to call the Identity Toolkit
 * admin API. Requires GOOGLE_APPLICATION_CREDENTIALS.
 *
 *   npx tsx scripts/auth-domains.ts                     # list current domains
 *   npx tsx scripts/auth-domains.ts --add tresorcouture.in www.tresorcouture.in
 */

import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';

const cred = applicationDefault();
if (!getApps().length) initializeApp({ credential: cred });

const PROJECT = process.env.FIREBASE_PROJECT_ID || 'tresor-couture';

async function token(): Promise<string> {
  const t = await cred.getAccessToken();
  return t.access_token;
}

async function main() {
  const args = process.argv.slice(2);
  const addIdx = args.indexOf('--add');
  const url = `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT}/config`;
  const access = await token();

  const res = await fetch(url, { headers: { Authorization: `Bearer ${access}` } });
  const cfg = await res.json() as { authorizedDomains?: string[]; error?: { message: string } };
  if (cfg.error) { console.error('GET failed:', cfg.error.message); process.exit(1); }
  console.log('Current authorized domains:');
  for (const d of cfg.authorizedDomains ?? []) console.log(`  • ${d}`);

  if (addIdx !== -1) {
    const toAdd = args.slice(addIdx + 1).filter(a => !a.startsWith('--')).map(s => s.trim());
    const merged = Array.from(new Set([...(cfg.authorizedDomains ?? []), ...toAdd]));
    const patch = await fetch(`${url}?updateMask=authorizedDomains`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ authorizedDomains: merged }),
    });
    const out = await patch.json() as { authorizedDomains?: string[]; error?: { message: string } };
    if (out.error) { console.error('PATCH failed:', out.error.message); process.exit(1); }
    console.log('\nUpdated authorized domains:');
    for (const d of out.authorizedDomains ?? []) console.log(`  • ${d}`);
  }
}

main().catch(err => { console.error('✗ auth-domains failed:', err); process.exit(1); });
