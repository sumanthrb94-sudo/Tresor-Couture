/**
 * Inspect / repair a user's saved default address (users/{uid}.defaultAddress).
 *
 * Background: QA found an account whose defaultAddress mixed two cities — the
 * street line contained a full free-text address (with its own PIN) while the
 * city/state/PIN fields pointed somewhere else. That record lives only in
 * Firestore, so it needs the Admin SDK to fix — there is no fixture in the
 * repo to correct.
 *
 * Prerequisites
 *   Point GOOGLE_APPLICATION_CREDENTIALS at your service-account JSON
 *   (same as set-admin / seed).
 *
 * Usage
 *   npm run fix-address -- --show  user@example.com            # print current value
 *   npm run fix-address -- --clear user@example.com            # delete the field
 *   npm run fix-address -- --set   user@example.com \
 *       --line1 "12 Banjara Hills Road" [--line2 "Flat 4B"] \
 *       --city Hyderabad --state Telangana --pin 500006 \
 *       [--name "Full Name"] [--phone "+919876543210"] [--country India]
 *
 * --set merges onto the existing address: flags you omit keep their stored
 * value, so you can fix just the street line without retyping everything.
 */

import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}

const auth = getAuth();
const db = getFirestore();

const PIN_RE = /^[1-9]\d{5}$/;

type Address = {
  fullName?: string;
  email?: string;
  phone?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

function usage(): never {
  console.error(
    'Usage:\n' +
      '  npm run fix-address -- --show  <email>\n' +
      '  npm run fix-address -- --clear <email>\n' +
      '  npm run fix-address -- --set   <email> --line1 "..." --city "..." --state "..." --pin "..."\n' +
      '                          [--line2 "..."] [--name "..."] [--phone "..."] [--country "..."]'
  );
  process.exit(1);
}

/** Pull `--flag value` pairs out of argv; returns positional args separately. */
function parseArgs(argv: string[]): { flags: Record<string, string | true>; positional: string[] } {
  const flags: Record<string, string | true> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
}

function printAddress(addr: Address | undefined): void {
  if (!addr) {
    console.log('  (no defaultAddress on this user)');
    return;
  }
  for (const key of ['fullName', 'email', 'phone', 'line1', 'line2', 'city', 'state', 'postalCode', 'country'] as const) {
    if (addr[key] !== undefined) console.log(`  ${key.padEnd(11)}: ${addr[key]}`);
  }
  // Flag the exact inconsistency QA hit: a different city/state/PIN embedded
  // in the free-text street line than the structured fields claim.
  const street = `${addr.line1 ?? ''} ${addr.line2 ?? ''}`;
  const embeddedPin = street.match(/\b[1-9]\d{5}\b/)?.[0];
  if (embeddedPin && addr.postalCode && embeddedPin !== addr.postalCode) {
    console.log(`  ⚠ street line contains PIN ${embeddedPin}, but postalCode is ${addr.postalCode}`);
  }
  if (addr.city && street.toLowerCase().includes(',') && !street.toLowerCase().includes(addr.city.toLowerCase())) {
    const cityish = street.match(/,\s*([A-Za-z .]+),\s*[A-Za-z .]+\s+\d{6}/)?.[1];
    if (cityish && cityish.trim().toLowerCase() !== addr.city.trim().toLowerCase()) {
      console.log(`  ⚠ street line mentions "${cityish.trim()}", but city is "${addr.city}"`);
    }
  }
}

async function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2));
  const email = positional[0]?.trim().toLowerCase();
  if (!email) usage();

  const mode = flags.show ? 'show' : flags.clear ? 'clear' : flags.set ? 'set' : 'show';

  const user = await auth.getUserByEmail(email).catch(() => null);
  if (!user) {
    console.error(`✗ No Firebase user found for ${email}.`);
    process.exit(1);
  }
  const ref = db.collection('users').doc(user.uid);
  const snap = await ref.get();
  const current = (snap.data()?.defaultAddress ?? undefined) as Address | undefined;

  console.log(`User ${email} (${user.uid}) — current defaultAddress:`);
  printAddress(current);

  if (mode === 'show') return;

  if (mode === 'clear') {
    await ref.update({ defaultAddress: FieldValue.delete() });
    console.log('\n✓ defaultAddress cleared. The user can re-add it under Account → Addresses.');
    return;
  }

  // --set: merge provided flags onto the stored address.
  const next: Address = {
    ...current,
    ...(typeof flags.name === 'string' ? { fullName: flags.name } : {}),
    ...(typeof flags.phone === 'string' ? { phone: flags.phone } : {}),
    ...(typeof flags.line1 === 'string' ? { line1: flags.line1 } : {}),
    ...(typeof flags.line2 === 'string' ? { line2: flags.line2 } : {}),
    ...(typeof flags.city === 'string' ? { city: flags.city } : {}),
    ...(typeof flags.state === 'string' ? { state: flags.state } : {}),
    ...(typeof flags.pin === 'string' ? { postalCode: flags.pin } : {}),
    ...(typeof flags.country === 'string' ? { country: flags.country } : {}),
  };
  next.email = next.email || user.email || undefined;
  next.country = next.country || 'India';

  const missing = (['fullName', 'phone', 'line1', 'city', 'state', 'postalCode'] as const).filter(k => !next[k]?.trim());
  if (missing.length) {
    console.error(`\n✗ Refusing to write an incomplete address — missing: ${missing.join(', ')}`);
    process.exit(1);
  }
  if (!PIN_RE.test(next.postalCode!.trim())) {
    console.error(`\n✗ "${next.postalCode}" is not a valid 6-digit Indian PIN.`);
    process.exit(1);
  }

  await ref.update({ defaultAddress: next });
  console.log('\n✓ defaultAddress updated to:');
  printAddress(next);
}

main().catch(err => {
  console.error('✗ fix-address failed:', err);
  process.exit(1);
});
