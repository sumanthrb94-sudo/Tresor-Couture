# Going live with Cashfree

The code is in. What remains is configuration, and it is all done in the Vercel
and Cashfree dashboards — **not in this repository**. Nothing below should ever
be pasted into a file, a commit, a chat window or a screenshot.

Cashfree is the only payment gateway. Razorpay has been removed entirely —
code, dependency, environment variables and CSP entries.

Without the Cashfree variables the storefront runs in demo mode: Cash on
Delivery still works and Card/UPI show as "Coming soon" rather than failing at
the gateway. So going live is setting variables, and the fallback is COD — not
another gateway.

---

## 1. Where the keys come from

Cashfree Dashboard → **Developers** (top right) → **API Keys**, under Payment
Gateway. Two values: **App ID** (sent as `x-client-id`) and **Secret Key**
(`x-client-secret`).

**Sandbox and production are different key pairs.** Sandbox keys are generated
for you automatically. Production keys need a click on *Generate API Keys* plus
an OTP, and only appear once the Payment Gateway is activated. To read either
back later: the ellipsis next to the key → *View API Key*, OTP again in
production.

Cashfree does not store your secret in a recoverable form — if it is lost the
only option is to regenerate, which invalidates the old one. So copy it straight
into Vercel rather than into a note, a chat, or a screenshot.

The IP allowlist some Cashfree guides mention is a **Payouts** feature, under
Payouts → Two-Factor Authentication. It does not apply to the Payment Gateway
APIs this integration uses, which is fortunate: Vercel functions egress from a
rotating IP range with no fixed address to allowlist. If Payouts is ever turned
on for automated refunds, that becomes a real constraint and needs Vercel's
Static IPs (a paid plan feature).

---

## 2. Variables to set in Vercel

Project → Settings → Environment Variables. Set all four for **Production**
(and, if you want a test run first, the sandbox pair for Preview).

| Variable | Value | Scope | Status |
|---|---|---|---|
| `CASHFREE_APP_ID` | Your Cashfree **App ID** | Server only | **You must add** |
| `CASHFREE_SECRET_KEY` | Your Cashfree **Secret Key** | Server only | **You must add** |
| `CASHFREE_ENV` | `production` | Server only | ✅ already set (Production target only, so Preview stays sandbox) |
| `VITE_CASHFREE_MODE` | `production` | Public (browser) | Add LAST — see below |

`VITE_CASHFREE_MODE` is the switch that puts Card and UPI in front of customers.
Add it only once the App ID and Secret Key are in, or shoppers will be offered
Card, pick it, and be told online payment is unavailable. Nothing breaks and no
money moves — the checkout says "please choose Cash on Delivery" rather than
faking a success — but it is a bad first impression for no reason.

`VITE_` variables are compiled into the JavaScript every visitor downloads.
`VITE_CASHFREE_MODE` is safe there because it is the single word `production` —
it tells the browser SDK which Cashfree to talk to and nothing else. **The App
ID and Secret Key must never be given a `VITE_` name.** There is no public
Cashfree key in this integration: the browser only ever receives a single-use
`payment_session_id` minted by our server for an amount Cashfree already holds.

### One variable to never set here

`CASHFREE_API_BASE` exists so the test suite can point the sandbox at a local
stand-in Cashfree. **Do not add it to Vercel.** It has no legitimate use in a
deployment, and it redirects where the server looks to find out whether money
moved.

It is already harmless on production — the code checks it only on the sandbox
branch, so a live deploy talks to `api.cashfree.com` regardless, and there is a
test holding that guard in place. But a variable that looks like configuration
invites someone to "fix" the guard later. It belongs in a test run and nowhere
else.

### The live switch fails closed

`CASHFREE_ENV` must be exactly `production` to reach real cards. Anything else —
unset, blank, `prod`, `true`, `Production ` with a trailing space — stays on
sandbox. A typo cannot quietly start charging people; it can only fail to go
live, which you will notice immediately.

---

## 3. The webhook

Cashfree Dashboard → Developers → Webhooks → add an endpoint:

```
https://tresorcouture.in/api/payments/webhook
```

Subscribe to **PAYMENT_SUCCESS_WEBHOOK** at minimum.

No extra secret is needed. Cashfree signs webhooks with the same Secret Key from
step 2, as `base64(HMAC-SHA256(timestamp + rawBody))`, and the route already
reads the raw body so the digest matches.

The webhook is a safety net, not the main path. A normal order is confirmed by
the browser returning from the modal and the server then asking Cashfree what
happened. The webhook catches the case where the shopper closes the tab mid
payment — the money arrives, and the order is reconciled without them.

---

## 3a. Check the keys before a customer does

The likely failure at go-live is sandbox keys with `CASHFREE_ENV=production`.
Both halves look right in the Vercel dashboard — the variables are set, the
word says production — and nothing complains until someone tries to pay.

```bash
CASHFREE_APP_ID=... CASHFREE_SECRET_KEY=... CASHFREE_ENV=production \
  node scripts/check-cashfree.mjs
```

It asks Cashfree for an order id that cannot exist. Being told *no such order*
proves the credentials were accepted; a 401 or 403 with a JSON body proves they
were not. Nothing is created and nothing is charged, and the keys are never
printed or written anywhere — pass them on the command line, not in a file.

Run it from a machine with direct internet access. Behind a proxy the script
says so and exits rather than blaming your keys for a blocked connection.

---

## 4. Test on sandbox first

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

## 5. Go live

The integration is already on `main` and deployed — the store is live and
taking Cash on Delivery today. What is missing is only the two secrets, so the
order is:

1. Add `CASHFREE_APP_ID` and `CASHFREE_SECRET_KEY` in Vercel.
2. Add `VITE_CASHFREE_MODE` = `production`.
3. Redeploy.

`VITE_CASHFREE_MODE` is baked in at build time, so the redeploy in step 3 is
what actually puts Card and UPI in front of customers — adding the variable
alone changes nothing until a new build runs. The server variables are read per
request, so they only need to exist by the time the first customer pays.

Then buy something small on the live site with a real card and refund yourself.
It is the only test that proves the whole chain.

---

## If something goes wrong

There is no second gateway to fall back to. Unset `CASHFREE_APP_ID` and
`CASHFREE_SECRET_KEY` and redeploy, and the store reverts to **Cash on Delivery
only** — Card and UPI go back to "Coming soon". Orders keep coming in; they just
are not prepaid.

That is the honest trade for running one gateway, and it is worth knowing before
you need it rather than during.

---

## What is still outstanding

**The Razorpay key secret exposed in a screenshot earlier is still live on the
Razorpay account.** Deleting the integration from this codebase does not revoke
it — the key belongs to the account, not to the code, and anyone holding it can
still call the Razorpay API against that merchant.

Go into the Razorpay dashboard and either regenerate the key or close the
account. **That is the whole remediation, and nothing in this repository can do
it for you.** All four surfaces on our side were checked and are clean: no
source file, no dependency in `package.json` or the lockfile, no `razorpay`
entry in the `vercel.json` CSP, and no `RAZORPAY_*` variable in the Vercel
project. The storefront has been running Cash-on-Delivery-only all along.

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

Step 3 is the security boundary. Cashfree has no client-side success token, so
rather than trusting anything the page reports, the server asks the payment
processor directly. That is a stronger guarantee than a signature handshake, not
a weaker one — there is no callback to forge in the first place.
