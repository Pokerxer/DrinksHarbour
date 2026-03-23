"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Icon from "react-icons/pi";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/context/CartContext";
import { useModalSearchContext } from "@/context/ModalSearchContext";
import { useModalCartContext } from "@/context/ModalCartContext";

interface Category {
  _id: string;
  name: string;
  slug: string;
  icon?: string;
  color?: string;
  tagline?: string;
  description?: string;
  isFeatured?: boolean;
  isTrending?: boolean;
  parent?: string | null;
  subCategories?: string[];
  level?: number;
}

const navItems = [
  {
    id: "home",
    label: "Home",
    icon: Icon.PiHouse,
    activeIcon: Icon.PiHouseFill,
    href: "/",
  },
  {
    id: "categories",
    label: "Categories",
    icon: Icon.PiGridFour,
    activeIcon: Icon.PiGridFourFill,
  },
  {
    id: "search",
    label: "Search",
    icon: Icon.PiMagnifyingGlass,
    activeIcon: Icon.PiMagnifyingGlassBold,
  },
  {
    id: "cart",
    label: "Cart",
    icon: Icon.PiShoppingCart,
    activeIcon: Icon.PiShoppingCartFill,
  },
  {
    id: "profile",
    label: "Me",
    icon: Icon.PiUser,
    activeIcon: Icon.PiUserFill,
    href: "/login",
  },
];

const MobileBottomNav: React.FC = () => {
  const pathname = usePathname();
  const { cartCount } = useCart();
  const { openModalCart } = useModalCartContext();
  const { openModalSearch } = useModalSearchContext();
  const [showCategories, setShowCategories] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [activeCategorySubs, setActiveCategorySubs] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loadingSubCategories, setLoadingSubCategories] = useState(false);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const API_URL =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";
        const res = await fetch(`${API_URL}/api/categories`);
        const data = await res.json();
        if (data.success && data.data?.categories) {
          const allCats = data.data.categories;
          setAllCategories(allCats);
          // Filter top-level categories (level 0 and no parent)
          const topLevel = allCats.filter(
            (c: Category) => !c.parent && c.level === 0,
          );
          setCategories(topLevel);
        }
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    if (!activeCategory) {
      setActiveCategorySubs([]);
      return;
    }

    const categoryData = categories.find((c) => c.slug === activeCategory);
    if (!categoryData) {
      setActiveCategorySubs([]);
      return;
    }

    setLoadingSubCategories(true);

    // Get subcategories by filtering all categories with this parent ID
    const categoryId =
      typeof categoryData._id === "string"
        ? categoryData._id
        : (categoryData._id as any).toString();

    const subs = allCategories.filter((c: Category) => {
      const parentId = c.parent
        ? typeof c.parent === "string"
          ? c.parent
          : (c.parent as any).toString()
        : null;
      return parentId === categoryId;
    });

    setActiveCategorySubs(subs);
    setLoadingSubCategories(false);
  }, [activeCategory, categories, allCategories]);

  const handleAction = (id: string) => {
    if (id === "search") {
      openModalSearch();
    } else if (id === "cart") {
      openModalCart();
    } else if (id === "categories") {
      setShowCategories(true);
      setActiveCategory(null);
    }
  };

  const handleCloseCategories = () => {
    setShowCategories(false);
    setActiveCategory(null);
  };

  const isActive = (item: (typeof navItems)[0]) => {
    if (item.href) {
      if (item.href === "/") return pathname === "/";
      return pathname.startsWith(item.href);
    }
    return false;
  };

  const activeCategoryData = categories.find((c) => c.slug === activeCategory);

  const getSubcategories = (
    category: Category,
  ): { name: string; slug: string }[] => {
    // If we have real subcategories from API, use them
    if (activeCategorySubs.length > 0) {
      return activeCategorySubs.map((sub) => ({
        name: sub.name,
        slug: `/shop?type=${sub.slug}`,
      }));
    }

    // Fallback to generated subcategories
    const prefixes = [
      "Premium",
      "Classic",
      "Budget",
      "Imported",
      "Local",
      "Organic",
      "Vintage",
    ];
    return prefixes.slice(0, 6).map((prefix) => ({
      name: `${prefix} ${category.name}`,
      slug: `/shop?type=${category.slug}&q=${encodeURIComponent(prefix.toLowerCase())}`,
    }));
  };

  return (
    <>
      {/* Categories Sidebar */}
      <AnimatePresence>
        {showCategories && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 lg:hidden"
              onClick={handleCloseCategories}
            />

            {/* Sidebar */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-y-0 left-0 w-[85%] max-w-[400px] bg-white z-50 flex lg:hidden"
            >
              {/* Left Panel - Categories List */}
              <div className="w-48 flex-shrink-0 flex flex-col h-full bg-gray-50">
                {/* Header */}
                <div className="p-4 border-b border-gray-200 bg-white">
                  <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Icon.PiGridFour size={18} className="text-orange-500" />
                    Categories
                  </h2>
                </div>

                {/* Category List */}
                <div className="flex-1 overflow-y-auto py-2">
                  {categories.map((cat) => (
                    <button
                      key={cat._id}
                      onClick={() => setActiveCategory(cat.slug)}
                      className={`w-full flex items-center gap-2 px-4 py-2.5 transition-all text-left ${
                        activeCategory === cat.slug
                          ? "bg-white text-orange-600 border-l-2 border-orange-500"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <span className="text-lg">{cat.icon || "🍷"}</span>
                      <span className="text-sm font-medium truncate">
                        {cat.name}
                      </span>
                    </button>
                  ))}
                </div>

                {/* View All */}
                <div className="p-3 border-t border-gray-200 bg-white">
                  <Link
                    href="/shop"
                    onClick={handleCloseCategories}
                    className="flex items-center justify-center gap-2 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-xl hover:bg-orange-600 transition-colors"
                  >
                    <Icon.PiList size={16} />
                    All Products
                  </Link>
                </div>
              </div>

              {/* Right Panel - Subcategories */}
              <div className="flex-1 bg-white overflow-y-auto">
                {activeCategory && activeCategoryData ? (
                  <div className="p-4">
                    {/* Category Header */}
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                        style={{
                          backgroundColor: `${activeCategoryData.color || "#F59E0B"}20`,
                        }}
                      >
                        {activeCategoryData.icon || "🍷"}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">
                          {activeCategoryData.name}
                        </h3>
                        {activeCategoryData.tagline && (
                          <p className="text-xs text-gray-500">
                            {activeCategoryData.tagline}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Shop Now */}
                    <Link
                      href={`/shop?type=${activeCategoryData.slug}`}
                      onClick={handleCloseCategories}
                      className="flex items-center justify-center gap-2 w-full py-2.5 mb-4 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 transition-colors"
                    >
                      Shop {activeCategoryData.name}
                      <Icon.PiArrowRight size={16} />
                    </Link>

                    {/* Subcategories */}
                    <div className="mb-4">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">
                        {loadingSubCategories ? "Loading..." : "Popular Types"}
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {getSubcategories(activeCategoryData).map(
                          (sub, idx) => (
                            <Link
                              key={idx}
                              href={sub.slug}
                              onClick={handleCloseCategories}
                              className="px-3 py-2.5 bg-gray-50 hover:bg-orange-50 rounded-xl text-sm text-gray-700 hover:text-orange-600 font-medium text-center transition-colors"
                            >
                              {sub.name}
                            </Link>
                          ),
                        )}
                      </div>
                    </div>

                    {/* Occasions */}
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">
                        Shop by Occasion
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {["🎉 Party", "🍽️ Dinner", "🎁 Gift", "🏢 Office"].map(
                          (occasion) => (
                            <Link
                              key={occasion}
                              href={`/shop?type=${activeCategoryData.slug}&occasion=${occasion.split(" ")[0].toLowerCase()}`}
                              onClick={handleCloseCategories}
                              className="px-3 py-1.5 bg-gray-100 hover:bg-orange-50 rounded-full text-xs text-gray-600 hover:text-orange-600 transition-colors"
                            >
                              {occasion}
                            </Link>
                          ),
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <Icon.PiHandPointing
                        size={32}
                        className="text-gray-400"
                      />
                    </div>
                    <h3 className="font-semibold text-gray-700 mb-1">
                      Select a category
                    </h3>
                    <p className="text-xs text-gray-500">
                      Tap a category on the left to see subcategories
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom Navigation Bar - Temu Style */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 safe-area-bottom lg:hidden">
        <div className="flex items-center justify-around py-2 px-1">
          {navItems.map((item) => {
            const active =
              isActive(item) || (item.id === "categories" && showCategories);
            const IconComponent = active ? item.activeIcon : item.icon;
            const isCart = item.id === "cart";
            const hasAction = !item.href;

            return (
              <div key={item.id} className="flex-1 flex justify-center">
                {item.href && !hasAction ? (
                  <Link
                    href={item.href}
                    className={`flex flex-col items-center gap-1.5 py-3 px-4 rounded-xl transition-all ${
                      active ? "text-orange-500" : "text-gray-500"
                    }`}
                  >
                    <div className="relative">
                      <IconComponent size={22} />
                      {isCart && cartCount > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                          {cartCount > 99 ? "99+" : cartCount}
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[11px] font-medium ${active ? "font-semibold" : ""}`}
                    >
                      {item.label}
                    </span>
                  </Link>
                ) : (
                  <button
                    onClick={() => handleAction(item.id)}
                    className={`flex flex-col items-center gap-1.5 py-3 px-4 rounded-xl transition-all ${
                      active ? "text-orange-500" : "text-gray-500"
                    }`}
                  >
                    <div className="relative">
                      <IconComponent size={22} />
                      {isCart && cartCount > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                          {cartCount > 99 ? "99+" : cartCount}
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[11px] font-medium ${
                        active ? "font-semibold" : ""
                      }`}
                    >
                      {item.label}
                    </span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {/* Spacer for mobile nav */}
      <div className="h-[60px] lg:hidden" />
    </>
  );
};

export default MobileBottomNav;
