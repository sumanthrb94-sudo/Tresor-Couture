# E2E tests (Playwright)

End-to-end suite for the Tresor Couture storefront + serverless API.
Non-destructive: it browses, asserts the API contract, and submits clearly
tagged `e2e+…@example.com` capture emails. **It never completes a real payment.**

## CI (GitHub Actions)

- **`.github/workflows/ci.yml`** — runs on every push + PR: `npm ci` → `npm run lint` (tsc) → `npm run build` → a guard that fails the build if a server SDK/secret (`firebase-admin`, `RAZORPAY_KEY_SECRET`, `BREVO_API_KEY`) leaks into `dist/assets/`. This is the green-gate for merging.
- **`.github/workflows/e2e.yml`** — runs this Playwright suite against a live URL. GitHub runners have open network (unlike the dev sandbox), so they can reach `tresorcouture.in`. Triggers: manual (`workflow_dispatch`, optional `base_url` input) and a daily 06:30 UTC production smoke. Set repo variable **`E2E_BASE_URL`** to change the default target. HTML report is uploaded as an artifact.

To run E2E manually: GitHub → Actions → "E2E (Playwright)" → Run workflow → (optionally paste a preview URL).

## One-time setup
```bash
npm install
npx playwright install --with-deps chromium webkit
```

## Run

```bash
# Against production (default)
npm run test:e2e

# Against any environment
BASE_URL=https://<preview>.vercel.app npm run test:e2e
BASE_URL=http://localhost:3000        npm run test:e2e   # with `npm run dev` running

# Just the API contract checks (fast — confirms env vars took effect)
npm run test:e2e:api

# Interactive UI mode / open last HTML report
npm run test:e2e:ui
npm run test:e2e:report
```

## What's covered

| Spec | Checks |
|---|---|
| `smoke.spec.ts` | Home loads, category shows ₹ product cards, **footer newsletter capture** confirms, consent banner appears. Runs on Desktop Chrome + iPhone 13. |
| `api.spec.ts` | `/api/subscribers/sync` + `/api/events/track` (signup, order_placed) return a valid contract and **log whether Brevo is wired**; `/api/payments/create-order` reports configured-vs-demo without charging; event whitelist + email validation. |

The API specs print `✅ wired` vs `ℹ️ not configured` to the console, so a run
doubles as a deployment config check (did `BREVO_API_KEY` / Razorpay env take?).

## Notes
- The app uses **hash routing** (`#/shop`, `#/product/:id`) and is client-rendered;
  specs wait for hydration (network idle + visible elements), not server HTML.
- A restricted-network CI sandbox cannot reach `tresorcouture.in`; run from an
  environment with open egress (your machine, or CI with the domain allowlisted).
- Manual flows that need real auth/admin/payment credentials are listed in
  `docs/SMOKE-TEST.md` §6.
