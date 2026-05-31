# Email Setup (Tresor Couture)

Two separate systems. **Both need a verified sending domain — start the DNS step TODAY** (SPF/DKIM propagation can take up to 48h).

| Channel | Engine | Configured in | Status |
|---|---|---|---|
| **Auth** (password reset, verify, email change) | Firebase Auth | Firebase Console → Authentication → Templates | Branded HTML ready in `branding/email-templates/auth/`; needs pasting |
| **Transactional** (order confirmation + status) | "Trigger Email from Firestore" extension watching the `mail/` collection | Firebase Extensions + SMTP | Code ready (`buildOrderConfirmationEmail` / `buildOrderStatusEmail` in `src/lib/firebase.ts`); extension **not installed** |
| **Marketing** (welcome, abandoned cart, launch) | MailerLite | MailerLite dashboard | Not built; `subscribers` Firestore collection already capturing leads |

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

## C. Marketing email — MailerLite

### C1. Account + domain (CEO, START TODAY for the DNS wait)
1. https://dashboard.mailerlite.com → sign up.
2. **Settings → Domains → verify a sending domain** (SPF/DKIM). Same DNS wait as A1.
3. **Integrations → Developer API → Generate token** → hand back **`MAILERLITE_API_KEY`** (server secret).

### C2. Wire capture → MailerLite (Eng, P3)
Leads already land in the `subscribers` Firestore collection (email + optional WhatsApp + source; `subscribersApi.add` in `src/lib/firebase.ts`). Eng syncs that collection into a MailerLite group. De-dup at sync.

### C3. Build the campaigns (CEO, P3)
- **Welcome automation** (trigger: joins group).
- **Abandoned-cart** flow.
- **Launch** campaign off the brand social kit.

---

## Handback checklist

- [ ] Blaze enabled (gates the extension)
- [ ] SMTP domain verified; SMTP URI entered in the extension config
- [ ] `mail/` smoke test delivered
- [ ] Auth templates pasted + action URL set
- [ ] `MAILERLITE_API_KEY` provided
- [ ] MailerLite sending domain verified
