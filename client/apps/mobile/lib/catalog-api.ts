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

export interface BannerSummary {
  _id: string;
  title: string;
  image: string | null;
  linkUrl: string | null;
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

export async function fetchFeaturedProducts(): Promise<CatalogResult<RawProduct[]>> {
  return getProducts('/api/products/featured?limit=12');
}

export async function fetchBestsellers(): Promise<CatalogResult<RawProduct[]>> {
  return getProducts('/api/products/bestsellers?limit=12');
}

export async function fetchTrendingProducts(): Promise<CatalogResult<RawProduct[]>> {
  return getProducts('/api/products/trending?limit=12');
}

/**
 * Flash sale. There is no promotions endpoint — promotion.routes.js exposes only
 * /stats, /calculate-discount, /validate-code, /code/:code and /subproduct/:id.
 * The web block (Home1/FlashSale.tsx:397) calls exactly this. Do not "fix" it.
 */
export async function fetchOnSaleProducts(): Promise<CatalogResult<RawProduct[]>> {
  return getProducts('/api/products?onSale=true&limit=20&inStock=false');
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

/** `placement` is the models/Banner.js:62 enum; only these two exist on Home. */
export async function fetchBanners(
  placement: 'home_hero' | 'home_secondary'
): Promise<CatalogResult<BannerSummary[]>> {
  const result = await get(`/api/banners/placement/${placement}`);
  if (failed(result)) return { ok: false, error: messageOf(result.payload) };

  const banners = readList(result.payload, 'banners')
    .map((raw): BannerSummary | null => {
      const b = raw as Record<string, any> | null;
      const image = imageUrlOf(b?.image) ?? imageUrlOf(b?.imageUrl);
      // A slide with no artwork is a grey rectangle. Drop it.
      if (!b?._id || !image) return null;
      return {
        _id: String(b._id),
        title: typeof b.title === 'string' ? b.title : '',
        image,
        linkUrl: typeof b.linkUrl === 'string' && b.linkUrl ? b.linkUrl : null,
      };
    })
    .filter((b): b is BannerSummary => b !== null);

  return { ok: true, data: banners };
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
