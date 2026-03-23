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
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-y-0 left-0 w-[85%] max-w-[400px] bg-white z-50 lg:hidden"
            >
              <CategorySidebar />
              <button
                onClick={() => setShowCategories(false)}
                className="absolute top-4 right-4 p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
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

      {/* Bottom padding for mobile category button */}
      <div className="h-[60px] lg:hidden" />
    </div>
  );
}
