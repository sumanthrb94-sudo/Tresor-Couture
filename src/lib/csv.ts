/**
 * Zero-dependency CSV export. Used by the admin Inventory, Customers and
 * Billing sections to let the CEO pull spreadsheets (GST register, customer
 * list, stock valuation) without any backend.
 */

/** RFC-4180 field escaping: quote when the value contains a comma, quote or
 *  newline, and double any embedded quotes. */
function escapeField(value: unknown): string {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build a CSV string from a header row and an array of row arrays. */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(escapeField).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeField).join(','));
  }
  // Prepend a UTF-8 BOM so Excel opens rupee signs / accented names correctly.
  return '﻿' + lines.join('\r\n');
}

/** Trigger a browser download of `csv` as `filename`. No-ops outside the browser. */
export function downloadCsv(filename: string, csv: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke on the next tick so the click has a chance to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Trigger a browser download of an arbitrary JSON-serialisable value (used by
 *  the DPDP "export my data" flow). */
export function downloadJson(filename: string, value: unknown): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.json') ? filename : `${filename}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
