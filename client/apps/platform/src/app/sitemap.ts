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

async function fetchProductSlugs(): Promise<string[]> {
  try {
    const res = await fetch(`${API_URL}/api/products/slugs`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data?.data?.slugs)) return data.data.slugs;
    if (Array.isArray(data?.slugs)) return data.slugs;
    return [];
  } catch {
    return [];
  }
}

async function fetchBrandSlugs(): Promise<string[]> {
  try {
    const res = await fetch(`${API_URL}/api/brands?limit=200&page=1`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const brands: { slug?: string }[] = data?.data?.brands ?? data?.data ?? data?.brands ?? [];
    return brands.map((b) => b.slug).filter(Boolean) as string[];
  } catch {
    return [];
  }
}

// Published category slugs for the /categories/[slug] detail pages. These are
// listed IN ADDITION to the /shop?category= filter URLs (same rule as brands:
// both forms stay in the sitemap, each canonical for its own URL).
async function fetchCategorySlugs(): Promise<string[]> {
  try {
    const res = await fetch(`${API_URL}/api/categories`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const cats: { slug?: string }[] =
      data?.data?.categories ?? data?.data ?? data?.categories ?? [];
    return cats.map((c) => c.slug).filter(Boolean) as string[];
  } catch {
    return [];
  }
}

interface SubcatEntry {
  slug: string;
  parentSlug: string;
  productCount: number;
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
    }[] = data?.data?.subcategories ?? data?.data ?? [];
    return subs
      .map((s) => ({
        slug: s?.slug ?? '',
        parentSlug: s?.parent?.slug ?? '',
        productCount: s?.productCount ?? 0,
      }))
      .filter((s) => s.slug && s.parentSlug);
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL,                                  lastModified: new Date(), changeFrequency: "daily",   priority: 1.0 },
    { url: `${BASE_URL}/shop`,                        lastModified: new Date(), changeFrequency: "hourly",  priority: 0.9 },
    { url: `${BASE_URL}/about`,                       lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/contact`,                     lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/blog`,                        lastModified: new Date(), changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE_URL}/faqs`,                        lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/careers`,                     lastModified: new Date(), changeFrequency: "weekly",  priority: 0.4 },
    { url: `${BASE_URL}/returns`,                     lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE_URL}/shipping-info`,               lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE_URL}/sustainability`,              lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE_URL}/brands`,                      lastModified: new Date(), changeFrequency: "weekly",  priority: 0.5 },
    { url: `${BASE_URL}/categories`,                  lastModified: new Date(), changeFrequency: "weekly",  priority: 0.5 },
    { url: `${BASE_URL}/privacy-policy`,              lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE_URL}/vip-signup`,                  lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE_URL}/vendors`,                     lastModified: new Date(), changeFrequency: "weekly",  priority: 0.4 },
    { url: `${BASE_URL}/vendors/register`,            lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/vendors/register/apply`,      lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
  ];

  const [slugs, brandSlugs, categorySlugs, subcats, posts] = await Promise.all([
    fetchProductSlugs(),
    fetchBrandSlugs(),
    fetchCategorySlugs(),
    fetchSubcategories(),
    getPosts(),
  ]);

  const productPages: MetadataRoute.Sitemap = slugs.map((slug) => ({
    url: `${BASE_URL}/product/${slug}`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 0.8,
  }));

  // Category shop pages — each has unique Nigeria-targeted metadata
  const categoryPages: MetadataRoute.Sitemap = CATEGORY_SLUGS.map((cat) => ({
    url: `${BASE_URL}/shop?category=${cat}`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 0.85,
  }));

  // Subcategory shop pages — combined category+subcategory form (the canonical
  // generateMetadata emits). Only list subcategories that actually have products;
  // empty ones are noindexed, so advertising them would waste crawl budget.
  const seenSubUrls = new Set<string>();
  const subcategoryPages: MetadataRoute.Sitemap = subcats
    .filter((s) => s.productCount > 0)
    .map((s) => `${BASE_URL}/shop?category=${s.parentSlug}&subcategory=${s.slug}`)
    .filter((url) => {
      if (seenSubUrls.has(url)) return false;
      seenSubUrls.add(url);
      return true;
    })
    .map((url) => ({
      url,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    }));

  // Category detail pages — alongside (never replacing) the /shop?category=
  // filter URLs above.
  const categoryDetailPages: MetadataRoute.Sitemap = categorySlugs.map(
    (slug) => ({
      url: `${BASE_URL}/categories/${slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    })
  );

  // Brand pages — both the detail page and the shop filter listing
  const brandPages: MetadataRoute.Sitemap = brandSlugs.flatMap((slug) => [
    {
      url: `${BASE_URL}/brands/${slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/shop?brand=${slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    },
  ]);

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
    ...brandPages,
    ...productPages,
    ...blogPages,
  ].map((entry) => ({ ...entry, url: xmlEscapeUrl(entry.url) }));
}
