/**
 * The review gate, exercised against the Firestore emulator.
 *
 * A review is a claim about a piece the writer supposedly owns, so the rules —
 * which are this project's only security boundary — must refuse one from
 * anybody who did not buy and receive it. That cannot be checked by querying
 * (rules cannot query) so the review names its order and the rules read it.
 *
 * Run:
 *   npx firebase-tools emulators:start --only firestore --project demo-tresor
 *   no_proxy=127.0.0.1 node tests/emulator/review-gate.mjs
 */
const HOST = 'http://127.0.0.1:8080';
const PROJ = 'demo-tresor';
const BASE = `${HOST}/v1/projects/${PROJ}/databases/(default)/documents`;
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const tok = (uid, claims = {}) =>
  `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ iss: `https://securetoken.google.com/${PROJ}`, aud: PROJ, sub: uid, user_id: uid, ...claims })}.`;

const RUN = Date.now().toString(36);
const id = s => `${s}-${RUN}`;
const buyer = tok('buyer1');
const stranger = tok('stranger1');
const admin = tok('adm1', { admin: true });
const OWNER = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };

const PRODUCT = id('lace');
const DELIVERED = id('ord-delivered');
const PLACED = id('ord-placed');
const OTHERS = id('ord-someone-else');

// Seed as owner (bypasses rules), the way the server would have written them.
await fetch(`${BASE}/products?documentId=${PRODUCT}`, { method: 'POST', headers: OWNER, body: JSON.stringify({ fields: {
  brand: { stringValue: 'TRESOR' }, name: { stringValue: 'Sequin Scallop Border' },
  price: { integerValue: '3900' }, masterCategory: { stringValue: 'Laces' }, category: { stringValue: 'Laces' } } }) });
const order = (userId, status, ids) => ({ fields: {
  userId: { stringValue: userId }, status: { stringValue: status },
  productIds: { arrayValue: { values: ids.map(v => ({ stringValue: v })) } } } });
await fetch(`${BASE}/orders?documentId=${DELIVERED}`, { method: 'POST', headers: OWNER, body: JSON.stringify(order('buyer1', 'delivered', [PRODUCT])) });
await fetch(`${BASE}/orders?documentId=${PLACED}`, { method: 'POST', headers: OWNER, body: JSON.stringify(order('buyer1', 'placed', [PRODUCT])) });
await fetch(`${BASE}/orders?documentId=${OTHERS}`, { method: 'POST', headers: OWNER, body: JSON.stringify(order('stranger1', 'delivered', [PRODUCT])) });

const review = (over = {}) => ({ fields: {
  fabricId: { stringValue: PRODUCT }, orderId: { stringValue: DELIVERED },
  userId: { stringValue: 'buyer1' }, status: { stringValue: 'pending' },
  rating: { integerValue: '5' }, body: { stringValue: 'Beautiful gold work.' },
  authorName: { stringValue: 'A Buyer' }, ...over } });

let pass = 0, fail = 0, n = 0;
async function check(label, want, body, token) {
  const res = await fetch(`${BASE}/reviews?documentId=${id('rv' + (n++))}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const got = res.status < 300 ? 'ALLOW' : res.status === 403 ? 'DENY' : `HTTP ${res.status}`;
  const ok = got === want;
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}  -> ${got} (wanted ${want})`);
  ok ? pass++ : fail++;
}

console.log('\n-- only a delivered buyer may review --');
await check('a real buyer, order delivered', 'ALLOW', review(), buyer);
await check('nobody signed in', 'DENY', review(), null);
await check('signed in, never bought it', 'DENY', review({ userId: { stringValue: 'stranger1' } }), stranger);
await check('bought it, NOT yet delivered', 'DENY', review({ orderId: { stringValue: PLACED } }), buyer);
await check("citing SOMEONE ELSE's delivered order", 'DENY', review({ orderId: { stringValue: OTHERS } }), buyer);
await check('citing an order that does not exist', 'DENY', review({ orderId: { stringValue: 'no-such-order' } }), buyer);
await check('no orderId at all (the old behaviour)', 'DENY', { fields: Object.fromEntries(Object.entries(review().fields).filter(([k]) => k !== 'orderId')) }, buyer);

console.log('\n-- a review cannot be forged or self-approved --');
await check('writing it under another uid', 'DENY', review({ userId: { stringValue: 'stranger1' } }), buyer);
await check('submitting it already approved', 'DENY', review({ status: { stringValue: 'approved' } }), buyer);
await check('rating of 9', 'DENY', review({ rating: { integerValue: '9' } }), buyer);
await check('reviewing a product that does not exist', 'DENY', review({ fabricId: { stringValue: 'ghost' } }), buyer);

console.log('\n-- customer photos are capped --');
const shots = k => ({ arrayValue: { values: Array.from({ length: k }, () => ({ stringValue: 'data:image/webp;base64,AAAA' })) } });
await check('3 photos', 'ALLOW', review({ photos: shots(3) }), buyer);
await check('4 photos', 'DENY', review({ photos: shots(4) }), buyer);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
