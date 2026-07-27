# 02 — TRD · Technical Requirements Document

> Reverse-documented from the shipped codebase. This is the stack of record —
> an AI agent working on this repo should not introduce alternatives to these
> choices without an explicit decision.

---

## Stack at a glance

| Layer | Choice |
|---|---|
| Frontend | **React 19** + **TypeScript** + **Vite 6** |
| Styling | **Tailwind CSS v4** (via `@tailwindcss/vite`), CSS custom properties for theme tokens |
| Routing | **Custom hash router** (`src/context/RouterContext.tsx`) — no react-router |
| Animation | `motion` (Framer Motion successor) |
| Icons | `lucide-react` |
| Backend (data) | **Firebase Firestore**, accessed *directly from the browser* via the Web SDK |
| Backend (compute) | **Vercel serverless functions** under `/api`, Node runtime, `firebase-admin` |
| Auth | **Firebase Auth** — email/password; admin via a custom claim `admin: true` |
| Hosting | **Vercel** (auto-deploy on merge to `main`); domain `tresorcouture.in` |
| Email | **Brevo** (transactional order confirmation + marketing campaigns) |
| Payments | **Razorpay** — integrated but dormant (COD-only until keys are set) |
| Monitoring | **Sentry** (`@sentry/react`, `@sentry/node`), Vercel Analytics + Speed Insights |
| Testing | **Playwright** (E2E, incl. Firebase Emulator suites), **Postman/newman** (API + security) |

## The security model — read this first

This is the single most important architectural fact about the project:

> **The browser talks to Firestore directly. `firestore.rules` IS the security
> boundary — not application code.**

There is no Cloud Functions layer and no general-purpose API server. Any change
to who-can-read-what is a change to `firestore.rules`, and must be deployed to
Firebase separately from the Vercel app deploy.

Serverless functions in `/api` exist only for operations that **cannot** be
trusted to the client:

| Endpoint | Why it must be server-side |
|---|---|
| `POST /api/orders/place` | Recomputes price from authoritative product data and decrements stock. Clients may not create orders. |
| `POST /api/payments/*` | Razorpay secret + signature verification. |
| `POST /api/email/*` | Brevo API key; recipient forced to the authenticated user's own verified email. |
| `POST /api/contact` | Brevo list write + captcha verification. |
| `POST /api/whatsapp/notify` | Meta credentials. |
| `GET /api/csrf` | Issues the double-submit CSRF token. |
| `GET /api/health` | Readiness probe. |

### Defence-in-depth on every state-changing endpoint

Applied in this order, and new endpoints must follow it:

1. **CORS** origin allowlist (`api/_lib/cors.ts`)
2. **CSRF** double-submit cookie vs `X-CSRF-Token` header (`api/_lib/csrf.ts`)
3. **Method** check
4. **Rate limit** (`api/_lib/rateLimit.ts`)
5. **Firebase ID token** verification (`api/_lib/auth.ts`)
6. Handler logic

### One Admin app, one initialisation path

`api/_lib/firebaseAdmin.ts` owns the credentialed `firebase-admin` app.
`api/_lib/auth.ts` verifies tokens **through `getAdminApp()`**, never by calling
`initializeApp` itself. This is load-bearing: both modules lazily initialise and
reuse `getApps()[0]`, so whichever ran first won. A keyless app created by the
auth path used to poison Firestore access for the whole request (symptom:
`Could not load the default credentials`). Do not reintroduce a second
`initializeApp`.

## Data access conventions

- **No composite indexes.** The service account available to this project cannot
  create Firestore indexes, so every query is either single-field or filtered on
  one field and sorted client-side. `chatApi.subscribeMine()` is the canonical
  example: `where('userId','==',uid)` with no `orderBy`, sorted in JS. **Adding an
  `orderBy` alongside a `where` will break production.**
- Real-time UI uses `onSnapshot`. Message windows use `limitToLast(n)` — a plain
  ascending `limit` pins to the *oldest* n and silently hides new messages.
- Timestamps written by clients that rules depend on (e.g. `deliveredAt` for the
  return window) must be `serverTimestamp()`.

## Dependency pins that exist for a reason

| Override | Reason |
|---|---|
| `jose: ^5.10.0` | `firebase-admin@14 → jwks-rsa@4 → jose@^6`, but jose v6 is ESM-only while jwks-rsa still `require()`s it. On Vercel this throws `ERR_REQUIRE_ESM` at module load and **every authenticated API call 500s**. v5 ships a dual CJS/ESM build. |
| `uuid`, `axios`, `websocket-driver` | npm audit remediation. |

**Do not** override `brace-expansion` to v5 to clear the remaining audit
advisories — it breaks `minimatch` at runtime (`brace_expansion_1.default is not
a function`) while the build still passes. See PR #23.

## Folder structure

```
api/                 Vercel serverless functions
  _lib/              cors, csrf, rateLimit, auth, firebaseAdmin, http, sentry
  orders/ payments/ email/ whatsapp/
src/
  components/        shared UI (FabricImage, BottomNav, OrderChatModal, ReturnModal…)
  context/           React contexts: Router, Auth, Cart, Wishlist, Orders
  hooks/             useBodyScrollLock, …
  lib/               firebase.ts (SDK + all data APIs), support.ts (returns/chat/CRM),
                     business.ts (legal profile + GST), payments.ts, notify.ts, csrf.ts
  pages/             route-level screens; pages/admin/* for the console
  data/ content/     static catalogue + copy
scripts/             seeders, admin claim setter, emulator seeds
tests/
  e2e/               Playwright against a deployed URL
  emulator/          Playwright against Firebase Emulator Suite (real rules)
postman/             API + security collection for newman
docs/                operational docs; docs/project/* = these six documents
firestore.rules      THE security boundary
```

## Conventions

- ESM throughout (`"type": "module"`). Relative imports inside `api/` **must**
  carry the `.js` extension or Node ESM fails at cold start.
- `api/email/bulk.ts` is deliberately self-contained (inlined helpers) — do not
  "tidy" it into shared relative imports.
- Tailwind v4 arbitrary values are used freely, including safe-area insets:
  `bottom-[calc(env(safe-area-inset-bottom)+82px)]`.
- Money is stored and computed in whole rupees; `formatINR` renders it.

## Environment variables

**Client (`VITE_*`, baked in at build time — changing them requires a redeploy):**

`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
`VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`,
`VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MEASUREMENT_ID`, `VITE_PUBLIC_APP_URL`,
`VITE_LEGAL_NAME`, `VITE_GSTIN`, `VITE_PAN`, `VITE_RAZORPAY_KEY_ID`,
`VITE_HCAPTCHA_SITE_KEY`, `VITE_USE_EMULATORS` *(test only — never set in prod)*

**Server (never exposed to the client):**

`FIREBASE_SERVICE_ACCOUNT` (full JSON — **required** for order placement),
`FIREBASE_PROJECT_ID`, `ALLOWED_ORIGIN`, `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`,
`BREVO_SENDER_NAME`, `BREVO_LIST_ID`, `BREVO_WELCOME_TEMPLATE_ID`,
`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`,
`HCAPTCHA_SECRET`, `SENTRY_DSN`, `UPSTASH_REDIS_REST_URL`,
`UPSTASH_REDIS_REST_TOKEN` *(optional)*

## Constraints

- **Free-tier Firebase.** No Cloud Functions, no scheduled jobs, no composite indexes.
- **Mobile-first.** The admin console must be operable on a phone, not only desktop.
- **No external service is required to run.** Upstash is optional — the rate
  limiter falls back to an in-memory limiter so the app needs nothing beyond
  Firebase and Vercel.
- Secrets are never committed. Legal registrations live in env vars because the
  repository is public.
