<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Tresor Couture

Storefront and back office for a Hyderabad atelier selling hand-woven Indian
designer textiles — fabrics, laces, sarees, lehenga cholis, anarkalis and
western wear — shipped across India.

**Live:** [tresorcouture.in](https://tresorcouture.in)

Beyond the catalogue and checkout, it runs the parts of the business that
usually live in a WhatsApp thread: **returns & refunds**, **per-order live
chat**, and a **CRM**, all in an admin console that works on a phone.

---

## 📚 Start here

**[`docs/project/`](./docs/project/README.md)** — the six source-of-truth
documents: [PRD](./docs/project/01-PRD.md) ·
[TRD](./docs/project/02-TRD.md) ·
[App Flow](./docs/project/03-APP-FLOW.md) ·
[UI/UX Brief](./docs/project/04-UI-UX-BRIEF.md) ·
[Backend Schema](./docs/project/05-BACKEND-SCHEMA.md) ·
[Implementation Plan](./docs/project/06-IMPLEMENTATION-PLAN.md)

> **Working on this repo with an AI agent?** Paste the **TRD** and **Backend
> Schema** into the session first. They list the constraints that break
> production when violated — most of them are invisible from any single file.

## Stack

| | |
|---|---|
| Frontend | React 19 · TypeScript · Vite 6 · Tailwind v4 · custom hash router |
| Data | Firebase Firestore, written **directly from the browser** |
| Security | `firestore.rules` — this *is* the authorization layer |
| Compute | Vercel serverless functions in `/api` (firebase-admin) |
| Auth | Firebase Auth (email/password); admin via a custom claim |
| Email | Brevo · **Payments** Razorpay (integrated, dormant — COD only) |
| Monitoring | Sentry · Vercel Analytics & Speed Insights |

## Run locally

**Prerequisites:** Node.js 22.x. (Java 11+ only if you want to run the emulator
test suites.)

```bash
npm install
cp .env.example .env.local     # fill in the VITE_FIREBASE_* values at minimum
npm run dev                    # http://127.0.0.1:3000
```

`.env.local` is gitignored. `VITE_*` variables are **baked in at build time** —
changing one means restarting `dev` locally, or redeploying on Vercel.

Running `npm run dev` alone gives you the full storefront against the real
Firebase project. Order placement additionally needs the `/api` functions, which
run on Vercel — see [`DEPLOY.md`](./DEPLOY.md).

### Useful scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on :3000 |
| `npm run lint` | `tsc --noEmit` — the type check CI relies on |
| `npm run build` / `preview` | Production build / serve it locally |
| `npm run seed` | Seed the catalogue into Firestore (`--force` to wipe first) |
| `npm run set-admin -- <email>` | Grant the `admin: true` custom claim |

## Tests

The meaningful suites run against the **Firebase Emulator Suite**, which loads
the real `firestore.rules` — so a rules regression fails the tests.

```bash
# terminal 1 — Auth :9099, Firestore :8080
npm run emulators

# terminal 2 — seed users, catalogue, coupons and orders
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
GCLOUD_PROJECT=demo-tresor \
  npm run seed:emulator:full

# terminal 2 — build against the emulators, then serve
echo 'VITE_USE_EMULATORS=1' >> .env.local
npm run build && npm run preview -- --port 4173 --host 127.0.0.1

# terminal 3
BASE_URL=http://127.0.0.1:4173 npm run test:emulator
```

| Command | Covers |
|---|---|
| `npm run test:emulator` | Everything below |
| `npm run test:emulator:desktop` | 22-step walkthrough at 1280×900 |
| `npm run test:emulator:mobile` | The same 22 steps at 390×844 |
| `npm run test:chat` | Two-party real-time chat, customer ↔ admin |

Each walkthrough covers storefront → cart → login → orders → per-order chat →
returns → admin dashboard, support, returns queue, orders, CRM → cross-customer
isolation, and writes a numbered screenshot per step to
`tests/emulator/screens*/`.

Also: [`postman/`](./postman) holds an API + security collection for `newman`.

> Remove `VITE_USE_EMULATORS` from `.env.local` before building for production.
> It is inert unless set, and is never set in Vercel.

## Deployment

Vercel auto-deploys on merge to `main`. Firestore rules deploy **separately** —
changing `firestore.rules` and merging does *not* update the live rules.

See [`DEPLOY.md`](./DEPLOY.md), and for go-live:
[`docs/LAUNCH-MANUAL.md`](./docs/LAUNCH-MANUAL.md) ·
[`docs/PRODUCTION-CHECKLIST.md`](./docs/PRODUCTION-CHECKLIST.md) ·
[`docs/INCIDENT-RUNBOOK.md`](./docs/INCIDENT-RUNBOOK.md) ·
[`MANUAL-ACTIONS.md`](./MANUAL-ACTIONS.md)

## Gotchas that cost real time

1. **`firestore.rules` is the security boundary.** The browser writes Firestore
   directly; there is no API server in front of it. Rules deploy separately from
   the app.
2. **No composite indexes are available.** Never pair `orderBy` with `where` —
   filter on one field and sort in JavaScript.
3. **One Admin SDK app.** `api/_lib/auth.ts` must initialise via
   `getAdminApp()`; a second `initializeApp` strips Firestore credentials for the
   whole request.
4. **`jose` is pinned to v5.** v6 is ESM-only while `jwks-rsa` still `require()`s
   it — unpinning makes every authenticated API call 500 on Vercel.
5. **`VITE_*` is build-time.** Setting it in Vercel does nothing until you
   redeploy.

Each is explained in the [TRD](./docs/project/02-TRD.md).

## Project layout

```
api/            Vercel serverless functions (_lib/ = cors, csrf, rate limit, auth, admin)
src/
  components/   shared UI          context/   Router, Auth, Cart, Wishlist, Orders
  pages/        screens; admin/    lib/       firebase.ts, support.ts, business.ts
docs/project/   the six source-of-truth documents
scripts/        seeders, admin claim setter
tests/          e2e/ (deployed) · emulator/ (real rules)
firestore.rules THE security boundary
```
