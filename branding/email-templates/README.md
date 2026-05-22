# Tresor Couture — Email Setup

This kit covers every email the storefront sends. There are two delivery
mechanisms because Firebase splits them apart:

| Channel | Sent by | Configured in | Template lives in |
| --- | --- | --- | --- |
| Auth emails (password reset, email verification, email change, OTP) | Firebase Auth | **Firebase Console → Authentication → Templates** | `auth/*.html` here |
| Transactional emails (order confirmation, order status, future marketing) | The "Trigger Email" extension watching the `mail/` collection | **Firebase Extensions Marketplace** + SMTP credentials | Built at runtime in `src/lib/firebase.ts` (`buildOrderConfirmationEmail` / `buildOrderStatusEmail`) |

Brand voice for every email follows `branding/BRAND.md`: curated, restrained,
archival, present tense, no exclamation marks, Indian-English spelling.

---

## 1. Firebase Auth email templates (one-time, ~10 minutes)

1. Open **Firebase Console → Authentication → Templates**.
2. For each template (Password reset / Email verification / Email change), click the pencil icon and paste the content from the corresponding file in `auth/`.
3. While you are there, set the **sender name** to `Tresor Couture` (don't bother trying to change the From address unless you've verified a custom domain — Spark/Blaze on default config sends from `noreply@tresor-couture.firebaseapp.com`).
4. Set the **reply-to** to `care@tresor.couture` (or whichever support inbox you actually monitor).
5. Save each template. There is no preview that catches typos — send yourself a real reset link to verify rendering.

> **Custom domain (optional, ~30 min)**: if you want emails to come from
> `noreply@tresor-couture.com` instead of the firebaseapp.com address, do
> **Authentication → Templates → Customize domain** and follow the DNS
> verification flow. Requires the Blaze plan (you have it). One-time setup.

---

## 2. Trigger Email extension (one-time, ~30 minutes)

1. Open **Firebase Console → Extensions → Browse** and install **"Trigger Email from Firestore"** by Firebase.
2. Configuration:
   - **Collection path**: `mail`
   - **Authorized domain** (Default FROM address): match the verified domain on your SMTP provider, e.g. `Tresor Couture <noreply@tresor-couture.com>`
   - **SMTP connection URI**:
     - **SendGrid** (recommended; 100 emails/day free): `smtps://apikey:<API_KEY>@smtp.sendgrid.net:465`
     - **Brevo** (300/day free): `smtps://<smtp-login>:<smtp-key>@smtp-relay.brevo.com:587`
     - **Mailgun**: `smtps://postmaster@sandbox<id>.mailgun.org:<key>@smtp.mailgun.org:587`
   - Leave the `templates/` collection blank — we build the HTML at the call site (more flexible than mustache templates).
3. Click **Install Extension**, wait ~2 minutes for deployment.
4. **Smoke test**: in the Firestore Console, manually add a doc to `mail/`:
   ```json
   {
     "to": "your-own-email@example.com",
     "message": {
       "subject": "Tresor Couture — extension smoke test",
       "text":    "If you are reading this, the extension is wired correctly.",
       "html":    "<p>If you are reading this, the extension is wired correctly.</p>"
     }
   }
   ```
   Within ~10 seconds the extension's logs (Functions → Logs) will show "delivered" and the email arrives. If you instead see "ECONNREFUSED" or "auth failed", the SMTP URI is wrong.

Once that smoke test passes, every order placed through the storefront will
automatically trigger a confirmation email — no further code changes
needed. Order-status changes from the admin console will email the customer
too. The current event coverage is in `src/lib/firebase.ts`:

| Trigger | Recipient | Subject |
| --- | --- | --- |
| `ordersApi.place()` | Customer | `Tresor Couture — your order <id> is placed` |
| `ordersApi.setStatus('processing')` | Customer | `Tresor Couture — your order is being prepared` |
| `ordersApi.setStatus('shipped')` | Customer | `Tresor Couture — your order has left the atelier` |
| `ordersApi.setStatus('delivered')` | Customer | `Tresor Couture — your order has been delivered` |
| `ordersApi.setStatus('cancelled')` | Customer | `Tresor Couture — your order has been cancelled` |
| `ordersApi.setStatus('refunded')` | Customer | `Tresor Couture — your refund has been processed` |

Admin "new order" alerts currently land in the `admin_notifications/` Firestore
collection. Wire them up to email later by adding a Cloud Function that
reads new `admin_notifications` docs and writes a corresponding `mail/`
doc addressed to your ops inbox — that keeps the admin email address out
of customer-writable collections.

---

## 3. Files in this folder

- `auth/password-reset.html` — paste into Auth Templates → Password reset → Message
- `auth/email-verification.html` — paste into Auth Templates → Email verification → Message
- `auth/email-change.html` — paste into Auth Templates → Email address change → Message
- `auth/subject-lines.txt` — the subject for each template, in the Tresor voice

Customer order/status emails use HTML built at the call site (see
`buildOrderConfirmationEmail` and `buildOrderStatusEmail` in `src/lib/firebase.ts`).
If you want to redesign those, edit the builder functions — they're plain
TypeScript with inline HTML, no templating engine to learn.
