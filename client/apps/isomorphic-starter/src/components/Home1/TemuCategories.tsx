"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import * as Icon from "react-icons/pi";
import { motion, AnimatePresence } from "framer-motion";

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

interface Product {
  _id: string;
  name: string;
  slug: string;
  type: string;
  images?: Array<{ url: string }>;
  priceRange?: { min: number; max: number; display?: string };
  sale?: boolean;
  originPrice?: number;
  brand?: { name: string };
}

interface CategorySidebarProps {
  onClose?: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

const CategorySidebar: React.FC<CategorySidebarProps> = ({ onClose }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"subcategories" | "products">("subcategories");

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

  const getActiveCategory = (): Category | undefined => {
    return categories.find((c) => c.slug === activeCategory);
  };

  const getActiveSubcategory = (): Category | undefined => {
    if (!activeSubcategory) return undefined;
    return allCategories.find((c) => c.slug === activeSubcategory);
  };

  const handleCategoryClick = async (slug: string) => {
    setActiveCategory(slug);
    setActiveSubcategory(null);
    setViewMode("subcategories");
    setProducts([]);
    
    const category = categories.find((c) => c.slug === slug);
    if (!category) return;

    setLoadingProducts(true);
    try {
      const res = await fetch(`${API_URL}/api/products?type=${slug}&limit=20`);
      const data = await res.json();
      if (data.success) {
        const prods = data.data?.products || data.products || [];
        setProducts(prods);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleSubcategoryClick = async (slug: string) => {
    setActiveSubcategory(slug);
    
    setLoadingProducts(true);
    try {
      const res = await fetch(`${API_URL}/api/products?type=${activeCategory}&sub=${slug}&limit=20`);
      const data = await res.json();
      if (data.success) {
        const prods = data.data?.products || data.products || [];
        setProducts(prods);
      }
    } catch (error) {
      console.error("Error fetching subcategory products:", error);
    } finally {
      setLoadingProducts(false);
    }
  };

  const formatPrice = (price: number) => {
    return '₦' + price.toLocaleString();
  };

  if (loading) {
    return (
      <div className="bg-white h-full flex">
        <div className="w-24 bg-gray-50 p-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 py-3 animate-pulse">
              <div className="w-10 h-10 bg-gray-200 rounded-full" />
              <div className="h-2 w-12 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
        <div className="flex-1 p-4">
          <div className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square bg-gray-200 rounded-lg mb-2" />
                <div className="h-3 w-16 bg-gray-200 rounded mb-1" />
                <div className="h-2 w-12 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900">
            <Icon.PiGridFour size={18} className="text-orange-500" />
            Categories
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
          >
            <Icon.PiX size={18} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* Main Content - Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Categories & Subcategories */}
        <div className="w-24 bg-gray-50 overflow-y-auto flex-shrink-0">
          {categories.map((cat) => (
            <button
              key={cat._id}
              onClick={() => handleCategoryClick(cat.slug)}
              className={`w-full flex flex-col items-center gap-1 py-3 px-2 border-b border-gray-100 transition-colors ${
                activeCategory === cat.slug
                  ? "bg-white border-l-2 border-l-orange-500"
                  : "hover:bg-gray-100"
              }`}
            >
              <span className="text-xl">{cat.icon || "🍷"}</span>
              <span className={`text-[10px] text-center leading-tight ${
                activeCategory === cat.slug ? "text-orange-600 font-medium" : "text-gray-600"
              }`}>
                {cat.name}
              </span>
            </button>
          ))}
        </div>

        {/* Right: Subcategories & Products */}
        <div className="flex-1 overflow-y-auto bg-white">
          <AnimatePresence mode="wait">
            {activeCategory ? (
              <motion.div
                key={activeCategory}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.15 }}
                className="p-3"
              >
                {/* Subcategories Row */}
                <div className="flex gap-2 overflow-x-auto pb-3 mb-3 border-b border-gray-100 scrollbar-hide">
                  <button
                    onClick={() => {
                      setActiveSubcategory(null);
                      handleCategoryClick(activeCategory);
                    }}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      !activeSubcategory
                        ? "bg-orange-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    All
                  </button>
                  {getSubcategories(getActiveCategory()!).map((sub) => (
                    <button
                      key={sub._id}
                      onClick={() => handleSubcategoryClick(sub.slug)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        activeSubcategory === sub.slug
                          ? "bg-orange-500 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {sub.name}
                    </button>
                  ))}
                </div>

                {/* Products Grid */}
                {loadingProducts ? (
                  <div className="grid grid-cols-2 gap-3">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="aspect-square bg-gray-200 rounded-lg mb-2" />
                        <div className="h-3 w-16 bg-gray-200 rounded mb-1" />
                        <div className="h-2 w-12 bg-gray-200 rounded" />
                      </div>
                    ))}
                  </div>
                ) : products.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {products.map((product) => (
                      <Link
                        key={product._id}
                        href={`/product/${product.slug}`}
                        onClick={onClose}
                        className="group"
                      >
                        <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-2 relative">
                          {product.images && product.images[0]?.url ? (
                            <Image
                              src={product.images[0].url}
                              alt={product.name}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-3xl">
                              {getActiveCategory()?.icon || "🍷"}
                            </div>
                          )}
                          {product.sale && (
                            <span className="absolute top-1 left-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded">
                              SALE
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-800 font-medium line-clamp-2 mb-1 group-hover:text-orange-600 transition-colors">
                          {product.name}
                        </p>
                        <p className="text-xs text-orange-600 font-semibold">
                          {product.priceRange?.display || (product.priceRange ? formatPrice(product.priceRange.min) : '')}
                        </p>
                        {product.brand && (
                          <p className="text-[10px] text-gray-400 mt-0.5">{product.brand.name}</p>
                        )}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    No products found
                  </div>
                )}

                {/* Load More */}
                {products.length > 0 && (
                  <Link
                    href={`/shop?type=${activeCategory}${activeSubcategory ? `&sub=${activeSubcategory}` : ''}`}
                    onClick={onClose}
                    className="flex items-center justify-center gap-2 w-full py-3 mt-4 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-medium text-gray-700 transition-colors"
                  >
                    View All {getActiveCategory()?.name}
                    <Icon.PiArrowRight size={14} />
                  </Link>
                )}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-full text-center p-6"
              >
                <span className="text-4xl mb-3">👆</span>
                <p className="text-sm text-gray-500">Select a category</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default CategorySidebar;
