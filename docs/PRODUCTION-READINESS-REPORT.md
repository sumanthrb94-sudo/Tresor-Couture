# Production Readiness Report — Tresor Couture

**Date:** 2026-06-05
**Branch reviewed:** `claude/production-report-security-audit-FVOEX` (at `9cf7753`)
**Scope:** Full application — React/Vite storefront, Vercel serverless API (`/api`), Firebase (Auth + Firestore), Razorpay payments.
**Verdict:** 🟡 **Conditionally ready.** The codebase is well-architected and the automated quality gates are green. Go-live is gated on a small set of operational + security items (payments KYC, server-side caller auth on payment endpoints, COD total integrity, abuse controls). None require a rewrite.

> This report pairs with `docs/SECURITY-AUDIT.md` (full security findings), `docs/PRODUCTION-CHECKLIST.md` (go-live sign-off), and `MANUAL-ACTIONS.md` (operator runbook).

---

## 1. Executive summary

Tresor Couture is a heritage-fabric D2C store built on a deliberately lean stack: a Vite/React 19 SPA served from Vercel, Firebase Auth + Firestore as the live backend, and a thin set of Vercel serverless functions in `/api` for the operations that *must* run with authority (Razorpay order creation/verification, transactional email, WhatsApp alerts).

The engineering quality is high:

- **Payments are server-authoritative.** The browser never decides the amount and never writes a paid order; pricing is recomputed from Firestore and the Razorpay signature is verified server-side (`api/_lib/pricing.ts`, `api/payments/verify.ts`).
- **Firestore rules are default-deny** with a documented per-collection model (`firestore.rules`).
- **CI enforces a real gate** — typecheck, production build, and a grep that fails the build if a server SDK or secret name leaks into the client bundle (`.github/workflows/ci.yml`).
- **No real secrets are committed** — only the public Firebase Web config (which is not a secret by design).

The remaining work is mostly *operational configuration* (KYC, env vars, domain/OAuth) plus a handful of *hardening* items detailed in the security audit. The two findings most worth resolving before taking real money are: (1) the payment endpoints do not authenticate the caller, so order→user attribution is forgeable, and (2) client-created COD orders are not price-validated by the Firestore rules.

---

## 2. Verified build & quality gates

All commands were run against a clean `npm ci` install in this environment.

| Gate | Command | Result |
|---|---|---|
| Type safety | `npm run lint` (`tsc --noEmit`) | ✅ **PASS** (exit 0) |
| Production build | `npm run build` (`vite build`) | ✅ **PASS** (exit 0, built in ~4.6s) |
| Secret-leak guard | `grep -rlE "firebase-admin\|RAZORPAY_KEY_SECRET\|BREVO_API_KEY" dist/assets/` | ✅ **PASS** (no server SDK/secret in bundle) |
| Dependency audit | `npm audit` | 🟡 8 moderate (transitive, server-only — see §6) |
| Committed-secret scan | `git grep` across all history | ✅ No real secrets; only the public Firebase Web key |

### Bundle composition (gzip)

The app is code-split per route. The dominant chunk is the Firebase Web SDK:

| Chunk | Raw | Gzip |
|---|---|---|
| `vendor-firebase` | 528.6 kB | 120.2 kB |
| `vendor-react` | 198.9 kB | 62.1 kB |
| `index` (app shell) | 177.0 kB | 46.2 kB |
| `AdminPage` (lazy) | 129.9 kB | 27.8 kB |

**Assessment:** Acceptable for launch. The Firebase SDK is the unavoidable cost of the rules-only architecture; it is loaded once and cached aggressively (`vercel.json` sets `max-age=31536000, immutable` on `/assets`). The admin bundle is correctly lazy-loaded so customers never download it. If first-paint becomes a concern later, modular Firebase imports / lazy-loading Firestore on routes that need it are the obvious next lever.

---

## 3. Architecture at a glance

```
Browser (React SPA, hash routing)
  │
  ├── Firebase Web SDK ──► Firestore  ◄── firestore.rules  (the entire authz boundary)
  │                        Firebase Auth (email/pw, Google, phone OTP)
  │
  └── fetch /api/* ──► Vercel serverless (Node, ESM)
                         ├── payments/create-order, verify, webhook  (Razorpay + Admin SDK)
                         ├── email/order, email/welcome              (Brevo, ID-token gated)
                         ├── whatsapp/notify                         (Meta Cloud API, ID-token gated)
                         └── contact                                 (Brevo marketing, public)
```

**Design choices worth calling out as strengths:**

- **Graceful degradation.** Every privileged integration gates on its own env config and falls back cleanly: no Razorpay keys → demo checkout (`src/lib/payments.ts`); no Admin SDK → `503 payments_not_configured`; localhost → marketing/email no-ops. Builds and previews work with zero secrets.
- **Authority on the server, convenience on the client.** Client-side `ordersApi.place()` recomputes totals for UX, but the *binding* truth for paid orders is `api/_lib/pricing.ts` + the Razorpay signature check.
- **PII / DPDP awareness baked in.** `usersApi.exportData` (right to access) and `adminAnonymiseAndDelete` (right to erasure, retaining financial fields for GST law) are implemented in `src/lib/firebase.ts`.

---

## 4. Readiness by domain

| Domain | Status | Notes |
|---|---|---|
| **Build / typecheck / CI** | 🟢 Ready | Gates green; CI runs on every push + PR. |
| **Payments — paid path** | 🟢 Strong (pending KYC) | Server-authoritative pricing + signature + idempotency + webhook backstop. Needs live Razorpay keys (KYC) and the caller-auth fix (§7). |
| **Payments — COD path** | 🟡 Needs work | Client-created orders trust client totals at the rules layer (SEC-02). Add a value cap + admin verification or a server endpoint. |
| **Auth** | 🟢 Ready | Email/pw, Google (popup-first, redirect fallback), phone OTP, account linking, branded reset. Robust reCAPTCHA lifecycle handling. Verify on the live domain. |
| **Authorization (Firestore rules)** | 🟢 Mostly ready | Default-deny, role/claim protected. Minor hardening: coupons world-readable, `admin_notifications` open to any signed-in user (SEC-04/05). |
| **Admin console** | 🟢 Ready | Now gated purely on the `admin` custom claim (`AdminGuard.tsx`); the old client-side passcode was removed. (Checklist still references it — doc drift, §8.) |
| **Email** | 🟡 Config | Code complete (Brevo + Trigger Email extension). Needs domain SPF/DKIM, extension install, `BREVO_API_KEY`. |
| **WhatsApp** | ⚪ Dormant | Wired but no-ops until Meta Cloud API creds + approved template are set. |
| **Security headers** | 🟢 Ready | X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, **plus HSTS + CSP** (SEC-07 fixed — validate CSP in preview). |
| **Abuse / rate limiting** | 🟢 Basic | Best-effort per-instance rate limiting on public/expensive endpoints (SEC-03 fixed); back with a durable store for hard guarantees. |
| **Observability** | 🟡 Basic | `console.error` + Vercel Analytics/Speed Insights. No error tracking (Sentry) or structured logs; no health endpoint. |
| **Tests** | 🟡 Thin | Playwright E2E against live deployments + tsc as the static gate. No unit tests around pricing/coupon math (highest-value place to add them). |
| **Dependencies** | 🟢 Clean | `npm audit` 0 vulnerabilities (SEC-09 fixed via a patched-`uuid` override). |
| **Secrets management** | 🟢 Ready | Env-based, gitignored, CI leak-guard, no committed secrets. |
| **Legal / compliance** | 🟡 Content | DPDP export/erasure implemented; policy pages must be published & linked (per checklist). GST 5% computed in code. |

---

## 5. Go-live blockers (must fix before real money)

1. **Razorpay activation (KYC) + live keys** set in Vercel (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `VITE_RAZORPAY_KEY_ID`, `RAZORPAY_WEBHOOK_SECRET`). — *Operational*
2. **`FIREBASE_SERVICE_ACCOUNT` (or keyless ADC)** configured so `/api/payments/*` can establish authoritative pricing. — *Operational*
3. **Authenticate the payment endpoints** (SEC-01): verify the Firebase ID token in `create-order`/`verify` and set `userId` from the token, not the request body. — *Code*
4. **Constrain COD orders** (SEC-02): value cap + serviceable-pincode check, and treat the client-supplied total as advisory until an operator confirms. — *Code + ops*
5. **Domain + OAuth wiring**: custom domain added to Firebase Authorized domains; Google/phone/reset tested on the live origin. — *Operational*

## 6. Recommended before/just-after launch (not hard blockers)

The full SEC-03 … SEC-12 hardening set is now **implemented on this branch** (see
`docs/SECURITY-AUDIT.md`). Remaining items are operational or future polish:

- **Set `ALLOWED_ORIGINS`** in Vercel to the production origin(s) (code defaults to the `tresorcouture.in` domains).
- **Validate the new CSP** (SEC-07) against a preview deploy before promoting — confirm Razorpay/Firebase/GA/Vercel all load.
- **Back the rate limiter** (SEC-03) with Upstash / Vercel platform limiting for multi-instance guarantees; add a CAPTCHA/honeypot to `/api/contact` if abuse appears.
- **Set a Firebase/Google Cloud billing budget + alert.**
- **Add an error tracker** (Sentry/Logflare) — today a failed `/api/*` call only lands in `console.error` / Vercel logs.
- **Unit-test the pricing/coupon engine** (`api/_lib/pricing.ts`) — it's the money path and currently has no isolated tests.

## 7. The single most important code fix

`api/payments/create-order.ts` and `api/payments/verify.ts` accept `order.userId` from the request body and never verify a Firebase ID token. The email/WhatsApp endpoints already demonstrate the correct pattern (`verifyIdToken` against the project's public keys, e.g. `api/email/order.ts:32`). Applying that same pattern to the payment endpoints — and setting `userId = decoded.uid` — closes the order-attribution gap with no architectural change. Money is already safe (amount is recomputed and the signature verified); this is about the integrity of *who* an order belongs to.

## 8. Documentation drift to clean up

`docs/PRODUCTION-CHECKLIST.md` still lists `VITE_ADMIN_PASSCODE` / `tresor-atelier` as a security gate, but commit `c01200f` removed the client-side passcode in favour of the `admin` custom claim (now enforced by `AdminGuard.tsx` + `firestore.rules`). The checklist item is stale and should be updated to "admin custom claim bootstrapped on founder account" only, to avoid implying a passcode still protects anything.

---

## 9. Bottom line

The hard parts — payment authority, rules-based authz, secret hygiene, graceful config gating, a real CI gate — are done and done well. What stands between this and production is **configuration** (KYC, env, domain) and a **short, well-scoped hardening list** led by authenticating the payment endpoints and constraining COD. Ship the security fixes in §5.3–5.4, complete the operational checklist, and this is ready for real customers.
