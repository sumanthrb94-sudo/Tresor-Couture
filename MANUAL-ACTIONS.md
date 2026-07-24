# Tresor Couture — Manual Actions Runbook (CEO)

**For:** CEO / founder (non-engineer) · **Date:** 2026-05-31 · **Target launch:** ~1 week
**What this is:** the single prioritised checklist of things **a human must do by hand** — open accounts, pass KYC, get keys, verify domains, sign ops contracts, approve templates, publish legal pages. Engineers (other agents) are wiring the *code*; this document is everything the code **cannot** do for itself.

> Read alongside `LAUNCH-READINESS-REPORT.md` (the audit + the phased-launch recommendation). This runbook does not re-argue the verdict; it tells you what to action. Deep step-by-step for each domain lives in the `docs/*.md` files referenced below.

---

## How to use this document

- Items are grouped by **urgency**. Do **P0 — START TODAY** items first; several are gated on external approval/KYC that takes **days**, so the clock starts the moment you apply.
- Each item lists: **what to do**, **where** (dashboard/URL), **what to hand back** to engineering (the exact env-var / secret name), **time** (your effort), **lead-time** (external waiting), and **owner**.
- "Hand back to engineering" = paste the value into the team's secret store / Vercel **Project → Settings → Environment Variables** (and `.env` for local). **Never** commit secrets to git. `VITE_`-prefixed vars are *public* (shipped to the browser); everything else is server-only and must stay secret.

### Legend
| Symbol | Meaning |
|---|---|
| Owner | who does it (CEO, Ops, Finance/Legal, Eng = engineering team) |
| Hand back | the env var / secret name engineering needs |
| Lead-time | external waiting you cannot compress (KYC, DNS, template review) |

---

## P0 — START TODAY (gated on external approval — the clock is running)

These are the long-pole items. Even if you do nothing else today, **submit these applications**, because approval is out of your hands and takes days.

| # | Action | Where | Hand back to Eng | Your time | Lead-time | Owner |
|---|---|---|---|---|---|---|
| 1 | **Razorpay account + KYC.** Sign up, submit business PAN, GST, bank account, address proof. Activation requires this to clear. | https://dashboard.razorpay.com/signup | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `VITE_RAZORPAY_KEY_ID` | 1–2 hrs to submit | **2–7 business days** for KYC/activation | CEO + Finance |
| 2 | **WhatsApp Business Platform** via a BSP (AiSensy / Interakt / Wati / Gupshup) **or** Meta Cloud API direct. Register a business phone number + submit message templates for approval. | See `docs/WHATSAPP-SETUP.md` | BSP API key / phone-number-id + token (names in that doc) | 1–2 hrs | **Number verification 1–3 days + each template 1–2 days** | CEO + Ops |
| 3 | **Transactional email — verify a sending domain** (SPF + DKIM DNS records) on SendGrid/Brevo. DNS propagation is the wait. | SendGrid: https://app.sendgrid.com · Brevo: https://app.brevo.com | `SMTP` connection URI (entered in Firebase, not Vercel) | 45 min | **DNS verify a few hours – 48 hrs** | CEO + Eng |
| 4 | **Brevo — generate API key** (marketing engine; ✅ Brevo already set up). Contact-sync code is built and wired — it just needs the key. | https://app.brevo.com → SMTP & API → API Keys | `BREVO_API_KEY` (+ optional `BREVO_LIST_ID`) | 10 min | none (key is instant) | CEO |
| 5 | **Legal/policy pages live** (Privacy, Terms, Returns/Refund/Cancellation, Shipping, Contact). **Razorpay activation will not complete without these published.** | Your site footer + Razorpay merchant profile | URLs of the 5 published pages | 3–6 hrs (draft + review) | gated by your lawyer's turnaround | CEO + Legal |

> **Why these five first:** #1 and #2 cannot be rushed once submitted — KYC and template review are external review queues. #3/#4 wait on DNS. #5 is a hard gate on #1. Everything else in this runbook can be done in an afternoon once you have the credentials.

---

## P1 — THIS WEEK (required to launch, mostly self-service)

| # | Action | Where | Hand back to Eng | Your time | Lead-time | Owner |
|---|---|---|---|---|---|---|
| 6 | **Upgrade Firebase to the Blaze (pay-as-you-go) plan.** Required for scale beyond the 50k-reads/day Spark cap (you *will* exhaust it at 1–2k visitors/day — see `DEPLOY.md` §10), AND it is the prerequisite for Cloud Functions and the Trigger Email extension. Set a **budget + billing alert** immediately after. | https://console.firebase.google.com/project/tresor-couture → ⚙ → Usage and billing → Modify plan | (none — infra) | 20 min | none | CEO + Eng |
| 7 | **Razorpay webhook configuration** (after KYC clears, #1). Add the webhook URL your engineers give you, subscribe to `payment.captured` / `payment.failed` / `order.paid`, and copy the signing secret. | Razorpay Dashboard → Settings → Webhooks | `RAZORPAY_WEBHOOK_SECRET` | 20 min | after #1 | CEO + Eng |
| 8 | **Firebase service-account JSON** for the serverless payment/verify backend. Download it, hand it to Eng as a secret — **never** commit it. | https://console.firebase.google.com/project/tresor-couture/settings/serviceaccounts/adminsdk → Generate new private key | `FIREBASE_SERVICE_ACCOUNT` (full JSON, base64 or pasted into Vercel secret) | 10 min | none | CEO + Eng |
| 9 | **Install the "Trigger Email from Firestore" extension** + paste SMTP URI (from #3). Smoke-test by adding a `mail/` doc. | https://console.firebase.google.com/project/tresor-couture/extensions | (SMTP entered in console) | 30 min | needs #3 + #6 | CEO + Eng |
| 10 | **Brand the Firebase Auth email templates** (paste the HTML from `branding/email-templates/auth/`, set sender = "Tresor Couture", set the action URL). | https://console.firebase.google.com → Authentication → Templates | (none) | 20 min | none | CEO |
| 11 | **GA4 property** — create, get the Measurement ID. | https://analytics.google.com → Admin → Create property | `VITE_GA4_MEASUREMENT_ID` (`G-XXXXXXXXXX`) | 20 min | none | CEO |
| 12 | **Meta Pixel** — create in Events Manager, link it to your ad account, note the Pixel ID; plan Conversions API token. | https://business.facebook.com/events_manager2 | `VITE_META_PIXEL_ID`, later `META_CAPI_TOKEN` | 30 min | none | CEO |
| 14 | **Bootstrap the admin custom claim** (promote your account to `admin: true`) and **seed the catalog** (`npm run seed`). Engineering runs the commands; you provide your registered account UID. See `DEPLOY.md` §4. | local CLI (Eng) | your account UID | 15 min | none | Eng (CEO provides UID) |
| 15 | **Custom domain + DNS + SSL.** Add the domain in Vercel, set DNS records, then add the domain to **Firebase → Authentication → Settings → Authorized domains** (OAuth/password-reset break otherwise). Update `VITE_PUBLIC_URL` + `VITE_FIREBASE_AUTH_DOMAIN`. | Vercel → Project → Settings → Domains; Firebase Auth settings | `VITE_PUBLIC_URL`, `VITE_FIREBASE_AUTH_DOMAIN` | 45 min | **DNS a few hours – 48 hrs** | CEO + Eng |
| 16 | **Catalog / merchandising:** supply real product photos and **confirm per-unit vs per-meter for each SKU** (stitched garments are sold as one piece, not by the metre — see report §5). Decide hosting: Firestore (`npm run seed`) vs connected Shopify / Meta catalog feed. | your files + Eng | per-SKU unit/price/stock sheet | hours–days (your content) | depends on photo readiness | CEO + Eng |
| 17 | **Decide & fix the "40-minute delivery" claim for launch.** The promise has **zero supporting system** today (report §9). Until a dark store + last-mile contract are live, **do NOT advertise 40-minute delivery** — instruct Eng to soften the banner copy. | `src/constants.ts` `OFFER_TICKER` (Eng edits) | go/no-go decision | 5 min decision | none | CEO |

---

## P2 — OPERATIONS: the 40-minute delivery promise (~80% ops, start in parallel)

This is weeks of work and gated on physical/operational setup, not code. Begin sourcing now if 40-minute delivery is core to the brand promise. Full detail in `docs/DELIVERY-OPS.md`.

| # | Action | Where | Hand back to Eng | Your time | Lead-time | Owner |
|---|---|---|---|---|---|---|
| 18 | **Pick ONE Hyderabad pincode cluster** and define the **serviceable pincode list**. | internal | the pincode list | 1 day | none | Ops |
| 19 | **Secure a dark-store / stocked location** with packing staff and a defined packing SLA (target: pack within ~10 min of order). | physical | (none) | days–weeks | **lease/staffing lead-time** | Ops |
| 20 | **Sign a last-mile partner** (Borzo / Dunzo-for-Business / Porter / Shadowfax / Shiprocket). Get API credentials for dispatch + tracking. | partner dashboards | partner API key/secret (names per partner) | hours to apply | **contract + onboarding days–weeks** | Ops + Eng |
| 21 | **Do not flip on 40-min messaging** until #18–#20 are live and tested end-to-end. | — | (none) | — | — | CEO |

---

## P3 — GROWTH & POLISH (after launch is safe)

| # | Action | Where | Hand back to Eng | Your time | Owner |
|---|---|---|---|---|---|
| 22 | Build Brevo **Welcome**, **abandoned-cart**, and **launch** campaigns. (Contact sync `subscribers` → Brevo is already built + wired via `api/subscribers/sync.ts` — just set `BREVO_API_KEY`.) | Brevo | (uses `BREVO_API_KEY`) | hours | CEO |
| 23 | Meta **Conversions API** server-side events (improves attribution as iOS blocks the pixel). | Events Manager | `META_CAPI_TOKEN` | hours | CEO + Eng |
| 24 | Meta **product catalog feed** for dynamic retargeting / Advantage+ shopping ads. | Commerce Manager | catalog ID | hours | CEO + Eng |
| 25 | **GST invoicing** on orders (5% GST is already computed in code; you need GSTIN on invoices + a compliant invoice template). | Finance | GSTIN | hours | Finance |

---

## Environment variable / secret summary (what to hand engineering)

| Var / secret | Public? | Source | Item |
|---|---|---|---|
| `RAZORPAY_KEY_ID` | secret (server) | Razorpay Dashboard → API Keys | 1 |
| `RAZORPAY_KEY_SECRET` | secret (server) | Razorpay Dashboard → API Keys | 1 |
| `RAZORPAY_WEBHOOK_SECRET` | secret (server) | Razorpay → Settings → Webhooks | 7 |
| `VITE_RAZORPAY_KEY_ID` | **public** | same as Key ID (browser checkout needs it) | 1 |
| `FIREBASE_SERVICE_ACCOUNT` | secret (server) | Firebase → Service accounts → generate key | 8 |
| `SMTP` connection URI | secret (in Firebase) | SendGrid/Brevo | 3, 9 |
| `BREVO_API_KEY` | secret (server) | Brevo → SMTP & API → API Keys | 4 |
| `BREVO_LIST_ID` | server (optional) | Brevo → Contacts → Lists | 4 |
| WhatsApp BSP token / phone-number-id | secret (server) | your BSP / Meta | 2 |
| `META_CAPI_TOKEN` | secret (server) | Meta Events Manager | 23 |
| `VITE_GA4_MEASUREMENT_ID` | **public** | Google Analytics | 11 |
| `VITE_META_PIXEL_ID` | **public** | Meta Events Manager | 12 |
| `VITE_PUBLIC_URL` | **public** | your custom domain | 15 |
| `VITE_FIREBASE_AUTH_DOMAIN` | **public** | your custom domain | 15 |

> Firebase web config keys (`VITE_FIREBASE_API_KEY` etc.) are **already set** with working defaults in `src/lib/firebase.ts` and are *not secrets* — leave them unless you move to a different Firebase project.

---

## Detailed step-by-step guides

| Domain | Doc |
|---|---|
| Razorpay payments + webhook + serverless backend | `docs/PAYMENTS-SETUP.md` |
| GA4 + Meta Pixel + consent + Conversions API | `docs/ANALYTICS-SETUP.md` |
| Transactional (Firebase extension) + marketing (Brevo) email | `docs/EMAIL-SETUP.md` |
| WhatsApp Business Platform / BSP | `docs/WHATSAPP-SETUP.md` |
| 40-minute delivery operations | `docs/DELIVERY-OPS.md` |
| Final go-live checklist | `docs/PRODUCTION-CHECKLIST.md` |

---

## CRM, Returns, Chat & Call — deploy steps (one-time)

The CRM, returns/refunds (RMA), live chat and callback features are enforced
entirely by Firestore rules (free-tier model, no Cloud Functions), so the new
rules and indexes **must be deployed** before the features work in production:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

New Firestore collections created at runtime (no manual setup):
`returns`, `chats` (+ `chats/{uid}/messages`), `call_requests`, `crm`.

- **Live chat** requires the customer to be signed in (conversations are keyed
  by uid). Guests are routed to WhatsApp / phone / a sign-in prompt.
- **Return status emails** reuse the existing `mail/` queue (Trigger Email
  extension) — no extra config beyond what order emails already use.
- **Refund money movement stays manual**: marking a return "Refunded" records
  the amount and emails the customer; issue the actual refund in the Razorpay
  dashboard (or bank). A gateway auto-refund can be wired later.
- **Support phone / WhatsApp** number is set in `src/components/SupportWidget.tsx`
  (`SUPPORT_PHONE_*` / `SUPPORT_WA`) — update it if the atelier number changes.

### Becoming an admin (CRM / Returns / Support consoles)

Admin access is the Firebase `admin: true` custom claim (unchanged). After the
target user has signed up once, run with a service-account credential:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
npm run set-admin -- you@email.com          # grant
npm run set-admin -- --list                 # who is admin
```

The user must **sign out and back in** for the new claim to take effect. The
new admin sidebar sections (**Returns**, **Support**) and the CRM panel in
**Customers** are all gated by this same claim + the Firestore rules.

## Testing note (Playwright / E2E)

The CEO is adding Playwright MCP for manual/automated testing. The key flows to test, and the staging env needed, are in `docs/PRODUCTION-CHECKLIST.md` → "End-to-end test flows". In short, on a **staging deployment with Razorpay in TEST mode**, walk: browse → product → cart → checkout (demo + a real test-card charge) → order confirmation; newsletter/WhatsApp signup capture; admin login → change order status → confirm the customer email fires.
