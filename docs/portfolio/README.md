# Tresor Couture — Portfolio Case Study

**Live site:** https://tresorcouture.in
**Repository:** https://github.com/sumanthrb94-sudo/Tresor-Couture

A production e-commerce platform for a Hyderabad couture house selling bridal
lehengas, sarees and hand-woven heritage fabrics. Storefront, checkout,
customer accounts, real-time support, returns, GST invoicing and a fourteen-
section admin console — built and deployed end to end.

---

## Short version (for a portfolio listing)

> **Tresor Couture — luxury fashion e-commerce platform**
>
> Designed and built a full-stack e-commerce platform for an Indian couture
> house: storefront, Razorpay checkout, customer accounts, real-time
> order chat, a returns/refunds (RMA) workflow enforced down to the database
> rules, GST-compliant tax invoicing, and a 14-section admin console covering
> catalogue, inventory, orders, CRM, billing and compliance.
>
> React 19 · TypeScript · Vite · Tailwind · Firebase · Vercel serverless ·
> Razorpay · Playwright
>
> Notable: authorization is enforced in Firestore security rules rather than
> client code, and every release is gated by a 29-test Playwright suite that
> runs against the Firebase Emulator Suite loading the real production rules.

**Suggested title (≤ 70 characters):**
`Luxury Fashion E-Commerce Platform — React, Firebase, Razorpay`

---

## The problem

An atelier selling five-figure bridal pieces needed to sell online without a
platform fee on every order, and without an ops team. That meant the software
had to absorb the operational load: track stock, take payment, answer
customers, process returns, and produce a compliant tax invoice — with one
person running it from a phone.

## What was built

### Storefront
Catalogue with master categories and design-level subcategories, filtering and
sorting, product detail pages with colourways and stock-aware quantity
controls, cart, wishlist, coupons, address book, and a three-step checkout.

### Payments
Razorpay integration where the **server** is the authority: the order amount is
recomputed server-side from the catalogue before a payment order is minted, and
the payment signature is verified with an HMAC before an order is ever marked
paid. A forged signature cannot produce a paid order — asserted by test.

### Real-time support
Per-order chat between the customer and the atelier, built on Firestore
listeners, with unread badges on both sides. Signed-in only, so every message
is attributable to an account.

### Returns & refunds (RMA)
A full request → approve → pickup → received → refunded lifecycle. The 7-day
return window and the "only on a delivered order" rule are enforced **in the
Firestore security rules**, not just the UI, so they hold even against a
crafted request.

### Compliance
GST-compliant tax invoices with HSN codes and CGST/SGST split. Legal
identifiers (PAN, GSTIN) are validated for format *and* cross-checked against
one another, and the invoice omits a tax number entirely rather than printing a
placeholder — a fabricated GSTIN on a real invoice is a legal exposure, not a
cosmetic bug.

### Admin console — 14 sections
Dashboard, Products, Inventory, Orders, Returns, Billing, Customers/CRM,
Support inbox, Coupons, Reviews, Compliance, Delivery, Bulk Email, and a
Catalogue SEO audit.

### Catalogue SEO audit
An in-house audit over the shop's own product data — duplicate descriptions,
stock codes used as product names, computed strike-through MRPs, base64 images,
thin copy. Built deliberately instead of buying an SEO SaaS seat: the parts of
SEO those tools sell (backlink indexes, competitor rankings) cannot be
self-hosted, but everything that governs whether *your own* products rank is
already in your own database.

---

## Architecture

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 19, TypeScript, Vite 6, Tailwind v4 | Fast builds, strict typing across the domain model |
| Routing | Custom hash router | No router dependency; a known SEO trade-off, documented below |
| Data | Firebase Firestore, browser-direct | No always-on backend to pay for or operate |
| Authorization | `firestore.rules` | The rules *are* the security boundary, not a convenience layer |
| Server logic | Vercel serverless functions (`/api`) | Only where a secret or an authority decision is required |
| Payments | Razorpay (orders, verify, webhook) | Server-side amount recomputation + HMAC signature verification |
| Email | Brevo transactional + campaigns | Order confirmations, welcome, bulk |
| Hosting | Vercel | Preview per PR, production on merge |
| Tests | Playwright + Firebase Emulator Suite | Real rules, real listeners, two concurrent browser contexts |

### The design decision worth explaining

The app writes to Firestore **directly from the browser**. That is only
defensible if the rules file is genuinely airtight, so authorization lives
there and the test suite attacks it: a second customer's account is used in
every run to prove one customer cannot read another's orders, chats or returns.

Server-side functions exist only where the browser must not be trusted —
payment amounts, signature verification, bulk email, stock decrement — and each
runs the same defence chain: **CORS origin allowlist → CSRF double-submit token
→ method check → rate limit → Firebase ID-token auth**.

Stock is decremented inside a Firestore transaction, so an order cannot be
placed for inventory that no longer exists.

---

## Testing

29 Playwright tests against the Firebase Emulator Suite, loading the real
production `firestore.rules`. Every run produces a **PDF report with embedded
screenshots and manual reproduction steps** — 25 documents, versioned in the
repo at [`docs/test-reports/`](../test-reports/).

- 14 admin sections, one test each
- 6 mutating admin workflows, including customer and admin in two concurrent
  browser contexts exchanging messages in real time
- Full customer journey at desktop and mobile viewports (22 screenshots each)
- Security: HTML-injection guard on bulk email (9 attack payloads blocked),
  payment-method gating, cross-customer data isolation

A separate Postman collection covers the serverless endpoints' security
contract: **22 assertions, every one negative** — forged Razorpay signature,
unsigned webhook, anonymous order placement, missing CSRF token, non-admin bulk
email, foreign origin. No request in that folder may ever succeed, so it is safe
to run against production.

CI runs typecheck, build, a dependency-audit gate with a written allowlist, and
the full emulator suite on every push.

---

## Honest limitations

- **The hash router costs organic search.** Fragment URLs are not indexed as
  separate pages, so product pages are currently invisible to Google. Moving to
  history routing with prerendering is the planned fix.
- **Rate limiting degrades without Redis.** Without Upstash configured, the
  limiter is per-serverless-instance rather than global — a soft guard, not a
  hard guarantee.
- **Refund money movement is manual** by choice: the RMA workflow tracks state,
  a human moves the money.

---

## Screenshots

All captured from an automated run against the Firebase Emulator Suite with
seeded data — the same run that produces the test reports.

| # | File | Shows |
|---|---|---|
| 1 | `screenshots/1-storefront-home.png` | Storefront — hero, category navigation, same-day delivery and membership modules |
| 2 | `screenshots/2-admin-dashboard.png` | Admin console — live revenue, orders, low-stock alerts, sales report, 14-section navigation |
| 3 | `screenshots/3-realtime-order-chat.png` | Per-order real-time chat, customer side, showing atelier replies arriving live |
| 4 | `screenshots/4-returns-refunds.png` | Returns & refunds queue with lifecycle status |
| 5 | `screenshots/5-catalogue-seo-audit.png` | In-house catalogue SEO audit |
