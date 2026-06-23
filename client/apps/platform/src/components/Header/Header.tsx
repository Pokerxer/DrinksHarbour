"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Icon from "react-icons/pi";
import { HeaderLogo } from "./HeaderLogo";
import { HeaderNav } from "./HeaderNav";
import { HeaderSearch } from "./HeaderSearch";
import { HeaderActions } from "./HeaderActions";
import { MobileMenu } from "./MobileMenu";
import { AnnouncementBanner } from "@/components/Banner";
import { useTenant } from "@/context/TenantContext";

interface HeaderProps {
  variant?: "default" | "transparent" | "dark";
  showAnnouncement?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  variant = "default",
  showAnnouncement = true,
}) => {
  const pathname = usePathname();
  const { tenant, isMainSite } = useTenant();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const getHeaderBg = () => {
    if (variant === "transparent") {
      return isScrolled
        ? "bg-white/95 backdrop-blur-lg shadow-md"
        : "bg-transparent";
    }
    if (variant === "dark") return "bg-[#1A1A2E]";
    return isScrolled ? "bg-white shadow-md" : "bg-white shadow-sm";
  };

  const getTextColor = () =>
    variant === "dark" || (variant === "transparent" && !isScrolled)
      ? "text-white"
      : "text-gray-800";

  const navLinks = isMainSite
    ? [
        { name: "Shop", href: "/shop" },
        { name: "New Arrivals", href: "/shop?tag=new-arrival" },
        { name: "Sale", href: "/shop?sale=true", sale: true },
        { name: "Vendors", href: "/vendors" },
      ]
    : [
        { name: "Shop", href: "/shop" },
        { name: "Menu", href: "/menu" },
        { name: "About", href: "/about" },
        { name: "Contact", href: "/contact" },
      ];

  return (
    <>
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${getHeaderBg()}`}
      >
        {/* Red accent line at top */}
        <div className="h-0.5 bg-gradient-to-r from-red-600 via-orange-400 to-red-600" />

        <div className={`transition-all duration-300 ${isScrolled ? "py-2" : "py-3"}`}>
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-4">

              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className={`lg:hidden p-2 rounded-lg transition-colors hover:bg-gray-100 ${getTextColor()}`}
              >
                <Icon.PiList size={22} />
              </button>

              {/* Logo — hidden on mobile (search bar takes its place) */}
              <div className="hidden lg:block">
                <HeaderLogo
                  tenant={tenant}
                  isMainSite={isMainSite}
                  variant={variant}
                  isScrolled={isScrolled}
                />
              </div>

              {/* Nav — desktop */}
              <HeaderNav
                navLinks={navLinks}
                variant={variant}
                getTextColor={getTextColor}
                pathname={pathname}
              />

              {/* Search — grows to fill space */}
              <HeaderSearch variant={variant} />

              {/* Actions — desktop */}
              <HeaderActions
                variant={variant}
                getTextColor={getTextColor}
                tenant={tenant}
              />


            </div>
          </div>
        </div>

        {/* Bottom border */}
        <div className={`h-px ${variant === "dark" ? "bg-white/10" : "bg-gray-100"}`} />
      </header>

      {showAnnouncement && (
        <AnnouncementBanner placement="header" layout="static" variant="promo" />
      )}

      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        navLinks={navLinks}
        isMainSite={isMainSite}
        tenant={tenant}
      />
    </>
  );
};

export default Header;
