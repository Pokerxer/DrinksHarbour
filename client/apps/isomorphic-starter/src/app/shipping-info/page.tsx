'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Data ─────────────────────────────────────────────────────────────────────

const DELIVERY_OPTIONS = [
  {
    icon: Icon.PiLightningBold,
    title: 'Same-Day Delivery',
    badge: 'Fastest',
    badgeColor: 'bg-red-100 text-red-700',
    areas: 'Abuja & Lagos only',
    cutoff: 'Order before 12:00 noon',
    fee: '₦2,500 – ₦4,000',
    highlight: true,
    details: 'Your order will be picked, packed, and delivered the same day by a dedicated rider. You\'ll receive real-time SMS updates.',
  },
  {
    icon: Icon.PiTruckBold,
    title: 'Next-Day Delivery',
    badge: 'Popular',
    badgeColor: 'bg-blue-100 text-blue-700',
    areas: 'PH, Kano, Ibadan, Enugu + major cities',
    cutoff: 'Order before 5:00 pm',
    fee: '₦1,500 – ₦3,000',
    highlight: false,
    details: 'Delivered the next business day. Available in over 20 major Nigerian cities. Exact fee shown at checkout based on your location.',
  },
  {
    icon: Icon.PiPackageBold,
    title: 'Standard Delivery',
    badge: 'Free over ₦50k',
    badgeColor: 'bg-green-100 text-green-700',
    areas: 'All 36 states + FCT',
    cutoff: 'Ships within 24 h of payment',
    fee: 'Free on orders ≥ ₦50,000 · else ₦1,000',
    highlight: false,
    details: 'Nationwide coverage via our trusted courier partners. Estimated 2–4 business days for remote areas. Tracking link sent by SMS and email.',
  },
];

const ZONES = [
  {
    zone: 'Zone 1 — FCT',
    cities: ['Abuja', 'Gwagwalada', 'Kuje', 'Bwari'],
    eta: 'Same-day / Next-day',
    color: 'border-red-300 bg-red-50',
    dot: 'bg-red-500',
  },
  {
    zone: 'Zone 2 — Southwest',
    cities: ['Lagos', 'Ibadan', 'Abeokuta', 'Akure', 'Oshogbo'],
    eta: 'Same-day (Lagos) · 1–2 days',
    color: 'border-blue-200 bg-blue-50',
    dot: 'bg-blue-500',
  },
  {
    zone: 'Zone 3 — South-South',
    cities: ['Port Harcourt', 'Benin City', 'Warri', 'Calabar', 'Uyo'],
    eta: '1–2 business days',
    color: 'border-amber-200 bg-amber-50',
    dot: 'bg-amber-500',
  },
  {
    zone: 'Zone 4 — Southeast',
    cities: ['Enugu', 'Onitsha', 'Owerri', 'Aba', 'Awka'],
    eta: '1–3 business days',
    color: 'border-purple-200 bg-purple-50',
    dot: 'bg-purple-500',
  },
  {
    zone: 'Zone 5 — North',
    cities: ['Kano', 'Kaduna', 'Katsina', 'Sokoto', 'Maiduguri', 'Zaria'],
    eta: '2–4 business days',
    color: 'border-emerald-200 bg-emerald-50',
    dot: 'bg-emerald-500',
  },
];

const TRACKING_STEPS = [
  { icon: Icon.PiCheckCircleBold, label: 'Order Confirmed',  desc: 'Payment received and order is being reviewed.' },
  { icon: Icon.PiGearBold,        label: 'Being Packed',     desc: 'Vendor is preparing your items for dispatch.' },
  { icon: Icon.PiTruckBold,       label: 'Out for Delivery', desc: 'Rider is on the way. Track link sent by SMS.' },
  { icon: Icon.PiHouseBold,       label: 'Delivered',        desc: 'Order delivered and confirmed.' },
];

const RESTRICTIONS = [
  { icon: Icon.PiIdentificationCardBold, text: 'Age verification required — a valid ID must be shown on delivery for alcoholic products.' },
  { icon: Icon.PiUserBold,               text: 'Someone must be available to receive and sign for the order.' },
  { icon: Icon.PiProhibitBold,           text: 'We do not deliver to P.O. Boxes or unregistered addresses.' },
  { icon: Icon.PiSunBold,                text: 'Orders are delivered between 9:00 am and 8:00 pm only.' },
  { icon: Icon.PiThermometerBold,        text: 'Chilled items are packed with insulated packaging but must be refrigerated promptly on receipt.' },
];

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, icon: Ic, children }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 bg-red-50 text-red-700 rounded-lg flex items-center justify-center flex-shrink-0">
          <Ic size={17} />
        </div>
        <h2 className="text-lg font-black text-gray-900">{title}</h2>
      </div>
      {children}
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ShippingInfoPage() {
  const [openOption, setOpenOption] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <div className="relative bg-gradient-to-br from-gray-900 via-red-950 to-gray-900 text-white overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-red-700 opacity-10 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-red-500 opacity-10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />
        </div>
        <div className="container mx-auto max-w-4xl px-4 py-16 relative text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 text-xs font-medium text-red-300 mb-5">
            <Icon.PiTruck size={13} />
            Shipping & Delivery
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">
            Fast delivery, all across Nigeria
          </h1>
          <p className="text-gray-300 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            Same-day delivery in Abuja and Lagos. Standard coverage nationwide.
            All orders tracked end-to-end with SMS and email updates.
          </p>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3 mt-8 max-w-lg mx-auto">
            {[
              { value: '36+', label: 'States Covered' },
              { value: '₦0',  label: 'Free over ₦50k' },
              { value: '24h', label: 'Max dispatch time' },
            ].map(({ value, label }) => (
              <div key={label} className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 border border-white/10">
                <p className="text-xl font-black">{value}</p>
                <p className="text-xs text-red-200 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-12">
            <path d="M0 48L1440 48L1440 12C1200 44 960 56 720 40C480 24 240 0 0 12L0 48Z" fill="rgb(249 250 251)" />
          </svg>
        </div>
      </div>

      <div className="container mx-auto max-w-4xl px-4 py-10 pb-16 space-y-12">

        {/* ── Delivery Options ────────────────────────────────────────────────── */}
        <Section title="Delivery Options" icon={Icon.PiTruck}>
          <div className="space-y-3">
            {DELIVERY_OPTIONS.map((opt, i) => {
              const Ic = opt.icon;
              const isOpen = openOption === i;
              return (
                <div
                  key={opt.title}
                  className={`bg-white rounded-2xl border transition-all ${
                    opt.highlight
                      ? 'border-red-200 shadow-md ring-1 ring-red-100'
                      : isOpen ? 'border-red-200 shadow-md' : 'border-gray-100 shadow-sm'
                  }`}
                >
                  <button
                    onClick={() => setOpenOption(isOpen ? null : i)}
                    className="w-full flex items-center gap-4 p-5 text-left"
                  >
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${opt.highlight ? 'bg-red-700 text-white' : 'bg-red-50 text-red-700'}`}>
                      <Ic size={21} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="font-bold text-gray-900 text-sm">{opt.title}</span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${opt.badgeColor}`}>{opt.badge}</span>
                      </div>
                      <p className="text-xs text-gray-500">{opt.areas} · {opt.fee}</p>
                    </div>
                    <div className={`w-7 h-7 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${isOpen ? 'bg-red-700 border-red-700 text-white' : 'border-gray-200 text-gray-400'}`}>
                      <motion.span animate={{ rotate: isOpen ? 45 : 0 }} transition={{ duration: 0.2 }}>
                        <Icon.PiPlus size={13} />
                      </motion.span>
                    </div>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 pt-1 border-t border-gray-50 ml-15 space-y-3">
                          <p className="text-sm text-gray-600 leading-relaxed">{opt.details}</p>
                          <div className="flex flex-wrap gap-3 text-xs">
                            <span className="flex items-center gap-1.5 text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg">
                              <Icon.PiClockBold size={13} className="text-red-600" /> Cutoff: {opt.cutoff}
                            </span>
                            <span className="flex items-center gap-1.5 text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg">
                              <Icon.PiCurrencyNgn size={13} className="text-red-600" /> {opt.fee}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </Section>

        {/* ── Delivery Zones ──────────────────────────────────────────────────── */}
        <Section title="Delivery Zones" icon={Icon.PiMapPin}>
          <div className="grid sm:grid-cols-2 gap-4">
            {ZONES.map(({ zone, cities, eta, color, dot }) => (
              <div key={zone} className={`rounded-2xl border p-5 ${color}`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dot}`} />
                  <span className="font-bold text-gray-900 text-sm">{zone}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {cities.map(c => (
                    <span key={c} className="bg-white/70 text-gray-700 text-xs px-2 py-0.5 rounded-lg border border-white font-medium">
                      {c}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                  <Icon.PiClock size={12} /> {eta}
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3 flex items-center gap-1.5">
            <Icon.PiInfo size={13} />
            All 36 states are covered. Delivery to remote LGAs may add 1–2 business days.
          </p>
        </Section>

        {/* ── Order Tracking ──────────────────────────────────────────────────── */}
        <Section title="Order Tracking" icon={Icon.PiMagnifyingGlass}>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="relative">
              {/* connector line */}
              <div className="absolute left-5 top-6 bottom-6 w-px bg-gray-100" />
              <div className="space-y-6">
                {TRACKING_STEPS.map(({ icon: Ic, label, desc }, i) => (
                  <div key={label} className="flex items-start gap-4 relative">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 z-10 ${
                      i === 0 ? 'bg-red-700 text-white' : 'bg-gray-50 text-gray-400 border border-gray-100'
                    }`}>
                      <Ic size={18} />
                    </div>
                    <div className="pt-2">
                      <p className="font-semibold text-sm text-gray-900">{label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6 pt-5 border-t border-gray-100 flex flex-wrap gap-3">
              <Link
                href="/order-tracking"
                className="inline-flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all"
              >
                <Icon.PiMagnifyingGlass size={15} /> Track My Order
              </Link>
              <p className="text-xs text-gray-400 self-center">
                Or log in to My Account → My Orders → Track Order
              </p>
            </div>
          </div>
        </Section>

        {/* ── Delivery Restrictions ───────────────────────────────────────────── */}
        <Section title="Delivery Restrictions" icon={Icon.PiWarningCircle}>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {RESTRICTIONS.map(({ icon: Ic, text }) => (
              <div key={text} className="flex items-start gap-4 p-4">
                <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Ic size={16} />
                </div>
                <p className="text-sm text-gray-600 leading-relaxed pt-1">{text}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Failed / Missed Delivery ────────────────────────────────────────── */}
        <Section title="Missed or Failed Delivery" icon={Icon.PiArrowCounterClockwise}>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4 text-sm text-gray-600 leading-relaxed">
            <p>
              If our rider is unable to reach you, they will call the number on your order.
              If unreachable, a <strong className="text-gray-900">delivery notice</strong> will be left and a re-delivery
              will be attempted on the <strong className="text-gray-900">next business day</strong>.
            </p>
            <p>
              After <strong className="text-gray-900">two failed attempts</strong>, the order is returned to
              our warehouse. You will be contacted to reschedule at a convenient time.
              A ₦500 re-delivery fee may apply.
            </p>
            <p>
              For perishable or chilled products, a third attempt may not be possible.
              Please ensure someone is available to receive your order.
            </p>
          </div>
        </Section>

        {/* ── Packaging ────────────────────────────────────────────────────────── */}
        <Section title="Packaging & Handling" icon={Icon.PiPackage}>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                icon: Icon.PiShieldCheckBold,
                title: 'Protective Wrapping',
                body: 'All bottles are individually bubble-wrapped and boxed to prevent breakage in transit.',
                color: 'bg-blue-50 text-blue-700',
              },
              {
                icon: Icon.PiThermometerBold,
                title: 'Temperature Control',
                body: 'Chilled wines and beers are packed with insulated liners and ice packs for same-day deliveries.',
                color: 'bg-cyan-50 text-cyan-700',
              },
              {
                icon: Icon.PiLeafBold,
                title: 'Eco Packaging',
                body: 'We use recyclable and biodegradable materials wherever possible to reduce our environmental footprint.',
                color: 'bg-green-50 text-green-700',
              },
            ].map(({ icon: Ic, title, body, color }) => (
              <div key={title} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-red-100 transition-colors">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
                  <Ic size={20} />
                </div>
                <h3 className="font-bold text-gray-900 text-sm mb-1.5">{title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ── CTA ─────────────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center">
          <div className="w-12 h-12 bg-red-50 text-red-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Icon.PiHeadset size={24} />
          </div>
          <h2 className="text-lg font-black text-gray-900 mb-2">Delivery questions?</h2>
          <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
            Our support team can help with delivery schedules, address changes, and special requests.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white px-6 py-3 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all shadow-md"
            >
              <Icon.PiEnvelope size={16} /> Contact Support
            </Link>
            <Link
              href="/faqs#delivery"
              className="inline-flex items-center gap-2 border border-gray-200 text-gray-700 px-6 py-3 rounded-xl font-bold text-sm hover:border-red-200 hover:text-red-700 transition-all"
            >
              <Icon.PiQuestion size={16} /> Delivery FAQs
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
