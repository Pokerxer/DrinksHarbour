'use client';

import React from 'react';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { motion } from 'framer-motion';

// ─── Static data ──────────────────────────────────────────────────────────────

const STATS = [
  { value: '5,000+', label: 'Products', icon: Icon.PiWineBold },
  { value: '200+',   label: 'Brands',   icon: Icon.PiStorefront },
  { value: '50K+',   label: 'Customers', icon: Icon.PiUsers },
  { value: '36',     label: 'States Covered', icon: Icon.PiMapPin },
];

const VALUES = [
  {
    icon: Icon.PiSealCheckBold,
    title: 'Authenticity First',
    body: 'Every product on DrinksHarbour is sourced from verified distributors and brand-authorised vendors. We guarantee genuine products — no counterfeits, ever.',
    color: 'bg-red-50 text-red-700',
  },
  {
    icon: Icon.PiTruckBold,
    title: 'Fast, Reliable Delivery',
    body: 'Same-day delivery in Abuja and Lagos, next-day to major cities. We partner with trusted logistics providers to get your order to you safely and on time.',
    color: 'bg-blue-50 text-blue-700',
  },
  {
    icon: Icon.PiHandshakeBold,
    title: 'Vendor Partnership',
    body: 'We empower local wine merchants, importers, and distributors by giving them a digital storefront and access to thousands of customers across Nigeria.',
    color: 'bg-amber-50 text-amber-700',
  },
  {
    icon: Icon.PiShieldCheckBold,
    title: 'Secure & Transparent',
    body: 'All transactions are protected with bank-grade encryption. Prices are clear, fees are disclosed upfront, and your data is never sold.',
    color: 'bg-emerald-50 text-emerald-700',
  },
];

const MILESTONES = [
  { year: '2022', title: 'Founded', body: 'DrinksHarbour launched in Abuja with a small catalogue of premium spirits, serving the FCT.' },
  { year: '2023', title: 'Vendor Platform', body: 'Opened the marketplace to third-party vendors, bringing over 80 sellers onto the platform within six months.' },
  { year: '2024', title: 'National Expansion', body: 'Delivery expanded to all 36 states and the FCT. Crossed 30,000 active customers.' },
  { year: '2025', title: 'AI & Innovation', body: 'Launched AI-powered product discovery, an intelligent chatbot, and real-time inventory sync across all vendor stores.' },
];

const WHY_ITEMS = [
  { icon: Icon.PiCurrencyNgn,  title: 'Naira Pricing',      body: 'All prices in ₦ — no hidden FX charges or surprises at checkout.' },
  { icon: Icon.PiHeadset,      title: '24 / 7 Support',     body: 'AI chatbot + human agents available via WhatsApp, email, and live chat.' },
  { icon: Icon.PiStar,         title: 'Curated Selection',  body: 'Hand-picked catalogue covering wines, whiskies, gins, beers, and mocktails.' },
  { icon: Icon.PiPercent,      title: 'Best Prices',        body: 'We monitor the market so our prices stay competitive — and flash sales run weekly.' },
  { icon: Icon.PiLock,         title: 'Safe Payments',      body: 'Paystack and Stripe integrations with 3-D Secure and instant payment confirmation.' },
];

// ─── Animation helpers ────────────────────────────────────────────────────────

function FadeIn({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <div className="relative bg-gradient-to-br from-gray-900 via-red-950 to-gray-900 text-white overflow-hidden">
        {/* decorative blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[480px] h-[480px] bg-red-700 opacity-10 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-[320px] h-[320px] bg-red-500 opacity-10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />
        </div>

        <div className="container mx-auto max-w-5xl px-4 py-20 relative text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 text-xs font-medium text-red-300 mb-6">
              <Icon.PiInfo size={13} />
              Our Story
            </div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4 leading-tight">
              Nigeria's Premier<br />
              <span className="text-red-400">Beverage Marketplace</span>
            </h1>
            <p className="text-gray-300 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed mb-8">
              DrinksHarbour connects discerning Nigerians with authentic, premium beverages from
              verified vendors across the country — delivered fast and priced fairly.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/shop"
                className="inline-flex items-center gap-2 bg-gradient-to-br from-red-600 to-red-800 text-white px-6 py-3 rounded-xl font-bold text-sm hover:from-red-700 hover:to-red-900 transition-all shadow-lg"
              >
                <Icon.PiShoppingCart size={16} /> Shop Now
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all"
              >
                <Icon.PiEnvelope size={16} /> Get in Touch
              </Link>
            </div>
          </motion.div>
        </div>

        {/* wave divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-12">
            <path d="M0 48L1440 48L1440 12C1200 44 960 56 720 40C480 24 240 0 0 12L0 48Z" fill="rgb(249 250 251)" />
          </svg>
        </div>
      </div>

      {/* ── Stats bar ───────────────────────────────────────────────────────── */}
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

        {/* ── Our Story ───────────────────────────────────────────────────────── */}
        <FadeIn>
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 rounded-full px-3 py-1 text-xs font-semibold mb-4">
                <Icon.PiBookOpenText size={13} /> Our Story
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-4 leading-tight">
                Born from a simple belief: <span className="text-red-700">everyone deserves great drinks.</span>
              </h2>
              <div className="space-y-4 text-gray-600 text-sm leading-relaxed">
                <p>
                  DrinksHarbour was founded in 2022 in Abuja with a straightforward goal — to make it easy
                  for Nigerians to discover, compare, and buy premium beverages online without the guesswork
                  of authenticity or the frustration of limited selection.
                </p>
                <p>
                  What started as a small curated store quickly evolved into a multi-vendor marketplace,
                  giving local wine merchants, importers, and craft producers their own digital storefronts
                  and direct access to customers nationwide.
                </p>
                <p>
                  Today, we serve over 50,000 customers across Nigeria, partnering with more than 200 brands
                  and hundreds of verified vendors to offer the country's widest selection of authentic spirits,
                  wines, beers, and non-alcoholic drinks.
                </p>
              </div>
            </div>

            {/* Timeline */}
            <div className="relative pl-6">
              <div className="absolute left-0 top-2 bottom-2 w-px bg-gradient-to-b from-red-200 via-red-400 to-red-200" />
              <div className="space-y-6">
                {MILESTONES.map(({ year, title, body }, i) => (
                  <FadeIn key={year} delay={i * 0.08}>
                    <div className="relative">
                      <div className="absolute -left-[25px] top-1 w-3 h-3 rounded-full bg-red-600 border-2 border-white shadow" />
                      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:border-red-100 transition-colors">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-black text-red-700 bg-red-50 px-2 py-0.5 rounded-full">{year}</span>
                          <span className="text-sm font-bold text-gray-900">{title}</span>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed">{body}</p>
                      </div>
                    </div>
                  </FadeIn>
                ))}
              </div>
            </div>
          </div>
        </FadeIn>

        {/* ── Mission banner ───────────────────────────────────────────────── */}
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

        {/* ── Core Values ─────────────────────────────────────────────────────── */}
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

        {/* ── Why Choose Us ───────────────────────────────────────────────────── */}
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

        {/* ── Vendor CTA ──────────────────────────────────────────────────────── */}
        <FadeIn>
          <div className="grid sm:grid-cols-2 gap-5">
            {/* Vendor */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7 flex flex-col">
              <div className="w-12 h-12 bg-amber-50 text-amber-700 rounded-xl flex items-center justify-center mb-4">
                <Icon.PiStorefront size={24} />
              </div>
              <h3 className="font-black text-gray-900 text-lg mb-2">Sell on DrinksHarbour</h3>
              <p className="text-sm text-gray-600 leading-relaxed mb-5 flex-1">
                Are you a wine merchant, importer, or beverage brand? List your products on Nigeria's
                fastest-growing drinks marketplace and reach thousands of verified buyers.
              </p>
              <Link
                href="/vendors/register"
                className="inline-flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white px-5 py-3 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all self-start"
              >
                Become a Vendor <Icon.PiArrowRight size={15} />
              </Link>
            </div>

            {/* Affiliate / Partner */}
            <div className="bg-gradient-to-br from-gray-900 via-red-950 to-gray-900 rounded-2xl p-7 text-white flex flex-col">
              <div className="w-12 h-12 bg-white/10 text-white rounded-xl flex items-center justify-center mb-4">
                <Icon.PiHandshake size={24} />
              </div>
              <h3 className="font-black text-lg mb-2">Partner with Us</h3>
              <p className="text-sm text-red-100 leading-relaxed mb-5 flex-1">
                Brands, event organisers, hotels, and restaurants — let's explore bulk supply agreements,
                co-branded promotions, and exclusive partnerships tailored to your business.
              </p>
              <Link
                href="/contact?subject=vendor"
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-5 py-3 rounded-xl font-bold text-sm transition-all self-start"
              >
                Get in Touch <Icon.PiArrowRight size={15} />
              </Link>
            </div>
          </div>
        </FadeIn>

        {/* ── Final CTA ───────────────────────────────────────────────────────── */}
        <FadeIn>
          <div className="text-center bg-white rounded-3xl border border-gray-100 shadow-sm p-10">
            <div className="w-14 h-14 bg-red-50 text-red-700 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Icon.PiWineBold size={28} />
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-3">Ready to explore?</h2>
            <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">
              Browse thousands of authentic beverages, compare prices across vendors, and get fast delivery anywhere in Nigeria.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/shop"
                className="inline-flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white px-7 py-3.5 rounded-xl font-bold hover:from-red-800 hover:to-red-950 transition-all shadow-md"
              >
                <Icon.PiShoppingCart size={17} /> Shop Now
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 border border-gray-200 text-gray-700 px-7 py-3.5 rounded-xl font-bold hover:border-red-200 hover:text-red-700 transition-all"
              >
                <Icon.PiEnvelope size={17} /> Contact Us
              </Link>
            </div>
          </div>
        </FadeIn>

      </div>
    </div>
  );
}
