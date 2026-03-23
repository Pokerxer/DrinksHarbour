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

interface CategorySidebarProps {
  onClose?: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

const CategorySidebar: React.FC<CategorySidebarProps> = ({ onClose }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch(`${API_URL}/api/categories`);
        const data = await res.json();
        if (data.success && data.data?.categories) {
          setAllCategories(data.data.categories);
          const cats = data.data.categories.filter(
            (c: Category) => !c.parent && c.level === 0,
          );
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

  const getSubcategories = (category: Category): Category[] => {
    if (category.subCategories && category.subCategories.length > 0) {
      return allCategories.filter((c) =>
        category.subCategories!.includes(c._id),
      );
    }
    return allCategories.filter(
      (c) => c.parent === category._id && c.level === 1,
    );
  };

  const handleCategoryClick = (category: Category) => {
    setActiveCategory(activeCategory?._id === category._id ? null : category);
  };

  if (loading) {
    return (
      <div className="bg-white h-full flex">
        <div className="w-[35%] bg-gray-50 p-4 space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="flex-1 p-4 space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const subcategories = activeCategory ? getSubcategories(activeCategory) : [];

  return (
    <div className="bg-white h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-white sticky top-0 z-20">
        {activeCategory ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveCategory(null)}
              className="p-1 -ml-1"
            >
              <Icon.PiArrowLeft size={20} className="text-gray-600" />
            </button>
            <h2 className="font-bold text-gray-900 truncate">
              {activeCategory.name}
            </h2>
          </div>
        ) : (
          <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
            <Icon.PiGridFour size={20} className="text-orange-500" />
            Categories
          </h2>
        )}
        <button
          onClick={onClose}
          className="p-2 -mr-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <Icon.PiX size={20} className="text-gray-600" />
        </button>
      </div>

      {/* Split Panel Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Categories */}
        <div className="w-[35%] bg-gray-50 overflow-y-auto border-r border-gray-100">
          <div className="py-2">
            {categories.map((cat) => (
              <button
                key={cat._id}
                onClick={() => handleCategoryClick(cat)}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${
                  activeCategory?._id === cat._id
                    ? "bg-white border-l-2 border-orange-500"
                    : "hover:bg-gray-100 border-l-2 border-transparent"
                }`}
              >
                <span className="text-xl">{cat.icon || "🍷"}</span>
                <span className={`text-sm font-medium truncate ${
                  activeCategory?._id === cat._id ? "text-orange-600" : "text-gray-700"
                }`}>
                  {cat.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Right Panel - Subcategories & Shop Link */}
        <div className="flex-1 overflow-y-auto p-3 bg-white">
          {!activeCategory ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                <Icon.PiCursorClick size={32} className="text-gray-400" />
              </div>
              <p className="text-sm text-gray-500">
                Select a category to see subcategories
              </p>
            </div>
          ) : subcategories.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                <Icon.PiFolderOpen size={32} className="text-gray-400" />
              </div>
              <p className="text-sm text-gray-500 mb-3">
                No subcategories found
              </p>
              <Link
                href={`/shop?category=${activeCategory.slug}`}
                onClick={onClose}
                className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
              >
                Browse {activeCategory.name}
              </Link>
            </div>
          ) : (
            <div>
              <Link
                href={`/shop?category=${activeCategory.slug}`}
                onClick={onClose}
                className="flex items-center justify-center gap-2 w-full py-3 mb-4 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Browse {activeCategory.name}
                <Icon.PiArrowRight size={16} />
              </Link>

              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Subcategories
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {subcategories.map((sub) => (
                  <Link
                    key={sub._id}
                    href={`/shop?category=${activeCategory.slug}&subCategory=${sub.slug}`}
                    onClick={onClose}
                    className="px-3 py-2.5 bg-gray-50 hover:bg-orange-50 border border-gray-100 hover:border-orange-200 rounded-xl text-sm text-gray-700 hover:text-orange-600 font-medium transition-all text-center"
                  >
                    {sub.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CategorySidebar;
