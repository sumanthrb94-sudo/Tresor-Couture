# Tresor Couture — Defect Tracker (Post-Deploy QA)

**Build:** deployed `tresorcouture.in`  **Date:** 2026-06-12
**Status legend:** OPEN (needs fix) · VERIFIED-FAIL (reproduced) · BLOCKED (needs non-admin/your action) · PASS

Severity: 🔴 Critical · 🟠 High · 🟡 Medium · 🔵 Low · ⚪ Cosmetic

---

## Defects

### D-01 🟡 Sign-out leaves per-user data in localStorage  — VERIFIED-FAIL  (was SC-3)
- **Area:** Auth / privacy
- **Repro:** Sign out, inspect `localStorage`.
- **Actual:** Three `tresor-wishlist-v1:<uid>` keys remain, including other users' UIDs.
- **Expected:** All per-user keys cleared on sign-out.
- **Impact:** On a shared device, leaks which accounts used the browser + their wishlists.
- **Fix hint:** On sign-out, iterate and remove `tresor-wishlist-v1:*` (and any other per-uid keys).

### D-02 🟡 Profile phone accepts invalid input  — VERIFIED-FAIL  (QA-1 / AC-3)
- **Area:** Account → Edit Profile
- **Repro:** Enter `abc123` in phone, save.
- **Actual:** Saves with "Profile updated."
- **Expected:** Reject non-numeric / wrong-length (like the pincode field does).
- **Note:** Re-confirm cleanly on a non-admin account.

### D-03 🟡 Category-restricted coupon applies to ineligible cart  — VERIFIED-FAIL  (QA-2 / CT-7)
- **Area:** Cart / pricing
- **Repro:** Apply `WEDDING50` ("extra 10% off bridal silks") to a cart with only a non-bridal Chanderi.
- **Actual:** 10% (₹2,860) applied.
- **Expected:** Discount rejected / limited to eligible bridal items.
- **Impact:** Margin leakage.

### D-04 🔵 Product quantity has no max/stock cap  — VERIFIED-FAIL  (QA-3 / PD-3)
- **Area:** PDP + cart
- **Repro:** PDP stepper → reached qty 13; cart dropdown normally caps at 10 but accepted 13.
- **Expected:** Consistent max + stock-availability enforcement.

### D-05 🔵 `/#/wishlist` returns 404  — VERIFIED-FAIL  (QA-4 / AC-5)
- **Area:** Routing
- **Repro:** Open `/#/wishlist`.
- **Actual:** 404. Real route is `/#/account/wishlist`.
- **Expected:** Redirect short path to the real route.

### D-06 🔵 Login surfaces raw Firebase error string  — VERIFIED-FAIL  (AU-3)
- **Area:** Auth
- **Repro:** Login with wrong password.
- **Actual:** Shows `Firebase: Error (auth/invalid-credential)`.
- **Expected:** Friendly copy, e.g. "Incorrect email or password."

### D-07 🔵 No Content-Security-Policy header  — VERIFIED  (SC-4)
- **Area:** Security hardening
- **Actual:** CSP absent. HSTS, X-Frame-Options, X-Content-Type-Options(nosniff), Referrer-Policy all present.
- **Expected:** Add a CSP (report-only first, then enforce).

### D-08 ⚪ Sitemap/robots points to the vercel.app domain  — VERIFIED  (PF-2)
- **Area:** SEO
- **Actual:** `robots.txt` 200 but sitemap references the `*.vercel.app` host, not `tresorcouture.in`.
- **Expected:** Canonical domain in sitemap.

### D-09 ⚪ Search dropdown has no empty state  — VERIFIED
- **Area:** Search UX
- **Actual:** Inline dropdown goes blank on zero matches; full results page shows the proper "no fabrics match."
- **Expected:** Dropdown mirrors the empty state.

### D-10 🔵 GST appears computed on pre-discount subtotal  — NEEDS-CONFIRM
- **Area:** Pricing / compliance
- **Detail:** GST looks applied to pre-coupon subtotal rather than discounted taxable value. Confirm with finance — Indian GST is normally on the discounted amount.

### D-11 ⚪ Address internal consistency not validated  — LOW / test data
- **Area:** Checkout
- **Detail:** Saved default mixes "Chennai, Tamil Nadu 600034" (line 1) with "Hyderabad, Telangana 500006" (city/state/PIN). Partly pre-existing test data.

---

## Open verification items (need a non-admin account / your action)

| ID | Item | Why blocked |
|----|------|-------------|
| SC-1 | Non-admin REST read of another user's doc / `users` / `orders` must return **403** | Needs a non-admin token; run via the status-only self-check snippet (does not read PII) |
| SC-5 | Non-admin cannot reach admin console; passcode ≠ default | Needs a non-admin account |
| AU-1 | Register new account | Account creation is yours to do |
| AU-4 | Google SSO | Needs your authorization + action |
| AU-6 / CO-6 | Brevo signup / order emails | Backend/email access not available |
| CO-5 / AC-4 | Place + cancel a real COD order | Needs login + your explicit go-ahead |
| PD-4 | Wishlist persistence after reload | Needs login |

---

## Security posture summary

- **SC-2 PASS** — unauthenticated Firestore reads return `403` for both `users` and `orders`.
- **Branch `firestore.rules`** are correctly scoped per-owner + admin (reviewed in `docs/QA-AUDIT.md`).
- The earlier "critical data exposure" was an **admin-account artifact**, not a rules flaw.
- **SC-1 is the only remaining gate**: a non-admin `403` confirms the *deployed* rules match the branch. Run the snippet below.

---

## SC-1 self-check snippet (status-only — never logs PII)

Run in the browser console **while logged in as a throwaway non-admin account**.
It reports PASS/FAIL from HTTP status alone and deliberately does not print any document data.

```js
(async () => {
  // Firebase config is public; pull project + key from the app's existing config.
  const cfg = (window.firebase?.apps?.[0]?.options) || JSON.parse(
    Object.keys(localStorage).filter(k => k.startsWith('firebase:'))
      .map(k => localStorage.getItem(k)).find(v => v?.includes('projectId')) || '{}'
  );
  const projectId = cfg.projectId;
  // Grab the current user's ID token from the Firebase Auth SDK.
  const user = window.firebase?.auth?.().currentUser;
  const token = user ? await user.getIdToken() : prompt('Paste your idToken from devtools');
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
  const myUid = user?.uid;
  const probes = [
    ['list users collection', `${base}/users?pageSize=1`],
    ['list orders collection', `${base}/orders?pageSize=1`],
  ];
  for (const [label, url] of probes) {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    // STATUS ONLY — we never read r.json(), so no PII is fetched into memory/logs.
    const verdict = r.status === 403 ? 'PASS (403 denied)'
                  : r.status === 200 ? '❌ FAIL — rules allow non-admin read (200). STOP, redeploy firestore.rules'
                  : `unexpected ${r.status}`;
    console.log(`[SC-1] ${label}: ${verdict}`);
  }
  console.log(`[SC-1] your own uid=${myUid} reads are expected to succeed; cross-user/collection must be 403.`);
})();
```

> If any probe prints `200`, the deployed rules are stale versus this branch — **block the launch and redeploy `firestore.rules`**. The snippet stops at the status code, so you confirm the boundary without ever reading another customer's data.
