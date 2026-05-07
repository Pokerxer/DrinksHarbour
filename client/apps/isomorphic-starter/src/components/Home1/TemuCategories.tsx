"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import * as Icon from "react-icons/pi";
import {
  fetchAllCategories,
  fetchAllSubCategories,
  getRootCategories,
  getSubcategories,
  type Category,
  type SubCategory,
} from "@/lib/categories";

interface CategorySidebarProps {
  onClose?: () => void;
}

const CategorySidebar: React.FC<CategorySidebarProps> = ({ onClose }) => {
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allSubCategories, setAllSubCategories] = useState<SubCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchAllCategories(), fetchAllSubCategories()]).then(([cats, subs]) => {
      if (!cancelled) {
        setAllCategories(cats);
        setAllSubCategories(subs);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const rootCategories = useMemo(
    () => getRootCategories(allCategories, allSubCategories),
    [allCategories, allSubCategories]
  );

  const subcategories = useMemo(
    () => activeCategory ? getSubcategories(activeCategory, allSubCategories) : [],
    [activeCategory, allSubCategories]
  );

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

  return (
    <div className="bg-white h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-white sticky top-0 z-20">
        {activeCategory ? (
          <div className="flex items-center gap-2">
            <button onClick={() => setActiveCategory(null)} className="p-1 -ml-1">
              <Icon.PiArrowLeft size={20} className="text-gray-600" />
            </button>
            <h2 className="font-bold text-gray-900 truncate">{activeCategory.name}</h2>
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

      {/* Split Panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left — root categories */}
        <div className="w-[35%] bg-gray-50 overflow-y-auto border-r border-gray-100">
          <div className="py-2">
            {rootCategories.length === 0 ? (
              <p className="px-4 py-6 text-xs text-gray-400 text-center">No categories</p>
            ) : (
              rootCategories.map((cat) => (
                <button
                  key={cat._id}
                  onClick={() => setActiveCategory(cat)}
                  className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${
                    activeCategory?._id === cat._id
                      ? "bg-white border-l-2 border-orange-500"
                      : "hover:bg-gray-100 border-l-2 border-transparent"
                  }`}
                >
                  <span className="text-xl">{cat.icon || "🍷"}</span>
                  <div className="min-w-0 flex-1">
                    <span className={`text-sm font-medium truncate block ${
                      activeCategory?._id === cat._id ? "text-orange-600" : "text-gray-700"
                    }`}>
                      {cat.name}
                    </span>
                    {(cat.productCount ?? 0) > 0 && (
                      <span className="text-[10px] text-gray-400">
                        {cat.productCount} item{cat.productCount !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right — subcategories */}
        <div className="flex-1 overflow-y-auto p-3 bg-white">
          {!activeCategory ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                <Icon.PiCursorClick size={32} className="text-gray-400" />
              </div>
              <p className="text-sm text-gray-500">Select a category to explore</p>
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

              {subcategories.length > 0 && (
                <>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Subcategories
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {subcategories.map((sub) => (
                      <Link
                        key={sub._id}
                        href={`/shop?category=${activeCategory.slug}&subCategory=${sub.slug}`}
                        onClick={onClose}
                        className="flex flex-col items-center px-3 py-2.5 bg-gray-50 hover:bg-orange-50 border border-gray-100 hover:border-orange-200 rounded-xl transition-all text-center group"
                      >
                        <span className="text-sm text-gray-700 group-hover:text-orange-600 font-medium">
                          {sub.name}
                        </span>
                        {(sub.productCount ?? 0) > 0 && (
                          <span className="text-[10px] text-gray-400 mt-0.5">
                            {sub.productCount} item{sub.productCount !== 1 ? "s" : ""}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CategorySidebar;
