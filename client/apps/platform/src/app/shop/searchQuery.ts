// Shared shop search-query builder + response parser.
//
// Used by BOTH the server component (shop/page.tsx, to SSR the initial product
// grid so crawlers see real product cards + links) and the client component
// (ShopClient.tsx, for filter/sort re-fetches). One builder means the filter
// translation can never drift between the two.
//
// The two callers deliberately ask for different slice sizes: the server takes
// SHOP_PAGE_SIZE (one grid page) so the SSR'd HTML stays small, and the client
// pulls SHOP_WORKING_SET in the background after mount to power client-side
// filtering/sorting. Everything except the limit is identical.

// One grid page. Must match the `productPerPage` passed to <Shop>.
export const SHOP_PAGE_SIZE = 24;

// Upper bound on the client's background "working set" fetch — the products
// held in memory so filtering/sorting/pagination can run without a round-trip.
export const SHOP_WORKING_SET = 1000;

export interface ShopQueryOptions {
  /** Products per request. Defaults to the whole working set. */
  limit?: number;
  /** 1-based page number, sent through as the API's `page` param. */
  page?: number;
}

// Frontend sort key → backend sort key
export const SORT_MAP: Record<string, string> = {
  newest:            'newest',
  priceLowToHigh:    'price_low',
  priceHighToLow:    'price_high',
  discountHighToLow: 'discount',
  bestselling:       'bestselling',
  popularity:        'popular',
  rating:            'rating',
  alphabetical:      'name_asc',
  alphabeticalDesc:  'name_desc',
};

// Translate the page's URL search params into the `/api/products/search` query.
export function buildShopSearchParams(
  sp: URLSearchParams,
  opts: ShopQueryOptions = {},
): URLSearchParams {
  const p = new URLSearchParams();

  const q = sp.get('search');
  if (q?.trim())              p.set('q',           q.trim());
  if (sp.get('category'))     p.set('category',    sp.get('category')!);
  if (sp.get('subcategory'))  p.set('subCategory', sp.get('subcategory')!);
  if (sp.get('brand'))        p.set('brand',       sp.get('brand')!);
  if (sp.get('origin'))       p.set('origin',      sp.get('origin')!);
  if (sp.get('flavor'))       p.set('flavor',      sp.get('flavor')!);
  if (sp.get('volume'))       p.set('volume',      sp.get('volume')!);
  if (sp.get('size'))         p.set('size',        sp.get('size')!);

  const frontendSort = sp.get('sort') || '';
  const backendSort  = SORT_MAP[frontendSort] || '';
  if (backendSort) p.set('sort', backendSort);

  const sale = sp.get('sale');
  if (sale === 'true') {
    p.set('onSale', 'true');
    // Do NOT pass saleType — the client fetches ALL sale products once and
    // filters sale tabs client-side so tab switching never triggers a refetch.
  }

  if (sp.get('minPrice'))  p.set('minPrice',  sp.get('minPrice')!);
  if (sp.get('maxPrice'))  p.set('maxPrice',  sp.get('maxPrice')!);
  if (sp.get('minABV'))    p.set('minABV',    sp.get('minABV')!);
  if (sp.get('maxABV'))    p.set('maxABV',    sp.get('maxABV')!);
  if (sp.get('minRating')) p.set('minRating', sp.get('minRating')!);

  p.set('limit', String(opts.limit ?? SHOP_WORKING_SET));
  if (opts.page && opts.page > 1) p.set('page', String(opts.page));

  return p;
}

export interface ShopSearchResult {
  products: any[];
  /** Total products matching the query, across all pages. */
  total: number;
  /** 1-based page count for the current query, or 1 when unknown. */
  totalPages: number;
}

// The grand total lives in `pagination.totalResults`. The old code read
// `pagination.total`, which the API has never returned — so every caller
// silently fell back to counting the products it happened to receive.
function readPagination(pagination: any, received: number): { total: number; totalPages: number } {
  const total = typeof pagination?.totalResults === 'number' ? pagination.totalResults : received;
  const totalPages =
    typeof pagination?.totalPages === 'number' && pagination.totalPages > 0
      ? pagination.totalPages
      : 1;
  return { total, totalPages };
}

// Normalise the various response shapes the search API may return.
export function parseProductsResponse(data: any): ShopSearchResult {
  if (data?.success && data?.data?.products) {
    const products = data.data.products;
    return { products, ...readPagination(data.data.pagination, products.length) };
  }
  if (data?.success && data?.data?.data) {
    const products = data.data.data;
    return { products, ...readPagination(data.data.pagination, products.length) };
  }
  if (Array.isArray(data?.products)) {
    return { products: data.products, total: data.products.length, totalPages: 1 };
  }
  if (Array.isArray(data)) {
    return { products: data, total: data.length, totalPages: 1 };
  }
  return { products: [], total: 0, totalPages: 1 };
}
