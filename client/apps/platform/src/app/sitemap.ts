import type { MetadataRoute } from "next";
import { getPosts } from "./blog/api";

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

async function fetchProducts(): Promise<SlugEntry[]> {
  try {
    const res = await fetch(`${API_URL}/api/products/slugs`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    // Newer API shape: items carry updatedAt alongside the slug
    if (Array.isArray(data?.data?.items)) {
      return data.data.items.filter((p: SlugEntry) => p?.slug);
    }
    const slugs: string[] = data?.data?.slugs ?? data?.slugs ?? [];
    return Array.isArray(slugs) ? slugs.map((slug) => ({ slug })) : [];
  } catch {
    return [];
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

  const [products, brands, categories, subcats, vendors, posts] = await Promise.all([
    fetchProducts(),
    fetchBrands(),
    fetchCategories(),
    fetchSubcategories(),
    fetchVendors(),
    getPosts(),
  ]);

  const productPages: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${BASE_URL}/product/${p.slug}`,
    lastModified: realDate(p.updatedAt),
    changeFrequency: "daily",
    priority: 0.8,
  }));

  // Category shop pages — each has unique Nigeria-targeted metadata. The list
  // is static, so pull the matching catalog document's updatedAt when we have it.
  const categoryDates = new Map(categories.map((c) => [c.slug, realDate(c.updatedAt)]));
  const categoryPages: MetadataRoute.Sitemap = CATEGORY_SLUGS.map((cat) => ({
    url: `${BASE_URL}/shop?category=${cat}`,
    lastModified: categoryDates.get(cat),
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

  // Subcategory detail pages — alongside (never replacing) the combined
  // /shop?category=&subcategory= filter URLs above. Same productCount>0
  // gate so we don't advertise thin pages.
  const subcategoryDetailPages: MetadataRoute.Sitemap = subcats
    .filter((s) => s.productCount > 0)
    .map((s) => ({
      url: `${BASE_URL}/categories/${s.parentSlug}/${s.slug}`,
      lastModified: realDate(s.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

  // Category detail pages — alongside (never replacing) the /shop?category=
  // filter URLs above.
  const categoryDetailPages: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${BASE_URL}/categories/${c.slug}`,
    lastModified: realDate(c.updatedAt),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // Brand pages — both the detail page and the shop filter listing
  const brandPages: MetadataRoute.Sitemap = brands.flatMap((b) => [
    {
      url: `${BASE_URL}/brands/${b.slug}`,
      lastModified: realDate(b.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/shop?brand=${b.slug}`,
      lastModified: realDate(b.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    },
  ]);

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
    ...categoryDetailPages,
    ...subcategoryPages,
    ...subcategoryDetailPages,
    ...brandPages,
    ...vendorPages,
    ...productPages,
    ...blogPages,
  ].map((entry) => ({ ...entry, url: xmlEscapeUrl(entry.url) }));
}
