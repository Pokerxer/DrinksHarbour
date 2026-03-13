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
import AnnouncementBanner from "@/components/Banner/AnnouncementBanner";
import CategoryBanner from "@/components/Banner/CategoryBanner";

export default function Home() {
  return (
    <>
      <div id="header" className="relative w-full">
        <AnnouncementBanner
          placement="header"
          layout="marquee"
          variant="promo"
        />
        <CategoryBanner />
      </div>

      <NewArrivals />
      <FeaturedProducts />
      <BestSellers />
      <FlashSale />
      <Collection />
      <TabFeatures />
      <Testimonial />
      <Instagram />
      <Brand />
      <Benefit />
    </>
  );
}