# Security Review Audit — Tresor Couture

**Date:** 2026-06-05
**Branch:** `claude/production-report-security-audit-FVOEX` (at `9cf7753`)
**Reviewer scope:** Static review of the full repository — Vercel serverless API (`/api`), Firestore security rules, client auth/data layer (`src/lib`), build/CI config, dependency tree, and git history.
**Method:** Manual code review + `npm audit` + secret scan across all git history + bundle inspection. No live/dynamic testing was performed (no deployed target in scope).

**Overall posture:** 🟢 **Strong for a rules-only architecture.** The money path is correctly server-authoritative, the rules are default-deny, and no real secrets are committed. The findings below are hardening items, not a broken foundation. The two most important are **SEC-01** (payment endpoints don't authenticate the caller) and **SEC-02** (client-created COD orders aren't price-validated).

---

## Severity summary

| ID | Severity | Finding | Location |
|---|---|---|---|
| SEC-01 | **High** | Payment endpoints don't authenticate the caller; `userId` is forgeable | `api/payments/create-order.ts`, `api/payments/verify.ts` |
| SEC-02 | **High** | Client-created COD orders trust client-supplied totals (rules don't validate price) | `firestore.rules:74`, `src/lib/firebase.ts:814` |
| SEC-03 | **Medium** | No rate limiting / abuse controls on any endpoint; `/api/contact` is public + `*` CORS | all of `api/` |
| SEC-04 | **Medium** | `coupons` collection is world-readable (codes & values enumerable) | `firestore.rules:39` |
| SEC-05 | **Medium** | `admin_notifications` writable by any signed-in user (admin-inbox spam) | `firestore.rules:136` |
| SEC-06 | **Low/Med** | TOCTOU in payment-verify idempotency (duplicate-order race) | `api/payments/verify.ts:80` |
| SEC-07 | **Low/Med** | Missing CSP and HSTS response headers | `vercel.json:46` |
| SEC-08 | **Low** | CORS defaults to `*` when `ALLOWED_ORIGIN` is unset | `api/contact.ts:16`, `api/email/*.ts` |
| SEC-09 | **Low** | 8 moderate transitive dependency advisories (server-only) | `firebase-admin` tree |
| SEC-10 | **Low** | `mail/` lets a customer enqueue arbitrary HTML to their own verified address | `firestore.rules:120` |
| SEC-11 | **Info** | No admin read path for `payment_events` orphans (default-deny) | `api/payments/webhook.ts:111` |
| SEC-12 | **Info** | Doc drift: checklist still cites the removed admin passcode | `docs/PRODUCTION-CHECKLIST.md:22` |

---

## What's already done well (verified)

These are not findings — they're controls confirmed present, worth recording so they aren't regressed.

- **Server-authoritative pricing.** The client total is ignored; the amount is recomputed from Firestore product prices and coupon definitions (`api/_lib/pricing.ts`). A tampered client total cannot result in an under-charge on the Razorpay path.
- **Payment signature verification with timing-safe comparison.** `verifyCheckoutSignature` / `verifyWebhookSignature` use `crypto.timingSafeEqual` over equal-length buffers (`api/_lib/razorpay.ts:57`).
- **Webhook verified against the raw body.** Vercel's body parser is disabled (`export const config = { api: { bodyParser: false } }`) and the HMAC is computed over the raw bytes (`api/payments/webhook.ts`).
- **Amount anti-tamper on verify.** The captured Razorpay amount is re-fetched and compared to the recomputed authoritative amount before any order is written (`api/payments/verify.ts:101`).
- **Transactional stock decrement.** Stock is re-read and decremented inside a Firestore transaction, rejecting short lines (`verify.ts:111`).
- **ID-token gating where it matters.** `email/order`, `email/welcome`, `whatsapp/notify` verify a Firebase ID token and **force the recipient to the authenticated user's own verified email** — no arbitrary-recipient spoofing (`api/email/order.ts:112`).
- **HTML escaping in server-rendered email.** `escapeHtml` is applied to all interpolated user data in the Brevo email bodies.
- **No client-side XSS sinks.** No `dangerouslySetInnerHTML`, `eval`, or `document.write` in the app; React's default escaping is relied on. The only `innerHTML` use sets the empty string to clear a reCAPTCHA slot (`src/lib/firebase.ts:404`) — safe.
- **Default-deny Firestore rules** with a documented per-collection model and protected fields (`role`, `uid`, `createdAt` cannot be self-escalated; `paymentStatus:'paid'` cannot be self-asserted by a client).
- **No secrets in source or history.** A scan across all 88 commits found only the **public** Firebase Web API key (intentionally public — it routes, it does not authorize) and placeholder docs. `.gitignore` excludes `.env*` and all service-account key patterns; CI fails the build if a secret name reaches `dist/assets`.
- **Account-enumeration hygiene** on password reset (generic messaging guidance in `sendPasswordReset`).

---

## Findings (detailed)

### SEC-01 — Payment endpoints don't authenticate the caller `High`

**Location:** `api/payments/create-order.ts`, `api/payments/verify.ts` (and `src/lib/payments.ts:218` which forwards `userId` from the client).

**Issue:** Neither payment endpoint verifies a Firebase ID token. `verify.ts` writes the order with `userId: order.userId ?? null` taken straight from the request body. An attacker calling the API directly can:
- attribute a (legitimately paid) order to **another user's uid**, or to `null`;
- create orders that bypass the client entirely.

**What is *not* at risk:** the charged amount (recomputed server-side) and payment authenticity (signature verified). This is an **integrity / authorization** gap on order ownership, not a direct money-loss bug.

**Impact:** Order history can be poisoned (orders appearing under a victim's account), and orphaned/null-owner orders complicate fulfilment and DPDP data-subject handling.

**Recommendation:** Verify the ID token on both endpoints and derive `userId` from `decoded.uid` — the exact pattern already exists in `api/email/order.ts:32`. Reject unauthenticated calls with `401`. Pass the token from the client (`user.getIdToken()`), as `captureNewUser` already does.

---

### SEC-02 — Client-created COD orders trust client-supplied totals `High`

**Location:** `firestore.rules:74` (orders `create`), `src/lib/firebase.ts:814` (`ordersApi.place`).

**Issue:** The Firestore rule for creating an order only checks `userId`, `status == 'placed'`, a non-empty `items` list, `total is number && total >= 0`, and a non-`paid` payment status. It does **not** validate that `total`/`subtotal`/`tax` match the items × current prices. The authoritative pricing engine (`api/_lib/pricing.ts`) only runs on the Razorpay path. For COD, `ordersApi.place()` computes totals **client-side**, and a crafted Firestore write can set any `total >= 0` (e.g. `0`).

**Impact:** Fraudulent COD order values; corrupted financial records / invoices. Bounded by the fact that COD is pay-on-delivery and an operator can inspect before dispatch — but the recorded total (and any GST invoice generated from it) would be wrong.

**Recommendation:** Route COD through a server endpoint that prices it authoritatively (reuse `computeBreakdown`), **or** tighten the rule to recompute is infeasible in rules — so at minimum (a) cap COD by value + serviceable pincode, (b) flag COD orders as "amount unverified" until an operator confirms, and (c) never emit a GST invoice from an unverified client total. This is partially acknowledged in the go-live checklist ("COD gated by value cap + serviceable pincode").

---

### SEC-03 — No rate limiting / abuse controls `Medium`

**Location:** all `api/*` handlers.

**Issue:** No endpoint throttles requests. Notably:
- `api/contact.ts` is **public** (no auth) with `Access-Control-Allow-Origin: *` — anyone can script bulk POSTs to inject/enumerate Brevo contacts and burn email-provider quota/cost.
- `api/payments/create-order.ts` can be hammered to spam Razorpay order creation.
- The ID-token-gated email endpoints can be looped by any signed-in user.

Serverless platforms provide no implicit throttle, and billing scales with invocations.

**Impact:** Cost amplification, marketing-list pollution, provider rate-limit/reputation damage, nuisance.

**Recommendation:** Add rate limiting (Vercel middleware, or Upstash/Redis token bucket keyed on IP + uid). Add a CAPTCHA or honeypot to the public `/api/contact`. Set a Firebase/Google Cloud billing budget + alert (also in the checklist).

---

### SEC-04 — `coupons` collection is world-readable `Medium`

**Location:** `firestore.rules:39` (`allow read: if true`).

**Issue:** Any unauthenticated client can list every coupon document — codes, discount kind/value, `minSubtotal`, `maxDiscount`, expiry, and the `active` flag. The client reads this to validate codes at checkout (`couponsApi.validate`).

**Impact:** Unadvertised / staff / partner codes are discoverable; competitors can read your entire promo strategy; margin erosion from leaked high-value codes.

**Recommendation:** Don't expose the collection. Validate coupons **server-side** (the authoritative pricing engine already looks them up via the Admin SDK — `api/_lib/pricing.ts:103`) and return only the resulting discount to the client. If a client-side check is kept for UX, restrict reads to a single doc-by-id lookup and treat the result as advisory.

---

### SEC-05 — `admin_notifications` writable by any signed-in user `Medium`

**Location:** `firestore.rules:136`.

**Issue:** The rule allows any signed-in user to create an `admin_notifications` doc as long as `kind == 'new_order'`. There's no check that a corresponding order exists, and `total`/`itemCount`/`customerEmail` are arbitrary.

**Impact:** A signed-in user can flood the admin dashboard with fake "new order" alerts (operational DoS of the admin inbox; potential to mask a real order in the noise).

**Recommendation:** Move "new order" alerting server-side (write it from `verify.ts` / a server endpoint with the Admin SDK), and make `admin_notifications` admin-write-only. If client-write must stay, bound it (rate-limit, and validate the referenced `orderId` belongs to the writer).

---

### SEC-06 — TOCTOU race in payment-verify idempotency `Low/Medium`

**Location:** `api/payments/verify.ts:80-90`.

**Issue:** The "have we already recorded this payment?" check is a query that runs **outside** the subsequent transaction. Two concurrent `verify` calls for the same `razorpay_payment_id` (double-submit, retry, network replay) could both see `existing.empty` and both create an order + decrement stock.

**Impact:** Duplicate order documents and double stock decrement for the same payment. Low probability (single payment, single user) but non-zero.

**Recommendation:** Make the write idempotent by construction — derive the order document id deterministically from the payment id (`db.collection('orders').doc(razorpay_payment_id)`) and do a `create`-if-absent inside the transaction, or re-check existence inside the transaction before writing.

---

### SEC-07 — Missing CSP and HSTS headers `Low/Medium`

**Location:** `vercel.json:46` (the catch-all `headers` block).

**Issue:** Good headers are present (`X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`) but there is **no `Content-Security-Policy`** and **no `Strict-Transport-Security`**. The app injects third-party scripts (Razorpay `checkout.js`, Firebase, GA), so a CSP would meaningfully reduce XSS blast radius.

**Impact:** No defense-in-depth against injected/third-party script abuse; no enforced HTTPS pinning.

**Recommendation:** Add `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` and a CSP allowing only required origins (self, `*.razorpay.com`, `*.firebaseio.com`/`*.googleapis.com`, GA). Start in `Content-Security-Policy-Report-Only` to tune, then enforce.

---

### SEC-08 — CORS defaults to `*` `Low`

**Location:** `api/contact.ts:16`, `api/email/order.ts:17`, `api/email/welcome.ts:10`, `api/whatsapp/notify.ts:17`.

**Issue:** `Access-Control-Allow-Origin` falls back to `*` when `ALLOWED_ORIGIN` is unset. For the token-gated endpoints this is not a credential-theft vector (no cookies; bearer token required), but combined with SEC-03 it lets any origin invoke the public contact endpoint from a browser.

**Recommendation:** Set `ALLOWED_ORIGIN` to the production origin in Vercel for all environments.

---

### SEC-09 — Moderate transitive dependency advisories `Low`

**Detail:** `npm audit` reports **8 moderate** advisories, all transitive under `firebase-admin` (`uuid`, `gaxios`, `google-gax`, `@google-cloud/firestore`, `@google-cloud/storage`, `teeny-request`, `retry-request`). These run **server-side only** and are confirmed absent from `dist/assets` (CI guard + manual grep). No client exposure.

**Recommendation:** `npm audit fix` and/or bump `firebase-admin` to the latest. Low urgency given server-only usage, but trivial hygiene.

---

### SEC-10 — `mail/` allows customer-controlled HTML to self `Low`

**Location:** `firestore.rules:120`, consumed by the `firestore-send-email` extension.

**Issue:** A customer may enqueue a `mail/` doc only when `to == request.auth.token.email` (good — can't spam others), but the `message` (subject/html/text) is arbitrary client content sent **from your verified domain**. A user can mail themselves arbitrary HTML through your sender reputation.

**Impact:** Minor — self-only. Possible niche abuse of domain reputation / a phishing template sent to oneself.

**Recommendation:** Prefer enqueuing mail server-side (Admin SDK) with templates, and make `mail/` admin-write-only. If client enqueue stays, constrain it to known template ids rather than free-form HTML.

---

### SEC-11 — No admin read path for orphan `payment_events` `Info`

**Location:** `api/payments/webhook.ts:111`.

**Issue:** Unmatched webhook payments are written to a `payment_events` collection for manual reconciliation. There is no rule granting read access, so it falls under default-deny — meaning the admin console (Web SDK) cannot surface these orphans in-app; they're only visible via the server/console.

**Recommendation:** Add an admin-read rule for `payment_events` if you want orphan payments visible in the admin UI, or document that reconciliation is console-only.

---

### SEC-12 — Documentation drift on admin passcode `Info`

**Location:** `docs/PRODUCTION-CHECKLIST.md:22`.

**Issue:** The checklist still treats `VITE_ADMIN_PASSCODE` (`tresor-atelier`) as a security control, but commit `c01200f` removed the client-side passcode gate in favour of the `admin` custom claim (`AdminGuard.tsx`). The stale item could mislead an operator into thinking a passcode protects the admin area.

**Recommendation:** Update the checklist to reference only the admin custom-claim bootstrap.

---

## Prioritized remediation plan

**Before taking real money (P0):**
1. SEC-01 — authenticate payment endpoints; derive `userId` from the ID token.
2. SEC-02 — constrain COD (value cap, server pricing or operator confirmation, no invoice from unverified totals).

**Pre-launch / first week (P1):**
3. SEC-03 — rate limiting + CAPTCHA on `/api/contact`; billing budget alert.
4. SEC-04 — stop exposing `coupons`; validate server-side.
5. SEC-07 — add CSP (report-only → enforce) and HSTS.
6. SEC-06 — make verify idempotent by deterministic doc id.

**Hygiene / follow-up (P2):**
7. SEC-05, SEC-08, SEC-09, SEC-10, SEC-11, SEC-12.

---

## Methodology & caveats

- This was a **static** review of source at commit `9cf7753`. It did not include dynamic testing (authenticated fuzzing, live rules-emulator tests, or payment replay against a deployment).
- Recommended next step before go-live: run the Firestore rules through the emulator with adversarial test cases (especially the orders-create and coupons paths), and run an authenticated abuse test against `/api/contact` and the payment endpoints.
- No finding here indicates an active compromise or a committed secret. The architecture's security model (rules-only authz + server-authoritative payments) is sound; the work is hardening within that model.
