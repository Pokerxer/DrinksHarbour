"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import * as Icon from "react-icons/pi";

interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  featuredImage?: { url: string; alt?: string };
}

const categories = [
  { name: "Wine", slug: "wine", icon: "🍷", color: "bg-red-500" },
  { name: "Beer", slug: "beer", icon: "🍺", color: "bg-amber-500" },
  { name: "Whiskey", slug: "whiskey", icon: "🥃", color: "bg-amber-700" },
  { name: "Vodka", slug: "vodka", icon: "❄️", color: "bg-sky-500" },
  { name: "Gin", slug: "gin", icon: "🌿", color: "bg-emerald-500" },
  { name: "Rum", slug: "rum", icon: "🏴‍☠️", color: "bg-yellow-600" },
  { name: "Champagne", slug: "champagne", icon: "🍾", color: "bg-yellow-400" },
  { name: "Brandy", slug: "brandy", icon: "🥃", color: "bg-orange-700" },
  { name: "Tequila", slug: "tequila", icon: "🌵", color: "bg-lime-500" },
  {
    name: "Non-Alcoholic",
    slug: "non-alcoholic",
    icon: "🥤",
    color: "bg-cyan-500",
  },
];

const Collection = () => {
  return (
    <div className="px-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-gray-900">Categories</h2>
        <Link
          href="/shop"
          className="text-xs text-orange-500 font-medium flex items-center gap-0.5"
        >
          All <Icon.PiCaretRightBold size={12} />
        </Link>
      </div>

      {/* Categories Grid - Temu style */}
      <div className="grid grid-cols-5 gap-2">
        {categories.map((cat) => (
          <Link
            key={cat.slug}
            href={`/shop?type=${cat.slug}`}
            className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <div
              className={`w-12 h-12 ${cat.color} rounded-2xl flex items-center justify-center text-2xl shadow-sm`}
            >
              {cat.icon}
            </div>
            <span className="text-[10px] font-medium text-gray-700 text-center leading-tight">
              {cat.name}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Collection;
