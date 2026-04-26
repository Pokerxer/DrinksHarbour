"use client";

import React, { useState } from "react";
import CategorySidebar from "@/components/Home1/TemuCategories";
import FlashSale from "@/components/Home1/FlashSale";
import Benefit from "@/components/Home1/Benefit";
import FeaturedDeals from "@/components/Home1/FeaturedDeals";
import AnnouncementBanner from "@/components/Banner/AnnouncementBanner";
import HeroBanner from "@/components/Banner/HeroBanner";
import { motion, AnimatePresence } from "framer-motion";
import * as Icon from "react-icons/pi";
import RecommendedForYou from '@/components/Shop/RecommendedForYou';

export default function Home() {
  const [showCategories, setShowCategories] = useState(false);

  return (
    <div className="bg-gray-100 min-h-screen">
      {/* <AnnouncementBanner placement="header" layout="static" variant="promo" /> */}

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
        {/* Personalized Recommendations */}
        <RecommendedForYou maxItems={12} />
      </div>

      {/* Bottom padding for mobile category button */}
      <div className="h-[60px] lg:hidden" />
    </div>
  );
}
