# E2E tests (Playwright)

End-to-end suite for the Tresor Couture storefront + serverless API.
Non-destructive: it browses, asserts the API contract, and submits clearly
tagged `e2e+…@example.com` capture emails. **It never completes a real payment.**

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
