# Tresor Couture — QA & Security Audit

**Date:** 2026-06-12
**Scope:** End-to-end functional testing, QA edge cases, and a security review of the
live application (tresorcouture.in) cross-checked against the `firestore.rules` in this branch.
**Method:** Manual exploratory testing through the browser plus direct Firestore REST probes
using the authenticated session token. No write/destructive tests were run against production data.

---

## 1. Executive summary

The core purchase journey is solid and the build is polished. Happy paths (auth → browse →
cart → checkout → order) all work. Issues are concentrated in **input validation**, **coupon
business logic**, and a few **routing/consistency** gaps — none block the core flow.

The earlier "critical broken-access-control" alarm has been **downgraded after review**: the
cross-user data I could read was explained by the test account holding the **admin custom
claim**, which is legitimately allowed to read everything. The `firestore.rules` in this branch
correctly scope per-user access. See §4 for the corrected analysis and the one test still
outstanding.

---

## 2. End-to-end functional testing — PASSED

| Area | Result |
|------|--------|
| Authentication (email/password, Google SSO, phone toggle) | Login succeeds; session/bag/wishlist state restores correctly |
| Catalogue (34 products) | Sort, filters, ratings, category tags, merchandising badges all work |
| Product detail | Images, colour/quantity selectors, wishlist toggle, pincode delivery checker all work |
| Cart | Add-to-bag, quantity recalculation (2 × ₹2,200 = ₹4,400), MRP/discount/GST/total breakdown all accurate |
| Coupons | `WEDDING50` applied a ₹10,000 discount; total updated correctly |
| Checkout & mock payment | Stepped through signed-in → address → payment; COD active, UPI/Card "coming soon" |
| COD value guard | Correctly **blocked** a ₹1,98,870 order (> ₹50,000 COD limit) and disabled Place Order with a clear message |
| Order placement | Succeeded after reducing cart below limit; confirmation `TC-cuBGSU`; persisted to order history with Reorder/Cancel/Track/View |

---

## 3. QA findings (functional / business logic)

| # | Severity | Finding | Repro / detail | Expected |
|---|----------|---------|----------------|----------|
| 1 | Medium | **Phone field has no validation** on Edit Profile | Entered `abc123`; saved with "Profile updated" | Reject non-numeric / wrong-length phone, like the pincode field does |
| 2 | Medium | **Coupon category restriction not enforced** | `WEDDING50` ("extra 10% off bridal silks") applied 10% (₹2,860) to a non-bridal Chanderi-only cart | Coupon should only discount eligible (bridal) line items |
| 3 | Low/Med | **Quantity cap inconsistency / no stock check** | Product page stepper went to 13 with no limit; cart dropdown normally caps at 10 but accepted the injected qty 13 | Consistent max + stock-availability enforcement |
| 4 | Low | **Routing inconsistency** | `/#/wishlist` → 404; real route is `/#/account/wishlist` | Redirect short path to the real route |
| 5 | Low | **GST on pre-discount amount** | GST appears computed on pre-coupon subtotal, not the discounted taxable value | Confirm with finance; Indian GST is normally on the discounted amount |
| 6 | Low | **Address internal consistency** | Saved default mixes "Chennai, Tamil Nadu 600034" (line 1) with "Hyderabad, Telangana 500006" (city/state/PIN) | Validate city/state/PIN consistency (partly pre-existing test data) |
| 7 | Cosmetic | **No empty state in search dropdown** | Inline dropdown goes blank on zero matches; full results page shows the proper "No fabrics match" message | Dropdown should mirror the empty state |

**Positive QA observations:** live search filtering with thumbnails, XSS-safe search (an
`<img onerror>` query rendered as inert text), real-time price-band filtering with removable
chips and a live count, well-designed branded error/404/empty-cart states, clean 390px mobile
layout with bottom tab bar + category drawer, email correctly read-only on profile, and
internally consistent cart math (line totals, discounts, 5% GST).

---

## 4. Security review

### 4.1 Corrected finding — cross-user reads were an admin-account artifact

During the live probe I used the authenticated session of **sumanthbolla97**, and with that
token a Firestore REST request returned `200` for:

- another user's `users/{uid}` document,
- the full `users` collection, and
- the full `orders` collection.

I initially flagged this as a **critical IDOR / broken access control**. On review against the
branch rules, that conclusion does not hold up:

- `users`: `allow read: if isOwner(userId) || isAdmin();`
- `orders`: `allow read: if isAdmin() || (isSignedIn() && resource.data.userId == request.auth.uid);`

These are correctly scoped. The **test account holds the admin custom claim** — I separately
confirmed it has a fully functional Admin Console (revenue, all customers' orders, inventory,
coupons). An admin token reading every `users`/`orders` document is **expected behaviour**, not
a vulnerability. The `200` responses pattern-matched to broken access control, but the actual
cause was the admin claim.

**Status:** Most likely a **false positive**. The branch's Firestore rules are sound.

**Outstanding verification (the one test that would make this conclusive):** repeat the same
cross-user REST probe while signed in as a **non-admin customer** account. If a non-admin still
gets `200` on another user's doc or on a full-collection list, it would mean the *deployed*
rules differ from this branch (not yet deployed / stale) — re-escalate to critical. If the
non-admin gets `403`, the matter is fully closed. I could not run this test because I only had
the admin session.

### 4.2 Confirmed observations

| Severity | Finding | Detail |
|----------|---------|--------|
| Medium | **Multi-user data residue in localStorage** | `tresor-wishlist-v1:<uid>` keys for several prior Firebase UIDs persist after sign-out. On a shared device this leaks which accounts used the browser and their wishlist contents. Sign-out should clear per-user local keys. |
| Low/Med | **No Content-Security-Policy** | No CSP meta tag or header observed; weakens defense-in-depth against XSS (observed input handling was correct). |
| ✅ Positive | Unauthenticated DB access correctly denied (`403`). |
| ✅ Positive | Firebase API key in client storage is expected and not a secret — security correctly rests on the rules. |
| ✅ Positive | Server-authoritative order path (Admin SDK / `/api/payments/verify`) is the only path that may set `paymentStatus: 'paid'`; client COD orders are constrained by `moneyConsistent()` so totals/shipping/discounts must be internally consistent. |
| ✅ Positive | Pincode input validation rejects malformed/XSS input. COD value limit enforced. Analytics/marketing consent defaults to `false`. |

---

## 5. Recommended priorities

1. **Run the non-admin Firestore probe** (§4.1) to definitively close or re-open the access-control
   question, and confirm the branch rules are actually deployed to production.
2. **Fix #1 (phone validation)** and **#2 (coupon eligibility)** — both are real correctness gaps.
3. Clear per-user `localStorage` keys on sign-out (§4.2).
4. Add a CSP header.
5. Address the routing/quantity/GST/empty-state items as hardening.
