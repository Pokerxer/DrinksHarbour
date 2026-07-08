import React from 'react';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { STATS, VALUES, WHY_ITEMS, FAQ_SCHEMA, LAST_UPDATED } from './data';
import { FadeIn } from './components/FadeIn';
import { StorySection } from './components/StorySection';
import { VendorCTA } from './components/VendorCTA';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }} />
      <style dangerouslySetInnerHTML={{
        __html: `@keyframes heroGradient{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}`
      }} />

      <main>
        {/* ── Hero ────────────────────────────────────────────────────────────── */}
        <div
          className="relative bg-gradient-to-br from-gray-900 via-red-950 to-gray-900 text-white overflow-hidden"
          style={{ backgroundSize: '200% 200%', animation: 'heroGradient 12s ease infinite' }}
        >
          {/* dot-grid texture overlay */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none" aria-hidden="true">
            <defs>
              <pattern id="dotGrid-about-hero" width="32" height="32" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.5" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dotGrid-about-hero)" />
          </svg>

          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 right-0 w-[480px] h-[480px] bg-red-700 opacity-10 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />
            <div className="absolute bottom-0 left-0 w-[320px] h-[320px] bg-red-500 opacity-10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />
          </div>

          <div className="container mx-auto max-w-5xl px-4 py-20 relative text-center">
            <FadeIn delay={0}>
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 text-xs font-medium text-red-300 mb-6 border border-white/5">
                <span className="w-2 h-2 rounded-full bg-gradient-to-r from-green-400 via-white to-green-400" />
                Our Story
              </div>
            </FadeIn>
            <FadeIn delay={0.1}>
              <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4 leading-tight">
                Nigeria&apos;s Premier<br />
                <span className="text-red-400">Beverage Marketplace</span>
              </h1>
            </FadeIn>
            <FadeIn delay={0.2}>
              <p className="text-gray-300 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed mb-8">
                DrinksHarbour connects discerning Nigerians with authentic, premium beverages from
                verified vendors across the FCT and beyond — delivered fast and priced fairly.
              </p>
            </FadeIn>
            <FadeIn delay={0.3}>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/shop"
                  className="inline-flex items-center gap-2 bg-gradient-to-br from-red-600 to-red-800 text-white px-6 py-3 rounded-xl font-bold text-sm hover:from-red-700 hover:to-red-900 transition-all shadow-lg"
                >
                  <Icon.PiShoppingCart size={16} /> Browse Premium Drinks
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all"
                >
                  <Icon.PiEnvelope size={16} /> Contact Our Team
                </Link>
              </div>
            </FadeIn>
          </div>

          <div className="absolute bottom-0 left-0 right-0">
            <svg viewBox="0 0 1440 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-12">
              <path d="M0 48L1440 48L1440 12C1200 44 960 56 720 40C480 24 240 0 0 12L0 48Z" fill="rgb(249 250 251)" />
            </svg>
          </div>
        </div>

      {/* ── Stats bar ──────────────────────────────────────────────────────── */}
      <div className="container mx-auto max-w-5xl px-4 -mt-2 pb-10">
        <FadeIn delay={0.1}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {STATS.map(({ value, label, icon: Ic }) => (
              <div
                key={label}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center hover:shadow-md hover:border-red-100 transition-all"
              >
                <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Ic size={20} className="text-red-700" />
                </div>
                <p className="text-2xl font-black text-gray-900">{value}</p>
                <p className="text-xs text-gray-500 mt-0.5 font-medium">{label}</p>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>

      <div className="container mx-auto max-w-5xl px-4 pb-16 space-y-16">

        <StorySection />

        {/* ── Mission banner ────────────────────────────────────────────────── */}
        <FadeIn>
          <div className="relative bg-gradient-to-br from-red-700 to-red-900 rounded-3xl p-8 sm:p-12 text-white overflow-hidden text-center">
            <div className="absolute inset-0 pointer-events-none opacity-10">
              <div className="absolute top-0 right-0 w-72 h-72 bg-white rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full blur-3xl" />
            </div>
            <div className="relative">
              <Icon.PiTarget size={36} className="mx-auto mb-4 opacity-90" />
              <h2 className="text-xl sm:text-2xl font-black mb-3">Our Mission</h2>
              <p className="text-red-100 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
                To make premium, authentic beverages accessible to every Nigerian — by building a trusted
                marketplace that fairly rewards vendors, delights customers, and celebrates the culture
                of great drinks across Africa.
              </p>
            </div>
          </div>
        </FadeIn>

        {/* ── Core Values ──────────────────────────────────────────────────── */}
        <FadeIn>
          <div>
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 rounded-full px-3 py-1 text-xs font-semibold mb-3">
                <Icon.PiSparkleBold size={13} /> Core Values
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900">What we stand for</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              {VALUES.map(({ icon: Ic, title, body, color }, i) => (
                <FadeIn key={title} delay={i * 0.07}>
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md hover:border-red-100 transition-all h-full">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${color}`}>
                      <Ic size={22} />
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{body}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </FadeIn>

        {/* ── Why Choose Us ────────────────────────────────────────────────── */}
        <FadeIn>
          <div>
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 rounded-full px-3 py-1 text-xs font-semibold mb-3">
                <Icon.PiCheckCircleBold size={13} /> Why DrinksHarbour
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900">Built for Nigerian shoppers</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {WHY_ITEMS.map(({ icon: Ic, title, body }, i) => (
                <FadeIn key={title} delay={i * 0.06}>
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start gap-4 hover:shadow-md hover:border-red-100 transition-all h-full">
                    <div className="w-9 h-9 rounded-xl bg-red-50 text-red-700 flex items-center justify-center flex-shrink-0">
                      <Ic size={18} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm mb-1">{title}</h3>
                      <p className="text-xs text-gray-500 leading-relaxed">{body}</p>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </FadeIn>

        <VendorCTA />

        {/* ── Final CTA ────────────────────────────────────────────────────── */}
        <FadeIn>
          <div className="text-center bg-white rounded-3xl border border-gray-100 shadow-sm p-10">
            <div className="w-14 h-14 bg-red-50 text-red-700 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Icon.PiWineBold size={28} />
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-3">Ready to explore?</h2>
            <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">
              Browse hundreds of authentic beverages, compare prices across vendors, and get fast delivery across the FCT and beyond.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/shop"
                className="inline-flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white px-7 py-3.5 rounded-xl font-bold hover:from-red-800 hover:to-red-950 transition-all shadow-md"
              >
                <Icon.PiShoppingCart size={17} /> Explore Our Drinks Catalogue
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 border border-gray-200 text-gray-700 px-7 py-3.5 rounded-xl font-bold hover:border-red-200 hover:text-red-700 transition-all"
              >
                <Icon.PiEnvelope size={17} /> Send Us a Message
              </Link>
            </div>
          </div>
        </FadeIn>

      </div>

      </main>

      {/* ── Freshness signal ───────────────────────────────────────────────── */}
      <div className="border-t border-gray-100">
        <div className="container mx-auto max-w-5xl px-4 py-6 text-center">
          <time dateTime={LAST_UPDATED} className="text-xs text-gray-400">
            Last updated {new Date(LAST_UPDATED + 'T00:00:00').toLocaleDateString('en-US', {
              year: 'numeric', month: 'long', day: 'numeric'
            })}
          </time>
        </div>
      </div>
    </div>
  );
}
