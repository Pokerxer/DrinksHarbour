"use client";
import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { PiCaretDown, PiLightningFill } from "react-icons/pi";
interface NavLink { name: string; href: string; sale?: boolean }
interface HeaderNavProps {
  navLinks: NavLink[];
  variant: "default" | "transparent" | "dark";
  getTextColor: () => string;
  pathname?: string;
}
export const HeaderNav: React.FC<HeaderNavProps> = ({ navLinks, variant, pathname }) => {
  const disclosure = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);
  const isDark = variant === "dark";
  const primary = navLinks.filter(link => link.name === "Shop" || link.sale);
  const secondary = navLinks.filter(link => link.name !== "Shop" && !link.sale);
  const active = (link: NavLink) => pathname === link.href ||
    (!link.href.includes("?") && link.href !== "/" && pathname?.startsWith(link.href + "/"));
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!disclosure.current?.contains(event.target as Node) && disclosure.current) disclosure.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && disclosure.current?.open) {
        disclosure.current.open = false; summary.current?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, []);
  useEffect(() => { if (disclosure.current) disclosure.current.open = false; }, [pathname]);
  const plain = isDark ? "text-white/80 hover:bg-white/10" : "text-zinc-600 hover:bg-zinc-100";
  return <nav aria-label="Main navigation" className="hidden lg:flex shrink-0 items-center gap-1">
    {primary.map(link => <Link key={link.href} href={link.href} aria-current={active(link) ? "page" : undefined}
      className={`flex items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold whitespace-nowrap ${link.sale ? "bg-[#b20202] text-white hover:bg-red-800" : active(link) ? "bg-red-50 text-[#b20202]" : plain}`}>
      {link.sale && <PiLightningFill size={12} aria-hidden />}{link.name}
    </Link>)}
    {secondary.length > 0 && <details ref={disclosure} className="group relative">
      <summary ref={summary} className={`flex list-none cursor-pointer items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b20202] ${secondary.some(active) ? "bg-red-50 text-[#b20202]" : plain}`}>
        Browse <PiCaretDown size={14} aria-hidden className="transition-transform group-open:rotate-180" />
      </summary>
      <div className="absolute left-0 top-full z-50 mt-2 min-w-48 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg">
        {secondary.map(link => <Link key={link.href} href={link.href} aria-current={active(link) ? "page" : undefined}
          onClick={() => { if (disclosure.current) disclosure.current.open = false; }}
          className={`block rounded-lg px-3 py-2.5 text-sm focus-visible:ring-2 focus-visible:ring-[#b20202] ${active(link) ? "bg-red-50 font-semibold text-[#b20202]" : "text-zinc-700 hover:bg-zinc-50"}`}>
          {link.name}
        </Link>)}
      </div>
    </details>}
  </nav>;
};
