import type { MetadataRoute } from "next";
import { POSTS } from "./blog/data";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.drinksharbour.com";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

// Primary category slugs that have dedicated metadata in generateMetadata
const CATEGORY_SLUGS = [
  "scotch", "scotch-whisky", "whisky", "whiskey",
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
    { url: `${BASE_URL}/privacy-policy`,              lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE_URL}/vip-signup`,                  lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE_URL}/vendors`,                     lastModified: new Date(), changeFrequency: "weekly",  priority: 0.4 },
    { url: `${BASE_URL}/vendors/register`,            lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/vendors/register/apply`,      lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
  ];

  const [slugs, brandSlugs] = await Promise.all([
    fetchProductSlugs(),
    fetchBrandSlugs(),
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

  // Brand shop filter pages
  const brandPages: MetadataRoute.Sitemap = brandSlugs.map((slug) => ({
    url: `${BASE_URL}/shop?brand=${slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const blogPages: MetadataRoute.Sitemap = POSTS.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.isoDate),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticPages, ...categoryPages, ...brandPages, ...productPages, ...blogPages];
}
