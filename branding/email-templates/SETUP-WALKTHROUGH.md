# How to white-label your Firebase Auth emails

The screenshot you saw — *"Reset your password for project-102541847727"* with
a `firebaseapp.com` URL and a *"Your project-102541847727 team"* signature
— is Firebase's **default template**, fully unedited. Every awkward line
disappears once you do the four steps below. **No code changes required.**
Estimated time: ~10 minutes for everything except the custom SMTP step
(which is optional and adds ~30 min).

---

## Step 1 — Replace the email HTML body (3 min per template)

Open **Firebase Console → Authentication → Templates** and you will see
three templates listed (Password reset, Email verification, Email address
change). For each:

1. Click the pencil icon on the right.
2. In the **Message** body, click the small `</>` toggle in the editor to switch from rich-text to HTML mode.
3. Delete everything inside.
4. Paste the contents of the corresponding file from `branding/email-templates/auth/`:
   - Password reset → `password-reset.html`
   - Email verification → `email-verification.html`
   - Email address change → `email-change.html`
5. Click **Save**.

The pasted HTML uses table-layout (every email client supports it),
inline styles (Gmail strips `<style>` tags), the Tresor palette
(`#F5ECDC` / `#B8893A` / `#2A1F12`), a real ink-on-cream CTA button,
and Firebase's placeholders (`%LINK%`, `%DISPLAY_NAME%`, `%EMAIL%`,
`%NEW_EMAIL%`) which Firebase substitutes at send time.

---

## Step 2 — Replace the subject line + sender name (2 min per template)

Still in the same edit screen for each template:

| Field | What it shows now | Change to |
| --- | --- | --- |
| **Subject** | `Reset your password for project-102541847727` | `Tresor Couture — reset your password` (or "confirm your email" / "confirm your new email address") |
| **Sender name** | _(blank or "project-102541847727")_ | `Tresor Couture` |
| **Reply-to** | `noreply@tresor-couture.firebaseapp.com` | `care@tresorcouture.in` |

Subjects for the other two templates are in `branding/email-templates/auth/subject-lines.txt`.

After this step, the inbox preview becomes:
> **Tresor Couture** &middot; *Tresor Couture — reset your password*

instead of:
> **noreply@tresor-co...** &middot; *Reset your password for project-102541847727*

---

## Step 3 — Send users to YOUR branded handler page, not Firebase's

By default the reset link points at
`https://tresor-couture.firebaseapp.com/__/auth/action?...` — that's
the unbranded Firebase-hosted page (white background, system fonts,
*"Try resetting your password again"* error). The repo now ships a
**custom branded handler** at `/auth/action` that runs on your own
domain and matches the rest of the site (cream BG, Tresor typography,
brand error states).

To use it:

1. Still in **Firebase Console → Authentication → Templates**, scroll to the bottom of any template editor.
2. Click **Customize action URL** (small link, easy to miss).
3. A modal appears with an "Action URL" field. Replace the default with:

   `https://tresor-couture.vercel.app/auth/action`

4. Click **Save**.

`vercel.json` already includes a rewrite of `/auth/action → /index.html`
so the SPA serves your handler. The handler component
(`src/pages/AuthActionPage.tsx`) reads `mode` + `oobCode` from the URL
query, calls the matching Firebase API
(`verifyPasswordResetCode`, `confirmPasswordReset`, `applyActionCode`),
and renders branded forms for:

- `mode=resetPassword` — verifies the link, shows a "choose new password" form on your domain, redirects to `/login` on success
- `mode=verifyEmail` — applies the verification code, shows "Email confirmed"
- `mode=recoverEmail` — reverts an email change, shows "Email restored"

After this step:
- The URL in the email reads `https://tresor-couture.vercel.app/auth/action?...` — your own domain
- Clicking the link lands on a fully branded page, not the unbranded firebaseapp.com one
- Expired/used links show your custom error UI ("This reset link is no longer valid → Request a new reset link") instead of Firebase's "Try resetting your password again"

---

## Step 4 (optional, ~30 min) — Send from your OWN domain instead of `noreply@<project>.firebaseapp.com`

Steps 1-3 customise everything **inside** the email and the visible
URL, but the **From** address is still `noreply@tresor-couture.firebaseapp.com`.
To replace that with `hello@tresorcouture.in` (the brand-owned mailbox),
configure **custom SMTP** for Auth emails:

1. In **Firebase Console → Authentication → Templates**, click **SMTP settings** (top right of the templates screen).
2. Toggle on **Customize SMTP server**.
3. Fill in connection details for any SMTP provider — examples:
   - **SendGrid**: Host `smtp.sendgrid.net` &middot; Port `465` &middot; SSL &middot; Username `apikey` &middot; Password = your SendGrid API key
   - **Brevo**: Host `smtp-relay.brevo.com` &middot; Port `587` &middot; STARTTLS &middot; Username + password from Brevo dashboard
   - **Amazon SES**: Host `email-smtp.<region>.amazonaws.com` &middot; Port `465` &middot; SSL &middot; SMTP credentials from SES console
4. Set **Sender email** to `hello@tresorcouture.in` (you must first verify ownership of `tresorcouture.in` with the SMTP provider — SPF + DKIM DNS records).
5. Click **Save**.

After this, every Auth email comes **from** your verified domain and
the inbox shows `Tresor Couture <hello@tresorcouture.in>` — no
Firebase reference anywhere.

> **Same SMTP works for the Trigger Email extension**, so configuring this
> once lets you skip configuring SMTP separately in the extension if you
> want a single sender across the entire system.

---

## Summary — what each step hides

| What the user sees today | After step | Becomes |
| --- | --- | --- |
| Subject: *"Reset your password for project-102541847727"* | 2 | *"Tresor Couture — reset your password"* |
| Sender: *"noreply@tresor-co..."* | 2 | *"Tresor Couture"* |
| Body: *"Hello, Follow this link to reset your project-102541847727 password..."* | 1 | Branded HTML with a Reset button on cream background |
| URL: `https://tresor-couture.firebaseapp.com/__/auth/action?...` | 3 | `https://tresor-couture.vercel.app/__/auth/action?...` |
| Signature: *"Your project-102541847727 team"* | 1 | *"— The Tresor Couture team"* |
| From-address: `noreply@<project>.firebaseapp.com` | 4 (opt) | `hello@tresorcouture.in` |

Steps 1-3 take 10 minutes and remove every visible mention of Firebase
from the recipient's perspective. Step 4 is the final mile to make it
**truly** look like a hand-built email system &mdash; required only if
you care about the address bar in their email client.
