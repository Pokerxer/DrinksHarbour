import React from "react";
import nextDynamic from "next/dynamic";
import { HOME_TITLE, HOME_DESCRIPTION } from "@/app/home-seo";
import LazySection from "@/components/UI/LazySection";
import { fetchInitialRecommendations } from "@/components/Shop/recommendations";
import { buildProductItemList } from "@/lib/product-jsonld";
import { jsonLdHtml } from "@/lib/jsonld";


// Below-fold sections: dynamically imported to reduce initial JS bundle
const FeaturedDeals = nextDynamic(() => import("@/components/Home1/FeaturedDeals"));
const FeaturedProducts = nextDynamic(
  () => import("@/components/Home1/FeaturedProducts")
);
const Benefit = nextDynamic(() => import("@/components/Home1/Benefit"));
const PlacementBanner = nextDynamic(
  () => import("@/components/Banner/PlacementBanner")
);
const RecommendedForYou = nextDynamic(
  () => import("@/components/Shop/RecommendedForYou")
);
const BlogSection = nextDynamic(() => import("@/components/Home1/BlogSection"), {
  loading: () => null,
});

// Server-side fetch of the "Hot Deals" products so the cards + /product links
// are present in the raw HTML for crawlers. Mirrors FeaturedDeals' own client
// fetch and response parsing. `sortBy=discount` surfaces products with an active
// promotion first (the deal cards render their discount badge + strike price),
// then backfills with the rest of the catalog so the grid never looks empty.
async function fetchFeaturedDeals(limit = 12): Promise<any[]> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
  if (!API_URL) return [];
  try {
    const res = await fetch(`${API_URL}/api/products?sortBy=discount&limit=${limit}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (data?.success && data?.data?.products) return data.data.products;
    if (Array.isArray(data?.products)) return data.products;
    if (Array.isArray(data)) return data;
    return [];
  } catch {
    return [];
  }
}

// Server-side fetch of admin-curated featured products so the cards + /product
// links ship in the raw HTML. Only products explicitly flagged isFeatured are
// shown; if none are flagged the section renders nothing.
async function fetchFeaturedProducts(limit = 8): Promise<any[]> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
  if (!API_URL) return [];
  const parse = (data: any): any[] => {
    if (data?.success && data?.data?.products) return data.data.products;
    if (Array.isArray(data?.products)) return data.products;
    if (Array.isArray(data)) return data;
    return [];
  };
  try {
    const res = await fetch(
      `${API_URL}/api/products?isFeatured=true&limit=${limit}`,
      // Short revalidate so newly-flagged featured products appear quickly.
      { next: { revalidate: 30 } }
    );
    return res.ok ? parse(await res.json()) : [];
  } catch {
    return [];
  }
}

// Server-side fetch of the latest blog posts for the homepage "From the Blog"
// section. Reuses the same API + Post shape as the /blog pages. Returns an
// empty array on any failure so the section renders nothing rather than error.
async function fetchHomepageBlogPosts(limit = 6): Promise<any[]> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
  if (!API_URL) return [];
  try {
    const res = await fetch(`${API_URL}/api/blog?limit=${limit}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.posts) ? data.posts : [];
  } catch {
    return [];
  }
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.drinksharbour.com";

// Ties the homepage to the site-wide Organization/WebSite nodes declared in the
// root layout, and points at the product list below as the page's main entity.
function buildHomeWebPageJsonLd(hasItemList: boolean) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${BASE_URL}/#webpage`,
    url: `${BASE_URL}/`,
    name: HOME_TITLE,
    description: HOME_DESCRIPTION,
    isPartOf: { "@id": `${BASE_URL}/#website` },
    about: { "@id": `${BASE_URL}/#organization` },
    primaryImageOfPage: { "@type": "ImageObject", url: `${BASE_URL}/og-default.jpg` },
    inLanguage: "en-NG",
    ...(hasItemList ? { mainEntity: { "@id": `${BASE_URL}/#product-list` } } : {}),
  };
}

export default async function HomeSections() {
  // Fetch the SEO-critical product sections on the server, in parallel.
  const [featuredDeals, recommended, featured, blogPosts] = await Promise.all([
    fetchFeaturedDeals(12),
    fetchInitialRecommendations(12),
    fetchFeaturedProducts(8),
    fetchHomepageBlogPosts(6),
  ]);

  // Product markup for the two grids that are guaranteed to render exactly what
  // the server seeded (both skip their initial client fetch when given
  // initialProducts). "Recommended For You" is deliberately left out: it swaps
  // in personalised products for signed-in users, so marking up the anonymous
  // seed would describe something a visitor may not see — the mismatch Google's
  // structured-data policy is about.
  const productListJsonLd = buildProductItemList({
    id: `${BASE_URL}/#product-list`,
    name: "Featured drinks at DrinksHarbour",
    products: [...featuredDeals, ...featured],
  });
  const webPageJsonLd = buildHomeWebPageJsonLd(Boolean(productListJsonLd));
  const regularDeals = featuredDeals.filter((product: any) =>
    !(product.availableAt || []).some((offer: any) => offer.saleType === "flash_sale" && offer.isOnSale)
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(webPageJsonLd) }}
      />
      {productListJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdHtml(productListJsonLd) }}
        />
      )}
        {/* Hot Deals — server-seeded so the grid ships in the raw HTML */}
        <section className="py-4 bg-white">
          <div className="container mx-auto px-3">
            <FeaturedDeals
              title="Hot Deals"
              subtitle="Limited time offers - Grab them fast!"
              limit={12}
              initialProducts={regularDeals}
            />
          </div>
        </section>

        {/* Featured Products — admin-curated, server-seeded (bestseller fallback) */}
        <section className="py-4 bg-white">
          <div className="container mx-auto px-3">
        <FeaturedProducts limit={8} initialProducts={featured} />
          </div>
        </section>

        {/* Home Secondary — admin-managed promotional strip */}
        <LazySection rootMargin="300px">
          <PlacementBanner
            placement="home_secondary"
            variant="hero"
            limit={1}
            className="container mx-auto px-3 py-4"
          />
        </LazySection>

        {/* Benefits */}
        <LazySection rootMargin="200px">
          <Benefit className="py-8" />
        </LazySection>

        {/* Blog — latest articles + category filter, server-seeded */}
        {blogPosts.length > 0 && (
          <BlogSection posts={blogPosts} />
        )}

        {/* Personalized Recommendations — server-seeded (trending) */}
        <RecommendedForYou maxItems={12} initialProducts={recommended} />
    </>
  );
}
