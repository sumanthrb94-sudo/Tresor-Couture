"""Build the Tresor Couture master catalogue workbooks.

Two files:
  tresor-catalogue-TEMPLATE.xlsx  — empty, dropdowns + formulas + one example row
  tresor-catalogue-SAMPLE.xlsx    — the real 50-product catalogue with embedded
                                    photos and a reconciled month of stock log

Schema is derived from the production data model (src/types.ts Fabric) plus the
operational fields the code does not yet track (buying price, supplier, HSN,
reorder level, stock movements).
"""
import json
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import FormulaRule
from openpyxl.drawing.image import Image as XLImage
from openpyxl.utils import get_column_letter

SCRATCH = '/tmp/claude-0/-home-user-Tresor-Couture/032c8341-8752-527a-934b-e8820f30a5ea/scratchpad'
CAT = json.load(open(f'{SCRATCH}/catalogue.json'))
CAT.sort(key=lambda p: (p['master'], p['sub'], p['id']))

ARIAL = 'Arial'
HDR_FILL = PatternFill('solid', fgColor='1F2A44')
HDR_FONT = Font(name=ARIAL, size=9, bold=True, color='FFFFFF')
BASE = Font(name=ARIAL, size=10)
BLUE = Font(name=ARIAL, size=10, color='0000FF')       # hardcoded inputs
GREY_FILL = PatternFill('solid', fgColor='F2F2F2')
THIN = Border(bottom=Side(style='thin', color='D9D9D9'))

# ── Column model for the Catalogue sheet ─────────────────────────────────────
COLS = [
    ('Photo', 13), ('Product ID', 16), ('Supplier Code', 13), ('Product Name', 34),
    ('Brand', 14), ('Master Category', 16), ('Sub Category / Design', 18), ('Material', 12),
    ('Unit Type', 11), ('Bundle (m)', 9), ('Buying Price (₹)', 13), ('Selling Price (₹)', 13),
    ('MRP (₹)', 11), ('Margin %', 9), ('GST Rate', 9), ('HSN Code', 10),
    ('Stock Qty', 9), ('Reorder Lvl', 9), ('Stock Status', 13), ('Stock per Log', 11),
    ('Log Match', 9), ('First Received', 12), ('Supplier', 16), ('Image URL', 40),
    ('Photo Quality', 13), ('Live on Site', 10), ('Listing Status', 12), ('Sticker', 11),
    ('Notes', 40),
]
C = {name: get_column_letter(i + 1) for i, (name, _) in enumerate(COLS)}

LISTS = {
    'Master Category': ['Fabrics', 'Dyeable Fabrics', 'Laces', 'Sarees', 'Lehenga Cholis',
                        'Anarkalis', 'Western Wear', 'Studios Prêt'],
    'Material': ['Silk', 'Silk blend', 'Cotton', 'Wool', 'Linen', 'Satin', 'Net',
                 'Georgette', 'Organza', 'Mixed'],
    'Unit Type': ['unit', 'per meter', 'bundle'],
    'GST Rate': [0, 0.05, 0.12, 0.18],
    'Photo Quality': ['Studio', 'Acceptable', 'Needs reshoot'],
    'Live on Site': ['Yes', 'No'],
    'Listing Status': ['Active', 'Draft', 'Retired'],
    'Sticker': ['New In', 'Bestseller', 'Trending', 'Limited'],
    'Movement': ['Opening', 'Received', 'Sold', 'Returned', 'Adjustment'],
    'Supplier': ['Supplier A (rename me)', 'Supplier B (rename me)', 'Atelier — own production'],
}

MAX_ROWS = 200   # validations + prefilled formulas reach down to here
LOG_ROWS = 600


def build(path: str, with_data: bool) -> None:
    wb = Workbook()

    # ── Lists sheet (dropdown sources) ───────────────────────────────────────
    ws_l = wb.active
    ws_l.title = 'Lists'
    list_ranges = {}
    for col_i, (name, values) in enumerate(LISTS.items(), start=1):
        letter = get_column_letter(col_i)
        ws_l[f'{letter}1'] = name
        ws_l[f'{letter}1'].font = HDR_FONT
        ws_l[f'{letter}1'].fill = HDR_FILL
        for row_i, v in enumerate(values, start=2):
            cell = ws_l[f'{letter}{row_i}']
            cell.value = v
            cell.font = BASE
            if name == 'GST Rate':
                cell.number_format = '0%'
        ws_l.column_dimensions[letter].width = 22
        list_ranges[name] = f'Lists!${letter}$2:${letter}${len(values) + 1}'

    # ── Catalogue sheet ──────────────────────────────────────────────────────
    ws = wb.create_sheet('Catalogue')
    for i, (name, width) in enumerate(COLS, start=1):
        cell = ws.cell(row=1, column=i, value=name)
        cell.font = HDR_FONT
        cell.fill = HDR_FILL
        cell.alignment = Alignment(vertical='center', wrap_text=True)
        ws.column_dimensions[get_column_letter(i)].width = width
    ws.row_dimensions[1].height = 28
    ws.freeze_panes = 'E2'

    def formulas_for(r: int) -> dict:
        return {
            'Margin %': f'=IF(OR({C["Buying Price (₹)"]}{r}="",{C["Selling Price (₹)"]}{r}=""),"",'
                        f'({C["Selling Price (₹)"]}{r}-{C["Buying Price (₹)"]}{r})/{C["Selling Price (₹)"]}{r})',
            'Stock Status': f'=IF({C["Stock Qty"]}{r}="","",IF({C["Stock Qty"]}{r}<=0,"OUT OF STOCK",'
                            f'IF({C["Stock Qty"]}{r}<={C["Reorder Lvl"]}{r},"REORDER","OK")))',
            'Stock per Log': f'=IF({C["Product ID"]}{r}="","",'
                             f"SUMIFS('Stock Log'!$D$2:$D$600,'Stock Log'!$B$2:$B$600,{C['Product ID']}{r}))",
            'Log Match': f'=IF({C["Product ID"]}{r}="","",'
                         f'IF({C["Stock per Log"]}{r}={C["Stock Qty"]}{r},"OK","CHECK"))',
        }

    def style_row(r: int) -> None:
        for i in range(1, len(COLS) + 1):
            cell = ws.cell(row=r, column=i)
            if cell.font.name != ARIAL:
                cell.font = BASE
            cell.border = THIN
        for name, fmt in [('Buying Price (₹)', '"₹"#,##0'), ('Selling Price (₹)', '"₹"#,##0'),
                          ('MRP (₹)', '"₹"#,##0'), ('Margin %', '0.0%'), ('GST Rate', '0%'),
                          ('First Received', 'yyyy-mm-dd')]:
            ws[f'{C[name]}{r}'].number_format = fmt

    # illustrative buying prices (BLUE input; documented in How To Use)
    def est_cost(p: dict) -> int:
        share = 0.62 if p['master'] in ('Lehenga Cholis', 'Sarees') else 0.58
        return int(round(p['price'] * share, -1))

    log_entries = []   # (date, sku, movement, qty, ref, note)
    if with_data:
        SOLD = {'6343': ('2026-08-02', 'ORD-8H2K'), '6988': ('2026-08-04', 'ORD-8J7Q'),
                'HA4536': ('2026-08-07', 'ORD-8N1D'), 'HA6320': ('2026-08-09', 'ORD-8Q5S'),
                'HA3858': ('2026-08-11', 'ORD-8T3M'), 'MI263': ('2026-08-13', 'ORD-8V9A')}
        for p in CAT:
            received = '2026-07-31' if p['master'] in ('Lehenga Cholis', 'Sarees') else '2026-07-09'
            if p['master'] in ('Lehenga Cholis', 'Sarees'):
                log_entries.append((received, p['id'], 'Received', p['stock'], 'PO-DROP-01', 'Bridal drop intake'))
                if p['id'] == 'lc-zf-rose':
                    log_entries.append(('2026-08-05', p['id'], 'Sold', -1, 'ORD-8L4R', 'COD order'))
                    log_entries.append(('2026-08-12', p['id'], 'Returned', 1, 'RET-8L4R', 'Size exchange requested; restocked after inspection'))
            else:
                sold = 1 if p['id'] in SOLD else 0
                adj = -1 if p['id'] == 'RI280' else 0
                opening = p['stock'] + sold - adj
                log_entries.append((received, p['id'], 'Opening', opening, 'IMPORT-0709', 'Opening stock from supplier import'))
                if sold:
                    d, ref = SOLD[p['id']]
                    log_entries.append((d, p['id'], 'Sold', -1, ref, 'COD order'))
                if adj:
                    log_entries.append(('2026-08-02', p['id'], 'Adjustment', -1, 'ADJ-001', '1 reel water-damaged — written off'))

        for r, p in enumerate(CAT, start=2):
            reorder = 2 if p['master'] in ('Lehenga Cholis', 'Sarees') else 1
            needs_reshoot = p['id'] in ('HA6378', 'MI263', 'RI5687')
            vals = {
                'Product ID': p['id'], 'Supplier Code': p['code'], 'Product Name': p['name'],
                'Brand': p['brand'], 'Master Category': p['master'], 'Sub Category / Design': p['sub'],
                'Material': p['material'], 'Unit Type': p['unit'], 'Bundle (m)': p['bundle'],
                'Buying Price (₹)': est_cost(p), 'Selling Price (₹)': p['price'], 'MRP (₹)': p['mrp'],
                'GST Rate': 0.05, 'HSN Code': None, 'Stock Qty': p['stock'], 'Reorder Lvl': reorder,
                'First Received': '2026-07-31' if p['master'] in ('Lehenga Cholis', 'Sarees') else '2026-07-09',
                'Supplier': 'Atelier — own production' if p['master'] in ('Lehenga Cholis', 'Sarees') else 'Supplier A (rename me)',
                'Image URL': f"https://tresorcouture.in{p['photo']}" if p['photo'].startswith('/') else '',
                'Photo Quality': 'Needs reshoot' if needs_reshoot else 'Studio',
                'Live on Site': 'Yes', 'Listing Status': 'Active', 'Sticker': p['sticker'] or None,
                'Notes': 'Reshoot flagged — warehouse snapshot' if needs_reshoot else None,
            }
            for name, v in vals.items():
                cell = ws[f'{C[name]}{r}']
                cell.value = v
                if name == 'Buying Price (₹)':
                    cell.font = BLUE
            for name, f in formulas_for(r).items():
                ws[f'{C[name]}{r}'] = f
            style_row(r)
            ws.row_dimensions[r].height = 56
            try:
                img = XLImage(f"{SCRATCH}/thumbs/{p['id']}.jpg")
                img.anchor = f'A{r}'
                ws.add_image(img)
            except FileNotFoundError:
                pass
        data_rows = len(CAT) + 1
    else:
        # one example row, clearly disposable
        r = 2
        example = {
            'Product ID': 'lc-example-1', 'Supplier Code': 'HA0000', 'Product Name': 'Example Lace Border · Gold',
            'Brand': 'TRESOR COUTURE', 'Master Category': 'Laces', 'Sub Category / Design': 'Trim & Edging',
            'Material': 'Net', 'Unit Type': 'bundle', 'Bundle (m)': 9, 'Buying Price (₹)': 700,
            'Selling Price (₹)': 1299, 'MRP (₹)': 1299, 'GST Rate': 0.05, 'HSN Code': None,
            'Stock Qty': 3, 'Reorder Lvl': 1, 'First Received': '2026-08-01',
            'Supplier': 'Supplier A (rename me)', 'Image URL': 'https://tresorcouture.in/products/lace/HA0000.jpg',
            'Photo Quality': 'Studio', 'Live on Site': 'Yes', 'Listing Status': 'Active',
            'Sticker': 'New In', 'Notes': 'EXAMPLE ROW — replace with your first product',
        }
        for name, v in example.items():
            cell = ws[f'{C[name]}{r}']
            cell.value = v
            if name == 'Buying Price (₹)':
                cell.font = BLUE
        for name, f in formulas_for(r).items():
            ws[f'{C[name]}{r}'] = f
        style_row(r)
        for i in range(1, len(COLS) + 1):
            ws.cell(row=r, column=i).fill = GREY_FILL
        data_rows = 2

    # prefill guarded formulas so new rows compute automatically
    for r in range(data_rows + 1, MAX_ROWS + 1):
        for name, f in formulas_for(r).items():
            ws[f'{C[name]}{r}'] = f
            ws[f'{C[name]}{r}'].font = BASE
        ws[f'{C["Margin %"]}{r}'].number_format = '0.0%'
        ws[f'{C["GST Rate"]}{r}'].number_format = '0%'

    # dropdown validations
    for name in ['Master Category', 'Material', 'Unit Type', 'GST Rate', 'Photo Quality',
                 'Live on Site', 'Listing Status', 'Sticker', 'Supplier']:
        dv = DataValidation(type='list', formula1=list_ranges[name], allow_blank=True,
                            showErrorMessage=True, errorTitle='Pick from the list',
                            error=f'Choose a value from the {name} dropdown (or edit the Lists sheet to add one).')
        ws.add_data_validation(dv)
        dv.add(f'{C[name]}2:{C[name]}{MAX_ROWS}')

    # conditional formatting on Stock Status
    red = PatternFill('solid', fgColor='F8D3D0')
    amber = PatternFill('solid', fgColor='FBEAC9')
    col = C['Stock Status']
    ws.conditional_formatting.add(f'{col}2:{col}{MAX_ROWS}',
        FormulaRule(formula=[f'${col}2="OUT OF STOCK"'], fill=red))
    ws.conditional_formatting.add(f'{col}2:{col}{MAX_ROWS}',
        FormulaRule(formula=[f'${col}2="REORDER"'], fill=amber))
    colm = C['Log Match']
    ws.conditional_formatting.add(f'{colm}2:{colm}{MAX_ROWS}',
        FormulaRule(formula=[f'${colm}2="CHECK"'], fill=red))

    # ── Stock Log sheet ──────────────────────────────────────────────────────
    ws_s = wb.create_sheet('Stock Log')
    log_cols = [('Date', 12), ('Product ID', 16), ('Movement', 12), ('Qty (+in / −out)', 14),
                ('Reference (PO / Order)', 20), ('Notes', 44)]
    for i, (name, width) in enumerate(log_cols, start=1):
        cell = ws_s.cell(row=1, column=i, value=name)
        cell.font = HDR_FONT
        cell.fill = HDR_FILL
        ws_s.column_dimensions[get_column_letter(i)].width = width
    ws_s.freeze_panes = 'A2'

    entries = sorted(log_entries) if with_data else [
        ('2026-08-01', 'lc-example-1', 'Received', 3, 'PO-001', 'EXAMPLE ROW — first stock intake'),
    ]
    for r, (d, sku, mv, qty, ref, note) in enumerate(entries, start=2):
        for i, v in enumerate([d, sku, mv, qty, ref, note], start=1):
            cell = ws_s.cell(row=r, column=i, value=v)
            cell.font = BASE
            cell.border = THIN
        ws_s.cell(row=r, column=1).number_format = 'yyyy-mm-dd'
        if not with_data:
            for i in range(1, 7):
                ws_s.cell(row=r, column=i).fill = GREY_FILL

    dv_mv = DataValidation(type='list', formula1=list_ranges['Movement'], allow_blank=True)
    ws_s.add_data_validation(dv_mv)
    dv_mv.add(f'C2:C{LOG_ROWS}')

    # ── How To Use sheet ─────────────────────────────────────────────────────
    ws_h = wb.create_sheet('How To Use')
    ws_h.column_dimensions['A'].width = 4
    ws_h.column_dimensions['B'].width = 120
    lines = [
        ('TRESOR COUTURE — MASTER CATALOGUE', True),
        ('', False),
        ('ONE ROW = ONE SELLABLE SKU. Each colourway is its own row because it is separately purchasable stock '
         '(this mirrors the website database: the Product ID column is the site id, so the two always reconcile).', False),
        ('', False),
        ('SHEETS', True),
        ('Catalogue — the single unified sheet: identity, category, pricing, tax, stock, photo and listing state per SKU.', False),
        ('Stock Log — every stock movement, one row per event: Opening / Received / Sold / Returned / Adjustment. '
         'This answers "when did the stock come" permanently — never edit old rows, only add new ones.', False),
        ('Lists — the dropdown sources. Add a supplier or category here and every dropdown picks it up.', False),
        ('', False),
        ('HOW STOCK RECONCILES', True),
        ('"Stock per Log" sums the Stock Log for that Product ID. "Log Match" turns red (CHECK) whenever the log and '
         'the Stock Qty column disagree — that is how you catch untracked movements. Keep Stock Qty as the live truth '
         'and record every change in the log, and the two stay green.', False),
        ('', False),
        ('CELL COLOURS', True),
        ('Blue text = a number you typed (e.g. Buying Price). Black = calculated, do not overwrite '
         '(Margin %, Stock Status, Stock per Log, Log Match).', False),
        ('Red fill = OUT OF STOCK or a log mismatch. Amber fill = at/below reorder level.', False),
        ('', False),
        ('ASSUMPTIONS IN THE SAMPLE FILE', True),
        ('Buying prices are ILLUSTRATIVE (≈58–62% of selling price) — the database does not store cost prices yet. '
         'Replace them with real purchase-order costs. Source: generated from the live site database on 2026-08-16.', False),
        ('GST Rate defaults to 5% and HSN is left blank pending your CA\'s confirmation. Note: garments above ₹2,500 '
         'per piece attract 18% under the Sept-2025 rate structure — confirm before relying on the 5% default.', False),
        ('The Stock Log sample month (9 Jul – 16 Aug 2026) uses real products and current stock levels; the individual '
         'sale/return events are illustrative examples in the correct format.', False),
        ('', False),
        ('PHOTOS', True),
        ('The Photo column holds a thumbnail (sample file) and Image URL holds the live site image. For new products, '
         'paste the image URL; add the thumbnail with Insert → Picture → Place in Cell if you want it inline.', False),
    ]
    for r, (text, bold) in enumerate(lines, start=2):
        cell = ws_h[f'B{r}']
        cell.value = text
        cell.font = Font(name=ARIAL, size=11 if bold else 10, bold=bold)
        cell.alignment = Alignment(wrap_text=True, vertical='top')
        ws_h.row_dimensions[r].height = 15 if bold or not text else 30

    wb.move_sheet('Lists', offset=3)   # order: Catalogue, Stock Log, How To Use, Lists
    wb.save(path)
    print('wrote', path)


build(f'{SCRATCH}/tresor-catalogue-TEMPLATE.xlsx', with_data=False)
build(f'{SCRATCH}/tresor-catalogue-SAMPLE.xlsx', with_data=True)
