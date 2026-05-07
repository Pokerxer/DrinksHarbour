"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Icon from "react-icons/pi";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/context/CartContext";
import { useModalSearchContext } from "@/context/ModalSearchContext";
import { useModalCartContext } from "@/context/ModalCartContext";
import {
  fetchAllCategories,
  fetchAllSubCategories,
  getRootCategories,
  getSubcategories,
  type Category,
  type SubCategory,
} from "@/lib/categories";

const navItems = [
  { id: "home",       label: "Home",       icon: Icon.PiHouse,         activeIcon: Icon.PiHouseFill,        href: "/" },
  { id: "categories", label: "Categories", icon: Icon.PiGridFour,      activeIcon: Icon.PiGridFourFill },
  { id: "profile",    label: "Me",         icon: Icon.PiUser,          activeIcon: Icon.PiUserFill,         href: "/login" },
  { id: "cart",       label: "Cart",       icon: Icon.PiShoppingCart,  activeIcon: Icon.PiShoppingCartFill },
  { id: "chatbot",    label: "Chat",       icon: Icon.PiChatCircle,    activeIcon: Icon.PiChatCircleFill },
];

const MobileBottomNav: React.FC = () => {
  const pathname = usePathname();
  const { cartCount } = useCart();
  const { openModalCart } = useModalCartContext();
  const { openModalSearch } = useModalSearchContext();

  const [showCategories, setShowCategories] = useState(false);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allSubCategories, setAllSubCategories] = useState<SubCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);

  // Lazy: only fetch when the panel opens; both caches are shared so
  // parallel mounts share the same in-flight promise.
  useEffect(() => {
    if (!showCategories) return;
    let cancelled = false;
    Promise.all([fetchAllCategories(), fetchAllSubCategories()]).then(([cats, subs]) => {
      if (!cancelled) {
        setAllCategories(cats);
        setAllSubCategories(subs);
        setLoadingCategories(false);
      }
    });
    return () => { cancelled = true; };
  }, [showCategories]);

  const rootCategories = useMemo(
    () => getRootCategories(allCategories, allSubCategories),
    [allCategories, allSubCategories]
  );

  const subcategories = useMemo(
    () => activeCategory ? getSubcategories(activeCategory, allSubCategories) : [],
    [activeCategory, allSubCategories]
  );

  const handleAction = (id: string) => {
    if (id === "search") openModalSearch();
    else if (id === "cart") openModalCart();
    else if (id === "categories") { setShowCategories(true); setActiveCategory(null); }
    else if (id === "chatbot") document.dispatchEvent(new CustomEvent("toggle-chatbot"));
  };

  const handleClose = () => {
    setShowCategories(false);
    setActiveCategory(null);
  };

  const isActive = (item: (typeof navItems)[0]) => {
    if (!item.href) return false;
    return item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
  };

  return (
    <>
      {/* Categories Drawer */}
      <AnimatePresence>
        {showCategories && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 lg:hidden"
              onClick={handleClose}
            />

            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-y-0 left-0 w-[85%] max-w-[400px] bg-white z-50 flex lg:hidden"
            >
              {/* Left panel — root categories */}
              <div className="w-48 flex-shrink-0 flex flex-col h-full bg-gray-50">
                <div className="p-4 border-b border-gray-200 bg-white">
                  <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Icon.PiGridFour size={18} className="text-orange-500" />
                    Categories
                  </h2>
                </div>

                <div className="flex-1 overflow-y-auto py-2">
                  {loadingCategories ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-2 px-4 py-2.5">
                        <div className="w-6 h-6 rounded bg-gray-200 animate-pulse" />
                        <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
                      </div>
                    ))
                  ) : rootCategories.length === 0 ? (
                    <div className="px-4 py-8 text-center text-gray-500 text-sm">
                      No categories found
                    </div>
                  ) : (
                    rootCategories.map((cat) => (
                      <button
                        key={cat._id}
                        onClick={() => setActiveCategory(cat)}
                        className={`w-full flex items-center gap-2 px-4 py-2.5 transition-all text-left ${
                          activeCategory?._id === cat._id
                            ? "bg-white text-orange-600 border-l-2 border-orange-500"
                            : "text-gray-700 hover:bg-gray-100 border-l-2 border-transparent"
                        }`}
                      >
                        <span className="text-lg">{cat.icon || "🍷"}</span>
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-medium truncate block">{cat.name}</span>
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

                <div className="p-3 border-t border-gray-200 bg-white">
                  <Link
                    href="/shop"
                    onClick={handleClose}
                    className="flex items-center justify-center gap-2 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-xl hover:bg-orange-600 transition-colors"
                  >
                    <Icon.PiList size={16} />
                    All Products
                  </Link>
                </div>
              </div>

              {/* Right panel — subcategories */}
              <div className="flex-1 bg-white overflow-y-auto">
                {activeCategory ? (
                  <div className="p-4">
                    {/* Category header */}
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                        style={{ backgroundColor: `${activeCategory.color || "#F59E0B"}20` }}
                      >
                        {activeCategory.icon || "🍷"}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">{activeCategory.name}</h3>
                        {activeCategory.tagline && (
                          <p className="text-xs text-gray-500">{activeCategory.tagline}</p>
                        )}
                      </div>
                    </div>

                    <Link
                      href={`/shop?category=${activeCategory.slug}`}
                      onClick={handleClose}
                      className="flex items-center justify-center gap-2 w-full py-2.5 mb-4 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 transition-colors"
                    >
                      Shop {activeCategory.name}
                      <Icon.PiArrowRight size={16} />
                    </Link>

                    {subcategories.length > 0 ? (
                      <>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">
                          Subcategories
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                          {subcategories.map((sub) => (
                            <Link
                              key={sub._id}
                              href={`/shop?category=${activeCategory.slug}&subcategory=${sub.slug}`}
                              onClick={handleClose}
                              className="flex flex-col items-center px-3 py-2.5 bg-gray-50 hover:bg-orange-50 rounded-xl text-sm text-gray-700 hover:text-orange-600 font-medium text-center transition-colors"
                            >
                              <span>{sub.name}</span>
                              {(sub.productCount ?? 0) > 0 && (
                                <span className="text-[10px] text-gray-400 mt-0.5">
                                  {sub.productCount} item{sub.productCount !== 1 ? "s" : ""}
                                </span>
                              )}
                            </Link>
                          ))}
                        </div>
                      </>
                    ) : (
                      !loadingCategories && (
                        <p className="text-sm text-gray-400 text-center py-4">
                          No subcategories available
                        </p>
                      )
                    )}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <Icon.PiHandPointing size={32} className="text-gray-400" />
                    </div>
                    <h3 className="font-semibold text-gray-700 mb-1">Select a category</h3>
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

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 safe-area-bottom lg:hidden">
        <div className="flex items-center justify-around py-2 px-1">
          {navItems.map((item) => {
            const active = isActive(item) || (item.id === "categories" && showCategories);
            const IconComponent = active ? item.activeIcon : item.icon;
            const isCart = item.id === "cart";

            return (
              <div key={item.id} className="flex-1 flex justify-center">
                {item.href ? (
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
                    <span className={`text-[11px] font-medium ${active ? "font-semibold" : ""}`}>
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
                    <span className={`text-[11px] font-medium ${active ? "font-semibold" : ""}`}>
                      {item.label}
                    </span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      <div className="h-[60px] lg:hidden" />
    </>
  );
};

export default MobileBottomNav;
