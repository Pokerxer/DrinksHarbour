"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import * as Icon from "react-icons/pi";

const CategorySidebar = dynamic(() => import("@/components/Home1/TemuCategories"));

// Mobile category drawer — extracted from the home page so the page itself can
// be a server component (enabling server-side data fetching for SEO). Behaviour
// is preserved 1:1; `open` is exposed via a ref-less imperative event so a
// global trigger can toggle it.
export default function HomeCategoryDrawer() {
  const [showCategories, setShowCategories] = useState(false);

  return (
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
  );
}
