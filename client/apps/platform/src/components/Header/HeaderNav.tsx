"use client";

import React from "react";
import Link from "next/link";
import * as Icon from "react-icons/pi";

interface NavLink {
  name: string;
  href: string;
  sale?: boolean;
}

interface HeaderNavProps {
  navLinks: NavLink[];
  variant: "default" | "transparent" | "dark";
  getTextColor: () => string;
  pathname?: string;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  navLinks,
  variant,
  getTextColor,
  pathname,
}) => {
  const isDark = variant === "dark";

  return (
    <nav className="hidden lg:flex items-center gap-0.5 flex-shrink-0">
      {navLinks.map((link) => {
        const isActive =
          pathname === link.href ||
          (link.href !== "/" &&
            !link.href.includes("?") &&
            pathname?.startsWith(link.href));

        if (link.sale) {
          return (
            <Link
              key={link.name}
              href={link.href}
              className="flex items-center gap-1.5 px-3 py-1.5 ml-1 rounded-full bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors"
            >
              <Icon.PiLightningFill size={12} />
              {link.name}
            </Link>
          );
        }

        return (
          <Link
            key={link.name}
            href={link.href}
            className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              isActive
                ? isDark
                  ? "text-white bg-white/10"
                  : "text-red-600 bg-red-50"
                : isDark
                  ? "text-white/75 hover:text-white hover:bg-white/10"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            {link.name}
            {isActive && (
              <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-red-500" />
            )}
          </Link>
        );
      })}
    </nav>
  );
};
