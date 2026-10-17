import React, { Suspense } from "react";
import { homeMetadata } from "./home-seo";
import MarketplaceIntro from "@/components/Home1/MarketplaceIntro";
import HomeHero from "@/components/Banner/HomeHero";
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
        <Suspense fallback={<div className="w-full aspect-[2/1] max-h-[80vh] bg-[#1A1A2E]" role="status" aria-label="Loading promotions" />}>
          <HomeHero />
        </Suspense>
        <div className="sr-only"><MarketplaceIntro /></div>
        <Suspense fallback={
          <section className="bg-gradient-to-r from-red-500 via-orange-500 to-red-500 py-5 text-white" role="status" aria-label="Loading sale offers">
            <div className="container mx-auto px-4">
              <h2 className="text-xl font-bold">On Sale Now</h2>
              <p className="text-sm mt-1">Loading current offers…</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-4" aria-hidden="true">
                {Array.from({ length: 6 }, (_, index) => <div key={index} className="aspect-square rounded-2xl bg-white/20 motion-safe:animate-pulse" />)}
              </div>
            </div>
          </section>
        }><HomeFlashSale /></Suspense>
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
