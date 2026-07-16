# Lehenga Choli — PPT Catalogue Schema

Use one slide per product. The slide must contain a **main product image** and a text box with the fields below. Extra gallery images are optional.

## Required fields

| Field | Format | Example |
|-------|--------|---------|
| `Code` | Unique product code / SKU (alphanumeric, no spaces) | `LC0001` |
| `Name` | Short display name | `Bridal Lehenga — Banarasi Tissue & Pearl` |
| `Category` | Fixed value | `Lehenga Cholis` |
| `SubCategory` | One of: `Bridal`, `Festive`, `Contemporary` | `Bridal` |
| `Material` | Fabric / base material | `Tissue Banarasi Silk` |
| `Price` | Selling price in ₹ (numbers only) | `165000` |
| `MRP` | Original MRP in ₹ (must be ≥ Price) | `229999` |
| `Stock` | Whole units available | `3` |
| `Description` | 1–3 sentences for the product page | `A nine-kali bridal lehenga in tissue Banarasi silk, hand-embroidered with seed pearls and zardozi. Includes choli and four-yard tissue dupatta. Made-to-measure in four weeks.` |
| `Colour` | Primary colour name | `Imperial Maroon` |

## Recommended fields

| Field | Format | Example |
|-------|--------|---------|
| `Work` | Embroidery / technique | `Zardozi, seed pearls` |
| `Blouse` | Choli fabric, style, sleeve, stitching | `Unstitched choli blouse with zari border` |
| `Dupatta` | Dupatta fabric / length | `Tissue dupatta, 4 yards` |
| `Flair / Kalis` | Number of panels or flair style | `9 kali, double flare` |
| `Size / Fit` | Ready-size or made-to-measure note | `Made-to-measure; 4 weeks` |
| `Tags` | Comma-separated search/filter tags | `Bridal, Zardozi, Made-to-Measure` |
| `Sticker` | One of: `New In`, `Trending`, `Bestseller`, `Limited` | `Limited` |
| `Rating` | Optional 0–5 number | `4.9` |
| `Review Count` | Optional integer | `18` |

## Colours (optional)

If a lehenga comes in multiple colours, list them as:

```text
Colours: Maroon #7A1F2C, Emerald #1F5D4F, Ivory #F2EBDD
```

If you only know the name, provide the name and we will map the hex code during import.

## Example slide text

```text
Code: LC0001
Name: Bridal Lehenga — Banarasi Tissue & Pearl
Category: Lehenga Cholis
SubCategory: Bridal
Material: Tissue Banarasi Silk
Colour: Imperial Maroon
Price: 165000
MRP: 229999
Stock: 3
Work: Zardozi, seed pearls
Blouse: Unstitched choli blouse with zari border
Dupatta: Tissue dupatta, 4 yards
Flair / Kalis: 9 kali, double flare
Size / Fit: Made-to-measure; 4 weeks
Tags: Bridal, Zardozi, Made-to-Measure
Sticker: Limited
Description: A nine-kali bridal lehenga in tissue Banarasi silk, hand-embroidered with seed pearls and zardozi. Includes choli and four-yard tissue dupatta. Made-to-measure in four weeks.
```

## Images

- **Main image** — place it prominently on the slide. The extractor will use the largest image as the product `photo`.
- **Gallery images** (up to 3) — add smaller images if you want detail shots / back views / dupatta close-ups.

## Notes

- `Code` becomes the product `id` in Firestore, so it must be unique across every category.
- `MRP` should be higher than or equal to `Price`; the site shows the discount as `((MRP - Price) / MRP)`.
- `Stock` is treated as whole lehenga sets (not fabric meters).
- The current auto-extraction script is tuned for laces/fabrics. If you send a Lehenga Choli PPT, we will run a dedicated Lehenga parser or seed it manually from the fields above.
