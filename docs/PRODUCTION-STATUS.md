# Production Status — code vs. manual

Snapshot of what is **done in code** and what still needs a **human** before go-live.
Pairs with `docs/PRODUCTION-CHECKLIST.md` and `MANUAL-ACTIONS.md`.

## ✅ Done in code (this pass)
- **Legal / policy pages** live and routed (`#/p/<slug>`): Privacy, Terms, Shipping,
  Returns & Refunds, Cancellation, Contact, FAQ, About, Careers
  (`src/content/legal.tsx` + `src/pages/InfoPage.tsx`).
- **Footer fully wired** — every link now points to a real route (shop categories,
  policy pages, Track Order → account). No more dead `#`/home links.
- **Terms/Privacy linked** from the Login & Register consent lines.
- **Real contact details** in the footer (`hello@tresorcouture.in`, `+91 63042 11922`,
  Instagram) — replaced the placeholder phone/email.
- **Empty "Lace" category removed** from the nav (was a dead/empty listing).
- **40-minute serviceability** layer (location + pincode) — see PR for `claude/40min-serviceability`.
- Payments **backend already implemented**: authoritative server-side totals,
  Razorpay signature verification, webhook, transactional stock-decrement
  (`api/payments/*`). Needs live keys only (owner).

## ⚠️ Fill before go-live (placeholders in `src/content/legal.tsx`)
Replace every `[BRACKETED]` value: **registered legal entity name**, **GSTIN**,
**Grievance Officer name**, **governing-law city/jurisdiction**, and the exact
**return window / refund / dispatch timelines** (currently `[7]`, `[5–7]`, `[1–2]`).
Have a lawyer review for India D2C (CP E-Commerce Rules 2020, DPDP Act 2023).

## 🔴 Manual / owner (not code) — see MANUAL-ACTIONS.md
- **Payments** (you're doing this): Razorpay KYC + live keys + webhook + `FIREBASE_SERVICE_ACCOUNT`.
- **Firebase Blaze** plan + billing alert; deploy rules/indexes; `npm run seed` catalog.
- **Email**: verify sending domain (SPF/DKIM), install Trigger Email extension, brand auth templates.
- **Security**: override `VITE_ADMIN_PASSCODE`, bootstrap admin claim.
- **Domain/DNS/SSL** + add domain to Firebase Authorized domains; update `VITE_PUBLIC_URL`/`VITE_FIREBASE_AUTH_DOMAIN`.
- **Analytics**: set `VITE_GA4_MEASUREMENT_ID`, `VITE_META_PIXEL_ID`.

## 🟡 Later (deferred by owner)
- **Dark store + last-mile** for the 40-minute promise (ops, weeks). 40-min copy is kept
  as-is per owner decision; the serviceability check is live and ready when ops are.
