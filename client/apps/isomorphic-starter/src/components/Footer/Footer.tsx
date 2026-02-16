"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { PiArrowRight, PiCaretDown } from "react-icons/pi";
import { FooterBanner } from "@/components/Banner";

const Footer = () => {
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

  const footerLinks = {
    shop: [
      { name: "Whiskey", href: "/shop?category=whiskey" },
      { name: "Wine", href: "/shop?category=wine" },
      { name: "Beer", href: "/shop?category=beer" },
      { name: "Vodka", href: "/shop?category=vodka" },
      { name: "Gin", href: "/shop?category=gin" },
      { name: "Rum", href: "/shop?category=rum" }
    ],
    support: [
      { name: "Contact Us", href: "/pages/contact" },
      { name: "FAQs", href: "/pages/faqs" },
      { name: "Shipping Info", href: "/shipping-info" },
      { name: "Returns", href: "/returns" },
      { name: "Track Order", href: "/order-tracking" }
    ],
    company: [
      { name: "About Us", href: "/pages/about" },
      { name: "Careers", href: "/careers" },
      { name: "Blog", href: "/blog" },
      { name: "Sustainability", href: "/sustainability" }
    ],
    legal: [
      { name: "Privacy Policy", href: "/privacy" },
      { name: "Terms of Service", href: "/terms" },
      { name: "Cookie Policy", href: "/cookies" },
      { name: "Responsible Drinking", href: "/responsible-drinking" },
      { name: "Age Policy", href: "/age-policy" }
    ]
  };

  const socialLinks = [
    { name: "Facebook", url: "https://facebook.com/drinksharbour", color: "#1877F2" },
    { name: "Instagram", url: "https://instagram.com/drinksharbour", color: "#E4405F" },
    { name: "Twitter", url: "https://twitter.com/drinksharbour", color: "#1DA1F2" },
    { name: "YouTube", url: "https://youtube.com/drinksharbour", color: "#FF0000" }
  ];

  return (
    <>
      {/* Footer Banner - Newsletter Section */}
      <FooterBanner placement="footer" layout="newsletter" />

      {/* Footer Banner - Features/Promo */}
      <FooterBanner placement="footer" layout="promo" />

      <div id="footer" className="footer">
        <div className="footer-main bg-[#1A1A2E]">
          <div className="container">
            <div className="content-footer py-[60px] flex justify-between flex-wrap gap-y-8">
              {/* Company Info */}
              <div className="company-infor basis-1/4 max-lg:basis-full pr-7">
                <Link href={"/"} className="logo">
                  <div className="heading4 text-white">DrinksHarbour</div>
                </Link>
                <div className="flex gap-3 mt-3">
                  <div className="flex flex-col">
                    <span className="text-button text-white/70">Mail:</span>
                    <span className="text-button text-white/70 mt-3">Phone:</span>
                    <span className="text-button text-white/70 mt-3">Address:</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-white">info@drinksharbour.com</span>
                    <span className="text-white mt-3">+234 123 456 7890</span>
                    <span className="text-white mt-3 pt-px">Lagos, Nigeria</span>
                  </div>
                </div>
              </div>

              {/* Footer Links */}
              <div className="right-content flex flex-wrap gap-y-8 basis-3/4 max-lg:basis-full">
                <div className="list-nav flex justify-between basis-2/3 max-md:basis-full gap-4">
                  {/* Quick Shop */}
                  <div className="item flex flex-col basis-1/3">
                    <div className="text-button-uppercase text-white/60 pb-3">Quick Shop</div>
                    {footerLinks.shop.map((link) => (
                      <Link key={link.name} className="caption1 has-line-before duration-300 w-fit text-white/70 hover:text-white" href={link.href}>
                        {link.name}
                      </Link>
                    ))}
                  </div>

                  {/* Support */}
                  <div className="item flex flex-col basis-1/3">
                    <div className="text-button-uppercase text-white/60 pb-3">Support</div>
                    {footerLinks.support.map((link) => (
                      <Link key={link.name} className="caption1 has-line-before duration-300 w-fit text-white/70 hover:text-white" href={link.href}>
                        {link.name}
                      </Link>
                    ))}
                  </div>

                  {/* Company */}
                  <div className="item flex flex-col basis-1/3">
                    <div className="text-button-uppercase text-white/60 pb-3">Company</div>
                    {footerLinks.company.map((link) => (
                      <Link key={link.name} className="caption1 has-line-before duration-300 w-fit text-white/70 hover:text-white" href={link.href}>
                        {link.name}
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Newsletter */}
                <div className="newsletter basis-1/3 pl-7 max-md:basis-full max-md:pl-0">
                  <div className="text-button-uppercase text-white/60">Newsletter</div>
                  <div className="caption1 mt-3 text-white/70">
                    Sign up for our newsletter and get 10% off your first purchase
                  </div>
                  <div className="input-block w-full h-[52px] mt-4">
                    <form onSubmit={handleSubscribe} className="w-full h-full relative">
                      <input
                        type="email"
                        placeholder="Enter your e-mail"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="caption1 w-full h-full pl-4 pr-14 rounded-xl border border-white/20 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:border-white/40"
                        required
                      />
                      <button type="submit" className="w-[44px] h-[44px] bg-white rounded-xl absolute top-1 right-1 flex items-center justify-center hover:bg-gray-100 transition-colors">
                        <PiArrowRight size={24} color="#1A1A2E" />
                      </button>
                    </form>
                  </div>
                  {subscribed && (
                    <div className="mt-3 p-2 rounded bg-green-500/20 border border-green-500/30">
                      <p className="text-green-400 text-sm">✓ Thank you for subscribing!</p>
                    </div>
                  )}
                  <div className="list-social flex items-center gap-6 mt-4">
                    {socialLinks.map((social) => (
                      <a key={social.name} href={social.url} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity" style={{ backgroundColor: `${social.color}20` }}>
                        <span className="text-white font-bold text-sm">{social.name[0]}</span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Bottom */}
            <div className="footer-bottom py-3 flex items-center justify-between gap-5 max-lg:justify-center max-lg:flex-col border-t border-white/10">
              <div className="left flex items-center gap-8">
                <div className="copyright caption1 text-white/60">
                  ©2024 DrinksHarbour. All Rights Reserved.
                </div>
                <div className="select-block flex items-center gap-5 max-md:hidden">
                  <div className="choose-language flex items-center gap-1.5">
                    <select name="language" id="chooseLanguageFooter" className="caption2 bg-transparent text-white/60">
                      <option value="English">English</option>
                      <option value="Yoruba">Yoruba</option>
                      <option value="Igbo">Igbo</option>
                    </select>
                    <PiCaretDown size={12} color="#FFFFFF" />
                  </div>
                  <div className="choose-currency flex items-center gap-1.5">
                    <select name="currency" id="chooseCurrencyFooter" className="caption2 bg-transparent text-white/60">
                      <option value="NGN">NGN (₦)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                    <PiCaretDown size={12} color="#FFFFFF" />
                  </div>
                </div>
              </div>
              <div className="right flex items-center gap-2">
                <div className="caption1 text-white/60">Payment:</div>
                <div className="flex gap-2">
                  {["Visa", "MC", "PayPal", "Verve", "Bank"].map((payment) => (
                    <div key={payment} className="w-9 h-6 rounded bg-white/10 flex items-center justify-center">
                      <span className="text-white/80 text-xs font-bold">{payment[0]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Age Verification Notice */}
            <div className="py-4 border-t border-white/10 mt-2">
              <div className="flex flex-col md:flex-row items-center justify-center gap-2 text-center">
                <span className="text-white/40 text-sm">🔞</span>
                <p className="text-white/40 text-sm">
                  You must be 18+ to purchase from DrinksHarbour. Please drink responsibly.
                </p>
                <Link href="/responsible-drinking" className="text-white/60 hover:text-white text-sm underline">Learn More</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Footer;
