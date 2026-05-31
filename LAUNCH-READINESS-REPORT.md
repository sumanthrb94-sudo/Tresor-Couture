# Tresor Couture — Launch Readiness Report
**Prepared for:** CEO · **Date:** 2026-05-31 · **Target launch:** ~1 week
**Scope reviewed:** website/storefront, catalog, payments, orders/inventory, 40-minute delivery & logistics, email (transactional + marketing), WhatsApp automation, end-to-end customer capture, scale & security for ~1,000–2,000 visitors/day.

---

## 1. Executive summary — the honest verdict

What we have today is a **beautiful, well-built storefront demo**. What we do **not** have is a **transactionally real business**. The gap between those two is the whole report.

The single most important sentence: **the website cannot currently take money, cannot track stock, has no 40-minute delivery system, has no WhatsApp, and its email is not switched on — and the current free-tier backend will run out of quota before lunchtime at 1,000–2,000 visitors/day.**

**Recommendation: do not launch the full vision (storefront + 40-min delivery + ops) in one week.** It is not buildable or safe in that window. Instead run a **phased launch**:

- **Phase 0 (this week) — "Capture, don't transact":** Put up the storefront as a **brand + waitlist + lookbook** site with working email/WhatsApp capture and real payments *only if* we wire a gateway (see §4). Drive the 1–2k/day traffic into a captured audience instead of a broken checkout.
- **Phase 1 (week 2–4) — "Real commerce":** Real payment gateway, inventory control, transactional email/WhatsApp live, Blaze backend, catalog loaded.
- **Phase 2 (week 4–8) — "40-minute delivery":** Hyperlocal logistics in one pincode cluster (Hyderabad), rider/courier integration, live order tracking.

Launching a checkout that *looks* real but takes fake payments and oversells one-of-a-kind ₹40k–₹3.8L pieces to 2,000 people/day is the one outcome that turns a great launch into refunds, chargebacks, and reputational damage.

---

## 2. Go / No-Go scorecard

| Area | Status | Launch-blocking? |
|---|---|---|
| Storefront UI / browsing / cart | 🟢 Works well | No |
| Auth (email, Google, phone OTP) | 🟢 Strong | No |
| Catalog data | 🟡 34 demo SKUs, stock photos, "per-meter" pricing on stitched garments, **Lace empty** | Yes (content) |
| **Payments** | 🔴 **100% fake / demo** — no gateway, no money moves | **YES — hard blocker** |
| **Inventory / stock control** | 🔴 No decrement, no reservation → **guaranteed overselling** | **YES** |
| Orders & admin console | 🟢 Functional (Firestore) | No |
| **40-minute delivery / logistics** | 🔴 **Does not exist** — only a banner slogan | YES (for that promise) |
| **Email — transactional** | 🟡 Built, **not switched on** (extension+SMTP not installed) | Yes |
| **Email — marketing / newsletter** | 🔴 Not built (MailerLite available, unused) | Yes (for capture) |
| **WhatsApp automation** | 🔴 **Does not exist** (only a logo image) | Yes (for the promise) |
| Customer capture (lead → CRM) | 🔴 Minimal; signup callout not wired to any list | Yes |
| **Backend scale for 1–2k/day** | 🔴 Firebase **Spark free tier — 50k reads/day cap**; will break | **YES** |
| Security (price tampering, admin gate) | 🔴 Totals computed client-side; admin gate is a passcode | **YES** |
| SEO basics (sitemap/robots/OG) | 🟢 Present | No |
| Analytics / Meta Pixel / GA | 🟡 To confirm in `index.html`; Pixel/GA appear absent | Yes (for capture) |

🟢 ready · 🟡 partial/needs work · 🔴 missing/blocking

---

## 3. What's actually built (the good news)

This is a real React 19 + Vite + TypeScript + Tailwind app on Firebase (Auth + Firestore) deployed to Vercel/Firebase Hosting. Genuinely solid pieces:

- **Storefront**: home with hero carousel, category strips, product rails, mega-menu, search, product pages with galleries/reviews, cart, wishlist, account, "Customise" flow, order confirmation + receipt. Myntra-style polish.
- **Auth**: email/password, Google (popup→redirect fallback), **phone OTP with reCAPTCHA**, branded password-reset and a custom action handler. This is the most mature part of the codebase.
- **Admin console**: dashboard, product CRUD, order management (mark processing/shipped/delivered), coupons, review moderation, plus a brand-kit page. Admin writes are correctly gated by a real Firebase custom claim (`admin: true`).
- **Branding**: extremely complete — logos, favicons, full social kit (50-piece Instagram set, FB/Twitter/LinkedIn/Pinterest/YouTube covers), OG images, fonts, brand guide. Marketing-ready visually.
- **Order pipeline**: orders persist to Firestore with server timestamps; an in-app admin notification fires on each new order; branded HTML order-confirmation and status emails are written and ready (see §7).

**Bottom line:** the front-of-house is genuinely good. Everything that involves *money, stock, fulfilment, and outbound messaging* is the gap.

---

## 4. Payments — 🔴 hard blocker

**Finding:** Checkout is a **demo**. In `src/components/PaymentModal.tsx` the "payment" is a 2.5-second spinner (`setTimeout`) that then writes the order to Firestore. The UI literally says *"Demo — no actual gateway call,"* *"No real funds move,"* and the checkout page shows *"Demo checkout — no real charges."* Card, UPI, and COD are all simulated. There is **no Razorpay/Stripe/PayU/Cashfree**, no payment capture, and **no server-side verification** (the app has no backend at all — see §10).

**Why it's critical at 1–2k/day:** anyone can "buy" a ₹3.8-lakh couture gown for free; you'll be fulfilling (or disappointing) orders that were never paid. Worse, totals are computed in the browser (§10), so even a real gateway bolted on naively could be charged a tampered amount.

**What's needed:**
1. Integrate a real Indian gateway — **Razorpay** is the natural fit (UPI + cards + COD + netbanking, strong India support). Cashfree/PayU are alternatives.
2. Because there's no backend, add a **minimal server** for the two things that *must* be server-side: (a) creating the payment order with the **authoritative amount**, (b) verifying the gateway signature/webhook before marking an order paid. Options: a single **Vercel serverless function** (we already deploy on Vercel), **Firebase Cloud Functions** (requires Blaze — which you need anyway, §9), or **Supabase Edge Functions** (Supabase is already connected to this workspace).
3. COD: gate it by order value and serviceable pincode; keep the ₹50 COD surcharge already coded.

**Effort:** 3–5 focused days incl. testing. This is the long pole. Nothing else matters if checkout isn't real.

---

## 5. Catalog — 🟡 content blocker

**Finding:** There are **34 demo products** hardcoded in `src/constants.ts` (not yet your real catalog — matches your note). They seed into Firestore via an admin "seed" action. Issues to resolve before launch:

- **Stock photography / swatches**, not your actual product shots. Brand perception for a luxury label depends on this.
- **"Per-meter" pricing model applied to finished garments.** The data model (`pricePerMeter`, `inStockMeters`, length pills) makes sense for *fabric*, but sarees, lehengas, anarkalis, gowns, sherwanis are **finished pieces sold as one unit** — pricing/þquantity in "meters" will confuse customers and miscompute carts. Needs a per-unit product type.
- **"Lace" category is empty** (declared in the menu, zero products) → dead navigation link.
- **Limited stock on hero items**: several flagship pieces have `inStockMeters` of 1–6. With no stock decrement (§6), these *will* oversell.

**What's needed:** load the real catalog with real photography, introduce a unit-priced product type for stitched garments, fill or hide "Lace," and set true stock counts. **The Shopify and Meta-Ads-Catalog integrations connected to this workspace can host/feed the catalog** if you'd rather not hand-maintain it in Firestore.

**Effort:** depends entirely on how many real SKUs/photos you have ready. The engineering (unit-priced type) is ~1 day; the merchandising is yours.

---

## 6. Inventory & orders — 🔴 blocker (overselling)

**Finding:** Orders are stored correctly, but **stock is never decremented and never reserved**. Two customers (or 200) can buy the same one-of-one piece. There's also no low-stock alerting and no back-order handling. For a catalog full of limited/heirloom pieces at 1–2k visitors/day, this is a certainty, not a risk.

**What's needed:** atomic stock decrement on successful payment (a Firestore transaction or the same serverless function that verifies payment), "sold out" states, and optional short-lived cart reservations for scarce items.

**Effort:** ~1–2 days, best done together with the payment server (§4).

---

## 7. Email — 🟡 transactional built-but-off · 🔴 marketing missing

**Transactional (order confirmations, status updates, auth):**
- The code is **ready**: branded HTML for order confirmation and every status change (processing/shipped/delivered/cancelled/refunded), enqueued to a Firestore `mail/` collection.
- **But it won't send** until the **Firebase "Trigger Email from Firestore" extension + an SMTP provider (SendGrid/Brevo/Mailgun)** is installed and configured in the console. That extension also needs the **Blaze plan**. Until then, zero emails go out.
- Auth emails (verify/reset) go through Firebase templates and are branded.

**Marketing / newsletter / lifecycle (welcome series, abandoned cart, win-back):**
- **Not built.** There's a `SignupCallout` component but no evidence it persists subscribers to any list/CRM.
- **Good news:** **MailerLite is already connected to this workspace.** We can wire newsletter capture → MailerLite, build a welcome automation, an abandoned-cart flow, and launch/promo campaigns directly. This is the highest-ROI capture lever for 1–2k/day of traffic.

**What's needed (this week):** (1) turn on transactional email (extension + SMTP), (2) wire the signup/footer/checkout capture to MailerLite, (3) build a Welcome + Launch automation. **Effort: 1–2 days.**

---

## 8. WhatsApp automation — 🔴 missing

**Finding:** There is **no WhatsApp integration** anywhere in the code — only a `whatsapp-business-640.png` image asset. No WhatsApp Business/Cloud API, no order/shipping notifications, no opt-in capture, no chatbot.

For an India D2C launch promising fast delivery, WhatsApp is arguably more important than email for transactional updates (order placed, out for delivery, delivered) and for re-engagement.

**What's needed:**
- A **WhatsApp Business Platform (Cloud API)** account via Meta, or a BSP (**Gupshup, AiSensy, Interakt, Wati, Twilio**) for faster setup and pre-approved templates.
- Opt-in capture at checkout, plus order/shipping/delivery template messages fired from the same place transactional email is sent.
- Optional: a "shop on WhatsApp" / catalog + click-to-WhatsApp button on the site for high-intent buyers.

**Effort:** 2–3 days *after* a BSP/Meta number is approved (template approval can itself take a few days — **start the account application today** regardless of launch scope).

---

## 9. 40-minute delivery, operations & logistics — 🔴 does not exist

**Finding:** The "40-minute delivery" exists **only as a marketing slogan** (`OFFER_TICKER`: *"⚡ 40-MINUTE DELIVERY IN HYDERABAD ON DESIGNER WEAR"*). There is **no supporting system of any kind**:

- No **pincode / serviceability** check at checkout.
- No **hyperlocal/dark-store inventory** or store-location model (stock is a single global number).
- No **delivery-partner integration** (no Dunzo/Borzo, Shadowfax, Porter, Shiprocket, Delhivery, etc.).
- No **rider dispatch, ETA, or live tracking**. Checkout is a standard ship-to-address flow with flat ₹99 / free-over-₹1,999 shipping — i.e. a normal courier model, not 40-minute hyperlocal.

A 40-minute promise is **80% operations, 20% software**: it requires local stocked inventory, staffed packing within minutes, and an integrated last-mile fleet in a defined radius. None of that operational backbone is represented anywhere.

**What's needed (Phase 2):** pick **one** Hyderabad pincode cluster, stock a dark store, integrate a hyperlocal last-mile API (Borzo/Dunzo-for-business/Porter/Shadowfax), add serviceability + ETA + live tracking, and build the in-store fulfilment console. **Do not advertise 40-minute delivery until this exists** — change the banner copy for Phase 0/1 to avoid a promise we can't keep.

**Effort:** weeks, not days, and gated on operational setup (warehouse, staff, fleet contracts).

---

## 10. Backend, scale & security — 🔴 blockers for 1–2k/day

**Architecture today:** there is **no application backend**. The browser talks directly to Firestore on the **Spark (free) plan**; all business logic is client-side and "secured" by Firestore rules. The deploy guide states this explicitly.

**Scale problem (hard number):** Spark free tier allows **50,000 Firestore reads/day**. Browsing one shop page reads ~1 doc per product card. At **1,000–2,000 visitors/day** each viewing several category/product pages, you will exhaust the daily read quota within hours and **the site goes dark** for the rest of the day. **You must move to the Blaze (pay-as-you-go) plan before launch** (the deploy doc says the same). Blaze is cheap at this volume but **must be enabled** — and it's also the prerequisite for Cloud Functions and the email extension.

**Security problems:**
- **Client-side totals.** Order subtotal/tax/total are computed in the browser and the Firestore rule only checks `total ≥ 0`. A user can craft an order at an arbitrary price (e.g. ₹0). This **must** move server-side alongside the payment integration (§4).
- **Admin gate is a passcode** (`VITE_ADMIN_PASSCODE`) shipped to the browser — the code comments call it out as "NOT real security." (The *data* writes are protected by the real custom claim, so the exposure is mainly that admin tooling is discoverable, not that data is wide open — but tighten before launch.)
- **No stock guard** (§6) and **no rate limiting** (direct-to-Firestore) → vulnerable to abuse/scraping at scale.

**What's needed:** enable Blaze; add the serverless layer for pricing + payment verification + stock decrement; keep admin behind the custom claim only.

---

## 11. Customer capture & analytics — 🟡/🔴 (the thing you specifically asked about)

You expect 1–2k visitors/day. Right now that traffic would **leak away uncaptured**: checkout doesn't work, there's no newsletter wiring, no WhatsApp opt-in, and (to confirm in `index.html`) **no Meta Pixel / Google Analytics / GA4** — so we couldn't even retarget or measure them.

**Capture stack to stand up this week (high ROI, low effort):**
1. **Meta Pixel + Conversions API** on every page (the Meta Ads + Pixel tools are connected) → build retargeting audiences from day one.
2. **GA4** for funnel/measurement.
3. **Newsletter + WhatsApp opt-in** on home, footer, product, and exit-intent → into **MailerLite** (connected) and the WhatsApp BSP.
4. **"Notify me" / waitlist** on out-of-stock and pre-launch items → turns scarcity into a list.
5. **Welcome + abandoned-cart automations** (MailerLite + WhatsApp).
6. **Meta product catalog feed** (connected) for dynamic retargeting/Advantage+ shopping ads.
7. **Semrush** (connected) for launch keyword/SEO targeting.

SEO basics (sitemap.xml, robots.txt, OG images) are present, but the app is **client-rendered** — fine for paid/social-led launch, weaker for organic Google ranking until/unless we add SSR or pre-rendering (Phase 2 consideration).

---

## 12. Recommended plan to launch in one week (realistically)

**Decision needed from you:** do we launch **transacting** (must wire real payments + Blaze + stock + email — tight but possible if we start now and accept a slim catalog) or launch **capture-first** (brand/waitlist/lookbook with email+WhatsApp+Pixel, real checkout to follow in week 2)?

### If "capture-first" (lowest risk, recommended)
- **Day 1–2:** Change the 40-min banner to honest copy; enable Blaze; add Meta Pixel + GA4; wire newsletter + WhatsApp opt-in → MailerLite; build Welcome automation.
- **Day 2–4:** Load real catalog/photos as a browsable **lookbook**; "Notify me"/waitlist on every product; turn on transactional email infra (for the waitlist/welcome).
- **Day 4–5:** Start WhatsApp BSP/Meta number approval (runs in background); launch Meta/Instagram campaigns off the social kit + Pixel; Semrush-guided SEO.
- **Outcome:** capture 100% of the 1–2k/day as leads + retargetable audiences; sell via WhatsApp/manual order for high-intent buyers while real checkout is finished.

### If "transacting" (aggressive)
- **Day 1–3:** Razorpay + serverless order/verify + server-side totals + stock decrement.
- **Day 3–4:** Blaze + transactional email on; real catalog (slim, unit-priced); remove "Lace"/empty links.
- **Day 4–5:** Pixel/GA4 + MailerLite capture; abandoned-cart; QA the full money path end-to-end.
- **Defer:** 40-minute delivery (Phase 2) — ship via standard courier (Shiprocket/Delhivery) and **drop the 40-min claim** until §9 is real.

---

## 13. What I can start implementing now (tools already connected to this workspace)

Several of these gaps I can begin closing immediately using integrations already wired up here:

- **Email marketing & capture:** MailerLite — create lists, signup forms, Welcome + abandoned-cart + launch automations.
- **Catalog & ads:** Meta Ads product catalog/feed + Meta Pixel events; optionally Shopify to host the catalog.
- **SEO:** Semrush keyword/competitor/site-audit research for the launch.
- **Deploy/infra:** Vercel (project, serverless function for payments), Supabase (Edge Functions/DB as the server layer if we don't use Firebase Blaze functions).
- **Creative:** Canva/Figma/Adobe for any additional launch assets.

**Tell me which launch path you want (capture-first vs transacting), and which of these you want me to wire up first** — I'd start with (1) Meta Pixel + GA4 + MailerLite capture and the honest banner change, and in parallel kick off the WhatsApp number approval, since those unblock everything else and lose nothing whichever path we pick.

---

### Appendix — key evidence (file references)
- Fake payments: `src/components/PaymentModal.tsx` (setTimeout, "No real funds move"), `src/pages/CheckoutPage.tsx` ("Demo checkout — no real charges").
- No backend / free tier / scale caps: `DEPLOY.md` (Spark only, 50k reads/day, "No Cloud Functions", "Cloud Functions can wait").
- Client-side totals: `src/lib/firebase.ts` `ordersApi.place` (totals computed in browser); `firestore.rules` (total ≥ 0 only).
- 40-min is copy only: `src/constants.ts` `OFFER_TICKER`; flat shipping `SHIPPING_FLAT_RATE = 99`, `FREE_SHIPPING_THRESHOLD = 1999`.
- Email built-but-off: `src/lib/firebase.ts` `emailApi` (Firestore `mail/` + extension note).
- No WhatsApp in code: only `public/branding/social/whatsapp-business-640.png`.
- Catalog: `src/constants.ts` `FABRICS` (34 items), `MASTER_CATEGORY_TREE` (Lace declared, unpopulated).
- Admin gate: `.env.example` (`VITE_ADMIN_PASSCODE`, "NOT real security").
