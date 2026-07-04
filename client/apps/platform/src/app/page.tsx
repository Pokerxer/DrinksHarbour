"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import * as Icon from "react-icons/pi";
import LazySection from "@/components/UI/LazySection";

// HeroBanner is above the fold — load it eagerly
import HeroBanner from "@/components/Banner/HeroBanner";

// Below-fold sections: dynamically imported to reduce initial JS bundle
const CategorySidebar = dynamic(() => import("@/components/Home1/TemuCategories"));
const FlashSale = dynamic(() => import("@/components/Home1/FlashSale"), {
  loading: () => <FlashSaleSkeleton />,
});
const FeaturedDeals = dynamic(() => import("@/components/Home1/FeaturedDeals"), {
  loading: () => <SectionSkeleton />,
});
const Benefit = dynamic(() => import("@/components/Home1/Benefit"));
const RecommendedForYou = dynamic(
  () => import("@/components/Shop/RecommendedForYou"),
  { loading: () => <SectionSkeleton /> }
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

function SectionSkeleton() {
  return (
    <div className="py-4 bg-white animate-pulse">
      <div className="container mx-auto px-3">
        <div className="h-6 w-48 bg-gray-200 rounded mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-56 bg-gray-100 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [showCategories, setShowCategories] = useState(false);

  return (
    <div className="bg-gray-100 min-h-screen">
      {/* Mobile Category Sidebar Overlay */}
      <AnimatePresence>
        {showCategories && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setShowCategories(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-x-0 inset-y-0 bottom-0 top-[60px] bg-white z-50 lg:hidden overflow-hidden"
            >
              <div className="h-full overflow-y-auto">
                <CategorySidebar onClose={() => setShowCategories(false)} />
              </div>
              <button
                onClick={() => setShowCategories(false)}
                className="absolute top-4 right-4 p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors z-10"
              >
                <Icon.PiX size={20} className="text-gray-600" />
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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

        {/* Flash Sale — just below the fold, preload with small margin */}
        <LazySection rootMargin="400px">
          <FlashSale />
        </LazySection>

        {/* Hot Deals */}
        <LazySection rootMargin="200px">
          <section className="py-4 bg-white">
            <div className="container mx-auto px-3">
              <FeaturedDeals
                title="Hot Deals"
                subtitle="Limited time offers - Grab them fast!"
                limit={12}
              />
            </div>
          </section>
        </LazySection>

        {/* Benefits */}
        <LazySection rootMargin="200px">
          <Benefit className="py-8" />
        </LazySection>

        {/* Personalized Recommendations */}
        <LazySection rootMargin="200px">
          <RecommendedForYou maxItems={12} />
        </LazySection>
      </div>

      {/* Bottom padding for mobile category button */}
      <div className="h-[60px] lg:hidden" />
    </div>
  );
}
