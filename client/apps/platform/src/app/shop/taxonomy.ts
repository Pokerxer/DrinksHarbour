// DB-driven taxonomy resolution for the shop's SEO surfaces (generateMetadata,
// the server-computed <h1> seed and JSON-LD).
//
// Categories, subcategories and brands are documents in MongoDB — the database
// is the source of truth for WHICH pages exist and what they are called. The
// static label maps in page.tsx are only keyword enrichment layered on top of a
// resolved DB entry; they can never create a category page the catalog doesn't
// have. Admins override any page's SEO by setting metaTitle / metaDescription /
// metaKeywords on the document.
//
// Umbrella slugs (?category=wines, ?category=spirits) have no document of their
// own: they resolve to the set of DB categories whose `type` matches the family
// pattern (same patterns the backend filter uses in searchFilter.helper.js).

import { CATEGORY_TYPE_GROUPS } from '@/utils/categoryGroups';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export interface DbCategory {
  name: string;
  slug: string;
  type?: string;
  description?: string;
  shortDescription?: string;
  tagline?: string;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string[];
  productCount?: number;
}

export interface DbSubCategory {
  name: string;
  slug: string;
  description?: string;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string[];
  parent?: { name?: string; slug?: string };
  productCount?: number;
}

export interface DbBrand {
  name: string;
  slug: string;
  tagline?: string;
  shortDescription?: string;
  description?: string;
  metaTitle?: string;
  metaDescription?: string;
}

// null = API unreachable (fall back to static behaviour, never noindex on an
// outage); [] / undefined results = API answered and the thing doesn't exist.
async function getJson(path: string, revalidate = 3600): Promise<any | null> {
  if (!API_URL) return null;
  try {
    const res = await fetch(`${API_URL}${path}`, { next: { revalidate } });
    if (res.status === 404) return { notFound: true };
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// One cached fetch of the published category list powers slug lookup, umbrella
// expansion and keyword generation from real catalog names. Next.js dedupes
// the identical fetch between generateMetadata and the page render.
export async function fetchCategories(): Promise<DbCategory[] | null> {
  const data = await getJson('/api/categories');
  if (!data) return null;
  const cats = data?.data?.categories;
  return Array.isArray(cats) ? cats : null;
}

export type CategoryResolution =
  | { kind: 'db'; category: DbCategory }
  | { kind: 'umbrella'; slug: string; members: DbCategory[] }
  | { kind: 'unknown' } // API answered: this slug isn't in the catalog
  | { kind: 'offline' }; // API unreachable: keep legacy static behaviour

export async function resolveCategorySlug(raw: string): Promise<CategoryResolution> {
  const slug = raw.toLowerCase().trim();
  const cats = await fetchCategories();
  if (cats === null) return { kind: 'offline' };

  const bySlug = (s: string) => cats.find((c) => c.slug?.toLowerCase() === s);
  const exact =
    bySlug(slug) ??
    // De-pluralized fallback mirrors the backend filter ("vodkas" → "vodka").
    (slug.length > 3 && slug.endsWith('s') ? bySlug(slug.slice(0, -1)) : undefined);
  if (exact) return { kind: 'db', category: exact };

  const pattern = CATEGORY_TYPE_GROUPS[slug];
  if (pattern) {
    const re = new RegExp(pattern, 'i');
    const members = cats.filter((c) => c.type && re.test(c.type));
    if (members.length) return { kind: 'umbrella', slug, members };
  }

  return { kind: 'unknown' };
}

export async function fetchSubCategoryBySlug(raw: string): Promise<DbSubCategory | null | 'offline'> {
  const slug = raw.toLowerCase().trim().replace(/\s+/g, '-');
  const candidates = [slug];
  if (slug.length > 3 && slug.endsWith('s')) candidates.push(slug.slice(0, -1));
  for (const s of candidates) {
    const data = await getJson(`/api/subcategories/slug/${encodeURIComponent(s)}`);
    if (data === null) return 'offline';
    if (data.notFound) continue;
    const sub = data?.data;
    if (sub?.name) return sub as DbSubCategory;
  }
  return null;
}

// A subcategory slug with no document of its own may still be a prefix family
// the filter resolves (e.g. "single-malt" → single-malt-scotch, …). Probe the
// same search endpoint the grid uses so metadata and grid always agree.
// true = family has products; false = filter matches nothing; null = offline.
export async function subFamilyHasProducts(raw: string): Promise<boolean | null> {
  const slug = raw.toLowerCase().trim().replace(/\s+/g, '-');
  const data = await getJson(
    `/api/products/search?subCategory=${encodeURIComponent(slug)}&limit=1`,
    900,
  );
  if (data === null) return null;
  const products = data?.data?.products;
  return Array.isArray(products) && products.length > 0;
}

// The shop `brand` URL param carries the brand *name* — same lookup the hero
// banner uses client-side: search, prefer an exact case-insensitive name match.
export async function fetchBrandByName(name: string): Promise<DbBrand | null | 'offline'> {
  const data = await getJson(
    `/api/brands?search=${encodeURIComponent(name)}&limit=5&status=active`,
  );
  if (data === null) return 'offline';
  const brands: DbBrand[] = data?.data?.brands || data?.brands || [];
  const key = name.toLowerCase().trim();
  return (
    brands.find((b) => b.name?.toLowerCase() === key) ??
    brands.find((b) => b.slug?.toLowerCase() === key.replace(/\s+/g, '-')) ??
    brands[0] ??
    null
  );
}

// Keywords generated from the real catalog name — always true to the DB.
export function generatedKeywords(label: string): string[] {
  const l = label.toLowerCase();
  return [
    `buy ${l} Nigeria`,
    `${l} online Nigeria`,
    `${l} delivery Nigeria`,
    `${l} price Nigeria`,
    `best ${l} Nigeria`,
    `buy ${l} Lagos`,
    `buy ${l} Abuja`,
    `order ${l} Nigeria`,
  ];
}
