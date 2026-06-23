"use client";

import React, { useState, FormEvent } from "react";
import Link from "next/link";
import { PiArrowRight } from "react-icons/pi";

interface FooterNewsletterProps {
  email: string;
  setEmail: (email: string) => void;
  subscribed: boolean;
  handleSubscribe: (e: FormEvent) => void;
}

export const FooterNewsletter: React.FC<FooterNewsletterProps> = ({
  email,
  setEmail,
  subscribed,
  handleSubscribe,
}) => {
  const socialLinks = [
    { name: "Facebook", url: "https://facebook.com/drinksharbour", color: "#1877F2" },
    {
      name: "Instagram",
      url: "https://instagram.com/drinksharbour",
      color: "#E4405F",
    },
    { name: "Twitter", url: "https://twitter.com/drinksharbour", color: "#1DA1F2" },
    { name: "YouTube", url: "https://youtube.com/drinksharbour", color: "#FF0000" },
  ];

  return (
    <div className="w-full md:w-auto md:basis-full lg:basis-1/3 pl-0 md:pl-3 lg:pl-0 mt-2 md:mt-0">
      <div className="text-xs md:text-sm font-semibold uppercase text-white/60 pb-2 md:pb-3">
        Newsletter
      </div>
      <div className="text-xs md:text-sm mt-2 md:mt-3 text-white/70">
        Sign up for our newsletter and get 10% off your first purchase
      </div>
      <div className="input-block w-full h-12 md:h-[52px] mt-3 md:mt-4">
        <form onSubmit={handleSubscribe} className="w-full h-full relative">
          <input
            type="email"
            placeholder="Enter your e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="text-xs md:text-sm w-full h-full pl-3 md:pl-4 pr-12 md:pr-14 rounded-xl border border-white/20 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:border-white/40"
            required
          />
          <button
            type="submit"
            className="w-10 h-10 md:w-[44px] md:h-[44px] bg-white rounded-xl absolute top-1 right-1 flex items-center justify-center hover:bg-gray-100 transition-colors"
          >
            <PiArrowRight size={20} className="md:w-6 md:h-6" color="#1A1A2E" />
          </button>
        </form>
      </div>
      {subscribed && (
        <div className="mt-3 p-2 rounded bg-green-500/20 border border-green-500/30">
          <p className="text-green-400 text-xs md:text-sm">
            ✓ Thank you for subscribing!
          </p>
        </div>
      )}
      <div className="flex items-center gap-4 md:gap-6 mt-4">
        {socialLinks.map((social) => (
          <a
            key={social.name}
            href={social.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
            style={{ backgroundColor: `${social.color}20` }}
          >
            <span className="text-white font-bold text-xs">{social.name[0]}</span>
          </a>
        ))}
      </div>
    </div>
  );
};