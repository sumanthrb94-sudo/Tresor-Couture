# Payments Setup — Razorpay (Tresor Couture)

**Owner:** CEO + Finance (account/KYC), Eng (wiring). **Status today:** checkout is a 2.5-second fake spinner (`src/components/PaymentModal.tsx`) — **no real money moves**. This is the hard launch blocker (report §4).

> **Start the account + KYC TODAY** — activation is an external review queue that takes **2–7 business days** and cannot be rushed.

---

## 0. Why Razorpay

Best India fit: UPI + cards + netbanking + wallets + COD, strong INR support, simple webhooks. Cashfree / PayU are valid alternatives — if you switch, the env-var *roles* below stay the same; only dashboard locations change.

The app totals are computed in the browser today, so payments **must** add a tiny server layer that (a) creates the order with the **authoritative amount** server-side, and (b) verifies the gateway signature before marking an order paid. Engineering owns that code; you own the account and keys.

---

## 1. Create + activate the account (CEO + Finance)

1. Sign up: https://dashboard.razorpay.com/signup
2. Complete **KYC / Activation** — have ready:
   - Business **PAN**
   - **GSTIN**
   - Registered **bank account** (for settlements)
   - Address / business proof
3. Submit. **Activation: 2–7 business days.** You can fetch **TEST mode** keys immediately and start integration before activation.

> Razorpay will **not** fully activate until your **policy pages are live** (Privacy, Terms, Refund/Cancellation, Shipping, Contact) — see `MANUAL-ACTIONS.md` item 5. Publish those in parallel.

---

## 2. Get the API keys

Razorpay Dashboard → **Settings → API Keys → Generate Key**.

| You get | Hand to Eng as | Notes |
|---|---|---|
| Key Id (`rzp_test_…` / `rzp_live_…`) | `RAZORPAY_KEY_ID` (server) **and** `VITE_RAZORPAY_KEY_ID` (browser) | The Key Id is safe to expose in the browser; the Key **Secret** is not. |
| Key Secret | `RAZORPAY_KEY_SECRET` (server only) | **Never** put this in a `VITE_` var or commit it. |

Use **TEST** keys for staging, swap to **LIVE** keys only after activation and end-to-end testing.

---

## 3. Configure the webhook (after Eng gives you the URL)

Razorpay Dashboard → **Settings → Webhooks → Add New Webhook**.

1. **URL:** the serverless endpoint Eng provides (e.g. `https://<your-domain>/api/razorpay/webhook` on Vercel, or a Cloud Function URL).
2. **Secret:** set a strong secret → hand it back as `RAZORPAY_WEBHOOK_SECRET`.
3. **Active events:** `payment.captured`, `payment.failed`, `order.paid` (Eng will confirm the exact set).
4. Save, then use Razorpay's "send test webhook" to confirm the endpoint returns 200.

---

## 4. Serverless backend (Eng owns — you just need to know it exists)

The two things that **must** be server-side (the app has no backend today):
- **Create order with authoritative amount** — recompute totals on the server from product prices, never trust the browser.
- **Verify signature / webhook** — only mark an order `paid` after Razorpay's signature checks out, then atomically **decrement stock** (fixes the overselling blocker, report §6).

Hosting options (any one): a **Vercel serverless function** (you already deploy on Vercel), **Firebase Cloud Functions** (needs Blaze — which you're enabling anyway), or **Supabase Edge Functions**. This is Eng's call.

---

## 5. COD

COD is partly coded already — a **₹50 handling surcharge** (`COD_SURCHARGE` in `PaymentModal.tsx`). Decide: gate COD by **order value cap** and **serviceable pincode** only. High-value couture on COD is a fraud/return risk — consider disabling COD above a threshold.

---

## 6. Settlements & reconciliation

- Confirm settlement bank account + cycle (T+2 typical).
- Decide refund policy SLA (the order-status emails already promise "refund within 3–5 working days" — make sure ops can meet that).

---

## Handback checklist

- [ ] `RAZORPAY_KEY_ID` (server)
- [ ] `RAZORPAY_KEY_SECRET` (server, secret)
- [ ] `VITE_RAZORPAY_KEY_ID` (browser)
- [ ] `RAZORPAY_WEBHOOK_SECRET` (server, secret)
- [ ] Confirmed: policy pages live (gates activation)
- [ ] Confirmed: LIVE keys swapped in only after end-to-end test in TEST mode
