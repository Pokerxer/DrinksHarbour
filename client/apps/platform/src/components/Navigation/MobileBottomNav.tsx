"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Icon from "react-icons/pi";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/context/CartContext";
import { useModalSearchUIContext } from "@/context/ModalSearchContext";
import { useModalCartContext } from "@/context/ModalCartContext";
import {
  fetchAllCategories,
  fetchAllSubCategories,
  getRootCategories,
  getSubcategories,
  type Category,
  type SubCategory,
} from "@/lib/categories";
import { resolveCategoryIcon } from "@/lib/category-icons";

const navItems = [
  { id: "home",       label: "Home",       icon: Icon.PiHouse,        activeIcon: Icon.PiHouseFill,       href: "/" },
  { id: "categories", label: "Categories", icon: Icon.PiGridFour,     activeIcon: Icon.PiGridFourFill },
  { id: "profile",    label: "Me",         icon: Icon.PiUser,         activeIcon: Icon.PiUserFill,        href: "/my-account" },
  { id: "cart",       label: "Cart",       icon: Icon.PiShoppingCart, activeIcon: Icon.PiShoppingCartFill },
  { id: "chatbot",    label: "Chat",       icon: Icon.PiChatCircle,   activeIcon: Icon.PiChatCircleFill },
];

// ── Shared inner content for each nav tab ────────────────────────────────────

function NavItemContent({
  item,
  active,
  cartCount,
}: {
  item: (typeof navItems)[0];
  active: boolean;
  cartCount: number;
}) {
  const IconComponent = active ? item.activeIcon : item.icon;
  const isCart = item.id === "cart";

  return (
    <div className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${
      active ? "text-orange-500" : "text-gray-500"
    }`}>
      <div className="relative">
        <IconComponent size={20} />
        {isCart && cartCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[13px] h-[13px] bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center px-0.5">
            {cartCount > 99 ? "99+" : cartCount}
          </span>
        )}
      </div>
      <span className={`text-[10px] leading-none ${active ? "font-semibold" : "font-medium"}`}>
        {item.label}
      </span>
      {/* Active indicator dot */}
      <span className={`h-1 w-1 rounded-full transition-all ${active ? "bg-orange-500 opacity-100" : "opacity-0"}`} />
    </div>
  );
}

// ── Category icon chip ────────────────────────────────────────────────────────

function CategoryIconChip({
  cat,
  size = 36,
  active,
}: {
  cat: { slug?: string; name?: string; icon?: string; color?: string };
  size?: number;
  active?: boolean;
}) {
  const { icon: Ic, color, bgTint } = resolveCategoryIcon(cat);
  return (
    <span
      className={`flex flex-shrink-0 items-center justify-center rounded-xl transition-colors ${bgTint} ${active ? "ring-2 ring-orange-300" : ""}`}
      style={{ width: size, height: size }}
    >
      <Ic size={size * 0.5} style={{ color }} />
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const MobileBottomNav: React.FC = () => {
  const pathname = usePathname();
  const { cartCount } = useCart();
  const { openModalCart } = useModalCartContext();
  const { openModalSearch } = useModalSearchUIContext();

  const [showCategories, setShowCategories] = useState(false);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allSubCategories, setAllSubCategories] = useState<SubCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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

  // Filtered root categories by search query
  const filteredRoots = useMemo(() => {
    if (!searchQuery.trim()) return rootCategories;
    const q = searchQuery.toLowerCase();
    return rootCategories.filter(c => c.name.toLowerCase().includes(q));
  }, [rootCategories, searchQuery]);

  // Flat subcategory search — when searching, show all subs matching the query
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allSubCategories
      .filter(s => (s.productCount ?? 0) > 0 && s.name.toLowerCase().includes(q))
      .slice(0, 20);
  }, [allSubCategories, searchQuery]);

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

  const handleClose = useCallback(() => {
    setShowCategories(false);
    setActiveCategory(null);
    setSearchQuery("");
  }, []);

  const isActive = (item: (typeof navItems)[0]) => {
    if (!item.href) return false;
    return item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
  };

  // Find the parent category for a subcategory (for search result links)
  const parentOf = useCallback((sub: SubCategory): Category | undefined => {
    const pid = typeof sub.parent === "string" ? sub.parent : (sub.parent as any)?._id;
    return rootCategories.find(c => c._id === pid);
  }, [rootCategories]);

  return (
    <>
      {/* ── Categories Drawer ─────────────────────────────────────────────── */}
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
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="fixed inset-y-0 left-0 w-[88%] max-w-[420px] bg-white z-50 flex flex-col lg:hidden"
            >
              {/* ── Drawer header ───────────────────────────────────────────── */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50 text-orange-500">
                    <Icon.PiGridFourFill size={15} />
                  </span>
                  Categories
                </h2>
                <button
                  onClick={handleClose}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
                  aria-label="Close categories"
                >
                  <Icon.PiXBold size={16} />
                </button>
              </div>

              {/* ── Search bar ──────────────────────────────────────────────── */}
              <div className="px-4 py-2.5 border-b border-gray-100">
                <div className="relative">
                  <Icon.PiMagnifyingGlass
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search categories…"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100"
                  />
                  {searchQuery ? (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                      aria-label="Clear search"
                    >
                      <Icon.PiX size={14} />
                    </button>
                  ) : null}
                </div>
              </div>

              {/* ── Search results (replaces split panel when searching) ────── */}
              {searchQuery.trim() ? (
                <div className="flex-1 overflow-y-auto p-3">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    {searchResults.length + filteredRoots.length} result{filteredRoots.length + searchResults.length !== 1 ? "s" : ""}
                  </p>
                  {filteredRoots.length === 0 && searchResults.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                        <Icon.PiMagnifyingGlass size={24} />
                      </span>
                      <p className="mt-3 text-sm text-gray-500">No categories match &ldquo;{searchQuery}&rdquo;</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {filteredRoots.map((cat) => (
                        <Link
                          key={cat._id}
                          href={`/shop?category=${cat.slug}`}
                          onClick={handleClose}
                          className="flex items-center gap-3 rounded-xl border border-gray-100 p-2.5 transition hover:border-orange-200 hover:bg-orange-50/50"
                        >
                          <CategoryIconChip cat={cat} size={40} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-gray-900">{cat.name}</p>
                            {(cat.productCount ?? 0) > 0 && (
                              <p className="text-[11px] text-gray-400">{cat.productCount} products</p>
                            )}
                          </div>
                          <Icon.PiCaretRight size={14} className="flex-shrink-0 text-gray-300" />
                        </Link>
                      ))}
                      {searchResults.map((sub) => {
                        const parent = parentOf(sub);
                        return (
                          <Link
                            key={sub._id}
                            href={`/shop?category=${parent?.slug ?? ""}&subcategory=${sub.slug}`}
                            onClick={handleClose}
                            className="flex items-center gap-3 rounded-xl border border-gray-100 p-2.5 transition hover:border-orange-200 hover:bg-orange-50/50"
                          >
                            <CategoryIconChip cat={sub} size={40} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-gray-900">{sub.name}</p>
                              <p className="truncate text-[11px] text-gray-400">
                                {parent?.name ?? "Category"} · {sub.productCount ?? 0} products
                              </p>
                            </div>
                            <Icon.PiCaretRight size={14} className="flex-shrink-0 text-gray-300" />
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* ── Split panel (default browse view) ──────────────────────── */
                <div className="flex flex-1 overflow-hidden">
                  {/* Left panel — root categories */}
                  <div className="w-[42%] flex-shrink-0 flex flex-col h-full border-r border-gray-100 bg-gray-50/60">
                    <div className="flex-1 overflow-y-auto py-1.5">
                      {loadingCategories ? (
                        Array.from({ length: 8 }).map((_, i) => (
                          <div key={i} className="flex items-center gap-2.5 px-3 py-2.5">
                            <div className="h-9 w-9 rounded-xl bg-gray-200 animate-pulse" />
                            <div className="flex-1 space-y-1">
                              <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
                              <div className="h-2 w-12 bg-gray-200 rounded animate-pulse" />
                            </div>
                          </div>
                        ))
                      ) : filteredRoots.length === 0 ? (
                        <div className="px-3 py-10 text-center text-gray-500 text-sm">
                          No categories found
                        </div>
                      ) : (
                        filteredRoots.map((cat) => {
                          const active = activeCategory?._id === cat._id;
                          return (
                            <button
                              key={cat._id}
                              onClick={() => setActiveCategory(cat)}
                              className={`w-full flex items-center gap-2.5 px-3 py-2.5 transition-all text-left ${
                                active
                                  ? "bg-white border-l-2 border-orange-500"
                                  : "border-l-2 border-transparent hover:bg-gray-100/70"
                              }`}
                            >
                              <CategoryIconChip cat={cat} size={36} active={active} />
                              <div className="min-w-0 flex-1">
                                <span className={`text-xs font-semibold truncate block ${
                                  active ? "text-orange-600" : "text-gray-800"
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
                          );
                        })
                      )}
                    </div>

                    <div className="p-2.5 border-t border-gray-200 bg-white">
                      <Link
                        href="/shop"
                        onClick={handleClose}
                        className="flex items-center justify-center gap-1.5 py-2.5 bg-orange-500 text-white text-xs font-bold rounded-xl hover:bg-orange-600 transition-colors"
                      >
                        <Icon.PiStorefront size={14} />
                        All Products
                      </Link>
                    </div>
                  </div>

                  {/* Right panel — subcategories */}
                  <div className="flex-1 bg-white overflow-y-auto">
                    {activeCategory ? (
                      <div className="p-3">
                        {/* Category header with icon chip */}
                        <div className="flex items-center gap-3 mb-3">
                          <CategoryIconChip cat={activeCategory} size={44} />
                          <div className="min-w-0">
                            <h3 className="font-bold text-gray-900 text-sm truncate">{activeCategory.name}</h3>
                            {activeCategory.tagline && (
                              <p className="text-[11px] text-gray-500 truncate">{activeCategory.tagline}</p>
                            )}
                          </div>
                        </div>

                        <Link
                          href={`/shop?category=${activeCategory.slug}`}
                          onClick={handleClose}
                          className="flex items-center justify-center gap-1.5 w-full py-2.5 mb-4 bg-orange-500 text-white text-xs font-bold rounded-xl hover:bg-orange-600 transition-colors"
                        >
                          Shop {activeCategory.name}
                          <Icon.PiArrowRight size={14} />
                        </Link>

                        {subcategories.length > 0 ? (
                          <>
                            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">
                              Subcategories
                            </h4>
                            <div className="grid grid-cols-2 gap-2">
                              {subcategories.map((sub) => (
                                <Link
                                  key={sub._id}
                                  href={`/shop?category=${activeCategory.slug}&subcategory=${sub.slug}`}
                                  onClick={handleClose}
                                  className="flex flex-col items-center gap-2 px-2 py-3 bg-gray-50 hover:bg-orange-50 border border-gray-100 hover:border-orange-200 rounded-xl text-center transition-all group"
                                >
                                  <CategoryIconChip cat={sub} size={32} />
                                  <div>
                                    <span className="text-xs font-medium text-gray-700 group-hover:text-orange-600 block leading-tight">
                                      {sub.name}
                                    </span>
                                    {(sub.productCount ?? 0) > 0 && (
                                      <span className="text-[10px] text-gray-400 mt-0.5 block">
                                        {sub.productCount}
                                      </span>
                                    )}
                                  </div>
                                </Link>
                              ))}
                            </div>
                          </>
                        ) : (
                          !loadingCategories && (
                            <div className="flex flex-col items-center justify-center py-10 text-center">
                              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                                <Icon.PiPackage size={22} />
                              </span>
                              <p className="mt-2.5 text-xs text-gray-500">No subcategories yet</p>
                              <Link
                                href={`/shop?category=${activeCategory.slug}`}
                                onClick={handleClose}
                                className="mt-3 text-xs font-semibold text-orange-600 hover:underline"
                              >
                                Browse {activeCategory.name} →
                              </Link>
                            </div>
                          )
                        )}
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 text-orange-400">
                          <Icon.PiHandTap size={28} />
                        </span>
                        <h3 className="mt-3 font-bold text-gray-800 text-sm">Pick a category</h3>
                        <p className="mt-1 text-xs text-gray-500 max-w-[200px]">
                          Tap a category on the left to browse its subcategories
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Bottom Navigation Bar ───────────────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 safe-area-bottom lg:hidden">
        <div className="flex items-center justify-around px-1 py-1">
          {navItems.map((item) => {
            const active = isActive(item) || (item.id === "categories" && showCategories);

            return (
              <div key={item.id} className="flex-1 flex justify-center">
                {item.href ? (
                  <Link href={item.href}>
                    <NavItemContent item={item} active={active} cartCount={cartCount} />
                  </Link>
                ) : (
                  <button onClick={() => handleAction(item.id)}>
                    <NavItemContent item={item} active={active} cartCount={cartCount} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      <div className="h-[52px] lg:hidden" />
    </>
  );
};

export default MobileBottomNav;