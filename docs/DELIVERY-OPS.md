# 40-Minute Delivery Operations (Tresor Couture)

**Owner:** Ops (lead), Eng (serviceability/tracking code). **Status today:** the "40-MINUTE DELIVERY IN HYDERABAD" promise exists **only as banner copy** (`OFFER_TICKER` in `src/constants.ts`). There is **no supporting system at all** (report §9):

- No pincode / serviceability check (the pincode inputs on Cart/Product pages are decorative — Appendix B).
- No dark-store / hyperlocal inventory (stock is a single global number).
- No last-mile partner integration; checkout is flat-rate courier shipping (₹99, free over ₹1,999).
- No rider dispatch, ETA, or live tracking ("Out for Delivery" in the tracker never lights up — Appendix B).

**A 40-minute promise is ~80% operations, 20% software.** This is weeks, not days, and gated on physical setup. **Do NOT advertise 40-minute delivery until everything below is live and tested.**

---

## The explicit launch instruction

Until #1–#4 below are operational, instruct Eng to **change the banner copy** to something honest (e.g. "Same-day delivery in select Hyderabad areas" or remove the time claim). Advertising a 40-minute promise you can't keep invites refunds, complaints, and reputational damage on a luxury brand.

---

## 1. Define the serviceable zone (Ops, ~1 day)

- Pick **ONE** Hyderabad pincode cluster around your dark store (40-min radius is small — think a few adjacent pincodes, not the whole city).
- Produce the **serviceable pincode list** → hand to Eng for the checkout serviceability check + ETA logic.

## 2. Stand up a dark store (Ops, days–weeks, lease/staffing lead-time)

- A stocked location inside the zone holding the sellable inventory.
- **Packing SLA:** staff must pick + pack within ~10 minutes of an order so the rider has ~30 minutes to deliver.
- Per-location inventory model (the current global stock count can't support hyperlocal — Eng change).

## 3. Sign a last-mile partner (Ops + Eng, contract days–weeks)

Hyperlocal on-demand couriers suited to a 40-min radius:

| Partner | Notes |
|---|---|
| **Borzo** (ex-WeFast) | On-demand point-to-point, good API |
| **Dunzo for Business** | Hyperlocal |
| **Porter** | 2-wheeler/3-wheeler on demand |
| **Shadowfax** | Hyperlocal + same-day |
| **Shiprocket** | Aggregator (more for standard courier than 40-min) |

Get **API credentials** for dispatch + tracking → hand to Eng (names vary by partner).

## 4. Build fulfilment + tracking (Eng, after 1–3)

- Serviceability check at checkout (real pincode lookup, not the decorative regex).
- ETA + live rider tracking; wire the "Out for Delivery" tracker state.
- In-store fulfilment console for packing staff.

---

## Fallback for launch (recommended)

Ship **standard courier** (Shiprocket / Delhivery) nationwide with the existing flat-rate model, **drop the 40-minute claim**, and treat hyperlocal delivery as a **Phase 2** rollout in the single chosen pincode cluster. This lets you launch commerce now without an undeliverable promise.

---

## Handback checklist

- [ ] Banner copy softened (no 40-min claim) until live
- [ ] Serviceable pincode list → Eng
- [ ] Dark store secured + packing SLA defined
- [ ] Last-mile partner signed + API credentials → Eng
- [ ] End-to-end delivery tested before any 40-min messaging goes live
