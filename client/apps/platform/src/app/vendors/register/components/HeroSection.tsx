import React from 'react';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { VENDOR_STATS } from '../data';

export function HeroSection() {
  return (
    <div className="relative bg-gradient-to-br from-gray-900 via-red-950 to-gray-900 text-white overflow-hidden">
      <style dangerouslySetInnerHTML={{
        __html: `@keyframes vendorHeroShift{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}`
      }} />

      {/* Animated gradient background */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-gray-900 via-red-950 to-gray-900"
        style={{ backgroundSize: '200% 200%', animation: 'vendorHeroShift 14s ease infinite' }}
      />

      {/* Dot-grid texture */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none" aria-hidden="true">
        <defs>
          <pattern id="dotGrid-vendor-hero" width="32" height="32" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.5" fill="white" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dotGrid-vendor-hero)" />
      </svg>

      {/* Decorative blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[480px] h-[480px] bg-red-700 opacity-10 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-[320px] h-[320px] bg-red-500 opacity-10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />
      </div>

      <div className="container mx-auto max-w-5xl px-4 py-24 relative">
        <div className="text-center">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-full px-4 py-1.5 text-xs font-medium text-red-300 mb-6 border border-white/10">
            <span className="w-2 h-2 rounded-full bg-gradient-to-r from-green-400 via-white to-green-400" />
            For Beverage Businesses
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight mb-5 leading-[1.1]">
            Sell on <span className="bg-gradient-to-r from-red-400 to-red-600 bg-clip-text text-transparent">DrinksHarbour</span>
          </h1>

          {/* Subheadline */}
          <p className="text-gray-300 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed mb-8">
            Get a branded storefront, reach a growing community of buyers, and manage your entire
            beverage business with our ERM tools — all in one place.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-12">
            <a
              href="/vendors/register/apply"
              className="inline-flex items-center gap-2 bg-gradient-to-br from-red-600 to-red-800 text-white px-7 py-3.5 rounded-xl font-bold text-sm hover:from-red-700 hover:to-red-900 hover:scale-105 active:scale-95 transition-all shadow-lg"
            >
              <Icon.PiPaperPlaneTilt size={16} /> Apply Now — Free
            </a>
            <Link
              href="/contact?subject=vendor"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white px-7 py-3.5 rounded-xl font-bold text-sm transition-all"
            >
              <Icon.PiChatCircle size={16} /> Talk to Us
            </Link>
          </div>

          {/* Floating stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto">
            {VENDOR_STATS.map(({ value, label, icon: Ic }, i) => (
              <div
                key={label}
                className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-4 hover:bg-white/10 transition-colors"
                style={{
                  animation: `fadeInUp 0.5s ease-out ${0.2 + i * 0.1}s forwards`,
                  opacity: 0,
                }}
              >
                <Ic size={18} className="text-red-400 mx-auto mb-2" />
                <p className="text-xl font-black text-white">{value}</p>
                <p className="text-[10px] text-gray-400 font-medium mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Wave divider */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-12">
          <path d="M0 48L1440 48L1440 12C1200 44 960 56 720 40C480 24 240 0 0 12L0 48Z" fill="rgb(249 250 251)" />
        </svg>
      </div>
    </div>
  );
}