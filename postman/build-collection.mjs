// Rebuilds postman/tresor-couture.postman_collection.json with assertions on
// every request + a negative/security-rules test folder.
// Run: node postman/build-collection.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const collectionPath = join(__dirname, 'tresor-couture.postman_collection.json');
const collection = JSON.parse(readFileSync(collectionPath, 'utf8'));

const test    = (exec) => ({ listen: 'test',       script: { type: 'text/javascript', exec: Array.isArray(exec) ? exec : exec.split('\n') } });
const prereq  = (exec) => ({ listen: 'prerequest', script: { type: 'text/javascript', exec: Array.isArray(exec) ? exec : exec.split('\n') } });

const findFolder = (name) => collection.item.find((f) => f.name === name);
const findReq    = (folder, name) => folder.item.find((r) => r.name === name);
// REPLACE the request's events with what we provide — fixes the prior bug
// where appending merged scripts caused `const b` redeclaration SyntaxErrors
// that killed the original capture logic and cascaded into every downstream
// auth failure.
const setEvents = (folderName, reqName, events) => {
  const folder = findFolder(folderName);
  if (!folder) throw new Error(`folder not found: ${folderName}`);
  const req = findReq(folder, reqName);
  if (!req) throw new Error(`request not found: ${folderName} > ${reqName}`);
  req.event = events;
};
// Swap Authorization header from adminIdToken (empty in our run) to idToken
// (regular signed-in user). This converts a meaningless "empty bearer → 400"
// into a real "non-admin → 403 from firestore.rules", which is the assertion
// we actually want.
const useUserToken = (folderName, reqName) => {
  const folder = findFolder(folderName);
  const req = findReq(folder, reqName);
  if (!req || !req.request?.header) return;
  for (const h of req.request.header) {
    if (h.key === 'Authorization' && h.value === 'Bearer {{adminIdToken}}') {
      h.value = 'Bearer {{idToken}}';
    }
  }
};

// ---- collection-level pre-request: generate a unique testEmail per run ----
collection.event = [
  prereq([
    "// Fresh testEmail/testPassword per Newman run so re-runs don't trip EMAIL_EXISTS.",
    "if (!pm.environment.get('runId')) {",
    "  const runId = Date.now() + '-' + Math.floor(Math.random() * 1e4);",
    "  pm.environment.set('runId', runId);",
    "  pm.environment.set('testEmail',      `postman+${runId}@tresor.test`);",
    "  pm.environment.set('testPassword',   `Pm${runId}!aA`);",
    "  pm.environment.set('secondaryEmail', `postman+${runId}-secondary@tresor.test`);",
    "}"
  ])
];

// ---- AUTH (single combined script: capture + assert) ----
setEvents('Auth', 'Register', [test([
  "const b = pm.response.json();",
  "if (b.idToken)      pm.environment.set('idToken',      b.idToken);",
  "if (b.refreshToken) pm.environment.set('refreshToken', b.refreshToken);",
  "if (b.localId)      pm.environment.set('uid',          b.localId);",
  "pm.test('200 OK',           () => pm.response.to.have.status(200));",
  "pm.test('idToken captured', () => pm.expect(b.idToken).to.be.a('string').and.have.length.greaterThan(20));",
  "pm.test('localId captured', () => pm.expect(b.localId).to.be.a('string'));",
  "pm.test('email echo',       () => pm.expect(b.email).to.eql(pm.environment.get('testEmail')));"
])]);

setEvents('Auth', 'Login', [test([
  "const b = pm.response.json();",
  "if (b.idToken)      pm.environment.set('idToken',      b.idToken);",
  "if (b.refreshToken) pm.environment.set('refreshToken', b.refreshToken);",
  "if (b.localId)      pm.environment.set('uid',          b.localId);",
  "pm.test('200 OK',           () => pm.response.to.have.status(200));",
  "pm.test('idToken refreshed',() => pm.expect(b.idToken).to.be.a('string'));",
  "pm.test('uid stable',       () => pm.expect(b.localId).to.eql(pm.environment.get('uid')));"
])]);

setEvents('Auth', 'Refresh token', [test([
  "const b = pm.response.json();",
  "if (b.id_token)      pm.environment.set('idToken',      b.id_token);",
  "if (b.refresh_token) pm.environment.set('refreshToken', b.refresh_token);",
  "pm.test('200 OK',            () => pm.response.to.have.status(200));",
  "pm.test('new id_token issued',  () => pm.expect(b.id_token).to.be.a('string'));",
  "pm.test('refresh_token rotated',() => pm.expect(b.refresh_token).to.be.a('string'));"
])]);

// ---- USERS ----
setEvents('Users', 'Create my profile (after Register)', [test([
  "pm.test('200 OK', () => pm.response.to.have.status(200));",
  "const b = pm.response.json();",
  "pm.test('doc returned',     () => pm.expect(b.name).to.include('users/' + pm.environment.get('uid')));",
  "pm.test('role = customer',  () => pm.expect(b.fields.role.stringValue).to.eql('customer'));"
])]);
setEvents('Users', 'Get my profile', [test([
  "pm.test('200 OK', () => pm.response.to.have.status(200));",
  "const b = pm.response.json();",
  "pm.test('fullName persisted', () => pm.expect(b.fields.fullName.stringValue).to.eql('Test User'));",
  "pm.test('uid matches',        () => pm.expect(b.fields.uid.stringValue).to.eql(pm.environment.get('uid')));"
])]);

// ---- PRODUCTS ----
setEvents('Products', 'List all', [test([
  "const b = pm.response.json();",
  "if (b.documents && b.documents[0]) {",
  "  pm.environment.set('productId', b.documents[0].name.split('/').pop());",
  "}",
  "pm.test('200 OK', () => pm.response.to.have.status(200));",
  "pm.test('catalogue not empty', () => pm.expect(b.documents).to.be.an('array').and.have.length.greaterThan(0));",
  "pm.test('productId captured',  () => pm.expect(pm.environment.get('productId')).to.be.a('string').and.have.length.greaterThan(0));",
  "pm.test('price on first doc', () => pm.expect(b.documents[0].fields.price).to.exist);"
])]);
setEvents('Products', 'Get one', [test([
  "pm.test('200 OK', () => pm.response.to.have.status(200));",
  "const b = pm.response.json();",
  "pm.test('doc id matches', () => pm.expect(b.name).to.include('products/' + pm.environment.get('productId')));"
])]);
setEvents('Products', 'Filter by master category (Sarees)', [test([
  "pm.test('200 OK', () => pm.response.to.have.status(200));",
  "const arr = pm.response.json();",
  "pm.test('runQuery returns array', () => pm.expect(arr).to.be.an('array'));",
  "const hits = arr.filter(r => r.document);",
  "if (hits.length > 0) {",
  "  pm.test('masterCategory filter holds', () => hits.forEach(h => pm.expect(h.document.fields.masterCategory.stringValue).to.eql('Sarees')));",
  "}"
])]);

// Admin-only writes — switch Authorization to {{idToken}} and assert rule denies non-admin.
useUserToken('Products', 'Create (admin)');
useUserToken('Products', 'Update price (admin)');
useUserToken('Products', 'Delete (admin)');
setEvents('Products', 'Create (admin)', [test([
  "pm.test('rule denies non-admin create (403)', () => pm.expect(pm.response.code).to.eql(403));",
  "// Don't propagate productId from a denied response — keep the listed one."
])]);
setEvents('Products', 'Update price (admin)', [test([
  "pm.test('rule denies non-admin update (403)', () => pm.expect(pm.response.code).to.eql(403));"
])]);
setEvents('Products', 'Delete (admin)', [test([
  "pm.test('rule denies non-admin delete (403)', () => pm.expect(pm.response.code).to.eql(403));"
])]);

// ---- COUPONS ----
useUserToken('Coupons', 'Create WELCOME10 (admin)');
setEvents('Coupons', 'Create WELCOME10 (admin)', [test([
  "pm.test('rule denies non-admin write (403)', () => pm.expect(pm.response.code).to.eql(403));"
])]);
setEvents('Coupons', 'Get WELCOME10', [test([
  "pm.test('200 or 404', () => pm.expect([200, 404]).to.include(pm.response.code));",
  "if (pm.response.code === 200) {",
  "  const b = pm.response.json();",
  "  pm.test('code field present', () => pm.expect(b.fields.code).to.exist);",
  "}"
])]);

// ---- ORDERS ----
setEvents('Orders', 'Place order', [test([
  "const b = pm.response.json();",
  "if (b.name) pm.environment.set('orderId', b.name.split('/').pop());",
  "pm.test('200 OK',           () => pm.response.to.have.status(200));",
  "pm.test('order doc returned',() => pm.expect(b.name).to.include('orders/'));",
  "pm.test('orderId captured', () => pm.expect(pm.environment.get('orderId')).to.have.length.greaterThan(0));",
  "pm.test('userId stamped',   () => pm.expect(b.fields.userId.stringValue).to.eql(pm.environment.get('uid')));",
  "pm.test('status = placed',  () => pm.expect(b.fields.status.stringValue).to.eql('placed'));"
])]);
setEvents('Orders', 'My orders (runQuery)', [test([
  "pm.test('200 OK', () => pm.response.to.have.status(200));",
  "const arr = pm.response.json();",
  "const docs = arr.filter(r => r.document);",
  "pm.test('at least one own order',() => pm.expect(docs.length).to.be.greaterThan(0));",
  "pm.test('all orders are mine',   () => docs.forEach(d => pm.expect(d.document.fields.userId.stringValue).to.eql(pm.environment.get('uid'))));"
])]);
useUserToken('Orders', 'Mark shipped (admin)');
setEvents('Orders', 'Mark shipped (admin)', [test([
  "pm.test('rule denies non-admin update (403)', () => pm.expect(pm.response.code).to.eql(403));"
])]);

// ---- REVIEWS ----
setEvents('Reviews', 'Create review', [test([
  "const b = pm.response.json();",
  "if (b.name) pm.environment.set('reviewId', b.name.split('/').pop());",
  "pm.test('200 OK', () => pm.response.to.have.status(200));",
  "pm.test('review doc returned',  () => pm.expect(b.name).to.include('reviews/'));",
  "pm.test('status pending',       () => pm.expect(b.fields.status.stringValue).to.eql('pending'));",
  "pm.test('fabricId set',         () => pm.expect(b.fields.fabricId.stringValue).to.eql(pm.environment.get('productId')));"
])]);
useUserToken('Reviews', 'Approve (admin)');
setEvents('Reviews', 'Approve (admin)', [test([
  "pm.test('rule denies non-admin moderate (403)', () => pm.expect(pm.response.code).to.eql(403));"
])]);

// ---- NEGATIVE & SECURITY ----
const negative = {
  name: 'Negative & Security',
  description: 'Exercises firestore.rules — every assertion expects the rule to deny. Passing here proves the security boundary is intact.',
  item: [
    {
      name: 'Login · wrong password (expect 400)',
      request: {
        method: 'POST',
        header: [{ key: 'Content-Type', value: 'application/json' }],
        url: { raw: '{{idtBase}}/accounts:signInWithPassword?key={{apiKey}}', host: ['{{idtBase}}'], path: ['accounts:signInWithPassword'], query: [{ key: 'key', value: '{{apiKey}}' }] },
        body: { mode: 'raw', raw: JSON.stringify({ email: '{{testEmail}}', password: 'definitely-not-the-right-password', returnSecureToken: true }, null, 2) }
      },
      event: [test([
        "pm.test('rejects with 400',     () => pm.response.to.have.status(400));",
        "const b = pm.response.json();",
        "pm.test('error message present',() => pm.expect(b.error).to.exist);"
      ])]
    },
    {
      name: 'Register secondary user (setup)',
      request: {
        method: 'POST',
        header: [{ key: 'Content-Type', value: 'application/json' }],
        url: { raw: '{{idtBase}}/accounts:signUp?key={{apiKey}}', host: ['{{idtBase}}'], path: ['accounts:signUp'], query: [{ key: 'key', value: '{{apiKey}}' }] },
        body: { mode: 'raw', raw: JSON.stringify({ email: '{{secondaryEmail}}', password: '{{testPassword}}', returnSecureToken: true }, null, 2) }
      },
      event: [test([
        "const b = pm.response.json();",
        "if (b.idToken) pm.environment.set('secondaryIdToken', b.idToken);",
        "if (b.localId) pm.environment.set('secondaryUid',     b.localId);",
        "pm.test('200 OK',                  () => pm.response.to.have.status(200));",
        "pm.test('secondary tokens captured',() => pm.expect(b.idToken).to.be.a('string'));"
      ])]
    },
    {
      name: 'Read other user profile (expect 403)',
      request: {
        method: 'GET',
        header: [{ key: 'Authorization', value: 'Bearer {{idToken}}' }],
        url: { raw: '{{fsBase}}/users/{{secondaryUid}}', host: ['{{fsBase}}'], path: ['users', '{{secondaryUid}}'] }
      },
      event: [test([
        "pm.test('rule denies cross-user read', () => pm.expect([403, 404]).to.include(pm.response.code));"
      ])]
    },
    {
      name: 'Promote myself to admin (expect 403)',
      request: {
        method: 'PATCH',
        header: [
          { key: 'Authorization', value: 'Bearer {{idToken}}' },
          { key: 'Content-Type',  value: 'application/json' }
        ],
        url: {
          raw: '{{fsBase}}/users/{{uid}}?updateMask.fieldPaths=role',
          host: ['{{fsBase}}'], path: ['users', '{{uid}}'],
          query: [{ key: 'updateMask.fieldPaths', value: 'role' }]
        },
        body: { mode: 'raw', raw: JSON.stringify({ fields: { role: { stringValue: 'admin' } } }, null, 2) }
      },
      event: [test([
        "pm.test('role change denied by rules (403)', () => pm.expect(pm.response.code).to.eql(403));"
      ])]
    },
    {
      name: 'Place order without auth (expect 401/403)',
      request: {
        method: 'POST',
        header: [{ key: 'Content-Type', value: 'application/json' }],
        url: { raw: '{{fsBase}}/orders', host: ['{{fsBase}}'], path: ['orders'] },
        body: { mode: 'raw', raw: JSON.stringify({
          fields: {
            userId:   { stringValue: 'anonymous' },
            status:   { stringValue: 'placed' },
            placedAt: { timestampValue: '2026-05-15T00:00:00Z' },
            total:    { integerValue: '100' },
            items:    { arrayValue: { values: [{ mapValue: { fields: { fabricId: { stringValue: 'x' }, quantity: { integerValue: '1' } } } }] } }
          }
        }, null, 2) }
      },
      event: [test([
        "pm.test('unauth create denied', () => pm.expect([401, 403]).to.include(pm.response.code));"
      ])]
    },
    {
      name: 'Place order with someone else userId (expect 403)',
      request: {
        method: 'POST',
        header: [
          { key: 'Authorization', value: 'Bearer {{idToken}}' },
          { key: 'Content-Type',  value: 'application/json' }
        ],
        url: { raw: '{{fsBase}}/orders', host: ['{{fsBase}}'], path: ['orders'] },
        body: { mode: 'raw', raw: JSON.stringify({
          fields: {
            userId:   { stringValue: '{{secondaryUid}}' },
            status:   { stringValue: 'placed' },
            placedAt: { timestampValue: '2026-05-15T00:00:00Z' },
            total:    { integerValue: '100' },
            items:    { arrayValue: { values: [{ mapValue: { fields: { fabricId: { stringValue: '{{productId}}' }, quantity: { integerValue: '1' } } } }] } }
          }
        }, null, 2) }
      },
      event: [test([
        "pm.test('userId-mismatch denied (403)', () => pm.expect(pm.response.code).to.eql(403));"
      ])]
    },
    {
      name: 'Self-approved review (expect 403)',
      request: {
        method: 'POST',
        header: [
          { key: 'Authorization', value: 'Bearer {{idToken}}' },
          { key: 'Content-Type',  value: 'application/json' }
        ],
        url: { raw: '{{fsBase}}/reviews', host: ['{{fsBase}}'], path: ['reviews'] },
        body: { mode: 'raw', raw: JSON.stringify({
          fields: {
            fabricId:   { stringValue: '{{productId}}' },
            userId:     { stringValue: '{{uid}}' },
            authorName: { stringValue: 'TEST_PostmanRun' },
            rating:     { integerValue: '5' },
            body:       { stringValue: 'TEST self-approval' },
            status:     { stringValue: 'approved' },
            createdAt:  { timestampValue: '2026-05-15T00:00:00Z' }
          }
        }, null, 2) }
      },
      event: [test([
        "pm.test('status=approved on create denied (403)', () => pm.expect(pm.response.code).to.eql(403));"
      ])]
    },
    {
      name: 'Out-of-range rating (expect 403)',
      request: {
        method: 'POST',
        header: [
          { key: 'Authorization', value: 'Bearer {{idToken}}' },
          { key: 'Content-Type',  value: 'application/json' }
        ],
        url: { raw: '{{fsBase}}/reviews', host: ['{{fsBase}}'], path: ['reviews'] },
        body: { mode: 'raw', raw: JSON.stringify({
          fields: {
            fabricId:   { stringValue: '{{productId}}' },
            userId:     { stringValue: '{{uid}}' },
            authorName: { stringValue: 'TEST_PostmanRun' },
            rating:     { integerValue: '10' },
            body:       { stringValue: 'TEST out-of-range rating' },
            status:     { stringValue: 'pending' },
            createdAt:  { timestampValue: '2026-05-15T00:00:00Z' }
          }
        }, null, 2) }
      },
      event: [test([
        "pm.test('rating out of [1,5] denied (403)', () => pm.expect(pm.response.code).to.eql(403));"
      ])]
    },
    {
      name: 'Anonymous review (expect 401/403)',
      request: {
        method: 'POST',
        header: [{ key: 'Content-Type', value: 'application/json' }],
        url: { raw: '{{fsBase}}/reviews', host: ['{{fsBase}}'], path: ['reviews'] },
        body: { mode: 'raw', raw: JSON.stringify({
          fields: {
            fabricId:   { stringValue: '{{productId}}' },
            userId:     { stringValue: 'anonymous' },
            authorName: { stringValue: 'Anonymous' },
            rating:     { integerValue: '3' },
            body:       { stringValue: 'no auth' },
            status:     { stringValue: 'pending' },
            createdAt:  { timestampValue: '2026-05-15T00:00:00Z' }
          }
        }, null, 2) }
      },
      event: [test([
        "pm.test('anon review denied', () => pm.expect([401, 403]).to.include(pm.response.code));"
      ])]
    },
    {
      name: 'Read other user cart (expect 403)',
      request: {
        method: 'GET',
        header: [{ key: 'Authorization', value: 'Bearer {{idToken}}' }],
        url: { raw: '{{fsBase}}/carts/{{secondaryUid}}', host: ['{{fsBase}}'], path: ['carts', '{{secondaryUid}}'] }
      },
      event: [test([
        "pm.test('cross-user cart read denied', () => pm.expect([403, 404]).to.include(pm.response.code));"
      ])]
    },
    {
      name: 'Write own cart (positive — expect 200)',
      request: {
        method: 'PATCH',
        header: [
          { key: 'Authorization', value: 'Bearer {{idToken}}' },
          { key: 'Content-Type',  value: 'application/json' }
        ],
        url: { raw: '{{fsBase}}/carts/{{uid}}', host: ['{{fsBase}}'], path: ['carts', '{{uid}}'] },
        body: { mode: 'raw', raw: JSON.stringify({
          fields: {
            items: { arrayValue: { values: [{ mapValue: { fields: { fabricId: { stringValue: '{{productId}}' }, quantity: { integerValue: '2' } } } }] } },
            updatedAt: { timestampValue: '2026-05-15T00:00:00Z' }
          }
        }, null, 2) }
      },
      event: [test([
        "pm.test('200 OK',              () => pm.response.to.have.status(200));",
        "const b = pm.response.json();",
        "pm.test('cart doc returned',    () => pm.expect(b.name).to.include('carts/' + pm.environment.get('uid')));"
      ])]
    },
    {
      name: 'Anonymous products list (positive — expect 200)',
      request: {
        method: 'GET',
        url: { raw: '{{fsBase}}/products?pageSize=5', host: ['{{fsBase}}'], path: ['products'], query: [{ key: 'pageSize', value: '5' }] }
      },
      event: [test([
        "pm.test('200 OK (public read allowed)', () => pm.response.to.have.status(200));",
        "const b = pm.response.json();",
        "pm.test('returns documents', () => pm.expect(b.documents).to.be.an('array'));"
      ])]
    }
  ]
};

// Replace existing negative/cleanup folders if present (re-running this script
// should be idempotent), then append the fresh ones.
collection.item = collection.item.filter(f => f.name !== 'Negative & Security' && f.name !== 'Cleanup');
collection.item.push(negative);

const cleanup = {
  name: 'Cleanup',
  description: 'Owner-deletes for state-creating tests. Rules allow owner to delete their own review and cart. Orders stay (admin-only delete).',
  item: [
    {
      name: 'Delete my review',
      request: {
        method: 'DELETE',
        header: [{ key: 'Authorization', value: 'Bearer {{idToken}}' }],
        url: { raw: '{{fsBase}}/reviews/{{reviewId}}', host: ['{{fsBase}}'], path: ['reviews', '{{reviewId}}'] }
      },
      event: [test([
        "pm.test('200/204 OK', () => pm.expect([200, 204]).to.include(pm.response.code));"
      ])]
    },
    {
      name: 'Delete my cart',
      request: {
        method: 'DELETE',
        header: [{ key: 'Authorization', value: 'Bearer {{idToken}}' }],
        url: { raw: '{{fsBase}}/carts/{{uid}}', host: ['{{fsBase}}'], path: ['carts', '{{uid}}'] }
      },
      event: [test([
        "pm.test('200/204 OK', () => pm.expect([200, 204]).to.include(pm.response.code));"
      ])]
    }
  ]
};
collection.item.push(cleanup);

collection.info.description =
  'Talks directly to Firebase Identity Toolkit + Firestore REST against the tresor-couture project.\n\n' +
  'The collection-level pre-request hook generates a unique testEmail/testPassword per run so Newman re-runs do not collide with the previous user.\n\n' +
  '**Run with Newman:** `npx newman run postman/tresor-couture.postman_collection.json -e postman/tresor-couture.postman_environment.json`\n\n' +
  '**Admin-only requests** (product CRUD, coupon write, order admin update, review approve) are sent with the regular {{idToken}} and ASSERT 403 — that proves firestore.rules is correctly denying non-admin writes. If you have an admin custom-claim token, populate {{adminIdToken}} and switch the Authorization header back to test the success path.';

writeFileSync(collectionPath, JSON.stringify(collection, null, 2));
console.log('Rewrote', collectionPath);
console.log('Folders:', collection.item.map(i => i.name).join(', '));
console.log('Total requests:', collection.item.reduce((n, f) => n + (f.item?.length || 0), 0));
