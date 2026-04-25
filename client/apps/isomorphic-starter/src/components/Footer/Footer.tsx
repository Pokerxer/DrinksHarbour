"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useTenant } from "@/context/TenantContext";
import * as Icon from "react-icons/pi";

export const Footer: React.FC = () => {
  const { tenant, isMainSite } = useTenant();
  const displayName = isMainSite ? "DrinksHarbour" : tenant?.name || "DrinksHarbour";

  const links = isMainSite
    ? [
        { name: "Shop", href: "/shop" },
        { name: "New Arrivals", href: "/shop?tag=new-arrival" },
        { name: "Sale", href: "/shop?sale=true" },
        { name: "About", href: "/pages/about" },
        { name: "Contact", href: "/pages/contact" },
        { name: "FAQs", href: "/pages/faqs" },
      ]
    : [
        { name: "Shop", href: "/shop" },
        { name: "About", href: "/pages/about" },
        { name: "Contact", href: "/pages/contact" },
        { name: "FAQs", href: "/pages/faqs" },
      ];

  const socials = [
    { icon: <Icon.PiFacebookLogo size={18} />, href: "https://facebook.com/drinksharbour", label: "Facebook" },
    { icon: <Icon.PiInstagramLogo size={18} />, href: "https://instagram.com/drinksharbour", label: "Instagram" },
    { icon: <Icon.PiTwitterLogo size={18} />, href: "https://twitter.com/drinksharbour", label: "Twitter" },
  ];

  return (
    <footer className="bg-[#1A1A2E]">
      {/* Top accent */}
      <div className="h-0.5 bg-gradient-to-r from-red-600 via-orange-400 to-red-600" />

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">

          {/* Logo + tagline */}
          <div className="flex-shrink-0">
            <Link href="/">
              {isMainSite ? (
                <Image
                  src="/images/logo.svg"
                  alt="DrinksHarbour"
                  width={200}
                  height={29}
                  className="h-10 w-auto object-contain"
                />
              ) : (
                <span className="text-white font-bold text-lg">{displayName}</span>
              )}
            </Link>
            <p className="text-white/40 text-xs mt-1.5">One Harbour. Endless Possibilities.</p>
          </div>

          {/* Nav links */}
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {links.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="text-sm text-white/60 hover:text-white transition-colors"
              >
                {link.name}
              </Link>
            ))}
          </nav>

          {/* Socials */}
          <div className="flex items-center gap-2">
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all"
              >
                {s.icon}
              </a>
            ))}
          </div>
        </div>

        {/* Bottom row */}
        <div className="mt-6 pt-5 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/35">
            © {new Date().getFullYear()} {displayName}. All rights reserved. &nbsp;·&nbsp; 🔞 18+ only. Drink responsibly.
          </p>
          <div className="flex items-center gap-4">
            {["Privacy Policy", "Terms of Service"].map((item) => (
              <Link
                key={item}
                href={`/${item.toLowerCase().replace(/ /g, "-")}`}
                className="text-xs text-white/35 hover:text-white/70 transition-colors"
              >
                {item}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
