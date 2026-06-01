# Production Smoke Test — tresorcouture.in

Run these from **your own machine** (the CI/cloud sandbox can't reach the site —
restricted network allowlist). They are non-destructive: no real order, no real
charge. They verify the deploy is live and — critically — whether the **Brevo
env vars actually took effect** in the deployed serverless functions.

> Replace `tresorcouture.in` if you test a preview/staging URL instead.

---

## 1. Site is live

```bash
curl -s -o /dev/null -w "home: HTTP %{http_code}\n" https://tresorcouture.in/
curl -s -o /dev/null -w "robots: HTTP %{http_code}\n" https://tresorcouture.in/robots.txt
```
Expect `HTTP 200` for both.

---

## 2. Brevo contact sync — DID THE API KEY TAKE? (the important one)

```bash
curl -s -X POST https://tresorcouture.in/api/subscribers/sync \
  -H 'content-type: application/json' \
  -d '{"email":"smoke+sync@yourdomain.com","source":"smoke-test"}'
```

| Response | Meaning |
|---|---|
| `{"synced":true}` | ✅ Key is live; the contact now exists in Brevo. **Check Brevo → Contacts** for `smoke+sync@yourdomain.com`. |
| `{"synced":false,"reason":"brevo_not_configured"}` | ❌ `BREVO_API_KEY` is NOT reaching the function. Fix: set it for the **Production** env in Vercel **and redeploy** (env vars only apply to a fresh build). |
| `{"synced":false}` (no reason) | Key present but Brevo rejected it — wrong/expired key, or key lacks contacts permission. |
| `HTTP 404` | The `/api` functions didn't deploy — check Vercel build output / `vercel.json`. |

---

## 3. Brevo automation event — signup trigger

```bash
curl -s -X POST https://tresorcouture.in/api/events/track \
  -H 'content-type: application/json' \
  -d '{"event":"signup","email":"smoke+signup@yourdomain.com","properties":{"FIRSTNAME":"Smoke"}}'
```

| Response | Meaning |
|---|---|
| `{"tracked":true}` | ✅ Event fired. If your **Brevo "signup" automation** is live, it should now trigger for this contact. |
| `{"tracked":false,"reason":"brevo_not_configured"}` | ❌ Key not reaching the function (same fix as #2). |
| `{"error":"unknown_event"}` | The event kind isn't whitelisted — should only happen if `event` isn't `signup`/`order_placed`. |

> If `tracked:true` but your automation doesn't run, the **event NAME doesn't match
> your automation's trigger.** Either set `BREVO_EVENT_SIGNUP` in Vercel to the name
> your automation listens for, or point the automation at `signup`.

---

## 4. order_placed event (what a paid/COD order fires)

```bash
curl -s -X POST https://tresorcouture.in/api/events/track \
  -H 'content-type: application/json' \
  -d '{"event":"order_placed","email":"smoke+order@yourdomain.com","eventData":{"order_id":"SMOKE-1","total":4500,"currency":"INR","item_count":1,"payment_status":"paid"}}'
```
Expect `{"tracked":true}`. Confirms the order-confirmation automation trigger works
end-to-end without placing a real order.

---

## 5. Payments configured? (read-only)

```bash
curl -s -X POST https://tresorcouture.in/api/payments/create-order \
  -H 'content-type: application/json' \
  -d '{"items":[{"fabricId":"__nonexistent__","meters":1}]}' | head -c 400; echo
```

| Response | Meaning |
|---|---|
| `503 {"error":"payments_not_configured"}` | Razorpay keys / Firebase service account not set yet → checkout runs in **demo mode**. |
| `400`/`409` about the product/amount | ✅ Razorpay + Admin SDK ARE wired (it got far enough to price the cart). |

---

## 6. Browser flows (manual, ~10 min — or Playwright once connected)

On `https://tresorcouture.in`:
1. **Browse:** home → a category → a product. Images load, price shows `₹X` (per-unit garments) vs `₹X/m` (fabric).
2. **Cart math:** add 2 qty of a per-unit item + a per-meter length → subtotal/GST/shipping correct; free shipping over ₹1,999.
3. **Newsletter:** submit the footer form → success message. Then check Brevo Contacts + the Firestore `subscribers` collection for the row.
4. **Consent banner:** appears; after Accept, GA4 Realtime + Meta Pixel Helper show `page_view`/`PageView` (only if `VITE_GA4_MEASUREMENT_ID`/`VITE_META_PIXEL_ID` are set).
5. **Checkout (demo or Razorpay TEST keys):** complete an order → confirmation page → the `order_placed` Brevo automation sends the email (and, if the `mail/` extension is also on, watch for a DUPLICATE — see double-send note).
6. **Admin:** footer → Atelier Admin → passcode (NOT the default `tresor-atelier`) → change an order status.
7. **Auth:** register a new account → your Brevo `signup` automation fires the welcome.

---

## Known constraints
- App uses **hash routing** + is client-rendered: Playwright selectors must wait for hydration; deep links use `/#/...`.
- The 40-minute delivery promise is **copy only** — no serviceability/dispatch system yet (do not advertise as a guarantee).
