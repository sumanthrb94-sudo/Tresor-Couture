# Analytics & Consent Setup (Tresor Couture)

**Owner:** CEO (accounts/IDs), Eng (wiring). **Status today:** no GA4, no Meta Pixel detected (report §11) — the expected 1–2k visitors/day are currently unmeasured and un-retargetable. Engineering is wiring the tags + consent; you supply the IDs.

---

## 1. GA4 (Google Analytics 4)

1. Go to https://analytics.google.com → **Admin → Create property**.
2. Property name "Tresor Couture", reporting time zone **(GMT+5:30) India**, currency **INR**.
3. Create a **Web data stream** for your site URL → copy the **Measurement ID** (`G-XXXXXXXXXX`).
4. Hand back: **`VITE_GA4_MEASUREMENT_ID`**.
5. (Recommended) Mark `purchase`, `begin_checkout`, `add_to_cart`, `sign_up`, and newsletter `generate_lead` as key events/conversions in GA4 once Eng confirms the event names they emit.

---

## 2. Meta Pixel

1. Go to https://business.facebook.com/events_manager2 → **Connect data sources → Web → Meta Pixel**.
2. Name it, create → copy the **Pixel ID** (numeric).
3. **Link the Pixel to your ad account** (Events Manager → Settings → Connected assets) — required for retargeting/Advantage+.
4. Hand back: **`VITE_META_PIXEL_ID`**.

Standard events Eng should fire (map to the same user actions as GA4): `PageView`, `ViewContent`, `AddToCart`, `InitiateCheckout`, `Purchase`, `Lead` (newsletter/WhatsApp opt-in).

---

## 3. Conversions API (CAPI) — plan now, wire after launch (P3)

iOS/ad-blockers drop browser pixel events; CAPI sends them server-side for accurate attribution.

1. Events Manager → your Pixel → **Settings → Conversions API → Generate access token**.
2. Hand back: **`META_CAPI_TOKEN`** (server secret).
3. Eng dedupes browser + server events via a shared `event_id`.

---

## 4. Consent (legal requirement for analytics/marketing)

- A **consent banner** must gate non-essential cookies/trackers (Pixel, GA4 marketing signals) before they fire — Eng is implementing this.
- Your **Privacy Policy** (see `MANUAL-ACTIONS.md` item 5 and footer links) must disclose GA4 + Meta Pixel + WhatsApp + email marketing and how users opt out. Hand the published Privacy Policy URL to Eng so the banner can link to it.
- For Indian users, align with the **DPDP Act** expectations (clear notice, withdrawable consent).

---

## 5. Optional, connected to this workspace

- **Meta product catalog feed** (Commerce Manager) for dynamic retargeting — P3, see `MANUAL-ACTIONS.md` item 24.
- **Semrush** for launch keyword/SEO targeting. Note: the SPA uses **hash routing** + client rendering (report Appendix B), so organic Google indexing is weak — analytics will show paid/social as the primary channels at launch.

---

## Handback checklist

- [ ] `VITE_GA4_MEASUREMENT_ID`
- [ ] `VITE_META_PIXEL_ID`
- [ ] Pixel linked to ad account
- [ ] Privacy Policy URL (for consent banner) provided
- [ ] (P3) `META_CAPI_TOKEN`
