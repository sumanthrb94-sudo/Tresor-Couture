# 03 — App Flow · Navigation & User Journey Map

> Routes are **hash-based** (`#/shop`, `#/product/12`). Parsing and URL building
> live in `src/context/RouterContext.tsx` — that file is the authoritative route
> table; this document describes it.

---

## Pages

### Storefront (public)

| Route | Screen |
|---|---|
| `#/` | Home — hero, collections, featured weaves |
| `#/shop` · `#/shop?category=X&subcategory=Y` | Catalogue grid with filters |
| `#/search?q=…` | Search results (empty `q` → not-found) |
| `#/product/:id` | Product detail — gallery, colours, quantity, add to bag |
| `#/cart` | Bag — quantities, coupon, totals |
| `#/checkout` | 3-step checkout (see below) |
| `#/confirmation/:orderId` | Order placed |
| `#/login` · `#/register` | Auth |
| `#/privacy` `#/terms` `#/refund` `#/shipping` `#/cookies` `#/contact` | Policy pages |
| *(unmatched)* | Not found |

### Account (requires sign-in)

`#/account/:tab` where tab ∈ `profile` · `orders` · `returns` · `wishlist` · `addresses`

### Admin (requires sign-in **and** the `admin: true` custom claim)

`#/admin/:section` where section ∈ `dashboard` · `products` · `inventory` ·
`orders` · `returns` · `billing` · `customers` · `support` · `coupons` ·
`reviews` · `compliance` · `delivery` · `bulk-email`

Plus `#/admin/brand-kit`. Access is gated by `AdminGuard`; a non-admin hitting an
admin route does not see admin data — and cannot, because the Firestore rules
deny it regardless of the UI.

## Navigation structure

- **Desktop:** top navbar with category mega-menu, search, wishlist, cart, account.
- **Mobile:** the navbar collapses to a hamburger + search, and a **fixed bottom
  tab bar** provides Home · Shop · Account. The Account tab opens a full-screen
  slide-in panel (profile, orders, wishlist, addresses, admin console if admin,
  sign out). A **floating cart FAB** appears bottom-right when the bag is
  non-empty, anchored above the bottom nav and the device safe-area inset.
- **Admin on desktop:** persistent left sidebar listing all 13 sections.
- **Admin on mobile:** the sidebar collapses to a **disclosure button** naming the
  current section; tapping it expands a 2-column grid of all sections. The Support
  unread count is shown on the collapsed button so it is visible without expanding.

## Entry point

A brand-new visitor lands on `#/` fully browsable — catalogue, product pages,
cart and wishlist all work signed-out. A cookie/marketing consent banner appears
on first visit ("Essential only" / accept).

## Auth flow

```
#/register → create account (Firebase Auth) → user doc written → #/
#/login    → sign in → returns to the page you came from (or #/)
Password reset → Firebase emails a link → /auth/action handler page
```

Sign-in is required for: checkout completion, order history, **returns**, and
**chat**. Everything else is open.

Admin is *not* a separate login — it is the same account carrying the `admin`
custom claim, set out-of-band via `scripts/set-admin.ts`.

## Core journey 1 — browse to placed order

```
#/ → #/shop → #/product/:id
   → choose colour + quantity → Add to Bag  (blocked if out of stock)
   → cart FAB / #/cart → apply coupon → Checkout
#/checkout
   Step 1 Login      — sign in, or continue as guest
   Step 2 Address    — validated; a saved default address is offered with
                       "Use a different address"
   Step 3 Payment    — Cash on Delivery (UPI and Card render as "Coming soon")
   → PLACE ORDER
      → POST /api/orders/place   (server recomputes price, decrements stock)
      → order confirmation email via Brevo (fire-and-forget)
      → #/confirmation/:orderId
```

The client **cannot** write an order document — the rules deny it. If
`FIREBASE_SERVICE_ACCOUNT` is missing the endpoint returns `503
orders_not_configured` and checkout shows *"Checkout is not fully configured
yet."*

## Core journey 2 — per-order chat (real time, both directions)

```
Customer: #/account/orders → CHAT on an order
   → chatApi.ensureForOrder(orderId)   (idempotent; creates chats/{orderId})
   → type + Enter → message appears immediately
Admin:    #/admin/support → conversation list (badged) → open thread
   → sees the message live → types reply
Customer: sees the reply live, no reload.
          If the chat is closed, the order's CHAT button shows an unread count.
```

Chat is keyed by **orderId**, not by user — so support always has the order in
context. Creating a chat requires owning the referenced order.

## Core journey 3 — return / refund

```
Customer: #/account/orders → an order that is DELIVERED and inside the 7-day window
   → RETURN → modal: pick line items + quantities, reason, resolution
              (refund | replacement)
   → submit → RET-XXXXXXXX created, status `requested`
   → visible under #/account/returns; can be withdrawn while still `requested`
Admin:    #/admin/returns → queue with totals
   → requested → approved | rejected
              → pickup_scheduled → in_transit → received
              → refunded | replaced → closed
```

The 7-day window is **enforced in `firestore.rules`** against a server-stamped
`deliveredAt`, not just hidden in the UI. Outside the window the button is
replaced by "Return window closed". Refund **money movement is manual** — the
system records the state, the operator pays out.

## Core journey 4 — call

The Call action is a plain `tel:` link to the atelier number
(`+91 63042 11922`). It opens the native dialer; the call is a normal cellular
call logged in the phone's own history. No backend, no callback queue, no
third-party telephony.

## Empty states

| Where | Shows |
|---|---|
| Orders | "No orders yet" + shop CTA |
| Returns | "No returns yet" |
| Wishlist | empty prompt |
| Chat thread | "Ask us anything about this order — delivery, changes, returns." |
| Admin returns / support | empty queue |
| Product image missing | inline SVG placeholder — `FabricImage` resolves `photo → fallback → placeholder`, so a broken-image icon can never reach a customer |

## Loading and error states

- Skeleton rows for orders and returns while loading.
- Data-fetch failures render an inline message with a **Try again** button.
- Checkout maps API failures to plain language (`orders_not_configured` →
  "not fully configured"; `insufficient_stock:` → "one or more items just went
  out of stock").
- Email and WhatsApp notifications are fire-and-forget — a failure there never
  blocks or fails an order.

## Modals and overlays

`OrderChatModal` and `ReturnModal` are full-screen on mobile / centred on
desktop, both lock body scroll while open (`useBodyScrollLock`) so scrolling
inside them does not chain to the page behind.

## Redirects

| Action | Destination |
|---|---|
| After login | back to the originating page, else `#/` |
| After logout | `#/` |
| After placing an order | `#/confirmation/:orderId` |
| After submitting a return | `#/account/returns` |
| Non-admin at an admin route | blocked by `AdminGuard` (and by rules) |
| `#/product` with no id | `#/shop` |
| `#/confirmation` with no id | `#/` |
| `#/search` with empty query | not-found |
