import React from "react";
import Collection from "@/components/Home1/Collection";
import TabFeatures from "@/components/Home1/TabFeatures";
import Instagram from "@/components/Home1/Instagram";
import Brand from "@/components/Home1/Brand";
import FlashSale from "@/components/Home1/FlashSale";
import Benefit from "@/components/Home1/Benefit";
import NewArrivals from "@/components/Home1/NewArrivals";
import BestSellers from "@/components/Home1/BestSellers";
import FeaturedProducts from "@/components/Home1/FeaturedProducts";

import AnnouncementBanner from "@/components/Banner/AnnouncementBanner";
import HeroBanner from "@/components/Banner/HeroBanner";
import FeaturedDeals from "@/components/Home1/FeaturedDeals";

export default function Home() {
  return (
    <>
      <AnnouncementBanner placement="header" layout="marquee" variant="promo" />
      
      <HeroBanner
        placement="home_hero"
        limit={5}
        autoPlay={true}
        showControls={true}
        showIndicators={true}
      />

      {/* Quick Links Bar */}
      <div className="bg-gray-50 border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-wrap justify-center gap-8 text-sm">
            <a href="/shop?type=wine" className="flex items-center gap-2 text-gray-700 hover:text-green-600 transition-colors">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Free Shipping on Orders ₦50,000+
            </a>
            <a href="/shop?sale=true" className="flex items-center gap-2 text-gray-700 hover:text-green-600 transition-colors">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              Up to 30% Off Selected Items
            </a>
            <a href="/shop?tag=new" className="flex items-center gap-2 text-gray-700 hover:text-green-600 transition-colors">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              New Arrivals Weekly
            </a>
          </div>
        </div>
      </div>

      {/* Categories Quick Access */}
      <section className="py-12 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Shop by Category</h2>
            <a href="/shop" className="text-green-600 hover:text-green-700 font-medium flex items-center gap-1">
              View All <span>→</span>
            </a>
          </div>
          <Collection />
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <FeaturedProducts limit={8} />
        </div>
      </section>

      {/* Flash Sale Banner */}
      <FlashSale />

      {/* New Arrivals */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <NewArrivals limit={8} />
        </div>
      </section>

      {/* Featured Deals */}
      <section className="py-16 bg-gradient-to-b from-green-50 to-white">
        <div className="container mx-auto px-4">
          <FeaturedDeals title="Hot Deals" subtitle="Limited time offers - Grab them before they're gone!" limit={8} />
        </div>
      </section>

      {/* Best Sellers */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <BestSellers limit={5} />
        </div>
      </section>

      {/* Tab Features */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <TabFeatures />
        </div>
      </section>

      {/* Benefits/Value Propositions */}
      <Benefit className="md:py-20 py-10" />

      {/* Instagram Feed */}
      <Instagram />

      {/* Brand Partners */}
      <Brand />
    </>
  );
}