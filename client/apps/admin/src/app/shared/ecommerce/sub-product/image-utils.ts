// One place that decides which image represents a sub-product — used by the
// list (grid, compact & list views), the create/edit form and the POS.
//
// A sub-product may carry its own `imagesOverride`; otherwise it inherits the
// images from the connected platform Product. Images follow MediaItemSchema
// ({ url, thumbnail, isPrimary, order, ... }) but legacy rows may store plain
// string URLs, so both shapes are handled. Display order prefers the flagged
// primary, then the lowest `order`, then array order.

type MediaLike =
  | string
  | {
      url?: string;
      alt?: string;
      thumbnail?: string;
      isPrimary?: boolean;
      order?: number;
    };

export interface DisplayImage {
  url: string;
  alt?: string;
  /** Cloudinary-generated small derivative, when one was stored. */
  thumbnail?: string;
  isPrimary?: boolean;
}

function urlOf(item?: MediaLike): string | undefined {
  if (!item) return undefined;
  const raw = typeof item === 'string' ? item : item.url;
  const trimmed = typeof raw === 'string' ? raw.trim() : undefined;
  return trimmed ? trimmed : undefined;
}

/**
 * Normalise a MediaItem array into display order: flagged primary first, then
 * ascending `order`, then the order they were stored in. Entries without a
 * usable URL are dropped.
 */
export function orderedImages(images?: MediaLike[]): DisplayImage[] {
  if (!Array.isArray(images) || images.length === 0) return [];

  const usable: Array<{ img: DisplayImage; order: number; index: number }> = [];
  images.forEach((item, index) => {
    const url = urlOf(item);
    if (!url) return;
    const meta = typeof item === 'string' ? {} : item;
    const img: DisplayImage = { url };
    if (meta.alt) img.alt = meta.alt;
    if (meta.thumbnail) img.thumbnail = meta.thumbnail;
    if (meta.isPrimary) img.isPrimary = true;
    usable.push({ img, order: meta.order ?? index, index });
  });

  return usable
    .sort((a, b) => {
      // A flagged primary always leads, whatever its `order` says.
      const rank = Number(!!b.img.isPrimary) - Number(!!a.img.isPrimary);
      if (rank !== 0) return rank;
      if (a.order !== b.order) return a.order - b.order;
      return a.index - b.index;
    })
    .map((e) => e.img);
}

function pickImage(images?: MediaLike[]): string | undefined {
  return orderedImages(images)[0]?.url;
}

/**
 * The parent product's images, in display order. Empty when the sub-product
 * has no connected product or that product carries no images — the caller then
 * has nothing to inherit and must show a placeholder.
 */
export function inheritedProductImages(
  // Callers pass a whole Product document; only `images` is read.
  product?: ({ images?: MediaLike[] } & Record<string, any>) | null
): DisplayImage[] {
  return orderedImages(product?.images);
}

/**
 * The full gallery to show for a sub-product, in display order. `imagesOverride`
 * is an override, not an addition: once a sub-product has images of its own the
 * parent's are not shown alongside them. Empty when there is nothing to show.
 */
export function resolveSubProductGallery(sp: any): DisplayImage[] {
  const own = orderedImages(sp?.imagesOverride);
  return own.length > 0 ? own : orderedImages(sp?.product?.images);
}

/**
 * The single best image URL for a sub-product, preferring the stored small
 * derivative — for grids, cart lines and receipts that never need full size.
 */
export function resolveSubProductThumb(sp: any): string | undefined {
  const best = resolveSubProductGallery(sp)[0];
  return best ? best.thumbnail || best.url : undefined;
}

/**
 * Resolve the best display image for a sub-product: its own override images
 * first, then the connected product's images. Returns undefined when neither
 * has a usable image (callers show a placeholder).
 */
export function resolveSubProductImage(sp: any): string | undefined {
  return pickImage(sp?.imagesOverride) || pickImage(sp?.product?.images);
}

/**
 * Ordered list of display-image candidates for a sub-product, most-specific
 * first: the sub-product's own override image, then the connected product's
 * image. Callers render the first candidate and advance to the next on load
 * error (a broken override URL falls back to the product image before the
 * placeholder). Duplicates and empty URLs are removed.
 */
export function resolveSubProductImages(sp: any): string[] {
  const out: string[] = [];
  for (const url of [
    pickImage(sp?.imagesOverride),
    pickImage(sp?.product?.images),
  ]) {
    if (url && !out.includes(url)) out.push(url);
  }
  return out;
}
