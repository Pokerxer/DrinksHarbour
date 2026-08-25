'use client';

/**
 * Receipt printing without popups.
 *
 * The previous implementation called window.open() from a setTimeout after the
 * receipt mounted, because auto-print fires outside any user gesture. Popup
 * blockers return null for exactly that case, so "auto-print" silently did
 * nothing on Chrome and Safari — the cashier discovered it only when a customer
 * asked for their slip.
 *
 * This prints through a hidden iframe instead. An iframe's print() does not
 * need popup permission, opens no tab, and works the same whether the call came
 * from a click or an effect. The iframe is created once and reused: tearing it
 * down immediately after print() cancels the job in some browsers, and there is
 * no reliable signal that the dialog has been dismissed.
 *
 * Thermal printers are deliberately not handled here yet. ESC/POS output is
 * byte-level device code that cannot be exercised from a dev machine, so it is
 * deferred until hardware exists to verify against. When it lands, this module
 * is the seam: detect the device, encode, write — else fall back to the browser
 * path below.
 */

let sharedFrame: HTMLIFrameElement | null = null;

const RECEIPT_STYLES = `
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Courier New',Courier,monospace;font-size:12px;
       background:#fff;color:#111;max-width:384px;margin:0 auto;padding:8px 12px}
  @page{margin:0}
  @media print{body{width:100%;max-width:100%;padding:4px 6px;font-size:11px}}
  .dh-receipt-copy{page-break-after:always}
  .dh-receipt-copy:last-child{page-break-after:auto}
`;

function getFrame(): HTMLIFrameElement | null {
  if (typeof document === 'undefined') return null;
  if (sharedFrame && document.body.contains(sharedFrame)) return sharedFrame;

  const frame = document.createElement('iframe');
  // Zero-size and off-screen rather than display:none — Firefox refuses to
  // print a frame that has never been laid out.
  frame.setAttribute(
    'style',
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;'
  );
  frame.setAttribute('title', 'receipt-print-frame');
  document.body.appendChild(frame);
  sharedFrame = frame;
  return frame;
}

/** Resolve once every image inside the frame document has settled. */
async function waitForImages(doc: Document, timeoutMs = 2500): Promise<void> {
  const images = Array.from(doc.images);
  if (!images.length) return;

  const settled = new Promise<void>((resolve) => {
    let pending = images.length;
    const done = () => {
      pending -= 1;
      if (pending <= 0) resolve();
    };
    for (const img of images) {
      if (img.complete) {
        done();
      } else {
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
      }
    }
  });

  // A stuck image must never hold the receipt hostage — print without it.
  await Promise.race([settled, new Promise((r) => setTimeout(r, timeoutMs))]);
}

/**
 * Build the print body: one copy renders bare, multiple copies are wrapped in
 * page-break containers. Clamped to 1–5 — beyond that, a mis-typed setting
 * would print a small novel per sale.
 */
export function buildPrintBody(content: string, copies: number): string {
  const n = Math.max(1, Math.min(5, Math.floor(copies) || 1));
  if (n === 1) return content;
  return Array.from({ length: n }, () => content)
    .map((c) => `<div class="dh-receipt-copy">${c}</div>`)
    .join('');
}

/**
 * Print `el`'s rendered markup, `copies` times in one print job.
 * Returns false when printing is unavailable (no DOM, blocked frame).
 */
export async function printReceiptElement(
  el: HTMLElement,
  opts: { title?: string; copies?: number } = {}
): Promise<boolean> {
  const frame = getFrame();
  if (!frame) return false;

  const win = frame.contentWindow;
  const doc = win?.document;
  if (!win || !doc) return false;

  const body = buildPrintBody(el.outerHTML, opts.copies ?? 1);

  doc.open();
  doc.write(`<!DOCTYPE html><html><head>
    <title>${opts.title ?? 'Receipt'}</title>
    <meta charset="utf-8">
    <style>${RECEIPT_STYLES}</style>
  </head><body>${body}</body></html>`);
  doc.close();

  await waitForImages(doc);

  try {
    win.focus();
    win.print();
    return true;
  } catch {
    return false;
  }
}

/** Test hook: drop the shared frame so a later print gets a fresh one. */
export function disposePrintFrame(): void {
  sharedFrame?.remove();
  sharedFrame = null;
}
