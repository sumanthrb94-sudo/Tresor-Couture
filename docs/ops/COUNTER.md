# The counter — billing walk-in sales

Scan a label, take the payment, hand over a GST invoice. Stock drops by itself,
and the sale lands in Orders and Billing beside the website's.

**Admin → Counter.**

---

## What you need

| Item | Cost |
|---|---|
| USB barcode scanner, wired | ₹1,200–2,500 |
| A4 label sheets, 63.5 × 38.1 mm, 24 per sheet | ~₹200 per pack |
| Software | none — no library, no subscription |

A USB scanner is a **keyboard**. It types the code and presses Enter. There is
no driver to install and no app to pair. That is why the whole till is one
always-focused input, and why typing a code by hand works exactly the same when
a label is scuffed.

A thermal printer (₹8–15k) is a later decision. Print on paper first and see
whether it actually bothers you.

---

## Before the first sale

1. **Barcodes.** Every product needs one. A bulk import assigns them
   automatically; for products added through the admin console, run
   `npx tsx scripts/assign-barcodes.ts --prod`.
2. **Print ONE label and scan it.** Do this before printing the rest. The
   barcodes are generated in-house — Code 128-B, no third-party library — and a
   scanner disagreeing with the encoder is the one failure that unit tests
   cannot rule out. Admin → Inventory → **Print labels**.
3. Confirm the Counter finds the piece when you scan it. Then print the others.

---

## Ringing up a sale

1. Scan. The piece joins the ticket at its catalogue price.
2. Scan it again for a second unit — that is how a counter actually works. The
   till refuses to go past what is in stock.
3. Pick **Cash / UPI / Card**. There is no "cash on delivery" — the piece is
   handed over as it is paid for.
4. Customer name and phone are optional; they print on the invoice.
5. **Complete sale.** The invoice appears, ready to print or save as PDF.
6. **Next sale** clears the till.

Coupons are not applied at the counter. Discounting a walk-in is a
conversation, not a code.

---

## What happens behind the till

**The till never decides a price.** It sends product ids and quantities;
`/api/pos/sale` recomputes every rupee from the catalogue. The figure on screen
is the operator's guide, and the server's figure is what is charged.

**Nothing is shipped, so nothing is charged for shipping** — the same pricing
function the website uses, told this is a counter sale.

**Stock and the order move together**, in one transaction. An order can never
exist without its stock having been taken, so there is nothing to reconcile
afterwards.

**Pressing the button twice does not charge twice.** Each ticket carries one
key; submitting it again reprints the same invoice. If the connection drops
mid-sale, press it again — that is the correct thing to do.

**The sale belongs to no customer account.** It records which admin rang it up,
for the audit trail, and nothing more. It never lands in anyone's personal order
history.

**The invoice reads CGST + SGST**, not IGST. Goods handed across the counter
are supplied at the studio, which makes the sale intra-state. That follows from
where the studio is, so the server fixes it and the operator cannot change it.

---

## Sell laces first, not lehengas

The GST rate question is still open with the CA, and the counter prints a tax
invoice a customer keeps — a wrong rate there is a compliance problem, not a
display bug.

* Laces and trims are **fabric (Chapter 58) at 5%** regardless of value, which
  is what the system applies. Almost certainly correct.
* The ₹35,999 lehengas likely attract **18%**, above the ₹2,500 per-piece
  threshold. The system currently says 5%.

Sell a lehenga at the counter once the CA confirms. The counter shares its
pricing with the website deliberately, so when the rates land, **one change
corrects both**.

---

## When something goes wrong

| What you see | What it means |
|---|---|
| *Nothing in the catalogue matches "…"* | The label is not in the system. Search for the piece in Inventory and check its barcode. |
| *Only N left of …* | The shelf disagrees with the ticket. Fix the quantity, or correct the stock in Inventory. |
| *Already rung up — reprinting* | This ticket was already completed. Nothing was charged again. |
| *The counter is not configured…* | The deployment has no Firebase service-account credentials. |
| *This account is not an admin* | Only an admin account can ring up a sale. |

If the studio wifi drops, billing stops. That is acceptable for a trial and
worth revisiting before the counter becomes the main till.

---

## Known limitation

Invoice numbers derive from the order id rather than a consecutive series. This
predates the counter but is more visible now that the paper is handed across a
counter. Worth raising with the CA.

---

## Files

| Path | What it is |
|---|---|
| `api/pos/sale.ts` | The sale endpoint: identity, pricing, stock, idempotency. |
| `src/pages/admin/AdminCounter.tsx` | The till. |
| `src/lib/pos.ts` | Barcode lookup and the sale call. |
| `src/lib/barcode.ts` | The Code 128-B encoder. |
| `src/admin/printLabels.ts` | Label sheets. |
| `tests/emulator/pos-sale.spec.ts` | Pricing, security and idempotency, against the real handler. |
