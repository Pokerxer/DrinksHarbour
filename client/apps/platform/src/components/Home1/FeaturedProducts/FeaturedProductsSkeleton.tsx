"use client";

import React from "react";
import { PiStarFill } from "react-icons/pi";

interface FeaturedProductsSkeletonProps {
  limit?: number;
}

const FeaturedProductsSkeleton: React.FC<FeaturedProductsSkeletonProps> = ({ limit = 8 }) => (
  <section className="py-16 sm:py-24">
    <div className="container mx-auto px-4">
      <div className="mb-12 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2 text-xs font-bold text-amber-700 mb-4">
          <PiStarFill size={14} />
          Premium Selection
        </div>
        <div className="mx-auto h-12 w-56 animate-pulse rounded-xl bg-gray-200" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: limit }).map((_, i) => (
          <div key={i} className="animate-pulse overflow-hidden rounded-xl border border-gray-100">
            <div className="aspect-square bg-gray-200" />
            <div className="space-y-2 p-2.5">
              <div className="h-3 w-3/4 rounded bg-gray-200" />
              <div className="h-2 w-1/2 rounded bg-gray-200" />
              <div className="h-3 w-1/4 rounded bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default FeaturedProductsSkeleton;