// Shared image resolution for the sub-product list (grid, compact & list views).
//
// A sub-product may carry its own `imagesOverride`; otherwise it inherits the
// images from the connected platform Product. Images follow MediaItemSchema
// ({ url, isPrimary, order, ... }) but legacy rows may store plain string URLs,
// so both shapes are handled. Selection prefers the primary image, then the
// lowest `order`, then the first entry.

type MediaLike = string | { url?: string; isPrimary?: boolean; order?: number };

function urlOf(item?: MediaLike): string | undefined {
  if (!item) return undefined;
  const raw = typeof item === 'string' ? item : item.url;
  const trimmed = typeof raw === 'string' ? raw.trim() : undefined;
  return trimmed ? trimmed : undefined;
}

function pickImage(images?: MediaLike[]): string | undefined {
  if (!Array.isArray(images) || images.length === 0) return undefined;

  const withUrl = images.filter((i) => !!urlOf(i));
  if (withUrl.length === 0) return undefined;

  // Prefer an explicitly-flagged primary image.
  const primary = withUrl.find((i) => typeof i !== 'string' && i.isPrimary);
  if (primary) return urlOf(primary);

  // Otherwise the lowest `order`, falling back to array order.
  const sorted = [...withUrl].sort((a, b) => {
    const ao = typeof a === 'string' ? 0 : (a.order ?? 0);
    const bo = typeof b === 'string' ? 0 : (b.order ?? 0);
    return ao - bo;
  });
  return urlOf(sorted[0]);
}

/**
 * Resolve the best display image for a sub-product: its own override images
 * first, then the connected product's images. Returns undefined when neither
 * has a usable image (callers show a placeholder).
 */
export function resolveSubProductImage(sp: any): string | undefined {
  return pickImage(sp?.imagesOverride) || pickImage(sp?.product?.images);
}
