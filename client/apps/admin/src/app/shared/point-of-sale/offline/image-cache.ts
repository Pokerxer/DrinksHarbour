// The one place that decides which `src` a POS tile renders, and whether that
// src is bytes we hold or a URL that needs a network.
//
// Pure on purpose: admin vitest runs `environment: 'node'` with no jsdom, so
// components cannot be rendered. Anything that must be tested lives here rather
// than inside a card.

import { resolveSubProductThumb } from '@/app/shared/ecommerce/sub-product/image-utils';

/** Grid tiles are ~150–200 CSS px, so w_300 still covers a 2x display. */
export const POS_THUMB_WIDTH = 300;

/**
 * Fired on `window` once a catalogue sync has pulled new image bytes in, so an
 * already-open grid can pick up object URLs for them. Without it a terminal
 * that syncs and then loses the network in the same session holds the blobs but
 * still renders remote URLs.
 */
export const POS_IMAGES_UPDATED = 'pos-images-updated';

const CLOUDINARY_HOST = 'res.cloudinary.com';
const UPLOAD_MARKER = '/image/upload/';
/** `v1783601019` — a Cloudinary asset version, not a transformation. */
const VERSION_SEGMENT = /^v\d+$/;
/** `f_auto`, `w_300`, `c_fill` … a leading transformation component. */
const TRANSFORM_SEGMENT = /(^|,)[a-z]{1,3}_[^/,]+/;

/**
 * Rewrite a Cloudinary URL to ask for a small derivative instead of the stored
 * original. Measured on this catalogue: 101,729 B original → 10,595 B at w_300.
 *
 * Returns the input unchanged for a non-Cloudinary host, an unparseable value,
 * or a URL that already carries a transformation — we neither guess at another
 * CDN's grammar nor stack a second transformation onto our own, because the
 * result is the cache key and a non-idempotent key downloads the same image
 * twice.
 */
export function posThumbUrl(
  url: string,
  width: number = POS_THUMB_WIDTH
): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (parsed.host !== CLOUDINARY_HOST) return url;

  const markerAt = parsed.pathname.indexOf(UPLOAD_MARKER);
  if (markerAt === -1) return url;

  const head = parsed.pathname.slice(0, markerAt + UPLOAD_MARKER.length);
  const tail = parsed.pathname.slice(markerAt + UPLOAD_MARKER.length);
  const firstSegment = tail.split('/')[0] ?? '';

  // A version segment or a plain public-id path means there is no transformation
  // yet and ours goes in front. Anything else already has one — leave it be.
  const alreadyTransformed =
    !VERSION_SEGMENT.test(firstSegment) && TRANSFORM_SEGMENT.test(firstSegment);
  if (alreadyTransformed) return url;

  parsed.pathname = `${head}f_auto,q_auto,w_${width}/${tail}`;
  return parsed.toString();
}

export type ImageSource =
  /** Bytes are in Dexie; `src` is an object URL and needs no network. */
  | { kind: 'cached'; src: string; key: string }
  /** We know which image this is, but its bytes were never cached. */
  | { kind: 'remote'; src: string; key: string }
  /** The product genuinely has no image — nothing to cache, nothing to show. */
  | { kind: 'missing'; src: null; key: null };

const MISSING: ImageSource = { kind: 'missing', src: null, key: null };

/**
 * Decide what a tile should render for `product`, given the object URLs we
 * currently hold.
 *
 * Three states rather than a `string | undefined`, because this module degrades
 * to a plausible wrong result: a cache miss and one of the 426 sub-products
 * whose parent Product has `images: []` both paint the same blank tile. Callers
 * that can only see "some src or none" cannot tell a broken cache from an
 * unphotographed catalogue, and neither can a test.
 */
export function resolveImageSource(
  product: unknown,
  objectUrls: Map<string, string>,
  width: number = POS_THUMB_WIDTH
): ImageSource {
  const raw = resolveSubProductThumb(product);
  if (!raw) return MISSING;

  const key = posThumbUrl(raw, width);
  const cached = objectUrls.get(key);
  return cached
    ? { kind: 'cached', src: cached, key }
    : { kind: 'remote', src: key, key };
}

/**
 * The distinct set of image keys a catalogue needs, in first-seen order.
 *
 * Products without an image contribute nothing — 426 of Wyn City's 956 active
 * sub-products are in that state because their parent Product has `images: []`,
 * and queueing a key for them would report failures forever for a data gap
 * (see the `subproduct_image_inheritance` note). Sub-products that inherit the
 * same parent photo collapse to one download.
 */
export function catalogueImageKeys(
  products: readonly unknown[],
  width: number = POS_THUMB_WIDTH
): string[] {
  const keys = new Set<string>();
  for (const p of products) {
    const resolved = resolveImageSource(p, EMPTY, width);
    if (resolved.key) keys.add(resolved.key);
  }
  // Array.from rather than a spread: this project's tsconfig has
  // `downlevelIteration` off, so spreading a Set is a compile error.
  return Array.from(keys);
}

const EMPTY: Map<string, string> = new Map();
