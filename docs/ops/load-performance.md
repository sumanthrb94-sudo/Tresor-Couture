# Making every screen land in under two seconds

Measured against **production Firestore**, 22 September 2026. Every number
below came from reading the live database, not from an estimate.

---

## The headline

**A first-time visitor downloads 9.63 MB of Firestore before the shop grid can
paint. 99.4% of it is photographs, base64-encoded inside the product
documents.**

On a typical Indian 4G connection (~5 Mbps) that alone is **15–16 seconds**.
The target is 1.5–2 s. Nothing else in the stack is within an order of
magnitude of this, so this document is mostly about one problem.

---

## What was measured

### The catalogue — the whole storefront waits on this

```
products collection          103 documents
  all documents               9.63 MB   (images 9.57 MB · everything else 0.06 MB)
  heaviest single document      883 KB  (TC00083 Banarasi Lehanga choli)
  products with real photos      13
  products with swatch art       90
```

`CatalogContext` calls `productsApi.list({ limit: 1000 })` with no field mask
and no `where` clause, then filters drafts out **in the browser**. That choice
is deliberate and well-reasoned — a server-side filter would need a composite
index per category and would drop products written before `listingStatus`
existed — but it means all 103 documents cross the wire even though only 12 are
listed.

The text in those documents — name, price, category, stock, barcode — totals
**0.06 MB for all 103**. The other 9.57 MB is pixels.

### Orders — the same problem, growing

```
orders collection              8 documents      3.24 MB
  average order document                         414 KB
  of which fabricSnapshot                        99.8%
```

Each order line stores `fabricSnapshot: { id, ...product }` — the *entire*
product document, photographs included. An order for one dress is a 741 KB
document, of which 740 KB is a copy of a photograph that already exists three
feet away in `products/`.

Admin → Orders loads up to 200 of these: **~81 MB** at 200 orders.

### The home page pays twice

```
config collection              7 documents      0.81 MB
```

`loadHomeArt()` reads the whole `config` collection to find the six
`homeart-*` documents. Those six are category artwork — also inline base64.

### JavaScript — not the problem, but not free

```
initial load (6 chunks)     ~1,328 KB raw   ~367 KB gzipped
  vendor-firebase             600 KB raw     142 KB gzipped   ← largest
  vendor                      236 KB          81 KB
  index                       221 KB          61 KB
  vendor-react                195 KB          62 KB
  vendor-icons                 45 KB           9 KB
  vendor-motion                31 KB          11 KB
```

Roughly one second on 4G. Worth trimming, but it is 4% of the problem.

### Already correct — leaving alone

- `/assets/*` served `immutable, max-age=31536000`; `index.html` `no-store`.
- Fonts: `preconnect` + `display=swap` + async stylesheet, so they never block
  first paint.
- Route-level code splitting: Admin, Account, Checkout, Confirmation and
  Supplier Intake are all separate chunks already.
- `FabricImage` sets `loading` and `decoding="async"`.

---

## Why the usual image tricks cannot help yet

This is the part worth understanding before approving any of the work below.

`loading="lazy"`, responsive `srcset`, CDN caching, preloading, AVIF — **none
of them do anything while the images live inside the documents.** A data URI is
not fetched; it arrives as part of the JSON you already downloaded. The browser
cannot defer it, cannot skip it, cannot cache it separately, and cannot pick a
smaller variant. `FabricImage` already asks for lazy loading and gets nothing
for it.

So the first change is not an optimisation. It is the change that *makes*
optimisation possible.

---

## The plan

Ordered by effect per unit of risk. Each phase is independently shippable and
none of them changes what the site does.

### Phase 1 — move photographs out of the documents ⚡ the whole win

Upload each image to a CDN-backed store (Firebase Storage or Vercel Blob) and
store the URL in the product document instead of the bytes.

```
product document        ~800 KB  →  ~1 KB
catalogue query          9.63 MB  →  ~0.10 MB      (≈95× less)
```

Images then arrive as ordinary files: lazily, in parallel, from a CDN edge,
cached for a month by the headers already in `vercel.json`, and only the ones
on screen.

- Keep `photo`/`photoGallery` readable during the migration by accepting either
  a URL or a data URI, so no page needs changing on the same deploy.
- `FabricImage` already handles a plain URL — it takes `photo` and `fallback`
  strings and does not care what they contain.
- The SVG swatch placeholders (90 products) stay inline. They are ~1 KB and
  a network round trip would cost more than they weigh.

**Expected:** shop grid first paint from ~16 s to well under 1 s on 4G.

### Phase 2 — stop copying photographs into orders

`fabricSnapshot` exists so order history and receipts survive a product being
edited or deleted. That is the right intent; it just does not need the pixels.

Store what a receipt actually renders: `id`, `name`, `price`, `unitType`,
`barcode`, and **one thumbnail URL**.

```
order document     414 KB  →  ~2 KB
admin at 200        81 MB  →  ~0.4 MB
```

> **This is also a latent functional failure, not only a slow page.** Firestore
> caps a document at 1 MiB. Two photographed items in one order come to
> 1.3–1.8 MB of snapshot — TC00083 (883 KB) plus TC00078 (871 KB) is 1.75 MB —
> so **that order cannot be written at all**; `/api/orders/place` would return
> `place_failed`. Single-item orders squeak under the cap, which is why every
> order placed so far has worked. This is arithmetic from measured document
> sizes, not a reproduced failure — worth confirming with a deliberate two-item
> order before or during this phase.

### Phase 3 — ask for less, and later

- **Field-mask the grid query.** A product card renders name, price, category,
  stock and one image. Fetch those, not 40 fields. (Small once Phase 1 lands,
  but it also caps future growth.)
- **Paginate.** 103 products is fine; 1,000 is not. The `limit: 1000` is a
  cliff with nothing behind it.
- **Load `config` by document id.** `loadHomeArt()` reads the whole collection
  to find six known ids. Read the six.

### Phase 4 — trim the JavaScript

- **Defer `vendor-firebase` (142 KB gzip).** The home page renders from the
  catalogue; Auth and the realtime listeners are not needed for first paint.
  Dynamic-import the Firestore SDK so it lands in parallel with content rather
  than ahead of it.
- **Check `vendor` (81 KB gzip)** for anything pulled in whole where a
  sub-import would do.

**Expected:** ~367 KB → ~200 KB gzip on first load.

### Phase 5 — stop the layout shifting

`FabricImage` has no intrinsic `width`/`height`, so cards resize when each
image arrives. That is not load time but it reads as slowness, and every
image is already a known 3:4. Set the attributes and the space is reserved
before the pixels land.

---

## What this will not touch

No change to what any screen does, what any button means, what is stored about
an order, or who may read it. Specifically untouched: `firestore.rules`,
pricing, the payment handlers, the review gate, stock arithmetic, and the
lace unit/bundle logic.

Phase 2 changes the *shape* of `fabricSnapshot`. Receipts and order history
must render identically from the smaller object, and the emulator suite's
order fixtures will need the same shape.

---

## How this gets verified

The suite already drives the whole journey, so the measurement rides along
rather than being a separate exercise:

- `entry-to-exit.spec.ts` walks browse → bag → checkout → order → deliver →
  return. Record transfer size and time-to-interactive at each step, before and
  after, and fail the test if any screen exceeds 2 s.
- The numbers in this document were produced by a script reading production
  Firestore. Re-running it after each phase is the proof the phase worked.
- `npm run test:emulator` (54 tests) must stay green throughout — that is what
  makes "without touching functionality" checkable rather than a promise.
