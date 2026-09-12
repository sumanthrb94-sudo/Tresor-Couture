# Six products whose name or category does not match their photograph

Found while writing product copy from the photographs rather than from the
product names. Each of these was opened and looked at; what the picture shows is
recorded below next to what the record claims.

**Nothing here has been changed.** Names and categories are the atelier's facts,
not ours to invent. Fill in the two blank columns and the fixup can be written
in one pass.

Five of the six are **Active — live on tresorcouture.in right now**.

---

## 1. TC00049 — the one to look at first

| | |
|---|---|
| Product ID | `Gqe7H86eYR2b5bAQ336H` |
| Current name | **GOWN** |
| Current category | Gown |
| Status | **Active — live** |
| Price | ₹4,599 |

**The photograph shows a mother-and-daughter matching set.** Slubbed grey
chambray scattered with tiny multicoloured woven dots. The adult piece has a
fitted bodice falling into a full blush-pink skirt; the child's is a
tie-shoulder pinafore cut from the same cloth. They are photographed together,
seated, and the set is clearly the product.

This is not a gown in any sense, and `Gown` is the whole master category — so
the category currently contains one product, and that product is something else.

- New name: `____________________`
- New category: `____________________`

> Worth deciding whether the atelier wants a mother-and-daughter shelf at all.
> If this is the only such piece, it may belong under an existing category with
> the pairing said in the name.

---

## 2. TC00080

| | |
|---|---|
| Product ID | `IWGtENyicFGDNxQib6Vk` |
| Current name | **STRETCHABLE OPEN TOP** |
| Current category | **Laces** / Trim & Edging |
| Status | **Active — live** |
| Price | ₹1,900 |

**The photograph shows a black halter mini dress** in glitter-flecked knit, deep
plunge V, close through the body, cut above the knee. It is styled over a white
tee in the shot.

Both the name and the category are wrong: it is not a top, and it is certainly
not a lace trim. It currently sits in the Laces category alongside 38 rolls of
edging, which is also why it appears in the lace listings.

- New name: `____________________`
- New category: `____________________`

---

## 3. TC00125

| | |
|---|---|
| Product ID | `ckQtUVj8vSwGiL6fN6I6` |
| Current name | **WESTERN WEAR** |
| Current category | **Studios Prêt** |
| Status | **Active — live** |
| Price | ₹7,999 |

**The photograph shows a black sequinned halter mini dress** — deep plunge,
fitted, above the knee.

The garment is western wear; the category says Studios Prêt. The name is also
just the category it should be in, which is why it reads as a placeholder.

- New name: `____________________`
- New category: `____________________`

---

## 4. TC00087

| | |
|---|---|
| Product ID | `exkgcLRkafdgCEp2Ak1z` |
| Current name | **DESIGNER WEAR WITH COAT** |
| Current category | One Minute Saree |
| Status | **Active — live** |
| Price | ₹27,000 |

**There is no coat.** The photograph shows a pre-draped black georgette saree
with a beaded high-neck blouse and a fringe of beadwork over the shoulder. What
reads as a coat is the pallu falling long down one side.

The category is right. Only the name needs settling — and at ₹27,000 this is the
most expensive piece in the group, so the name is doing real work.

- New name: `____________________`
- New category: `____________________` *(likely unchanged)*

---

## 5. TC00066

| | |
|---|---|
| Product ID | `4Wkdg2Li6vD5YFxXzh4C` |
| Current name | **DENIM JUMPSUIT** |
| Current category | Western Wear |
| Status | **Active — live** |
| Price | ₹5,466 |

**The photograph shows a playsuit, not a jumpsuit** — a collared long-sleeved
shirt top with chest flap pockets, cut-outs at the waist, and raw frayed short
hems. A jumpsuit is full-length through the leg; this is not.

The mildest of the six: category correct, and a customer expecting full-length
trousers would be the only one surprised.

- New name: `____________________`
- New category: `____________________` *(likely unchanged)*

---

## 6. TC00101

| | |
|---|---|
| Product ID | `Ve384vUNgftjuFM9OoDa` |
| Current name | **SAREE YELLOW 3 PIECE SET** |
| Current category | Three Piece Set |
| Status | Draft — not live |
| Price | ₹11,866 |

**The photographs show no saree.** Lime yellow in three pieces: a cropped blouse
embroidered in white floral threadwork, a softly pleated drape skirt, and a
full-length sheer cape embroidered down both front edges.

The category is already right; the word "SAREE" in the name is what misleads.
The drape of the skirt is probably where it came from.

- New name: `____________________`
- New category: `____________________` *(likely unchanged)*

---

## Notes

- Every description in `docs/ops/fixups/2026-09-descriptions-photographed.json`
  describes what is **in the photograph**, so those lines stay correct whatever
  these get renamed to.
- Renaming does not affect barcodes. `TC00049` stays `TC00049`; any label
  already printed and stuck to a garment keeps working.
- Changing a master category moves the piece between storefront shelves, so it
  changes what a shopper finds under Laces, Gown and Studios Prêt. Worth doing
  in one batch rather than one at a time.
