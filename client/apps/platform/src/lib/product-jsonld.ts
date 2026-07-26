// JSON-LD builders for product *list* surfaces (the homepage sections today,
// any future carousel tomorrow).
//
// Detail-page Product markup lives in app/product/[slug]/page.tsx and stays
// there — it has the full document (all images, GTINs, reviews, shipping) to
// work with. This module builds the leaner Product-inside-ItemList shape Google
// reads for a page that links out to those detail pages, so the homepage grids
// expose their price / stock / rating instead of being invisible to crawlers.
//
// Google policy: structured data must match what a visitor actually sees. Every
// field here is derived from the same values the cards render, and anything we
// can't source honestly (a rating with no reviews behind it) is omitted rather
// than guessed.

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.drinksharbour.com';
const SITE_NAME = 'DrinksHarbour';

type AnyProduct = Record<string, any>;

// The price the card shows. Mirrors FeaturedDeals' calcPricing: the backend
// attaches an active promotion to a specific size on a specific tenant offer,
// which isn't necessarily availableAt[0].sizes[0], so scan for the best-savings
// size first and fall back to the first one for a plain (undiscounted) price.
export function listPrice(p: AnyProduct): number {
  let bestSize: AnyProduct | undefined;
  let bestSavings = -1;

  for (const offer of p.availableAt || []) {
    for (const size of offer.sizes || []) {
      const savings = size.discount?.hasDiscount ? size.discount?.savings ?? 0 : 0;
      if (savings > bestSavings) {
        bestSavings = savings;
        bestSize = size;
      }
    }
  }
  if (!bestSize) bestSize = (p.availableAt || [])[0]?.sizes?.[0];

  return bestSize?.pricing?.websitePrice || p.priceRange?.min || p.price || 0;
}

// Availability. `availability` is a string on the detail-page document but an
// object on list payloads, and normalizeProduct() synthesises the object form —
// handle both. An absent flag means "no signal", which we read as in stock,
// matching how the cards render.
export function isInStock(p: AnyProduct): boolean {
  const status = typeof p.availability === 'string' ? p.availability : p.availability?.status;
  if (status === 'out_of_stock') return false;
  if (p.status === 'out_of_stock') return false;
  if (p.isInStock === false) return false;
  return true;
}

function imageUrl(p: AnyProduct): string | undefined {
  return (
    p.primaryImage?.url ||
    p.images?.find((i: AnyProduct) => i?.isPrimary)?.url ||
    p.images?.[0]?.url ||
    undefined
  );
}

function brandName(p: AnyProduct): string {
  return typeof p.brand === 'string' ? p.brand : p.brand?.name || '';
}

// The Product a ListItem points at. Returns null for anything we can't address
// by URL — a list entry with no `url` is useless to a crawler.
export function buildListProduct(p: AnyProduct): { url: string; product: object } | null {
  const slug = p.slug || p._id;
  if (!slug || !p.name) return null;

  const url = `${BASE_URL}/product/${slug}`;
  const image = imageUrl(p);
  const price = listPrice(p);
  const brand = brandName(p);
  const rating = p.averageRating ?? p.rating ?? 0;
  const reviewCount = p.reviewCount ?? 0;

  const product: Record<string, any> = {
    '@type': 'Product',
    name: p.name,
    url,
    ...(image ? { image } : {}),
    ...(brand ? { brand: { '@type': 'Brand', name: brand } } : {}),
    ...(p.sku ? { sku: p.sku } : {}),
    itemCondition: 'https://schema.org/NewCondition',
  };

  if (price > 0) {
    product.offers = {
      '@type': 'Offer',
      price,
      priceCurrency: p.priceRange?.currency || 'NGN',
      availability: isInStock(p)
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url,
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: SITE_NAME, url: BASE_URL },
      areaServed: { '@type': 'Country', name: 'Nigeria' },
    };
  }

  // Only real ratings. The cards fall back to a cosmetic "4.5" when a product
  // has no reviews; emitting that would be a fabricated rating and is exactly
  // what Google's review-snippet policy prohibits.
  if (rating > 0 && reviewCount > 0) {
    product.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(rating).toFixed(1),
      reviewCount,
      bestRating: '5',
      worstRating: '1',
    };
  }

  return { url, product };
}

/**
 * Build an ItemList of products for a list/summary page.
 *
 * Products are deduped by id so a title appearing in two sections is listed
 * once, and capped so a long grid doesn't bloat the HTML payload.
 */
export function buildProductItemList({
  id,
  name,
  products,
  limit = 24,
}: {
  id: string;
  name: string;
  products: AnyProduct[];
  limit?: number;
}): object | null {
  const seen = new Set<string>();
  const itemListElement: object[] = [];

  for (const p of products) {
    const key = String(p?.slug || p?._id || '');
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const built = buildListProduct(p);
    if (!built) continue;

    // Positions are assigned after the null filter so they stay contiguous.
    itemListElement.push({
      '@type': 'ListItem',
      position: itemListElement.length + 1,
      url: built.url,
      item: built.product,
    });
    if (itemListElement.length >= limit) break;
  }

  if (itemListElement.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': id,
    name,
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    numberOfItems: itemListElement.length,
    itemListElement,
  };
}
