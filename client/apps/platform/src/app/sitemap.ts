import type { MetadataRoute } from "next";
import { getPosts } from "./blog/api";
import { categoryHasProducts } from "./shop/taxonomy";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.drinksharbour.com";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

// Next.js interpolates entry.url straight into <loc> without XML-escaping, so a
// raw `&` (e.g. in the combined ?category=..&subcategory=.. URLs) produces
// invalid XML and Google rejects the whole sitemap. Escape the five XML-reserved
// characters ourselves. `&` must be replaced first so we don't double-encode.
function xmlEscapeUrl(url: string): string {
  return url
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Primary category slugs that have dedicated metadata in generateMetadata
const CATEGORY_SLUGS = [
  // `scotch-whisky` intentionally omitted — it's a duplicate of `scotch` (which
  // canonicalizes it), so we don't advertise the phantom URL in the sitemap.
  "scotch", "whisky", "whiskey",
  "wine", "champagne", "red-wine", "white-wine",
  "vodka", "rum", "gin", "tequila", "cognac", "brandy",
  "beer", "cider", "liqueur", "non-alcoholic", "gift-sets",
  "irish-whiskey", "japanese-whisky", "bourbon", "rye-whiskey", "world-whisky",
];

// A truthful <lastmod> (the document's updatedAt) or none at all — advertising
// "modified just now" for every URL on every crawl teaches Google to ignore
// the field entirely.
function realDate(value?: string | Date): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

interface SlugEntry {
  slug: string;
  updatedAt?: string;
}

/**
 * Sellable product slugs, plus per-brand sellable counts from the same call.
 *
 * `brandCounts` is keyed by brand slug and only contains brands with at least
 * one buyable product — it is NOT the stored Brand.productCount, which counts
 * linked products whether or not any can be bought.
 */
async function fetchProducts(): Promise<{
  items: SlugEntry[];
  brandCounts: Record<string, number> | null;
}> {
  try {
    const res = await fetch(`${API_URL}/api/products/slugs`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return { items: [], brandCounts: null };
    const data = await res.json();
    const brandCounts =
      data?.data?.brandCounts && typeof data.data.brandCounts === "object"
        ? (data.data.brandCounts as Record<string, number>)
        : null;
    // Newer API shape: items carry updatedAt alongside the slug
    if (Array.isArray(data?.data?.items)) {
      return {
        items: data.data.items.filter((p: SlugEntry) => p?.slug),
        brandCounts,
      };
    }
    const slugs: string[] = data?.data?.slugs ?? data?.slugs ?? [];
    return {
      items: Array.isArray(slugs) ? slugs.map((slug) => ({ slug })) : [],
      brandCounts,
    };
  } catch {
    return { items: [], brandCounts: null };
  }
}

async function fetchBrands(): Promise<SlugEntry[]> {
  try {
    const res = await fetch(`${API_URL}/api/brands?limit=200&page=1`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const brands: { slug?: string; updatedAt?: string }[] =
      data?.data?.brands ?? data?.data ?? data?.brands ?? [];
    return brands
      .filter((b) => b.slug)
      .map((b) => ({ slug: b.slug as string, updatedAt: b.updatedAt }));
  } catch {
    return [];
  }
}

// Published category slugs for the /categories/[slug] detail pages. These are
// listed IN ADDITION to the /shop?category= filter URLs (same rule as brands:
// both forms stay in the sitemap, each canonical for its own URL).
async function fetchCategories(): Promise<SlugEntry[]> {
  try {
    const res = await fetch(`${API_URL}/api/categories`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const cats: { slug?: string; updatedAt?: string }[] =
      data?.data?.categories ?? data?.data ?? data?.categories ?? [];
    return cats
      .filter((c) => c.slug)
      .map((c) => ({ slug: c.slug as string, updatedAt: c.updatedAt }));
  } catch {
    return [];
  }
}

interface SubcatEntry {
  slug: string;
  parentSlug: string;
  productCount: number;
  updatedAt?: string;
}

// Subcategories carry their parent category (populated), so the sitemap can
// advertise them in the SAME combined `?category=..&subcategory=..` form that
// generateMetadata canonicalizes to (and that the blog internal links use).
async function fetchSubcategories(): Promise<SubcatEntry[]> {
  try {
    const res = await fetch(`${API_URL}/api/subcategories?status=published`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const subs: {
      slug?: string;
      parent?: { slug?: string };
      productCount?: number;
      updatedAt?: string;
    }[] = data?.data?.subcategories ?? data?.data ?? [];
    return subs
      .map((s) => ({
        slug: s?.slug ?? '',
        parentSlug: s?.parent?.slug ?? '',
        productCount: s?.productCount ?? 0,
        updatedAt: s?.updatedAt,
      }))
      .filter((s) => s.slug && s.parentSlug);
  } catch {
    return [];
  }
}

interface VendorEntry {
  slug: string;
  productCount: number;
  updatedAt?: string;
}

// Vendor storefronts (/vendors/[slug]) are indexable pages served from the
// same /api/stores endpoint the public vendors directory uses. Only advertise
// stores that actually carry products — an empty storefront is a thin page.
async function fetchVendors(): Promise<VendorEntry[]> {
  try {
    const res = await fetch(`${API_URL}/api/stores?limit=200&page=1`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const stores: {
      slug?: string;
      productCount?: number;
      updatedAt?: string;
    }[] = data?.data?.stores ?? data?.data ?? data?.stores ?? [];
    return stores
      .filter((s) => s.slug)
      .map((s) => ({
        slug: s.slug as string,
        productCount: s.productCount ?? 0,
        updatedAt: s.updatedAt,
      }));
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages carry no lastModified — we have no real modification date for
  // them, and a fabricated one is worse than none.
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL,                                  changeFrequency: "daily",   priority: 1.0 },
    { url: `${BASE_URL}/shop`,                        changeFrequency: "hourly",  priority: 0.9 },
    { url: `${BASE_URL}/deals`,                       changeFrequency: "daily",   priority: 0.8 },
    { url: `${BASE_URL}/about`,                       changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/contact`,                     changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/blog`,                        changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE_URL}/faqs`,                        changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/careers`,                     changeFrequency: "weekly",  priority: 0.4 },
    { url: `${BASE_URL}/returns`,                     changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE_URL}/shipping-info`,               changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE_URL}/sustainability`,              changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE_URL}/brands`,                      changeFrequency: "weekly",  priority: 0.5 },
    { url: `${BASE_URL}/categories`,                  changeFrequency: "weekly",  priority: 0.5 },
    { url: `${BASE_URL}/privacy-policy`,              changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE_URL}/terms`,                       changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE_URL}/cookie-policy`,               changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE_URL}/vip-signup`,                  changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE_URL}/vendors`,                     changeFrequency: "weekly",  priority: 0.4 },
    { url: `${BASE_URL}/vendors/register`,            changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/vendors/register/apply`,      changeFrequency: "monthly", priority: 0.5 },
  ];

  const [productData, brands, categories, subcats, vendors, posts, categoryHasStock] =
    await Promise.all([
      fetchProducts(),
      fetchBrands(),
      fetchCategories(),
      fetchSubcategories(),
      fetchVendors(),
      getPosts(),
      // Probe each category against the same search the grid uses. `null` means
      // the API was unreachable — keep the URL rather than silently shrinking
      // the sitemap on a blip.
      Promise.all(
        CATEGORY_SLUGS.map(async (cat) => [cat, await categoryHasProducts(cat)] as const),
      ),
    ]);

  const products = productData.items;
  const brandCounts = productData.brandCounts;
  const categoryEmpty = new Map(categoryHasStock);

  const productPages: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${BASE_URL}/product/${p.slug}`,
    lastModified: realDate(p.updatedAt),
    changeFrequency: "daily",
    priority: 0.8,
  }));

  // Category shop pages — each has unique Nigeria-targeted metadata. The list
  // is static, so pull the matching catalog document's updatedAt when we have it.
  //
  // Skip slugs whose grid renders empty. The route noindexes some of them and
  // canonicalizes onto /shop (whiskey, cognac, cider, liqueur, gift-sets) but
  // leaves others indexable with a self-canonical (beer, rum, non-alcoholic) —
  // either way the sitemap shouldn't advertise a page with no products. The
  // stored Category.productCount is not usable here: it counts documents linked
  // to that exact category, so umbrella slugs like `whisky` and `wine` report
  // zero while their grids are full.
  const categoryDocs = new Map(categories.map((c) => [c.slug, c]));
  const categoryPages: MetadataRoute.Sitemap = CATEGORY_SLUGS.filter(
    (cat) => categoryEmpty.get(cat) !== false,
  ).map((cat) => ({
    url: `${BASE_URL}/shop?category=${cat}`,
    lastModified: realDate(categoryDocs.get(cat)?.updatedAt),
    changeFrequency: "daily",
    priority: 0.85,
  }));

  // Subcategory shop pages — combined category+subcategory form (the canonical
  // generateMetadata emits). Only list subcategories that actually have products;
  // empty ones are noindexed, so advertising them would waste crawl budget.
  const seenSubUrls = new Set<string>();
  const subcategoryPages: MetadataRoute.Sitemap = subcats
    .filter((s) => s.productCount > 0)
    .filter((s) => {
      const url = `${BASE_URL}/shop?category=${s.parentSlug}&subcategory=${s.slug}`;
      if (seenSubUrls.has(url)) return false;
      seenSubUrls.add(url);
      return true;
    })
    .map((s) => ({
      url: `${BASE_URL}/shop?category=${s.parentSlug}&subcategory=${s.slug}`,
      lastModified: realDate(s.updatedAt),
      changeFrequency: "daily" as const,
      priority: 0.8,
    }));

  // NOTE: the /categories/[slug] and /categories/[slug]/[subSlug] detail pages
  // are deliberately NOT listed. They render the same products as the
  // /shop?category=[&subcategory=] URLs above and now canonicalize onto them,
  // and a sitemap must only advertise canonical URLs — listing both is what was
  // splitting crawl budget across near-duplicates. The pages stay live and
  // linked for visitors. The /categories hub itself is still listed above: it is
  // a unique index page with no shop equivalent.

  // Brand pages — the /brands/[slug] entity page only. The matching
  // /shop?brand=<slug> filter listed the same products and used to be emitted
  // alongside it, which split crawl budget across ~200 near-duplicate pairs.
  // /brands/ is the canonical form (it holds the internal links and the Brand
  // entity content), so it is the only one advertised; the shop filter now
  // canonicalizes onto it.
  //
  // Gated on having at least one *buyable* product, the same idea subcategories
  // and vendors already apply. A third of the brands render an entity blurb with
  // no product grid and no outbound product links — thin pages that spend crawl
  // budget without earning it.
  //
  // The gate uses brandCounts (computed under the sellability rule) rather than
  // the stored Brand.productCount, which counts linked products regardless of
  // whether any can be bought: "19 Crimes" reports 1 and renders nothing. If the
  // API didn't return brandCounts, fall back to listing every brand rather than
  // emptying this section of the sitemap.
  const brandPages: MetadataRoute.Sitemap = brands
    .filter((b) => !brandCounts || (brandCounts[b.slug] ?? 0) > 0)
    .map((b) => ({
      url: `${BASE_URL}/brands/${b.slug}`,
      lastModified: realDate(b.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

  // Vendor storefront pages — /vendors/[slug]. Gated on productCount>0 so we
  // don't advertise empty stores.
  const vendorPages: MetadataRoute.Sitemap = vendors
    .filter((v) => v.productCount > 0)
    .map((v) => ({
      url: `${BASE_URL}/vendors/${v.slug}`,
      lastModified: realDate(v.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

  const blogPages: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [
    ...staticPages,
    ...categoryPages,
    ...subcategoryPages,
    ...brandPages,
    ...vendorPages,
    ...productPages,
    ...blogPages,
  ].map((entry) => ({ ...entry, url: xmlEscapeUrl(entry.url) }));
}
