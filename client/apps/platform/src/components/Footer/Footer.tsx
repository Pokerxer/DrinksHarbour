"use client";

import React, { useState, FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTenant } from "@/context/TenantContext";
import * as Icon from "react-icons/pi";

// ─── Data ─────────────────────────────────────────────────────────────────────

const SHOP_LINKS = [
  { label: "All Products",   href: "/shop" },
  { label: "New Arrivals",   href: "/shop?tag=new-arrival" },
  { label: "On Sale",        href: "/shop?sale=true" },
  { label: "Wines",          href: "/shop?category=wine" },
  { label: "Spirits",        href: "/shop?category=spirits" },
  { label: "Beers & Ciders", href: "/shop?category=beers" },
  { label: "Non-Alcoholic",  href: "/shop?category=non-alcoholic" },
  { label: "All Brands",     href: "/brands" },
];

const HELP_LINKS = [
  { label: "Contact Us",      href: "/contact" },
  { label: "FAQs",            href: "/faqs" },
  { label: "Order Tracking",  href: "/order-tracking" },
  { label: "Shipping Info",   href: "/shipping-info" },
  { label: "Returns & Refunds", href: "/returns" },
  { label: "My Account",      href: "/my-account" },
];

const COMPANY_LINKS = [
  { label: "About Us",       href: "/about" },
  { label: "Vendors",        href: "/vendors" },
  { label: "Blog",           href: "/blog" },
  { label: "Careers",        href: "/careers" },
  { label: "Sustainability", href: "/sustainability" },
];

const LEGAL_LINKS = [
  { label: "Privacy Policy",  href: "/privacy-policy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Cookie Policy",   href: "/cookie-policy" },
];

const SOCIALS = [
  { icon: Icon.PiFacebookLogo,   href: "https://facebook.com/drinksharbour",  label: "Facebook" },
  { icon: Icon.PiInstagramLogo,  href: "https://instagram.com/drinksharbour", label: "Instagram" },
  { icon: Icon.PiTwitterLogo,    href: "https://twitter.com/drinksharbour",   label: "Twitter / X" },
  { icon: Icon.PiYoutubeLogo,    href: "https://youtube.com/drinksharbour",   label: "YouTube" },
  { icon: Icon.PiTiktokLogo,     href: "https://tiktok.com/@drinksharbour",   label: "TikTok" },
];

// ─── Newsletter ───────────────────────────────────────────────────────────────

function Newsletter() {
  const [email, setEmail]           = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading]       = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 600)); // replace with real API call
    setSubscribed(true);
    setLoading(false);
    setEmail("");
  };

  return (
    <div>
      <p className="text-xs font-black uppercase tracking-widest text-white/40 mb-3">Newsletter</p>
      <p className="text-sm font-semibold text-white mb-1">Get 10% off your first order</p>
      <p className="text-xs text-white/50 mb-4 leading-relaxed">
        Weekly deals, new arrivals, and exclusive offers — straight to your inbox.
      </p>

      {subscribed ? (
        <div className="flex items-center gap-2 bg-green-500/15 border border-green-500/25 rounded-xl px-4 py-3">
          <Icon.PiCheckCircleFill size={16} className="text-green-400 flex-shrink-0" />
          <p className="text-green-300 text-sm font-medium">You're subscribed!</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="relative">
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full h-12 pl-4 pr-14 rounded-xl bg-white/8 border border-white/15 text-white text-sm placeholder-white/35 focus:outline-none focus:border-red-500/60 focus:bg-white/10 transition-all"
          />
          <button
            type="submit"
            disabled={loading}
            className="absolute right-1.5 top-1.5 w-9 h-9 bg-gradient-to-br from-red-600 to-red-800 rounded-lg flex items-center justify-center hover:from-red-700 hover:to-red-900 transition-all disabled:opacity-60"
          >
            {loading
              ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Icon.PiArrowRight size={16} className="text-white" />
            }
          </button>
        </form>
      )}
    </div>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

export const Footer: React.FC = () => {
  const { tenant, isMainSite } = useTenant();
  const displayName = isMainSite ? "DrinksHarbour" : tenant?.name || "DrinksHarbour";

  // Vendor stores get a stripped-down footer
  if (!isMainSite) {
    return (
      <footer className="bg-[#1A1A2E]">
        <div className="h-0.5 bg-gradient-to-r from-red-700 via-red-500 to-red-700" />
        <div className="container mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-white font-bold text-lg">{displayName}</span>
          <p className="text-xs text-white/35 text-center">
            © {new Date().getFullYear()} {displayName} · Powered by{" "}
            <Link href="/" className="text-red-400 hover:text-red-300 transition-colors">DrinksHarbour</Link>
            {" "}· 18+ only. Drink responsibly.
          </p>
          <div className="flex gap-3">
            {LEGAL_LINKS.map(l => (
              <Link key={l.href} href={l.href} className="text-xs text-white/35 hover:text-white/60 transition-colors">{l.label}</Link>
            ))}
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="bg-[#1A1A2E]">
      {/* Top accent line */}
      <div className="h-0.5 bg-gradient-to-r from-red-700 via-red-500 to-red-700" />

      {/* ── Main grid ─────────────────────────────────────────────────────── */}
      <div className="container mx-auto px-4 pt-14 pb-10">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-10 lg:gap-8">

          {/* Col 1 — Brand */}
          <div className="col-span-2 md:col-span-3 lg:col-span-1">
            <Link href="/" className="inline-block mb-3">
              <Image
                src="/images/logo.svg"
                alt="DrinksHarbour"
                width={180}
                height={28}
                className="h-9 w-auto object-contain"
              />
            </Link>
            <p className="text-white/45 text-xs leading-relaxed mb-5">
              Nigeria's premier online beverage marketplace. Authentic spirits, wines, beers and
              more — delivered fast, nationwide.
            </p>

            {/* Socials */}
            <div className="flex items-center gap-2">
              {SOCIALS.map(({ icon: Ic, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="w-8 h-8 rounded-xl bg-white/8 hover:bg-red-700/60 border border-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all"
                >
                  <Ic size={16} />
                </a>
              ))}
            </div>
          </div>

          {/* Col 2 — Shop */}
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-white/40 mb-4">Shop</p>
            <ul className="space-y-2.5">
              {SHOP_LINKS.map(({ label, href }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm text-white/55 hover:text-white transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3 — Help */}
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-white/40 mb-4">Help</p>
            <ul className="space-y-2.5">
              {HELP_LINKS.map(({ label, href }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm text-white/55 hover:text-white transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4 — Company */}
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-white/40 mb-4">Company</p>
            <ul className="space-y-2.5">
              {COMPANY_LINKS.map(({ label, href }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm text-white/55 hover:text-white transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>

            {/* Contact quick-links */}
            <div className="mt-6 space-y-2">
              <a
                href="mailto:support@drinksharbour.com"
                className="flex items-center gap-2 text-xs text-white/40 hover:text-white/70 transition-colors"
              >
                <Icon.PiEnvelope size={13} className="text-red-500 flex-shrink-0" />
                support@drinksharbour.com
              </a>
              <a
                href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_PHONE || "2348000000000"}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-white/40 hover:text-white/70 transition-colors"
              >
                <Icon.PiWhatsappLogo size={13} className="text-green-400 flex-shrink-0" />
                WhatsApp Support
              </a>
            </div>
          </div>

          {/* Col 5 — Newsletter */}
          <div className="col-span-2 md:col-span-1 lg:col-span-1">
            <Newsletter />
          </div>

        </div>
      </div>

      {/* ── Payment methods ──────────────────────────────────────────────── */}
      <div className="border-t border-white/8">
        <div className="container mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
            <span className="text-xs text-white/30 mr-1">We accept:</span>
            {[
              { label: "Visa",       bg: "#1a1f71", text: "VISA",       textColor: "#fff",  bold: true },
              { label: "Mastercard", bg: "#eb001b", text: "MC",         textColor: "#fff",  bold: true },
              { label: "Verve",      bg: "#016f39", text: "VERVE",      textColor: "#fff",  bold: true },
              { label: "Korapay",   bg: "#00c3f7", text: "Korapay",   textColor: "#fff",  bold: false },
              { label: "Bank",       bg: "#374151", text: "Bank",       textColor: "#d1d5db", bold: false },
              { label: "USSD",       bg: "#374151", text: "USSD",       textColor: "#d1d5db", bold: false },
            ].map(({ label, bg, text, textColor, bold }) => (
              <span
                key={label}
                className="h-7 px-2.5 rounded-md flex items-center justify-center text-[10px] tracking-wide"
                style={{ backgroundColor: bg, color: textColor, fontWeight: bold ? 700 : 400 }}
              >
                {text}
              </span>
            ))}
          </div>

          {/* Age & responsible drinking */}
          <div className="flex items-center gap-2 text-xs text-white/30">
            <span className="w-7 h-7 rounded-full border border-red-700/60 text-red-500 flex items-center justify-center font-black text-[10px] flex-shrink-0">
              18+
            </span>
            <span>Drink responsibly. Not for sale to persons under 18.</span>
          </div>
        </div>
      </div>

      {/* ── Bottom bar ───────────────────────────────────────────────────── */}
      <div className="border-t border-white/8">
        <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/30 text-center sm:text-left">
            © {new Date().getFullYear()} DrinksHarbour Technologies Ltd. All rights reserved.
          </p>
          <div className="flex items-center gap-4 flex-wrap justify-center">
            {LEGAL_LINKS.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="text-xs text-white/30 hover:text-white/60 transition-colors"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
