import React, { Suspense } from "react";
import { homeMetadata } from "./home-seo";
import MarketplaceIntro from "@/components/Home1/MarketplaceIntro";
import HeroBanner from "@/components/Banner/HeroBanner";
import HomeCategoryDrawer from "@/components/Home1/HomeCategoryDrawer";
import HomeFlashSale from "@/components/Home1/HomeFlashSale";
import HomeSections from "@/components/Home1/HomeSections";

export const metadata = homeMetadata;
// Tenant resolution reads request headers, so this route remains dynamic.
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <div className="bg-gray-100 min-h-screen">
      <HomeCategoryDrawer />
      <div className="min-w-0">
        <h1 className="sr-only">Buy Drinks Online in Nigeria</h1>
        <HeroBanner placement="home_hero" limit={5} autoPlay showControls showIndicators />
        <div className="sr-only"><MarketplaceIntro /></div>
        <Suspense fallback={<div className="min-h-[320px] bg-white" role="status" aria-label="Loading flash sales" />}><HomeFlashSale /></Suspense>
        {/* Product cards and their matching structured data still render on the
            server, while the hero can stream before these requests finish. */}
        <Suspense fallback={<div className="min-h-[400px] bg-white" role="status" aria-label="Loading drinks" />}>
          <HomeSections />
        </Suspense>
      </div>
      <div className="h-[60px] lg:hidden" />
    </div>
  );
}
