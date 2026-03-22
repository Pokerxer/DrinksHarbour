import React from "react";
import CategorySidebar from "@/components/Home1/TemuCategories";
import FlashSale from "@/components/Home1/FlashSale";
import Benefit from "@/components/Home1/Benefit";
import FeaturedDeals from "@/components/Home1/FeaturedDeals";
import AnnouncementBanner from "@/components/Banner/AnnouncementBanner";
import HeroBanner from "@/components/Banner/HeroBanner";

export default function Home() {
  return (
    <div className="bg-gray-100 min-h-screen">
      <AnnouncementBanner placement="header" layout="static" variant="promo" />

      {/* Full-width layout: Sidebar + Content */}
      <div className="flex">
        {/* Category Sidebar - Fixed/Sticky */}
        <div className="hidden lg:block w-72 flex-shrink-0">
          <div className="sticky top-0 h-screen">
            <CategorySidebar />
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0">
          {/* Hero Banner */}
          <div className="bg-gradient-to-r from-orange-500 to-pink-500">
            <HeroBanner
              placement="home_hero"
              limit={5}
              autoPlay={true}
              showControls={true}
              showIndicators={true}
            />
          </div>

          {/* Flash Sale */}
          <FlashSale />

          {/* Featured Deals */}
          <section className="py-4 bg-gray-100">
            <div className="container mx-auto px-3">
              <FeaturedDeals
                title="Just For You"
                subtitle="Personalized picks based on your preferences"
                limit={12}
              />
            </div>
          </section>

          {/* More Deals Section */}
          <section className="py-4 bg-white">
            <div className="container mx-auto px-3">
              <FeaturedDeals
                title="Hot Deals"
                subtitle="Limited time offers - Grab them fast!"
                limit={12}
              />
            </div>
          </section>

          {/* Benefits/Value Propositions */}
          <Benefit className="py-8" />
        </div>
      </div>
    </div>
  );
}
