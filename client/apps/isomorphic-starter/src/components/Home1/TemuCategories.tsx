"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
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

interface Product {
  _id: string;
  name: string;
  slug: string;
  images?: Array<{ url: string; alt?: string }>;
  priceRange?: { min: number; max: number; display?: string };
  sale?: boolean;
  discount?: number;
  originPrice?: number;
  type?: string;
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
  const [activeSubcategory, setActiveSubcategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [viewMode, setViewMode] = useState<'categories' | 'products'>('categories');

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

  const handleCategoryClick = async (category: Category) => {
    if (activeCategory?._id === category._id) {
      return;
    }
    setActiveCategory(category);
    setActiveSubcategory(null);
    setViewMode('products');
    setLoadingProducts(true);

    try {
      const res = await fetch(`${API_URL}/api/products?type=${category.slug}&limit=20`);
      const data = await res.json();
      if (data.success && data.data?.products) {
        setProducts(data.data.products);
      } else if (data.products) {
        setProducts(data.products);
      } else {
        setProducts([]);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleSubcategoryClick = async (subcategory: Category) => {
    setActiveSubcategory(subcategory);
    setLoadingProducts(true);

    try {
      const res = await fetch(`${API_URL}/api/products?type=${activeCategory?.slug}&sub=${subcategory.slug}&limit=20`);
      const data = await res.json();
      if (data.success && data.data?.products) {
        setProducts(data.data.products);
      } else if (data.products) {
        setProducts(data.products);
      } else {
        setProducts([]);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleBackToCategories = () => {
    setViewMode('categories');
    setActiveCategory(null);
    setActiveSubcategory(null);
    setProducts([]);
  };

  const handleBackToSubcategories = () => {
    setActiveSubcategory(null);
    setProducts([]);
    if (activeCategory) {
      handleCategoryClick(activeCategory);
    }
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
            <div key={i} className="h-20 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-white sticky top-0 z-20">
        {viewMode === 'products' ? (
          <div className="flex items-center gap-2">
            <button
              onClick={activeSubcategory ? handleBackToSubcategories : handleBackToCategories}
              className="p-1 -ml-1"
            >
              <Icon.PiArrowLeft size={20} className="text-gray-600" />
            </button>
            <h2 className="font-bold text-gray-900 truncate">
              {activeSubcategory?.name || activeCategory?.name}
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
        {/* Left Panel - Categories/Subcategories */}
        <div className="w-[35%] bg-gray-50 overflow-y-auto border-r border-gray-100">
          <div className="py-2">
            {viewMode === 'products' && (
              <button
                onClick={handleBackToCategories}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 transition-colors text-left"
              >
                <Icon.PiArrowLeft size={16} className="text-gray-500" />
                <span className="text-sm font-medium text-gray-700">All Categories</span>
              </button>
            )}
            {(viewMode === 'categories' ? categories : activeCategory ? getSubcategories(activeCategory) : []).map((cat) => {
              const isActive = viewMode === 'products' 
                ? cat._id === activeSubcategory?._id
                : cat._id === activeCategory?._id;
              
              return (
                <button
                  key={cat._id}
                  onClick={() => {
                    if (viewMode === 'categories') {
                      handleCategoryClick(cat);
                    } else {
                      handleSubcategoryClick(cat);
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${
                    isActive
                      ? "bg-white border-l-2 border-orange-500"
                      : "hover:bg-gray-100 border-l-2 border-transparent"
                  }`}
                >
                  <span className="text-xl">{cat.icon || "🍷"}</span>
                  <span className={`text-sm font-medium truncate ${
                    isActive ? "text-orange-600" : "text-gray-700"
                  }`}>
                    {cat.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Panel - Products */}
        <div className="flex-1 overflow-y-auto p-3 bg-white">
          {loadingProducts ? (
            <div className="grid grid-cols-2 gap-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="aspect-square bg-gray-100 rounded-xl animate-pulse" />
                  <div className="h-3 bg-gray-100 rounded animate-pulse" />
                  <div className="h-3 w-2/3 bg-gray-100 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                <Icon.PiPackage size={32} className="text-gray-400" />
              </div>
              <p className="text-sm text-gray-500">
                No products found in this category
              </p>
                <Link
                  href={`/shop?category=${activeCategory?.slug}`}
                  onClick={onClose}
                  className="mt-3 px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
                >
                  Browse All
                </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {products.map((product) => (
                <Link
                  key={product._id}
                  href={`/product/${product.slug}`}
                  onClick={onClose}
                  className="group"
                >
                  <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden relative mb-2">
                    {product.images && product.images[0]?.url ? (
                      <Image
                        src={product.images[0].url}
                        alt={product.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Icon.PiImage size={32} className="text-gray-300" />
                      </div>
                    )}
                    {product.sale && (
                      <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-red-500 text-white text-xs font-medium rounded">
                        -{product.discount || 0}%
                      </span>
                    )}
                  </div>
                  <h3 className="text-xs font-medium text-gray-800 line-clamp-2 mb-1 group-hover:text-orange-600 transition-colors">
                    {product.name}
                  </h3>
                  <p className="text-sm font-bold text-gray-900">
                    {product.priceRange?.display || `₦${(product.priceRange?.min || 0).toLocaleString()}`}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CategorySidebar;
