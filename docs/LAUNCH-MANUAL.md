# Tresor Couture — Production Launch Manual

**Version:** 2026-07-07  
**Purpose:** Step-by-step checklist to take the codebase from "audit-remediated" to a live, money-collecting e-commerce site.  
**Assumption:** You have already deployed the code changes from the remediation batches (admin backdoor removal, Firebase fallback removal, COD stock decrement, CSRF/CORS, rate limiting, hCaptcha, Sentry, `/api/health`).

---

## 1. What the code changes did (quick recap)

| Area | What is now in place |
|---|---|
| **Security** | Hardcoded admin password removed; Firebase config fallbacks removed; CSP enforced; CSRF double-submit cookies on all state-changing APIs; CORS pinned to allowed origins; Firestore rules block client order writes. |
| **Revenue / inventory** | `/api/orders/place` decrements stock inside the order transaction; client-side order fallback removed; Razorpay scaffolding is server-authoritative. |
| **Abuse protection** | Upstash-Redis-backed global rate limiting on contact, order placement, and Razorpay order creation; hCaptcha on newsletter capture. |
| **Observability** | Sentry wired on frontend + critical API routes; `/api/health` endpoint reports service configuration status. |
| **Legal / brand safety** | 40-minute delivery claims removed from customer surfaces; business-identity placeholders clearly marked for replacement. |

---

## 2. Accounts you need to create or have ready

Before you start, make sure you can log into:
1. **Firebase Console** — https://console.firebase.google.com/project/tresor-couture
2. **Vercel Dashboard** — https://vercel.com/dashboard
3. **Razorpay Dashboard** — https://dashboard.razorpay.com (sign up + complete KYC)
4. **Brevo** — https://app.brevo.com (free tier is enough to start)
5. **Upstash** — https://console.upstash.com (optional but recommended)
6. **hCaptcha** — https://dashboard.hcaptcha.com (optional but recommended)
7. **Sentry** — https://sentry.io (optional but recommended)
8. **Uptime monitor** — UptimeRobot (free), Checkly, or Google Cloud Uptime Check

---

## 3. Firebase setup

### 3.1 Create a service account for Vercel

1. Go to **Firebase Console → Project settings → Service accounts**.
2. Click **Generate new private key**.
3. A JSON file downloads. **Keep it secret.**
4. Open the JSON file in a text editor, select all, and copy the entire content.
5. In Vercel:
   - Project → **Settings → Environment Variables**
   - Add `FIREBASE_SERVICE_ACCOUNT`
   - Paste the entire JSON content as the value.
   - Apply to **Production** (and Preview if you want real payment testing there).

> Why: `/api/orders/place`, `/api/payments/create-order`, and `/api/payments/verify` all require real Firestore write credentials. Without this, COD checkout returns `orders_not_configured`.

### 3.2 Deploy updated Firestore rules

The `firestore.rules` file now blocks client SDK order creation. You must redeploy it:

**Option A — GitHub Actions (recommended):**
1. In GitHub repo → **Settings → Secrets and variables → Actions**, add `FIREBASE_TOKEN`.
   - Get the token by running locally: `npx firebase login:ci`
   - Or use a service-account key with `GOOGLE_APPLICATION_CREDENTIALS`.
2. Go to **Actions → Deploy Firestore Rules** → **Run workflow**.

**Option B — CLI:**
```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules --project tresor-couture
```

### 3.3 Add custom domain to Firebase Auth authorized domains

1. In Firebase Console → **Authentication → Settings → Authorized domains**.
2. Add:
   - `tresorcouture.in`
   - `www.tresorcouture.in`
3. If you use Vercel preview URLs, also add `*.vercel.app`.

> If this is missing, Google sign-in and password-reset emails will fail on the custom domain.

---

## 4. Vercel environment variables

Add or verify every variable below in **Vercel → Project → Settings → Environment Variables**. Apply each to the correct environments (Production / Preview / Development).

### 4.1 Public (VITE_*) — exposed to the browser

| Variable | Value to set | Where it comes from |
|---|---|---|
| `VITE_PUBLIC_APP_URL` | `https://tresorcouture.in` | Your custom domain |
| `VITE_FIREBASE_API_KEY` | Your Firebase Web API key | Firebase Console → Project settings → General → Web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | `tresor-couture.firebaseapp.com` | Firebase Console → Project settings → General → Your apps |
| `VITE_FIREBASE_PROJECT_ID` | `tresor-couture` | Firebase project id |
| `VITE_FIREBASE_STORAGE_BUCKET` | `tresor-couture.firebasestorage.app` | Firebase Console |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `102541847727` | Firebase Console |
| `VITE_FIREBASE_APP_ID` | `1:102541847727:web:...` | Firebase Console |
| `VITE_FIREBASE_MEASUREMENT_ID` | `G-...` | Firebase Console (Analytics) |
| `VITE_RAZORPAY_KEY_ID` | `rzp_live_...` | Razorpay Dashboard → Settings → API Keys |
| `VITE_HCAPTCHA_SITE_KEY` | Your hCaptcha site key | hCaptcha Dashboard → Sites |
| `VITE_SENTRY_DSN` | Your Sentry DSN | Sentry → Project → Settings → Client Keys (DSN) |

### 4.2 Server-only (never prefix with VITE_)

| Variable | Value to set | Where it comes from |
|---|---|---|
| `ALLOWED_ORIGIN` | `https://tresorcouture.in,https://www.tresorcouture.in` | Your domains (comma-separated) |
| `FIREBASE_PROJECT_ID` | `tresor-couture` | Firebase project id |
| `FIREBASE_SERVICE_ACCOUNT` | Entire service-account JSON | Section 3.1 |
| `RAZORPAY_KEY_ID` | `rzp_live_...` | Razorpay Dashboard → Settings → API Keys |
| `RAZORPAY_KEY_SECRET` | `rzp_live_...` secret | Razorpay Dashboard → Settings → API Keys |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook secret from Razorpay | Section 6 |
| `BREVO_API_KEY` | `xkeysib-...` | Brevo → Account → SMTP & API → API Keys |
| `BREVO_SENDER_EMAIL` | `orders@tresorcouture.in` | A sender you verify in Brevo |
| `BREVO_SENDER_NAME` | `Tresor Couture` | Display name |
| `BREVO_LIST_ID` | Numeric list id | Brevo → Contacts → Lists |
| `BREVO_WELCOME_TEMPLATE_ID` | Numeric template id (optional) | Brevo → Campaigns → Templates |
| `WHATSAPP_TOKEN` | Meta token (optional) | Meta Business / WhatsApp Cloud API |
| `WHATSAPP_PHONE_ID` | Phone number id (optional) | Meta Business |
| `WHATSAPP_TEMPLATE` | Template name (optional) | Meta Business |
| `WHATSAPP_ADMIN_TO` | Admin phone number (optional) | Your ops number |
| `UPSTASH_REDIS_REST_URL` | `https://...upstash.io` | Upstash Console |
| `UPSTASH_REDIS_REST_TOKEN` | Token | Upstash Console |
| `HCAPTCHA_SECRET` | Your hCaptcha secret key | hCaptcha Dashboard |
| `SENTRY_DSN` | Same as `VITE_SENTRY_DSN` | Sentry project DSN |
| `SENTRY_AUTH_TOKEN` | `sntrys_...` | Sentry → Account → API → Auth Tokens |
| `SENTRY_ORG` | Your Sentry org slug | Sentry URL: `https://sentry.io/organizations/<slug>` |
| `SENTRY_PROJECT` | `tresor-couture` | Sentry project slug |

### 4.3 Vercel custom domain

1. In Vercel → **Project → Settings → Domains**.
2. Add `tresorcouture.in` and `www.tresorcouture.in`.
3. Follow Vercel's DNS instructions (usually A + CNAME records).
4. Wait for SSL to provision (can take minutes to a few hours).

---

## 5. Replace placeholder business identity

Open `src/lib/business.ts` and replace the placeholder values with real registrations:

```typescript
legalName: 'Your Real Legal Entity Name',
gstin:    '36XXXXXXXXX-X-X',   // 15-character GSTIN
pan:      'XXXXX0000X',        // 10-character PAN
addressLines: [
  'Registered Address Line 1',
  'Line 2',
  'Hyderabad, Telangana 500034',
  'India',
],
phone:    '+91 ...',            // Real support number
email:    'concierge@tresorcouture.com',
website:  'https://tresorcouture.in',
```

> These values flow into GST invoices, tax invoices, policy pages, and the footer. Do not launch with placeholders.

---

## 6. Razorpay setup

### 6.1 Activate Razorpay account

1. Sign up at https://razorpay.com.
2. Complete KYC and business verification.
3. Switch to **Live Mode** in the dashboard.

### 6.2 Generate API keys

1. Razorpay Dashboard → **Settings → API Keys**.
2. Generate **Live** key pair.
3. Add to Vercel:
   - `VITE_RAZORPAY_KEY_ID` (public)
   - `RAZORPAY_KEY_ID` (server)
   - `RAZORPAY_KEY_SECRET` (server)

### 6.3 Configure webhook

1. Razorpay Dashboard → **Settings → Webhooks → Add New Webhook**.
2. URL: `https://tresorcouture.in/api/payments/webhook`
3. Secret: generate a strong random string and add it to Vercel as `RAZORPAY_WEBHOOK_SECRET`.
4. Active events: select at least `payment.captured`.
5. Save.

### 6.4 Test before going live

1. Set Razorpay to **Test Mode**.
2. Use Test keys in a staging/preview Vercel deployment.
3. Run an end-to-end purchase with Razorpay test cards:
   - Card: `5267 3181 8797 5449`
   - Expiry: any future date
   - CVV: any 3 digits
   - OTP: `1234`
4. Verify order is created, stock decrements, and payment status is `paid`.
5. Switch to Live keys only after test flow is solid.

---

## 7. Brevo email setup

1. Sign up at https://brevo.com.
2. **Verify a sender domain or email:**
   - Brevo → Campaigns → Senders & IP → Domains → Add domain
   - Follow DNS verification steps for `tresorcouture.in`.
3. **Create an API key:**
   - Brevo → Account → SMTP & API → API Keys → Create a new API key
   - Add to Vercel as `BREVO_API_KEY`.
4. **Create a contact list:**
   - Brevo → Contacts → Lists → Create list
   - Note the numeric list id and add as `BREVO_LIST_ID`.
5. **Optional welcome template:**
   - Brevo → Campaigns → Templates → Create template
   - Note the numeric template id and add as `BREVO_WELCOME_TEMPLATE_ID`.

---

## 8. Upstash Redis (global rate limiting)

1. Sign up at https://upstash.com.
2. Create a new **Redis** database.
3. Copy the **REST URL** and **REST TOKEN**.
4. Add to Vercel:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

> Without this, rate limiting falls back to per-instance memory and is much weaker under distributed attacks.

---

## 9. hCaptcha setup

1. Sign up at https://hcaptcha.com.
2. Add a new site:
   - Hostnames: `tresorcouture.in`, `www.tresorcouture.in`
   - Note the **Site Key** → add as `VITE_HCAPTCHA_SITE_KEY`.
3. Copy the **Secret Key** → add as `HCAPTCHA_SECRET`.

> Without hCaptcha keys, the widget is hidden and verification is skipped, so the site still works in dev/preview.

---

## 10. Sentry setup

1. Sign up at https://sentry.io.
2. Create a new project → platform **React**.
3. Copy the **DSN** → add to Vercel as both `VITE_SENTRY_DSN` and `SENTRY_DSN`.
4. Create an internal integration or auth token:
   - Sentry → Settings → Account → API → Auth Tokens → Create New Token
   - Scopes: `org:read`, `project:releases`, `project:write`
   - Add as `SENTRY_AUTH_TOKEN`.
5. Note your org slug and project slug → add as `SENTRY_ORG` and `SENTRY_PROJECT`.
6. Redeploy. Source maps will upload automatically during `vite build` when the token is present.

---

## 11. Uptime monitoring

Point an uptime monitor at:

```
https://tresorcouture.in/api/health
```

Expected healthy response (HTTP 200):
```json
{
  "ok": true,
  "checks": [
    { "name": "firebase_admin", "configured": true, "required": true },
    { "name": "razorpay", "configured": true, "required": false },
    ...
  ]
}
```

Alert channels: email, Slack, or PagerDuty.

---

## 12. WhatsApp (optional)

1. Set up a Meta Business account and WhatsApp Business Platform: https://business.facebook.com.
2. Create a WhatsApp Cloud API app and phone number.
3. Get **Permanent Access Token**, **Phone Number ID**, and **Template Name**.
4. Add to Vercel:
   - `WHATSAPP_TOKEN`
   - `WHATSAPP_PHONE_ID`
   - `WHATSAPP_TEMPLATE`
   - `WHATSAPP_ADMIN_TO`

---

## 13. Legal pages

The policy content exists in `src/content/policies.ts` and is rendered by `LegalPage`. Before launch:

1. Review every policy (Privacy, Terms, Refund/Cancellation, Shipping, Cookies, Contact).
2. Have a lawyer review them for Indian D2C and Razorpay requirements.
3. Update `src/lib/business.ts` so legal details are real.
4. Make sure footer links route correctly (they already point to `/#/policy/:id`).

---

## 14. Pre-launch smoke test

After all env vars are set and deployed, run through this manually:

1. Home page loads; no console errors.
2. Browse category → product → add to cart.
3. Checkout:
   - Signed-in user path works.
   - COD order places successfully.
   - Product stock decrements in Firestore.
4. Razorpay test card payment works (in Test mode).
5. Order confirmation email arrives.
6. Admin panel loads; admin can change order status.
7. `/api/health` returns `ok: true`.
8. Newsletter subscription works and hCaptcha challenges appear.
9. Uptime monitor reports green.

---

## 15. Post-launch operational cadence

| Frequency | Action |
|---|---|
| Daily | Check Sentry for new errors; check uptime monitor. |
| Weekly | Review Razorpay settlements vs Firestore orders. |
| Weekly | Check hCaptcha / Upstash logs for abuse spikes. |
| Monthly | Patch npm dependencies (`npm audit fix`). |
| Quarterly | Review Firestore rules, env vars, and access. |

---

## 16. Quick command reference

```bash
# Deploy Firestore rules
firebase deploy --only firestore:rules --project tresor-couture

# Seed products (requires gcloud auth or GOOGLE_APPLICATION_CREDENTIALS)
ADMIN_SEED_EMAIL=you@tresorcouture.in ADMIN_SEED_PASSWORD='strong-password' npm run seed

# Promote an admin user
npm run set-admin -- you@tresorcouture.in

# Local dev
npm run dev
```

---

**End of manual.**
