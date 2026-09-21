/**
 * Are the Cashfree keys the right keys, for the right environment?
 *
 * The expensive way to find out is a customer at the payment screen. The
 * failure this catches is the likely one: SANDBOX keys with
 * CASHFREE_ENV=production. Both halves look correct in the Vercel dashboard —
 * the variables are set, the word says production — and nothing complains until
 * someone tries to pay and Cashfree rejects the credentials.
 *
 * Run it with the keys in your shell, never in a file:
 *
 *   CASHFREE_APP_ID=... CASHFREE_SECRET_KEY=... CASHFREE_ENV=production \
 *     node scripts/check-cashfree.mjs
 *
 * It asks Cashfree for an order id that cannot exist and reads the answer:
 *
 *   404 / order_not_found  → the credentials were ACCEPTED. Good.
 *   401 / 403              → the credentials were REJECTED by this environment.
 *
 * Nothing is created, nothing is charged, no order appears in the dashboard,
 * and the keys are never printed, logged or written anywhere.
 */

const APP_ID = (process.env.CASHFREE_APP_ID ?? '').trim();
const SECRET = (process.env.CASHFREE_SECRET_KEY ?? '').trim();
const ENV = (process.env.CASHFREE_ENV ?? '').trim();

// Same rule as api/_lib/cashfree.ts: only the exact word goes live.
const live = ENV.toLowerCase() === 'production';
const base = live ? 'https://api.cashfree.com' : 'https://sandbox.cashfree.com';

if (!APP_ID || !SECRET) {
  console.error('CASHFREE_APP_ID and CASHFREE_SECRET_KEY must both be set in the environment.');
  console.error('Pass them on the command line so they are never written to a file.');
  process.exit(2);
}

console.log(`CASHFREE_ENV=${JSON.stringify(ENV)} → ${live ? 'LIVE' : 'SANDBOX'} (${base})`);
if (!live) {
  console.log('Not the live switch. Anything but the exact word "production" stays on sandbox.');
}

// An id in our own format that has certainly never been used.
const probe = `tc_probe_${Date.now().toString(36)}`;

let res;
try {
  res = await fetch(`${base}/pg/orders/${probe}`, {
    headers: {
      'x-client-id': APP_ID,
      'x-client-secret': SECRET,
      'x-api-version': '2025-01-01',
      accept: 'application/json',
    },
  });
} catch (err) {
  console.error(`\n⚠️  Could not reach ${base}: ${err.message}`);
  console.error('   This says nothing about your keys. Check the network and try again.');
  process.exit(3);
}

const text = await res.text();
let body = null;
try {
  body = text ? JSON.parse(text) : {};
} catch {
  // Left null deliberately — see below. Cashfree answers these calls in JSON,
  // so a non-JSON body means something other than Cashfree replied.
}

// A corporate proxy, a captive portal or a firewall will happily return 403 to
// a CONNECT it refused, and that is indistinguishable from a real credential
// rejection by status alone. Telling someone their keys are wrong when the
// request never left the building would send them to regenerate keys that were
// fine. Cashfree always answers in JSON, so anything else did not come from
// Cashfree.
if (body === null) {
  console.error(`\n⚠️  HTTP ${res.status} from ${base}, but the body is not JSON:`);
  console.error(`   ${text.slice(0, 200).replace(/\s+/g, ' ').trim() || '(empty)'}`);
  console.error('\n   Cashfree answers this call in JSON, so this reply came from something in');
  console.error('   between — a proxy or firewall. Your keys were NOT tested. Run this from a');
  console.error('   machine with direct internet access.');
  process.exit(3);
}

// The key line: a 404 means Cashfree authenticated us and then could not find
// the order — which is the whole point. Being told "no such order" is proof the
// credentials work for this environment.
if (res.status === 404) {
  console.log(`\n✅ Credentials ACCEPTED by ${live ? 'production' : 'sandbox'}.`);
  console.log('   Cashfree authenticated the request and reported no such order, which is correct.');
  if (live) {
    console.log('\n   Remaining: set VITE_CASHFREE_MODE=production and redeploy — it is baked in');
    console.log('   at build time, so Card and UPI stay hidden until a new build runs.');
    console.log('   Then register https://tresorcouture.in/api/payments/webhook in the Cashfree');
    console.log('   dashboard for PAYMENT_SUCCESS_WEBHOOK.');
  }
  process.exit(0);
}

if (res.status === 401 || res.status === 403) {
  console.error(`\n❌ Credentials REJECTED by ${live ? 'production' : 'sandbox'} (HTTP ${res.status}).`);
  console.error(`   ${body.message ?? '(no message)'}`);
  console.error('\n   Sandbox and production are DIFFERENT key pairs. The most likely cause is');
  console.error('   sandbox keys with CASHFREE_ENV=production, or production keys that were');
  console.error('   generated but never activated. Check Developers → API Keys in the dashboard.');
  process.exit(1);
}

console.error(`\n⚠️  Unexpected answer: HTTP ${res.status}`);
console.error(`   ${body.message ?? text.slice(0, 200)}`);
console.error('   Neither a clean accept nor a clean reject — worth looking at before going live.');
process.exit(1);
