/**
 * Grant or revoke supplier access for Firebase users by email.
 *
 * Supplier access is the `supplier: true` custom claim. It lets someone fill in
 * the consignment form at /supplier and read back only their OWN submissions —
 * nothing else. It is deliberately not `admin`: a consignment partner writing a
 * delivery note has no business editing the live catalogue, the till, or
 * customer records.
 *
 * Custom claims can only be set with the Admin SDK, so this runs server-side
 * with a service-account credential.
 *
 * Prerequisites
 *   1. The supplier must already have SIGNED UP once at tresorcouture.in —
 *      lookups are by email and this never creates accounts.
 *   2. Point GOOGLE_APPLICATION_CREDENTIALS at your service-account JSON.
 *
 * Usage
 *   npm run set-supplier -- --list                  # who can submit today
 *   npm run set-supplier -- mills@example.com       # grant
 *   npm run set-supplier -- --revoke mills@example.com
 *
 * After any change the user must SIGN OUT and SIGN IN again (or wait up to an
 * hour) before the new token carries the claim.
 */

import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getAuth, type UserRecord } from 'firebase-admin/auth';

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}

const auth = getAuth();

async function listSuppliers(): Promise<UserRecord[]> {
  const out: UserRecord[] = [];
  let pageToken: string | undefined;
  do {
    const res = await auth.listUsers(1000, pageToken);
    for (const u of res.users) {
      if (u.customClaims?.supplier === true) out.push(u);
    }
    pageToken = res.pageToken;
  } while (pageToken);
  return out;
}

/** Merge the claim in rather than replacing the claim set: an admin who is also
 *  a supplier must not lose their admin claim to this script. */
async function setSupplier(user: UserRecord, make: boolean): Promise<void> {
  const next = { ...(user.customClaims ?? {}) } as Record<string, unknown>;
  if (make) next.supplier = true;
  else delete next.supplier;
  await auth.setCustomUserClaims(user.uid, next);
}

async function main() {
  const args = process.argv.slice(2);
  const revoke = args.includes('--revoke');
  const emails = args.filter(a => !a.startsWith('--')).map(e => e.trim().toLowerCase());

  if (args.includes('--list')) {
    const rows = await listSuppliers();
    console.log(`Suppliers (${rows.length}):`);
    for (const u of rows) console.log(`  • ${u.email ?? '(no email)'}  [${u.uid}]`);
    if (!rows.length) console.log('  (none)');
    process.exit(0);
  }

  if (!emails.length) {
    console.error('Usage: npm run set-supplier -- [--list | --revoke] <email> [<email> ...]');
    process.exit(1);
  }

  console.log(`${revoke ? 'Revoking' : 'Granting'} supplier access for: ${emails.join(', ')}\n`);
  let ok = 0;
  for (const email of emails) {
    try {
      const user = await auth.getUserByEmail(email);
      await setSupplier(user, !revoke);
      console.log(`  ✓ ${email} (${user.uid}) — supplier ${revoke ? 'removed' : 'granted'}`);
      ok += 1;
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/user-not-found') {
        console.error(`  ✗ ${email} — no such user. Ask them to sign up once at tresorcouture.in first.`);
      } else {
        console.error(`  ✗ ${email} — ${(err as Error).message}`);
      }
    }
  }
  console.log(`\nDone: ${ok}/${emails.length} updated.`);
  if (ok > 0 && !revoke) console.log('They must SIGN OUT and SIGN IN again before the claim takes effect.');
  process.exit(ok === emails.length ? 0 : 1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
