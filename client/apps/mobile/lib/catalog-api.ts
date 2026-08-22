import { apiFetch } from './api-client.ts';

/**
 * Catalog reads for Home and product detail.
 *
 * Mirrors the auth-api.ts contract proven in Phase 2: every call returns a
 * discriminated union and NEVER throws, so a home block can render an error
 * state without a try/catch in the component.
 *
 * It also absorbs the server's three different list envelopes in one place.
 * The web app re-implements that branch per component; doing the same here
 * would guarantee the two drift.
 */

export type CatalogResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface RawProduct {
  _id: string;
  slug?: string;
  name?: string;
  description?: string;
  primaryImage?: { url?: string } | null;
  images?: Array<{ url?: string }> | null;
  availableAt?: unknown[];
  priceRange?: { min?: number; max?: number } | null;
  [key: string]: unknown;
}

export interface CategorySummary {
  _id: string;
  name: string;
  slug: string;
  image: string | null;
}

/** Every field `Banner/HeroBanner.tsx` and `Banner/PlacementBanner.tsx` read. */
export interface RawBanner {
  _id: string;
  title: string;
  subtitle?: string;
  description?: string;
  type?: string;
  placement?: string;
  ctaText?: string;
  ctaLink?: string;
  ctaStyle?: string;
  linkType?: string;
  backgroundColor?: string;
  textColor?: string;
  overlayOpacity?: number;
  textAlignment?: string;
  contentPosition?: string;
  image?: { url?: string; alt?: string } | string;
  mobileImage?: { url?: string } | string;
  priority?: string;
  autoplay?: { enabled?: boolean; interval?: number };
}

const GENERIC_ERROR = 'Could not load right now.';

/** An image field is sometimes `{ url }`, sometimes a bare string, often absent. */
function imageUrlOf(value: unknown): string | null {
  if (typeof value === 'string' && value) return value;
  const url = (value as { url?: unknown } | null)?.url;
  return typeof url === 'string' && url ? url : null;
}

interface Fetched {
  status: number | null;
  payload: unknown;
}

async function get(path: string): Promise<Fetched> {
  try {
    const response = await apiFetch(path);
    try {
      return { status: response.status, payload: await response.json() };
    } catch {
      // A 200 that is not JSON — a proxy error page, typically.
      return { status: null, payload: null };
    }
  } catch {
    // fetch rejected: no response exists at all.
    return { status: null, payload: null };
  }
}

function failed({ status }: Fetched): boolean {
  return status === null || status < 200 || status >= 300;
}

function messageOf(payload: unknown): string {
  const message = (payload as { message?: unknown } | null)?.message;
  return typeof message === 'string' && message ? message : GENERIC_ERROR;
}

/**
 * The three shapes, in the order they occur:
 *   { data: { products: [...] } }  featured, bestsellers, trending, onSale
 *   { data: [...] }                banners, via successResponse()
 *   [...]                          defensive: a bare array body
 */
function readList(payload: unknown, key: string): unknown[] {
  const root = payload as Record<string, any> | null;
  const data = root?.data;
  if (Array.isArray(data?.[key])) return data[key];
  if (Array.isArray(data)) return data;
  if (Array.isArray(root?.[key])) return root![key];
  if (Array.isArray(root)) return root as unknown[];
  return [];
}

async function getProducts(path: string): Promise<CatalogResult<RawProduct[]>> {
  const result = await get(path);
  if (failed(result)) return { ok: false, error: messageOf(result.payload) };
  return { ok: true, data: readList(result.payload, 'products') as RawProduct[] };
}

/**
 * Admin-curated featured products.
 *
 * `?isFeatured=true` on the SEARCH endpoint, not `/api/products/featured` —
 * that is the query `apps/platform/src/app/page.tsx:87` runs, and it is the one
 * that returns the `isFeatured` flag the card layer re-checks before rendering.
 */
export async function fetchFeaturedProducts(limit = 8): Promise<CatalogResult<RawProduct[]>> {
  return getProducts(`/api/products?isFeatured=true&limit=${limit}`);
}

/**
 * "Hot Deals". `sortBy=discount` surfaces products with an active promotion
 * first, then backfills with the rest of the catalog so the grid is never empty
 * (page.tsx:59).
 */
export async function fetchHotDeals(limit = 12): Promise<CatalogResult<RawProduct[]>> {
  return getProducts(`/api/products?sortBy=discount&limit=${limit}`);
}

export async function fetchBestsellers(limit = 12): Promise<CatalogResult<RawProduct[]>> {
  return getProducts(`/api/products/bestsellers?limit=${limit}`);
}

export async function fetchTrendingProducts(limit = 12): Promise<CatalogResult<RawProduct[]>> {
  return getProducts(`/api/products/trending?limit=${limit}`);
}

export async function fetchNewArrivals(limit = 12): Promise<CatalogResult<RawProduct[]>> {
  return getProducts(`/api/products/new-arrivals?limit=${limit}`);
}

/**
 * Personalised picks — signed-in only. The web falls back to `trending` when
 * this returns nothing, and so does the block that calls it.
 */
export async function fetchPersonalRecommendations(
  limit = 12
): Promise<CatalogResult<RawProduct[]>> {
  return getProducts(`/api/user/recommendations?limit=${limit}`);
}

/**
 * Flash sale. There is no promotions endpoint — promotion.routes.js exposes only
 * /stats, /calculate-discount, /validate-code, /code/:code and /subproduct/:id.
 * The web block (Home1/FlashSale.tsx:397) calls exactly this. Do not "fix" it.
 */
export async function fetchOnSaleProducts(): Promise<CatalogResult<RawProduct[]>> {
  return getProducts('/api/products?onSale=true&limit=20&inStock=false');
}

/** One page of search results — `ModalSearchContext.tsx`'s `SearchResult`. */
export interface SearchPage {
  products: RawProduct[];
  total: number;
  page: number;
  totalPages: number;
}

const EMPTY_PAGE: SearchPage = { products: [], total: 0, page: 1, totalPages: 0 };

/**
 * Free-text product search — the endpoint the web's search modal calls
 * (`ModalSearchContext.tsx:291`), backed by `productController.searchProductsPublic`.
 *
 * NOT `/api/products?search=`. That parameter is silently IGNORED by the plain
 * list endpoint: measured 2026-08-19 against the live backend, "medoc",
 * "zzzzznonsense" and an empty string all returned the identical default page.
 * This endpoint's free-text $match runs across country, region, appellation,
 * producer, vintage, cask, style and tasting notes — which is why it can return
 * a bottle for "médoc" or "smoky" when the name says neither.
 *
 * A blank term short-circuits rather than asking the server for everything: the
 * web shows its default panel until something is typed, and a search-as-you-type
 * field would otherwise fire a full catalogue read on every cleared input.
 */
export async function searchProducts(
  term: string,
  opts: { page?: number; limit?: number } = {}
): Promise<CatalogResult<SearchPage>> {
  const query = term.trim();
  if (!query) return { ok: true, data: EMPTY_PAGE };

  const page = opts.page ?? 1;
  const limit = opts.limit ?? 8; // the web's page size
  const result = await get(
    `/api/products/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`
  );
  if (failed(result)) return { ok: false, error: messageOf(result.payload) };

  const products = readList(result.payload, 'products') as RawProduct[];
  const pagination =
    ((result.payload as Record<string, any> | null)?.data?.pagination as
      | Record<string, unknown>
      | undefined) ?? {};

  // Same fallbacks as ModalSearchContext.tsx:302-307 — `total` degrades to the
  // number of rows actually returned, never to 0, so the count strip cannot
  // claim "0 products found" above a list of products.
  const num = (value: unknown, fallback: number): number =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;

  return {
    ok: true,
    data: {
      products,
      total: num(pagination.totalResults, products.length),
      page: num(pagination.currentPage, page),
      totalPages: num(pagination.totalPages, 1),
    },
  };
}

/**
 * Type-ahead suggestions — `product.routes.js:133`, which answers with a bare
 * array of product names under `data`.
 *
 * Below two characters the web does not ask at all (`ModalSearchContext.tsx:420`);
 * every one-letter keystroke would otherwise be a catalogue-wide prefix scan.
 */
export async function fetchSearchSuggestions(
  term: string,
  limit = 8
): Promise<CatalogResult<string[]>> {
  const query = term.trim();
  if (query.length < 2) return { ok: true, data: [] };

  const result = await get(
    `/api/products/suggestions?q=${encodeURIComponent(query)}&limit=${limit}`
  );
  if (failed(result)) return { ok: false, error: messageOf(result.payload) };

  const raw = (result.payload as Record<string, any> | null)?.data;
  const list = Array.isArray(raw) ? raw : [];
  return { ok: true, data: list.filter((s): s is string => typeof s === 'string' && s !== '') };
}

function toCategory(raw: unknown): CategorySummary | null {
  const c = raw as Record<string, any> | null;
  if (!c?._id || !c?.slug) return null;
  return {
    _id: String(c._id),
    name: typeof c.name === 'string' ? c.name : '',
    slug: String(c.slug),
    image: imageUrlOf(c.image),
  };
}

/**
 * /featured returns [] when nothing is flagged, which would render an empty rail.
 * Falling back to the full category list keeps the rail populated; the web app
 * does the same.
 */
export async function fetchFeaturedCategories(): Promise<CatalogResult<CategorySummary[]>> {
  const featured = await get('/api/categories/featured');

  if (!failed(featured)) {
    const mapped = readList(featured.payload, 'categories')
      .map(toCategory)
      .filter((c): c is CategorySummary => c !== null);
    if (mapped.length) return { ok: true, data: mapped };
  }

  const all = await get('/api/categories');
  if (failed(all)) return { ok: false, error: messageOf(all.payload) };

  return {
    ok: true,
    data: readList(all.payload, 'categories')
      .map(toCategory)
      .filter((c): c is CategorySummary => c !== null),
  };
}

/**
 * `placement` is the models/Banner.js:62 enum; only these two exist on Home.
 *
 * Unlike the Phase-3 version this does NOT drop banners without artwork: both
 * web components fall back to `backgroundColor` and still render their copy and
 * CTA, so dropping them would lose a working promotion.
 */
export async function fetchBanners(
  placement: 'home_hero' | 'home_secondary',
  limit = 5
): Promise<CatalogResult<RawBanner[]>> {
  const result = await get(`/api/banners/placement/${placement}?limit=${limit}`);
  if (failed(result)) return { ok: false, error: messageOf(result.payload) };

  const banners = readList(result.payload, 'banners')
    .map((raw): RawBanner | null => {
      const b = raw as Record<string, any> | null;
      if (!b?._id) return null;
      return { ...b, _id: String(b._id), title: typeof b.title === 'string' ? b.title : '' };
    })
    .filter((b): b is RawBanner => b !== null);

  return { ok: true, data: banners };
}

/** The one image a banner shows, honouring `mobileImage` when the API set one. */
export function bannerImageUrl(banner: RawBanner): string | null {
  return (
    imageUrlOf(banner.mobileImage) ??
    imageUrlOf(banner.image) ??
    imageUrlOf((banner as unknown as Record<string, unknown>).imageUrl)
  );
}

/**
 * Impression / click beacons. Fire-and-forget by design — CTR telemetry must
 * never be able to block or fail a render, which is exactly how the web treats
 * them (`.catch(() => {})` at both call sites).
 */
function beacon(path: string): void {
  void apiFetch(path, { method: 'POST' }).catch(() => {});
}

export function trackBannerImpression(bannerId: string): void {
  if (!bannerId || bannerId.startsWith('fallback')) return;
  beacon(`/api/banners/${bannerId}/impression`);
}

export function trackBannerClick(bannerId: string): void {
  if (!bannerId || bannerId.startsWith('fallback')) return;
  beacon(`/api/banners/${bannerId}/click`);
}

/**
 * The ONLY endpoint that publishes pack fields — see the quickview-pack-pricing
 * memory. Product detail must use it rather than a list projection.
 */
export async function fetchProductBySlug(slug: string): Promise<CatalogResult<RawProduct>> {
  const result = await get(`/api/products/slug/${encodeURIComponent(slug)}`);
  if (failed(result)) return { ok: false, error: messageOf(result.payload) };

  const product = (result.payload as Record<string, any> | null)?.data?.product;
  if (!product?._id) return { ok: false, error: GENERIC_ERROR };

  return { ok: true, data: product as RawProduct };
}
