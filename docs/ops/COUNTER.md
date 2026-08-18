# The counter — billing walk-in sales

Scan a label, take the payment, hand over a GST invoice. Stock drops by itself,
and the sale lands in Orders and Billing beside the website's.

**Admin → Counter.**

---

## What you need

| Item | Cost |
|---|---|
| USB barcode scanner, wired | ₹1,200–2,500 |
| Thermal roll, 58 mm (or A4 label sheets) | ~₹40 a roll |
| Software | none — no library, no subscription |

A USB scanner is a **keyboard**. It types the code and presses Enter. There is
no driver to install and no app to pair. That is why the whole till is one
always-focused input, and why typing a code by hand works exactly the same when
a label is scuffed.

A portable 58 mm thermal printer prints one label at a time from a phone and
needs an image, not a page — see "Printing on a portable thermal printer" below.
A4 sheet stock still works if you would rather batch a shelf at once.

---

## Before the first sale

1. **Barcodes.** Every product needs one, and every product gets one: saving a
   product in Admin → Products allocates it, and so does a spreadsheet import.
   Both draw from a single counter, so no two pieces can ever carry the same
   code. For a catalogue that predates all this, run
   `npx tsx scripts/assign-barcodes.ts --prod` once to fill the gaps.
2. **Pick a label design.** Four of them, shown at true size in
   `docs/ops/barcode-label-designs.pdf` — print that at 100% (not "fit to
   page") and hold the labels against your sheet stock:

   | Design | Size | Per A4 | Border | Carries | For |
   |---|---|---|---|---|---|
   | **Sticker · 38.5 × 19.5 mm** (default) | 38.5 × 19.5 mm | **70** | 8.75 / 12 | — | The small tag, printed by the hundred |
   | Sticker · 50 × 25 mm | 50 × 25 mm | 30 | 30 / 23.5 | — | When the sticker on the shelf is 50 × 25 |
   | Small reel sticker | 38.1 × 21 mm | 65 | 8.75 / 12 | brand | Lace reels and trims |
   | Classic price tag | 63.5 × 38.1 mm | 21 | die-cut | brand | Avery L7160 label stock |
   | Detailed tag | 63.5 × 38.1 mm | 21 | die-cut | brand, category | When one shelf holds several families |
   | A4 cut-out sheet | 64 × 45 mm | 18 | 9 / 13.5 | — | A bigger tag on plain paper |
   | Garment hang tag | 50 × 66 mm | 12 | 25 / 13.5 | brand, category | Lehengas and sarees on a rail |
   | Thermal roll · 58 mm | 384 px wide | — | n/a | brand, category | The portable printer |

   **Border** is how much blank paper the sheet keeps at the sides and at the
   top/bottom, in millimetres. It is not decoration. No desktop printer reaches
   its own paper edge — a Canon PIXMA gives up about 3.4mm at the sides and 5mm
   at the bottom, and the rollers pull the sheet through a millimetre or two
   askew. A grid laid to within 5mm of the edge does not come back 5mm short; it
   comes back with the outer column half printed, which wastes the whole sheet
   instead of one label. Every hand-cut design now keeps **at least 8mm across
   and 12mm down**, and a test fails the build if one stops.

   The two die-cut designs are the exception, deliberately. Their numbers are the
   Avery L7160 die, and the manufacturer already placed it where the printer can
   reach; a "safer" margin there would slide the print off the labels and onto
   the backing paper.

   Where honouring the border would have cost a whole column, the **tag** gave up
   a millimetre or two instead — the default sticker went from 40 × 20 to
   38.5 × 19.5 and still gets 70 to a sheet. Only the 50 × 25 paid in labels
   (44 → 30), because its size is the point of it.

   The stickers and the cut sheet leave the brand off on purpose: they go onto
   the round Tresor Couture tag, which already carries the name, and 2mm spent
   repeating it is 2mm the barcode does not get.

   Every design carries the piece, the price and a scannable code. What each
   adds beyond that is in the Carries column above, and is declared in the
   design itself so a dropped line is a decision rather than an accident. Choose it in the dropdown beside **Print labels** (whole sheets) or
   beside **Download label (PDF)** in the product editor (one piece).
3. **Print ONE label and scan it.** Do this before printing the rest. The
   barcodes are generated in-house — Code 128-B, no third-party library — and a
   scanner disagreeing with the encoder is the one failure that unit tests
   cannot rule out. Admin → Inventory → **Print labels**.
4. Confirm the Counter finds the piece when you scan it. Then print the others.

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
| `src/admin/printLabels.ts` | The A4 label designs, single labels and sheets. |
| `scripts/label-samples.ts` | Regenerates the three sample PDFs in `docs/ops` from the designs. |
| `src/admin/thermalLabel.ts` | Thermal-roll labels, drawn dot by dot for the print head. |
| `tests/emulator/labels.spec.ts` | What every design must say, and that it physically fits the page. |
| `tests/emulator/pos-sale.spec.ts` | Pricing, security and idempotency, against the real handler. |

---

## A note on the twelve-function budget

Vercel's Hobby plan allows **twelve serverless functions**, one per file under
`api/`. Adding the counter endpoint made thirteen — and the symptom was
confusing: the build went green, then the *deploy* was refused with a message
about creating a team.

The fix was free. The three email routes now share one file
(`api/email/[kind].ts`), a dynamic segment being one function that serves many
paths, so `/api/email/welcome`, `/api/email/order` and `/api/email/bulk` all
still resolve exactly as before. That puts the project at **11 of 12**.

`npm run build` now counts them first and fails locally, with the options, if
`api/` ever goes over again. Files under `api/_lib/` and `api/_handlers/` do
not count — the leading underscore tells Vercel they are modules, not
endpoints.

When the next endpoint is needed, collapse siblings behind a dynamic segment
before paying for Pro. One exception: **do not** merge routes with different
security postures. The three payment endpoints stay separate because the
webhook is signature-verified with no CSRF check while the other two are
token-authenticated, and one dispatcher over three guard chains is how the
wrong one ends up running.


---

## Printing on a portable thermal printer

These printers do not understand paper sizes. They take a **bitmap exactly as
wide as the print head** and feed it out: 384 dots on a 58 mm roll, 576 on an
80 mm one. Hand one an A4 page and its app scales the whole sheet down onto the
roll — which is how a label comes back with a barcode a few millimetres wide
that no scanner can read.

So pick a **Thermal roll** size in the label dropdown (it is the default). The
button then saves a **PNG at the head's exact width** instead of opening the
print dialog. Open it from your printer's own app and print at 100% with no
scaling or "fit to page".

The bars are drawn on whole dots. A module two-and-a-bit dots wide gets
anti-aliased into greys, and a head that can only burn or not burn turns those
greys into bar widths the symbol never encoded — the label looks fine and does
not scan.

Sheet stock is still there under **Sheet labels (A4)**, and still uses the print
dialog with "Save as PDF".


---

## Cut-out sheets (any inkjet, scissors)

No label stock, no thermal printer — tags on ordinary A4 with dashed lines to
cut along. Two sizes, both with ready-to-print samples:

| Design | Per sheet | Sample |
|---|---|---|
| **Sticker · 38.5 × 19.5 mm** | 70 | `docs/ops/barcode-sticker-sheet-SAMPLE.pdf` |
| Sticker · 50 × 25 mm | 30 | — |
| A4 cut-out sheet · 64 × 45 mm | 18 | `docs/ops/barcode-cut-sheet-SAMPLE.pdf` |

The 38.5 × 19.5 mm sticker is the default — 70 to a sheet, so three hundred
pieces is five sheets. It sits on the 60 mm round tag with 11 mm clear either
side. Use the 50 × 25 mm one only if that is the size of the blank stickers
being fed through the printer; it holds its size rather than its yield, so it
gets 30 to a sheet.

`scripts/label-samples.ts` regenerates all three PDFs from the designs
themselves, so a sample can never quietly describe a layout that changed.

The tags **share their cut lines** — no gutters between them. That turns a sheet
into five straight passes across and two down, instead of thirty-six fiddly
ones, and wastes no paper. Each tag has a 4–5 mm inner margin, so scissors can
wander a couple of millimetres without touching the barcode.

Margins clear a Canon PIXMA's unprintable edge (about 3.4 mm at the sides and
5 mm at the bottom) more than twice over, so a sheet that feeds a little askew
still prints whole. Print at **100% / Actual size** — the "fit to page" default
shrinks the sheet by a few percent and the tags stop being the size they say
they are.

A single label from the product editor prints centred on a full A4 page rather
than on a page its own size. Nothing feeds 44 × 26 mm paper, so that page fell
back to A4 anyway and put the tag hard into the corner the print head cannot
reach — which is exactly how one comes back half printed.

**Do not put thermal paper through an inkjet.** Thermal paper develops with
heat, not ink: the coating is glossy, so dye ink beads and smudges instead of
drying, and the sheet greys with warmth and friction — a grey background is
exactly what stops a barcode scanning. Thermal paper belongs in the thermal
printer, which needs no ink at all. For the inkjet use plain 100–120 gsm paper
or matte inkjet card, or A4 matte sticker sheets if the tags need to be
adhesive.
