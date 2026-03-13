import React from "react";
import Collection from "@/components/Home1/Collection";
import TabFeatures from "@/components/Home1/TabFeatures";
import Instagram from "@/components/Home1/Instagram";
import Brand from "@/components/Home1/Brand";
import FlashSale from "@/components/Home1/FlashSale";
import Benefit from "@/components/Home1/Benefit";
import NewArrivals from "@/components/Home1/NewArrivals";
import BestSellers from "@/components/Home1/BestSellers";
import FeaturedDeals from "@/components/Home1/FeaturedDeals";
import AnnouncementBanner from "@/components/Banner/AnnouncementBanner";
import CategoryBanner from "@/components/Banner/CategoryBanner";

export default function Home() {
  return (
    <>
      <div id="header" className="relative w-full">
        <AnnouncementBanner placement="header" layout="marquee" variant="promo" />
        <CategoryBanner />
      </div>

      <NewArrivals />
      <FeaturedDeals />
      <BestSellers />
      <FlashSale />
      <Collection />
      <TabFeatures />
      <Benefit />
      <Instagram />
      <Brand />
    </>
  );
}