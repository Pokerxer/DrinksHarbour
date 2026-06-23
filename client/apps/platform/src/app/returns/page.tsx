'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Data ─────────────────────────────────────────────────────────────────────

const RETURN_STEPS = [
  {
    step: '01',
    icon: Icon.PiChatCircleTextBold,
    title: 'Contact Support',
    desc: 'Reach out within 7 days of delivery via the contact form, email, or WhatsApp. Share your order number and the reason for your return.',
  },
  {
    step: '02',
    icon: Icon.PiCameraBold,
    title: 'Submit Evidence',
    desc: 'For damaged or wrong items, attach clear photos. Our team reviews all requests within 24 hours and will confirm eligibility.',
  },
  {
    step: '03',
    icon: Icon.PiTruckBold,
    title: 'We Arrange Pickup',
    desc: 'Once approved, we schedule a free pickup from your address. Repackage the item in its original box with all accessories.',
  },
  {
    step: '04',
    icon: Icon.PiMagnifyingGlassBold,
    title: 'Inspection',
    desc: 'Returned items are inspected by our team to confirm eligibility. This typically takes 1–2 business days after receipt.',
  },
  {
    step: '05',
    icon: Icon.PiBankBold,
    title: 'Refund Issued',
    desc: 'Approved refunds are processed within 3–5 business days back to your original payment method. You\'ll receive a confirmation email.',
  },
];

const ELIGIBLE = [
  { icon: Icon.PiSealBold,             text: 'Unopened items in original, undamaged packaging' },
  { icon: Icon.PiWarningBold,          text: 'Products with a manufacturing defect or quality issue' },
  { icon: Icon.PiArrowsLeftRightBold,  text: 'Wrong item delivered (different product or size)' },
  { icon: Icon.PiPackageBold,          text: 'Items damaged in transit — report on delivery or within 24 h' },
  { icon: Icon.PiThermometerBold,      text: 'Spoiled or improperly stored items received in poor condition' },
];

const NOT_ELIGIBLE = [
  { icon: Icon.PiWineBold,        text: 'Opened, tasted, or partially consumed products' },
  { icon: Icon.PiCalendarXBold,   text: 'Returns requested more than 7 days after delivery' },
  { icon: Icon.PiTagBold,         text: 'Items with removed or damaged seals or labels' },
  { icon: Icon.PiPercent,         text: 'Flash-sale or clearance items (unless defective)' },
  { icon: Icon.PiGiftBold,        text: 'Gift cards and promotional credits' },
  { icon: Icon.PiProhibitBold,    text: 'Items not purchased directly on DrinksHarbour' },
];

const REFUND_METHODS = [
  {
    icon: Icon.PiCreditCardBold,
    method: 'Card Payment',
    timeline: '3–5 business days',
    note: 'Reversed to the original card used at checkout.',
    color: 'bg-blue-50 text-blue-700',
  },
  {
    icon: Icon.PiBankBold,
    method: 'Bank Transfer / USSD',
    timeline: '3–5 business days',
    note: 'Credited to your registered bank account.',
    color: 'bg-emerald-50 text-emerald-700',
  },
  {
    icon: Icon.PiWalletBold,
    method: 'Store Credit',
    timeline: 'Instant',
    note: 'Opt in for instant store credit — usable on your next order.',
    color: 'bg-amber-50 text-amber-700',
  },
];

const FAQS = [
  {
    q: 'Do I pay for return shipping?',
    a: 'No. For approved returns, we arrange and cover the cost of pickup from your address. You only need to repackage the item.',
  },
  {
    q: 'Can I exchange instead of getting a refund?',
    a: 'Yes. During the return request you can choose between a refund or an exchange for the same item in a different size, or store credit.',
  },
  {
    q: 'What if my item was a gift?',
    a: 'Gift returns are accepted within the standard 7-day window. The refund will be issued as store credit to avoid notifying the gift buyer.',
  },
  {
    q: 'My bottle was damaged on delivery — what should I do?',
    a: 'Note the damage on the delivery confirmation and take photos immediately. Contact us within 24 hours. We will arrange a replacement or full refund at no extra cost.',
  },
  {
    q: 'Can I return part of a multi-bottle order?',
    a: 'Yes, partial returns are accepted. Each item is assessed individually. Refunds are calculated pro-rata for the eligible items only.',
  },
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

// ─── Accordion ────────────────────────────────────────────────────────────────

function AccordionItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`bg-white rounded-2xl border transition-all ${open ? 'border-red-200 shadow-md' : 'border-gray-100 shadow-sm'}`}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-4 p-5 text-left">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-6 h-6 rounded-full bg-red-50 text-red-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
            {index + 1}
          </span>
          <span className="font-semibold text-gray-900 text-sm leading-snug">{q}</span>
        </div>
        <div className={`w-7 h-7 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${open ? 'bg-red-700 border-red-700 text-white' : 'border-gray-200 text-gray-400'}`}>
          <motion.span animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.2 }}>
            <Icon.PiPlus size={14} />
          </motion.span>
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <p className="px-5 pb-5 text-sm text-gray-600 leading-relaxed border-t border-gray-50 pt-3 ml-9">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReturnsPage() {
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
            <Icon.PiArrowCounterClockwise size={13} />
            Returns & Refunds
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">
            Not happy? We'll make it right.
          </h1>
          <p className="text-gray-300 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            We stand behind every product we sell. If something's wrong, our straightforward
            return process gets you a refund or replacement fast.
          </p>

          {/* Quick pills */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-7">
            {[
              { icon: Icon.PiCalendarBold,  label: '7-day return window' },
              { icon: Icon.PiTruckBold,     label: 'Free pickup' },
              { icon: Icon.PiBankBold,      label: 'Refund in 3–5 days' },
            ].map(({ icon: Ic, label }) => (
              <div key={label} className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/10 rounded-full px-4 py-2 text-xs font-medium text-white">
                <Ic size={13} className="text-red-300" />
                {label}
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

        {/* ── How to Return ───────────────────────────────────────────────────── */}
        <Section title="How to Return an Item" icon={Icon.PiArrowCounterClockwise}>
          <div className="relative">
            {/* connector line */}
            <div className="hidden sm:block absolute left-[52px] top-10 bottom-10 w-px bg-gradient-to-b from-red-200 via-red-300 to-red-100" />
            <div className="space-y-4">
              {RETURN_STEPS.map(({ step, icon: Ic, title, desc }) => (
                <div key={step} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start gap-4 hover:border-red-100 transition-colors">
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <div className="w-10 h-10 rounded-xl bg-red-700 text-white flex items-center justify-center z-10">
                      <Ic size={19} />
                    </div>
                    <span className="text-[10px] font-black text-red-400">{step}</span>
                  </div>
                  <div className="pt-1">
                    <h3 className="font-bold text-gray-900 text-sm mb-1">{title}</h3>
                    <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/contact?subject=returns"
              className="inline-flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all"
            >
              <Icon.PiChatCircleText size={15} /> Start a Return
            </Link>
            <a
              href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_PHONE || '2348000000000'}?text=${encodeURIComponent('Hi! I need to return an order. Order #: ')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#25D366] text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-[#1ebe5d] transition-all"
            >
              <Icon.PiWhatsappLogo size={15} /> Return via WhatsApp
            </a>
          </div>
        </Section>

        {/* ── Eligible / Not Eligible ─────────────────────────────────────────── */}
        <Section title="What Can Be Returned?" icon={Icon.PiListChecks}>
          <div className="grid sm:grid-cols-2 gap-5">
            {/* Eligible */}
            <div className="bg-white rounded-2xl border border-green-100 shadow-sm overflow-hidden">
              <div className="bg-green-50 px-5 py-3 flex items-center gap-2 border-b border-green-100">
                <Icon.PiCheckCircleFill size={17} className="text-green-600" />
                <span className="font-bold text-green-800 text-sm">Eligible for Return</span>
              </div>
              <div className="divide-y divide-gray-50">
                {ELIGIBLE.map(({ icon: Ic, text }) => (
                  <div key={text} className="flex items-start gap-3 p-4">
                    <div className="w-7 h-7 bg-green-50 text-green-700 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Ic size={14} />
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed pt-1">{text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Not eligible */}
            <div className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
              <div className="bg-red-50 px-5 py-3 flex items-center gap-2 border-b border-red-100">
                <Icon.PiXCircleFill size={17} className="text-red-600" />
                <span className="font-bold text-red-800 text-sm">Not Eligible</span>
              </div>
              <div className="divide-y divide-gray-50">
                {NOT_ELIGIBLE.map(({ icon: Ic, text }) => (
                  <div key={text} className="flex items-start gap-3 p-4">
                    <div className="w-7 h-7 bg-red-50 text-red-600 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Ic size={14} />
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed pt-1">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ── Refund Methods ──────────────────────────────────────────────────── */}
        <Section title="Refund Methods" icon={Icon.PiBankBold}>
          <div className="grid sm:grid-cols-3 gap-4">
            {REFUND_METHODS.map(({ icon: Ic, method, timeline, note, color }) => (
              <div key={method} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-red-100 transition-colors">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
                  <Ic size={20} />
                </div>
                <h3 className="font-bold text-gray-900 text-sm mb-1">{method}</h3>
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon.PiClock size={12} className="text-red-600" />
                  <span className="text-xs font-semibold text-red-700">{timeline}</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{note}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3 flex items-start gap-1.5">
            <Icon.PiInfo size={13} className="flex-shrink-0 mt-0.5" />
            Refund timelines begin once the returned item has passed inspection and been approved.
          </p>
        </Section>

        {/* ── Policy Banner ───────────────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-red-700 to-red-900 rounded-3xl p-7 text-white">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Icon.PiShieldCheckBold size={24} />
            </div>
            <div>
              <h3 className="font-black text-lg mb-1">Our Promise to You</h3>
              <p className="text-red-100 text-sm leading-relaxed">
                Every product on DrinksHarbour is sourced from verified vendors and guaranteed authentic.
                If anything falls short of your expectations — quality, condition, or accuracy — we will
                resolve it promptly. No runaround, no excessive fine print.
              </p>
            </div>
          </div>
        </div>

        {/* ── FAQs ────────────────────────────────────────────────────────────── */}
        <Section title="Common Questions" icon={Icon.PiQuestion}>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <AccordionItem key={faq.q} q={faq.q} a={faq.a} index={i} />
            ))}
          </div>
        </Section>

        {/* ── CTA ─────────────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center">
          <div className="w-12 h-12 bg-red-50 text-red-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Icon.PiHeadset size={24} />
          </div>
          <h2 className="text-lg font-black text-gray-900 mb-2">Need help with a return?</h2>
          <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
            Our team responds within 24 hours. For urgent issues, WhatsApp is the fastest route.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/contact?subject=returns"
              className="inline-flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white px-6 py-3 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all shadow-md"
            >
              <Icon.PiEnvelope size={16} /> Contact Support
            </Link>
            <Link
              href="/faqs#returns"
              className="inline-flex items-center gap-2 border border-gray-200 text-gray-700 px-6 py-3 rounded-xl font-bold text-sm hover:border-red-200 hover:text-red-700 transition-all"
            >
              <Icon.PiQuestion size={16} /> Returns FAQs
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
