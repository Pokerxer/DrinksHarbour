/** Published brands remain discoverable even when their cached stock count is zero. */
export function displayableBrands<T extends { name?: string; slug?: string }>(brands: T[]): T[] {
  return brands.filter(brand => Boolean(brand?.name && brand?.slug));
}

interface CardImage {
  url: string;
  alt?: string;
}

export interface BrandCardData {
  _id: string;
  name: string;
  slug: string;
  logo?: CardImage;
  logoVariants?: { primary?: string; white?: string };
  featuredImage?: CardImage;
  brandColors?: { primary?: string; accent?: string };
  shortDescription?: string;
  productCount?: number;
  countryOfOrigin?: string;
  createdAt?: string;
}

/** Only card/filter data crosses the server-to-client boundary; stories stay on detail pages. */
export function brandCardData(brand: BrandCardData & { description?: string }): BrandCardData {
  const preview = (brand.shortDescription || brand.description || '').trim();
  const image = (value?: CardImage): CardImage | undefined =>
    value ? { url: value.url, alt: value.alt } : undefined;
  return {
    _id: brand._id,
    name: brand.name,
    slug: brand.slug,
    logo: image(brand.logo),
    logoVariants: brand.logoVariants ? {
      primary: brand.logoVariants.primary, white: brand.logoVariants.white,
    } : undefined,
    featuredImage: image(brand.featuredImage),
    brandColors: brand.brandColors ? {
      primary: brand.brandColors.primary, accent: brand.brandColors.accent,
    } : undefined,
    shortDescription: preview.length > 240 ? `${preview.slice(0, 239).trimEnd()}…` : preview,
    productCount: brand.productCount,
    countryOfOrigin: brand.countryOfOrigin,
    createdAt: brand.createdAt,
  };
}
