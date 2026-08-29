'use client';

import React from 'react';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { RevealOnScroll } from '@/app/vendors/register/components/RevealOnScroll';

interface ErmHeroProps {
  vendorCount: number;
  productCount: number;
}

export function ErmHero({ vendorCount, productCount }: ErmHeroProps) {
  const stats = [
    {
      value: productCount >= 1000 ? `${(productCount / 1000).toFixed(1)}K` : `${productCount}+`,
      label: 'Products on the platform',
      Icon: Icon.PiPackageBold,
    },
    {
      value: vendorCount >= 1 ? `${vendorCount}` : '—',
      label: 'Active vendors',
      Icon: Icon.PiStorefrontBold,
    },
    { value: '10', label: 'Integrated ERM modules', Icon: Icon.PiGridFourBold },
    { value: '99.9%', label: 'Platform uptime', Icon: Icon.PiShieldCheckBold },
  ];

  return (
    <div className="relative bg-gradient-to-br from-gray-900 via-red-950 to-gray-900 text-white overflow-hidden">
      {/* Animated gradient background */}
      <style dangerouslySetInnerHTML={{
        __html: `@keyframes ermHeroShift{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}`
      }} />
      <div
        className="absolute inset-0 bg-gradient-to-br from-gray-900 via-red-950 to-gray-900"
        style={{ backgroundSize: '200% 200%', animation: 'ermHeroShift 14s ease infinite' }}
      />

      {/* Dot-grid texture */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none" aria-hidden="true">
        <defs>
          <pattern id="dotGrid-erm-hero" width="32" height="32" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.5" fill="white" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dotGrid-erm-hero)" />
      </svg>

      {/* Decorative blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[480px] h-[480px] bg-red-700 opacity-10 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-[320px] h-[320px] bg-red-500 opacity-10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />
      </div>

      <div className="container mx-auto max-w-5xl px-4 py-24 relative">
        <RevealOnScroll className="text-center">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-full px-4 py-1.5 text-xs font-medium text-red-300 mb-6 border border-white/10">
            <Icon.PiGearBold size={14} />
            Enterprise Resource Management
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight mb-5 leading-[1.1]">
            The operating system for your{' '}
            <span className="bg-gradient-to-r from-red-400 to-red-600 bg-clip-text text-transparent">
              beverage business
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-gray-300 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed mb-8">
            Stop juggling spreadsheets, paper receipts, and phone calls. One dashboard
            for inventory, POS, invoicing, CRM, and analytics — built for how Nigerian
            beverage businesses actually work.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
            <Link
              href="/vendors/register/apply"
              className="inline-flex items-center gap-2 bg-gradient-to-br from-red-600 to-red-800 text-white px-7 py-3.5 rounded-xl font-bold text-sm hover:from-red-700 hover:to-red-900 hover:scale-105 active:scale-95 transition-all shadow-lg"
            >
              <Icon.PiPaperPlaneTilt size={16} />
              Start Free Trial
            </Link>
            <Link
              href="/vendors/register"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white px-7 py-3.5 rounded-xl font-bold text-sm transition-all"
            >
              <Icon.PiTag size={16} />
              See Pricing
            </Link>
          </div>

          {/* Trust line */}
          <p className="text-xs text-gray-400 mb-10">
            No credit card required &middot; Free plan available &middot; Cancel anytime
          </p>

          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto">
            {stats.map(({ value, label, Icon: Ic }, i) => (
              <div
                key={label}
                className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-4 hover:bg-white/10 transition-colors"
              >
                <Ic size={18} className="text-red-400 mx-auto mb-2" />
                <p className="text-xl font-black text-white">{value}</p>
                <p className="text-[10px] text-gray-400 font-medium mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </RevealOnScroll>
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
