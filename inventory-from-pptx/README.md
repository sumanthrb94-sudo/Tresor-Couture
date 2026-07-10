# Catalogue PPTX Extraction

Extracted from: `C:/Users/91779/Downloads/catalouge full.pptx`
Date: 2026-07-10

## Files

| File | Purpose |
|------|---------|
| `inventory_full.csv` | Spreadsheet of all extracted fields (open in Excel / Google Sheets). |
| `inventory_full.json` | Raw extraction in JSON. |
| `inventory_full_seed.json` | Products formatted for the project's `Fabric` schema / Firestore seeding. |
| `images_full_base64.json` | Compressed base64 JPEG payloads used to embed images in Firestore. |
| `preview.html` | Visual review page for the first 15 slides. |
| `images-full/` | Product images extracted from every slide. |
| `public/products/pptx-full/` | Copy of the images for static serving after deploy. |

## What was uploaded live

- **34 products** seeded into Firestore `products` collection.
- All products are under **Laces** → sub-category **Trim & Edging** (laces) or **Patch** (patches).
- Previous demo/seeded products were **wiped** before seeding.
- Product images are embedded as **base64 data URLs** in each Firestore document so they display immediately without redeploying the frontend.

## Pricing logic

- **BP** = buying price (stored in description for reference).
- **SP per meter** = per-meter selling price (if mentioned).
- **Bundle price** = selling price for the whole unit; if no bundle was mentioned, it was computed as `SP per meter × stock meters`.
- **Listing price** (`price` field) = the actual customer price from the catalogue.
- **MRP** = `price / 0.7` so the site displays **30% off** while the customer pays the catalogue price.

Example: SP ₹85 → price ₹85, MRP ₹121.43 → shows “₹121.43 30% off”.

## Notes / exceptions

| Slide | Code | Note |
|-------|------|------|
  | 23 | NO-CODE-S23 | No code on slide; generated code. Price ₹480 (unit). |
| 29 | HA6373 | **Skipped** — only BP ₹2800; no SP/bundle/OG found. |
| 30-35 | NE1386, NE1386-S31…S35 | Same code repeated for colour variants; suffix added to keep IDs unique. |

## Colours

Colours were extracted from slide text where present. Slides with no colour or "10 COLOURS AVAILABLE" were left blank — the user will add colours manually later.

## Re-run / update

```bash
# Extract from PPTX
source .venv-pptx/Scripts/activate
python scripts/extract_full_pptx_catalogue.py

# Generate base64 image payloads
python scripts/generate_base64_images_full.py

# Seed to Firestore (wipes existing products)
export GOOGLE_APPLICATION_CREDENTIALS=C:/Users/91779/Downloads/tresor-couture-firebase-adminsdk-fbsvc-11042bbad1.json
npm run seed:full-catalogue

# Embed images
npx tsx scripts/embed-full-images-in-firestore.ts
```

## Admin Console

Live products are visible in Admin → Products at https://tresorcouture.in/#/admin/products
