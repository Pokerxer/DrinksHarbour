import React from "react";
import Collection from "@/components/Home1/Collection";
import TabFeatures from "@/components/Home1/TabFeatures";
import Instagram from "@/components/Home1/Instagram";
import Brand from "@/components/Home1/Brand";
import FlashSale from "@/components/Home1/FlashSale";
import Benefit from "@/components/Home1/Benefit";
import SliderThree from "@/components/Home1/SliderThree";
import TrendingProduct from "@/components/Home1/TrendingProduct";
import NewArrivals from "@/components/Home1/NewArrivals";
import BestSellers from "@/components/Home1/BestSellers";
import FeaturedProducts from "@/components/Home1/FeaturedProducts";
import Testimonial from "@/components/Home1/Testimonial";

// Banner Components
import { AnnouncementBanner, HeroBanner, PromotionalBanner, PromotionalSlider, SeasonalBanner } from "@/components/Banner";
import FeaturedDeals from "@/components/Home1/FeaturedDeals";

export default function Home() {
  return (
    <>
      <div id="header" className="relative w-full">
        {/* Announcement Banner - Marquee Layout */}
        <AnnouncementBanner
          placement="header"
          layout="marquee"
          variant="promo"
        />

        {/* Hero Banner - Full-width carousel */}
        <HeroBanner
          placement="home_hero"
          limit={5}
          autoPlay={true}
          showControls={true}
          showIndicators={true}
        />
      </div>

      {/* Promotional Banner Slider */}
      {/* <section className="container mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold mb-6">Special Offers</h2>
        <PromotionalSlider
          placement="home_promo"
          autoPlay={true}
          autoPlayInterval={5000}
          showControls={true}
          showIndicators={true}
          showCountdown={true}
        />
      </section> */}

      {/* Additional Promotional Banners - Grid Layout */}
      <section className="container mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold mb-6">Featured Deals</h2>
        <PromotionalBanner
          placement="home_secondary"
          layout="card"
          showCountdown={true}
          columns={3}
        />
      </section>

      {/* Product Sections - Data fetched from server */}
      <NewArrivals limit={8} />
      {/* <TrendingProduct limit={8} /> */}
      <FeaturedDeals 
        title="Featured Deals" 
        subtitle="Exclusive offers you can't resist"
        limit={12}
      />
      <BestSellers limit={5} />
      <FlashSale />
      <Collection />
      <TabFeatures start={0} limit={8} />

      <Benefit props="md:py-20 py-10" />
      <Instagram />
      <Brand />
    </>
  );
}
