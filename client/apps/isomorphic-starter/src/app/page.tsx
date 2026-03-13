import React from "react";
import AnnouncementBanner from "@/components/Banner/AnnouncementBanner";
import CategoryBanner from "@/components/Banner/CategoryBanner";
import NewArrivals from "@/components/Home1/NewArrivals";
import BestSellers from "@/components/Home1/BestSellers";
import FlashSale from "@/components/Home1/FlashSale";
import Collection from "@/components/Home1/Collection";
import TabFeatures from "@/components/Home1/TabFeatures";
import Benefit from "@/components/Home1/Benefit";
import Instagram from "@/components/Home1/Instagram";
import Brand from "@/components/Home1/Brand";

export default function Home() {
  return (
    <>
      <div id="header" className="relative w-full">
        <AnnouncementBanner placement="header" layout="marquee" variant="promo" />
        <CategoryBanner />
      </div>

      <NewArrivals />
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