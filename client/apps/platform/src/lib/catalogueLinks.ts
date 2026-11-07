// Same-product replacements verified against the public /api/products/slugs
// response and SiteGuru's current page inventory on 2026-10-19. Do not infer
// redirects between different expressions, vintages or bottle sizes.
const PRODUCT_SLUG_REPLACEMENTS: Record<string, string> = {
  'tenjaku-whisky': 'tenjaku-blended-whisky',
  'tenjaku-sherry-cask-japanese-whisky': 'tenjaku-pure-malt-sherry-cask-limited-edition-12-years',
  'akashi-blended-sherry-oak-finish': 'akashi-blended-whisky-sherry-cask-finish',
  'richland-merlot': 'calabria-richland-merlot',
  'the-yamazaki-single-malt-japanese-whisky-distillers-reserve': 'the-yamazaki-distiller-s-reserve-single-malt-japanese-whisky',
  'the-hakushu-single-malt-japanese-whisky-distillers-reserve': 'the-hakushu-distiller-s-reserve-single-malt-japanese-whisky',
};

export function resolveCatalogueHref(href: string): string {
  // The public brand endpoint confirmed this entity is gone, while its bottles
  // remain public. Keep the brand name useful without inventing a new entity.
  if (href === '/brands/springfield-estate') return '/shop?search=Springfield%20Estate';
  // Leave external citations and unknown URLs untouched.
  const match = href.match(/^\/product\/([^/?#]+)([?#].*)?$/);
  if (!match) return href;
  const replacement = PRODUCT_SLUG_REPLACEMENTS[match[1]];
  return replacement ? `/product/${replacement}${match[2] || ''}` : href;
}
