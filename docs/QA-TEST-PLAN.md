# Tresor Couture — Post-Deploy QA Test Plan

Run this against the deployed URL right after a release. Each case has **steps**,
**expected result**, and a checkbox. Mark ❌ + a note on any failure. Cases are
non-destructive except TC-CART/TC-CHECKOUT, which place a real (COD) order — use a
test account and cancel the order afterwards.

- **Target URL:** `https://tresorcouture.in` (or the preview URL)
- **Routing:** hash-based — deep links are `/#/...`
- **Test account:** use a throwaway, non-admin login for customer flows
- **Pair with** `docs/SMOKE-TEST.md` for the API/Brevo/payments curl checks

---

## 0. Pre-flight (2 min)

| ID | Step | Expected | ✓ |
|----|------|----------|---|
| PF-1 | Load home `/` | Loads < 3s, no console errors, hero + nav render | ☐ |
| PF-2 | `curl -I` home + `/robots.txt` | Both `HTTP 200` | ☐ |
| PF-3 | View source / network | No secrets beyond the expected public Firebase config | ☐ |
| PF-4 | Hard-refresh a deep link e.g. `/#/account/orders` | Resolves (no white screen) | ☐ |

---

## 1. Authentication

| ID | Step | Expected | ✓ |
|----|------|----------|---|
| AU-1 | Register a new email/password account | Account created; logged in; bag/wishlist counts initialise | ☐ |
| AU-2 | Sign out, then log back in | Session + bag + wishlist restore correctly | ☐ |
| AU-3 | Login with wrong password | Clear inline error; no crash | ☐ |
| AU-4 | Google SSO | Completes; lands logged-in | ☐ |
| AU-5 | Phone-login toggle | UI switches; OTP/phone path behaves as designed | ☐ |
| AU-6 | New signup fires Brevo `signup` automation | Welcome email/automation triggers (see SMOKE-TEST §3) | ☐ |

---

## 2. Catalogue & Search

| ID | Step | Expected | ✓ |
|----|------|----------|---|
| CA-1 | Open shop / All Products | All items load with images, price, badges | ☐ |
| CA-2 | Apply each Sort option | Order changes correctly (Price asc/desc, Rating, New, Popularity) | ☐ |
| CA-3 | Apply a price-band filter | Count updates live; removable chip appears; Apply shows live count | ☐ |
| CA-4 | Category navigation | Correct subset shown; breadcrumb correct | ☐ |
| CA-5 | Search a real product | Dropdown shows matches with thumbnails | ☐ |
| CA-6 | Search gibberish | Full results page shows "no fabrics match" empty state | ☐ |
| CA-7 | **Security:** search `<img src=x onerror=alert(1)>` | Rendered as inert text; **no alert** fires | ☐ |

---

## 3. Product Detail (PDP)

| ID | Step | Expected | ✓ |
|----|------|----------|---|
| PD-1 | Open a product | Images, price (`₹X` per-unit vs `₹X/m` fabric), description load | ☐ |
| PD-2 | Change colour/variant | Selection + any image/price change applies | ☐ |
| PD-3 | Quantity stepper | Increments/decrements; **does not exceed stock/max** (regression QA-3) | ☐ |
| PD-4 | Wishlist toggle | Adds/removes; count updates; persists after reload | ☐ |
| PD-5 | Pincode checker — valid 6-digit | Returns delivery estimate | ☐ |
| PD-6 | Pincode checker — `abc` / `<script>` / 5 digits | Rejected: "valid 6-digit pincode"; nothing executes | ☐ |

---

## 4. Cart

| ID | Step | Expected | ✓ |
|----|------|----------|---|
| CT-1 | Add a per-unit item (qty 2) + a per-meter length | Both appear; line totals correct | ☐ |
| CT-2 | Verify math | Subtotal, 5% GST, shipping correct; **free shipping ≥ ₹1,999** | ☐ |
| CT-3 | Change quantity in cart | Recalculates; max is consistent with PDP (regression QA-3) | ☐ |
| CT-4 | Remove an item | Removed; totals update; empty-cart state shows "Shop Now" when emptied | ☐ |
| CT-5 | Apply a valid coupon | Discount applied; total updates | ☐ |
| CT-6 | Apply an invalid coupon | Clear rejection; no discount | ☐ |
| CT-7 | **Regression QA-2:** apply a category-restricted coupon (e.g. `WEDDING50` "bridal silks") to a cart with **no eligible item** | Discount should be **rejected / not applied** | ☐ |

---

## 5. Checkout & Payment

| ID | Step | Expected | ✓ |
|----|------|----------|---|
| CO-1 | Proceed to checkout | Steps: signed-in → address → payment | ☐ |
| CO-2 | Saved/new delivery address | Saves; Save & Continue advances | ☐ |
| CO-3 | Payment options | COD active; UPI/Card show "coming soon" (or live if Razorpay keys set) | ☐ |
| CO-4 | **COD value guard:** cart total > ₹50,000, choose COD | Place Order **disabled** with clear message | ☐ |
| CO-5 | Reduce below ₹50,000, place COD order | Order succeeds; confirmation page + receipt `TC-...`; bag clears | ☐ |
| CO-6 | order_placed event | Brevo order automation fires (SMOKE-TEST §4); confirmation email sent (watch for duplicate if `mail/` extension also on) | ☐ |

---

## 6. Account & Orders

| ID | Step | Expected | ✓ |
|----|------|----------|---|
| AC-1 | Account → Orders | New order appears with Reorder/Cancel/Track/View | ☐ |
| AC-2 | Edit Profile — email field | **Read-only** | ☐ |
| AC-3 | **Regression QA-1:** Edit Profile — enter phone `abc123` | Should be **rejected** (format/length validation) | ☐ |
| AC-4 | Cancel the test order placed in CO-5 | Status updates correctly | ☐ |
| AC-5 | **Regression QA-4:** open `/#/wishlist` directly | Resolves to wishlist (redirect), **not 404** | ☐ |

---

## 7. Responsive / Cross-device

| ID | Step | Expected | ✓ |
|----|------|----------|---|
| RS-1 | Mobile 390px | Bottom tab bar + category drawer; layout clean | ☐ |
| RS-2 | Tablet ~768px | No broken grids/overflow | ☐ |
| RS-3 | Desktop ≥1280px | Full nav; images crisp | ☐ |

---

## 8. Security spot-checks (post-deploy)

| ID | Step | Expected | ✓ |
|----|------|----------|---|
| SC-1 | **Firestore rules deployed?** As a **non-admin** account, attempt to read another user's doc / list `users` / list `orders` via REST (token from devtools). | **`403`** on cross-user/collection reads → branch rules are live. A `200` means stale rules — **block release**, redeploy `firestore.rules`. | ☐ |
| SC-2 | Unauthenticated Firestore read | `403` | ☐ |
| SC-3 | Sign out, inspect `localStorage` | Per-user keys (`tresor-wishlist-v1:<uid>`) cleared (regression of the residue finding) | ☐ |
| SC-4 | Response headers | Check for `Content-Security-Policy` (hardening item — note if absent) | ☐ |
| SC-5 | Admin console reachable only by admin | Non-admin cannot reach `/#/...admin`; passcode is NOT the default | ☐ |

> **SC-1 is the gate for the audit's open question.** The `firestore.rules` in this
> branch are correctly scoped (per-owner + admin). The earlier "data exposure" was an
> admin-account artifact. SC-1 with a *non-admin* account is what conclusively confirms
> the deployed rules match — run it before announcing the launch.

---

## 9. Admin console — CRUD / write paths

Run signed in as an **admin** account (the write paths are gated by the Firebase
`admin` custom claim + `firestore.rules`). These exercise the *save* paths, not just
viewing — the surface that was previously untested. Every save below must close the
editor and refresh the row **with no red "Unsupported field value: undefined" error**.

| ID | Step | Expected | ✓ |
|----|------|----------|---|
| AD-1 | Open Admin (footer is admin-only now) → dashboard | Revenue/orders/customers render; no console errors | ☐ |
| AD-2 | Products → edit a product → change Price/Stock → **Save Changes** | Saves cleanly; new values persist after reload (regression of the `gallery: undefined` crash) | ☐ |
| AD-3 | Edit a product → **clear all gallery fields** → Save | Saves; gallery images are actually removed (not silently kept) | ☐ |
| AD-4 | Edit a product that has **no** gallery/subCategory/colors → Save | Saves cleanly (absent fields left untouched, no undefined crash) | ☐ |
| AD-5 | Products → **Add Product** (new) with required fields → Save | New product created and appears in the list | ☐ |
| AD-6 | Coupons → create/save a coupon with **min subtotal / max discount / expiry left blank** | Saves cleanly (regression of coupon `undefined` crash); applies correctly at checkout | ☐ |
| AD-7 | Coupons → save a coupon with all optional fields filled | Saves; values enforced (min subtotal, cap, expiry) | ☐ |
| AD-8 | Inventory → change a stock value → Save | Persists; low-stock indicator updates | ☐ |
| AD-9 | Orders → change an order's status (e.g. placed → shipped) | Status updates; reflected in customer's order history | ☐ |
| AD-10 | Reviews → approve / reject a pending review | Moderation persists; product rating recomputes | ☐ |
| AD-11 | As a **non-admin**, attempt any of the above writes via REST | Denied (`403`) by `firestore.rules` — admin-only writes (ties to SC-1/SC-5) | ☐ |

> **Why this section exists:** the initial QA only verified the admin dashboard
> *rendered*; it never saved anything. The product-edit save crashed on `undefined`
> Firestore fields (`gallery`, `photoGallery`, etc.), and `couponsApi.upsert` had the
> same latent bug. Both are fixed — AD-2…AD-7 are the regression checks.

---

## Sign-off

| Section | Pass | Fail | Notes |
|---------|------|------|-------|
| 0 Pre-flight | | | |
| 1 Auth | | | |
| 2 Catalogue/Search | | | |
| 3 PDP | | | |
| 4 Cart | | | |
| 5 Checkout | | | |
| 6 Account/Orders | | | |
| 7 Responsive | | | |
| 8 Security | | | |
| 9 Admin CRUD | | | |

**Release decision:** ☐ Go ☐ No-go — _________________  **Tester:** _______  **Date:** _______
