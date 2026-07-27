# End-to-end test reports

Downloadable PDF evidence for every automated end-to-end test. Each PDF is
self-contained — screenshots are embedded, so nothing else is needed to read it.

**Start with [`00-INDEX.pdf`](./00-INDEX.pdf)** for the summary of all tests.

## Coverage

### Admin console — every section (13)

| Report | Section |
|---|---|
| [`admin-01-dashboard.pdf`](./admin-01-dashboard.pdf) | Dashboard — revenue, orders, low-stock |
| [`admin-02-products.pdf`](./admin-02-products.pdf) | Products catalogue |
| [`admin-03-inventory.pdf`](./admin-03-inventory.pdf) | Inventory + stock controls |
| [`admin-04-orders.pdf`](./admin-04-orders.pdf) | Order queue + search |
| [`admin-05-returns.pdf`](./admin-05-returns.pdf) | Returns & refunds queue |
| [`admin-06-billing.pdf`](./admin-06-billing.pdf) | Billing & finance |
| [`admin-07-customers.pdf`](./admin-07-customers.pdf) | Customers / CRM roster |
| [`admin-08-support.pdf`](./admin-08-support.pdf) | Support inbox |
| [`admin-09-coupons.pdf`](./admin-09-coupons.pdf) | Coupons |
| [`admin-10-reviews.pdf`](./admin-10-reviews.pdf) | Reviews moderation |
| [`admin-11-compliance.pdf`](./admin-11-compliance.pdf) | Legal & compliance |
| [`admin-12-delivery.pdf`](./admin-12-delivery.pdf) | Delivery settings |
| [`admin-13-bulk-email.pdf`](./admin-13-bulk-email.pdf) | Bulk email composer |

### Admin workflows — operations that change data (6)

| Report | Workflow |
|---|---|
| [`admin-w1-create-coupon.pdf`](./admin-w1-create-coupon.pdf) | Create a discount code and see it persist |
| [`admin-w2-adjust-stock.pdf`](./admin-w2-adjust-stock.pdf) | Adjust inventory; change survives reload |
| [`admin-w3-order-search.pdf`](./admin-w3-order-search.pdf) | Search the order queue; empty result on no match |
| [`admin-w4-crm-detail.pdf`](./admin-w4-crm-detail.pdf) | Open a customer's consolidated CRM record |
| [`admin-w5-compliance-validation.pdf`](./admin-w5-compliance-validation.pdf) | Legal validation refuses to pass placeholders |
| [`admin-w6-realtime-chat.pdf`](./admin-w6-realtime-chat.pdf) | **Customer and admin live concurrently**, messaging in real time both ways |

The customer journey (storefront → cart → account → chat → returns) is covered
separately at desktop and mobile viewports by `full-e2e.spec.ts` /
`full-e2e-mobile.spec.ts`, which capture 22 screenshots each.

## Environment

Every test runs against the **Firebase Emulator Suite**, which loads the real
production `firestore.rules`. A change that weakens authorization, breaks the
7-day return window, or leaks one customer's data to another fails these tests.

## Regenerate

```bash
npm run emulators                 # terminal 1
npm run seed:emulator:full        # terminal 2, with emulator host env vars
npm run build && npm run preview -- --port 4173 --host 127.0.0.1
npm run test:emulator             # terminal 3 — runs everything
npm run report:pdf                # rebuild these PDFs
```

Full setup detail is in the repository `README.md` → Tests. Each PDF also
carries its own "Reproduce manually" section so a human can walk the same path
without Playwright.
