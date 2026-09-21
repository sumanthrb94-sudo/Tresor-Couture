/**
 * Security rules for the supplier intake collection, exercised against the
 * Firestore emulator.
 *
 * These rules ARE the security boundary — this project has no Cloud Functions,
 * so nothing else stands between a browser and the database. Intake is the one
 * collection a non-admin may write, and it holds two things worth protecting:
 * photographs (megabyte documents, written at the studio's expense) and a
 * supplier's costs, which a rival supplier must never be able to read.
 *
 * Run:
 *   npx firebase-tools emulators:start --only firestore --project demo-tresor
 *   no_proxy=127.0.0.1 node tests/emulator/intake-rules.mjs
 *
 * The emulator accepts UNSIGNED JWTs, so a token here is just a base64 payload
 * carrying the custom claims the rules read — which is how the real
 * rules-unit-testing library works underneath.
 */
const HOST = 'http://127.0.0.1:8080';
const PROJ = 'demo-tresor';
const BASE = `${HOST}/v1/projects/${PROJ}/databases/(default)/documents`;

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const tok = (uid, claims = {}) =>
  `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
    iss: `https://securetoken.google.com/${PROJ}`, aud: PROJ, sub: uid, user_id: uid, ...claims,
  })}.`;

const doc = (userId, over = {}) => ({
  fields: {
    userId: { stringValue: userId },
    designName: { stringValue: 'Beaded Floral Vine Border' },
    category: { stringValue: 'Laces' },
    subCategory: { stringValue: 'Bridal Border' },
    styleCode: { stringValue: 'TC-BFV' },
    unitType: { stringValue: 'bundle' },
    bundleSizeMeters: { stringValue: '9' },
    bundlePrice: { stringValue: '1800' },
    notes: { stringValue: '' },
    status: { stringValue: 'draft' },
    colours: { arrayValue: { values: [{ mapValue: { fields: { colourName: { stringValue: 'Gold' } } } }] } },
    ...over,
  },
});

// Unique per run: the emulator keeps state between runs, and creating a
// document id that already exists returns 409 — which would read as a rules
// denial and fail the wrong test.
const RUN = Date.now().toString(36);
const id = stem => `${stem}-${RUN}`;

let pass = 0;
let fail = 0;

async function check(label, want, fn) {
  const res = await fn();
  const got = res.status < 300 ? 'ALLOW' : res.status === 403 ? 'DENY' : `HTTP ${res.status}`;
  const ok = got === want;
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}  -> ${got} (wanted ${want})`);
  if (ok) pass += 1;
  else fail += 1;
  return res;
}

const post = (path, body, token) => fetch(`${BASE}${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
});
const patch = (path, body, token) => fetch(`${BASE}${path}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify(body),
});
const get = (path, token) => fetch(`${BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
const del = (path, token) => fetch(`${BASE}${path}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });

const supplier = tok('sup1', { supplier: true });
const supplier2 = tok('sup2', { supplier: true });
const shopper = tok('cust1');
const admin = tok('adm1', { admin: true });

console.log('\n-- who may write an intake doc --');
await check('anonymous (no token) creates', 'DENY', () => post(`/intake?documentId=${id('a1')}`, doc('sup1')));
await check('ordinary signed-in shopper creates', 'DENY', () => post(`/intake?documentId=${id('a2')}`, doc('cust1'), shopper));
await check('supplier creates own', 'ALLOW', () => post(`/intake?documentId=${id('s1')}`, doc('sup1'), supplier));
await check('supplier creates a doc OWNED BY SOMEONE ELSE', 'DENY', () => post(`/intake?documentId=${id('s2')}`, doc('sup2'), supplier));

console.log('\n-- who may read it --');
await check('supplier reads own', 'ALLOW', () => get(`/intake/${id('s1')}`, supplier));
await check('a RIVAL supplier reads it (costs!)', 'DENY', () => get(`/intake/${id('s1')}`, supplier2));
await check('shopper reads it', 'DENY', () => get(`/intake/${id('s1')}`, shopper));
await check('admin reads it', 'ALLOW', () => get(`/intake/${id('s1')}`, admin));

console.log('\n-- shape limits --');
await check('design with no name', 'DENY', () =>
  post(`/intake?documentId=${id('x1')}`, doc('sup1', { designName: { stringValue: '' } }), supplier));
const thirteen = {
  arrayValue: { values: Array.from({ length: 13 }, () => ({ mapValue: { fields: { colourName: { stringValue: 'c' } } } })) },
};
await check('13 colours (the cap is 12)', 'DENY', () =>
  post(`/intake?documentId=${id('x2')}`, doc('sup1', { colours: thirteen }), supplier));
await check('a status value we never defined', 'DENY', () =>
  post(`/intake?documentId=${id('x3')}`, doc('sup1', { status: { stringValue: 'approved' } }), supplier));

console.log('\n-- once imported, the supplier is locked out --');
await patch(`/intake/${id('s1')}?updateMask.fieldPaths=status`, { fields: { status: { stringValue: 'imported' } } }, admin);
await check('supplier edits an imported submission', 'DENY', () =>
  patch(`/intake/${id('s1')}?updateMask.fieldPaths=notes`, { fields: { notes: { stringValue: 'sneaky' } } }, supplier));
await check('supplier deletes an imported submission', 'DENY', () => del(`/intake/${id('s1')}`, supplier));

console.log('\n-- the catalogue itself stays admin-only --');
await check('supplier writes straight to products', 'DENY', () =>
  post(`/products?documentId=${id('p1')}`, {
    fields: {
      brand: { stringValue: 'X' }, name: { stringValue: 'X' }, price: { integerValue: '1' },
      masterCategory: { stringValue: 'Laces' }, category: { stringValue: 'Laces' },
    },
  }, supplier));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
