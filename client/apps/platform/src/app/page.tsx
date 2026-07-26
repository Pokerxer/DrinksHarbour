import React from "react";
import dynamic from "next/dynamic";
import LazySection from "@/components/UI/LazySection";
import { fetchInitialRecommendations } from "@/components/Shop/recommendations";
import { buildProductItemList } from "@/lib/product-jsonld";

// HeroBanner is above the fold — load it eagerly
import HeroBanner from "@/components/Banner/HeroBanner";
import HomeCategoryDrawer from "@/components/Home1/HomeCategoryDrawer";

// Below-fold sections: dynamically imported to reduce initial JS bundle
const FlashSale = dynamic(() => import("@/components/Home1/FlashSale"), {
  loading: () => <FlashSaleSkeleton />,
});
const FeaturedDeals = dynamic(() => import("@/components/Home1/FeaturedDeals"));
const FeaturedProducts = dynamic(
  () => import("@/components/Home1/FeaturedProducts")
);
const Benefit = dynamic(() => import("@/components/Home1/Benefit"));
const PlacementBanner = dynamic(
  () => import("@/components/Banner/PlacementBanner")
);
const RecommendedForYou = dynamic(
  () => import("@/components/Shop/RecommendedForYou")
);

function FlashSaleSkeleton() {
  return (
    <div className="py-4 bg-white animate-pulse">
      <div className="container mx-auto px-3">
        <div className="h-6 w-40 bg-gray-200 rounded mb-4" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="min-w-[150px] h-48 bg-gray-100 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

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

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.drinksharbour.com";

// Ties the homepage to the site-wide Organization/WebSite nodes declared in the
// root layout, and points at the product list below as the page's main entity.
function buildHomeWebPageJsonLd(hasItemList: boolean) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${BASE_URL}/#webpage`,
    url: `${BASE_URL}/`,
    name: "Premium Spirits & Beverages Delivered in Nigeria",
    description:
      "Shop Nigeria's widest selection of premium spirits, wines, beers, and non-alcoholic drinks. Authentic products, fast delivery, and the best prices.",
    isPartOf: { "@id": `${BASE_URL}/#website` },
    about: { "@id": `${BASE_URL}/#organization` },
    primaryImageOfPage: { "@type": "ImageObject", url: `${BASE_URL}/og-default.jpg` },
    inLanguage: "en-NG",
    ...(hasItemList ? { mainEntity: { "@id": `${BASE_URL}/#product-list` } } : {}),
  };
}

export default async function Home() {
  // Fetch the SEO-critical product sections on the server, in parallel.
  const [featuredDeals, recommended, featured] = await Promise.all([
    fetchFeaturedDeals(12),
    fetchInitialRecommendations(12),
    fetchFeaturedProducts(8),
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

  return (
    <div className="bg-gray-100 min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd) }}
      />
      {productListJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productListJsonLd) }}
        />
      )}
      {/* Mobile Category Sidebar Overlay (interactive — client component) */}
      <HomeCategoryDrawer />

      {/* Main Content Area */}
      <div className="min-w-0">
        {/* Primary H1 — hidden from UI, visible to crawlers */}
        <h1 className="sr-only">Premium Spirits &amp; Beverages Delivered in Nigeria</h1>

        {/* Hero Banner — above the fold, loads immediately */}
        <HeroBanner
          placement="home_hero"
          limit={5}
          autoPlay={true}
          showControls={true}
          showIndicators={true}
        />

        {/* Flash Sale — promotional, kept lazy (client-fetched) */}
        <LazySection rootMargin="400px">
          <FlashSale />
        </LazySection>

        {/* Hot Deals — server-seeded so the grid ships in the raw HTML */}
        <section className="py-4 bg-white">
          <div className="container mx-auto px-3">
            <FeaturedDeals
              title="Hot Deals"
              subtitle="Limited time offers - Grab them fast!"
              limit={12}
              initialProducts={featuredDeals}
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

        {/* Personalized Recommendations — server-seeded (trending) */}
        <RecommendedForYou maxItems={12} initialProducts={recommended} />
      </div>

      {/* Bottom padding for mobile category button */}
      <div className="h-[60px] lg:hidden" />
    </div>
  );
}
