/**
 * One-shot: append the "Serverless API (/api/*)" folder to the Postman
 * collection. Kept as a script rather than a hand-edited 4k-line JSON so the
 * additions are reviewable as code.
 *
 * Usage: node scripts/add-api-postman-tests.mjs
 */
import * as fs from 'fs';

const FILE = 'postman/tresor-couture.postman_collection.json';
const c = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const FOLDER = 'Serverless API (/api/*)';
c.item = c.item.filter(i => i.name !== FOLDER); // idempotent

const t = (...lines) => ({ listen: 'test', script: { type: 'text/javascript', exec: lines } });

const req = (method, path, { headers = {}, body, auth } = {}) => {
  const header = Object.entries(headers).map(([key, value]) => ({ key, value }));
  if (auth) header.push({ key: 'Authorization', value: auth });
  return {
    method,
    header,
    url: { raw: `{{apiBase}}${path}`, host: ['{{apiBase}}'], path: path.replace(/^\//, '').split('/') },
    ...(body ? { body: { mode: 'raw', raw: body } } : {}),
  };
};

const items = [
  {
    name: 'Health · GET /api/health (expect 200 when configured)',
    request: req('GET', '/api/health'),
    event: [t(
      "pm.test('responds 200 or 503', () => pm.expect([200,503]).to.include(pm.response.code));",
      "const b = pm.response.json();",
      "pm.test('reports ok flag', () => pm.expect(b).to.have.property('ok'));",
      "pm.test('does not leak which integrations are configured', () =>",
      "  pm.expect(Object.keys(b).sort().join(',')).to.eql('ok,timestamp'));",
    )],
  },
  {
    name: 'CSRF · GET /api/csrf issues a token cookie',
    request: req('GET', '/api/csrf'),
    event: [t(
      "pm.test('responds 200', () => pm.response.to.have.status(200));",
      "const setCookie = pm.response.headers.get('Set-Cookie') || '';",
      "pm.test('sets tresor_csrf cookie', () => pm.expect(setCookie).to.include('tresor_csrf'));",
      "pm.test('cookie is SameSite=Strict', () => pm.expect(setCookie).to.include('SameSite=Strict'));",
      "const m = /tresor_csrf=([^;]+)/.exec(setCookie);",
      "if (m) pm.environment.set('csrfToken', decodeURIComponent(m[1]));",
    )],
  },
  {
    name: 'Orders · POST /api/orders/place without auth (expect 401/403/503)',
    request: req('POST', '/api/orders/place', {
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': '{{csrfToken}}', Cookie: 'tresor_csrf={{csrfToken}}' },
      body: JSON.stringify({ order: { items: [{ fabricId: '1', quantity: 1 }], paymentMethod: 'cod' } }, null, 2),
    }),
    event: [t(
      "// Unauthenticated order placement must never succeed. 503 is acceptable",
      "// only when the deployment has no service-account configured.",
      "pm.test('never creates an order anonymously', () =>",
      "  pm.expect([401,403,503]).to.include(pm.response.code));",
      "pm.test('no order id returned', () => pm.expect(pm.response.text()).to.not.include('orderId'));",
    )],
  },
  {
    name: 'Orders · POST /api/orders/place without CSRF (expect 403)',
    request: req('POST', '/api/orders/place', {
      headers: { 'Content-Type': 'application/json' },
      auth: 'Bearer {{idToken}}',
      body: JSON.stringify({ order: { items: [{ fabricId: '1', quantity: 1 }], paymentMethod: 'cod' } }, null, 2),
    }),
    event: [t(
      "pm.test('rejected without a CSRF token', () => pm.expect([403]).to.include(pm.response.code));",
      "pm.test('reports csrf_token_invalid', () => pm.expect(pm.response.text()).to.include('csrf'));",
    )],
  },
  {
    name: 'Orders · GET /api/orders/place (expect 405)',
    request: req('GET', '/api/orders/place'),
    event: [t(
      "pm.test('method not allowed', () => pm.expect([403,405]).to.include(pm.response.code));",
    )],
  },
  {
    name: 'Payments · POST /api/payments/create-order without auth (expect 401/503)',
    request: req('POST', '/api/payments/create-order', {
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': '{{csrfToken}}', Cookie: 'tresor_csrf={{csrfToken}}' },
      body: JSON.stringify({ items: [{ fabricId: '1', quantity: 1 }], paymentMethod: 'card' }, null, 2),
    }),
    event: [t(
      "// Must not mint a Razorpay order for an anonymous caller.",
      "pm.test('no anonymous payment order', () => pm.expect([401,403,503]).to.include(pm.response.code));",
      "pm.test('no razorpay order id leaked', () => pm.expect(pm.response.text()).to.not.match(/order_[A-Za-z0-9]/));",
    )],
  },
  {
    name: 'Payments · POST /api/payments/verify with a forged signature (expect 400/401/403/503)',
    request: req('POST', '/api/payments/verify', {
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': '{{csrfToken}}', Cookie: 'tresor_csrf={{csrfToken}}' },
      auth: 'Bearer {{idToken}}',
      body: JSON.stringify({
        success: { razorpay_order_id: 'order_FORGED', razorpay_payment_id: 'pay_FORGED', razorpay_signature: 'deadbeef' },
        order: { items: [{ fabricId: '1', quantity: 1 }], paymentMethod: 'card', shippingAddress: {} },
      }, null, 2),
    }),
    event: [t(
      "// THE critical payment control: a forged signature must never produce a paid order.",
      "pm.test('forged signature rejected', () =>",
      "  pm.expect([400,401,403,503]).to.include(pm.response.code));",
      "pm.test('response is not a success', () => pm.expect(pm.response.text()).to.not.include('\"ok\":true'));",
    )],
  },
  {
    name: 'Payments · POST /api/payments/webhook with a bad signature (expect 400/401/503)',
    request: req('POST', '/api/payments/webhook', {
      headers: { 'Content-Type': 'application/json', 'X-Razorpay-Signature': 'not-a-valid-signature' },
      body: JSON.stringify({ event: 'payment.captured', payload: {} }, null, 2),
    }),
    event: [t(
      "pm.test('unsigned webhook rejected', () => pm.expect([400,401,403,503]).to.include(pm.response.code));",
    )],
  },
  {
    name: 'Bulk email · POST /api/email/bulk as a NON-admin (expect 403)',
    request: req('POST', '/api/email/bulk', {
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': '{{csrfToken}}', Cookie: 'tresor_csrf={{csrfToken}}' },
      auth: 'Bearer {{idToken}}',
      body: JSON.stringify({ subject: 'should never send', htmlContent: '<p>hi</p>', listId: 1 }, null, 2),
    }),
    event: [t(
      "// A normal signed-in customer must not be able to mail the whole list.",
      "pm.test('non-admin cannot send bulk email', () =>",
      "  pm.expect([401,403,503]).to.include(pm.response.code));",
      "pm.test('no campaign id returned', () => pm.expect(pm.response.text()).to.not.include('campaignId'));",
    )],
  },
  {
    name: 'Bulk email · POST /api/email/bulk anonymously (expect 401/403)',
    request: req('POST', '/api/email/bulk', {
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': '{{csrfToken}}', Cookie: 'tresor_csrf={{csrfToken}}' },
      body: JSON.stringify({ subject: 'should never send', htmlContent: '<p>hi</p>', listId: 1 }, null, 2),
    }),
    event: [t(
      "pm.test('anonymous cannot send bulk email', () =>",
      "  pm.expect([401,403,503]).to.include(pm.response.code));",
    )],
  },
  {
    name: 'Bulk email · script tag in htmlContent is refused (expect 400/401/403)',
    request: req('POST', '/api/email/bulk', {
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': '{{csrfToken}}', Cookie: 'tresor_csrf={{csrfToken}}' },
      auth: 'Bearer {{adminIdToken}}',
      body: JSON.stringify({ subject: 'xss attempt', htmlContent: '<p>hi</p><script>alert(1)</script>', listId: 1 }, null, 2),
    }),
    event: [t(
      "// Even an admin may not relay active content into customer inboxes.",
      "pm.test('active content refused', () =>",
      "  pm.expect([400,401,403,503]).to.include(pm.response.code));",
      "pm.test('never reports a sent campaign', () => pm.expect(pm.response.text()).to.not.include('campaignId'));",
    )],
  },
  {
    name: 'Counter · POST /api/pos/sale as a NON-admin (expect 403)',
    request: req('POST', '/api/pos/sale', {
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': '{{csrfToken}}', Cookie: 'tresor_csrf={{csrfToken}}' },
      auth: 'Bearer {{idToken}}',
      body: JSON.stringify({ sale: { items: [{ fabricId: '1', quantity: 1 }], paymentMethod: 'cash', saleKey: 'postman-negative' } }, null, 2),
    }),
    event: [t(
      "// THE most important negative in the suite: the counter mints PAID orders",
      "// and moves stock, so a customer token must never get through.",
      "pm.test('a customer cannot ring up a sale', () =>",
      "  pm.expect([401,403,503]).to.include(pm.response.code));",
      "pm.test('no order id returned', () => pm.expect(pm.response.text()).to.not.include('orderId'));",
    )],
  },
  {
    name: 'Counter · POST /api/pos/sale anonymously (expect 401/403/503)',
    request: req('POST', '/api/pos/sale', {
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': '{{csrfToken}}', Cookie: 'tresor_csrf={{csrfToken}}' },
      body: JSON.stringify({ sale: { items: [{ fabricId: '1', quantity: 1 }], paymentMethod: 'cash', saleKey: 'postman-anon' } }, null, 2),
    }),
    event: [t(
      "pm.test('never sells anonymously', () => pm.expect([401,403,503]).to.include(pm.response.code));",
      "pm.test('no order id returned', () => pm.expect(pm.response.text()).to.not.include('orderId'));",
    )],
  },
  {
    name: 'Counter · POST /api/pos/sale without CSRF (expect 403)',
    request: req('POST', '/api/pos/sale', {
      headers: { 'Content-Type': 'application/json' },
      auth: 'Bearer {{idToken}}',
      body: JSON.stringify({ sale: { items: [{ fabricId: '1', quantity: 1 }], paymentMethod: 'cash', saleKey: 'postman-nocsrf' } }, null, 2),
    }),
    event: [t(
      "pm.test('rejected without a CSRF token', () => pm.expect([403]).to.include(pm.response.code));",
    )],
  },
  {
    name: 'Counter · GET /api/pos/sale (expect 405)',
    request: req('GET', '/api/pos/sale'),
    event: [t(
      "pm.test('method not allowed', () => pm.expect([403,405]).to.include(pm.response.code));",
    )],
  },
  {
    name: 'Counter · body carrying userId / total / paymentStatus is ignored (expect no order)',
    request: req('POST', '/api/pos/sale', {
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': '{{csrfToken}}', Cookie: 'tresor_csrf={{csrfToken}}' },
      auth: 'Bearer {{idToken}}',
      body: JSON.stringify({ sale: { items: [{ fabricId: '1', quantity: 1 }], paymentMethod: 'cash', saleKey: 'postman-smuggle', userId: 'attacker', total: 1, paymentStatus: 'paid' } }, null, 2),
    }),
    event: [t(
      "// Identity, money and settlement state are the server's to set. With a",
      "// non-admin token this is refused outright; the assertion that matters is",
      "// that no order is ever reported back.",
      "pm.test('no order created', () => pm.expect([400,401,403,503]).to.include(pm.response.code));",
      "pm.test('no order id returned', () => pm.expect(pm.response.text()).to.not.include('orderId'));",
    )],
  },
  {
    name: 'CORS · POST from a disallowed origin (expect 403)',
    request: req('POST', '/api/orders/place', {
      headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
      body: '{}',
    }),
    event: [t(
      "pm.test('foreign origin rejected', () => pm.expect([403]).to.include(pm.response.code));",
    )],
  },
];

const folder = {
  name: FOLDER,
  description:
    'Security contract for the Vercel serverless endpoints. These are NOT covered by the Firebase emulator suite (the static preview serves no /api), so they run against a DEPLOYED environment: set apiBase to the deployment origin, e.g. https://tresorcouture.in. ' +
    'Every assertion here is a negative one — none of these requests may ever succeed — so the suite is safe to run against production.',
  item: items,
};

// Idempotent: replace an existing folder rather than appending a second copy,
// so this can be re-run every time an endpoint is added.
const at = c.item.findIndex((i) => i.name === FOLDER);
if (at >= 0) c.item[at] = folder;
else c.item.push(folder);

fs.writeFileSync(FILE, JSON.stringify(c, null, 2) + '\n');
console.log(`Added "${FOLDER}" with ${items.length} requests.`);
