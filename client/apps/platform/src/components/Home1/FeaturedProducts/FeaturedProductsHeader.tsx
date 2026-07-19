"use client";

import React from "react";
import { motion } from "framer-motion";
import { PiStarFill, PiSparkle, PiStorefront, PiCaretRightBold } from "react-icons/pi";

interface FeaturedProductsHeaderProps {
  title: string;
  subtitle: string;
  count: number;
  avgRating: number;
  tenantsCount: number;
}

const Stat: React.FC<{ icon: React.ReactNode; value: string | number; label: string }> = ({
  icon,
  value,
  label,
}) => (
  <div className="flex items-center gap-2">
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-yellow-100">
      {icon}
    </div>
    <div className="text-left">
      <div className="font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  </div>
);

const FeaturedProductsHeader: React.FC<FeaturedProductsHeaderProps> = ({
  title,
  subtitle,
  count,
  avgRating,
  tenantsCount,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="mb-12 text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true }}
        className="mb-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-100 to-yellow-100 px-4 py-2 text-xs font-bold uppercase tracking-wider text-amber-700 shadow-sm"
      >
        <PiStarFill size={14} className="text-amber-500" />
        Premium Selection
      </motion.div>

      <h2 className="mb-3 text-3xl font-black tracking-tight text-gray-900 sm:text-4xl lg:text-5xl">
        {title}
      </h2>

      <p className="mx-auto max-w-2xl text-base text-gray-500 sm:text-lg">{subtitle}</p>

      {count > 0 && (
        <div className="mt-6 flex items-center justify-center gap-6">
          <Stat
            icon={<PiSparkle size={18} className="text-amber-600" />}
            value={count}
            label="Featured"
          />
          <div className="h-10 w-px bg-gray-200" />
          <Stat
            icon={<PiStarFill size={18} className="text-amber-500" />}
            value={avgRating.toFixed(1)}
            label="Avg rating"
          />
          <div className="h-10 w-px bg-gray-200" />
          <Stat
            icon={<PiStorefront size={18} className="text-emerald-600" />}
            value={tenantsCount}
            label="Tenants"
          />
        </div>
      )}
    </motion.div>
  );
};

export const FeaturedProductsCta: React.FC = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    className="mt-12 text-center"
  >
    <a
      href="/shop?isFeatured=true"
      className="inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 px-8 py-4 font-bold text-gray-900 shadow-lg transition-all hover:from-amber-600 hover:to-yellow-600 hover:shadow-xl"
    >
      View all featured products
      <PiCaretRightBold size={18} />
    </a>
  </motion.div>
);

export default FeaturedProductsHeader;