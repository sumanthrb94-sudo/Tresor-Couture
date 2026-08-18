"""Push the master-category list from src/constants.ts into the workbooks.

The Master Category dropdown in `docs/ops/tresor-catalogue-*.xlsx` is a hard list
on the Lists sheet, and Excel *blocks* a value that is not on it. So a category
added to the application but not to the workbook makes the spreadsheet reject a
product the site would happily accept — and nobody finds out until they are
halfway through typing a delivery.

This rewrites column A of the Lists sheet and widens the validation range to
match, editing the two XML parts inside the .xlsx and copying every other byte
through untouched. openpyxl would have been shorter, but it re-writes the whole
file on save and the SAMPLE workbook carries embedded product photographs that a
round-trip does not reliably preserve.

    python3 scripts/sync-workbook-categories.py
"""
import re
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONSTANTS = ROOT / 'src' / 'constants.ts'
BOOKS = [
    ROOT / 'docs' / 'ops' / 'tresor-catalogue-TEMPLATE.xlsx',
    ROOT / 'docs' / 'ops' / 'tresor-catalogue-SAMPLE.xlsx',
]
LISTS_SHEET = 'xl/worksheets/sheet6.xml'      # the Lists sheet
CATALOGUE_SHEET = 'xl/worksheets/sheet1.xml'  # carries the validation


def master_categories() -> list[str]:
    """The MASTER_CATEGORIES array out of constants.ts — the one source of truth."""
    src = CONSTANTS.read_text(encoding='utf8')
    m = re.search(r'export const MASTER_CATEGORIES:\s*MasterCategory\[\]\s*=\s*\[(.*?)\];', src, re.S)
    if not m:
        raise SystemExit('Could not find MASTER_CATEGORIES in src/constants.ts — did it get renamed?')
    names = re.findall(r"'([^']+)'", m.group(1))
    if not names:
        raise SystemExit('MASTER_CATEGORIES parsed as empty — refusing to write an empty dropdown.')
    return names


def esc(s: str) -> str:
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def cell(ref: str, value: str) -> str:
    return f'<c r="{ref}" s="11" t="inlineStr"><is><t>{esc(value)}</t></is></c>'


def rewrite_lists(xml: str, names: list[str]) -> str:
    """Put `names` in A2, A3, … and clear any A-cell below them."""
    wanted = {f'A{i + 2}': n for i, n in enumerate(names)}
    last_row = len(names) + 1

    def fix_row(m: re.Match) -> str:
        row_xml = m.group(0)
        row_no = int(m.group(1))
        ref = f'A{row_no}'
        # Drop whatever is in column A today; put back what belongs there.
        row_xml = re.sub(rf'<c r="{ref}"[^>]*?(?:/>|>.*?</c>)', '', row_xml, flags=re.S)
        if ref in wanted:
            row_xml = re.sub(r'(<row\b[^>]*>)', r'\1' + cell(ref, wanted[ref]), row_xml, count=1)
        return row_xml

    xml = re.sub(r'<row r="(\d+)".*?</row>', fix_row, xml, flags=re.S)

    # A name that runs past the last existing row needs its row created.
    present = {int(r) for r in re.findall(r'<row r="(\d+)"', xml)}
    missing = [r for r in range(2, last_row + 1) if r not in present]
    for row_no in sorted(missing, reverse=True):
        after = max((r for r in present if r < row_no), default=1)
        new = f'<row r="{row_no}">{cell(f"A{row_no}", wanted[f"A{row_no}"])}</row>'
        xml = re.sub(rf'(<row r="{after}".*?</row>)', r'\1' + new, xml, count=1, flags=re.S)
        present.add(row_no)
    return xml


def widen_validation(xml: str, last_row: int) -> str:
    return re.sub(r'Lists!\$A\$2:\$A\$\d+', f'Lists!$A$2:$A${last_row}', xml)


def main() -> None:
    names = master_categories()
    last_row = len(names) + 1
    print(f'{len(names)} master categories: {", ".join(names)}')

    for book in BOOKS:
        if not book.exists():
            print(f'  skipped (missing): {book.name}')
            continue
        src = zipfile.ZipFile(book)
        tmp = book.with_suffix('.xlsx.tmp')
        with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as out:
            for item in src.infolist():
                data = src.read(item.filename)
                if item.filename == LISTS_SHEET:
                    data = rewrite_lists(data.decode('utf8'), names).encode('utf8')
                elif item.filename == CATALOGUE_SHEET:
                    data = widen_validation(data.decode('utf8'), last_row).encode('utf8')
                out.writestr(item, data)
        src.close()
        shutil.move(tmp, book)
        print(f'  updated: {book.name}')


if __name__ == '__main__':
    main()
