"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import * as Icon from "react-icons/pi";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";
import { TenantData } from "@/context/TenantContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavLink {
  name: string;
  href: string;
  sale?: boolean;
}

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  navLinks: NavLink[];
  isMainSite: boolean;
  tenant?: TenantData | null;
}

// ─── Static data ──────────────────────────────────────────────────────────────

const CATEGORIES = [
  { name: "Whiskey",   emoji: "🥃", slug: "whiskey"   },
  { name: "Wine",      emoji: "🍷", slug: "wine"       },
  { name: "Beer",      emoji: "🍺", slug: "beer"       },
  { name: "Champagne", emoji: "🍾", slug: "champagne"  },
  { name: "Vodka",     emoji: "🫗", slug: "vodka"      },
  { name: "Gin",       emoji: "🍸", slug: "gin"        },
];

const SUPPORT_LINKS = [
  { name: "FAQs",          href: "/faqs",           icon: Icon.PiQuestion  },
  { name: "Track Order",   href: "/order-tracking", icon: Icon.PiTruck     },
  { name: "Shipping Info", href: "/shipping-info",  icon: Icon.PiPackage   },
  { name: "Contact Us",    href: "/contact",        icon: Icon.PiEnvelope  },
];

const NAV_ICONS: Record<string, React.ElementType> = {
  "Home":         Icon.PiHouse,
  "Shop":         Icon.PiStorefront,
  "New Arrivals": Icon.PiSparkle,
  "Sale":         Icon.PiTag,
  "Vendors":      Icon.PiHandshake,
  "Menu":         Icon.PiListBullets,
  "About":        Icon.PiInfo,
  "Contact":      Icon.PiEnvelope,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 mb-2 mt-5 first:mt-1 text-xs font-bold uppercase tracking-widest" style={{ color: "#9ca3af" }}>
      {children}
    </p>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export const MobileMenu: React.FC<MobileMenuProps> = ({
  isOpen,
  onClose,
  navLinks,
  isMainSite,
  tenant,
}) => {
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuth();
  const { cartCount }     = useCart();
  const { wishlistState } = useWishlist();
  const wishlistCount = wishlistState.wishlistArray.length;

  const allNavLinks = [{ name: "Home", href: "/" }, ...navLinks];

  const handleLogout = () => { logout(); onClose(); };

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href.split("?")[0]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 lg:hidden"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ backgroundColor: "rgba(0,0,0,0.65)", backdropFilter: "blur(3px)" }}
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 220 }}
            className="absolute left-0 top-0 bottom-0 w-72 flex flex-col overflow-hidden shadow-2xl"
            style={{ backgroundColor: "#ffffff" }}
          >
            {/* Brand stripe */}
            <div
              className="h-1 flex-shrink-0"
              style={{ background: "linear-gradient(to right, #b20202, #ff3232, #b20202)" }}
            />

            {/* Header — logo + close */}
            <div
              className="flex items-center justify-between px-4 py-3 flex-shrink-0"
              style={{ borderBottom: "1px solid #f0f0f0" }}
            >
              <Link href="/" onClick={onClose} className="flex items-center">
                <Image
                  src="/images/logo.svg"
                  alt={isMainSite ? "DrinksHarbour" : (tenant?.name ?? "DrinksHarbour")}
                  width={140}
                  height={49}
                  priority
                />
              </Link>
              <button
                onClick={onClose}
                aria-label="Close menu"
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{ backgroundColor: "#f3f4f6", color: "#6b7280" }}
              >
                <Icon.PiX size={18} />
              </button>
            </div>

            {/* User strip */}
            {isAuthenticated && user ? (
              <Link
                href="/my-account"
                onClick={onClose}
                className="flex items-center gap-3 px-4 py-3.5 flex-shrink-0 transition-colors"
                style={{ backgroundColor: "#fef2f2", borderBottom: "1px solid #fecaca" }}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: "#b20202" }}
                >
                  <span className="text-white font-bold text-sm">
                    {user.firstName?.[0]?.toUpperCase() ?? "U"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate" style={{ color: "#111111" }}>
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-xs truncate" style={{ color: "#6b7280" }}>
                    {user.email}
                  </p>
                </div>
                <Icon.PiCaretRight size={14} className="flex-shrink-0" style={{ color: "#b20202" }} />
              </Link>
            ) : (
              <div
                className="flex gap-2 px-4 py-3 flex-shrink-0"
                style={{ borderBottom: "1px solid #f0f0f0" }}
              >
                <Link
                  href="/login"
                  onClick={onClose}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-white text-sm font-bold transition-colors"
                  style={{ backgroundColor: "#b20202" }}
                >
                  <Icon.PiSignIn size={15} />
                  Sign In
                </Link>
                <Link
                  href="/register"
                  onClick={onClose}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-colors border"
                  style={{ borderColor: "#e5e7eb", color: "#374151" }}
                >
                  <Icon.PiUserPlus size={15} />
                  Register
                </Link>
              </div>
            )}

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3">

              {/* Cart / Wishlist quick tiles */}
              <div className="grid grid-cols-2 gap-2 mb-1">
                <Link
                  href="/cart"
                  onClick={onClose}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl transition-colors"
                  style={{ backgroundColor: "#f9fafb", border: "1px solid #e5e7eb" }}
                >
                  <div className="relative">
                    <Icon.PiShoppingCart size={17} style={{ color: "#374151" }} />
                    {cartCount > 0 && (
                      <span
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center"
                        style={{ backgroundColor: "#b20202" }}
                      >
                        {cartCount > 9 ? "9+" : cartCount}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-medium" style={{ color: "#374151" }}>
                    Cart{cartCount > 0 ? ` (${cartCount})` : ""}
                  </span>
                </Link>
                <Link
                  href="/wishlist"
                  onClick={onClose}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl transition-colors"
                  style={{ backgroundColor: "#f9fafb", border: "1px solid #e5e7eb" }}
                >
                  <div className="relative">
                    <Icon.PiHeart size={17} style={{ color: "#374151" }} />
                    {wishlistCount > 0 && (
                      <span
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center"
                        style={{ backgroundColor: "#b20202" }}
                      >
                        {wishlistCount > 9 ? "9+" : wishlistCount}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-medium" style={{ color: "#374151" }}>
                    Wishlist{wishlistCount > 0 ? ` (${wishlistCount})` : ""}
                  </span>
                </Link>
              </div>

              {/* Main navigation */}
              <SectionLabel>Navigation</SectionLabel>
              <div className="space-y-0.5">
                {allNavLinks.map((link) => {
                  const NavIcon = NAV_ICONS[link.name] ?? Icon.PiCaretRight;
                  const active  = isActive(link.href);
                  return (
                    <Link
                      key={link.name}
                      href={link.href}
                      onClick={onClose}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
                      style={active
                        ? { backgroundColor: "#fef2f2", color: "#b20202" }
                        : { color: "#374151" }
                      }
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={active
                          ? { backgroundColor: "#b20202" }
                          : { backgroundColor: "#f3f4f6" }
                        }
                      >
                        <NavIcon
                          size={15}
                          style={{ color: active ? "#ffffff" : "#6b7280" }}
                        />
                      </div>
                      <span className="font-medium text-sm">{link.name}</span>
                      {link.sale && (
                        <span
                          className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: "#b20202" }}
                        >
                          SALE
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>

              {/* Categories */}
              <SectionLabel>Browse Categories</SectionLabel>
              <div className="grid grid-cols-3 gap-1.5">
                {CATEGORIES.map((cat) => (
                  <Link
                    key={cat.slug}
                    href={`/shop?category=${cat.slug}`}
                    onClick={onClose}
                    className="flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border transition-all"
                    style={{ backgroundColor: "#f9fafb", borderColor: "#e5e7eb" }}
                  >
                    <span className="text-xl leading-none">{cat.emoji}</span>
                    <span
                      className="text-[10px] font-medium text-center leading-tight"
                      style={{ color: "#6b7280" }}
                    >
                      {cat.name}
                    </span>
                  </Link>
                ))}
              </div>

              {/* Support */}
              <SectionLabel>Support</SectionLabel>
              <div className="space-y-0.5">
                {SUPPORT_LINKS.map((link) => (
                  <Link
                    key={link.name}
                    href={link.href}
                    onClick={onClose}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
                    style={{ color: "#4b5563" }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: "#f3f4f6" }}
                    >
                      <link.icon size={14} style={{ color: "#6b7280" }} />
                    </div>
                    <span className="font-medium text-sm">{link.name}</span>
                  </Link>
                ))}
              </div>

              {/* Sign out */}
              {isAuthenticated && (
                <>
                  <SectionLabel>Account</SectionLabel>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all"
                    style={{ color: "#b20202" }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: "#fef2f2" }}
                    >
                      <Icon.PiSignOut size={14} style={{ color: "#b20202" }} />
                    </div>
                    <span className="font-medium text-sm">Sign Out</span>
                  </button>
                </>
              )}

              <div className="h-4" />
            </div>

            {/* Footer */}
            <div
              className="flex-shrink-0 px-4 py-3"
              style={{ borderTop: "1px solid #f0f0f0" }}
            >
              <p className="text-center text-[10px]" style={{ color: "#d1d5db" }}>
                © 2026 DrinksHarbour · All rights reserved
              </p>
            </div>

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
