"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { FooterBanner } from "@/components/Banner";
import { FooterNewsletter } from "./FooterNewsletter";
import { useTenant } from "@/context/TenantContext";

const FooterLinks = ({
  title,
  links,
}: {
  title: string;
  links: { name: string; href: string }[];
}) => (
  <div className="w-full md:w-auto md:basis-1/4">
    <div className="text-xs md:text-sm font-semibold uppercase text-white/60 pb-2 md:pb-3">
      {title}
    </div>
    <ul className="flex flex-col gap-1 md:gap-2 mt-2 md:mt-3">
      {links.map((link) => (
        <li key={link.name}>
          <Link
            href={link.href}
            className="text-xs md:text-sm text-white/70 hover:text-white transition-colors"
          >
            {link.name}
          </Link>
        </li>
      ))}
    </ul>
  </div>
);

const FooterBottom = ({
  displayName,
  isMainSite,
}: {
  displayName: string;
  isMainSite: boolean;
}) => (
  <div className="footer-bottom border-t border-white/10 py-4 md:py-6 flex flex-col md:flex-row items-center justify-between gap-3">
    <p className="text-xs md:text-sm text-white/50">
      © {new Date().getFullYear()} {displayName}. All rights reserved.
    </p>
    <div className="flex items-center gap-4">
      {["Privacy Policy", "Terms of Service", "Cookie Policy"].map((item) => (
        <Link
          key={item}
          href={`/${item.toLowerCase().replace(/ /g, "-")}`}
          className="text-xs text-white/50 hover:text-white/80 transition-colors"
        >
          {item}
        </Link>
      ))}
    </div>
  </div>
);

const FooterAgeNotice = () => (
  <div className="py-3 md:py-4 border-t border-white/10 text-center">
    <p className="text-xs text-white/40">
      🔞 This site contains alcohol-related content. You must be 18+ to purchase.
      Please drink responsibly.
    </p>
  </div>
);

export const Footer: React.FC = () => {
  const { tenant, isMainSite } = useTenant();
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setTimeout(() => {
        setSubscribed(false);
        setEmail("");
      }, 3000);
    }
  };

  const displayName = isMainSite ? "DrinksHarbour" : tenant?.name || "DrinksHarbour";

  const shopLinks = isMainSite
    ? [
        { name: "Whiskey", href: "/shop?category=whiskey" },
        { name: "Wine", href: "/shop?category=wine" },
        { name: "Beer", href: "/shop?category=beer" },
        { name: "Vodka", href: "/shop?category=vodka" },
        { name: "Gin", href: "/shop?category=gin" },
        { name: "Rum", href: "/shop?category=rum" },
      ]
    : [
        { name: "Red Wines", href: "/menu?type=red-wine" },
        { name: "White Wines", href: "/menu?type=white-wine" },
        { name: "Spirits", href: "/menu?type=spirit" },
        { name: "Beer", href: "/menu?type=beer" },
        { name: "Non-Alcoholic", href: "/menu?type=non-alcoholic" },
      ];

  const supportLinks = [
    { name: "Contact Us", href: "/pages/contact" },
    { name: "FAQs", href: "/pages/faqs" },
    { name: "Shipping Info", href: "/shipping-info" },
    { name: "Returns", href: "/returns" },
    { name: "Track Order", href: "/order-tracking" },
  ];

  const companyLinks = [
    { name: "About Us", href: "/pages/about" },
    { name: "Careers", href: "/careers" },
    { name: "Blog", href: "/blog" },
    {
      name: isMainSite ? "Become a Tenant" : "Our Story",
      href: isMainSite ? "/tenant-signup" : "/about",
    },
  ];

  return (
    <>
      <FooterBanner placement="footer" layout="newsletter" />
      <FooterBanner placement="footer" layout="promo" />

      <div id="footer" className="footer">
        <div className="footer-main bg-[#1A1A2E]">
          <div className="container px-4">
            <div className="content-footer py-8 md:py-12 lg:py-[60px] flex flex-col md:flex-row justify-between gap-6 md:gap-8">
              <div className="company-infor w-full md:w-auto md:basis-1/4 pr-0 md:pr-7">
                <Link href="/" className="logo inline-block">
                  {isMainSite ? (
                    <Image
                      src="/images/logo.png"
                      alt="DrinksHarbour"
                      width={160}
                      height={48}
                      className="h-10 w-auto object-contain brightness-0 invert"
                    />
                  ) : (
                    <div className="heading4 text-white">{displayName}</div>
                  )}
                </Link>
                <div className="flex gap-3 mt-3 md:mt-4">
                  <div className="flex flex-col">
                    <span className="text-xs md:text-sm text-white/70">Mail:</span>
                    <span className="text-xs md:text-sm text-white/70 mt-2 md:mt-3">Phone:</span>
                    <span className="text-xs md:text-sm text-white/70 mt-2 md:mt-3">Address:</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs md:text-sm text-white">info@drinksharbour.com</span>
                    <span className="text-xs md:text-sm text-white mt-2 md:mt-3">+234 123 456 7890</span>
                    <span className="text-xs md:text-sm text-white mt-2 md:mt-3">Lagos, Nigeria</span>
                  </div>
                </div>
              </div>

              <div className="right-content flex flex-col md:flex-row flex-wrap gap-6 md:gap-8 w-full md:basis-3/4">
                <FooterLinks title="Quick Shop" links={shopLinks} />
                <FooterLinks title="Support" links={supportLinks} />
                <FooterLinks title="Company" links={companyLinks} />

                <FooterNewsletter
                  email={email}
                  setEmail={setEmail}
                  subscribed={subscribed}
                  handleSubscribe={handleSubscribe}
                />
              </div>
            </div>

            <FooterBottom displayName={displayName} isMainSite={isMainSite} />
            <FooterAgeNotice />
          </div>
        </div>
      </div>
    </>
  );
};

export default Footer;
