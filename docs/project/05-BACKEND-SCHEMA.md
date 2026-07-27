# 05 — Backend Schema · Data Model & Auth Architecture

> Firestore (document store), not SQL. Field shapes come from `src/types.ts`;
> access control comes from `firestore.rules`, which is **the** security
> boundary — the browser writes to Firestore directly.

---

## Collections

| Collection | Doc id | Purpose |
|---|---|---|
| `users/{uid}` | Firebase Auth uid | Profile, role, default address |
| `products/{id}` | catalogue id | Fabric/garment catalogue incl. `stock` |
| `orders/{orderId}` | generated | Orders. **Server-created only.** |
| `carts/{uid}` | uid | Persisted cart |
| `coupons/{CODE}` | uppercase code | Discount codes (looked up by doc id) |
| `returns/{RET-XXXX}` | generated | RMA requests |
| `chats/{orderId}` | **orderId** | One support conversation per order |
| `chats/{orderId}/messages/{id}` | generated | Messages, ascending by `createdAt` |
| `crm/{uid}` | customer uid | Admin-only CRM overlay |
| `reviews/{id}` | generated | Product reviews |
| `consents/{id}` | generated | Cookie / marketing consent records (DPDP) |
| `admin_notifications/{id}` | generated | Operational notices |
| `config/{key}` | key | Runtime config |
| `mail/{id}` | generated | Outbound mail records |

## Key document shapes

**`users/{uid}`** — `uid`, `email`, `fullName`, `role: 'customer' | 'admin'`,
`defaultAddress?`, `createdAt`

**`products/{id}`** — `id`, `brand`, `name`, `description`, `price`, `mrp`,
`photo`, `photoGallery[]`, `image` (SVG swatch fallback), `category`,
`masterCategory`, `subCategory?`, `materialType?`, `tags[]`, `sticker?`,
`colors[{name,hex}]`, **`stock`**, `productCode?`,
`unitType: 'unit'|'per meter'|'bundle'`, `costPrice?`, `rating?`, `reviewCount?`

**`orders/{orderId}`** — `userId?` (absent for guest), `status`, `paymentMethod`,
`items[{ fabricId, quantity, color?, fabricSnapshot }]`, `subtotal`, `shipping`,
`tax`, `total`, `couponCode?`, `couponDiscount?`, `shippingAddress`, `placedAt`,
**`deliveredAt`** (serverTimestamp — the return window depends on it)

`status`: `placed → processing → shipped → delivered` (+ `cancelled`, `refunded`)

Line items embed a `fabricSnapshot` so order history and invoices stay correct
even if the product is later edited or deleted.

**`returns/{id}`** — `orderId`, `userId`, `items[{fabricId, quantity, reason}]`,
`resolution: 'refund'|'replacement'`, `reason`, `status`, `events[]`,
`refundAmount?`, `refundMethod?`, `adminNote?`, `trackingRef?`, `createdAt`

`status`: `requested → approved|rejected → pickup_scheduled → in_transit →
received → refunded|replaced → closed` (+ `cancelled`)

**`chats/{orderId}`** — `orderId`, `userId` (owner), `customerName?`,
`customerEmail?`, `status`, `lastMessage?`, `lastSenderRole?`,
`unreadForAdmin?`, `unreadForCustomer?`, `createdAt`, `updatedAt`

**`chats/{orderId}/messages/{id}`** — `text`, `senderId`, `senderRole:
'customer'|'admin'`, `createdAt`

**`crm/{uid}`** — `lifecycle`, `notes[]`, aggregates. Admin-only, read and write.

## Relationships

```
users/{uid} ──< orders (orders.userId)
            ──< returns (returns.userId)
            ──< chats   (chats.userId)
            ──1 crm/{uid}
            ──1 carts/{uid}

orders/{orderId} ──1 chats/{orderId}        (same id — that IS the relationship)
                 ──< returns (returns.orderId)
                 ──< items[].fabricId ──> products/{id}   (snapshotted, not joined)
```

## Auth model

- **Provider:** Firebase Auth, email/password.
- **Admin:** a custom claim `admin: true`, set out-of-band by
  `scripts/set-admin.ts`. It is *not* a field in `users` — a self-writable
  document could not be trusted. Rules check the claim.
- **API:** serverless endpoints verify the Firebase ID token via
  `verifyIdToken` and read `uid` / `email` from it. Never trust a uid in a body.

## Access rules — the shape that matters

Helpers in `firestore.rules`: `isSignedIn()`, `isAdmin()`, `isOwner(uid)`,
`orderIsReturnable(orderId)`, `chatOwner(orderId)`.

| Collection | Read | Write |
|---|---|---|
| `products` | **public** | admin only |
| `coupons` | public (needed to validate at checkout) | admin only |
| `users/{uid}` | owner or admin | owner (limited fields) or admin |
| `carts/{uid}` | owner | owner |
| `orders` | owner or admin | **create: nobody** (server/Admin SDK only); status transitions: admin |
| `returns` | owner or admin | create: owner, gated by `orderIsReturnable`; admin fields blocked on create; status: admin |
| `chats/{orderId}` | admin, or signed-in owner — **plus `resource == null`** | create: owner of the referenced order |
| `chats/*/messages` | parent chat's owner or admin | same |
| `crm/{uid}` | **admin only** | **admin only** |
| `consents` | admin | create: anyone (consent capture) |

Two subtleties worth preserving:

1. **`resource == null` on chat read.** Without it, the owner's "does this chat
   exist yet?" `getDoc` is denied on a non-existent document, so
   `ensureForOrder` can never create the chat and per-order chat is impossible.

2. **Return window is server-enforced.** `orderIsReturnable(orderId)` requires:
   caller owns the order **and** `status == 'delivered'` **and** `deliveredAt` is
   a timestamp **and** `request.time < deliveredAt + duration.value(7,'d')`.
   Because `deliveredAt` is written with `serverTimestamp()`, a client cannot
   forge its way back into the window. The UI mirrors this rule; the rule is what
   actually enforces it.

   Return creation additionally rejects any payload containing `refundAmount`,
   `refundMethod`, `adminNote` or `trackingRef` — a customer must not be able to
   set their own refund amount.

## Indexes

**None beyond Firestore's automatic single-field indexes**, and that is a hard
constraint (the available service account cannot create them). Every query is
single-field, or filtered on one field and sorted in JavaScript.

- `returnsApi.mine()` — filter by `userId`, sort client-side.
- `chatApi.subscribeMine()` — `where('userId','==',uid)`, `limit(200)`, sort client-side.

Adding an `orderBy` next to a `where` will throw a missing-index error in
production. Sort in JS instead.

## Sensitive data

| Data | Handling |
|---|---|
| Passwords | never stored — Firebase Auth |
| Payment instruments | never stored — Razorpay holds them; only ids/signatures pass through |
| Service account key | `FIREBASE_SERVICE_ACCOUNT` env var only; never in the repo |
| Legal registrations (GSTIN/PAN) | env vars — the repository is public |
| Customer PII (address, phone, email) | readable only by the owner and admins |

DPDP compliance: per-customer data export and erasure are available in Admin →
Customers.

## Server-authoritative operations

`POST /api/orders/place` is the only path that creates an order. It:

1. rejects disallowed origins, validates CSRF, method, rate limit;
2. verifies the Firebase ID token;
3. sanitises the shipping address (known fields only, length-capped);
4. **recomputes** every line price from `products` — the client's numbers are
   never trusted — including the COD surcharge and coupon;
5. checks and **decrements stock** transactionally, returning
   `insufficient_stock:<id>` if short;
6. writes the order with the Admin SDK (bypassing rules).

`deliveredAt` is stamped with `serverTimestamp()` when an admin marks an order
delivered — this is what makes the return window trustworthy.
