"use client";

import React from "react";
import Link from "next/link";

interface NavLink {
  name: string;
  href: string;
}

interface HeaderNavProps {
  navLinks: NavLink[];
  variant: "default" | "transparent" | "dark";
  getTextColor: () => string;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  navLinks,
  variant,
  getTextColor,
}) => {
  return (
    <nav className="hidden lg:flex items-center gap-1">
      {navLinks.map((link) => (
        <Link
          key={link.name}
          href={link.href}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all hover:bg-gray-100 ${getTextColor()}`}
        >
          {link.name}
        </Link>
      ))}
    </nav>
  );
};