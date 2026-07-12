import React from "react";
import dynamic from "next/dynamic";
import LazySection from "@/components/UI/LazySection";
import { fetchInitialRecommendations } from "@/components/Shop/recommendations";

// HeroBanner is above the fold — load it eagerly
import HeroBanner from "@/components/Banner/HeroBanner";
import HomeCategoryDrawer from "@/components/Home1/HomeCategoryDrawer";

// Below-fold sections: dynamically imported to reduce initial JS bundle
const FlashSale = dynamic(() => import("@/components/Home1/FlashSale"), {
  loading: () => <FlashSaleSkeleton />,
});
const FeaturedDeals = dynamic(() => import("@/components/Home1/FeaturedDeals"));
const Benefit = dynamic(() => import("@/components/Home1/Benefit"));
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
// fetch (`/api/products?limit=`) and response parsing.
async function fetchFeaturedDeals(limit = 12): Promise<any[]> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
  if (!API_URL) return [];
  try {
    const res = await fetch(`${API_URL}/api/products?limit=${limit}`, {
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

export default async function Home() {
  // Fetch the SEO-critical product sections on the server, in parallel.
  const [featuredDeals, recommended] = await Promise.all([
    fetchFeaturedDeals(12),
    fetchInitialRecommendations(12),
  ]);

  return (
    <div className="bg-gray-100 min-h-screen">
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
