/**
 * Manage admin access for Firebase users by email.
 *
 * Admin access in this app is the `admin: true` custom claim — checked by
 * isAdminUser() in src/lib/firebase.ts and enforced by firestore.rules. Custom
 * claims can only be set with the Admin SDK, so this runs server-side with a
 * service-account credential.
 *
 * Prerequisites
 *   1. Target users must already have SIGNED UP at least once (lookups are by
 *      email; this never creates accounts).
 *   2. Point GOOGLE_APPLICATION_CREDENTIALS at your service-account JSON.
 *
 * Usage (PowerShell)
 *   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\serviceAccount.json"
 *
 *   npm run set-admin -- --list                              # show current admins
 *   npm run set-admin -- a@x.com b@x.com                     # grant admin (additive)
 *   npm run set-admin -- --revoke a@x.com                    # remove admin from one
 *   npm run set-admin -- --exclusive a@x.com b@x.com         # these become the ONLY admins
 *
 * After any change, affected users must SIGN OUT and SIGN IN again (or wait up
 * to an hour) for the new token to carry the updated claim.
 */

import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getAuth, type UserRecord } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}

const auth = getAuth();
const db = getFirestore();

/** Every user that currently carries the admin custom claim. */
async function listAdmins(): Promise<UserRecord[]> {
  const admins: UserRecord[] = [];
  let pageToken: string | undefined;
  do {
    const res = await auth.listUsers(1000, pageToken);
    for (const u of res.users) {
      if (u.customClaims?.admin === true) admins.push(u);
    }
    pageToken = res.pageToken;
  } while (pageToken);
  return admins;
}

async function setAdmin(user: UserRecord, makeAdmin: boolean): Promise<void> {
  const existing = user.customClaims ?? {};
  const next = { ...existing } as Record<string, unknown>;
  if (makeAdmin) next.admin = true;
  else delete next.admin;
  await auth.setCustomUserClaims(user.uid, next);
  await db.collection('users').doc(user.uid).set(
    { uid: user.uid, email: user.email ?? null, role: makeAdmin ? 'admin' : 'customer' },
    { merge: true }
  ).catch(() => {});
}

async function main() {
  const args = process.argv.slice(2);
  const list = args.includes('--list');
  const revoke = args.includes('--revoke');
  const exclusive = args.includes('--exclusive');
  const emails = args.filter(a => !a.startsWith('--')).map(e => e.trim().toLowerCase());

  // --list: just report who is admin and exit.
  if (list) {
    const admins = await listAdmins();
    console.log(`Current admins (${admins.length}):`);
    for (const u of admins) console.log(`  • ${u.email ?? '(no email)'}  [${u.uid}]`);
    if (admins.length === 0) console.log('  (none)');
    process.exit(0);
  }

  if (emails.length === 0) {
    console.error('Usage: npm run set-admin -- [--list | --revoke | --exclusive] <email> [<email> ...]');
    process.exit(1);
  }

  // --exclusive: the given emails become the ONLY admins. Revoke everyone else.
  if (exclusive) {
    console.log(`Making these the ONLY admins: ${emails.join(', ')}\n`);
    const targetSet = new Set(emails);

    // 1) Grant the targets.
    const grantedUids = new Set<string>();
    for (const email of emails) {
      try {
        const user = await auth.getUserByEmail(email);
        await setAdmin(user, true);
        grantedUids.add(user.uid);
        console.log(`  ✓ granted  ${email} (${user.uid})`);
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code === 'auth/user-not-found') console.error(`  ✗ ${email} — no such user. They must sign up once first.`);
        else console.error(`  ✗ ${email} — ${(err as Error).message}`);
      }
    }

    // 2) Revoke every other current admin.
    const admins = await listAdmins();
    let revoked = 0;
    for (const u of admins) {
      const email = (u.email ?? '').toLowerCase();
      if (grantedUids.has(u.uid) || targetSet.has(email)) continue;
      await setAdmin(u, false);
      revoked += 1;
      console.log(`  − revoked  ${u.email ?? '(no email)'} (${u.uid})`);
    }

    console.log(`\nDone. ${grantedUids.size} admin(s) set, ${revoked} other admin(s) removed.`);
    console.log('New admins must SIGN OUT and SIGN IN again for the claim to take effect.');
    process.exit(0);
  }

  // Plain grant / revoke (additive).
  console.log(`${revoke ? 'Revoking' : 'Granting'} admin for: ${emails.join(', ')}\n`);
  let ok = 0;
  for (const email of emails) {
    try {
      const user = await auth.getUserByEmail(email);
      await setAdmin(user, !revoke);
      console.log(`  ✓ ${email} (${user.uid}) — admin ${revoke ? 'removed' : 'granted'}`);
      ok += 1;
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/user-not-found') console.error(`  ✗ ${email} — no such user. They must sign up once first.`);
      else console.error(`  ✗ ${email} — ${(err as Error).message}`);
    }
  }
  console.log(`\nDone: ${ok}/${emails.length} updated.`);
  if (ok > 0 && !revoke) console.log('New admins must SIGN OUT and SIGN IN again for the claim to take effect.');
  process.exit(ok === emails.length ? 0 : 1);
}

main().catch(err => {
  console.error('✗ set-admin failed:', err);
  process.exit(1);
});
