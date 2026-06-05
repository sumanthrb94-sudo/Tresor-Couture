# Production Go-Live Checklist (Tresor Couture)

Final gate before flipping the switch. Each box should be ticked by the named owner. Pairs with `MANUAL-ACTIONS.md` (the prioritised runbook) and the per-domain docs.

---

## Infrastructure & scale
- [ ] **Firebase Blaze plan** enabled (Spark's 50k-reads/day cap *will* break at 1–2k visitors/day — `DEPLOY.md` §10). (CEO+Eng)
- [ ] **Billing budget + alert** set on Firebase / Google Cloud so cost can't run away. (CEO)
- [ ] Firestore created in `asia-south1`, rules + indexes deployed. (Eng)
- [ ] Catalog seeded (`npm run seed`) — Firestore is empty until then (Appendix B). (Eng)

## Payments (hard blocker)
- [ ] Razorpay **activated** (KYC cleared). (CEO)
- [ ] `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `VITE_RAZORPAY_KEY_ID` set; **LIVE** keys (not test). (Eng)
- [ ] Webhook configured + `RAZORPAY_WEBHOOK_SECRET` set; test webhook returns 200. (Eng)
- [ ] Server-side **authoritative totals** + **signature verification** in place (fixes client-side-totals security hole, report §10). (Eng)
- [ ] **Stock decrement on paid order** working (fixes overselling, report §6). (Eng)
- [ ] COD gated by value cap + serviceable pincode. (Eng)

## Security
- [ ] Admin access is the `admin` custom claim only — the client-side passcode gate was removed (commit `c01200f`); admin UI + Firestore rules now key off the claim. (Eng)
- [ ] Admin custom claim bootstrapped on the founder account (`DEPLOY.md` §4). (Eng)
- [ ] `ALLOWED_ORIGINS` set to the production origin(s) so API CORS isn't wildcard. (Eng)
- [ ] `FIREBASE_SERVICE_ACCOUNT` stored as a secret, never committed. (Eng)
- [ ] Firestore rules reviewed; default-deny confirmed. (Eng)

## Email
- [ ] Sending domain verified (SPF/DKIM). (CEO)
- [ ] Trigger Email extension installed; `mail/` smoke test delivered. (CEO+Eng)
- [ ] Auth templates branded + action URL set. (CEO)
- [ ] `BREVO_API_KEY` set (marketing contact sync via `/api/subscribers/sync`); Welcome/abandoned-cart/launch campaigns built in Brevo. (CEO)

## WhatsApp
- [ ] Number verified; transactional templates approved. (CEO+Ops)
- [ ] BSP credentials handed to Eng; opt-in capture live. (Eng)

## Analytics & consent
- [ ] `VITE_GA4_MEASUREMENT_ID` + `VITE_META_PIXEL_ID` set and firing. (Eng)
- [ ] Pixel linked to ad account. (CEO)
- [ ] Consent banner gates non-essential trackers. (Eng)

## Domain, DNS, SSL, OAuth
- [ ] Custom domain added in Vercel; SSL issued. (CEO+Eng)
- [ ] `VITE_PUBLIC_URL` + `VITE_FIREBASE_AUTH_DOMAIN` updated. (Eng)
- [ ] Domain added to **Firebase → Authentication → Authorized domains** (else OAuth + password reset break). (Eng)
- [ ] Google sign-in, phone OTP, and password reset tested on the live domain. (Eng)

## Catalog & content
- [ ] Real product photos in place; per-unit vs per-meter resolved per SKU (report §5). (CEO+Eng)
- [ ] Empty "Lace" category filled or hidden (dead nav link otherwise). (Eng)
- [ ] True stock counts set on limited/hero pieces. (CEO+Eng)

## Legal / compliance (India D2C)
- [ ] Privacy Policy, Terms, Returns/Refund/Cancellation, Shipping, Contact pages **published** and linked from the footer (links go nowhere today). (Legal+CEO)
- [ ] GST: GSTIN on invoices; 5% GST already computed in code. (Finance)
- [ ] Razorpay merchant profile points at the live policy pages. (CEO)

## Delivery (only if advertising fast delivery)
- [ ] 40-minute claim **softened/removed** unless `docs/DELIVERY-OPS.md` is fully live. (CEO)

---

## End-to-end test flows (Playwright / E2E)

Run against a **staging deployment** with **Razorpay in TEST mode**. Env needed: staging Vercel URL, `VITE_RAZORPAY_KEY_ID` (test), test admin account with the `admin` claim, a seeded catalog.

| Flow | Steps | Expected |
|---|---|---|
| **Browse → buy (demo path)** | home → category → product → add to cart → checkout | order persists in Firestore |
| **Real payment** | checkout → Razorpay TEST card / UPI → return | order marked paid only after webhook/signature verify; stock decremented |
| **Totals integrity** | attempt a tampered amount | server rejects / recomputes — never charges the browser value |
| **Lead capture** | submit newsletter + WhatsApp opt-in | doc lands in `subscribers` with `consent` |
| **Auth** | register, Google sign-in, phone OTP, password reset | all succeed on the live/staging domain |
| **Admin** | sign in with an account carrying the `admin` claim → mark order processing/shipped/delivered | status changes + customer email fires (check `mail/`) |
| **Serviceability** | enter out-of-zone pincode (once §delivery wired) | blocked / standard-shipping fallback |

> Note: the app uses **hash routing** and is client-rendered — Playwright selectors should wait for client hydration; deep links use `/#/...` fragments (Appendix B).
