# Email Setup (Tresor Couture)

Two separate systems. **Both need a verified sending domain — start the DNS step TODAY** (SPF/DKIM propagation can take up to 48h).

| Channel | Engine | Configured in | Status |
|---|---|---|---|
| **Auth** (password reset, verify, email change) | Firebase Auth | Firebase Console → Authentication → Templates | Branded HTML ready in `branding/email-templates/auth/`; needs pasting |
| **Transactional** (order confirmation + status) | "Trigger Email from Firestore" extension watching the `mail/` collection | Firebase Extensions + SMTP | Code ready (`buildOrderConfirmationEmail` / `buildOrderStatusEmail` in `src/lib/firebase.ts`); extension **not installed** |
| **Marketing** (welcome, abandoned cart, launch) | **Brevo** | Brevo dashboard | Contact-sync built + wired (`api/subscribers/sync.ts`); needs `BREVO_API_KEY`. Campaigns authored in Brevo. |

---

## A. Transactional email — Firebase "Trigger Email" extension

**Prerequisite:** Firebase **Blaze plan** (`MANUAL-ACTIONS.md` item 6) — the extension needs it.

### A1. Pick + verify an SMTP provider (CEO, ~45 min + DNS wait)
- **SendGrid** (100/day free): https://app.sendgrid.com → Settings → Sender Authentication → **Authenticate a domain** → add the SPF/DKIM CNAME records to your DNS → verify.
- **Brevo** (300/day free): https://app.brevo.com → Senders & Domains → add + verify domain.
- DNS propagation: a few hours up to **48h**.

### A2. Install the extension (CEO + Eng, ~30 min)
Per `branding/email-templates/README.md` §2:
1. Firebase Console → **Extensions → Browse Marketplace → "Trigger Email from Firestore"** → Install.
2. Config:
   - **Collection path:** `mail`
   - **Default FROM:** `Tresor Couture <noreply@your-domain>` (must match the verified domain)
   - **SMTP connection URI** (entered here, **not** in Vercel):
     - SendGrid: `smtps://apikey:<API_KEY>@smtp.sendgrid.net:465`
     - Brevo: `smtps://<smtp-login>:<smtp-key>@smtp-relay.brevo.com:587`
   - Leave the `templates/` collection blank (HTML is built in code).
3. Wait ~2 min for deployment.

### A3. Smoke test
In Firestore Console add a doc to `mail/`:
```json
{ "to": "you@example.com", "message": { "subject": "smoke test", "text": "wired", "html": "<p>wired</p>" } }
```
Within ~10s the email should arrive (check Functions → Logs for "delivered"). After this passes, **every order** auto-sends a confirmation and **every status change** from the admin console emails the customer — no further code needed.

---

## B. Auth emails — brand the templates (CEO, ~20 min, no Blaze needed)

Per `branding/email-templates/SETUP-WALKTHROUGH.md`:
1. Firebase Console → **Authentication → Templates**. For each of Password reset / Email verification / Email change: toggle HTML mode, paste the matching file from `branding/email-templates/auth/`, set **Subject** (see `auth/subject-lines.txt`), **Sender name** = `Tresor Couture`, **Reply-to** = a monitored inbox.
2. **Customize action URL** → set to `https://<your-domain>/auth/action` (the SPA already serves a branded handler at that path; `vercel.json` rewrites it).
3. (Optional) **SMTP settings** → custom SMTP to send Auth mail from your own domain too — reuses the same SendGrid/Brevo credentials as A1.

> When you move to a custom domain, also add it to **Authentication → Settings → Authorized domains** or password-reset / OAuth links break.

---

## C. Marketing email — Brevo  ✅ engine chosen

Brevo is the marketing engine (campaigns + automations authored in the Brevo
dashboard). The app's only code responsibility is to **sync opt-ins into Brevo
contacts** — already built and wired (`api/subscribers/sync.ts` +
`api/_lib/brevo.ts`, called best-effort by `NewsletterForm`).

### C1. API key + (optional) list (CEO, ~10 min)
1. Brevo → **SMTP & API → API Keys → Generate a new API key** → hand back **`BREVO_API_KEY`** (server secret; set in Vercel → Production + Preview).
2. (Optional) Brevo → **Contacts → Lists** → create e.g. "Tresor Launch" → note its numeric id → set **`BREVO_LIST_ID`** so synced contacts land in that list.
3. (If you also use Brevo SMTP for transactional/auth email — section A — verify your sending domain's SPF/DKIM. Marketing campaigns also send better from a verified domain.)

### C2. Capture → Brevo sync (Eng — DONE)
Leads land in the `subscribers` Firestore collection (source of truth) **and** are upserted into Brevo via `POST /api/subscribers/sync` on every newsletter/footer signup. The sync is **credential-gated**: with no `BREVO_API_KEY` it's a clean no-op (the Firestore capture still works). Phone numbers map to Brevo `SMS`/`WHATSAPP` attributes; `source` maps to `SOURCE`. Upsert = automatic de-dup.

> Backfill: existing `subscribers` docs captured before the key was set aren't auto-pushed. Either export them (admin) and import the CSV into Brevo once, or ask Eng for a one-off backfill script.

### C3. Build the campaigns (CEO, P3 — in Brevo)
- **Welcome automation** (trigger: contact added to the list).
- **Abandoned-cart** flow.
- **Launch** campaign off the brand social kit.

---

## Handback checklist

- [ ] Blaze enabled (gates the transactional extension — section A)
- [ ] SMTP domain verified; SMTP URI entered in the extension config (section A)
- [ ] `mail/` smoke test delivered
- [ ] Auth templates pasted + action URL set
- [ ] `BREVO_API_KEY` set in Vercel (enables contact sync)
- [ ] (optional) `BREVO_LIST_ID` set
- [ ] Welcome / abandoned-cart / launch campaigns built in Brevo
