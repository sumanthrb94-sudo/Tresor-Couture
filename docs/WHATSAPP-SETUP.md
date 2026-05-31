# WhatsApp Setup (Tresor Couture)

**Owner:** CEO + Ops (account/templates), Eng (wiring). **Status today:** no WhatsApp integration exists — only a logo image (report §8).

> **START TODAY.** Number verification takes **1–3 days** and **every message template is reviewed individually (1–2 days each)**. None of that can be compressed, and it gates order/shipping notifications. Apply now regardless of which launch path you pick.

---

## 1. Choose: BSP vs Meta Cloud API direct

| Path | Pros | Cons | Recommendation |
|---|---|---|---|
| **BSP** (AiSensy / Interakt / Wati / Gupshup) | Fast onboarding, pre-built template UI, no-code flows, India support | Monthly fee + per-message markup | **Recommended for a 1-week launch** |
| **Meta Cloud API direct** | Lowest per-message cost, full control | More setup (Meta Business verification, dev work) | Better once volume is high |

This guide assumes a **BSP**. With Meta direct, the credential names differ (`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_BUSINESS_ACCOUNT_ID`) — Eng will confirm.

---

## 2. Procure (CEO + Ops)

1. Pick a BSP, sign up, choose a plan.
2. Provide a **dedicated business phone number** (one that is NOT already on the consumer WhatsApp app, or you'll have to delete that account first).
3. Complete **Meta Business verification** (business name, website, address) — the BSP guides this. **Lead-time: 1–3 days.**
4. Set the **display name** ("Tresor Couture") — Meta reviews this too.

---

## 3. Submit message templates for approval (each: 1–2 days)

Templates needed (utility category for transactional, so they can be sent without a 24h session window). Draft these and submit for review:

| Template | Trigger | Variables |
|---|---|---|
| `order_placed` | order created | name, order id, total |
| `order_shipped` | status → shipped | name, order id, tracking |
| `out_for_delivery` | dispatch | name, ETA |
| `order_delivered` | status → delivered | name, order id |
| `order_cancelled` / `refund` | status change | name, order id |

Keep copy in the brand voice (restrained, no exclamation marks). Avoid promotional language in *utility* templates or Meta will reject them.

---

## 4. Opt-in & compliance

- WhatsApp **requires explicit opt-in** before you message a customer. Capture it at checkout (a checkbox) and at the newsletter form — the `subscribers` collection already stores an optional WhatsApp number + `consent` field.
- Do not import/blast numbers without opt-in — it gets the number banned.

---

## 5. Hand back to Eng

| Credential (BSP example) | Notes |
|---|---|
| BSP **API key / token** | server secret |
| **Sender phone-number id** | identifies the WhatsApp number |
| Approved **template names** | Eng maps order events → templates |

Eng fires these from the same place transactional email is sent (`ordersApi.place` / `ordersApi.setStatus` in `src/lib/firebase.ts`).

---

## Handback checklist

- [ ] BSP account created, plan chosen
- [ ] Business number verified + display name approved
- [ ] All transactional templates approved
- [ ] API key + phone-number-id handed to Eng
- [ ] Opt-in capture confirmed at checkout + newsletter
