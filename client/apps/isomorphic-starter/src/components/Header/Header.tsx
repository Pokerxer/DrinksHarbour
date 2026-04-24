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
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const getHeaderBg = () => {
    if (variant === "transparent") {
      return isScrolled
        ? "bg-white/95 backdrop-blur-md shadow-sm"
        : "bg-transparent";
    }
    if (variant === "dark") {
      return "bg-[#1A1A2E]";
    }
    return "bg-white";
  };

  const getTextColor = () => {
    if (variant === "dark" || variant === "transparent") {
      return "text-white";
    }
    return "text-gray-900";
  };

  const navLinks = isMainSite
    ? [
        { name: "Shop", href: "/shop" },
        { name: "New Arrivals", href: "/shop?tag=new-arrival" },
        { name: "Sale", href: "/shop?sale=true" },
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
        className={`header relative z-50 transition-all duration-300 ${getHeaderBg()} ${
          isScrolled ? "shadow-sm" : ""
        }`}
      >
        <div
          className={`main-header transition-all duration-300 ${
            isScrolled ? "py-2" : "py-3"
          }`}
        >
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between gap-4">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className={`lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors ${getTextColor()}`}
              >
                <Icon.PiList size={20} />
              </button>

              <HeaderLogo
                tenant={tenant}
                isMainSite={isMainSite}
                variant={variant}
                isScrolled={isScrolled}
              />

              <HeaderNav
                navLinks={navLinks}
                variant={variant}
                getTextColor={getTextColor}
              />

              <HeaderSearch variant={variant} />

              <HeaderActions
                variant={variant}
                getTextColor={getTextColor}
                tenant={tenant}
              />

              <div className="flex lg:hidden items-center gap-1">
                <HeaderActions
                  variant={variant}
                  getTextColor={getTextColor}
                  tenant={tenant}
                  mobile
                />
              </div>
            </div>
          </div>
        </div>

        <div className="md:hidden px-4 pb-3 bg-white">
          <button className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 hover:border-green-500 transition-colors">
            <Icon.PiMagnifyingGlass size={20} className="text-gray-400" />
            <span className="text-gray-500">Search products...</span>
          </button>
        </div>
      </header>

      {showAnnouncement && (
        <div className="border-b border-gray-100">
          <AnnouncementBanner
            placement="header"
            layout="static"
            variant="promo"
          />
        </div>
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