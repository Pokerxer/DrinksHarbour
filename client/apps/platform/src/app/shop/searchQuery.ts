// Shared shop search-query builder + response parser.
//
// Used by BOTH the server component (shop/page.tsx, to SSR the initial product
// grid so crawlers see real product cards + links) and the client component
// (ShopClient.tsx, for filter/sort re-fetches). Keeping the logic here means the
// server-seeded HTML and the client's first fetch target an identical URL, so
// React hydration matches and we can safely skip the client's initial fetch.

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
export function buildShopSearchParams(sp: URLSearchParams): URLSearchParams {
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

  // Fetch a wider slice when a sort is active (sorts run server-side before
  // pagination, so the returned page is already the correct top-N).
  const hasActiveSort = Boolean(frontendSort);
  p.set('limit', sale === 'true' ? '200' : hasActiveSort ? '150' : '80');

  return p;
}

// Normalise the various response shapes the search API may return.
export function parseProductsResponse(data: any): { products: any[]; total: number } {
  if (data?.success && data?.data?.products) {
    const products = data.data.products;
    return { products, total: data.data.pagination?.total ?? products.length };
  }
  if (data?.success && data?.data?.data) {
    const products = data.data.data;
    return { products, total: data.data.pagination?.total ?? products.length };
  }
  if (Array.isArray(data?.products)) {
    return { products: data.products, total: data.products.length };
  }
  if (Array.isArray(data)) {
    return { products: data, total: data.length };
  }
  return { products: [], total: 0 };
}
