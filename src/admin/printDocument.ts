/**
 * Print an arbitrary self-contained HTML document.
 *
 * Extracted from exportKitPdf.ts so the brand book and the barcode label sheet
 * share one implementation. The mechanics matter and are easy to get subtly
 * wrong, which is why they live in exactly one place:
 *
 *  - A hidden same-origin IFRAME, not `window.open` — a popup gets blocked
 *    unless the click is still on the stack, and it steals focus.
 *  - The document carries its OWN `@page` rule, so a label sheet can declare a
 *    different paper size from an A4 brand book without either fighting the
 *    host page's stylesheet. This is why the printable content is a separate
 *    document rather than a `@media print` block on the admin page, which can
 *    only ever have one page size and one visible region.
 *  - Images are awaited before printing; otherwise the dialog opens on a
 *    half-rendered page.
 *  - Cleanup runs on `afterprint`, with a timeout fallback because some
 *    browsers never fire it, and is delayed so the dialog still has its
 *    document while open.
 */

/** Resolve once every image in `doc` has settled, or after `capMs`. */
export function waitForImages(doc: Document, capMs = 8000): Promise<void> {
  const images = Array.from(doc.images ?? []);
  if (!images.length) return Promise.resolve();

  return new Promise<void>((resolve) => {
    let settled = 0;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    const tick = () => {
      settled += 1;
      if (settled >= images.length) finish();
    };
    for (const img of images) {
      if (img.complete) tick();
      else {
        img.addEventListener('load', tick, { once: true });
        img.addEventListener('error', tick, { once: true });
      }
    }
    // Never block the print dialog on a stalled asset.
    window.setTimeout(finish, capMs);
  });
}

/**
 * Write `html` into a hidden iframe and open the print dialog.
 * Resolves once printing has been triggered (not once it has finished — the
 * browser gives no such signal).
 */
export async function printHtmlDocument(html: string): Promise<void> {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  document.body.appendChild(iframe);

  const cleanup = () => {
    // Delay removal so the print dialog has the document while it's open.
    window.setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 1000);
  };

  try {
    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) throw new Error('Could not create the print frame.');

    doc.open();
    doc.write(html);
    doc.close();

    await waitForImages(doc);

    win.addEventListener('afterprint', cleanup, { once: true });
    win.focus();
    win.print();

    // Fallback cleanup in case afterprint never fires (some browsers).
    window.setTimeout(cleanup, 60000);
  } catch (err) {
    cleanup();
    throw err;
  }
}
