# 06 — Implementation Plan · Build Sequence

> The template treats this as a forward plan. Tresor Couture is already built, so
> this serves two purposes: **(a)** the record of how it was sequenced and what
> "done" meant at each phase, and **(b)** the remaining work, which is the part
> that still matters.

---

## Phases 1–9 — complete

| Phase | Scope | Done criteria | Status |
|---|---|---|---|
| **1 · Setup** | Vite + React 19 + TS, Tailwind v4, hash router, folder structure, env wiring, Vercel + GitHub auto-deploy | `npm run build` green; deploys on merge to `main` | ✅ |
| **2 · Data layer** | Firestore collections, `src/types.ts`, `firestore.rules` as the security boundary, catalogue seeders | Rules deployed; seed populates products + coupons | ✅ |
| **3 · Auth** | Firebase Auth email/password, `AuthContext`, admin custom claim, `AdminGuard` | Sign up/in/out works; admin routes gated by claim **and** rules | ✅ |
| **4 · Catalogue & cart** | Shop grid, filters, search, PDP with gallery/colours/stock, cart, wishlist, coupons | Add-to-bag respects stock; coupon applies | ✅ |
| **5 · Checkout & orders** | 3-step checkout, `POST /api/orders/place` (server-recomputed pricing + stock decrement), confirmation, order history, Brevo confirmation email | Client cannot create an order (403); COD order placed in production; email received | ✅ |
| **6 · Returns & refunds** | RMA model, customer modal, 7-day window enforced in rules against server-stamped `deliveredAt`, admin queue + status workflow | Return blocked outside window / on someone else's order; full workflow to `refunded` | ✅ |
| **7 · Support: chat & call** | Per-order chat (`chats/{orderId}`), real-time both directions, unread badges, admin inbox; Call = `tel:` native dialer | Two-party real-time delivery with no reload; cross-customer read denied | ✅ |
| **8 · CRM & admin console** | 13 admin sections; CRM overlay with lifecycle, notes, lifetime value, CSV export | Admin can run the business without touching the database | ✅ |
| **9 · Compliance & polish** | GST invoices (CGST/SGST vs IGST), policy pages, consent capture, DPDP export/erasure, mobile responsiveness, empty/loading/error states | Invoice generated per order; admin console usable at 390px | ✅ |

### Phase 10 · Hardening — complete

- Defence-in-depth on every state-changing endpoint: CORS → CSRF → method → rate limit → ID token.
- Dropped the hard Upstash dependency (in-memory fallback) — no external service required to run.
- Fixed `ERR_REQUIRE_ESM` from `jose` v6 (pinned v5) that was 500-ing **every** authenticated API call.
- Fixed the Admin-SDK init-order bug that broke order-confirmation email.
- Legal-registration validation with PAN↔GSTIN cross-checks.
- UI: mobile admin nav, modal scroll-lock, customer unread badge, image placeholder fallback.

### Testing performed

| Suite | Result |
|---|---|
| Playwright E2E — desktop (1280×900), 22 steps | ✅ 22/22 |
| Playwright E2E — mobile (390×844), same 22 steps | ✅ 22/22 |
| Playwright — mobile admin nav + unread badge | ✅ 2/2 |
| Playwright — two-party real-time chat | ✅ |
| Postman/newman — API + security | ✅ 57/58 |
| Firestore rules probes — return window, chat isolation, injection | ✅ |
| `tsc --noEmit`, `vite build` | ✅ |
| Production deploy health + runtime errors | ✅ READY, 0 errors |

All emulator suites run against the **real `firestore.rules`**, so rule
regressions fail the tests.

---

## Remaining work

### 🔴 Phase 11 · Go-live blockers *(owner: operator, not code)*

1. **Rotate the Firebase service-account key.** A key was exposed during
   development. Generate a new one (Firebase Console → Project Settings →
   Service Accounts), set `FIREBASE_SERVICE_ACCOUNT` in Vercel, redeploy, then
   **delete the old key** in Google Cloud → IAM → Service Accounts → Keys. Until
   this is done the project is not launch-safe.
2. **Set legal registrations:** `VITE_LEGAL_NAME`, `VITE_GSTIN`, `VITE_PAN` in
   Vercel (Production), then redeploy — Vite bakes them in at build time. Verify
   at Admin → Compliance, which now cross-checks that the GSTIN embeds the PAN
   and carries the right state code. Note the PAN's 4th character encodes entity
   type and must match the legal name.

**Done criteria:** old key revoked; Admin → Compliance shows all checks green.

### 🟡 Phase 12 · Engineering follow-ups

- **CI:** run the Playwright emulator suites on every PR (GitHub Actions:
  Java + emulators + seed + build + test). Currently manual — this is the
  highest-value remaining engineering task.
- **Audit chain:** five transitive advisories remain via
  `google-gax → rimraf → glob → minimatch → brace-expansion`. The published fix
  breaks `minimatch` at runtime; revisit when upstream re-pins. See PR #23.
- **Global rate limiting:** set `UPSTASH_REDIS_REST_URL/TOKEN` when traffic
  justifies it; today's limiter is per-instance best-effort.
- Uptime alerting on `/api/health`.

### 🟢 Phase 13 · Deferred product scope

- **Online payments.** Razorpay endpoints exist and are tested. To enable: set
  `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`,
  `VITE_RAZORPAY_KEY_ID`, then surface the UPI/Card options currently rendered
  as "Coming soon". See `docs/PAYMENTS-SETUP.md`.
- **Automated refund payouts.** Today refunds are recorded in the system and paid
  manually; automating them depends on the payment rail above.
- WhatsApp order alerts (endpoint dormant pending Meta credentials).
- Reviews on the storefront; product catalogue merchandising at scale.

---

## Definition of done for the current release

- [x] A customer can browse, add to bag, and place a COD order end-to-end.
- [x] The buyer receives an order-confirmation email.
- [x] A customer can raise a return within 7 days of delivery, and only then.
- [x] A customer and the atelier can converse in real time about a specific order.
- [x] No customer can see another customer's data — enforced by rules, not UI.
- [x] The admin can run orders, returns, support and CRM from a phone.
- [ ] **The exposed service-account key has been rotated.**
- [ ] **Legal registration values are set and validated.**

The two unchecked boxes are the difference between "feature-complete" and
"safe to launch".
