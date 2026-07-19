import type { ApiProduct, Product } from "./types";

const FALLBACK_IMAGE = "/images/images/product/1000x1000.png";
const NEW_PRODUCT_WINDOW_DAYS = 30;

const toBoolean = (value: unknown): boolean =>
  value === true || value === "true";

const collectImages = (api: ApiProduct): string[] => {
  const images: string[] = [];
  if (api.primaryImage?.url) images.push(api.primaryImage.url);
  if (api.images) {
    for (const img of api.images) {
      if (img.url && !images.includes(img.url)) images.push(img.url);
    }
  }
  if (images.length === 0) images.push(FALLBACK_IMAGE);
  return images;
};

const computeStock = (api: ApiProduct): { totalStock: number; availableStock: number; totalSold: number } => {
  const entries = api.availableAt ?? [];
  const totalStock = entries.reduce((sum, e) => sum + (e.totalStock ?? 0), 0);
  const availableStock = entries.reduce((sum, e) => sum + (e.availableStock ?? 0), 0);
  const fallbackStock = entries.length > 0 ? 100 : 0;
  return {
    totalStock: totalStock > 0 ? totalStock : fallbackStock,
    availableStock,
    totalSold: api.totalSold ?? 0,
  };
};

const computeIsNew = (api: ApiProduct): boolean => {
  if (!api.createdAt) return false;
  const created = new Date(api.createdAt).getTime();
  if (Number.isNaN(created)) return false;
  return Date.now() - created <= NEW_PRODUCT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
};

/**
 * Map an API product to the card-ready shape, trusting server-provided sale
 * signals (search.service.js already computes `sale` and `originPrice`) and
 * only re-deriving when those are missing.
 */
export const mapApiProductToProduct = (api: ApiProduct): Product => {
  const thumbImage = collectImages(api);

  const availableAt = api.availableAt?.[0];
  const sizes = availableAt?.sizes;
  const firstSize = sizes?.[0];
  const sizePricing = firstSize?.pricing;
  const entryPricing = availableAt?.pricing;
  const defaultSize =
    firstSize?.size || (api.volumeMl ? `${api.volumeMl}ml` : undefined);

  const websitePrice =
    sizePricing?.websitePrice ||
    entryPricing?.websitePrice ||
    api.priceRange?.min ||
    0;
  const compareAtPrice =
    sizePricing?.originalWebsitePrice ||
    entryPricing?.compareAtPrice ||
    entryPricing?.originalWebsitePrice ||
    api.originPrice ||
    api.priceRange?.max ||
    websitePrice;

  const serverSale = toBoolean(api.sale) || toBoolean(api.isOnSale) || toBoolean(availableAt?.isOnSale);
  const saleDiscountValue =
    availableAt?.saleDiscountValue || api.discount?.value || 0;
  const derivedDiscount =
    compareAtPrice > websitePrice && websitePrice > 0
      ? Math.round((1 - websitePrice / compareAtPrice) * 100)
      : 0;
  const sale = serverSale || derivedDiscount > 0;
  const discount = sale ? Math.max(saleDiscountValue, derivedDiscount) : 0;
  const price = sale && discount > 0
    ? Math.round(websitePrice * (1 - Math.min(discount, 100) / 100))
    : websitePrice;

  const { totalStock, availableStock, totalSold } = computeStock(api);

  return {
    _id: api._id,
    slug: api.slug,
    name: api.name,
    price,
    originPrice: compareAtPrice,
    sale,
    discount,
    thumbImage,
    primaryImage: api.primaryImage,
    category: api.category,
    averageRating: api.averageRating || 0,
    reviewCount: api.reviewCount || 0,
    isNew: computeIsNew(api),
    totalSold,
    totalStock,
    availableStock,
    sizes,
    defaultSize,
    abv: api.abv,
    isAlcoholic: api.isAlcoholic,
    originCountry: api.originCountry,
    volumeMl: api.volumeMl,
    availableAt: api.availableAt,
    tenantCount: api.availableAt?.length ?? 0,
  };
};

/** Defense-in-depth: keep only products the API explicitly flagged as featured. */
export const filterFeatured = (products: ApiProduct[]): ApiProduct[] =>
  products.filter((p) => toBoolean(p.isFeatured));