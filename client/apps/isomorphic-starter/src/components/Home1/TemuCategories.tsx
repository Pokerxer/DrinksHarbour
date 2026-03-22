"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import * as Icon from "react-icons/pi";

interface Category {
  _id: string;
  name: string;
  slug: string;
  icon?: string;
  color?: string;
  tagline?: string;
  description?: string;
  productCount?: number;
  isFeatured?: boolean;
  isTrending?: boolean;
  subCategories?: string[];
  children?: Category[];
  parent?: string | null;
  level?: number;
}

const CategorySidebar = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const API_URL =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";
        const res = await fetch(`${API_URL}/api/categories`);
        const data = await res.json();
        if (data.success && data.data?.categories) {
          const cats = data.data.categories.filter((c: Category) => !c.parent);
          setCategories(cats);
        }
      } catch (error) {
        console.error("Error fetching categories:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

  const sortedCategories = categories;

  const activeCategoryData = categories.find((c) => c.slug === activeCategory);

  const generateSubcategories = (category: Category) => {
    const prefixes = [
      "Premium",
      "Classic",
      "Budget",
      "Imported",
      "Local",
      "Organic",
      "Vintage",
      "Limited Edition",
    ];
    return prefixes.map((prefix) => ({
      name: `${prefix} ${category.name}`,
      slug: `${category.slug}?q=${encodeURIComponent(prefix.toLowerCase())}`,
    }));
  };

  if (loading) {
    return (
      <div className="w-72 bg-white border-r border-gray-200 h-screen overflow-hidden flex">
        <div className="w-full p-4">
          <div className="h-6 w-28 bg-gray-100 rounded animate-pulse mb-6" />
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 py-2.5 animate-pulse"
            >
              <div className="w-8 h-8 bg-gray-100 rounded-lg" />
              <div className="h-4 bg-gray-100 rounded w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-72 bg-white border-r border-gray-200 h-screen overflow-hidden flex">
      {/* Left Panel - Category List */}
      <div className="w-48 border-r border-gray-100 flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-white">
          <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900">
            <Icon.PiGridFour size={18} className="text-orange-500" />
            Categories
          </h2>
        </div>

        {/* Scrollable Category List */}
        <div className="flex-1 overflow-y-auto py-2">
          {sortedCategories.map((cat) => (
            <div
              key={cat._id}
              onMouseEnter={() => setActiveCategory(cat.slug)}
              className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-all ${
                activeCategory === cat.slug
                  ? "bg-orange-50 border-r-2 border-orange-500"
                  : "hover:bg-gray-50 border-r-2 border-transparent"
              }`}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                style={{ backgroundColor: `${cat.color || "#F59E0B"}15` }}
              >
                {cat.icon || "🍷"}
              </div>
              <span
                className={`text-sm font-medium truncate ${
                  activeCategory === cat.slug
                    ? "text-orange-600"
                    : "text-gray-700"
                }`}
              >
                {cat.name}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-100 bg-gray-50">
          <Link
            href="/shop"
            className="flex items-center justify-center gap-2 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
          >
            <Icon.PiList size={16} />
            All Categories
          </Link>
        </div>
      </div>

      {/* Right Panel - Subcategories */}
      <div className="flex-1 bg-gray-50 overflow-y-auto">
        {activeCategory && activeCategoryData ? (
          <div className="p-4">
            {/* Category Header */}
            <div className="flex items-center gap-3 mb-4 p-3 bg-white rounded-xl border border-gray-100">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                style={{
                  backgroundColor: `${activeCategoryData.color || "#F59E0B"}20`,
                }}
              >
                {activeCategoryData.icon || "🍷"}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900">
                  {activeCategoryData.name}
                </h3>
                <p className="text-xs text-gray-500">
                  {activeCategoryData.tagline}
                </p>
              </div>
            </div>

            {/* Description */}
            {activeCategoryData.description && (
              <p className="text-xs text-gray-600 mb-4 line-clamp-2">
                {activeCategoryData.description}
              </p>
            )}

            {/* Shop Now Button */}
            <Link
              href={`/shop?type=${activeCategoryData.slug}`}
              className="flex items-center justify-center gap-2 w-full py-2.5 mb-4 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-orange-500/20"
            >
              Shop {activeCategoryData.name}
              <Icon.PiArrowRight size={16} />
            </Link>

            {/* Subcategories Grid */}
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Popular Types
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {generateSubcategories(activeCategoryData).map((sub, idx) => (
                  <Link
                    key={idx}
                    href={`/shop?${sub.slug}`}
                    className="px-3 py-2.5 bg-white hover:bg-orange-50 border border-gray-100 hover:border-orange-200 rounded-xl text-sm text-gray-700 hover:text-orange-600 font-medium transition-all text-center"
                  >
                    {sub.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* Occasions */}
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Shop by Occasion
              </h4>
              <div className="flex flex-wrap gap-2">
                {["🎉 Party", "🍽️ Dinner", "🎁 Gift", "🏢 Office"].map(
                  (occasion) => (
                    <Link
                      key={occasion}
                      href={`/shop?type=${activeCategoryData.slug}&occasion=${occasion.split(" ")[0].toLowerCase()}`}
                      className="px-3 py-1.5 bg-white hover:bg-orange-50 border border-gray-100 hover:border-orange-200 rounded-full text-xs text-gray-600 hover:text-orange-600 transition-all"
                    >
                      {occasion}
                    </Link>
                  ),
                )}
              </div>
            </div>

            {/* Featured Badge */}
            {activeCategoryData.isFeatured && (
              <div className="p-3 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-100">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-lg">⭐</span>
                  <span className="font-medium text-orange-700">
                    Featured Category
                  </span>
                </div>
                <p className="text-xs text-orange-600 mt-1">
                  Check out our top picks in {activeCategoryData.name}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Icon.PiCursorClick size={32} className="text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-700 mb-1">
              Hover to explore
            </h3>
            <p className="text-xs text-gray-500">
              Hover over a category to see subcategories
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CategorySidebar;
