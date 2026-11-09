'use client';

/**
 * Download a saved product image to the visitor's machine.
 *
 * Preferred path: fetch the ORIGINAL bytes as a blob (Cloudinary serves
 * CORS headers, so the fetch succeeds cross-origin) and hand the object URL
 * to an anchor with a real filename — the browser then saves a true copy
 * instead of navigating.
 * Fallback: if the fetch is blocked (CORS/offline), open the direct URL via
 * a download-attribute anchor and let the browser do its best.
 */
export default async function downloadProductImage(
  url: string,
  filename?: string
): Promise<void> {
  const derived = (() => {
    if (filename) return filename;
    const lastSegment = url.split('/').pop()?.split('?')[0] || '';
    const name = decodeURIComponent(lastSegment);
    return name || 'product-image.jpg';
  })();
  try {
    const response = await fetch(url, { mode: 'cors', cache: 'no-store' });
    if (!response.ok) throw new Error(`Could not fetch image (HTTP ${response.status})`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    triggerDownload(objectUrl, derived);
    // Give the download initiation a beat before freeing the blob URL —
    // revoking synchronously can cancel the save in some browsers.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch {
    triggerDownload(url, derived);
  }
}

function triggerDownload(href: string, fileName: string): void {
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
