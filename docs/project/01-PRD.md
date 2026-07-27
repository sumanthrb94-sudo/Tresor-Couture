# 01 — PRD · Product Requirements Document

> **Status:** reverse-documented from the shipped codebase (not a pre-build spec).
> Treat this as the source of truth for *what* Tresor Couture is. If code and this
> document disagree, the code is right and this document is stale — fix it.

---

## App name and tagline

**Tresor Couture** — *Heritage craftsmanship, modern elegance.*

A direct-to-consumer storefront for hand-woven Indian designer fabrics and
garments (fabrics, laces, sarees, lehenga cholis, anarkalis, western wear),
shipped across India from a Hyderabad atelier.

## Problem

Buyers of heritage handloom textiles are stuck between two bad options: dusty
local wholesalers with no provenance or returns, and generic marketplaces where
hand-woven Mashru silk sits next to mass-produced polyester with no way to tell
them apart. Sellers, in turn, run the business over WhatsApp screenshots — no
order history, no returns process, no record of who asked what.

The atelier needed a storefront that treats provenance as a first-class product
attribute, and a back office that replaces the WhatsApp thread.

## Core value proposition

Every piece is traceable, priced transparently with GST-compliant invoicing, and
backed by a real returns window and a support conversation attached to the
specific order it concerns — not a generic inbox.

## Target user

**Primary — the occasion buyer.** Indian women aged 25–55, buying for a wedding,
festival, or a commissioned outfit. Spends ₹3,000–₹50,000 per order. Shops on a
phone, often at night. Cares about fabric authenticity and whether the colour in
the photo is the colour that arrives. Wants a human to answer before and after
buying.

**Secondary — the atelier operator (admin).** One or two non-technical staff who
need to see orders, mark them shipped/delivered, answer customer questions, and
approve returns without touching a database.

## Core features (Must Have) — all shipped

| Area | Capability |
|---|---|
| Catalogue | Browse by master category and sub-category, search, product detail with gallery, colour and quantity selection, stock-aware add-to-cart |
| Cart & wishlist | Persistent cart, wishlist, coupon application |
| Checkout | Address capture with validation, saved default address, **Cash on Delivery**, server-authoritative pricing and stock decrement |
| Accounts | Email/password auth, profile, address book, order history with tracking, order cancellation |
| **Returns & refunds** | Customer-raised RMA per line item, reason + resolution (refund/replacement), 7-day post-delivery window enforced in security rules, admin queue with status workflow |
| **Per-order chat** | Real-time customer ↔ atelier messaging scoped to a single order, unread badges both directions |
| **Call** | `tel:` link to the atelier's number — native dialer, logged in the phone's own call history |
| **CRM** | Per-customer overlay: lifecycle stage, notes, lifetime spend, order and return timeline, CSV export |
| Admin console | Dashboard, products, inventory, orders, returns, billing, customers, support, coupons, reviews, compliance, delivery, bulk email |
| Compliance | GST tax invoices (CGST/SGST vs IGST by place of supply), policy pages, cookie/marketing consent capture, DPDP export & erasure |
| Transactional email | Order confirmation via Brevo |

## Nice to have (built but dormant, or deferred)

- **Online payments** — Razorpay create-order / verify / webhook endpoints exist and are tested, but the UI ships COD-only until keys are set. *Explicitly out of scope for the current release.*
- **WhatsApp order alerts** — endpoint exists, dormant until Meta Cloud API credentials are set.
- Bulk marketing email (admin-only Brevo campaigns) — built, lightly used.
- Reviews — schema and admin screen exist; storefront surfacing is minimal.

## Out of scope (this version explicitly does NOT do)

- Online card/UPI payment capture (COD only).
- Automated refund **money movement** — refunds are recorded in the system and paid out manually by the operator. Deliberate: the payment rail is out of scope.
- Product catalogue authoring as a product surface — the catalogue is seeded from an in-repo source and edited via the admin, not merchandised at scale.
- Multi-warehouse or multi-currency.
- Native mobile apps (the web app is mobile-first and responsive instead).
- Guest checkout for chat/returns — those require sign-in by design.

## User stories

- As a shopper, I want to see whether a fabric is actually hand-woven and in stock, so that I don't order something that never ships.
- As a shopper, I want to pay cash on delivery, so that I don't have to trust a new store with my card.
- As a buyer whose order arrived wrong, I want to raise a return on just the affected item within the return window, so that I'm not stuck with it.
- As a buyer, I want to ask about *this specific order* and get an answer in the same thread, so that I don't have to re-explain which order I mean.
- As a buyer, I want to see when the atelier has replied, so that I don't have to keep checking.
- As the operator, I want one screen showing every open return and its status, so that nothing sits unanswered.
- As the operator, I want to see a customer's whole history — orders, returns, notes — before I reply to them.
- As the operator, I want a GST-correct invoice generated for every order without doing anything.

## Success metrics

- A COD order can be placed end-to-end and the buyer receives a confirmation email. **(verified in production)**
- A return raised by a customer appears in the admin queue within seconds, and is actionable through to `refunded`/`replaced`.
- A chat message is delivered between customer and admin in real time with no page reload. **(verified: two-party E2E, both directions)**
- No customer can read another customer's orders, chats, or returns. **(enforced in `firestore.rules`; verified by E2E and API security suite)**
- Admin console is fully usable on a phone. **(verified: 390×844 E2E walkthrough)**

## Known gaps at time of writing

- Legal registration values (`VITE_LEGAL_NAME`, `VITE_GSTIN`, `VITE_PAN`) must be set in the deployment environment before invoices are compliant. Admin → Compliance validates these and flags mismatches.
- Rate limiting is per-serverless-instance (in-memory) rather than global. Adequate for launch volume; set Upstash credentials to make it global.
- The E2E suites are run manually, not in CI.
