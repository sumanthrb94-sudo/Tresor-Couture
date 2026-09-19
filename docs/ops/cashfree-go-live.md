# Going live with Cashfree

The code is in. What remains is configuration, and it is all done in the Vercel
and Cashfree dashboards — **not in this repository**. Nothing below should ever
be pasted into a file, a commit, a chat window or a screenshot.

Cashfree runs alongside Razorpay rather than replacing it: when the Cashfree
variables are present the server uses Cashfree, and when they are absent it
falls back to Razorpay exactly as before. That is deliberate. It means going
live is setting variables, and backing out is unsetting them — no deploy, no
code change, no waiting for a build while checkout is down.

---

## 1. Variables to set in Vercel

Project → Settings → Environment Variables. Set all four for **Production**
(and, if you want a test run first, the sandbox pair for Preview).

| Variable | Value | Scope |
|---|---|---|
| `CASHFREE_APP_ID` | Your Cashfree **App ID** | Server only |
| `CASHFREE_SECRET_KEY` | Your Cashfree **Secret Key** | Server only |
| `CASHFREE_ENV` | `production` | Server only |
| `VITE_CASHFREE_MODE` | `production` | Public (browser) |

`VITE_` variables are compiled into the JavaScript every visitor downloads.
`VITE_CASHFREE_MODE` is safe there because it is the single word `production` —
it tells the browser SDK which Cashfree to talk to and nothing else. **The App
ID and Secret Key must never be given a `VITE_` name.** There is no public
Cashfree key in this integration: the browser only ever receives a single-use
`payment_session_id` minted by our server for an amount Cashfree already holds.

### The live switch fails closed

`CASHFREE_ENV` must be exactly `production` to reach real cards. Anything else —
unset, blank, `prod`, `true`, `Production ` with a trailing space — stays on
sandbox. A typo cannot quietly start charging people; it can only fail to go
live, which you will notice immediately.

---

## 2. The webhook

Cashfree Dashboard → Developers → Webhooks → add an endpoint:

```
https://tresorcouture.in/api/payments/webhook
```

Subscribe to **PAYMENT_SUCCESS_WEBHOOK** at minimum.

No extra secret is needed. Cashfree signs webhooks with the same Secret Key from
step 1, as `base64(HMAC-SHA256(timestamp + rawBody))`, and the route already
reads the raw body so the digest matches.

The webhook is a safety net, not the main path. A normal order is confirmed by
the browser returning from the modal and the server then asking Cashfree what
happened. The webhook catches the case where the shopper closes the tab mid
payment — the money arrives, and the order is reconciled without them.

---

## 3. Test on sandbox first

Set the sandbox pair on a Preview deployment (`CASHFREE_ENV` anything but
`production`), then place a real order through the site with a Cashfree test
card. Check afterwards:

- the order appears in Admin → Orders with `paymentStatus: paid`
- it shows `paymentProvider: cashfree`
- stock went down by the right amount
- the same order does **not** appear twice after the webhook also arrives

That last one is the idempotency check, and it is the one worth actually
looking at.

---

## 4. Go live

Set the four production variables, then **redeploy**. `VITE_CASHFREE_MODE` is
baked in at build time, so changing it does not take effect until a new build.
The three server variables are read per request and would take effect
immediately, but redeploying keeps all four in step.

Then buy something small on the live site with a real card and refund yourself.
It is the only test that proves the whole chain.

---

## Rolling back

Unset `CASHFREE_APP_ID` and `CASHFREE_SECRET_KEY` and redeploy. The server falls
straight back to Razorpay. Keep the Razorpay variables in place until Cashfree
has settled a few days of real orders.

---

## What is still outstanding

**The Razorpay key secret was exposed in a screenshot earlier and has not been
rotated.** Going live on Cashfree does not fix that, because Razorpay stays
configured as the fallback — an exposed secret on a live fallback gateway is
still a live exposure. Either rotate it in the Razorpay dashboard, or remove the
Razorpay variables entirely once Cashfree is proven.

---

## How a payment actually flows

1. `POST /api/payments/create-order` — the server prices the cart from Firestore
   (the browser's total is ignored), creates a Cashfree order for that amount,
   and returns a single-use `payment_session_id`.
2. The browser opens the Cashfree modal with that session id.
3. `POST /api/payments/verify` — the server **asks Cashfree** what became of the
   order and proceeds only on `order_status: PAID` with a matching amount, then
   decrements stock and writes the order in one Firestore transaction.
4. `POST /api/payments/webhook` — Cashfree confirms server-to-server; if step 3
   never ran, this reconciles the order.

Step 3 is the security boundary. Razorpay gives the browser a signature we check
with our secret; Cashfree has no client handshake, so rather than trusting
anything the page reports, the server asks the payment processor directly. That
is a stronger guarantee, not a weaker one — there is no callback to forge.
