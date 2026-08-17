# Filling the store

Two ways in, both landing in the same place: **Admin → Products → Add Product**
for one piece at a time, or the spreadsheet below for a whole shelf at once.

Either way, a product with no photograph is saved as a **Draft** — priced,
stocked, barcoded and sellable at the counter, but not on the website. Adding
the photograph is what publishes it.

---

## One at a time, in the admin console

**Admin → Products → Add Product.** Fill brand, name, description, category,
price, MRP and stock. **Leave Main Photo empty** and save.

* A barcode is allocated automatically — TC00001, TC00002, … from the same
  series the spreadsheet import and the command line draw from, so no two
  pieces can ever carry the same code.
* Print it from **Inventory → Print labels**.
* The piece shows under **Products → Waiting for photos** until it is shot.
* Open it, upload the photo: the listing status flips to *On the website* in
  front of you, and saving publishes it. (Change it back with the same control
  if you would rather hold it.)

The barcode and status live together in the editor's **Publishing & Barcode**
section, with a preview of the actual symbol that will print.

Got a backlog of products with no barcode — a catalogue that predates all this?
**Inventory → Generate barcodes (n)** does the lot. It only ever fills gaps;
an existing barcode is never changed, because it is already on a printed label.

---

# From a spreadsheet

Register the whole catalogue — category, subcategory, pricing, stock — from one
Excel sheet, get a barcode for every product, and print the labels. Photographs
can come later; nothing here waits for them.

---

## The short version

```bash
# 1. Excel -> JSON  (Python, because reading .xlsx needs openpyxl)
python3 scripts/catalogue-xlsx-to-json.py my-catalogue.xlsx -o import.json

# 2. Check it without writing anything
GOOGLE_APPLICATION_CREDENTIALS=/path/key.json \
  npx tsx scripts/import-catalogue.ts import.json --prod --dry-run

# 3. Import for real (this also barcodes every product)
GOOGLE_APPLICATION_CREDENTIALS=/path/key.json \
  npx tsx scripts/import-catalogue.ts import.json --prod
```

Then: **Admin → Inventory → Print labels**.

Rehearse on the emulator first — same commands, without `--prod`:

```bash
npm run emulators                       # in one terminal
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-tresor \
  npx tsx scripts/import-catalogue.ts import.json
```

---

## The sheet

Start from **`docs/ops/tresor-catalogue-TEMPLATE.xlsx`**, Catalogue sheet.
`docs/ops/tresor-catalogue-SAMPLE.xlsx` is the same sheet filled with the 50
products already live, if you want to see it populated.

Columns are matched by **header name**, so you can reorder them, hide the ones
you do not use, or add your own — only the names below are read.

| Column | Required | Notes |
|---|---|---|
| **Product ID** | yes | The key. Letters, digits, `.`, `-`, `_`, up to 64 characters. A new ID creates a product; an existing ID updates it. It is also the product's web address, so keep it readable: `lc-zardozi-sage`, not `p1`. |
| **Product Name** | yes | What the customer sees. |
| **Master Category** | yes | One of the eight in the dropdown. |
| Sub Category / Design | no | Free text. A new name appears in the menus on its own — but check the spelling, because a typo quietly creates a second, near-empty subcategory. |
| **Selling Price (₹)** | yes | Must be greater than zero. |
| MRP (₹) | no | Defaults to the selling price. May not be *below* it — that would print a negative discount. |
| Buying Price (₹) | no | Cost, for margin reporting. Never shown to customers. |
| Stock Qty | no | Whole units. Missing means zero, and zero means "sold out" on the site. |
| Unit Type | no | `unit`, `per meter` or `bundle`. |
| Bundle (m) | no | Metres in one bundle. |
| Description | no | Two or three real sentences — this is the product page copy and what Google indexes. **A blank cell never erases existing copy.** |
| Image URL | no | See below. |
| Listing Status | no | `Active`, `Draft` or `Retired`. Blank means Active. |
| Live on Site | no | `No` is shorthand for Draft. Listing Status wins if both are set. |
| Supplier Code, Supplier, HSN Code, GST Rate, Material, Reorder Lvl, Photo Quality, Sticker | no | Recorded as given. |

Everything else on the sheet (Margin %, Stock Status, Stock per Log, Log Match,
the Photo thumbnail) is calculated for you and is ignored by the import.

---

## No photographs yet? That is the normal case

**A row with no Image URL is imported as a Draft.** The product is fully real —
it has stock, a barcode, a counter price, and it appears in Admin → Inventory —
but no shopper sees it, and it stays out of the sitemap so Google is never
offered a page that is not ready.

That is what lets you register the entire store this week and publish each piece
the day it is photographed. To publish:

* **One at a time:** Admin → Inventory → the **Listing** column → *On the
  website*. (Filter the list to **Drafts** to see only what is waiting.)
* **In bulk:** put the photo URLs in the sheet, set Listing Status to `Active`,
  and import again.

A generated fabric swatch stands in for the photograph in the meantime, so
nothing renders broken in the admin console.

If you genuinely want unphotographed pieces on the website, pass
`--publish-without-photos`.

---

## What the import will and will not do

**It will not delete anything.** A product that is not in your sheet is left
exactly as it is. "Not in this spreadsheet" is not the same statement as "no
longer sold".

**A blank cell means "leave it alone", not "erase it".** Only the columns you
actually fill are written. So a sheet with nothing but Product ID and Stock Qty
is a safe stock update, and the descriptions written by hand survive it.

**Nothing is written if any row is wrong.** The run stops and prints the row
numbers. A half-imported catalogue is the hardest state to recover from, so it
is never created.

**Every product ends up with a barcode.** `TC00001`, `TC00002`, … assigned in
order, and a product keeps its barcode forever — re-importing never renumbers
anything. Pass `--no-barcodes` to skip that step.

---

## Reading the output

**ERRORS stop the import.** Duplicate Product IDs, an unknown Master Category, a
missing name or price, an MRP below the selling price, a negative or fractional
stock count, a value not in one of the dropdown lists.

**WARNINGS import, but are worth reading.** The ones that matter most:

* *No Image URL — imported as Draft.* Expected while you are filling the store.
* *Sub Category "X" is new.* Fine if deliberate; a typo if not.
* *GST Rate 18% is recorded but NOT yet applied.* The rate is stored on the
  product, but checkout and the tax invoice still charge the site-wide 5% until
  the per-product rates are wired in — which is waiting on the CA confirming the
  rate per category. **Do not treat a rate in this column as being charged.**
* *N products share one description.* Search engines collapse near-identical
  pages, so those products compete with each other.
* *Buying price is not below the selling price.* That piece makes no margin.

---

## After the import

1. **Print one label and scan it** before printing the rest. The barcodes are
   generated in-house (Code 128-B, no third-party library), and a scanner
   disagreeing with the encoder is the one failure that unit tests cannot rule
   out.
2. Admin → Inventory → **Print labels** prints whatever the current search,
   stock, category and listing filters show — filter first, then print.
3. `npx tsx scripts/build-sitemap.ts` regenerates the sitemap. Drafts are
   excluded automatically.

---

## Files

| Path | What it is |
|---|---|
| `scripts/catalogue-xlsx-to-json.py` | Excel → JSON. Deliberately dumb: it reads cells, nothing more. |
| `scripts/import-catalogue.ts` | Validation, mapping and the Firestore write. Every domain rule lives here, where it can read the real category tree. |
| `scripts/lib/barcodes.ts` | The barcode numbering rule, shared with `assign-barcodes.ts`. |
| `scripts/assign-barcodes.ts` | Barcodes on their own, for a catalogue that predates the counter. |
| `src/lib/barcodeAssign.ts` | The in-app allocator. Increments `counters/barcodes` in a transaction, so two admins clicking save at the same moment cannot get the same number. |
| `docs/ops/tresor-catalogue-TEMPLATE.xlsx` | The sheet to fill. |
| `docs/ops/tresor-catalogue-SAMPLE.xlsx` | The same sheet, filled, with a month of stock and orders. |
