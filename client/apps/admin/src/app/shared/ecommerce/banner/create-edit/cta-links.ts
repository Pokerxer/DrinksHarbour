/**
 * Storefront CTA links for banner targets.
 *
 * Mirrors `server/services/banner.helpers.js` (productCtaLink / categoryCtaLink /
 * subcategoryCtaLink / brandCtaLink) — kept as a separate copy because the admin
 * app cannot import from the server package. Keep the two in step.
 *
 * The storefront contract (verified against client/apps/platform):
 *   /product/<slug>                            product detail page
 *   /shop?category=<slug>                      `?category=` resolves as a SLUG —
 *                                              an ObjectId still matches products
 *                                              but leaves the page noindex with a
 *                                              generic hero and no active chip
 *   /shop?category=<parent>&subcategory=<slug> canonical combined form; the API
 *                                              scopes the subcategory lookup by
 *                                              the parent slug
 *   /shop?brand=<name>                         `?brand=` resolves by name/slug and
 *                                              matches the chip the shop sidebar
 *                                              writes itself
 *
 * Anything without a usable slug degrades to a shop search on the name, so a
 * slugless record still lands somewhere real.
 */

export interface CtaTarget {
  id?: string;
  name?: string;
  slug?: string;
  parentSlug?: string;
  parentName?: string;
}

export interface ResolvedBannerContext {
  product?: CtaTarget;
  category?: CtaTarget;
  subcategory?: CtaTarget;
  brand?: CtaTarget;
}

export type BannerLinkType = 'product' | 'category' | 'brand';

const enc = encodeURIComponent;

export function shopSearchLink(name?: string): string {
  const q = String(name || '').trim();
  return q ? `/shop?search=${enc(q)}` : '/shop';
}

export function productCtaLink(product?: CtaTarget | null): string | null {
  if (!product) return null;
  return product.slug
    ? `/product/${enc(product.slug)}`
    : shopSearchLink(product.name);
}

export function categoryCtaLink(category?: CtaTarget | null): string | null {
  if (!category) return null;
  return category.slug
    ? `/shop?category=${enc(category.slug)}`
    : shopSearchLink(category.name);
}

export function subcategoryCtaLink(
  subcategory?: CtaTarget | null
): string | null {
  if (!subcategory) return null;
  if (!subcategory.slug) return shopSearchLink(subcategory.name);
  return subcategory.parentSlug
    ? `/shop?category=${enc(subcategory.parentSlug)}&subcategory=${enc(subcategory.slug)}`
    : `/shop?subcategory=${enc(subcategory.slug)}`;
}

export function brandCtaLink(brand?: CtaTarget | null): string | null {
  if (!brand) return null;
  const key = brand.name || brand.slug;
  return key ? `/shop?brand=${enc(key)}` : '/shop';
}

/**
 * The single CTA a banner should use for a resolved context — most specific
 * target wins. Returns null when there is no context to link to.
 */
export function buildCtaFromContext(
  resolved: ResolvedBannerContext | null | undefined
): { linkType: BannerLinkType; ctaLink: string } | null {
  if (!resolved) return null;
  if (resolved.product) {
    const ctaLink = productCtaLink(resolved.product);
    if (ctaLink) return { linkType: 'product', ctaLink };
  }
  if (resolved.subcategory) {
    const ctaLink = subcategoryCtaLink(resolved.subcategory);
    if (ctaLink) return { linkType: 'category', ctaLink };
  }
  if (resolved.category) {
    const ctaLink = categoryCtaLink(resolved.category);
    if (ctaLink) return { linkType: 'category', ctaLink };
  }
  if (resolved.brand) {
    const ctaLink = brandCtaLink(resolved.brand);
    if (ctaLink) return { linkType: 'brand', ctaLink };
  }
  return null;
}
